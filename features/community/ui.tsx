import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import GlassCircle from '@/components/GlassCircle';
import GlassChip from '@/components/GlassChip';
import ProfileAvatar from '@/components/ProfileAvatar';
import StripBackSlot from '@/components/StripBackSlot';
import { LiquidGlassView } from '@/utils/liquidGlass';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import type { CommunityAuthor, CommunityBoard } from '@/services/api';

export const BOARD_NAME: Record<CommunityBoard | 'GREETING', string> = {
  ESSAY: '에세이', FREE: '자유게시판', PROMO: '교육단체 홍보', GREETING: '출석인사',
};

// 서버 community-rules.ts와 같은 규칙 (보내기 전에 앱에서도 검사)
export const LIMITS = {
  titleMin: 2, titleMax: 40, freeContentMax: 2000, essayImageMax: 20,
  promoImageMax: 10, tagMax: 10, tagLength: 20, commentMax: 500, greetingMax: 80, reportMemoMax: 200,
};

// 신고 사유 (11장)
export const REPORT_REASONS = [
  { code: 'SPAM', label: '스팸 · 홍보' },
  { code: 'ABUSE', label: '욕설 · 비하' },
  { code: 'OBSCENE', label: '음란 · 불쾌' },
  { code: 'ETC', label: '기타' },
];
export const reportReasonLabel = (code: string) => REPORT_REASONS.find(r => r.code === code)?.label ?? code;

// '방금 전' · '12분 전' · '3시간 전' · 일주일 안이면 '2일 전', 그 뒤로는 '11.02' (해가 다르면 '2025.11.02')
export function timeAgo(iso: string, now = new Date()) {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)}일 전`;
  const kst = new Date(date.getTime() + 9 * 3600_000).toISOString();
  const thisYear = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 4);
  return kst.slice(0, 4) === thisYear ? `${kst.slice(5, 7)}.${kst.slice(8, 10)}` : `${kst.slice(0, 4)}.${kst.slice(5, 7)}.${kst.slice(8, 10)}`;
}

// 한국 시간 '09:12'
export const clockTime = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(11, 16);

export function CommunityHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const router = useAppRouter();
  const paneRoot = useIsPaneRoot();
  return (
    <View style={styles.header}>
      {paneRoot ? <View style={styles.headerSide} /> : (
        <StripBackSlot size={44}>
          <Pressable accessibilityLabel="뒤로가기" onPress={onBack ?? (() => router.back())} style={styles.headerSide} hitSlop={8}>
            <GlassCircle><Ionicons name="chevron-back" size={LiquidGlassView ? 20 : 26} color="white" /></GlassCircle>
          </Pressable>
        </StripBackSlot>
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function HeaderButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <GlassCircle><Ionicons name={icon} size={20} color="white" /></GlassCircle>
    </Pressable>
  );
}

export function TextHeaderButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={8} style={({ pressed }) => (pressed || disabled) && { opacity: 0.5 }}>
      {disabled ? <ActivityIndicator color={Colors.brand.accent} /> : <Text style={styles.headerAction}>{label}</Text>}
    </Pressable>
  );
}

export function ActionChip({ icon, label, onPress, active }: { icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <GlassChip fallbackStyle={[styles.chipFallback, active && styles.chipActive]}>
        <View style={styles.chipContent}>
          {icon && <Ionicons name={icon} size={15} color={Colors.brand.white} />}
          <Text style={styles.chipText}>{label}</Text>
        </View>
      </GlassChip>
    </Pressable>
  );
}

export function AuthorLine({ author, meta, onPress, size = 'small' }: { author: CommunityAuthor; meta?: string; onPress?: () => void; size?: 'small' | 'large' }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.authorLine}>
      {size === 'large' && <ProfileAvatar profileImage={author.profileImage} nickname={author.nickname} level={author.badgeLevel} />}
      <View style={{ flexShrink: 1 }}>
        <View style={styles.authorNameRow}>
          <Text style={styles.authorName} numberOfLines={1}>{author.nickname}</Text>
          {author.badgeLevel === '5' && <Text style={styles.instructorTag}>강사</Text>}
        </View>
        {!!meta && <Text style={styles.meta}>{meta}</Text>}
      </View>
    </Pressable>
  );
}

export function LikeButton({ liked, count, onPress, small }: { liked: boolean; count: number; onPress: () => void; small?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={liked ? '좋아요 취소' : '좋아요'} accessibilityState={{ selected: liked }}
      onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.like, pressed && { opacity: 0.6 }]}>
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={small ? 14 : 20} color={liked ? '#FF6B8A' : 'rgba(255,255,255,0.7)'} />
      <Text style={[small ? styles.metaStrong : styles.likeText]}>{small ? count : `좋아요 ${count}`}</Text>
    </Pressable>
  );
}

export function Counts({ likeCount, commentCount, showComments = true }: { likeCount: number; commentCount: number; showComments?: boolean }) {
  return (
    <View style={styles.counts}>
      <Ionicons name="heart-outline" size={12} color="rgba(255,255,255,0.5)" />
      <Text style={styles.meta}>{likeCount}</Text>
      {showComments && <>
        <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />
        <Text style={styles.meta}>{commentCount}</Text>
      </>}
    </View>
  );
}

export function CenterMessage({ message, onRetry, loading }: { message?: string; onRetry?: () => void; loading?: boolean }) {
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>;
  return (
    <Pressable disabled={!onRetry} onPress={onRetry} style={styles.center}>
      <Text style={styles.emptyText}>{message}</Text>
      {onRetry && <Text style={styles.retry}>눌러서 다시 시도해 주세요</Text>}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  headerSide: { width: 84, height: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'SUIT-SemiBold', fontSize: 18, color: 'white' },
  headerAction: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.accent },
  chipFallback: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipActive: { backgroundColor: Colors.brand.accent },
  chipContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'white', flexShrink: 1 },
  instructorTag: { fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.accent },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  metaStrong: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  retry: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  card: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'white' },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: '#A8BFD6', marginBottom: 8 },
  error: { fontFamily: 'SUIT-Regular', fontSize: 12, color: '#FF6B4A', marginTop: 6 },
  input: {
    backgroundColor: '#20558B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14, color: 'white',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22,
  },
  inputError: { borderColor: '#FF6B4A' },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: Colors.brand.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#032A36' },
  secondaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryButtonText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
  tag: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.accent },
});
