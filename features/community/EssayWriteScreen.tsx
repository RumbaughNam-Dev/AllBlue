import React, { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { UploadProgressPopup, useUploadProgress } from '@/components/UploadProgress';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { api, type EssaySpan } from '@/services/api';
import {
  allHave, applyStyle, EditorBlock, ESSAY_COLORS, essayHasContent, fromBody, insertImage, removeImage, spansText,
  spliceSpans, SpanStyle, StylePatch, styleAt, textChange, toBody,
} from './essay';
import { spanStyle } from './EssayBody';
import { CenterMessage, CommunityHeader, LIMITS, TextHeaderButton, styles as ui } from './ui';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIZES: { value: 'S' | 'M' | 'L'; label: string }[] = [{ value: 'S', label: '작게' }, { value: 'M', label: '보통' }, { value: 'L', label: '크게' }];
type Selection = { start: number; end: number };
type CaretInput = TextInputInstance & { setSelection?: (start: number, end: number) => void };

// 사진 피커는 결과를 넘긴 뒤에 닫히기 시작해서 다 닫히기까지 0.6초쯤 걸림 (여유 있게 1초).
// 그 전에는 업로드 팝업을 띄우거나 입력칸에 포커스를 주지 않음 (2026-11-13): iOS에서 피커가 닫히는 중에
// 팝업이 뜨고 닫히고 키보드가 오르내리면, 화면을 덮는 투명한 층이 남아 터치는 안 되고 키보드만 되는 일이 생김
const PICKER_SETTLE_MS = 1000;

// 키보드를 내리고, 올라와 있었으면 다 내려갈 때까지 기다림 (최대 0.6초).
// 올라온 채로 피커를 열면 iOS가 피커를 닫으면서 키보드를 되살려서 뒤이은 팝업 · 포커스와 겹침
function dismissKeyboard() {
  if (!Keyboard.isVisible()) {
    Keyboard.dismiss();
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    const finish = () => { sub.remove(); clearTimeout(timer); resolve(); };
    const sub = Keyboard.addListener('keyboardDidHide', finish);
    const timer = setTimeout(finish, 600);
    Keyboard.dismiss();
  });
}

