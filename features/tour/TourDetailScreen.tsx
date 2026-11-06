import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Linking, Alert, Platform, Share, TextInput, DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourDetail } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import BottomSheet from '@/components/BottomSheet';
import CertificateImageViewer from '@/components/CertificateImageViewer';
import GlassCircle from '@/components/GlassCircle';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import ProfileAvatar from '@/components/ProfileAvatar';
import StripBackSlot from '@/components/StripBackSlot';
import { useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { Badge, StatusBadge, TourEmpty } from './TourCards';
import { AFTER_SHEET_MS, CYAN, LAVENDER, STYLE_LABEL, formatFee, formatStay, formatTourPeriod, shareContent } from './ui';
import { changedLabels, EditPayload, withEdit } from './edit';
import { regionName, useTourRegions } from './useTourRegions';
import { confirmApprove, sendRevision } from './requests';
import ReviewNotePopup from './ReviewNotePopup';
import TourReportPopup, { ReportReason } from './TourReportPopup';
import { Buttons, Popup } from './Popup';
import { profileHref, TOURS_CHANGED, useTourRouter } from './nav';
import { TOUR_FORM_LIMITS } from './tourForm';

const SIDE = 20;
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

// 6장 투어 상세: 맨 위 등록자(인솔자가 있으면 인솔 강사), 투어 정보 · 참여자 · 사진, 하단 고정 버튼
// (참여 신청 · 신청 취소 · 참여 취소 · 제안하기 · 문의하기 · 등록자의 신청 관리 / 받은 제안 · admin 승인)
export default function TourDetailScreen() {
  const { id, inSheet } = useScreenParams<{ id: string; inSheet?: string }>();
  const router = useTourRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [detail, setDetail] = useState<TourDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading');
  const [viewing, setViewing] = useState<string | null>(null);
  const [linkSheet, setLinkSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [revising, setRevising] = useState(false);
  const { continents, countries } = useTourRegions();
  const request = useLatestRequest();

  const load = useCallback(async (quiet = false) => {
    const isCurrent = request.start();
    if (!quiet) setState('loading');
    try {
      const data = await api.getTour(Number(id));
      if (!isCurrent()) return;
      setDetail(data);
      setState('ready');
    } catch (e: any) {
      // 승인 전 · 보완 요청 중 · 만료 · 삭제 · 차단한 사람의 투어 (21장)
      if (isCurrent()) setState(e?.status === 404 ? 'gone' : quiet ? 'ready' : 'error');
    }
  }, [id, request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOURS_CHANGED, () => { void load(true); });
    return () => sub.remove();
  }, [load]);
  const changed = () => DeviceEventEmitter.emit(TOURS_CHANGED);

  const openLink = (url: string) => Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url));
  const inquire = () => {
    if (!detail?.links.length) return;
    if (detail.links.length === 1) void openLink(detail.links[0].url);
    else setLinkSheet(true);
  };

  // '⋯': 공유하기 · 신고하기 (내 투어에서는 공유하기만)
  const canShare = !!detail?.tour.shareUrl;
  const canReport = !!detail?.viewer.canReport;
  const onMenu = (action: 'share' | 'report') => {
    // 메뉴 시트가 다 닫힌 뒤에 열어야 iOS에서 다음 창이 뜸
    if (action === 'share') setTimeout(() => void shareTour(), AFTER_SHEET_MS);
    else setTimeout(() => setReporting(true), AFTER_SHEET_MS);
  };
  const shareTour = async () => {
    if (!detail?.tour.shareUrl) return;
    try { await Share.share(shareContent(detail.tour, detail.tour.shareUrl, Platform.OS)); } catch { /* 사용자가 닫음 */ }
  };
  const submitReport = async (reason: ReportReason, memo: string) => {
    if (!detail) return;
    try {
      await api.reportTour(detail.tour.id, reason, memo);
      setReporting(false);
      Alert.alert('신고가 접수됐어요', '확인 후 조치할게요.');
    } catch (e: any) {
      if (e?.code === 'ALREADY') { setReporting(false); Alert.alert('알림', '이미 신고한 투어예요.'); return; }
      if (!e?._handled) Alert.alert('알림', e?.message ?? '신고하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  // 버튼 동작 공통: 잠그고 → 요청 → 다시 불러옴 (홈 · 목록도 새로)
  const act = async (run: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await run();
      if (done) Alert.alert('알림', done);
      changed();
    } catch (e: any) {
      if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      void load(true);
    } finally {
      setBusy(false);
    }
  };
  const apply = async (message: string) => {
    if (!detail) return;
    await act(() => api.applyTour(detail.tour.id, message), `${detail.registrant.nickname}님이 수락하면 참여가 확정돼요.`);
    setApplying(false);
  };
  const cancelApply = () => Alert.alert('신청을 취소할까요?', undefined, [
    { text: '닫기', style: 'cancel' },
    { text: '신청 취소', style: 'destructive', onPress: () => void act(() => api.cancelTourApplication(detail!.tour.id)) },
  ]);
  const leave = () => Alert.alert('참여를 취소할까요?', '인원이 모자라면 다시 참여자를 모집해요. 등록자에게 알려요.', [
    { text: '닫기', style: 'cancel' },
    { text: '참여 취소', style: 'destructive', onPress: () => void act(() => api.leaveTour(detail!.tour.id)) },
  ]);

  // 17장: admin이 심사 중인 투어를 열면 하단에서 승인 · 보완 요청, 처리 후 목록으로 돌아감
  const approve = async () => {
    const pending = detail?.tour.pendingRequest;
    if (!pending || processing) return;
    setProcessing(true);
    const done = await confirmApprove(pending.id, detail.tour.name, pending.type);
    setProcessing(false);
    if (done) { changed(); router.back(); }
  };
  const revise = async (note: string) => {
    const pending = detail?.tour.pendingRequest;
    if (!pending) return;
    if (await sendRevision(pending.id, note)) { setRevising(false); changed(); router.back(); }
  };

  const header = (
    <View style={styles.header}>
      {isPaneRoot ? <View style={styles.headerSide} /> : (
        <StripBackSlot size={36}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}><Text style={styles.backArrow}>{'<'}</Text></GlassCircle>
          </Pressable>
        </StripBackSlot>
      )}
      <Text style={styles.headerTitle}>투어 상세</Text>
      {canShare || canReport ? (
        <Pressable accessibilityRole="button" accessibilityLabel="더보기" hitSlop={8} onPress={() => setMenu(true)} style={({ pressed }) => [styles.headerSide, styles.more, pressed && { opacity: 0.6 }]}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.brand.white} />
        </Pressable>
      ) : <View style={styles.headerSide} />}
    </View>
  );
  const top = inSheet && Platform.OS === 'ios' ? 10 : insets.top;

  if (state !== 'ready' || !detail) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        {header}
        {state === 'loading' ? (
          <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
        ) : state === 'gone' ? (
          <View style={styles.center}>
            <TourEmpty message="볼 수 없는 투어예요" />
            <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/tour')} style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}>
              <Text style={styles.homeButtonText}>투어 홈으로</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void load()} style={styles.center}>
            <Text style={styles.errorText}>투어를 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // admin이 수정 요청을 심사하면 공개 중인 내용 위에 수정본을 얹어 보여줌
  const reviewingEdit = detail.tour.pendingRequest?.type === 'UPDATE' && detail.tour.editRequest ? detail.tour.editRequest : null;
  const shown = reviewingEdit
    ? withEdit(detail, reviewingEdit.payload as EditPayload, code => regionName([...continents, ...countries], code))
    : detail;
  const { tour, registrant, leader, members, links, viewer } = shown;
  const left = tour.capacity - tour.count;
  const person = leader ?? registrant;
  const open = ['RECRUITING', 'SEEKING_LEADER'].includes(tour.status);
  const photoTitle = leader ? '소개 이미지' : '사진';
  const openProfile = (userId: string) => router.push(profileHref(userId, user?.id));
  const goApplications = () => router.push({ pathname: '/tour-applications', params: { id: String(tour.id) } });
  const goProposals = () => router.push({ pathname: '/tour-proposals', params: { id: String(tour.id) } });

  // 하단 버튼 (상황마다 하나 또는 둘)
  const buttons: { label: string; kind: 'main' | 'sub' | 'danger'; onPress: () => void }[] = [];
  if (tour.isRegistrant) {
    if (tour.status === 'RECRUITING') buttons.push({ label: `참여 신청 ${tour.pendingApplications}`, kind: 'main', onPress: goApplications });
    if (tour.status === 'SEEKING_LEADER') buttons.push({ label: `받은 제안 ${tour.proposalCount}`, kind: 'main', onPress: goProposals });
    if (tour.canEdit && ['PENDING', 'REVISION'].includes(tour.status)) {
      buttons.push({ label: tour.status === 'REVISION' ? '보완 후 재요청' : '수정', kind: 'main', onPress: () => router.push({ pathname: '/tour-register', params: { id: String(tour.id) } }) });
    }
  } else {
    if (viewer.canApply) buttons.push({ label: '참여 신청', kind: 'main', onPress: () => setApplying(true) });
    if (viewer.application?.status === 'PENDING') buttons.push({ label: '신청 취소', kind: 'sub', onPress: cancelApply });
    if (viewer.canLeave) buttons.push({ label: '참여 취소', kind: 'danger', onPress: leave });
    if (viewer.canPropose) buttons.push({ label: '제안하기', kind: 'main', onPress: () => router.push({ pathname: '/tour-propose', params: { id: String(tour.id) } }) });
    if (viewer.proposal) buttons.push({ label: '내 제안 보기', kind: 'sub', onPress: () => router.push({ pathname: '/tour-proposal', params: { id: String(viewer.proposal!.id) } }) });
  }
  // 인솔자가 있는 투어는 '문의하기' (인솔 강사 본인 제외)
  if (leader && !tour.isLeader && links.length) buttons.push({ label: '문의하기', kind: buttons.length ? 'sub' : 'main', onPress: inquire });
  const status = viewer.application?.status === 'PENDING' ? '신청 중이에요. 등록자가 수락하면 참여가 확정돼요.'
    : viewer.application?.status === 'ACCEPTED' ? (tour.status === 'CLOSED' ? '참여가 확정됐어요. 참여 취소는 인솔 강사님께 직접 연락해 주세요.' : '참여가 확정됐어요.')
    : viewer.application?.status === 'REJECTED' ? '이번엔 함께하지 못하게 됐어요.'
    : viewer.application?.status === 'CLOSED' ? '자리가 다 차서 신청이 마감됐어요.'
    : null;

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {reviewingEdit ? (
          <View style={[styles.notice, styles.noticeEdit]}>
            <Text style={styles.noticeText}>등록자가 보낸 수정본이에요. 승인 전까지는 이전 내용이 공개돼요.{'\n'}바뀐 항목: {changedLabels(reviewingEdit.changedFields)}</Text>
          </View>
        ) : null}
        {!tour.isPublic && ['PENDING', 'REVISION'].includes(tour.status) ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{tour.isRegistrant ? '공개 전 미리보기예요. 다른 사람에게는 아직 보이지 않아요.' : '공개 전 투어예요 (관리자 확인용).'}</Text>
          </View>
        ) : null}
        {tour.reviewNote ? (
          <View style={[styles.notice, styles.noticeRevision]}>
            <Text style={styles.noticeTitle}>관리자 보완 요청</Text>
            <Text style={styles.noticeBody}>{tour.reviewNote}</Text>
          </View>
        ) : null}

        {/* 맨 위: 인솔자가 있으면 인솔 강사, 없으면 등록자. 사진을 누르면 프로필 */}
        <Pressable accessibilityRole="link" accessibilityLabel={`${person.nickname} 프로필 보기`} onPress={() => openProfile(person.userId)}
          style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}>
          <ProfileAvatar profileImage={person.profileImage} nickname={person.nickname} level={person.badgeLevel} />
          <View style={styles.personBody}>
            <Text style={styles.personName} numberOfLines={1}>{person.nickname}{person.name ? ` (${person.name})` : ''}</Text>
            <Text style={styles.personMeta} numberOfLines={1}>
              {(leader ? [...leader.licenses.slice(0, 1).map(l => `${l}`), `진행한 투어 ${leader.ledCount}`] : ['등록자', ...registrant.licenses.slice(0, 1)]).join('  ·  ')}
            </Text>
          </View>
          {!leader && tour.status !== 'CLOSED' ? <Badge label="인솔자 구함" color="#023E73" text={LAVENDER} /> : null}
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{tour.name}</Text>
          <StatusBadge status={tour.status} />
        </View>
        <View style={styles.info}>
          <InfoRow label="지역" value={`${tour.continentName} › ${tour.countryName}`} />
          <InfoRow label="기간" value={`${formatTourPeriod(tour.startDate, tour.endDate)} (${formatStay(tour.startDate, tour.endDate)})`} />
          <InfoRow label="형태" value={STYLE_LABEL[tour.tourStyle]} />
          <InfoRow label="모집현황" value={tour.status === 'SEEKING_LEADER' ? `${tour.count}명 모임 (다 참)` : `${tour.count} / ${tour.capacity}명  ·  ${left > 0 ? `${left}자리 남음` : '다 참'}`}
            accent last={!leader} />
          {leader ? <InfoRow label="참가비" value={tour.fee !== null ? formatFee(tour.fee) : '강사에게 문의'} last /> : null}
          {tour.status === 'RECRUITING' ? (
            <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, (tour.count / tour.capacity) * 100)}%` }]} /></View>
          ) : null}
        </View>

        {/* 참여자: 수락된 참여자의 사진 · 닉네임, 등록할 때 모인 인원은 '함께 등록 n명' */}
        <Text style={styles.sectionTitle}>참여자 {tour.count}{tour.companions > 0 ? ` · 함께 등록 ${tour.companions}명` : ''}</Text>
        <View style={styles.members}>
          {(tour.registerRole === 'PARTICIPANT' ? [{ userId: registrant.userId, nickname: registrant.nickname, profileImage: registrant.profileImage }, ...members] : members).map(m => (
            <Pressable key={m.userId} onPress={() => openProfile(m.userId)} style={styles.member} accessibilityLabel={`${m.nickname} 프로필 보기`}>
              <ProfileAvatar profileImage={m.profileImage} nickname={m.nickname} />
              <Text style={styles.memberName} numberOfLines={1}>{m.nickname}</Text>
            </Pressable>
          ))}
          {tour.companions > 0 ? (
            <View style={styles.member}>
              <View style={styles.plus}><Text style={styles.plusText}>+{tour.companions}</Text></View>
              <Text style={styles.memberName} numberOfLines={1}>함께 등록</Text>
            </View>
          ) : null}
        </View>

        {tour.status === 'SEEKING_LEADER' && !tour.isRegistrant ? (
          <View style={styles.box}>
            <Text style={styles.boxText}>받은 제안 {tour.proposalCount}개{'\n'}제안 내용은 등록자만 볼 수 있어요.</Text>
          </View>
        ) : null}
        {tour.status === 'RECRUITING' && !leader ? (
          <View style={styles.box}>
            <Text style={styles.boxText}>인원이 다 모이면 강사님들께 인솔 제안을 요청해요.{'\n'}제안은 등록자가 보고 골라요.</Text>
          </View>
        ) : null}
        {tour.status === 'SEEKING_LEADER' ? <Text style={styles.guide}>출발일까지 제안이 승낙되지 않으면 만료돼요.</Text> : null}

        {tour.included.length > 0 ? <ItemSection title="포함 사항" mark="✓" items={tour.included} /> : null}
        {tour.excluded.length > 0 ? <ItemSection title="불포함 사항" mark="✕" items={tour.excluded} /> : null}

        <Text style={styles.sectionTitle}>{photoTitle} {tour.images.length}</Text>
        <View style={styles.images}>
          {/* 대표 사진부터 */}
          {[...tour.images.slice(tour.coverIndex), ...tour.images.slice(0, tour.coverIndex)].map((uri, index) => (
            <Pressable key={uri} accessibilityRole="imagebutton" accessibilityLabel={`${photoTitle} ${index + 1} 크게 보기`} onPress={() => setViewing(uri)}>
              <FittedImage uri={uri} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {tour.pendingRequest ? (
        <View style={[styles.bottomArea, styles.row, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable accessibilityRole="button" disabled={processing} onPress={() => setRevising(true)} style={({ pressed }) => [styles.reject, pressed && { opacity: 0.7 }]}>
            <Text style={styles.rejectText}>보완 요청</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={processing} onPress={approve} style={({ pressed }) => [styles.approve, pressed && { opacity: 0.8 }]}>
            <Text style={styles.approveText}>승인</Text>
          </Pressable>
        </View>
      ) : buttons.length || status ? (
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {buttons.length ? (
            <View style={styles.row}>
              {buttons.map(b => (
                <Pressable key={b.label} accessibilityRole="button" disabled={busy} onPress={b.onPress}
                  style={({ pressed }) => [b.kind === 'main' ? styles.main : b.kind === 'danger' ? styles.danger : styles.sub, b.kind === 'main' && glassClear, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}>
                  {b.kind === 'main' ? <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} /> : null}
                  <Text style={b.kind === 'main' ? styles.mainText : b.kind === 'danger' ? styles.dangerText : styles.subText}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={tour.name} fitContent onSelect={onMenu}
        items={[...(canShare ? [{ label: '공유하기', value: 'share' }] : []), ...(canReport ? [{ label: '신고하기', value: 'report' }] : [])]} />
      <ReviewNotePopup visible={revising} title="보완 요청" subtitle={`'${tour.name}'에서 보완할 점을 적어 주세요.\n등록자의 내 투어 카드에 그대로 보여요.`}
        onClose={() => setRevising(false)} onSubmit={revise} />
      <TourReportPopup visible={reporting} onClose={() => setReporting(false)} onSubmit={submitReport} />
      <ApplyPopup visible={applying} registrant={registrant.nickname} onClose={() => setApplying(false)} onSubmit={apply} />
      {viewing ? <CertificateImageViewer imageUrl={viewing} onClose={() => setViewing(null)} /> : null}
      <BottomSheet visible={linkSheet} onClose={() => setLinkSheet(false)} title="문의하기" fitContent onSelect={url => void openLink(url)}
        items={links.map(link => ({ label: link.name, value: link.url, icon: 'link' as const }))} />
    </View>
  );
}

// 6장 참여 신청: 한마디(선택 · 100자)와 함께 → 등록자에게 알림
function ApplyPopup({ visible, registrant, onClose, onSubmit }: { visible: boolean; registrant: string; onClose: () => void; onSubmit: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setMessage(''); setBusy(false); } }, [visible]);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { await onSubmit(message.trim()); } finally { setBusy(false); }
  };
  return (
    <Popup visible={visible} title="참여 신청" onClose={onClose}>
      <Text style={styles.popupSub}>등록자 {registrant}님이 수락하면 참여가 확정돼요.</Text>
      <TextInput style={styles.popupInput} value={message} onChangeText={setMessage} multiline maxLength={TOUR_FORM_LIMITS.applyMessageMax}
        placeholder="한마디 (선택) 예) 처음 해외 다이빙이에요! 잘 부탁드려요." placeholderTextColor="rgba(255,255,255,0.3)" accessibilityLabel="한마디" />
      <Text style={styles.popupNote}>내 프로필(자격증 · 다이빙 기록)이 등록자에게 보여요.  {message.trim().length}/{TOUR_FORM_LIMITS.applyMessageMax}</Text>
      <Buttons confirm="신청하기" onCancel={onClose} onConfirm={submit} busy={busy} />
    </Popup>
  );
}

function InfoRow({ label, value, last, accent }: { label: string; value: string; last?: boolean; accent?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: CYAN }]}>{value}</Text>
    </View>
  );
}

function ItemSection({ title, mark, items }: { title: string; mark: string; items: string[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.item}>
          <Text style={[styles.itemMark, mark === '✕' && styles.itemMarkOff]}>{mark}</Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// 폭을 가득 채우고 원래 비율 그대로 (잘림 없음)
function FittedImage({ uri }: { uri: string }) {
  const [aspect, setAspect] = useState(4 / 3);
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => { if (alive && w && h) setAspect(w / h); }, () => {});
    return () => { alive = false; };
  }, [uri]);
  return <Image source={{ uri }} style={[styles.image, { aspectRatio: aspect }]} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  headerSide: { width: 36, height: 36 },
  backCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  more: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  homeButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)' },
  homeButtonText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  scroll: { paddingHorizontal: SIDE, paddingTop: 4, paddingBottom: 24 },
  notice: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(183,148,244,0.18)', marginBottom: 12, gap: 4 },
  noticeEdit: { backgroundColor: 'rgba(0,180,216,0.15)' },
  noticeRevision: { backgroundColor: 'rgba(255,138,117,0.15)' },
  noticeText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 19, color: '#D6C2FF' },
  noticeTitle: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#FFB4A2' },
  noticeBody: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: Colors.brand.white },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  personBody: { flex: 1, gap: 3 },
  personName: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  personMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 12 },
  title: { flex: 1, fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white },
  info: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  infoDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  infoLabel: { width: 64, fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  infoValue: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  bar: { height: 5, borderRadius: 3, backgroundColor: '#0D1B2A', marginBottom: 12, overflow: 'hidden' },
  barFill: { height: 5, backgroundColor: '#00B4D8' },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginTop: 24, marginBottom: 10 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  member: { width: 56, alignItems: 'center', gap: 4 },
  memberName: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', maxWidth: 56 },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#023E73' },
  plusText: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#B8D4F0' },
  box: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.8)' },
  boxText: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 20, color: '#B8D4F0' },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  itemMark: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF', width: 14, textAlign: 'center' },
  itemMarkOff: { color: '#FF8A7A' },
  itemText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  images: { gap: 10 },
  image: { width: '100%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  bottomArea: { paddingHorizontal: SIDE, paddingTop: 10, gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  status: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#B8D4F0', textAlign: 'center' },
  main: { flex: 1.4, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  mainText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  sub: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  subText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  danger: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#023E73' },
  dangerText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FF8A75' },
  reject: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  rejectText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#C53030' },
  approve: { flex: 1.4, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  approveText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#032A36' },
  popupSub: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6, marginBottom: 14 },
  popupInput: {
    minHeight: 96, maxHeight: 160, padding: 12, borderRadius: 12, textAlignVertical: 'top', fontFamily: 'SUIT-Regular', fontSize: 15,
    color: Colors.brand.white, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  popupNote: { marginTop: 8, fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
});
