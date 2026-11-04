import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type CommunityBoard, type CommunityCard } from '@/services/api';
import { EssayCard, FreeRow, PromoCard } from './Cards';
import { ActionChip, BOARD_NAME, CenterMessage, CommunityHeader, HeaderButton, styles as ui } from './ui';
import { useWindowedList } from './useWindowedList';

export const SIDE = 20;
export const toBoard = (value: unknown) => (['ESSAY', 'FREE', 'PROMO'].includes(String(value)) ? value : 'FREE') as CommunityBoard;

// 게시판마다 카드 모양: 에세이는 두 줄 카드, 홍보는 큰 그림, 자유게시판은 한 줄
export function PostItem({ board, post, inner, onPress }: { board: CommunityBoard; post: CommunityCard; inner: number; onPress: (post: CommunityCard) => void }) {
  if (board === 'ESSAY') return <EssayCard post={post} width={(inner - 10) / 2} onPress={onPress} />;
  if (board === 'PROMO') return <PromoCard post={post} height={Math.min(inner * 9 / 16, 220)} onPress={onPress} />;
  return <FreeRow post={post} onPress={onPress} />;
}

// 게시판 전체보기: 에세이(4장) · 자유게시판(7장) · 교육단체 홍보 목록.
// 목록 공통 패턴: 최근 순 10개씩, 최대 100개 (넘으면 반대쪽 10개를 덜어냄). 왼쪽 위 글쓰기, 오른쪽 위 돋보기 → 검색 화면.
// tag: 글 상세의 #태그를 누르면 그 태그만
export default function PostListScreen() {
  const params = useScreenParams<{ board?: string; tag?: string }>();
  const board = toBoard(params.board);
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [tag, setTag] = useState(params.tag ?? '');
  const [width, setWidth] = useState(0);
  const [canWriteEssay, setCanWriteEssay] = useState(false);
  const list = useWindowedList<CommunityCard>(cursor => api.getCommunityPosts(board, { ...cursor, tag }));

  // 처음 열 때와 태그가 바뀔 때는 처음부터, 글을 보고 돌아오면 지금 목록을 둔 채 새로
  const first = useRef(true);
  const reloadRef = useRef(list.reload); reloadRef.current = list.reload;
  useFocusEffect(useCallback(() => {
    void reloadRef.current(first.current ? 'first' : 'quiet');
    first.current = false;
  }, [board, tag]));
  useFocusEffect(useCallback(() => {
    if (board !== 'ESSAY') return;
    api.getCommunityHome().then(home => setCanWriteEssay(home.canWriteEssay)).catch(() => {});
  }, [board]));

  const openPost = (post: CommunityCard) => router.push({ pathname: '/community-post', params: { id: String(post.id) } });
  const openSearch = () => router.push({ pathname: '/community-post-search', params: { board } });

  const inner = Math.max(0, width - SIDE * 2);
  const write = board === 'FREE'
    ? <HeaderButton icon="create-outline" label="글쓰기" onPress={() => router.push('/community-free-write')} />
    : board === 'ESSAY' && canWriteEssay
      ? <HeaderButton icon="create-outline" label="에세이 쓰기" onPress={() => router.push('/community-essay-write')} />
      : undefined;

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <CommunityHeader title={BOARD_NAME[board]} left={write} right={<HeaderButton icon="search" label={`${BOARD_NAME[board]} 검색`} onPress={openSearch} />} />
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
          empty={tag ? '찾는 글이 없어요.' : '아직 글이 없어요.'}
          onPress={openPost}
        />
      )}
    </View>
  );
}

// 목록 공통: 아래 끝 → 더 예전 10개, 위 끝(덜어낸 적이 있으면) → 더 최근 10개, 붙이거나 덜어도 보던 자리 유지
export function PostFlatList({ board, list, inner, bottom, empty, onPress }: {
  board: CommunityBoard; list: ReturnType<typeof useWindowedList<CommunityCard>>; inner: number; bottom: number; empty: string; onPress: (post: CommunityCard) => void;
}) {
  const spinner = <ActivityIndicator style={styles.more} color="rgba(255,255,255,0.6)" />;
  return (
    <FlatList
      key={board === 'ESSAY' ? 'grid' : 'list'}
      data={list.items}
      keyExtractor={item => String(item.id)}
      numColumns={board === 'ESSAY' ? 2 : 1}
      columnWrapperStyle={board === 'ESSAY' ? { gap: 10 } : undefined}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + 24 }, !list.items.length && { flexGrow: 1 }]}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload('refresh')} tintColor="rgba(255,255,255,0.6)" />}
      onEndReached={() => void list.loadOlder()}
      onEndReachedThreshold={0.5}
      onStartReached={() => void list.loadNewer()}
      onStartReachedThreshold={0.5}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      windowSize={7}
      ListHeaderComponent={list.more === 'newer' ? spinner : undefined}
      ListFooterComponent={list.more === 'older' ? spinner : undefined}
      ListEmptyComponent={<CenterMessage message={empty} />}
      renderItem={({ item }) => <PostItem board={board} post={item} inner={inner} onPress={onPress} />}
    />
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: SIDE, paddingBottom: 8 },
  list: { paddingHorizontal: SIDE, paddingTop: 4, gap: 10 },
  more: { paddingVertical: 14 },
});
