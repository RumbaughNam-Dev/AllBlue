import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useAppRouter, useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { api, type BuddyPerson, type BuddyPostDetail } from '@/services/api';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import Spinner from '@/components/Spinner';
import ProfileAvatar from '@/components/ProfileAvatar';
import ProfileLink from '@/components/ProfileLink';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import LinksPopup from '@/components/LinksPopup';
import PopupBackdrop from '@/components/PopupBackdrop';

// 캘린더 '버디 찾기' 상세 (2026-11-23).
// 남이 만든 모집: 참가 신청 · 신청 취소 · 문의(만든 사람 프로필 링크). 마감되거나 다이빙 시각이 지나면 신청 · 문의 버튼이 사라짐
// 내가 만든 모집: 신청을 승인/거절(트레이닝 · 초대 카드와 같은 모양), '모집 마감'을 누르면 그 정보로 펀다이빙 일정이 만들어짐
export default function BuddyDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const { id } = useScreenParams<{ id: string }>();
  const request = useLatestRequest();
  const [post, setPost] = useState<BuddyPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);

  const load = useCallback((showLoading = true) => {
    if (!id) return;
    const isCurrent = request.start();
    if (showLoading) setLoading(true);
    api.getBuddyPost(Number(id))
      .then((res) => { if (isCurrent()) setPost(res.post); })
      .catch((e) => {
        if (!isCurrent()) return;
        setPost(null);
        if (!e._handled) Alert.alert('알림', e.message ?? '모집 글을 불러오지 못했어요.');
      })
      .finally(() => { if (isCurrent()) setLoading(false); });
  }, [id, request]);
  useEffect(() => { load(); return () => request.invalidate(); }, [load, request]);
  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const run = async (task: () => Promise<unknown>, failTitle: string, after?: (result: any) => void) => {
    if (busy) return;
    setBusy(true);
    try { const result = await task(); after?.(result); load(false); }
    catch (e: any) { if (!e._handled) Alert.alert(failTitle, e.message ?? '잠시 후 다시 시도해주세요.'); load(false); }
    finally { setBusy(false); }
  };
  const openSchedule = (scheduleId: number) => router.push({ pathname: '/schedule-detail', params: { id: String(scheduleId) } });
  const afterClose = (result: { scheduleId?: number; closed?: boolean }) => {
    if (!result?.scheduleId) return;
    Alert.alert('모집 마감', '함께하기로 한 버디와 다이빙 일정이 만들어졌어요.', [
      { text: '닫기', style: 'cancel' },
      { text: '일정 보기', onPress: () => openSchedule(result.scheduleId!) },
    ]);
  };

  const apply = () => post && Alert.alert('참가 신청', `${post.title}\n\n함께 가고 싶다고 신청할까요? 만든 사람이 승인하면 확정돼요.`, [
    { text: '취소', style: 'cancel' },
    { text: '신청할게요', onPress: () => run(() => api.applyBuddy(post.id), '신청 실패') },
  ]);
  const cancel = () => post && Alert.alert('신청 취소', '참가 신청을 취소할까요?', [
    { text: '아니요', style: 'cancel' },
    { text: '취소할게요', style: 'destructive', onPress: () => run(() => api.cancelBuddy(post.id), '취소 실패') },
  ]);
  const decide = (p: BuddyPerson, action: 'accept' | 'deny') => {
    if (!post) return;
    if (action === 'accept') {
      const last = post.acceptedCount + 1 >= post.maxMembers;
      const go = () => run(() => api.decideBuddy(post.id, p.id, 'accept'), '요청 처리 실패', afterClose);
      if (!last) return go();
      return Alert.alert('신청 승인', `${p.nickname}님을 승인하면 모집 인원이 다 차서 마감되고, 함께하는 버디와 다이빙 일정이 만들어져요.`, [
        { text: '취소', style: 'cancel' }, { text: '승인', onPress: go },
      ]);
    }
    Alert.alert('신청 거절', `${p.nickname}님의 신청을 거절할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '거절', style: 'destructive', onPress: () => run(() => api.decideBuddy(post.id, p.id, 'deny'), '요청 처리 실패') },
    ]);
  };
  const close = () => {
    setMenuVisible(false);
    if (!post) return;
    Alert.alert('모집 마감', `지금 마감하면 함께하기로 한 ${post.acceptedCount}명과 다이빙 일정이 만들어지고, 기다리는 신청은 닫혀요. 마감한 뒤에는 일정 수정으로 사람을 더할 수 있어요.`, [
      { text: '취소', style: 'cancel' },
      { text: '마감', onPress: () => run(() => api.closeBuddy(post.id), '마감 실패', afterClose) },
    ]);
  };
  const remove = () => {
    setMenuVisible(false);
    if (!post) return;
    Alert.alert('삭제', '이 버디 찾기 모집을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try { await api.deleteBuddyPost(post.id); router.back(); }
        catch (e: any) { if (!e._handled) Alert.alert('삭제 실패', e.message ?? '잠시 후 다시 시도해주세요.'); }
      } },
    ]);
  };
  const inquire = () => {
    if (!post?.author.links.length) { Alert.alert('문의', '만든 사람이 프로필에 연락 링크를 등록하지 않았어요.'); return; }
    setContactVisible(true);
  };

  const statusText = !post ? '' : post.status === 'CLOSED' ? '모집 마감' : post.expired ? '지난 모집' : post.isFull ? '인원 다 참' : '모집 중';
  const date = post ? (() => {
    const d = new Date(`${post.diveDate}T00:00:00`);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(post.startHour).padStart(2, '0')}:${String(post.startMinute).padStart(2, '0')}`;
  })() : '';
  // 아래쪽 버튼: 남의 모집은 문의 + (참가 신청 | 신청 취소), 내 모집은 '모집 마감'. 마감 · 지난 모집이면 없음
  const showBottom = !!post && (post.isOwner ? post.canManage : (post.canInquire && post.myStatus !== 'ACCEPTED') || post.myStatus === 'APPLIED');

  const PersonRow = ({ p, children }: { p: BuddyPerson; children?: React.ReactNode }) => (
    <View style={styles.personCard}>
      <View style={styles.personHeader}>
        <ProfileLink userId={p.userId} label={p.nickname}>
          <ProfileAvatar userId={p.userId} profileImage={p.profileImage} nickname={p.nickname} level={p.badgeLevel ?? p.level} />
        </ProfileLink>
        <ProfileLink userId={p.userId} label={p.nickname} style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.personName} numberOfLines={1}>{p.nickname}{p.name && p.name !== p.nickname ? ` (${p.name})` : ''}</Text>
        </ProfileLink>
      </View>
      {children}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {isPaneRoot ? <View style={styles.circleSlot} /> : (
          <StripBackSlot size={36}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={({ pressed }) => [styles.circleSlot, pressed && { opacity: 0.6 }]}>
              <GlassCircle fallbackStyle={styles.circle}><Text style={styles.backArrow}>{'<'}</Text></GlassCircle>
            </Pressable>
          </StripBackSlot>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>{post?.title ?? '버디 찾기'}</Text>
        {post?.canManage ? (
          <Pressable onPress={() => setMenuVisible(true)} style={({ pressed }) => [styles.circleSlot, pressed && { opacity: 0.6 }]} accessibilityLabel="메뉴">
            <GlassCircle fallbackStyle={styles.circle}><Ionicons name="ellipsis-horizontal" size={18} color={Colors.brand.white} /></GlassCircle>
          </Pressable>
        ) : <View style={styles.circleSlot} />}
      </View>

      {loading ? <View style={styles.center}><Spinner /></View> : !post ? (
        <View style={styles.center}><Text style={styles.empty}>모집 글을 찾을 수 없어요</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>만든 사람</Text>
          <PersonRow p={post.author} />

          <View style={styles.divider} />
          <View style={styles.infoSection}>
            <Info label="상태" value={statusText} highlight={post.status === 'OPEN' && !post.expired} />
            <Info label="일시" value={date} />
            <Info label="장소" value={post.place || '-'} />
            <Info label="찾는 인원" value={`${post.maxMembers}명 (함께 ${post.acceptedCount}명)`} />
            {!!post.content && <Info label="내용" value={post.content} />}
          </View>
          {post.scheduleId != null && (
            <Pressable onPress={() => openSchedule(post.scheduleId!)} style={({ pressed }) => [styles.scheduleLink, pressed && { opacity: 0.6 }]} accessibilityRole="button">
              <Ionicons name="calendar-outline" size={16} color={Colors.brand.accent} />
              <Text style={styles.scheduleLinkText}>만들어진 다이빙 일정 보기</Text>
            </Pressable>
          )}

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>함께하는 버디</Text>
          {post.members.length === 0 ? <Text style={styles.empty}>아직 함께하는 버디가 없어요</Text>
            : post.members.map((m) => <PersonRow key={m.id} p={m} />)}

          {post.isOwner && post.applications.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>참가 신청</Text>
              {post.applications.map((a) => (
                <PersonRow key={a.id} p={a}>
                  <View style={styles.cardSection}>
                    <Text style={styles.invitationStatus}>참가 신청이 왔어요!</Text>
                    {post.canManage && (
                      <View style={styles.actions}>
                        {(['accept', 'deny'] as const).map((action) => (
                          <Pressable key={action} accessibilityRole="button" disabled={busy} onPress={() => decide(a, action)}
                            style={({ pressed }) => [styles.actionButton, action === 'accept' && styles.actionButtonDone, (pressed || busy) && { opacity: 0.5 }]}>
                            <Text style={[styles.actionText, action === 'accept' && styles.actionTextDone]}>{action === 'accept' ? '신청 승인' : '신청 거절'}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </PersonRow>
              ))}
            </>
          )}
          {!post.isOwner && post.myStatus === 'APPLIED' && <Text style={styles.notice}>참가 신청을 보냈어요. 승인을 기다리고 있어요.</Text>}
          {!post.isOwner && post.myStatus === 'DENIED' && <Text style={styles.notice}>이번 모집에는 함께하지 못하게 됐어요.</Text>}
        </ScrollView>
      )}

      {showBottom && post && (
        <View style={styles.bottomBar}>
          {post.isOwner ? (
            <View style={styles.bottomRow}>
              <Pressable onPress={close} disabled={busy} style={({ pressed }) => [styles.primary, (pressed || busy) && { opacity: 0.6 }]} accessibilityRole="button">
                <Text style={styles.primaryText}>모집 마감</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.bottomRow}>
              {post.canInquire && (
                <Pressable onPress={inquire} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]} accessibilityRole="button">
                  <Text style={styles.secondaryText}>문의</Text>
                </Pressable>
              )}
              {post.myStatus === 'APPLIED' ? (
                <Pressable onPress={cancel} disabled={busy} style={({ pressed }) => [styles.secondary, { flex: 2 }, (pressed || busy) && { opacity: 0.6 }]} accessibilityRole="button">
                  <Text style={styles.secondaryText}>신청 취소</Text>
                </Pressable>
              ) : post.canApply ? (
                <Pressable onPress={apply} disabled={busy} style={({ pressed }) => [styles.primary, { flex: 2 }, (pressed || busy) && { opacity: 0.6 }]} accessibilityRole="button">
                  <Text style={styles.primaryText}>참가 신청</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      )}

      <LinksPopup visible={contactVisible} links={post?.author.links ?? []} onClose={() => setContactVisible(false)}
        onOpen={(url) => { Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url)); }} />

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)}>
          <PopupBackdrop />
          <View style={[styles.menu, { top: Platform.OS === 'ios' ? insets.top + 52 : 52, right: 20 + insets.right }]}>
            <MenuItem icon="create-outline" label="수정" onPress={() => { setMenuVisible(false); if (post) router.push({ pathname: '/buddy-edit', params: { id: String(post.id) } }); }} />
            <View style={styles.menuDivider} />
            <MenuItem icon="checkmark-done-outline" label="모집 마감" onPress={close} />
            <View style={styles.menuDivider} />
            <MenuItem icon="trash-outline" label="삭제" danger onPress={remove} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: Colors.brand.accent }]}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
      <Ionicons name={icon} size={20} color={danger ? '#FF6B6B' : Colors.brand.white} accessible={false} />
      <Text style={[styles.menuText, danger && { color: '#FF6B6B' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 20 },
  circleSlot: { width: 36, height: 36 },
  circle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { flex: 1, fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  empty: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20 },
  infoSection: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)', width: 70, marginRight: 12 },
  infoValue: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: Colors.brand.white, flex: 1 },
  scheduleLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(0,180,216,0.15)' },
  scheduleLinkText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.accent },
  personCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14 },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  cardSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 10 },
  invitationStatus: { fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 20, color: '#FFD166' },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 40, justifyContent: 'center', backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionButtonDone: { backgroundColor: 'rgba(52,199,89,0.15)' },
  actionText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning },
  actionTextDone: { color: Colors.brand.success },
  notice: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#FFD166', textAlign: 'center', marginTop: 16 },
  bottomBar: { paddingHorizontal: 24, paddingVertical: 10 },
  bottomRow: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, backgroundColor: Colors.brand.white, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  secondary: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  secondaryText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  menu: { position: 'absolute', backgroundColor: Colors.brand.deep ?? '#022B4A', borderRadius: 12, minWidth: 140, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  menuText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
});
