import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, UserLicense, AchievementRequirement, DebriefingItem } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';
import { useAuth } from '@/contexts/AuthContext';

type Section = {
  group: AchievementRequirement;
  data: AchievementRequirement[];
};

const ASSOC_PRIORITY: Record<string, number> = {
  AIDA: 1, PADI: 2, PSA: 3, SSI: 4, CMAS: 5, SNSI: 6,
  RAID: 7, PFI: 8, FII: 9, AFIA: 10, UTA: 11, IANTD: 12,
};

const PAGE_SIZE = 10;
const MAX_RENDERED = 50;

function getLicenseSortKey(lic: UserLicense): string {
  const statusOrder = lic.status === 'IN_PROGRESS' ? '0' : '1';
  const assocCode = lic.license?.association?.code || '';
  const priority = String(ASSOC_PRIORITY[assocCode] ?? 99).padStart(2, '0');
  return `${statusOrder}_${priority}_${lic.licenseId}`;
}

function buildSections(requirements: AchievementRequirement[], allCompleted: boolean): Section[] {
  const result: Section[] = [];
  let currentSection: Section | null = null;
  for (const req of requirements) {
    if (req.reqType === 'GROUP') {
      currentSection = { group: req, data: [] };
      result.push(currentSection);
    } else if (currentSection) {
      const item = allCompleted ? { ...req, isCompleted: true } : req;
      currentSection.data.push(item);
    } else {
      currentSection = {
        group: { id: 0, name: 'Performance', nameKo: '수행 평가', reqGroup: 'PERFORMANCE', reqType: 'GROUP', code: null, unit: '', minValue: null, displayValue: null, isOptional: false, isCompleted: false, completedAt: null, completedBy: null },
        data: [allCompleted ? { ...req, isCompleted: true } : req],
      };
      result.push(currentSection);
    }
  }
  return result;
}

function formatDebriefingDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function AchievementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { participantId, participantName, participantLevel } = useLocalSearchParams<{
    participantId: string;
    participantName: string;
    participantLevel?: string;
  }>();

  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Debriefing pagination
  const [debriefings, setDebriefings] = useState<DebriefingItem[]>([]);
  const [debriefingPage, setDebriefingPage] = useState(1);
  const [debriefingHasMore, setDebriefingHasMore] = useState(true);
  const [debriefingLoading, setDebriefingLoading] = useState(false);

  const fetchData = () => {
    if (!participantId) return;
    api.getUserAchievements(Number(participantId))
      .then((res) => setLicenses(res.licenses ?? []))
      .catch((e) => {
        if (!e._handled) Alert.alert('오류', '라이센스 정보를 불러올 수 없습니다.');
      })
      .finally(() => setLoading(false));
  };

  const fetchDebriefings = useCallback((page: number) => {
    if (!participantId || debriefingLoading) return;
    setDebriefingLoading(true);
    api.getDebriefings(Number(participantId), page, PAGE_SIZE)
      .then((res) => {
        setDebriefings((prev) => {
          const merged = page === 1 ? res.debriefings : [...prev, ...res.debriefings];
          // 상단 오래된 데이터 제거
          if (merged.length > MAX_RENDERED) {
            return merged.slice(merged.length - MAX_RENDERED);
          }
          return merged;
        });
        setDebriefingHasMore(res.hasMore);
        setDebriefingPage(page);
      })
      .catch(() => {})
      .finally(() => setDebriefingLoading(false));
  }, [participantId, debriefingLoading]);

  useEffect(() => { fetchData(); }, [participantId]);
  useEffect(() => { if (participantId) fetchDebriefings(1); }, [participantId]);

  const sortedLicenses = useMemo(
    () => [...licenses]
      .filter((lic) => lic.status !== 'COMPLETED')
      .sort((a, b) => getLicenseSortKey(a).localeCompare(getLicenseSortKey(b))),
    [licenses]
  );

  const isSectionCompleted = (section: Section): boolean => {
    return section.data.every((c) => c.isOptional || c.isCompleted);
  };

  const renderRequirement = (item: AchievementRequirement) => {
    const isMeasure = item.reqType === 'MEASURE';
    if (isMeasure) {
      return (
        <View key={item.id} style={styles.measureRow}>
          <View style={styles.measureInfo}>
            <Text style={[styles.measureLabel, item.isCompleted && styles.completedText]}>{item.name}</Text>
            {item.displayValue && (
              <Text style={[styles.measureValue, item.isCompleted && styles.completedText]}>{item.displayValue}</Text>
            )}
          </View>
          <View style={[styles.checkCircle, item.isCompleted ? styles.checkDone : styles.checkUndone]}>
            <Text style={[styles.checkMark, item.isCompleted ? styles.checkMarkDone : styles.checkMarkUndone]}>✓</Text>
          </View>
        </View>
      );
    }
    return (
      <View key={item.id} style={styles.skillRow}>
        <Text style={[styles.skillName, item.isCompleted && styles.completedText]}>
          {item.nameKo || item.name}{item.isOptional ? ' (Optional)' : ''}
        </Text>
        <View style={[styles.checkCircle, item.isCompleted ? styles.checkDone : styles.checkUndone]}>
          <Text style={[styles.checkMark, item.isCompleted ? styles.checkMarkDone : styles.checkMarkUndone]}>✓</Text>
        </View>
      </View>
    );
  };

  const renderLicenseCard = (lic: UserLicense) => {
    const isExpanded = expandedId === lic.id;
    const isCompleted = lic.status === 'COMPLETED';
    const licenseName = lic.license?.nameKo || lic.license?.name || lic.licenseNameKo || lic.licenseName;
    const allSections = buildSections(lic.requirements, isCompleted);
    const sections = showCompleted
      ? allSections
      : allSections.map((s) => ({ ...s, data: s.data.filter((d) => !d.isCompleted) })).filter((s) => s.data.length > 0);

    return (
      <View key={lic.id} style={[styles.licenseCard, isExpanded && styles.licenseCardExpanded]}>
        <Pressable
          style={styles.licenseHeader}
          onPress={() => setExpandedId(isExpanded ? null : lic.id)}
        >
          <View style={styles.licenseHeaderLeft}>
            <Text style={styles.licenseName}>{licenseName}</Text>
            <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusInProgress]}>
              <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextInProgress]}>
                {isCompleted ? '취득완료' : '진행중'}
              </Text>
            </View>
          </View>
          <Text style={[styles.expandArrow, isExpanded && styles.expandArrowOpen]}>▼</Text>
        </Pressable>

        {isExpanded && (
          <ScrollView
            style={styles.licenseBody}
            contentContainerStyle={styles.licenseBodyContent}
            showsVerticalScrollIndicator={true}
          >
            {sections.map((section, idx) => {
              const done = isSectionCompleted(section);
              return (
                <View key={section.group.id || idx}>
                  <View style={styles.groupRow}>
                    <Text style={styles.groupName}>{section.group.nameKo || section.group.name}</Text>
                    <View style={[styles.checkCircle, done ? styles.checkDone : styles.checkUndone]}>
                      <Text style={[styles.checkMark, done ? styles.checkMarkDone : styles.checkMarkUndone]}>✓</Text>
                    </View>
                  </View>
                  {section.data.map((item) => renderRequirement(item))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderDebriefingItem = ({ item }: { item: DebriefingItem }) => (
    <View style={styles.debriefingCard}>
      <Text style={styles.debriefingMeta}>
        {item.createdByName} 강사  ·  {formatDebriefingDate(item.createdAt)}
      </Text>
      {item.content ? (
        <Text style={styles.debriefingContent}>{item.content}</Text>
      ) : (
        <Text style={styles.debriefingEmpty}>메모 없음</Text>
      )}
    </View>
  );

  const handleLoadMore = () => {
    if (debriefingHasMore && !debriefingLoading) {
      fetchDebriefings(debriefingPage + 1);
    }
  };

  const ListFooter = () => {
    if (debriefingLoading && debriefingPage > 1) {
      return (
        <View style={styles.loadMoreArea}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{participantName}</Text>
          {participantLevel ? <LevelBadge level={participantLevel} size={20} /> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : expandedId !== null ? (
        <View style={styles.expandedContainer}>
          {(() => {
            const lic = sortedLicenses.find((l) => l.id === expandedId);
            if (!lic) return null;
            return renderLicenseCard(lic);
          })()}
        </View>
      ) : (
        <View style={styles.mainContent}>
          {/* 라이센스 카드 영역 */}
          <View style={styles.licenseSectionHeader}>
            <Text style={styles.licenseSectionTitle}>자격증 진행 정보</Text>
            <Pressable style={styles.segmentWrap} onPress={() => setShowCompleted((v) => !v)}>
              <View style={[styles.segmentItem, !showCompleted && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, !showCompleted && styles.segmentTextActive]}>To-Do</Text>
              </View>
              <View style={[styles.segmentItem, showCompleted && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, showCompleted && styles.segmentTextActive]}>All</Text>
              </View>
            </Pressable>
          </View>
          <View style={styles.licenseSection}>
            {sortedLicenses.length === 0 ? (
              <View style={styles.emptyArea}>
                <Text style={styles.emptyText}>진행중인 라이센스가 없습니다.</Text>
              </View>
            ) : (
              sortedLicenses.map((lic) => renderLicenseCard(lic))
            )}
          </View>

          {/* 디브리핑 기록 영역 */}
          <Text style={styles.debriefingSectionTitle}>디브리핑 기록</Text>
          <FlatList
            data={debriefings}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDebriefingItem}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={
              !debriefingLoading ? (
                <Text style={styles.debriefingEmptyList}>디브리핑 기록이 없습니다.</Text>
              ) : null
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            windowSize={5}
            maxToRenderPerBatch={10}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyArea: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)' },
  mainContent: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  licenseSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  licenseSectionTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white,
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
  licenseSection: { marginBottom: 8 },
  expandedContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },

  // License card
  licenseCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  licenseCardExpanded: {
    flex: 1,
    marginBottom: 0,
  },
  licenseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  licenseHeaderLeft: {
    flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10,
  },
  licenseName: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusCompleted: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  statusInProgress: {
    backgroundColor: 'rgba(235,160,60,0.15)',
  },
  statusText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11,
  },
  statusTextCompleted: {
    color: Colors.brand.success,
  },
  statusTextInProgress: {
    color: Colors.brand.warning,
  },
  expandArrow: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8,
  },
  expandArrowOpen: {
    transform: [{ rotate: '180deg' }],
  },

  // License body (expanded)
  licenseBody: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  licenseBodyContent: {
    paddingHorizontal: 16, paddingBottom: 16,
  },
  groupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, marginTop: 4,
  },
  groupName: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white, flex: 1,
  },
  skillRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, paddingLeft: 16,
  },
  skillName: {
    fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.75)', flex: 1,
  },
  measureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, paddingLeft: 16,
  },
  measureInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  measureLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)',
  },
  completedText: { color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through' },
  measureValue: {
    fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)',
  },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  checkDone: { backgroundColor: Colors.brand.success },
  checkUndone: { backgroundColor: 'rgba(255,255,255,0.15)' },
  checkMark: { fontSize: 12, fontWeight: 'bold' },
  checkMarkDone: { color: '#FFFFFF' },
  checkMarkUndone: { color: 'rgba(255,255,255,0.3)' },

  // Debriefing
  debriefingSectionTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white,
    marginTop: 20, marginBottom: 12,
  },
  debriefingCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  debriefingTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white,
    marginBottom: 6,
  },
  debriefingMeta: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  debriefingContent: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  debriefingEmpty: {
    fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },
  debriefingEmptyList: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', paddingTop: 20,
  },
  loadMoreArea: {
    paddingVertical: 16, alignItems: 'center',
  },
});
