import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import DatePickerSheet from '@/components/DatePickerSheet';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type CommunityCard } from '@/services/api';
import { BOARD_NAME, CenterMessage, CommunityHeader, styles as ui } from './ui';
import { PostFlatList, SIDE, toBoard } from './PostListScreen';
import { useWindowedList } from './useWindowedList';

const ACCENT = '#00E5FF';
type Conditions = { from: string; to: string; q: string; author: string };
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthAgo = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  return localDay(d);
};
const dot = (day: string) => day.replace(/-/g, '.');

// 게시판 검색 (전체보기의 돋보기, 투어 제안 검색과 같은 구성): 위에 조건, 아래에 결과 (최근 순 10개씩, 최대 100개).
// 작성일은 고르면 바로, 검색어 · 작성자는 키보드의 '검색'을 누르면 찾음. 기본 작성일은 한 달 전 ~ 오늘
export default function PostSearchScreen() {
  const board = toBoard(useScreenParams<{ board?: string }>().board);
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const today = localDay(new Date());
  const [conditions, setConditions] = useState<Conditions>({ from: monthAgo(today), to: today, q: '', author: '' });
  const [draft, setDraft] = useState({ q: '', author: '' });
  const [sheet, setSheet] = useState<'from' | 'to' | null>(null);
  const [width, setWidth] = useState(0);
  const list = useWindowedList<CommunityCard>(cursor => api.searchCommunityPosts(board, { ...conditions, ...cursor }));

  useEffect(() => { void list.reload('first'); }, [conditions]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Conditions>) => setConditions(prev => ({ ...prev, ...patch }));
  const applyText = () => set({ q: draft.q.trim(), author: draft.author.trim() });
  const openPost = (post: CommunityCard) => router.push({ pathname: '/community-post', params: { id: String(post.id) } });
  const inner = Math.max(0, width - SIDE * 2);

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <CommunityHeader title={`${BOARD_NAME[board]} 검색`} />

      {/* 검색 조건: 작성일 · 검색어(제목 · 내용 · 태그) · 작성자 */}
      <View style={styles.filters}>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color={ACCENT} />
          <Selector label={dot(conditions.from)} onPress={() => setSheet('from')} />
          <Text style={styles.tilde}>~</Text>
          <Selector label={dot(conditions.to)} onPress={() => setSheet('to')} />
        </View>
        <SearchField icon="search" value={draft.q} placeholder="검색어 (제목 · 내용 · 태그)" onChange={q => setDraft(d => ({ ...d, q }))} onSubmit={applyText}
          onClear={() => { setDraft(d => ({ ...d, q: '' })); set({ q: '' }); }} />
        <SearchField icon="person-outline" value={draft.author} placeholder="작성자 닉네임" onChange={author => setDraft(d => ({ ...d, author }))} onSubmit={applyText}
          onClear={() => { setDraft(d => ({ ...d, author: '' })); set({ author: '' }); }} />
        <Text style={styles.hint}>작성일 기준 · 최근 순</Text>
      </View>

      {list.state !== 'ready' ? <CenterMessage loading={list.state === 'loading'} message="글을 불러오지 못했어요." onRetry={() => void list.reload()} /> : (
        <PostFlatList board={board} list={list} inner={inner} bottom={insets.bottom} empty="찾는 글이 없어요." onPress={openPost} />
      )}

      <DatePickerSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        selectedDate={conditions.from}
        onSelect={from => set({ from, to: conditions.to < from ? from : conditions.to })}
      />
      <DatePickerSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        selectedDate={conditions.to}
        minDate={conditions.from}
        onSelect={to => set({ to })}
      />
    </View>
  );
}

function Selector({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.selector, pressed && { opacity: 0.7 }]}>
      <Text style={styles.selectorText} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

function SearchField({ icon, value, placeholder, onChange, onSubmit, onClear }: {
  icon: 'search' | 'person-outline'; value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void; onClear: () => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={ACCENT} />
      <View style={styles.field}>
        <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} returnKeyType="search" maxLength={40}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)" style={styles.input} />
        {!!value && (
          <Pressable accessibilityRole="button" accessibilityLabel="지우기" onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: SIDE, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white, paddingVertical: 10 },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
});
