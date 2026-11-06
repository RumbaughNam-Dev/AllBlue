import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { TourEmpty } from './TourCards';
import type { useWindowedList } from '@/features/community/useWindowedList';
import { GRID_GAP, gridColumns } from './ui';

// 목록 공통 (12 · 24장): 큰 사진 카드를 한 줄에 2개 (목록 폭 600pt 이상이면 4개).
// 아래 끝 → 더 예전 10개, 위 끝(덜어낸 적이 있으면) → 더 최근 10개, 붙이거나 덜어도 보던 자리 유지
export default function TourGridList<T extends { id: number }>({ list, width, side, bottom, empty, header, renderCard }: {
  list: ReturnType<typeof useWindowedList<T>>; width: number; side: number; bottom: number; empty: string;
  header?: React.ReactElement; renderCard: (item: T, cardWidth: number) => React.ReactNode;
}) {
  const inner = Math.max(0, width - side * 2);
  const columns = gridColumns(inner);
  const cardWidth = inner ? Math.floor((inner - GRID_GAP * (columns - 1)) / columns) : 0;
  const rows: T[][] = [];
  for (let i = 0; i < list.items.length; i += columns) rows.push(list.items.slice(i, i + columns));
  const spinner = <ActivityIndicator style={styles.more} color="rgba(255,255,255,0.6)" />;
  return (
    <FlatList
      // 2개 ↔ 4개가 바뀌면 줄을 다시 나눔 (펼치거나 접을 때)
      key={`grid-${columns}`}
      data={cardWidth ? rows : []}
      keyExtractor={row => String(row[0].id)}
      contentContainerStyle={[styles.list, { paddingHorizontal: side, paddingBottom: bottom + 24 }, !list.items.length && { flexGrow: 1 }]}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload('refresh')} tintColor="rgba(255,255,255,0.6)" />}
      onEndReached={() => void list.loadOlder()}
      onEndReachedThreshold={0.5}
      onStartReached={() => void list.loadNewer()}
      onStartReachedThreshold={0.5}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      windowSize={7}
      ListHeaderComponent={<>{header}{list.more === 'newer' ? spinner : null}</>}
      ListFooterComponent={list.more === 'older' ? spinner : undefined}
      ListEmptyComponent={<TourEmpty message={empty} />}
      renderItem={({ item: row }) => (
        <View style={styles.row}>{row.map(item => <View key={item.id} style={{ width: cardWidth }}>{renderCard(item, cardWidth)}</View>)}</View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 4, gap: GRID_GAP },
  row: { flexDirection: 'row', gap: GRID_GAP },
  more: { paddingVertical: 14 },
});

// 한 번에 다 받는 짧은 목록 (admin 등록요청 · 신고 · 배너, 받은 제안): 같은 2개 · 4개 카드 줄, 위에 안내 줄
export function TourGridStatic<T>({ items, keyOf, width, side, bottom, empty, header, refreshing, onRefresh, renderCard }: {
  items: T[]; keyOf: (item: T) => string | number; width: number; side: number; bottom: number; empty: string;
  header?: React.ReactElement; refreshing: boolean; onRefresh: () => void; renderCard: (item: T, cardWidth: number) => React.ReactNode;
}) {
  const inner = Math.max(0, width - side * 2);
  const columns = gridColumns(inner);
  const cardWidth = inner ? Math.floor((inner - GRID_GAP * (columns - 1)) / columns) : 0;
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <FlatList
      key={`grid-${columns}`}
      data={cardWidth ? rows : []}
      keyExtractor={row => String(keyOf(row[0]))}
      contentContainerStyle={[styles.list, { paddingHorizontal: side, paddingBottom: bottom + 24 }, !items.length && { flexGrow: 1 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />}
      windowSize={7}
      ListHeaderComponent={header}
      ListEmptyComponent={<TourEmpty message={empty} />}
      renderItem={({ item: row }) => (
        <View style={styles.row}>{row.map(item => <View key={keyOf(item)} style={{ width: cardWidth }}>{renderCard(item, cardWidth)}</View>)}</View>
      )}
    />
  );
}
