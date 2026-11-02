import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CommunityCard, CommunityGreeting } from '@/services/api';
import { clockTime, Counts, styles as ui, timeAgo } from './ui';

// 에세이 카드: 대표 사진(본문 첫 사진, 없으면 기본 그림) · 제목 · 강사 · 좋아요 수
export function EssayCard({ post, onPress, width }: { post: CommunityCard; onPress: (post: CommunityCard) => void; width: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(post)} style={({ pressed }) => [ui.card, styles.essay, { width }, pressed && { opacity: 0.8 }]}>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={[styles.essayImage, { height: width * 0.62 }]} /> : (
        <View style={[styles.essayImage, styles.essayPlaceholder, { height: width * 0.62 }]}>
          <Ionicons name="book-outline" size={26} color="rgba(255,255,255,0.35)" />
        </View>
      )}
      <View style={styles.essayText}>
        <Text style={styles.essayTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={ui.meta} numberOfLines={1}>{post.author.nickname} · 좋아요 {post.likeCount}</Text>
      </View>
    </Pressable>
  );
}

// 자유게시판 줄: 제목 · 작성자 · 시간 · 좋아요 · 댓글 수, 사진이 있으면 오른쪽 작은 썸네일
export function FreeRow({ post, onPress }: { post: CommunityCard; onPress: (post: CommunityCard) => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(post)} style={({ pressed }) => [ui.card, styles.row, pressed && { opacity: 0.8 }]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{post.title}</Text>
        {!!post.tags.length && <Text style={ui.tag} numberOfLines={1}>{post.tags.map(t => `#${t}`).join(' ')}</Text>}
        <View style={styles.rowMeta}>
          <Text style={ui.meta} numberOfLines={1}>{post.author.nickname} · {timeAgo(post.createdAt)}</Text>
          <Counts likeCount={post.likeCount} commentCount={post.commentCount} />
        </View>
      </View>
      {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={styles.thumb} />}
    </Pressable>
  );
}

// 교육단체 홍보: 대표 이미지 위에 단체 이름과 제목
export function PromoCard({ post, onPress, height, label }: { post: CommunityCard; onPress: (post: CommunityCard) => void; height: number; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${post.organization?.name ?? ''} 홍보, ${post.title}`} onPress={() => onPress(post)}
      style={({ pressed }) => [ui.card, styles.promo, { height }, pressed && { opacity: 0.85 }]}>
      {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      <View style={styles.promoShade} />
      {!!label && <Text style={styles.promoLabel}>{label}</Text>}
      <View style={styles.promoText}>
        <Text style={styles.promoOrg} numberOfLines={1}>{post.organization?.name}</Text>
        <Text style={styles.promoTitle} numberOfLines={2}>{post.title}</Text>
      </View>
    </Pressable>
  );
}

export function GreetingRow({ greeting, onLongPress, showTime = true }: { greeting: CommunityGreeting; onLongPress?: (g: CommunityGreeting) => void; showTime?: boolean }) {
  return (
    <Pressable onLongPress={onLongPress && (() => onLongPress(greeting))} delayLongPress={350} style={[ui.card, styles.greeting]}>
      {greeting.author.profileImage ? <Image source={{ uri: greeting.author.profileImage }} style={styles.greetingAvatar} /> : (
        <View style={[styles.greetingAvatar, styles.essayPlaceholder]}><Text style={styles.initial}>{greeting.author.nickname.charAt(0)}</Text></View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.rowMeta}>
          <Text style={ui.metaStrong} numberOfLines={1}>{greeting.author.nickname}</Text>
          {showTime && <Text style={ui.meta}>{clockTime(greeting.createdAt)}</Text>}
        </View>
        <Text style={styles.greetingText}>{greeting.content}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  essay: { overflow: 'hidden' },
  essayImage: { width: '100%' },
  essayPlaceholder: { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  essayText: { padding: 10, gap: 4 },
  essayTitle: { fontFamily: 'SUIT-SemiBold', fontSize: 14, lineHeight: 19, color: 'white', minHeight: 38 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  promo: { overflow: 'hidden', justifyContent: 'flex-end' },
  promoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,30,60,0.35)' },
  promoLabel: {
    position: 'absolute', top: 10, right: 10, fontFamily: 'SUIT-SemiBold', fontSize: 11, color: 'white',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden',
  },
  promoText: { padding: 14, gap: 2 },
  promoOrg: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  promoTitle: { fontFamily: 'SUIT-Bold', fontSize: 17, color: 'white' },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  greetingAvatar: { width: 32, height: 32, borderRadius: 16 },
  initial: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'white' },
  greetingText: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: 'white', marginTop: 2 },
});
