import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api } from '@/services/api';
import { MentionSuggestions, useMentions } from './mentions';
import { CenterMessage, CommunityHeader, LIMITS, TextHeaderButton, styles as ui } from './ui';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 해시태그 입력 한 개: '#'과 띄어쓰기를 빼고 20자까지 (띄어쓰기를 치면 태그로 넣음)
export function cleanTag(text: string) {
  return text.replace(/#/g, '').replace(/\s/g, '').slice(0, LIMITS.tagLength);
}

type Photo = { uri: string; mimeType: string; remote: boolean } | null;

// 8장 자유게시판 쓰기 · 고치기: 제목 · 내용(@로 사용자 태그) · 사진 1장 · #해시태그(엔터로 칩)
export default function FreeWriteScreen() {
  const { id } = useScreenParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(!!editId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<Photo>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const submittingRef = useRef(false);
  const mentions = useMentions(content, text => { setContent(text); setDirty(true); });

  useEffect(() => {
    if (!editId) return;
    api.getCommunityPost(editId).then(({ post }) => {
      setTitle(post.title);
      setContent(post.content ?? '');
      setPhoto(post.imageUrl ? { uri: post.imageUrl, mimeType: 'image/jpeg', remote: true } : null);
      setTags(post.tags);
      mentions.reset(post.mentions);
    }).catch((e: any) => { Alert.alert('글을 불러오지 못했어요', e?.message ?? ''); router.back(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const back = () => router.back();
  const leave = useLeaveConfirm(dirty && !saved, back);
  // 저장한 뒤에는 확인 없이 나감 (막는 것이 풀린 다음 화면에서)
  useEffect(() => { if (saved) back(); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const titleError = touched && (title.trim().length < LIMITS.titleMin || title.trim().length > LIMITS.titleMax)
    ? `제목은 ${LIMITS.titleMin}~${LIMITS.titleMax}자로 입력해 주세요.` : null;
  const contentError = touched && !content.trim() ? '내용을 입력해 주세요.' : null;

  const addTag = (raw: string) => {
    const tag = cleanTag(raw);
    setTagDraft('');
    if (!tag) return;
    if (tags.length >= LIMITS.tagMax) { Alert.alert(`해시태그는 ${LIMITS.tagMax}개까지예요.`); return; }
    if (!tags.some(t => t.toLowerCase() === tag.toLowerCase())) { setTags([...tags, tag]); setDirty(true); }
  };
  const changeTagDraft = (text: string) => {
    // 띄어쓰기는 쓸 수 없어서, 치면 그때까지를 태그로 넣음
    if (/\s/.test(text)) addTag(text);
    else setTagDraft(cleanTag(text));
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) { Alert.alert('알림', '10MB가 넘는 사진은 올릴 수 없어요.'); return; }
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', remote: false });
    setDirty(true);
  };

  const submit = async () => {
    setTouched(true);
    const finalTags = tagDraft ? [...new Set([...tags, cleanTag(tagDraft)])].filter(Boolean).slice(0, LIMITS.tagMax) : tags;
    const t = title.trim();
    if (t.length < LIMITS.titleMin || t.length > LIMITS.titleMax || !content.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const imageUrl = !photo ? null : photo.remote ? photo.uri : (await api.uploadCommunityImage(photo.uri, photo.mimeType)).url;
      const input = { board: 'FREE' as const, title: t, content: content.trim(), imageUrl, tags: finalTags, mentions: mentions.mentionIds() };
      if (editId) await api.updateCommunityPost(editId, input);
      else await api.createCommunityPost(input);
      setSaved(true);
    } catch (e: any) {
      if (!e?._handled) Alert.alert('등록하지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title={editId ? '자유게시판 수정' : '자유게시판 쓰기'} onBack={leave}
        right={<TextHeaderButton label={editId ? '저장' : '등록'} onPress={submit} disabled={submitting || loading} />} />
      {loading ? <CenterMessage loading /> : (
        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <View>
            <TextInput value={title} onChangeText={text => { setTitle(text); setDirty(true); }} maxLength={LIMITS.titleMax}
              placeholder="제목 (2~40자)" placeholderTextColor="rgba(255,255,255,0.4)" style={[ui.input, styles.title, titleError && ui.inputError]} />
            {titleError && <Text style={ui.error}>{titleError}</Text>}
          </View>
          <View>
            <TextInput value={content} onChangeText={text => { setContent(text); setDirty(true); }} {...mentions.inputProps}
              multiline maxLength={LIMITS.freeContentMax} textAlignVertical="top"
              placeholder="내용을 입력하세요. @를 치면 사용자를 태그할 수 있어요." placeholderTextColor="rgba(255,255,255,0.4)"
              style={[ui.input, styles.content, contentError && ui.inputError]} />
            {mentions.open && <View style={styles.suggestions}><MentionSuggestions users={mentions.users} loading={mentions.loading} onPick={mentions.pick} /></View>}
            {contentError && <Text style={ui.error}>{contentError}</Text>}
            <Text style={styles.counter}>{content.length} / {LIMITS.freeContentMax}</Text>
          </View>

          <Text style={ui.label}>사진 (1장)</Text>
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable accessibilityLabel="사진 지우기" onPress={() => { setPhoto(null); setDirty(true); }} style={styles.photoRemove} hitSlop={6}>
                <Ionicons name="close" size={16} color="white" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.addPhoto, pressed && { opacity: 0.7 }]}>
              <Ionicons name="add" size={24} color="white" />
              <Text style={ui.meta}>사진</Text>
            </Pressable>
          )}

          <Text style={ui.label}>해시태그</Text>
          {!!tags.length && (
            <View style={styles.tags}>
              {tags.map(tag => (
                <Pressable key={tag} accessibilityLabel={`#${tag} 지우기`} onPress={() => { setTags(tags.filter(t => t !== tag)); setDirty(true); }} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <Ionicons name="close" size={13} color="#032A36" />
                </Pressable>
              ))}
            </View>
          )}
          {tags.length < LIMITS.tagMax && (
            <View>
              <View style={[ui.input, styles.tagInput]}>
                <Text style={styles.hash}>#</Text>
                <TextInput value={tagDraft} onChangeText={changeTagDraft} onSubmitEditing={() => addTag(tagDraft)} submitBehavior="submit"
                  returnKeyType="done" autoCapitalize="none" placeholder="태그명" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.tagField} />
              </View>
              <Text style={styles.hint}>엔터를 누르면 태그로 추가돼요 · 띄어쓰기 없이 {LIMITS.tagLength}자, {LIMITS.tagMax}개까지</Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  title: { fontFamily: 'SUIT-SemiBold' },
  content: { minHeight: 180 },
  counter: { alignSelf: 'flex-end', fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  suggestions: { marginTop: 6 },
  addPhoto: { width: 84, height: 84, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoWrap: { width: 120, height: 120 },
  photo: { width: 120, height: 120, borderRadius: 14 },
  photoRemove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.brand.accent },
  tagText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#032A36' },
  tagInput: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  hash: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.accent, marginRight: 4 },
  tagField: { flex: 1, height: 46, fontFamily: 'SUIT-Regular', fontSize: 15, color: 'white' },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 },
});
