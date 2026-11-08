import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import LevelBadge from '@/components/LevelBadge';
import type { TourCard } from '@/services/api';
import { CYAN, GRID_GAP, TOUR_STATUS, cardLines, cardWidthFor } from './ui';

export function Badge({ label, color, text, small }: { label: string; color: string; text: string; small?: boolean }) {
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, small && styles.badgeTextSmall, { color: text }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status, small }: { status: TourCard['status']; small?: boolean }) {
  const meta = TOUR_STATUS[status];
  return meta ? <Badge {...meta} small={small} /> : null;
}

export function TourPhoto({ uri, style, children }: { uri: string | null; style: object; children?: React.ReactNode }) {
  return (
    <View style={[style, styles.photo]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
        <Ionicons name="image-outline" size={26} color="rgba(255,255,255,0.3)" />
      )}
      {children}
    </View>
  );
}

// 큰 사진 카드: 사진(대표 사진, 정사각형)이 위에 크게, 글자는 아래 (목록 공통)
// badge: 사진 왼쪽 위 배지 · onMenu: 사진 오른쪽 위 '⋯' · footer: 카드 아래 버튼
// stretch: 한 줄에 놓인 카드끼리 높이를 맞추고 버튼을 아래 끝에 (글 줄 수가 카드마다 다를 때) · onNote: 한 줄로 줄인 안내를 누르면
export function TourPhotoCard({
  tour, width, badge, lines, onPress, onMenu, onNote, footer, stretch,
}: {
  tour: TourCard; width: number; badge?: React.ReactNode;
  lines?: { where?: string; meta?: string; lead?: string; leadColor?: string; count?: string | null; note?: { text: string; color: string } };
  onPress?: () => void; onMenu?: () => void; onNote?: () => void; footer?: React.ReactNode; stretch?: boolean;
}) {
  const auto = cardLines(tour);
  // meta를 따로 주면 where(나라 · 장소)도 준 것만 씀 — 자동 where가 다른 글 앞에 붙지 않게
  const l = { ...auto, ...(lines && 'meta' in lines ? { where: undefined } : {}), ...lines };
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, { width }, stretch && styles.stretch, pressed && styles.pressed]}>
      <TourPhoto uri={tour.coverUrl} style={{ width, height: width }}>
        {badge ? <View style={styles.badgeOnPhoto}>{badge}</View> : null}
        {onMenu ? (
          <Pressable onPress={onMenu} hitSlop={8} style={styles.menu} accessibilityLabel="더보기">
            <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </TourPhoto>
      <View style={[styles.body, stretch && styles.stretch]}>
        <Text style={styles.title} numberOfLines={1}>{tour.name}</Text>
        {l.meta && l.where ? (
          // 나라 · 장소가 길면 그쪽만 '…'으로 줄이고 기간은 끝까지 보임
          <View style={styles.metaRow}>
            <Text style={[styles.meta, styles.metaWhere]} numberOfLines={1}>{l.where}</Text>
            <Text style={styles.meta} numberOfLines={1}>{` · ${l.meta}`}</Text>
          </View>
        ) : l.meta ? <Text style={styles.meta} numberOfLines={1}>{l.meta}</Text> : null}
        {l.lead || l.count ? (
          <View style={styles.leadRow}>
            <Text style={[styles.lead, { color: l.leadColor ?? CYAN }]} numberOfLines={1}>{l.lead}</Text>
            {l.count ? <Text style={styles.count}>{l.count}</Text> : null}
          </View>
        ) : null}
        {l.note ? (
          <Text style={[styles.lead, { color: l.note.color }]} numberOfLines={1} onPress={onNote} suppressHighlighting
            accessibilityRole={onNote ? 'button' : undefined}>{l.note.text}</Text>
        ) : null}
        {footer ? <View style={[styles.footer, stretch && styles.footerBottom]}>{footer}</View> : null}
      </View>
    </Pressable>
  );
}

// 목록 폭을 재서 한 줄 2개(600pt 미만) · 4개(600pt 이상)로 나눔
export function useGridWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  return { width, cardWidth: width ? cardWidthFor(width) : 0, onLayout };
}

