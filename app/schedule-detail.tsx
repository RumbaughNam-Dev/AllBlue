import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, ScheduleDetail } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';

const STUDENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'LECTURE'];
const FORM_BASE_URL = 'https://rumbaugh.co.kr/form';
const CATEGORIES_MAP: Record<string, string> = {
  EXPERIENCE: '체험교육', CERTIFICATION: '자격증 과정', LECTURE: '특강',
  TRAINING: '트레이닝', FUN_DIVE: '펀다이빙', ETC: '기타',
};

export default function ScheduleDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const fetchDetail = (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    api.getScheduleDetail(Number(id))
      .then((res) => setSchedule(res.schedule))
      .catch((e) => {
        if (!e._handled) Alert.alert('오류', '일정을 불러올 수 없습니다.');
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  const initialLoad = useRef(true);

  useEffect(() => { fetchDetail(); }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (initialLoad.current) {
        initialLoad.current = false;
        return;
      }
      fetchDetail(false);
    }, [id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDetail(false);
  };

  const participantLabel = schedule
    ? (STUDENT_CATEGORIES.includes(schedule.categoryCode) ? '교육생' : '참석자')
    : '참석자';

  const isOwner = schedule?.isOwner ?? false;
  const myParticipantId = schedule?.myParticipantId;

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSchedule(Number(id));
            Alert.alert('알림', '일정이 삭제되었습니다.', [
              { text: '확인', onPress: () => router.back() },
            ]);
          } catch (e: any) {
            if (!e._handled) Alert.alert('삭제 실패', e.message ?? '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const openDocument = (uuid?: string, participantId?: number) => {
    if (!uuid) {
      Alert.alert('알림', '서류가 등록되지 않았습니다.');
      return;
    }
    if (!isOwner && myParticipantId !== participantId) {
      Alert.alert('알림', '내 일정 또는 내 문서만 조회할 수 있어요.');
      return;
    }
    WebBrowser.openBrowserAsync(`${FORM_BASE_URL}/${uuid}?from=instructor`);
  };

  const copyFormUrl = async (uuid?: string, participantId?: number) => {
    if (!uuid) return;
    if (!isOwner && myParticipantId !== participantId) {
      Alert.alert('알림', '내 일정 또는 내 문서만 조회할 수 있어요.');
      return;
    }
    const url = `${FORM_BASE_URL}/${uuid}`;
    await Clipboard.setStringAsync(url);
    Alert.alert('알림', 'URL이 복사되었습니다.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {schedule?.title ?? ''}
        </Text>
        <Pressable
          onPress={() => setMenuVisible(!menuVisible)}
          style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.menuCircle}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </View>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : schedule ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Info rows */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>장소</Text>
              <Text style={styles.infoValue}>{schedule.poolName || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>분류</Text>
              <Text style={styles.infoValue}>{schedule.categoryName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>일시</Text>
              <Text style={styles.infoValue}>
                {(() => {
                  const d = new Date(schedule.scheduleDate + 'T00:00:00');
                  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ${String(schedule.startHour).padStart(2, '0')}시 ${String(schedule.startMinute).padStart(2, '0')}분`;
                })()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Participants */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{participantLabel}</Text>
            <Pressable onPress={handleRefresh} disabled={refreshing} style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.5 }]}>
              <Text style={[styles.refreshIcon, refreshing && { opacity: 0.3 }]}>↻</Text>
            </Pressable>
          </View>
          {schedule.participants.length === 0 ? (
            <Text style={styles.emptyText}>{participantLabel}가 없습니다</Text>
          ) : (
            schedule.participants
              .filter((p) => isOwner || myParticipantId === p.id)
              .map((p) => {
              const isMe = myParticipantId === p.id;
              const showCopyUrl = isOwner && !isMe;
              const showSignButton = isMe && !isOwner;

              const openFormForSign = (uuid?: string) => {
                if (!uuid) return;
                WebBrowser.openBrowserAsync(`${FORM_BASE_URL}/${uuid}`).then(() => handleRefresh());
              };

              return (
              <View key={`${p.isGuest ? 'g' : 'u'}_${p.id}`} style={styles.participantCard}>
                <View style={styles.participantNameRow}>
                  <Text style={styles.participantName}>
                    {p.nickname}{p.name ? ` (${p.name})` : ''}
                  </Text>
                  <LevelBadge level={p.level} size={18} />
                </View>
                {p.categoryCode && (
                  <View style={styles.participantMeta}>
                    <Text style={styles.participantMetaText}>
                      {CATEGORIES_MAP[p.categoryCode] ?? p.categoryCode}
                    </Text>
                    {p.participantLicenses && p.participantLicenses.length > 0 && (
                      <Text style={styles.participantMetaText}>
                        {' · '}{p.participantLicenses.map((l) => l.nameKo).join(', ')}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.docRow}>
                  <Text style={styles.docLabel}>면책동의서</Text>
                  <View style={styles.docActions}>
                    {p.waiverSigned ? (
                      <Pressable onPress={() => openDocument(p.waiverUuid, p.id)}>
                        <View style={[styles.docBadge, styles.docBadgeSigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextSigned]}>완료</Text>
                        </View>
                      </Pressable>
                    ) : (
                      <>
                        <View style={[styles.docBadge, styles.docBadgeUnsigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextUnsigned]}>미제출</Text>
                        </View>
                        {p.waiverUuid && !p.waiverReused && showCopyUrl && (
                          <Pressable onPress={() => copyFormUrl(p.waiverUuid, p.id)} style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.copyText}>URL 복사</Text>
                          </Pressable>
                        )}
                        {p.waiverUuid && !p.waiverReused && showSignButton && (
                          <Pressable onPress={() => openFormForSign(p.waiverUuid)} style={({ pressed }) => [styles.signButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.signText}>서명하기</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.docRow}>
                  <Text style={styles.docLabel}>의료진술서</Text>
                  <View style={styles.docActions}>
                    {p.medicalSigned ? (
                      <Pressable onPress={() => openDocument(p.medicalUuid, p.id)}>
                        <View style={[styles.docBadge, styles.docBadgeSigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextSigned]}>완료</Text>
                        </View>
                      </Pressable>
                    ) : (
                      <>
                        <View style={[styles.docBadge, styles.docBadgeUnsigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextUnsigned]}>미제출</Text>
                        </View>
                        {p.medicalUuid && !p.medicalReused && showCopyUrl && (
                          <Pressable onPress={() => copyFormUrl(p.medicalUuid, p.id)} style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.copyText}>URL 복사</Text>
                          </Pressable>
                        )}
                        {p.medicalUuid && !p.medicalReused && showSignButton && (
                          <Pressable onPress={() => openFormForSign(p.medicalUuid)} style={({ pressed }) => [styles.signButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.signText}>서명하기</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </View>
                {/* 라이센스 정보 / 디브리핑 버튼 */}
                {(() => {
                  const isMe = myParticipantId === p.id;
                  const isInstructor = isOwner;
                  const hasLicense = !p.isGuest && p.hasInProgressLicense;
                  const showLicense = isMe || (isInstructor && hasLicense);
                  const showDebriefing = isInstructor && !isMe;
                  if (!showLicense && !showDebriefing) return null;
                  return (
                    <View style={styles.actionRow}>
                      {showLicense && (
                        <Pressable
                          onPress={() => {
                            if (p.isGuest) {
                              Alert.alert('알림', '앱 사용자가 아닙니다.');
                              return;
                            }
                            router.push({
                              pathname: '/achievement',
                              params: {
                                participantId: String(p.id),
                                participantName: p.name ? `${p.nickname} (${p.name})` : p.nickname,
                                participantLevel: p.level != null ? String(p.level) : '',
                              },
                            });
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.actionButtonText}>다이빙 로그</Text>
                        </Pressable>
                      )}
                      {showDebriefing && (
                        <Pressable
                          onPress={() => {
                            router.push({
                              pathname: '/debriefing',
                              params: {
                                scheduleId: String(schedule!.id),
                                participantId: String(p.id),
                                participantName: p.name ? `${p.nickname} (${p.name})` : p.nickname,
                                isGuest: p.isGuest ? '1' : '0',
                              },
                            });
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.actionButtonText}>디브리핑</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
              </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>일정 정보를 찾을 수 없습니다</Text>
        </View>
      )}

      {/* Dropdown Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuDropdown, { top: Platform.OS === 'ios' ? insets.top + 52 : 52 }]}>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                if (!isOwner) {
                  Alert.alert('알림', '내 일정만 수정할 수 있습니다.');
                  return;
                }
                if (schedule) {
                  router.push({ pathname: '/schedule-add', params: { id: String(schedule.id), date: schedule.scheduleDate } });
                }
              }}
            >
              <Text style={styles.menuItemText}>수정</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                if (!isOwner) {
                  Alert.alert('알림', '내 일정만 삭제할 수 있습니다.');
                  return;
                }
                handleDelete();
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDelete]}>삭제</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: {
    flex: 1, fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center',
  },
  menuButton: {
    width: 36, height: 36,
  },
  menuCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  hamburgerLine: {
    width: 18, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuDropdown: {
    position: 'absolute', right: 20,
    backgroundColor: Colors.brand.deep ?? '#022B4A',
    borderRadius: 12, minWidth: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8, overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 20, paddingVertical: 14,
  },
  menuItemText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
  },
  menuItemDelete: {
    color: '#FF6B6B',
  },
  menuDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  infoSection: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    width: 60,
  },
  infoValue: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    flex: 1,
  },
  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
  },
  refreshButton: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 20, color: 'rgba(255,255,255,0.5)',
  },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', paddingVertical: 20,
  },
  participantCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14,
  },
  participantNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8,
  },
  participantName: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
  },
  actionRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  actionButton: {
    flex: 1, backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning,
  },
  actionButtonDone: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  actionButtonTextDone: {
    color: Colors.brand.success,
  },
  participantMeta: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  participantMetaText: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)',
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  docLabel: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)',
  },
  docActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  copyButton: {
    backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  copyText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.warning,
  },
  signButton: {
    backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  signText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.warning,
  },
  docBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  docBadgeSigned: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  docBadgeUnsigned: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  docBadgeText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 12,
  },
  docTextSigned: {
    color: Colors.brand.success,
  },
  docTextUnsigned: {
    color: 'rgba(255,255,255,0.3)',
  },
});
