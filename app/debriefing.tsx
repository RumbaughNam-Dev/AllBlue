import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TextInput, Pressable, Alert,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, UserLicense, AchievementRequirement } from '@/services/api';
import Spinner from '@/components/Spinner';

function RequirementItem({ item, onToggle, onUncheck }: {
  item: AchievementRequirement;
  onToggle: (id: number, passed: boolean) => void;
  onUncheck: (id: number) => Promise<{ success: boolean; message?: string }>;
}) {
  const [passed, setPassed] = useState(item.isCompleted);
  const [busy, setBusy] = useState(false);
  const strikeAnim = useRef(new Animated.Value(item.isCompleted ? 1 : 0)).current;
  const checkAnim = useRef(new Animated.Value(item.isCompleted ? 1 : 0)).current;
  const [textWidth, setTextWidth] = useState(0);

  const animateCheck = () => {
    Animated.sequence([
      Animated.timing(strikeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const animateUncheck = () => {
    Animated.parallel([
      Animated.timing(checkAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(strikeAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const handlePress = async () => {
    if (busy) return;
    const next = !passed;

    if (!next && item.isCompleted) {
      // 원래 통과였던 항목 체크 해제 → 즉시 API 호출
      setBusy(true);
      try {
        const result = await onUncheck(item.id);
        if (!result.success) {
          Alert.alert('알림', result.message || '취소 처리에 실패했습니다.');
          return;
        }
        setPassed(false);
        onToggle(item.id, false);
        animateUncheck();
      } catch {
        Alert.alert('오류', '취소 처리에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    } else {
      setPassed(next);
      onToggle(item.id, next);
      if (next) animateCheck();
      else animateUncheck();
    }
  };

  const textColor = strikeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.35)'],
  });

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const strikeActualWidth = strikeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, textWidth],
  });

  const displayText = (item.nameKo || item.name) + (item.displayValue ? ` (${item.displayValue})` : '');

  return (
    <Pressable style={styles.requirementRow} onPress={handlePress}>
      <View style={styles.reqDot} />
      <View style={styles.reqTextWrap}>
        <Animated.Text style={[styles.requirementText, { color: textColor }]}>
          {displayText}
        </Animated.Text>
        {/* 글자 폭 측정용 (숨겨진 텍스트) */}
        <Text
          style={[styles.requirementText, styles.measureText]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {displayText}
        </Text>
        <Animated.View style={[styles.strikeLine, { width: strikeActualWidth }]} />
      </View>
      <View style={styles.checkCircleUndone}>
        <Text style={styles.checkMarkUndone}>✓</Text>
      </View>
      <Animated.View style={[styles.checkCircleDone, { transform: [{ scale: checkScale }], position: 'absolute', right: 0 }]}>
        <Text style={styles.checkMark}>✓</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function DebriefingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scheduleId, participantId, participantName, isGuest } = useLocalSearchParams<{
    scheduleId: string;
    participantId: string;
    participantName: string;
    isGuest?: string;
  }>();
  const guestUser = isGuest === '1';

  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [passedIds, setPassedIds] = useState<Set<number>>(new Set());
  const [uncheckedIds, setUncheckedIds] = useState<Set<number>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  // 원래 통과 상태였던 항목 id를 기억
  const [originalCompletedIds, setOriginalCompletedIds] = useState<Set<number>>(new Set());

  const handleUncheck = useCallback(async (id: number): Promise<{ success: boolean; message?: string }> => {
    try {
      return await api.toggleAchievement(id, Number(participantId), false);
    } catch (e: any) {
      return { success: false, message: e.message || '취소 처리에 실패했습니다.' };
    }
  }, [participantId]);

  const handleRequirementToggle = useCallback((id: number, passed: boolean) => {
    const wasOriginallyCompleted = originalCompletedIds.has(id);

    if (wasOriginallyCompleted) {
      // 원래 통과였던 항목: 해제는 즉시 API 호출로 처리됨
      // 다시 체크하면 passedIds에 추가 (재통과 처리)
      if (passed) {
        setPassedIds((prev) => new Set(prev).add(id));
      } else {
        setPassedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      return;
    } else {
      // 원래 미통과였던 항목: 체크하면 passedIds에 추가, 해제하면 제거
      setPassedIds((prev) => {
        const next = new Set(prev);
        if (passed) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  }, [originalCompletedIds]);

  useEffect(() => {
    if (!participantId || guestUser) {
      setLoading(false);
      return;
    }
    api.getUserAchievements(Number(participantId))
      .then((res) => {
        setLicenses(res.licenses ?? []);
        // 원래 통과 상태 기억
        const completedSet = new Set<number>();
        for (const lic of res.licenses ?? []) {
          for (const req of lic.requirements) {
            if (req.isCompleted) completedSet.add(req.id);
          }
        }
        setOriginalCompletedIds(completedSet);
      })
      .catch((e) => {
        if (!e._handled) Alert.alert('오류', '정보를 불러올 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [participantId]);

  const inProgressLicense = useMemo(
    () => licenses.find((lic) => lic.status === 'IN_PROGRESS'),
    [licenses]
  );

  const uncompletedItems = useMemo(() => {
    if (!inProgressLicense) return [];
    return inProgressLicense.requirements.filter(
      (r) => r.reqType !== 'GROUP' && !r.isCompleted
    );
  }, [inProgressLicense]);

  type ReqSection = { groupName: string; data: AchievementRequirement[] };

  const filteredSections = useMemo((): ReqSection[] => {
    if (!inProgressLicense) return [];
    const sections: ReqSection[] = [];
    let current: ReqSection | null = null;
    for (const req of inProgressLicense.requirements) {
      if (req.reqType === 'GROUP') {
        current = { groupName: req.nameKo || req.name, data: [] };
        sections.push(current);
      } else if (current) {
        if (showCompleted || !req.isCompleted) {
          current.data.push(req);
        }
      }
    }
    return sections.filter((s) => s.data.length > 0);
  }, [inProgressLicense, showCompleted]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 새로 체크한 요건 통과 처리 (체크 해제는 터치 시 즉시 처리됨)
      const passPromises = Array.from(passedIds).map((reqId) =>
        api.toggleAchievement(reqId, Number(participantId), true)
      );
      if (passPromises.length > 0) {
        const results = await Promise.all(passPromises);
        const failed = results.find((r) => !r.success);
        if (failed) {
          Alert.alert('알림', failed.message || '일부 처리에 실패했습니다.');
          return;
        }
      }

      // 디브리핑 레코드 항상 저장
      await api.saveDebriefing(Number(scheduleId), Number(participantId), memo.trim());

      Alert.alert('알림', '저장되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e: any) {
      if (!e._handled) Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const licenseName = inProgressLicense?.license?.nameKo
    || inProgressLicense?.license?.name
    || inProgressLicense?.licenseNameKo
    || inProgressLicense?.licenseName;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>디브리핑</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <>
          {/* 상단 정보 + 라이센스 통과 처리 */}
          <View style={styles.topArea}>
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>이름</Text>
                <Text style={styles.infoValue}>{participantName}</Text>
              </View>
              {inProgressLicense && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>자격증 과정</Text>
                  <View style={styles.licenseInfo}>
                    <Text style={styles.infoValue}>{licenseName}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>진행중</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {!guestUser && inProgressLicense ? (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>라이센스 통과 처리</Text>
                  <Pressable style={styles.segmentWrap} onPress={() => setShowCompleted((v) => !v)}>
                    <View style={[styles.segmentItem, !showCompleted && styles.segmentItemActive]}>
                      <Text style={[styles.segmentText, !showCompleted && styles.segmentTextActive]}>To-Do</Text>
                    </View>
                    <View style={[styles.segmentItem, showCompleted && styles.segmentItemActive]}>
                      <Text style={[styles.segmentText, showCompleted && styles.segmentTextActive]}>All</Text>
                    </View>
                  </Pressable>
                </View>

                <SectionList
                  sections={filteredSections}
                  keyExtractor={(item) => String(item.id)}
                  renderSectionHeader={({ section }) => (
                    <View style={styles.stickyGroupHeader}>
                      <Text style={styles.groupHeaderText}>{section.groupName}</Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <RequirementItem item={item} onToggle={handleRequirementToggle} onUncheck={handleUncheck} />
                  )}
                  stickySectionHeadersEnabled={true}
                  showsVerticalScrollIndicator={true}
                  style={styles.requirementsList}
                  contentContainerStyle={styles.requirementsContent}
                />
              </>
            ) : (
              <>
                <View style={styles.divider} />
                <Text style={styles.memoLabel}>디브리핑 메모</Text>
                <TextInput
                  style={styles.memoInputInline}
                  placeholder="오늘 교육 내용, 피드백, 다음 시간 목표 등을 기록하세요."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={memo}
                  onChangeText={setMemo}
                />
              </>
            )}
          </View>

          {/* 하단 */}
          <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
            {!guestUser && inProgressLicense && (
              <>
                <Text style={styles.memoLabel}>디브리핑 메모</Text>
                <TextInput
                  style={styles.memoInput}
                  placeholder="오늘 교육 내용, 피드백, 다음 시간 목표 등을 기록하세요."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={memo}
                  onChangeText={setMemo}
                />
              </>
            )}
            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '저장'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topArea: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  infoSection: {},
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    width: 80,
  },
  infoValue: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
  },
  licenseInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: {
    backgroundColor: 'rgba(235,160,60,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.warning,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  sectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white,
  },
  segmentWrap: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, overflow: 'hidden',
  },
  segmentItem: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  segmentItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  segmentText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.35)',
  },
  segmentTextActive: {
    color: Colors.brand.white,
  },

  requirementsList: { flex: 1 },
  requirementsContent: { paddingBottom: 8 },
  stickyGroupHeader: {
    backgroundColor: Colors.brand.primary,
    paddingVertical: 8,
  },
  groupHeaderText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.6)',
  },
  requirementRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 4,
  },
  reqDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 10,
  },
  reqTextWrap: {
    flex: 1, justifyContent: 'center',
  },
  requirementText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)',
  },
  measureText: {
    position: 'absolute', opacity: 0, alignSelf: 'flex-start',
  },
  strikeLine: {
    position: 'absolute', left: 0, top: '50%',
    height: 1.5, backgroundColor: 'rgba(255,255,255,0.4)',
  },
  checkCircleUndone: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  checkMarkUndone: {
    fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.3)',
  },
  checkCircleDone: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.brand.success,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  checkMark: {
    fontSize: 12, fontWeight: 'bold', color: '#FFFFFF',
  },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 20,
  },

  bottomArea: {
    paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  memoLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  memoInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 14,
    fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white,
    height: 120,
    marginBottom: 12,
  },
  memoInputInline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 14,
    fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white,
    height: 120,
  },
  saveButton: {
    height: 50, borderRadius: 12,
    backgroundColor: Colors.brand.warning,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: {
    fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white,
  },
});
