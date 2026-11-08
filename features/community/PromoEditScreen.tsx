import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { UploadProgressPopup, useUploadProgress } from '@/components/UploadProgress';
import { useAppRouter } from '@/features/split/SplitPane';
import { api } from '@/services/api';
import { CenterMessage, CommunityHeader, LIMITS, TextHeaderButton, styles as ui } from './ui';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
type Picture = { uri: string; mimeType: string; remote: boolean };

// Move one item left (-1) or right (+1).
export function moveItem<T>(items: T[], index: number, delta: -1 | 1) {
  const to = index + delta;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// 10장 교육단체 홍보 작성 · 수정: 단체장만, 단체당 하나. 제목 2~40자 + 이미지 1~10장 (첫 장이 홈 배너)
export default function PromoEditScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading');
  const [orgName, setOrgName] = useState('');
  const [postId, setPostId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<Picture[]>([]);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const submittingRef = useRef(false);
  const uploads = useUploadProgress();

  useEffect(() => {
    api.getMyPromo().then(({ organization, post }) => {
      if (!organization) { setState('none'); return; }
      setOrgName(organization.name);
      if (post) {
        setPostId(post.id);
        setTitle(post.title);
        setImages(post.images.map(uri => ({ uri, mimeType: 'image/jpeg', remote: true })));
      }
      setState('ready');
    }).catch(() => setState('none'));
  }, []);

  const back = () => router.back();
  const leave = useLeaveConfirm(dirty && !saved, back);
  useEffect(() => { if (saved) back(); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const titleError = touched && (title.trim().length < LIMITS.titleMin || title.trim().length > LIMITS.titleMax)
    ? `제목은 ${LIMITS.titleMin}~${LIMITS.titleMax}자로 입력해 주세요.` : null;
  const imageError = touched && !images.length ? '이미지를 1장 이상 올려 주세요.' : null;

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: LIMITS.promoImageMax - images.length, quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const tooBig = result.assets.filter(a => a.fileSize && a.fileSize > MAX_FILE_SIZE).length;
    const picked = result.assets.filter(a => !(a.fileSize && a.fileSize > MAX_FILE_SIZE)).map(a => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', remote: false }));
    setImages(prev => [...prev, ...picked.filter(p => !prev.some(i => i.uri === p.uri))].slice(0, LIMITS.promoImageMax));
    setDirty(true);
    if (tooBig) Alert.alert('알림', '10MB가 넘는 사진은 빼고 올렸어요.');
  };

  const submit = async () => {
    setTouched(true);
    const t = title.trim();
    if (t.length < LIMITS.titleMin || t.length > LIMITS.titleMax || !images.length || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // 새로 고른 이미지만 올림 (이미지마다 진행 막대), 이미 올린 건 주소 그대로
      const fresh = images.flatMap((image, index) => (image.remote ? [] : [{ label: `이미지 ${index + 1}`, uri: image.uri, mimeType: image.mimeType }]));
      const uploaded = await uploads.run(fresh, (file, onProgress) => api.uploadCommunityImage(file.uri, file.mimeType, onProgress).then(result => result.url));
      let next = 0;
      const urls = images.map(image => (image.remote ? image.uri : uploaded[next++]));
      await api.saveMyPromo({ title: t, images: urls });
      setSaved(true);
    } catch (e: any) {
      if (!e?._handled) Alert.alert('저장하지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const remove = () => {
    if (!postId) return;
    Alert.alert('홍보 글 삭제', '홍보 글을 지울까요? 홈 배너에서도 빠져요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try { await api.deleteCommunityPost(postId); setSaved(true); }
        catch (e: any) { if (!e?._handled) Alert.alert('삭제하지 못했어요', e?.message ?? '다시 시도해 주세요.'); }
      } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title={postId ? '단체 홍보 수정' : '단체 홍보 만들기'} onBack={leave}
        right={state === 'ready' ? <TextHeaderButton label="저장" onPress={submit} disabled={submitting} /> : undefined} />
      {state === 'loading' ? <CenterMessage loading /> : state === 'none' ? (
        <CenterMessage message="승인된 단체의 단체장만 홍보 글을 쓸 수 있어요." />
      ) : (
        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.org}>{orgName}의 홍보 글 (단체당 1개)</Text>
          <View>
            <Text style={ui.label}>제목</Text>
            <TextInput value={title} onChangeText={text => { setTitle(text); setDirty(true); }} maxLength={LIMITS.titleMax}
              placeholder="예: 겨울 시즌 레벨1 정규반 모집" placeholderTextColor="rgba(255,255,255,0.4)" style={[ui.input, titleError && ui.inputError]} />
            {titleError && <Text style={ui.error}>{titleError}</Text>}
          </View>
          <View>
            <Text style={ui.label}>이미지 ({images.length}/{LIMITS.promoImageMax}) · 첫 장이 홈 배너</Text>
            <View style={styles.grid}>
              {images.map((image, index) => (
                <View key={image.uri} style={styles.cell}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <Text style={styles.order}>{index + 1}</Text>
                  <Pressable accessibilityLabel={`${index + 1}번 이미지 지우기`} hitSlop={6} style={styles.remove}
                    onPress={() => { setImages(images.filter((_, i) => i !== index)); setDirty(true); }}>
                    <Ionicons name="close" size={14} color="white" />
                  </Pressable>
                  <View style={styles.moves}>
                    {index > 0 && <Pressable accessibilityLabel="앞으로" hitSlop={6} style={styles.move} onPress={() => { setImages(moveItem(images, index, -1)); setDirty(true); }}>
                      <Ionicons name="chevron-back" size={14} color="white" /></Pressable>}
                    {index < images.length - 1 && <Pressable accessibilityLabel="뒤로" hitSlop={6} style={styles.move} onPress={() => { setImages(moveItem(images, index, 1)); setDirty(true); }}>
                      <Ionicons name="chevron-forward" size={14} color="white" /></Pressable>}
                  </View>
                </View>
              ))}
              {images.length < LIMITS.promoImageMax && (
                <Pressable onPress={pick} style={({ pressed }) => [styles.cell, styles.add, imageError && ui.inputError, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="add" size={26} color="white" />
                </Pressable>
              )}
            </View>
            {imageError && <Text style={ui.error}>{imageError}</Text>}
          </View>
          {postId && (
            <Pressable onPress={remove} style={({ pressed }) => [ui.secondaryButton, { marginTop: 24 }, pressed && { opacity: 0.7 }]}>
              <Text style={[ui.secondaryButtonText, { color: '#FF6B4A' }]}>홍보 글 삭제</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
      <UploadProgressPopup {...uploads.popup} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, paddingTop: 8, gap: 18 },
  org: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  add: { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderStyle: 'dashed' },
  order: { position: 'absolute', top: 6, left: 6, fontFamily: 'SUIT-Bold', fontSize: 11, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  remove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  moves: { position: 'absolute', bottom: 5, left: 5, right: 5, flexDirection: 'row', justifyContent: 'space-between' },
  move: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
