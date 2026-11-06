import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type CommunityBoard, type CommunityCard } from '@/services/api';
import { EssayCard, FreeCell, FreeRow, PromoCard } from './Cards';
import SearchConditions from './SearchConditions';
import {
  CARD_GAP, type Conditions, NO_CONDITIONS, SIDE, boardColumns, cellWidth, dayLabel, dayOf, essayRows, gridRows, hasConditions, isWide,
} from './listRows';
import { ActionChip, BOARD_NAME, CenterMessage, CommunityHeader, HeaderButton, styles as ui } from './ui';
import { useRowAnchors, useWindowedList } from './useWindowedList';

export const toBoard = (value: unknown) => (['ESSAY', 'FREE', 'PROMO'].includes(String(value)) ? value : 'FREE') as CommunityBoard;

// 게시판마다 카드 모양 (한 줄에 하나일 때): 에세이는 두 줄 카드, 홍보는 큰 그림, 자유게시판은 한 줄
export function PostItem({ board, post, inner, onPress }: { board: CommunityBoard; post: CommunityCard; inner: number; onPress: (post: CommunityCard) => void }) {
  if (board === 'ESSAY') return <EssayCard post={post} width={(inner - 10) / 2} onPress={onPress} />;
  if (board === 'PROMO') return <PromoCard post={post} height={Math.min(inner * 9 / 16, 220)} onPress={onPress} />;
  return <FreeRow post={post} onPress={onPress} />;
}

// 게시판 전체보기: 에세이(4장) · 자유게시판(7장) · 교육단체 홍보 목록. 펼친 화면에서도 좌우로 나누지 않고 전체 화면,
// 한 줄에 에세이 · 자유게시판 4개 · 홍보 2개 (바형 · 접은 화면은 에세이 2개 · 나머지 1개).
// 맨 위 검색 조건(작성일 · 검색어 · 작성자)으로 그 자리에서 좁힘, 조건이 없으면 전체 글. 왼쪽 위 글쓰기.
// 목록 공통 패턴: 최근 순 10개씩, 최대 100개 (넘으면 반대쪽 10개를 덜어냄).
// tag: 글 상세의 #태그를 누르면 그 태그만 (검색 조건을 넣으면 태그는 풀고 조건으로 찾음)
export default function PostListScreen() {
  const params = useScreenParams<{ board?: string; tag?: string }>();
  const board = toBoard(params.board);
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [tag, setTag] = useState(params.tag ?? '');
  const [conditions, setConditions] = useState<Conditions>(NO_CONDITIONS);
  const [measured, setMeasured] = useState(0);
  const [canWriteEssay, setCanWriteEssay] = useState(false);
  const searching = hasConditions(conditions);
  const list = useWindowedList<CommunityCard>(cursor => (searching
    ? api.searchCommunityPosts(board, { ...conditions, ...cursor })
    : api.getCommunityPosts(board, { ...cursor, tag })));

  // 처음 열 때와 태그 · 검색 조건이 바뀔 때는 처음부터, 글을 보고 돌아오면 지금 목록을 둔 채 새로
  const first = useRef(true);
  const reloadRef = useRef(list.reload); reloadRef.current = list.reload;
  useFocusEffect(useCallback(() => {
    void reloadRef.current(first.current ? 'first' : 'quiet');
    first.current = false;
  }, [board, tag, conditions]));
  useFocusEffect(useCallback(() => {
    if (board !== 'ESSAY') return;
    api.getCommunityHome().then(home => setCanWriteEssay(home.canWriteEssay)).catch(() => {});
  }, [board]));

  const search = (patch: Partial<Conditions>) => {
    const next = { ...conditions, ...patch };
    if ((Object.keys(next) as (keyof Conditions)[]).every(key => next[key] === conditions[key])) return;
    first.current = true;
    setTag('');
    setConditions(next);
  };
  const openPost = (post: CommunityCard) => router.push({ pathname: '/community-post', params: { id: String(post.id) } });

  // 첫 그림부터 펼친 화면 모양이 나오게 화면 폭으로 먼저 잡고, 잰 폭(아이폰듀오 오른쪽 여백 등)으로 바꿈
  const width = measured || window.width;
  const inner = Math.max(0, width - SIDE * 2);
  const write = board === 'FREE'
    ? <HeaderButton icon="create-outline" label="글쓰기" onPress={() => router.push('/community-free-write')} />
    : board === 'ESSAY' && canWriteEssay
      ? <HeaderButton icon="create-outline" label="에세이 쓰기" onPress={() => router.push('/community-essay-write')} />
      : undefined;

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]} onLayout={e => setMeasured(e.nativeEvent.layout.width)}>
      <CommunityHeader title={BOARD_NAME[board]} left={write} />
      <SearchConditions value={conditions} wide={isWide(inner)} onChange={search} />
      {!!tag && (
        <View style={styles.filters}>
          <ActionChip icon="close" label={`#${tag}`} active onPress={() => { first.current = true; setTag(''); }} />
        </View>
      )}
      {list.state !== 'ready' ? <CenterMessage loading={list.state === 'loading'} message="글을 불러오지 못했어요." onRetry={() => void list.reload()} /> : (
        <PostFlatList
          board={board}
          list={list}
          inner={inner}
          bottom={insets.bottom}
          empty={searching || tag ? '찾는 글이 없어요.' : '아직 글이 없어요.'}
          onPress={openPost}
        />
      )}
    </View>
  );
}

