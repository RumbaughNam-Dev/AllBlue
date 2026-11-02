import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type CommunityBoard, type CommunityCard } from '@/services/api';
import { EssayCard, FreeRow, PromoCard } from './Cards';
import { ActionChip, BOARD_NAME, CenterMessage, CommunityHeader, HeaderButton, styles as ui } from './ui';

const SIDE = 20;

// 게시판 전체보기: 에세이(4장) · 자유게시판(7장, #태그 · 검색어로 좁힘) · 교육단체 홍보 목록
export default function PostListScreen() {
  const params = useScreenParams<{ board?: string; tag?: string }>();
  const board = (['ESSAY', 'FREE', 'PROMO'].includes(String(params.board)) ? params.board : 'FREE') as CommunityBoard;
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CommunityCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [tag, setTag] = useState(params.tag ?? '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(0);
  const [canWriteEssay, setCanWriteEssay] = useState(false);
  const epoch = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (more = false) => {
    if (more && (busy.current || !hasMore)) return;
    const version = more ? epoch.current : ++epoch.current;
    busy.current = true;
    try {
      const before = more ? items[items.length - 1]?.id : undefined;
      const result = await api.getCommunityPosts(board, { before, tag, q: query });
      if (version !== epoch.current) return;
      setItems(prev => (more ? [...prev, ...result.items.filter(p => !prev.some(q => q.id === p.id))] : result.items));
      setHasMore(result.hasMore);
      setState('ready');
    } catch {
      if (version === epoch.current && !more) setState('error');
    } finally {
      if (version === epoch.current) busy.current = false;
    }
  }, [board, tag, query, items, hasMore]);

  // 처음 열 때와 조건이 바뀔 때, 글을 보고 돌아올 때 새로
  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(useCallback(() => { void loadRef.current(); }, [board, tag, query]));
  useFocusEffect(useCallback(() => {
    if (board !== 'ESSAY') return;
    api.getCommunityHome().then(home => setCanWriteEssay(home.canWriteEssay)).catch(() => {});
  }, [board]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openPost = (post: CommunityCard) => router.push({ pathname: '/community-post', params: { id: String(post.id) } });
  const submitSearch = () => {
    const text = draft.trim();
    // '#태그'로 찾으면 태그 칩으로
    if (text.startsWith('#') && !/\s/.test(text)) { setTag(text.replace(/^#+/, '')); setQuery(''); }
    else setQuery(text);
  };

  const inner = Math.max(0, width - SIDE * 2);
  const right = board === 'FREE'
    ? <View style={styles.headerButtons}>
        <HeaderButton icon="search" label="검색" onPress={() => setSearchOpen(open => !open)} />
        <HeaderButton icon="create-outline" label="글쓰기" onPress={() => router.push('/community-free-write')} />
      </View>
    : board === 'ESSAY' && canWriteEssay
      ? <HeaderButton icon="create-outline" label="에세이 쓰기" onPress={() => router.push('/community-essay-write')} />
      : undefined;

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <CommunityHeader title={BOARD_NAME[board]} right={right} />
      {board === 'FREE' && searchOpen && (
        <View style={styles.search}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submitSearch} returnKeyType="search" autoFocus
            placeholder="제목 · 내용 · #태그" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.searchInput} />
          {!!draft && <Pressable onPress={() => { setDraft(''); setQuery(''); }} hitSlop={8}><Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" /></Pressable>}
        </View>
      )}
      {(!!tag || !!query) && (
        <View style={styles.filters}>
          {!!tag && <ActionChip icon="close" label={`#${tag}`} active onPress={() => setTag('')} />}
          {!!query && <ActionChip icon="close" label={`'${query}' 검색`} active onPress={() => { setQuery(''); setDraft(''); }} />}
        </View>
      )}
      {state !== 'ready' ? <CenterMessage loading={state === 'loading'} message="글을 불러오지 못했어요." onRetry={() => void load()} /> : (
        <FlatList
          key={board === 'ESSAY' ? 'grid' : 'list'}
          data={items}
          keyExtractor={item => String(item.id)}
          numColumns={board === 'ESSAY' ? 2 : 1}
          columnWrapperStyle={board === 'ESSAY' ? { gap: 10 } : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !items.length && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="rgba(255,255,255,0.6)" />}
          onEndReached={() => void load(true)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<CenterMessage message={tag || query ? '찾는 글이 없어요.' : '아직 글이 없어요.'} />}
          renderItem={({ item }) => board === 'ESSAY'
            ? <EssayCard post={item} width={(inner - 10) / 2} onPress={openPost} />
            : board === 'PROMO'
              ? <PromoCard post={item} height={Math.min(inner * 9 / 16, 220)} onPress={openPost} />
              : <FreeRow post={item} onPress={openPost} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 6 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SIDE, marginBottom: 8, paddingHorizontal: 14, height: 42,
    borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: 'white' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: SIDE, paddingBottom: 8 },
  list: { paddingHorizontal: SIDE, paddingTop: 4, gap: 10 },
});
