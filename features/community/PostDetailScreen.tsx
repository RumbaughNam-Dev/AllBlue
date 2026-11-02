import React, { useCallback, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type CommunityComment, type CommunityPost, type CommunityThread } from '@/services/api';
import { CommentInput, CommentList } from './Comments';
import EssayBody from './EssayBody';
import ImageViewer from './ImageViewer';
import { MentionText } from './mentions';
import { AuthorLine, BOARD_NAME, CenterMessage, CommunityHeader, HeaderButton, LikeButton, styles as ui, timeAgo } from './ui';
import { useContentMenu } from './useContentMenu';

const SIDE = 20;

// 4 · 7 · 10장 상세: 에세이(서식 · 사진) · 자유게시판(본문 · 사진 1장 · #태그) · 교육단체 홍보(이미지), 아래로 좋아요 · 댓글
export default function PostDetailScreen() {
  const { id } = useScreenParams<{ id?: string }>();
  const postId = Number(id);
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);
  const menu = useContentMenu();
  const scroll = useRef<ScrollViewInstance>(null);

  const loadComments = useCallback(async () => {
    try {
      const result = await api.getCommunityComments(postId);
      setThreads(result.comments);
      setCommentCount(result.count);
    } catch { /* keep the last list */ }
  }, [postId]);
  const load = useCallback(async () => {
    try {
      const result = await api.getCommunityPost(postId);
      setPost(result.post);
      setError(null);
      if (result.post.canComment) void loadComments();
    } catch (e: any) {
      setError(e?.status === 404 ? '볼 수 없는 글이에요.' : '글을 불러오지 못했어요.');
    }
  }, [postId, loadComments]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openUser = (userId: string) => router.push({ pathname: '/profile-view', params: { userId } });
  const toggleLike = async () => {
    if (!post) return;
    const next = !post.liked;
    setPost({ ...post, liked: next, likeCount: post.likeCount + (next ? 1 : -1) });
    try {
      const result = await api.likeCommunity('posts', post.id, next);
      setPost(prev => prev && { ...prev, liked: result.liked, likeCount: result.likeCount });
    } catch (e: any) {
      setPost(prev => prev && { ...prev, liked: !next, likeCount: post.likeCount });
      if (!e?._handled) Alert.alert('좋아요를 누르지 못했어요', e?.message ?? '다시 시도해 주세요.');
    }
  };
  const edit = () => {
    if (!post) return;
    if (post.board === 'ESSAY') router.push({ pathname: '/community-essay-write', params: { id: String(post.id) } });
    else if (post.board === 'FREE') router.push({ pathname: '/community-free-write', params: { id: String(post.id) } });
    else router.push('/community-promo-edit');
  };
  const openMenu = () => post && menu.open({
    type: 'POST', id: post.id,
    author: { userId: post.author.userId, nickname: post.author.nickname },
    mine: post.canEdit, canDelete: post.canDelete,
    onEdit: edit,
    onDeleted: () => router.back(),
    onBlocked: () => router.back(),
  });

  if (!post) {
    return (
      <View style={[ui.screen, { paddingTop: insets.top }]}>
        <CommunityHeader title="" />
        <CenterMessage loading={!error} message={error ?? ''} onRetry={error && error !== '볼 수 없는 글이에요.' ? load : undefined} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title={BOARD_NAME[post.board]} right={<HeaderButton icon="ellipsis-horizontal" label="메뉴" onPress={openMenu} />} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, { paddingBottom: post.canComment ? 24 : insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {post.board === 'PROMO' && post.organization && (
          <View style={styles.org}>
            {post.organization.logo ? <Image source={{ uri: post.organization.logo }} style={styles.orgLogo} /> : (
              <View style={[styles.orgLogo, styles.orgPlaceholder]}><Ionicons name="business-outline" size={18} color="white" /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.orgName}>{post.organization.name}</Text>
              <Text style={ui.meta}>교육단체 · 수정 {timeAgo(post.updatedAt)}</Text>
            </View>
          </View>
        )}
        <Text style={styles.title}>{post.title}</Text>
        {post.board !== 'PROMO' && (
          <AuthorLine size="large" author={post.author} meta={timeAgo(post.createdAt)} onPress={() => openUser(post.author.userId)} />
        )}

        <View style={styles.body}>
          {post.board === 'ESSAY' && post.body && <EssayBody body={post.body} onOpenImage={url => setViewer({ images: [url], index: 0 })} />}
          {post.board === 'FREE' && (
            <>
              <MentionText text={post.content ?? ''} mentions={post.mentions} style={styles.text} onOpenUser={openUser} />
              {post.imageUrl && (
                <Pressable onPress={() => setViewer({ images: [post.imageUrl!], index: 0 })} accessibilityLabel="사진 크게 보기">
                  <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="cover" />
                </Pressable>
              )}
              {!!post.tags.length && (
                <View style={styles.tags}>
                  {post.tags.map(tag => (
                    <Pressable key={tag} onPress={() => router.push({ pathname: '/community-posts', params: { board: 'FREE', tag } })} hitSlop={4}>
                      <Text style={ui.tag}>#{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          {post.board === 'PROMO' && post.images.map((url, index) => (
            <Pressable key={url} onPress={() => setViewer({ images: post.images, index })} accessibilityLabel={`홍보 이미지 ${index + 1} 크게 보기`}>
              <PromoImage url={url} />
            </Pressable>
          ))}
          {post.board === 'PROMO' && (post.organization?.address || post.organization?.phone) && (
            <View style={[ui.card, styles.orgInfo]}>
              {!!post.organization?.address && <Text style={styles.orgInfoText}>📍 {post.organization.address}</Text>}
              {!!post.organization?.phone && <Text style={styles.orgInfoText}>☎ {post.organization.phone}</Text>}
            </View>
          )}
        </View>

        <View style={styles.reactions}>
          <LikeButton liked={post.liked} count={post.likeCount} onPress={toggleLike} />
          {post.canComment && <Text style={styles.commentCount}>댓글 {commentCount}</Text>}
        </View>

        {post.canComment && (
          <CommentList threads={threads} onOpenUser={openUser} onChanged={loadComments}
            onReply={comment => setReplyTo(comment)} onMenu={menu.open} />
        )}
      </ScrollView>
      {post.canComment && (
        <CommentInput postId={post.id} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} bottomInset={insets.bottom}
          onSent={() => { setReplyTo(null); void loadComments().then(() => setTimeout(() => scroll.current?.scrollToEnd(), 150)); }} />
      )}
      {viewer && <ImageViewer images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} />}
      {menu.element}
    </KeyboardAvoidingView>
  );
}

// 홍보 이미지: 폭 가득, 원본 비율 그대로 (잘림 없음)
function PromoImage({ url }: { url: string }) {
  const [ratio, setRatio] = useState(4 / 3);
  return <Image source={{ uri: url }} style={[styles.promoImage, { aspectRatio: ratio }]} resizeMode="cover"
    onLoad={e => { const { width, height } = e.nativeEvent.source; if (width && height) setRatio(width / height); }} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIDE, paddingTop: 8, gap: 14 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 22, lineHeight: 30, color: 'white' },
  body: { gap: 14, paddingTop: 4 },
  text: { fontFamily: 'SUIT-Regular', fontSize: 16, lineHeight: 26, color: 'white' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  org: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgLogo: { width: 40, height: 40, borderRadius: 20 },
  orgPlaceholder: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  orgName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
  orgInfo: { padding: 14, gap: 6 },
  orgInfoText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  promoImage: { width: '100%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  reactions: {
    flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 12, marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.2)',
  },
  commentCount: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
});
