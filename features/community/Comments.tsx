import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, type CommunityComment, type CommunityThread } from '@/services/api';
import { MentionSuggestions, MentionText, useMentions } from './mentions';
import { LIMITS, LikeButton, styles as ui, timeAgo } from './ui';
import type { MenuTarget } from './useContentMenu';

type Handlers = {
  onReply: (comment: CommunityComment) => void;
  onMenu: (target: MenuTarget) => void;
  onOpenUser: (userId: string) => void;
  onChanged: () => void;
};

// 9장 댓글 목록: 대댓글은 한 단계 들여서, 지운 댓글은 대댓글이 남아 있을 때만 '삭제된 댓글이에요'
export function CommentList({ threads, ...handlers }: { threads: CommunityThread[] } & Handlers) {
  if (!threads.length) return <Text style={styles.empty}>첫 댓글을 남겨 보세요.</Text>;
  return (
    <View style={styles.list}>
      {threads.map(thread => (
        <View key={thread.id} style={styles.thread}>
          <CommentRow comment={thread} {...handlers} />
          {thread.replies.map(reply => (
            <View key={reply.id} style={styles.reply}><CommentRow comment={reply} {...handlers} /></View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CommentRow({ comment, onReply, onMenu, onOpenUser, onChanged }: { comment: CommunityComment } & Handlers) {
  const [like, setLike] = useState({ liked: !!comment.liked, count: comment.likeCount ?? 0 });
  if (comment.removed || !comment.author) {
    return <View style={[ui.card, styles.row]}><Text style={styles.removed}>{comment.removed === 'BLOCKED' ? '차단한 사용자의 댓글이에요' : '삭제된 댓글이에요'}</Text></View>;
  }
  const author = comment.author;
  const toggleLike = async () => {
    const next = !like.liked;
    setLike(prev => ({ liked: next, count: prev.count + (next ? 1 : -1) }));
    try {
      const result = await api.likeCommunity('comments', comment.id, next);
      setLike({ liked: result.liked, count: result.likeCount });
    } catch (e: any) {
      setLike({ liked: !next, count: like.count });
      if (!e?._handled) Alert.alert('좋아요를 누르지 못했어요', e?.message ?? '다시 시도해 주세요.');
    }
  };
  return (
    <Pressable delayLongPress={350} style={[ui.card, styles.row]}
      onLongPress={() => onMenu({
        type: 'COMMENT', id: comment.id, author, mine: !!comment.mine, canDelete: !!comment.canDelete,
        onDeleted: onChanged, onBlocked: onChanged,
      })}>
      <Pressable onPress={() => onOpenUser(author.userId)} hitSlop={4} style={styles.nameRow}>
        <Text style={ui.metaStrong}>{author.nickname}</Text>
        {author.badgeLevel === '5' && <Text style={ui.instructorTag}>강사</Text>}
      </Pressable>
      <MentionText text={comment.content ?? ''} mentions={comment.mentions ?? []} style={styles.content} onOpenUser={onOpenUser} />
      <View style={styles.meta}>
        <Text style={ui.meta}>{timeAgo(comment.createdAt)}</Text>
        <LikeButton small liked={like.liked} count={like.count} onPress={toggleLike} />
        <Pressable onPress={() => onReply(comment)} hitSlop={8}><Text style={ui.meta}>답글 달기</Text></Pressable>
      </View>
    </Pressable>
  );
}

// 아래 고정 입력칸: @를 치면 위로 사용자 목록, 답글 중이면 '○○님에게 답글 다는 중 ✕'
export function CommentInput({ postId, replyTo, onCancelReply, onSent, bottomInset }: {
  postId: number; replyTo: CommunityComment | null; onCancelReply: () => void; onSent: () => void; bottomInset: number;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const mentions = useMentions(text, setText);
  // 답글 달기를 누르면 '@닉네임 '으로 채움
  const replyId = replyTo?.id;
  useEffect(() => {
    if (replyTo?.author) mentions.prefill({ userId: replyTo.author.userId, nickname: replyTo.author.nickname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyId]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    if (content.length > LIMITS.commentMax) { Alert.alert(`댓글은 ${LIMITS.commentMax}자까지예요.`); return; }
    setSending(true);
    try {
      await api.addCommunityComment(postId, { content, mentions: mentions.mentionIds(), ...(replyTo ? { parentId: replyTo.id } : {}) });
      setText('');
      mentions.reset();
      onSent();
    } catch (e: any) {
      if (!e?._handled) Alert.alert('댓글을 남기지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.inputArea, { paddingBottom: bottomInset + 8 }]}>
      {mentions.open && <View style={styles.suggestions}><MentionSuggestions users={mentions.users} loading={mentions.loading} onPick={mentions.pick} /></View>}
      {replyTo?.author && (
        <View style={styles.replyBanner}>
          <Text style={ui.meta}>{replyTo.author.nickname}님에게 답글 다는 중</Text>
          <Pressable onPress={() => { onCancelReply(); setText(''); mentions.reset(); }} hitSlop={8}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput onChangeText={setText} {...mentions.inputProps} multiline maxLength={LIMITS.commentMax}
          placeholder="댓글을 입력하세요 (@로 사용자 태그)" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.input}>{mentions.styled}</TextInput>
        <Pressable accessibilityRole="button" accessibilityLabel="등록" onPress={send} disabled={!text.trim() || sending}
          style={({ pressed }) => [styles.send, (!text.trim() || pressed) && { opacity: 0.5 }]}>
          {sending ? <ActivityIndicator color="#032A36" /> : <Text style={styles.sendText}>등록</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  thread: { gap: 8 },
  reply: { marginLeft: 28 },
  row: { padding: 12, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  content: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'white' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
  removed: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  empty: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.4)', paddingVertical: 8 },
  inputArea: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: Colors.brand.primary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  suggestions: { position: 'absolute', left: 16, right: 16, bottom: '100%', marginBottom: 6 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, maxHeight: 110, minHeight: 42, borderRadius: 14, backgroundColor: '#0F3D6E', color: 'white',
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontFamily: 'SUIT-Regular', fontSize: 14,
  },
  send: { height: 42, paddingHorizontal: 16, borderRadius: 14, backgroundColor: Colors.brand.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#032A36' },
});