export function TourGrid<T>({ items, cardWidth, renderItem, keyOf }: {
  items: T[]; cardWidth: number; renderItem: (item: T) => React.ReactNode; keyOf: (item: T) => string | number;
}) {
  if (!cardWidth) return null;
  return (
    <View style={styles.grid}>
      {items.map(item => <View key={keyOf(item)} style={{ width: cardWidth }}>{renderItem(item)}</View>)}
    </View>
  );
}

export function CardButton({ label, kind = 'primary', onPress, disabled }: {
  label: string; kind?: 'primary' | 'dark' | 'danger' | 'salmon'; onPress: () => void; disabled?: boolean;
}) {
  const box = { primary: styles.btnPrimary, dark: styles.btnDark, danger: styles.btnDark, salmon: styles.btnSalmon }[kind];
  const text = { primary: styles.btnTextLight, dark: styles.btnTextMuted, danger: styles.btnTextDanger, salmon: styles.btnTextLight }[kind];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.btn, box, (pressed || disabled) && styles.pressed]}>
      <Text style={[styles.btnText, text]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// 크기를 고를 수 있는 프로필 사진 (참여 신청 카드는 크게, 제안 카드의 강사 줄은 작게). 사진이 없으면 닉네임 첫 글자
export function Avatar({ uri, nickname, size, level }: { uri: string | null; nickname: string; size: number; level?: string }) {
  const [failed, setFailed] = useState(false);
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={round}>
      {uri && !failed ? <Image source={{ uri }} style={[round, styles.avatarImage]} onError={() => setFailed(true)} /> : (
        <View style={[round, styles.avatarEmpty]}><Text style={[styles.avatarInitial, { fontSize: Math.max(9, size * 0.4) }]}>{nickname.charAt(0) || '?'}</Text></View>
      )}
      {level ? <View style={styles.avatarBadge}><LevelBadge level={level} size={Math.max(14, size * 0.3)} /></View> : null}
    </View>
  );
}

// 비었을 때: 홈 툴바와 같은 'allblue' 로고를 크게 + 안내 문구
export function TourEmpty({ message }: { message: string }) {
  return (
    <View style={styles.emptyArea}>
      <Text style={styles.logo}>all<Text style={styles.logoAccent}>b</Text>lue</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  pressed: { opacity: 0.7 },
  photo: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  badgeOnPhoto: { position: 'absolute', top: 8, left: 8, right: 40, alignItems: 'flex-start' },
  menu: {
    position: 'absolute', top: 6, right: 6, width: 28, height: 22, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,27,42,0.55)',
  },
  body: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 3 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  metaRow: { flexDirection: 'row' },
  metaWhere: { flexShrink: 1 },
  leadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  lead: { flexShrink: 1, fontFamily: 'SUIT-Bold', fontSize: 12 },
  count: { fontFamily: 'SUIT-Bold', fontSize: 12, color: CYAN },
  footer: { marginTop: 6, gap: 6 },
  stretch: { flexGrow: 1 },
  footerBottom: { marginTop: 'auto', paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, maxWidth: '100%' },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: 'SUIT-Bold', fontSize: 11 },
  badgeTextSmall: { fontSize: 10 },
  btn: { height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnPrimary: { backgroundColor: '#00B4D8' },
  btnDark: { backgroundColor: '#023E73' },
  btnSalmon: { backgroundColor: '#FF8A75' },
  btnText: { fontFamily: 'SUIT-Bold', fontSize: 12 },
  btnTextLight: { color: '#FFFFFF' },
  btnTextMuted: { color: '#B8D4F0' },
  btnTextDanger: { color: '#FF8A75' },
  avatarImage: { backgroundColor: 'rgba(255,255,255,0.15)' },
  avatarEmpty: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'SUIT-Bold', color: Colors.brand.white },
  avatarBadge: { position: 'absolute', bottom: -3, right: -3, borderWidth: 1.5, borderColor: Colors.brand.primary, borderRadius: 10 },
  emptyArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  // 툴바 로고와 같은 글꼴 · 자간 (SUIT-Regular, 20pt에 자간 4), 크게
  logo: { fontFamily: 'SUIT-Regular', fontSize: 34, letterSpacing: 34 * (4 / 20), color: Colors.brand.white },
  logoAccent: { color: '#00E5FF' },
  emptyMessage: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'rgba(255,255,255,0.6)' },
});
