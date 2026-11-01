import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Linking, Alert, Platform, Share, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api, TourDetail } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import CertificateImageViewer from '@/components/CertificateImageViewer';
import GlassCircle from '@/components/GlassCircle';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import ProfileAvatar from '@/components/ProfileAvatar';
import ProfileLink from '@/components/ProfileLink';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { StatusBadge, TourEmpty } from './TourCards';
import { formatFee, formatStay, formatTourPeriod, shareContent } from './ui';
import { confirmApprove, sendRevision } from './requests';
import ReviewNotePopup from './ReviewNotePopup';
import TourReportPopup, { ReportReason } from './TourReportPopup';
import { Ionicons } from '@expo/vector-icons';

const SIDE = 20;
const AFTER_SHEET_MS = 600;
// Main actions stay white (prominent glass) so the navy label keeps its contrast.
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

// 11장 투어 상세: 맨 위 인솔 강사, 아래로 투어 정보 · 포함/불포함 · 소개 이미지, 하단 고정 '문의하기'.
export default function TourDetailScreen() {
  // inSheet: 프로필 시트 안(관리자 기능 → 투어 등록요청)에서 열림 → 시트 위쪽 여백만
  const { id, inSheet } = useScreenParams<{ id: string; inSheet?: string }>();
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<TourDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading');
  const [viewing, setViewing] = useState<string | null>(null);
  const [linkSheet, setLinkSheet] = useState(false);
  const request = useLatestRequest();

  const load = useCallback(async () => {
    const isCurrent = request.start();
    setState('loading');
    try {
      const data = await api.getTour(Number(id));
      if (!isCurrent()) return;
      setDetail(data);
      setState('ready');
    } catch (e: any) {
      // 승인 전 · 불허 · 시작일 지남 · 삭제 · 차단한 강사의 투어 (24장)
      if (isCurrent()) setState(e?.status === 404 ? 'gone' : 'error');
    }
  }, [id, request]);
  useEffect(() => { void load(); }, [load]);

  const openLink = (url: string) => Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url));
  // 링크가 하나면 바로 열고, 여러 개면 목록에서 고르기
  const inquire = () => {
    if (!detail?.links.length) return;
    if (detail.links.length === 1) void openLink(detail.links[0].url);
    else setLinkSheet(true);
  };

  // '⋯': 공유하기(24장) · 신고하기 · 강사 차단(19장). 내 투어에서는 공유하기만
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const canShare = !!detail?.tour.shareUrl;
  const canReport = !!detail && detail.tour.isPublic && !detail.tour.isMine;
  const onMenu = (action: 'share' | 'report' | 'block') => {
    if (!detail) return;
    if (action === 'share') { setTimeout(() => void shareTour(), AFTER_SHEET_MS); return; }
    // 메뉴 시트가 다 닫힌 뒤에 열어야 iOS에서 다음 창이 뜸 (시트 닫힘 애니메이션 250ms + 모달 내림)
    if (action === 'report') { setTimeout(() => setReporting(true), AFTER_SHEET_MS); return; }
    const name = detail.instructor.nickname;
    setTimeout(() => Alert.alert(`${name}님을 차단할까요?`, '차단하면 이 강사의 투어가 내 화면에서 모두 안 보여요.\n차단 목록에서 언제든 풀 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단', style: 'destructive', onPress: async () => {
          try {
            await api.blockUser(detail.instructor.userId);
            Alert.alert('차단했어요', undefined, [{ text: '확인', onPress: () => router.back() }]);
          } catch (e: any) { if (!e?._handled) Alert.alert('알림', e?.message ?? '차단하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
        },
      },
    ]), AFTER_SHEET_MS);
  };
  // 휴대폰 공유 창: 투어명 · 나라 · 기간 + 링크 (가격 · 모집현황은 링크를 연 화면에서 최신으로)
  const shareTour = async () => {
    if (!detail?.tour.shareUrl) return;
    try {
      await Share.share(shareContent(detail.tour, detail.tour.shareUrl, Platform.OS));
    } catch { /* 사용자가 닫음 */ }
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

  // 15장: admin이 심사 중인 투어를 열면 하단에서 승인 · 불허, 처리 후 목록으로 돌아감
  const [processing, setProcessing] = useState(false);
  const [revising, setRevising] = useState(false);
  const approve = async () => {
    const pending = detail?.tour.pendingRequest;
    if (!pending || processing) return;
    setProcessing(true);
    const done = await confirmApprove(pending.id, detail.tour.title);
    setProcessing(false);
    if (done) router.back();
  };
  const revise = async (note: string) => {
    const pending = detail?.tour.pendingRequest;
    if (!pending) return;
    if (await sendRevision(pending.id, note)) { setRevising(false); router.back(); }
  };

  const header = (
    <View style={styles.header}>
      {isPaneRoot ? <View style={styles.backButton} /> : (
        <StripBackSlot size={36}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
      )}
      <Text style={styles.headerTitle}>투어 상세</Text>
      {canShare || canReport ? (
        <Pressable accessibilityRole="button" accessibilityLabel="더보기" hitSlop={8} onPress={() => setMenu(true)} style={({ pressed }) => [styles.backButton, styles.more, pressed && { opacity: 0.6 }]}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.brand.white} />
        </Pressable>
      ) : <View style={styles.backButton} />}
    </View>
  );

  if (state !== 'ready' || !detail) {
    return (
      <View style={[styles.container, { paddingTop: inSheet && Platform.OS === 'ios' ? 10 : insets.top }]}>
        {header}
        {state === 'loading' ? (
          <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
        ) : state === 'gone' ? (
          <View style={styles.center}>
            <TourEmpty message="볼 수 없는 투어예요" />
            {/* 24장: 공유 링크로 들어왔는데 승인 전 · 불허 · 출발 · 삭제 · 차단한 강사의 투어 */}
            <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/tour')} style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}>
              <Text style={styles.homeButtonText}>투어 홈으로</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={load} style={styles.center}>
            <Text style={styles.errorText}>투어를 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { tour, instructor, links } = detail;
  const remaining = tour.capacity - tour.recruitedCount;

  return (
    <View style={[styles.container, { paddingTop: inSheet && Platform.OS === 'ios' ? 10 : insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!tour.isPublic && (
          <View style={styles.preview}>
            <Text style={styles.previewText}>{tour.isMine ? '공개 전 미리보기예요. 다른 사람에게는 아직 보이지 않아요.' : '공개 전 투어예요 (관리자 확인용).'}</Text>
          </View>
        )}

        {/* 인솔 강사: 사진을 누르면 다른 화면과 같은 프로필 */}
        <ProfileLink userId={instructor.userId} label={instructor.nickname} style={styles.instructor}>
          <ProfileAvatar profileImage={instructor.profileImage} nickname={instructor.nickname} level={instructor.badgeLevel} />
          <View style={styles.instructorBody}>
            <Text style={styles.instructorName} numberOfLines={1}>
              {instructor.nickname}{instructor.name ? ` (${instructor.name})` : ''}
            </Text>
            <Text style={styles.instructorMeta} numberOfLines={1}>
              {['인솔 강사', ...instructor.licenses].join('  ·  ')}
            </Text>
          </View>
          <Text style={styles.completed}>투어 완료 {instructor.completedCount}회</Text>
        </ProfileLink>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{tour.title}</Text>
          <StatusBadge status={tour.status} />
        </View>

        <View style={styles.info}>
          <InfoRow label="지역" value={`${tour.continentName} › ${tour.countryName}`} />
          <InfoRow label="투어 기간" value={`${formatTourPeriod(tour.startDate, tour.endDate)} (${formatStay(tour.startDate, tour.endDate)})`} />
          <InfoRow label="모집현황" value={`${tour.recruitedCount} / ${tour.capacity}명  ·  ${remaining > 0 ? `${remaining}자리 남음` : '자리 없음'}`} />
          <InfoRow label="참가비" value={tour.fee !== null ? formatFee(tour.fee) : '강사에게 문의'} last />
        </View>

        {tour.included.length > 0 && <ItemSection title="포함 사항" mark="✓" items={tour.included} />}
        {tour.excluded.length > 0 && <ItemSection title="불포함 사항" mark="✕" items={tour.excluded} />}

        <Text style={styles.sectionTitle}>소개 이미지</Text>
        <View style={styles.images}>
          {tour.images.map((uri, index) => (
            <Pressable key={uri} accessibilityRole="imagebutton" accessibilityLabel={`소개 이미지 ${index + 1} 크게 보기`} onPress={() => setViewing(uri)}>
              <FittedImage uri={uri} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {tour.pendingRequest ? (
      <View style={[styles.bottomArea, styles.reviewArea, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable accessibilityRole="button" disabled={processing} onPress={() => setRevising(true)} style={({ pressed }) => [styles.reject, pressed && { opacity: 0.7 }]}>
          <Text style={styles.rejectText}>보완 요청</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={processing} onPress={approve} style={({ pressed }) => [styles.approve, pressed && { opacity: 0.8 }]}>
          <Text style={styles.approveText}>승인</Text>
        </Pressable>
      </View>
      ) : (
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !links.length }}
          disabled={!links.length}
          onPress={inquire}
          style={({ pressed }) => [styles.inquire, glassClear, pressed && { opacity: 0.85 }, !links.length && { opacity: 0.45 }]}
        >
          <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
          <Text style={styles.inquireText}>문의하기</Text>
        </Pressable>
        {!links.length && <Text style={styles.noLink}>강사가 아직 문의 링크를 등록하지 않았어요</Text>}
      </View>
      )}

      <BottomSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={tour.title}
        items={[
          ...(canShare ? [{ label: '공유하기', value: 'share' }] : []),
          ...(canReport ? [{ label: '신고하기', value: 'report' }, { label: `이 강사 차단하기 (${instructor.nickname})`, value: 'block' }] : []),
        ]}
        fitContent
        onSelect={onMenu}
      />
      <ReviewNotePopup
        visible={revising}
        title="보완 요청"
        subtitle={`'${tour.title}'에서 보완할 점을 적어 주세요.\n강사의 투어 관리 카드에 그대로 보여요.`}
        onClose={() => setRevising(false)}
        onSubmit={revise}
      />
      <TourReportPopup visible={reporting} onClose={() => setReporting(false)} onSubmit={submitReport} />
      {viewing && <CertificateImageViewer imageUrl={viewing} onClose={() => setViewing(null)} />}
      <BottomSheet
        visible={linkSheet}
        onClose={() => setLinkSheet(false)}
        title="문의하기"
        items={links.map(link => ({ label: link.name, value: link.url, icon: 'link' as const }))}
        fitContent
        onSelect={url => void openLink(url)}
      />
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

// 등록한 순서대로 세로로 이어서, 화면 폭에 맞춘 원래 비율로
function FittedImage({ uri }: { uri: string }) {
  const { width: windowWidth } = useWindowDimensions();
  const [ratio, setRatio] = useState(3 / 4);
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => { if (alive && w && h) setRatio(h / w); }, () => {});
    return () => { alive = false; };
  }, [uri]);
  return <Image source={{ uri }} style={[styles.image, { height: Math.round((windowWidth - SIDE * 2) * ratio) }]} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  scroll: { paddingHorizontal: SIDE, paddingTop: 4, paddingBottom: 24 },
  preview: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(183,148,244,0.18)', marginBottom: 12 },
  previewText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#D6C2FF' },
  instructor: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  instructorBody: { flex: 1, gap: 3 },
  instructorName: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  instructorMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  completed: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: '#00E5FF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 12 },
  title: { flex: 1, fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white },
  info: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  infoDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  infoLabel: { width: 64, fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  infoValue: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginTop: 24, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  itemMark: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF', width: 14, textAlign: 'center' },
  itemMarkOff: { color: '#FF8A7A' },
  itemText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  images: { gap: 10 },
  image: { width: '100%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  bottomArea: { paddingHorizontal: SIDE, paddingTop: 10, gap: 6 },
  more: { alignItems: 'center', justifyContent: 'center' },
  homeButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)' },
  homeButtonText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  reviewArea: { flexDirection: 'row', gap: 10 },
  reject: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  rejectText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#C53030' },
  approve: { flex: 1.4, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  approveText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#032A36' },
  inquire: {
    height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brand.white,
  },
  inquireText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  noLink: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
});
