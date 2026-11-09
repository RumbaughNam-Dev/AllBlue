import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, DeviceEventEmitter, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, type StudentNote } from '@/services/api';
import Spinner from '@/components/Spinner';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import ProfileAvatar from '@/components/ProfileAvatar';
import ProfileLink from '@/components/ProfileLink';
import { useAppRouter, useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { useWindowedList, type Cursor } from '@/features/community/useWindowedList';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { NOTE_MAX, STUDENT_NOTES_CHANGED, noteContext, type StudentNotesChanged } from './studentNotes';

// 한국 날짜 '2026.11.09'
const noteDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '.');

function parseNames(value?: string) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string' && !!name) : [];
  } catch {
    return [];
  }
}

// 강사간 수강생 정보 공유: 일정 상세 교육생 카드에서 열림. 이 수강생을 자기 체험교육 · 자격증 과정 · 트레이닝 일정에
// 넣은 강사끼리만 보고 씀 (서버가 판단). 글마다 쓴 강사 · 날짜 · 쓴 일정(자격증 과정이면 과정 이름)이 남고, 내 글만 고치거나 지움
export default function StudentNotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const params = useScreenParams<{
    studentId: string; scheduleId?: string; profileUserId?: string; studentName?: string;
    scheduleTitle?: string; scheduleDate?: string; categoryName?: string; licenseNames?: string;
  }>();
  const studentId = Number(params.studentId);
  const scheduleId = Number(params.scheduleId);
  const studentName = params.studentName ?? '';
  // 새 글은 지금 보던 일정에서 쓴 것으로 남음 (서버가 그 일정의 제목 · 날짜 · 구분 · 과정 이름을 복사)
  const context = params.scheduleTitle && params.scheduleDate ? noteContext({
    scheduleTitle: params.scheduleTitle, scheduleDate: params.scheduleDate,
    categoryName: params.categoryName ?? '', licenseNames: parseNames(params.licenseNames),
  }) : '';

  const listRef = useRef<FlatList<StudentNote> | null>(null);
  const inputRef = useRef<TextInputInstance | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const totalRef = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<StudentNote | null>(null);
  const [sending, setSending] = useState(false);

  // 글 수가 바뀔 때마다 일정 상세 카드의 숫자도 맞춤 (펼친 화면에선 일정 상세가 다시 불러오지 않음)
  const applyTotal = useCallback((next: number) => {
    totalRef.current = next;
    setTotal(next);
    const change: StudentNotesChanged = { studentId, total: next };
    DeviceEventEmitter.emit(STUDENT_NOTES_CHANGED, change);
  }, [studentId]);

  const list = useWindowedList<StudentNote>(async (cursor: Cursor) => {
    try {
      const res = await api.getStudentNotes(studentId, cursor);
      setLoadError(null);
      applyTotal(res.total);
      return { items: res.notes, hasMore: res.hasMore };
    } catch (e: any) {
      setLoadError(e?.message ?? null);
      throw e;
    }
  });
  const { reload } = list;
  useEffect(() => { if (studentId > 0) void reload('first'); }, [reload, studentId]);

  const dirty = editing ? text.trim() !== editing.content.trim() : !!text.trim();
  const goBack = useLeaveConfirm(dirty, router.back);
  const confirmDiscard = (onDiscard: () => void) => {
    if (!dirty) { onDiscard(); return; }
    Alert.alert('쓰던 내용이 사라져요', '계속할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '계속', style: 'destructive', onPress: onDiscard },
    ]);
  };

  const startEdit = (note: StudentNote) => confirmDiscard(() => {
    setEditing(note);
    setText(note.content);
    inputRef.current?.focus();
  });
  const cancelEdit = () => confirmDiscard(() => { setEditing(null); setText(''); });

  const submit = async () => {
    const content = text.trim();
    if (!content || sending) return;
    if (content.length > NOTE_MAX) { Alert.alert(`${NOTE_MAX.toLocaleString()}자까지 쓸 수 있어요.`); return; }
    setSending(true);
    try {
      if (editing) {
        if (content !== editing.content) {
          await api.updateStudentNote(editing.id, content);
          list.setItems(prev => prev.map(n => (n.id === editing.id ? { ...n, content, edited: true } : n)));
        }
        setEditing(null);
      } else {
        await api.addStudentNote(studentId, scheduleId, content);
        await reload('quiet');
        requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
      }
      setText('');
    } catch (e: any) {
      if (!e?._handled) Alert.alert(editing ? '고치지 못했어요' : '남기지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  const removeLocally = (id: number) => {
    list.setItems(prev => prev.filter(n => n.id !== id));
    applyTotal(Math.max(0, totalRef.current - 1));
    if (editing?.id === id) { setEditing(null); setText(''); }
  };
  const remove = (note: StudentNote) => {
    Alert.alert('이 글을 지울까요?', '지우면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기', style: 'destructive', onPress: async () => {
          try {
            await api.deleteStudentNote(note.id);
            removeLocally(note.id);
          } catch (e: any) {
            if (e?.status === 404) removeLocally(note.id);
            if (!e?._handled) Alert.alert('지우지 못했어요', e?.message ?? '다시 시도해 주세요.');
          }
        },
      },
    ]);
  };

  const spinner = <View style={styles.more}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>;
  const intro = (
    <View style={styles.intro}>
      <View style={styles.studentRow}>
        <Text style={styles.studentLabel}>수강생</Text>
        <ProfileLink userId={params.profileUserId} label={studentName} style={styles.studentLink}>
          <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
        </ProfileLink>
      </View>
      <View style={styles.notice}>
        <Ionicons name="lock-closed" size={14} color={Colors.brand.accent} />
        <Text style={styles.noticeText}>강사끼리만 보는 정보예요. 수강생에게는 보이지 않아요.</Text>
      </View>
      {total ? <Text style={styles.count}>글 {total}개</Text> : null}
      {list.more === 'newer' ? spinner : null}
    </View>
  );

  const canWrite = editing !== null || scheduleId > 0;
  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {isPaneRoot ? <View style={styles.headerSide} /> : (
          <StripBackSlot size={36}>
            <Pressable accessibilityLabel="뒤로가기" onPress={goBack} style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.6 }]}>
              <GlassCircle fallbackStyle={styles.backCircle}>
                <Text style={styles.backArrow}>{'<'}</Text>
              </GlassCircle>
            </Pressable>
          </StripBackSlot>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>강사간 수강생 정보 공유</Text>
        <View style={styles.headerSide} />
      </View>

      {!(studentId > 0) || list.state === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{(studentId > 0 && loadError) || '정보를 불러오지 못했어요.'}</Text>
          {studentId > 0 && (
            <Pressable onPress={() => void reload('first')} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          )}
        </View>
      ) : list.state === 'loading' ? (
        <View style={styles.center}><Spinner /></View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={list.items}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <NoteCard note={item} editing={editing?.id === item.id} onEdit={startEdit} onDelete={remove} />
            )}
            ListHeaderComponent={intro}
            ListEmptyComponent={
              <Text style={styles.emptyList}>아직 남긴 정보가 없어요.{'\n'}수업하며 알게 된 점을 다른 강사와 나눠 보세요.</Text>
            }
            ListFooterComponent={list.more === 'older' ? spinner : undefined}
            refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void reload('refresh')} tintColor="rgba(255,255,255,0.6)" />}
            onEndReached={() => void list.loadOlder()}
            onEndReachedThreshold={0.5}
            onStartReached={() => void list.loadNewer()}
            onStartReachedThreshold={0.5}
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
          />

          {canWrite && (
            <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.composerInfo}>
                {editing ? (
                  <>
                    <Text style={styles.composerInfoText} numberOfLines={1}>내 글 고치는 중</Text>
                    <Pressable accessibilityLabel="고치기 취소" onPress={cancelEdit} hitSlop={8}>
                      <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.composerInfoText} numberOfLines={1}>{context ? `이 일정에서 남겨요 · ${context}` : '이 일정에서 남겨요'}</Text>
                )}
                {text.length > 0 && <Text style={styles.counter}>{text.length.toLocaleString()}/{NOTE_MAX.toLocaleString()}</Text>}
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={NOTE_MAX}
                  editable={!sending}
                  placeholder="다른 강사에게 남길 수강생 정보"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={editing ? '저장' : '등록'} onPress={submit} disabled={!text.trim() || sending}
                  style={({ pressed }) => [styles.send, (!text.trim() || pressed) && { opacity: 0.5 }]}>
                  {sending ? <ActivityIndicator color="#032A36" /> : <Text style={styles.sendText}>{editing ? '저장' : '등록'}</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function NoteCard({ note, editing, onEdit, onDelete }: {
  note: StudentNote; editing: boolean; onEdit: (note: StudentNote) => void; onDelete: (note: StudentNote) => void;
}) {
  const author = note.author;
  const authorName = !author ? '알 수 없는 강사'
    : author.name && author.name !== author.nickname ? `${author.nickname} (${author.name})` : author.nickname;
  return (
    <View style={[styles.card, editing && styles.cardEditing]}>
      <View style={styles.cardHeader}>
        <ProfileLink userId={author?.userId ?? null} label={authorName}>
          <ProfileAvatar profileImage={author?.profileImage ?? null} nickname={author?.nickname ?? ''} level={author?.badgeLevel ?? author?.level} />
        </ProfileLink>
        <View style={styles.cardHeaderText}>
          <Text style={styles.author} numberOfLines={1}>{authorName}{note.isMine ? ' · 나' : ''}</Text>
          <Text style={styles.date}>{noteDate(note.createdAt)}{note.edited ? ' · 수정됨' : ''}</Text>
        </View>
        {note.isMine && (
          <View style={styles.mineActions}>
            <Pressable accessibilityRole="button" onPress={() => onEdit(note)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={styles.mineAction}>수정</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onDelete(note)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={[styles.mineAction, styles.deleteAction]}>삭제</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.context}>
        <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.5)" style={styles.contextIcon} />
        <Text style={styles.contextText}>{noteContext(note)}</Text>
      </View>
      <Text style={styles.content} selectable>{note.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: 20 },
  headerSide: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  retry: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  retryText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },

  listContent: { paddingHorizontal: 20, paddingBottom: 16 },
  intro: { paddingTop: 8, paddingBottom: 6, gap: 10 },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  studentLabel: { width: 56, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  studentLink: { flexShrink: 1 },
  studentName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: 'rgba(0,180,216,0.12)',
  },
  noticeText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)' },
  count: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  more: { paddingVertical: 14, alignItems: 'center' },
  emptyList: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: 36 },

  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginTop: 10, gap: 8 },
  cardEditing: { borderWidth: 1, borderColor: 'rgba(0,180,216,0.6)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  author: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  date: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  mineActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mineAction: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  deleteAction: { color: '#FF9292' },
  context: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  contextIcon: { marginTop: 3 },
  contextText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.55)' },
  content: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.85)' },

  composer: {
    paddingHorizontal: 16, paddingTop: 8, backgroundColor: Colors.brand.primary,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)', gap: 6,
  },
  composerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInfoText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  counter: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, maxHeight: 140, minHeight: 42, borderRadius: 14, backgroundColor: '#0F3D6E', color: Colors.brand.white,
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontFamily: 'SUIT-Regular', fontSize: 14,
  },
  send: { height: 42, paddingHorizontal: 16, borderRadius: 14, backgroundColor: Colors.brand.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#032A36' },
});
