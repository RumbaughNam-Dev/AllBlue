import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hasStatusSideStrip } from '@/utils/tabBarLayout';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import type { QuestItem } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import ProfileAvatar from '@/components/ProfileAvatar';
import { closeQuests, refreshQuestStatus, requestGamePicker, useQuestStatus, useQuestsOpen } from './store';
import { gradeColor, gradeLabel, gradeOf, XP_PER_LEVEL } from './grade';

// 퀘스트 화면 (설계 6장): 위 등급 · 레벨 막대, 일간 3개 + 올클리어, 주간 2개 + 개근, '하러 가기'로 해당 화면.
// 홈 퀘스트 아이콘을 누르거나, 그날 앱을 새로 켜면 처음 한 번 자동으로 열림. 프친자 Lv 99면 퀘스트 없이 만렙 안내만

function remain(iso: string, now: number) {
  const ms = Math.max(0, Date.parse(iso) - now);
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}일 ${h % 24}시간`;
  return h ? `${h}시간 ${m}분` : `${m}분`;
}

export default function QuestPopup() {
  const open = useQuestsOpen();
  const status = useQuestStatus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // 접은 듀오만 오른쪽 여백(카메라)을 피함, 펼친 화면은 화면 가운데
  const sideRight = hasStatusSideStrip(insets.right, windowWidth, Platform.OS) ? insets.right : 0;
  const { user } = useAuth();
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    setError(false);
    setNow(Date.now());
    refreshQuestStatus().catch(() => setError(true));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const go = (quest: string) => {
    closeQuests();
    if (quest === 'ATTEND') router.push('/community-greetings');
    else if (quest === 'COMMENT' || quest === 'LIKE3') router.navigate('/community');
    else if (quest === 'GAME') { router.navigate('/'); requestGamePicker(); }
    else if (quest === 'SCHEDULE') router.push({ pathname: '/schedule-add', params: { date: '' } });
  };

  const grade = status ? gradeOf(status.totalXp) : null;
  const row = (q: QuestItem, bonus = false) => (
    <View key={q.quest} style={[styles.row, bonus && styles.bonusRow]}>
      {q.done ? <Ionicons name="checkmark-circle" size={18} color="#7FD0A0" /> : <Ionicons name={bonus ? 'gift-outline' : 'ellipse-outline'} size={18} color="rgba(255,255,255,0.5)" />}
      <Text style={[styles.name, q.done && styles.doneText]} numberOfLines={1}>{q.name}</Text>
      <Text style={[styles.xp, q.done && styles.doneText]}>+{q.xp}</Text>
      {q.done ? <Text style={styles.state}>완료</Text>
        : q.progress ? <Text style={styles.state}>{q.progress.count} / {q.progress.goal}{q.quest === 'WEEKLY_ALL' ? '일' : ''}</Text>
        : null}
      {!q.done && !bonus ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${q.name} 하러 가기`} onPress={() => go(q.quest)} hitSlop={6}
          style={({ pressed }) => [styles.go, pressed && { opacity: 0.6 }]}>
          <Text style={styles.goText}>하러 가기</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeQuests} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={closeQuests} accessibilityLabel="퀘스트 닫기"><PopupBackdrop /></Pressable>
      {/* 아이폰 듀오: 오른쪽 여백(안전 영역)을 피해 가운데 (닫기 버튼이 여백 밑으로 가지 않게) */}
      <View style={[styles.center, { paddingLeft: 20 + insets.left, paddingRight: 20 + sideRight, paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>퀘스트</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={closeQuests} hitSlop={10}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </View>
          {!status ? (
            <View style={styles.loading}>
              {error ? <Text style={styles.muted}>퀘스트를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</Text> : <ActivityIndicator color="white" />}
            </View>
          ) : (
            <>
              {/* 위: 프로필 · 경험치는 고정 */}
              <View style={styles.me}>
                <ProfileAvatar userId={user?.id} profileImage={user?.profileImage} nickname={user?.nickname} showLevel={false} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gradeText}>{grade && gradeLabel(grade)}</Text>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${((grade?.xp ?? 0) / XP_PER_LEVEL) * 100}%`, backgroundColor: grade ? gradeColor(grade) === '#FFFFFF' ? '#00E5FF' : gradeColor(grade) : '#00E5FF' }]} />
                  </View>
                  <Text style={styles.muted}>{grade?.xp ?? 0} / {XP_PER_LEVEL}xp</Text>
                </View>
              </View>
              {status.maxed ? (
                <View style={styles.maxed}>
                  <Text style={styles.maxedTitle}>만렙 프친자시네요!</Text>
                  <Text style={styles.muted}>프친자 Lv 99를 꽉 채웠어요. 더 이상 진행할 퀘스트가 없어요.</Text>
                </View>
              ) : (
                <>
                  {/* 가운데: 일간 · 주간 퀘스트만 스크롤 */}
                  <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 2 }} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.section, { marginTop: 4 }]}>일간 퀘스트 · 초기화까지 {remain(status.daily.resetAt, now)}</Text>
                    {status.daily.quests.map(q => row(q))}
                    {row(status.daily.bonus, true)}
                    <Text style={styles.section}>주간 퀘스트 · 월요일 0시 초기화</Text>
                    {status.weekly.quests.map(q => row(q))}
                    {row(status.weekly.bonus, true)}
                  </ScrollView>
                  {/* 아래: 안내는 고정 */}
                  <Text style={styles.hint}>{'출석체크는 커뮤니티 출석인사에 한마디 남기면 돼요.\n남의 글 좋아요는 서로 다른 글 3개예요.'}</Text>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '86%', backgroundColor: Colors.brand.primary, borderRadius: 22, padding: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 20, color: 'white' },
  loading: { paddingVertical: 40, alignItems: 'center' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8, paddingLeft: 4, marginBottom: 6 },
  gradeText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'white', marginBottom: 6 },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginBottom: 4 },
  barFill: { height: 8, borderRadius: 4 },
  section: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 14, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 12, minHeight: 44, marginBottom: 6,
  },
  bonusRow: { backgroundColor: 'rgba(0,0,0,0.15)' },
  name: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'white' },
  xp: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#00E5FF' },
  state: { fontFamily: 'SUIT-Medium', fontSize: 12, color: 'rgba(255,255,255,0.6)', minWidth: 30, textAlign: 'right' },
  doneText: { color: 'rgba(255,255,255,0.4)' },
  go: { backgroundColor: 'rgba(255,212,59,0.18)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  goText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: '#FFD43B' },
  muted: { fontFamily: 'SUIT-Medium', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  list: { flexGrow: 0, flexShrink: 1, marginTop: 6 },
  hint: { fontFamily: 'SUIT-Medium', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 10, lineHeight: 17 },
  maxed: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  maxedTitle: { fontFamily: 'SUIT-Bold', fontSize: 20, color: '#40C057' },
});
