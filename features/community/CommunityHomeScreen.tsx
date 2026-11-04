import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import BottomSheet from '@/components/BottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { LiquidGlassView as GlassView } from '@/utils/liquidGlass';
import { useAppRouter, usePaneDefault } from '@/features/split/SplitPane';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';
import { getSideStripBottomGap, getTabBarContentClearance, hasSideTabStrip } from '@/utils/tabBarLayout';
import { api, type CommunityBoard, type CommunityCard, type CommunityHome } from '@/services/api';
import { EssayCard, FreeRow, GreetingRow, PromoCard } from './Cards';
import { CenterMessage, styles as ui } from './ui';

const SIDE = 20;
type WriteTarget = 'ESSAY' | 'FREE' | 'GREETING' | 'PROMO';

// 3장 커뮤니티 홈 (위 → 아래): 최신 에세이 4 · 교육단체 홍보 배너 1 · 출석인사 3 · 자유게시판 5, 오른쪽 아래 '글쓰기'
export default function CommunityHomeScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [home, setHome] = useState<CommunityHome | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [width, setWidth] = useState(0);
  const request = useRef(0);
  usePaneDefault('community', { message: '글을 고르면 여기에 보여요', hint: '왼쪽에서 읽고 싶은 글을 눌러 보세요' });

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await api.getCommunityHome();
      if (id === request.current) { setHome(next); setError(false); }
    } catch {
      if (id === request.current) setError(true);
    }
  }, []);
  // 글을 쓰거나 보고 돌아오면 새로 (좋아요 · 댓글 수가 바뀜)
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openPost = (post: CommunityCard) => router.push({ pathname: '/community-post', params: { id: String(post.id) } });
  const openBoard = (board: CommunityBoard) => router.push({ pathname: '/community-posts', params: { board } });
  const write = (target: WriteTarget) => {
    if (target === 'ESSAY') router.push('/community-essay-write');
    else if (target === 'FREE') router.push('/community-free-write');
    else if (target === 'PROMO') router.push('/community-promo-edit');
    else router.push('/community-greetings');
  };
  const writeItems = [
    ...(home?.canWriteEssay ? [{ label: '에세이', value: 'ESSAY' }] : []),
    { label: '자유게시판', value: 'FREE' },
    { label: '출석인사', value: 'GREETING' },
    ...(home?.canWritePromo ? [{ label: '교육단체 홍보', value: 'PROMO' }] : []),
  ];

  const bottomSpace = DUO_SYSTEM_TABS ? insets.bottom : hasSideTabStrip(insets.right, Platform.OS) ? getSideStripBottomGap(insets.bottom) : getTabBarContentClearance(insets.bottom, Platform.OS);
  const inner = Math.max(0, width - SIDE * 2);
  const essayWidth = (inner - 10) / 2;

  return (
    <View style={ui.screen} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {!home ? <CenterMessage loading={!error} message="커뮤니티를 불러오지 못했어요." onRetry={error ? load : undefined} /> : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomSpace + 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="rgba(255,255,255,0.6)" />}
        >
          <SectionHeader title="최신 에세이" onSeeAll={() => openBoard('ESSAY')} />
          {home.essays.length ? (
            <View style={styles.grid}>
              {width > 0 && home.essays.map(post => <EssayCard key={post.id} post={post} width={essayWidth} onPress={openPost} />)}
            </View>
          ) : <Empty text="아직 에세이가 없어요." />}

          {home.banner && inner > 0 && (
            <View style={styles.banner}>
              <PromoCard post={home.banner} height={Math.min(inner * 9 / 16, 220)} onPress={openPost} label="교육단체 홍보" />
              <Pressable onPress={() => openBoard('PROMO')} hitSlop={8} style={styles.bannerAll}>
                <Text style={styles.seeAll}>홍보 전체보기 ›</Text>
              </Pressable>
            </View>
          )}

          <SectionHeader title="출석인사" onSeeAll={() => router.push('/community-greetings')} />
          <View style={styles.rows}>
            <Text style={styles.todayCount}>오늘 인사 {home.greetings.todayCount}건</Text>
            {home.greetings.items.length
              // 누르면 그 인사를 남긴 날의 출석인사 목록
              ? home.greetings.items.map(g => <GreetingRow key={g.id} greeting={g} showTime={false} onPress={item => router.push({ pathname: '/community-greetings', params: { date: item.date } })} />)
              : <Empty text="첫 인사를 남겨 보세요." inline />}
          </View>

          <SectionHeader title="자유게시판" onSeeAll={() => openBoard('FREE')} />
          <View style={styles.rows}>
            {home.free.length ? home.free.map(post => <FreeRow key={post.id} post={post} onPress={openPost} />) : <Empty text="아직 글이 없어요." inline />}
          </View>
        </ScrollView>
      )}

      {home && (
        <View style={[styles.fab, { bottom: bottomSpace + 12 }]}>
          <WriteButton onPress={() => setWriting(true)} />
        </View>
      )}
      <BottomSheet
        visible={writing}
        onClose={() => setWriting(false)}
        title="어디에 쓸까요?"
        items={writeItems}
        fitContent
        // 시트가 닫히는 애니메이션(250ms)이 끝난 뒤 화면을 엶
        onSelect={(target: WriteTarget) => setTimeout(() => write(target), 260)}
      />
    </View>
  );
}

// 오른쪽 아래 동그란 글쓰기 버튼 (연필). 리퀴드 글래스가 되면 유리, 아니면 흰 원
function WriteButton({ onPress }: { onPress: () => void }) {
  if (GlassView) {
    return (
      <GlassView isInteractive glassEffectStyle="regular" colorScheme="dark" style={styles.fabGlass}>
        <Pressable accessibilityRole="button" accessibilityLabel="글쓰기" onPress={onPress} style={styles.fabInner}>
          <Ionicons name="pencil" size={24} color={Colors.brand.white} />
        </Pressable>
      </GlassView>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="글쓰기" onPress={onPress} style={({ pressed }) => [styles.fabButton, pressed && { opacity: 0.85 }]}>
      <Ionicons name="pencil" size={24} color={Colors.brand.primary} />
    </Pressable>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={ui.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={styles.seeAll}>전체보기 ›</Text>
      </Pressable>
    </View>
  );
}

function Empty({ text, inline }: { text: string; inline?: boolean }) {
  return <Text style={[styles.empty, !inline && { paddingHorizontal: SIDE }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIDE, paddingTop: 18, paddingBottom: 12 },
  seeAll: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: SIDE },
  banner: { paddingHorizontal: SIDE, paddingTop: 18 },
  bannerAll: { alignSelf: 'flex-end', paddingTop: 8 },
  rows: { paddingHorizontal: SIDE, gap: 8 },
  todayCount: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.accent },
  empty: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.4)', paddingVertical: 8 },
  fab: { position: 'absolute', right: 20 },
  fabGlass: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabButton: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.brand.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