// 목록 공통: 아래 끝 → 더 예전 10개, 위 끝(덜어낸 적이 있으면) → 더 최근 10개, 붙이거나 덜어도 보던 자리 유지.
// 한 줄에 여러 개면 목록 안 자리로 줄을 나눠서(listRows.ts) 10개씩 붙이거나 덜어도 남은 줄이 그대로
export function PostFlatList({ board, list, inner, bottom, empty, onPress }: {
  board: CommunityBoard; list: ReturnType<typeof useWindowedList<CommunityCard>>; inner: number; bottom: number; empty: string; onPress: (post: CommunityCard) => void;
}) {
  const columns = boardColumns(board, inner);
  const width = cellWidth(inner, columns);
  const anchors = useRowAnchors(list.epoch);
  const spinner = <ActivityIndicator style={styles.more} color="rgba(255,255,255,0.6)" />;
  const common = {
    contentContainerStyle: [styles.list, { paddingBottom: bottom + 24 }, !list.items.length && { flexGrow: 1 }],
    refreshControl: <RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload('refresh')} tintColor="rgba(255,255,255,0.6)" />,
    onEndReached: () => void list.loadOlder(),
    onEndReachedThreshold: 0.5,
    onStartReached: () => void list.loadNewer(),
    onStartReachedThreshold: 0.5,
    maintainVisibleContentPosition: { minIndexForVisible: 0 },
    windowSize: 7,
    ListHeaderComponent: list.more === 'newer' ? spinner : undefined,
    ListFooterComponent: list.more === 'older' ? spinner : undefined,
    ListEmptyComponent: <CenterMessage message={empty} />,
  };
  // 에세이: 쓴 날(기기 날짜)마다 작은 날짜 줄, 그 아래 2개씩 (펼친 화면 4개)
  if (board === 'ESSAY') {
    const today = dayOf(new Date().toISOString());
    return (
      <FlatList
        // 2개 ↔ 4개가 바뀌면(펼치거나 접을 때) 줄을 다시 나눔
        key={`essay-${columns}`}
        {...common}
        data={essayRows(list.items, list.base, columns, anchors)}
        keyExtractor={row => row.key}
        renderItem={({ item }) => ('date' in item
          ? <Text style={styles.dayLabel}>{dayLabel(item.date, today)}</Text>
          : (
            <View style={styles.row}>
              {item.posts.map(post => <EssayCard key={post.id} post={post} width={width} onPress={onPress} />)}
            </View>
          ))}
      />
    );
  }
  // 바형 · 접은 화면의 자유게시판 · 홍보: 지금처럼 한 줄에 하나
  if (columns === 1) {
    return (
      <FlatList
        key="list"
        {...common}
        data={list.items}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <PostItem board={board} post={item} inner={inner} onPress={onPress} />}
      />
    );
  }
  // 펼친 화면: 자유게시판 4개 · 홍보 2개씩
  return (
    <FlatList
      key={`grid-${columns}`}
      {...common}
      data={gridRows(list.items, list.base, columns, anchors)}
      keyExtractor={row => row.key}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.items.map(post => (
            <View key={post.id} style={{ width }}>
              {board === 'PROMO'
                ? <PromoCard post={post} height={Math.min((width * 9) / 16, 220)} onPress={onPress} />
                : <FreeCell post={post} onPress={onPress} />}
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: SIDE, paddingBottom: 8 },
  list: { paddingHorizontal: SIDE, paddingTop: 4, gap: CARD_GAP },
  row: { flexDirection: 'row', gap: CARD_GAP },
  dayLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  more: { paddingVertical: 14 },
});
