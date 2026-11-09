import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, DeviceEventEmitter, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, type CommunityCard, type HomeData, type HomeRequest, type HomeRequestKind, type Schedule } from '@/services/api';
import { useAppRouter, usePaneDefault } from '@/features/split/SplitPane';
import { TourPhotoCard } from '@/features/tour/TourCards';
import { CYAN, GRID_GAP, gridColumns } from '@/features/tour/ui';
import { TOURS_CHANGED } from '@/features/tour/nav';
import { EssayCard } from '@/features/community/Cards';
import { timeAgo } from '@/features/community/ui';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';
import { getScheduleMarkerColor } from '@/utils/scheduleMarker';
import { getSideStripBottomGap, getTabBarContentClearance, hasSideTabStrip } from '@/utils/tabBarLayout';

// 앱 홈 (2026-11-09): 앱을 열면 처음 보이고, 위쪽 가운데 로고를 누르면 돌아옴 (아래 탭 5개는 그대로).
// 인사 → 다가오는 다이빙 3 → 각종 요청 3 → 최근 등록된 투어 3 → 최근 한 달 인기 에세이 3.
// 카드 · 글자 · 여백은 다이빙 목록 · 투어 홈 · 커뮤니티 홈과 같게
const SIDE = 20;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const localDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// '11월 12일 (목) 19:00'
const whenLabel = (s: Schedule) => {
  const date = localDate(s.scheduleDate);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]}) ${String(s.startHour).padStart(2, '0')}:${String(s.startMinute).padStart(2, '0')}`;
};
// '오늘' · '내일' · 'D-3'
const dayLabel = (ymd: string, now = new Date()) => {
  const days = Math.round((localDate(ymd).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  return days <= 0 ? '오늘' : days === 1 ? '내일' : `D-${days}`;
};

const REQUEST_ICONS: Record<HomeRequestKind, keyof typeof Ionicons.glyphMap> = {
  SCHEDULE_INVITE: 'calendar-outline',
  TOUR_SEEKING_LEADER: 'flag-outline',
  TOUR_APPLY: 'person-add-outline',
  TOUR_PROPOSAL: 'hand-right-outline',
  ADMIN_INQUIRY: 'chatbox-ellipses-outline',
  ADMIN_CERT: 'ribbon-outline',
  ADMIN_ORG: 'business-outline',
  ADMIN_TOUR_REQUEST: 'airplane-outline',
  ADMIN_TOUR_REPORT: 'alert-circle-outline',
  ADMIN_COMMUNITY_REPORT: 'alert-circle-outline',
};

// 요청을 누르면 그걸 처리하는 화면으로 (알림 · 프로필 '관리자 기능'과 같은 곳)
function requestDestination(r: HomeRequest): { pathname: string; params?: Record<string, string> } | null {
  const tour = r.tourId ? { id: String(r.tourId) } : null;
  switch (r.kind) {
    case 'SCHEDULE_INVITE': return r.scheduleId ? { pathname: '/schedule-detail', params: { id: String(r.scheduleId) } } : null;
    case 'TOUR_SEEKING_LEADER': return tour && { pathname: '/tour-detail', params: tour };
    case 'TOUR_APPLY': return tour && { pathname: '/tour-applications', params: tour };
    case 'TOUR_PROPOSAL': return tour && { pathname: '/tour-proposals', params: tour };
    case 'ADMIN_INQUIRY': return { pathname: '/inquiry-manage' };
    case 'ADMIN_CERT': return { pathname: '/cert-manage' };
    case 'ADMIN_ORG': return { pathname: '/organization-manage' };
    case 'ADMIN_TOUR_REQUEST': return { pathname: '/tour-requests' };
    case 'ADMIN_TOUR_REPORT': return { pathname: '/tour-reports' };
    case 'ADMIN_COMMUNITY_REPORT': return { pathname: '/community-reports' };
  }
}

export default function HomeScreen() {
  const { user } = useAuth();
  const appRouter = useAppRouter(); // 일정 · 투어 · 글 상세는 펼친 화면에서 오른쪽 칸에
  const router = useRouter(); // 탭 이동 · 목록 전체보기는 전체 화면
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [home, setHome] = useState<HomeData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  usePaneDefault('home', { message: '고르면 여기에 보여요', hint: '왼쪽에서 다이빙 · 요청 · 투어 · 에세이를 눌러 보세요' });

  const requestId = useRef(0);
  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'quiet') => {
    const id = ++requestId.current;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await api.getHome();
      if (id !== requestId.current) return;
      setHome(data);
      setState('ready');
    } catch {
      if (id === requestId.current) setState(prev => (prev === 'ready' ? prev : 'error'));
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  // 돌아올 때마다 조용히 새로 받음 (요청을 처리하고 오면 줄이 빠지게)
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    void load(first.current ? 'first' : 'quiet');
    first.current = false;
    const sub = AppState.addEventListener('change', next => { if (next === 'active') void load(); });
    return () => sub.remove();
  }, [load]));
  // 펼친 화면에선 홈이 계속 보여서, 투어 · 알림(요청 수락 등)이 바뀌면 바로 다시 받음
  useEffect(() => {
    const subs = [TOURS_CHANGED, 'notificationsChanged'].map(event => DeviceEventEmitter.addListener(event, () => { void load(); }));
    return () => subs.forEach(sub => sub.remove());
  }, [load]);

  const bottomSpace = DUO_SYSTEM_TABS ? insets.bottom : hasSideTabStrip(insets.right, Platform.OS) ? getSideStripBottomGap(insets.bottom) : getTabBarContentClearance(insets.bottom, Platform.OS);
  // 투어 · 에세이 줄: 투어 홈 줄과 같은 카드 폭 (바형에선 2개와 다음 카드가 조금 보이게, 넓으면 4개)
  const inner = Math.max(0, width - SIDE * 2);
  const columns = gridColumns(inner);
  const cardWidth = inner ? Math.floor((inner - GRID_GAP * columns) / (columns + 0.25)) : 0;

  const openSchedule = (s: Schedule) => appRouter.push({ pathname: '/schedule-detail', params: { id: String(s.id) } });
  const openRequest = (r: HomeRequest) => { const to = requestDestination(r); if (to) appRouter.push(to); };
  const openTour = (tourId: number) => appRouter.push({ pathname: '/tour-detail', params: { id: String(tourId) } });
  const openPost = (post: CommunityCard) => appRouter.push({ pathname: '/community-post', params: { id: String(post.id) } });

  return (
    <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {state === 'loading' && !home ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : state === 'error' && !home ? (
        <Pressable onPress={() => void load('first')} style={styles.center}>
          <Text style={styles.emptyText}>홈을 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
        </Pressable>
      ) : home ? (
        <ScrollView
          contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomSpace + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
        >
          <Greeting nickname={user?.nickname} />

          <SectionHeader title="다가오는 다이빙" onSeeAll={() => router.navigate('/b')} />
          {home.upcoming.length ? (
            <View style={styles.list}>
              {home.upcoming.map(s => <ScheduleCard key={s.id} schedule={s} onPress={() => openSchedule(s)} />)}
            </View>
          ) : <Text style={styles.rowEmpty}>다가오는 다이빙 일정이 없어요.</Text>}

          <SectionHeader title="각종 요청" count={home.requests.total} />
          {home.requests.items.length ? (
            <View style={styles.list}>
              {home.requests.items.map(r => <RequestRow key={r.id} request={r} onPress={() => openRequest(r)} />)}
            </View>
          ) : <Text style={styles.rowEmpty}>처리할 요청이 없어요.</Text>}

          <SectionHeader title="최근 등록된 투어" onSeeAll={() => router.navigate('/tour')} />
          {home.tours.length && cardWidth ? (
            <FlatList
              data={home.tours}
              keyExtractor={tour => String(tour.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardList}
              renderItem={({ item }) => <TourPhotoCard tour={item} width={cardWidth} onPress={() => openTour(item.id)} />}
            />
          ) : <Text style={styles.rowEmpty}>지금 모집 중인 투어가 없어요.</Text>}

          <SectionHeader title="최근 한 달 인기 에세이" onSeeAll={() => router.push({ pathname: '/community-posts', params: { board: 'ESSAY' } })} />
          {home.essays.length && cardWidth ? (
            <FlatList
              data={home.essays}
              keyExtractor={post => String(post.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardList}
              renderItem={({ item }) => <EssayCard post={item} width={cardWidth} onPress={openPost} />}
            />
          ) : <Text style={styles.rowEmpty}>최근 한 달 동안 올라온 에세이가 없어요.</Text>}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Greeting({ nickname }: { nickname?: string }) {
  const now = new Date();
  return (
    <View style={styles.greeting}>
      <Text style={styles.greetingDate}>{`${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`}</Text>
      <Text style={styles.greetingTitle}>
        안녕하세요!{nickname ? <> <Text style={styles.greetingName}>{nickname}</Text> 님!</> : null}
      </Text>
      <Text style={styles.greetingText}>금일 다이빙 정보 안내해 드릴게요!</Text>
    </View>
  );
}

function SectionHeader({ title, count, onSeeAll }: { title: string; count?: number; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count ? <View style={styles.countPill}><Text style={styles.countText}>{count > 99 ? '99+' : count}</Text></View> : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.seeAll}>전체보기 ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// 다이빙 목록 카드와 같은 모양 (왼쪽 색 막대 = 캘린더 표시 색)
function ScheduleCard({ schedule, onPress }: { schedule: Schedule; onPress: () => void }) {
  const names = (schedule.participants ?? []).map(p => p.nickname).filter(Boolean);
  const day = dayLabel(schedule.scheduleDate);
  const soon = day === '오늘' || day === '내일';
  const meta = [schedule.categoryName, schedule.poolName, names.length ? names.join(', ') : null].filter(Boolean).join(' · ');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.scheduleCard, pressed && { opacity: 0.7 }]}>
      <View style={[styles.levelBar, { backgroundColor: getScheduleMarkerColor(schedule) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.when} numberOfLines={1}>{whenLabel(schedule)}</Text>
          <View style={[styles.dayPill, soon && styles.dayPillSoon]}>
            <Text style={[styles.dayText, soon && styles.dayTextSoon]}>{day}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{schedule.title}</Text>
        {meta ? <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
}

// 요청 한 줄: 종류 아이콘 · 제목 · 내용 · 받은 시각 (admin 일은 주황, 투어는 하늘색)
function RequestRow({ request, onPress }: { request: HomeRequest; onPress: () => void }) {
  const admin = request.kind.startsWith('ADMIN_');
  const tour = request.kind.startsWith('TOUR_');
  const tint = admin ? Colors.brand.warning : tour ? CYAN : Colors.brand.white;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.requestCard, pressed && { opacity: 0.7 }]}>
      <View style={[styles.requestIcon, admin ? styles.requestIconAdmin : tour ? styles.requestIconTour : null]}>
        <Ionicons name={REQUEST_ICONS[request.kind]} size={18} color={tint} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.requestTitle} numberOfLines={1}>{request.title}</Text>
          <Text style={styles.requestTime}>{timeAgo(request.at)}</Text>
        </View>
        <Text style={styles.requestText} numberOfLines={2}>{request.body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  greeting: { paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 6, gap: 4 },
  greetingDate: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  greetingTitle: { fontFamily: 'SUIT-Bold', fontSize: 22, lineHeight: 30, color: Colors.brand.white },
  greetingName: { color: CYAN },
  greetingText: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.75)' },

  // 투어 홈 · 커뮤니티 홈과 같은 칸 머리
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIDE, paddingTop: 22, paddingBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  countPill: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: 'SUIT-Bold', fontSize: 11, color: Colors.brand.white },
  seeAll: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  rowEmpty: { paddingHorizontal: SIDE, fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  list: { paddingHorizontal: SIDE, gap: 8 },
  cardList: { paddingHorizontal: SIDE, gap: GRID_GAP },

  // 다이빙 목록(다이빙 탭) 카드와 같은 바탕 · 모서리 · 색 막대
  scheduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingLeft: 12, paddingRight: 14, paddingVertical: 12,
  },
  levelBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  when: { flexShrink: 1, fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  dayPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  dayPillSoon: { backgroundColor: 'rgba(0,229,255,0.16)' },
  dayText: { fontFamily: 'SUIT-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  dayTextSoon: { color: CYAN },
  cardTitle: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  cardMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  requestIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  requestIconTour: { backgroundColor: 'rgba(0,229,255,0.14)' },
  requestIconAdmin: { backgroundColor: 'rgba(235,160,60,0.18)' },
  requestTitle: { flexShrink: 1, fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.white },
  requestTime: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  requestText: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.7)' },
});