// 5장 에세이 쓰기: 제목 아래 에디터. 글자를 고르거나 커서를 둔 채 굵게 · 기울임 · 밑줄 · 크기 · 색을 입히고,
// 커서 자리에 사진을 넣으면 글이 나뉘어 그 사이에 들어감 (강사 · admin만)
export default function EssayWriteScreen() {
  const { id } = useScreenParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(!!editId);
  const [title, setTitle] = useState('');
  const [blocks, setBlocksState] = useState<EditorBlock[]>(() => fromBody([]));
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  // 한국어 키보드에서는 글자가 같으면 서식만 바뀐 건 입력칸이 무시함 (React Native가 한글 조합을 지키려고).
  // 그래서 서식을 바꾸면 보이지 않는 글자(폭 0 공백)를 잠깐 붙였다 떼어 입력칸이 서식을 새로 입히게 하고,
  // 그 사이 풀린 선택 범위(블록)를 다시 잡아 줌.
  // 사진을 넣고 빼며 JS가 문단 글을 바꿀 때도 씀 (2026-11-13): RN은 입력칸 높이를 바뀌기 전 글로 재서(한 박자 늦음)
  // 두 번 더 그려야 높이가 맞고, iOS가 글 끝 기준으로 옮긴 커서도 제자리로 돌려놓아야 함
  const [nudge, setNudge] = useState<{ key: string; phase: 1 | 2; sel: Selection } | null>(null);
  const restyle = (key: string, keep: Selection) => setNudge({ key, phase: 1, sel: keep });
  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => {
      if (nudge.phase === 1) { setNudge({ ...nudge, phase: 2 }); return; }
      setNudge(null);
      const input = inputs.current.get(nudge.key) as CaretInput | undefined;
      // 쓰는 중이 아닌 문단도 커서를 맞춰 둠 (나중에 눌러 들어올 때 커서 자리를 알도록)
      input?.setSelection?.(nudge.sel.start, nudge.sel.end);
      carets.current.set(nudge.key, nudge.sel);
      if (input?.isFocused?.()) setSelection(nudge.sel);
    }, 16);
    return () => clearTimeout(timer);
  }, [nudge]);
  const setBlocks = (next: EditorBlock[]) => { blocksRef.current = next; setBlocksState(next); };
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  // 커서만 둔 채 바꾼 서식: 다음에 치는 글자에 입힘 (커서를 옮기면 풀림)
  const [pending, setPending] = useState<SpanStyle | null>(null);
  const [panel, setPanel] = useState<'size' | 'color' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const submittingRef = useRef(false);
  const uploads = useUploadProgress();
  const inputs = useRef(new Map<string, TextInputInstance>());
  // 문단마다 iOS 입력칸의 커서 자리. JS가 글을 넣거나 바꾸면 iOS는 커서를 (글 끝 기준으로) 옮기면서 알려 주지 않고,
  // 그 뒤 같은 자리를 누르면 커서 이벤트도 안 옴 → 문단 끝을 눌러 쓰던 중에 사진을 넣으면 JS는 커서를 0으로 알아
  // 문단 맨 앞에 넣었음 (2026-11-13). 커서 이벤트마다 기억하고, 모르는 문단은 iOS처럼 글 끝으로 봄
  const carets = useRef(new Map<string, Selection>());
  const caretOf = (key: string): Selection => {
    const known = carets.current.get(key);
    if (known) return known;
    const block = blocksRef.current.find(b => b.key === key);
    const end = block?.type === 'p' ? spansText(block.spans).length : 0;
    return { start: end, end };
  };
  const expectedCaret = useRef<number | null>(null);
  const styledWhileTyping = useRef(new Set<string>());
  // 키보드가 올라오면 툴바가 키보드 바로 위에 붙도록 아래 여백(홈 바 자리)을 뺌
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.getCommunityPost(editId).then(({ post }) => {
      setTitle(post.title);
      setBlocks(fromBody(post.body));
    }).catch((e: any) => { Alert.alert('글을 불러오지 못했어요', e?.message ?? ''); router.back(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const back = () => router.back();
  const leave = useLeaveConfirm(dirty && !saved, back);
  useEffect(() => { if (saved) back(); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const focused = blocks.find(b => b.key === focusKey && b.type === 'p') as Extract<EditorBlock, { type: 'p' }> | undefined;
  const ranged = selection.start !== selection.end;
  const current: SpanStyle = focused ? (pending ?? styleAt(focused.spans, selection.start)) : {};
  const isOn = (flag: 'b' | 'i' | 'u') => focused && ranged ? allHave(focused.spans, selection.start, selection.end, flag) : !!current[flag];

  const updateSpans = (key: string, update: (spans: EssaySpan[]) => EssaySpan[], redraw: Selection | false) => {
    const next = blocksRef.current.map(b => (b.key === key && b.type === 'p' ? { ...b, spans: update(b.spans) } : b));
    blocksRef.current = next;
    setBlocksState(next);
    if (redraw !== false) restyle(key, redraw);
    setDirty(true);
  };

  const onChangeText = (key: string, text: string) => {
    const block = blocksRef.current.find(b => b.key === key);
    if (!block || block.type !== 'p') return;
    const { start, end, inserted } = textChange(spansText(block.spans), text);
    const style = pending ?? styleAt(block.spans, start);
    expectedCaret.current = start + inserted.length;
    // 글자는 칠 때마다 그대로 그려야 입력칸 높이 · 커서 · 선택이 맞음 (EditorSpans가 한글 조합을 지킴).
    // 커서만 두고 켠 서식으로 친 글자는 입력칸이 서식을 모르므로, 한글 조합이 끝난 뒤(띄어쓰기 · 문장부호 · 줄바꿈)
    // 또는 입력칸을 떠날 때 서식을 다시 입힘
    if (pending) styledWhileTyping.current.add(key);
    const caret = start + inserted.length;
    const redraw = /[\s.,!?~…)\]'"]$/.test(inserted) && styledWhileTyping.current.delete(key) ? { start: caret, end: caret } : false;
    updateSpans(key, spans => spliceSpans(spans, start, end, inserted, style), redraw);
  };

  const onSelectionChange = (key: string, next: Selection) => {
    carets.current.set(key, next);
    setFocusKey(key);
    setSelection(next);
    // 글자를 친 뒤의 커서 이동이 아니면, 커서만 두고 바꾼 서식을 풂
    if (next.start !== next.end || next.start !== expectedCaret.current) setPending(null);
    expectedCaret.current = null;
  };

  // 문단에 들어오면 그 문단의 커서 자리를 JS도 알게 함 (커서 이벤트가 안 올 수 있어서)
  const onFocusParagraph = (key: string) => {
    if (key !== focusKey) setPending(null);
    setFocusKey(key);
    setSelection(caretOf(key));
  };

  // 사진 빼기: 쓰던 문단이 사진 뒤 문단이면 그 입력칸을 남기고 앞 문단을 그 앞에 붙임 (입력칸이 사라지면 키보드가 내려감).
  // 이어 붙인 문단은 두 번 더 그려 높이를 맞추고, 커서는 쓰던 자리에 둠
  const removePhoto = (imageKey: string) => {
    const next = removeImage(blocksRef.current, imageKey, focusKey);
    const was = next.key ? caretOf(next.key) : null;
    setBlocks(next.blocks);
    setDirty(true);
    if (!next.key || !was) return;
    const keep = { start: was.start + next.shift, end: was.end + next.shift };
    if (next.key === focusKey) setSelection(keep);
    restyle(next.key, keep);
  };

  const applyPatch = (patch: StylePatch) => {
    if (!focused) return;
    if (ranged) updateSpans(focused.key, spans => applyStyle(spans, selection.start, selection.end, patch), { ...selection });
    else setPending({ ...current, ...patch } as SpanStyle);
  };
  const toggle = (flag: 'b' | 'i' | 'u') => applyPatch({ [flag]: !isOn(flag) });

  const imageCount = blocks.filter(b => b.type === 'img').length;
  const addImage = async () => {
    if (imageCount >= LIMITS.essayImageMax) { Alert.alert(`사진은 ${LIMITS.essayImageMax}장까지 넣을 수 있어요.`); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return; }
    await dismissKeyboard();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const settledAt = Date.now() + PICKER_SETTLE_MS;
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) { Alert.alert('알림', '10MB가 넘는 사진은 넣을 수 없어요.'); return; }
    setUploading(true);
    try {
      // 피커가 다 닫힌 뒤에만 팝업이 뜨고, run은 팝업이 다 닫힌 뒤에 끝남
      const [{ url }] = await uploads.run([{ label: '사진', uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }],
        (file, onProgress) => api.uploadCommunityImage(file.uri, file.mimeType, onProgress), { showAfterMs: PICKER_SETTLE_MS });
      // 팝업이 뜨기 전에는 글을 고칠 수 있으므로 지금 블록에 넣음
      const current = blocksRef.current;
      const target = focused && current.some(b => b.key === focused.key) ? focused.key : null;
      const key = target ?? current.filter(b => b.type === 'p').pop()!.key;
      const caret = target ? selection.end : spansText((current.find(b => b.key === key) as Extract<EditorBlock, { type: 'p' }>).spans).length;
      const next = insertImage(current, key, caret, { url, ...(asset.width && asset.height ? { w: asset.width, h: asset.height } : {}) });
      setBlocks(next.blocks);
      setDirty(true);
      // 사진 앞에 남은 문단은 두 번 더 그려 높이를 맞추고 커서를 그 끝에 둠
      const left = next.blocks.find(b => b.key === key);
      if (left?.type === 'p') {
        const end = spansText(left.spans).length;
        restyle(key, { start: end, end });
      }
      // 사진 뒤 문단의 맨 앞(사진을 넣은 자리)에 커서를 둠
      const afterKey = next.focusKey;
      if (afterKey) {
        carets.current.set(afterKey, { start: 0, end: 0 });
        setTimeout(() => {
          const input = inputs.current.get(afterKey) as CaretInput | undefined;
          input?.focus();
          input?.setSelection?.(0, 0);
        }, Math.max(100, settledAt - Date.now()));
      }
    } catch (e: any) {
      if (!e?._handled) Alert.alert('사진을 올리지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  };

  const titleError = touched && (title.trim().length < LIMITS.titleMin || title.trim().length > LIMITS.titleMax)
    ? `제목은 ${LIMITS.titleMin}~${LIMITS.titleMax}자로 입력해 주세요.` : null;
  const bodyError = touched && !essayHasContent(blocks) ? '본문을 입력해 주세요.' : null;

  const submit = async () => {
    setTouched(true);
    const t = title.trim();
    if (t.length < LIMITS.titleMin || t.length > LIMITS.titleMax || !essayHasContent(blocks) || submittingRef.current || uploading) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const input = { board: 'ESSAY' as const, title: t, body: toBody(blocks) };
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

  const paragraphs = blocks.filter(b => b.type === 'p');
  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title={editId ? '에세이 수정' : '에세이 쓰기'} onBack={leave}
        right={<TextHeaderButton label={editId ? '저장' : '등록'} onPress={submit} disabled={submitting || loading} />} />
      {loading ? <CenterMessage loading /> : (
        <>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput value={title} onChangeText={text => { setTitle(text); setDirty(true); }} maxLength={LIMITS.titleMax}
              placeholder="제목 (2~40자)" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.title, titleError && styles.titleError]}
              onFocus={() => setFocusKey(null)} />
            {titleError && <Text style={ui.error}>{titleError}</Text>}
            <View style={[styles.editor, bodyError && ui.inputError]}>
              {blocks.map(block => block.type === 'img' ? (
                <View key={block.key} style={styles.imageWrap}>
                  <Image source={{ uri: block.url }} style={[styles.image, { aspectRatio: block.w && block.h ? block.w / block.h : 4 / 3 }]} />
                  <Pressable accessibilityLabel="사진 빼기" hitSlop={6} style={styles.imageRemove} onPress={() => removePhoto(block.key)}>
                    <Ionicons name="close" size={16} color="white" />
                  </Pressable>
                </View>
              ) : (
                <TextInput
                  key={block.key}
                  ref={ref => { if (ref) inputs.current.set(block.key, ref); else inputs.current.delete(block.key); }}
                  multiline
                  scrollEnabled={false}
                  onChangeText={text => onChangeText(block.key, text)}
                  onSelectionChange={e => onSelectionChange(block.key, e.nativeEvent.selection)}
                  onFocus={() => onFocusParagraph(block.key)}
                  onBlur={() => { if (styledWhileTyping.current.delete(block.key)) restyle(block.key, selection); }}
                  placeholder={block.key === paragraphs[0]?.key ? '본문을 입력하세요' : paragraphs.length > 1 && block.key === paragraphs[paragraphs.length - 1].key ? '이어서 쓰기' : undefined}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={[styles.paragraph, spanStyle({})]}
                >
                  <EditorSpans spans={block.spans} nudged={nudge?.key === block.key && nudge.phase === 1} />
                </TextInput>
              ))}
            </View>
            {bodyError && <Text style={ui.error}>{bodyError}</Text>}
            <Text style={styles.hint}>글자를 길게 눌러 고른 뒤 아래 버튼으로 굵게 · 밑줄 · 크기 · 색을 입혀요. 사진은 커서 자리에 들어가요 ({imageCount}/{LIMITS.essayImageMax}장).</Text>
          </ScrollView>

          {panel === 'size' && (
            <View style={styles.panel}>
              {SIZES.map(size => {
                const selected = (current.s ?? 'M') === size.value;
                return (
                  <Pressable key={size.value} onPress={() => { applyPatch({ s: size.value }); setPanel(null); }} style={[styles.sizeOption, selected && styles.optionSelected]}>
                    <Text style={[spanStyle({ s: size.value === 'M' ? undefined : size.value }), selected && { color: '#032A36' }]}>{size.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {panel === 'color' && (
            <View style={styles.panel}>
              {ESSAY_COLORS.map(color => {
                const selected = (current.c ?? ESSAY_COLORS[0]) === color;
                return (
                  <Pressable key={color} accessibilityLabel={`글자 색 ${color}`} onPress={() => { applyPatch({ c: color }); setPanel(null); }}
                    style={[styles.swatch, { backgroundColor: color }, selected && styles.swatchSelected]} />
                );
              })}
            </View>
          )}
          <View style={[styles.toolbar, { paddingBottom: keyboardUp ? 8 : Math.max(insets.bottom, 8) }]}>
            {/* 기울임은 앱 글꼴(SUIT)에 기울어진 글자가 없어 한글이 그대로 보여서 뺌 (예전 글의 기울임 표시는 그대로 둠) */}
            <ToolButton icon="format-bold" active={isOn('b')} onPress={() => toggle('b')} a11y="굵게" disabled={!focused} />
            <ToolButton icon="format-underline" active={isOn('u')} onPress={() => toggle('u')} a11y="밑줄" disabled={!focused} />
            <ToolButton icon="format-size" active={panel === 'size'} onPress={() => setPanel(panel === 'size' ? null : 'size')} a11y="글자 크기" disabled={!focused} />
            <ToolButton icon="format-color-text" active={panel === 'color'} onPress={() => setPanel(panel === 'color' ? null : 'color')} a11y="글자 색" disabled={!focused}
              dot={current.c ?? ESSAY_COLORS[0]} />
            <Pressable accessibilityRole="button" accessibilityLabel="사진 넣기" onPress={addImage} disabled={uploading} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.6 }]}>
              {uploading ? <ActivityIndicator color="white" /> : <Ionicons name="image-outline" size={22} color="white" />}
            </Pressable>
          </View>
        </>
      )}
      <UploadProgressPopup {...uploads.popup} />
    </KeyboardAvoidingView>
  );
}

// 서식 없는 글자는 Text로 감싸지 않고 그대로 넣어 입력칸의 기본 서식을 씀. 감싸면 줄 간격 같은 서식이 입력칸이
// 직접 그린 글자와 조금 달라져서, 입력칸이 한글을 조합하는 중에 글자를 덮어써 자음이 두 번 찍힐 수 있음
const EditorSpans = memo(function EditorSpans({ spans, nudged }: { spans: EssaySpan[]; nudged: boolean }) {
  return <>
    {spans.map((span, i) => (Object.keys(span).length === 1 ? span.t : <Text key={i} style={spanStyle(span)}>{span.t}</Text>))}
    {nudged ? '\u200B' : null}
  </>;
});

function ToolButton({ icon, active, onPress, a11y, disabled, dot }: {
  icon: 'format-bold' | 'format-underline' | 'format-size' | 'format-color-text'; active: boolean; onPress: () => void; a11y: string; disabled?: boolean; dot?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.tool, active && styles.toolActive, (pressed || disabled) && { opacity: 0.45 }]}>
      <MaterialCommunityIcons name={icon} size={22} color={active ? '#032A36' : 'white'} />
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  title: {
    fontFamily: 'SUIT-Bold', fontSize: 20, color: 'white', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.25)',
  },
  titleError: { borderBottomColor: '#FF6B4A' },
  editor: { minHeight: 260, gap: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  paragraph: { padding: 0, minHeight: 26, textAlignVertical: 'top' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  imageRemove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)' },
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8, paddingHorizontal: 8,
    backgroundColor: Colors.brand.deep, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  tool: { minWidth: 44, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  toolActive: { backgroundColor: Colors.brand.accent },
  dot: { position: 'absolute', bottom: 4, width: 14, height: 3, borderRadius: 2 },
  panel: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, padding: 12,
    backgroundColor: '#0F3D6E', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  sizeOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' },
  optionSelected: { backgroundColor: Colors.brand.accent },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: Colors.brand.accent, transform: [{ scale: 1.15 }] },
});
