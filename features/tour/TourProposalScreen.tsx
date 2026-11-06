import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import BottomSheet from '@/components/BottomSheet';
import CertificateImageViewer from '@/components/CertificateImageViewer';
import ProfileAvatar from '@/components/ProfileAvatar';
import { CenterMessage } from '@/features/community/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api, type TourProposalDetail } from '@/services/api';
import { TourHeader } from './FormParts';
import { Badge } from './TourCards';
import { PROPOSAL_STATUS, formatFee } from './ui';
import { profileHref, TOURS_CHANGED, useTourRouter } from './nav';

const SIDE = 20;

// 9장 제안 보기: 투어 상세와 같은 모양 (인솔 강사 · 참가비 · 포함/불포함 · 소개 이미지 · 문의하기).
// 등록자: '이 제안 승낙' · 제안한 강사: 제안 수정 · 제안 취소 (승낙 전까지)
export default function TourProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [p, setP] = useState<TourProposalDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [linkSheet, setLinkSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api.getTourProposal(Number(id)));
      setState('ready');
    } catch {
      setState(prev => (prev === 'ready' ? prev : 'error'));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOURS_CHANGED, () => { void load(); });
    return () => sub.remove();
  }, [load]);

  const run = async (task: () => Promise<unknown>, done: [string, string], back = false) => {
    setBusy(true);
    try {
      await task();
      DeviceEventEmitter.emit(TOURS_CHANGED);
      Alert.alert(done[0], done[1], [{ text: '확인', onPress: () => (back ? router.back() : undefined) }]);
    } catch (e: any) {
      if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      void load();
    } finally {
      setBusy(false);
    }
  };
  const accept = () => p && Alert.alert(`${p.instructor.nickname}님의 제안을 승낙할까요?`,
    "승낙하면 투어가 '모집 마감'되고 이 제안이 투어 정보가 돼요. 다른 제안은 자동으로 마감되고 참여자 모두에게 알림이 가요.",
    [{ text: '취소', style: 'cancel' }, { text: '승낙', onPress: () => void run(() => api.acceptTourProposal(p.id), ['모집이 마감됐어요', `${p.instructor.nickname}님이 인솔 강사가 됐어요.`], true) }]);
  const withdraw = () => p && Alert.alert('제안을 취소할까요?', '등록자의 받은 제안 목록에서 빠져요.',
    [{ text: '닫기', style: 'cancel' }, { text: '제안 취소', style: 'destructive', onPress: () => void run(() => api.withdrawTourProposal(p.id), ['제안을 취소했어요', '같은 투어에 다시 제안할 수 있어요.'], true) }]);
  const openLink = (url: string) => Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url));

  if (state !== 'ready' || !p) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <TourHeader title="제안 보기" onBack={() => router.back()} />
        <CenterMessage loading={state === 'loading'} message="제안을 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }
  const active = p.status === 'WAITING' || p.status === 'HELD';
  const images = [...p.images.slice(p.coverIndex), ...p.images.slice(0, p.coverIndex)];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TourHeader title="제안 보기" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable accessibilityRole="link" onPress={() => router.push(profileHref(p.instructor.userId, user?.id))} style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}>
          <ProfileAvatar profileImage={p.instructor.profileImage} nickname={p.instructor.nickname} level={p.instructor.badgeLevel} />
          <View style={styles.personBody}>
            <Text style={styles.personName} numberOfLines={1}>{p.instructor.nickname}{p.instructor.name ? ` (${p.instructor.name})` : ''}</Text>
            <Text style={styles.personMeta} numberOfLines={1}>{[...p.instructor.licenses.slice(0, 1), `진행한 투어 ${p.instructor.ledCount}`].join('  ·  ')}</Text>
          </View>
          <Badge {...PROPOSAL_STATUS[p.status]} />
        </Pressable>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.fee}>{formatFee(p.fee)} <Text style={styles.feeUnit}>/ 1인</Text></Text>
        {p.message ? <View style={styles.box}><Text style={styles.boxText}>“{p.message}”</Text></View> : null}
        {p.status === 'HELD' ? <Text style={styles.held}>참여자가 빠져 인원을 다시 모으는 중이에요. 다 모이면 다시 승낙을 기다려요.</Text> : null}
        {p.included.length ? <Items title="포함 사항" mark="✓" items={p.included} /> : null}
        {p.excluded.length ? <Items title="불포함 사항" mark="✕" items={p.excluded} /> : null}
        <Text style={styles.sectionTitle}>소개 이미지 {p.images.length}</Text>
        <View style={styles.images}>
          {images.map(uri => (
            <Pressable key={uri} onPress={() => setViewing(uri)} accessibilityRole="imagebutton" accessibilityLabel="소개 이미지 크게 보기">
              <Image source={{ uri }} style={styles.image} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {p.links.length ? (
          <Pressable accessibilityRole="button" onPress={() => (p.links.length === 1 ? void openLink(p.links[0].url) : setLinkSheet(true))} style={({ pressed }) => [styles.sub, pressed && { opacity: 0.7 }]}>
            <Text style={styles.subText}>문의하기</Text>
          </Pressable>
        ) : null}
        {p.canAccept ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={accept} style={({ pressed }) => [styles.main, (pressed || busy) && { opacity: 0.7 }]}>
            {busy ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.mainText}>이 제안 승낙</Text>}
          </Pressable>
        ) : null}
        {p.isMine && active ? (
          <>
            <Pressable accessibilityRole="button" disabled={busy} onPress={withdraw} style={({ pressed }) => [styles.danger, (pressed || busy) && { opacity: 0.7 }]}>
              <Text style={styles.dangerText}>제안 취소</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push({ pathname: '/tour-propose', params: { proposalId: String(p.id) } })}
              style={({ pressed }) => [styles.main, (pressed || busy) && { opacity: 0.7 }]}>
              <Text style={styles.mainText}>제안 수정</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {viewing ? <CertificateImageViewer imageUrl={viewing} onClose={() => setViewing(null)} /> : null}
      <BottomSheet visible={linkSheet} onClose={() => setLinkSheet(false)} title="문의하기" fitContent onSelect={url => void openLink(url)}
        items={p.links.map(link => ({ label: link.name, value: link.url, icon: 'link' as const }))} />
    </View>
  );
}

function Items({ title, mark, items }: { title: string; mark: string; items: string[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={`${i}-${item}`} style={styles.item}>
          <Text style={[styles.itemMark, mark === '✕' && { color: '#FF8A7A' }]}>{mark}</Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  scroll: { paddingHorizontal: SIDE, paddingBottom: 24 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  personBody: { flex: 1, gap: 3 },
  personName: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  personMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  title: { marginTop: 20, fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white },
  fee: { marginTop: 6, fontFamily: 'SUIT-Bold', fontSize: 17, color: '#00E5FF' },
  feeUnit: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  box: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.8)' },
  boxText: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: '#B8D4F0' },
  held: { marginTop: 12, fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 19, color: '#FFB4A2' },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginTop: 24, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  itemMark: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF', width: 14, textAlign: 'center' },
  itemText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  images: { gap: 10 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  bottom: { flexDirection: 'row', gap: 10, paddingHorizontal: SIDE, paddingTop: 10 },
  main: { flex: 1.4, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  mainText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  sub: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  subText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  danger: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#023E73' },
  dangerText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FF8A75' },
});
