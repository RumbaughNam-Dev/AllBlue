import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import type { TourLink, TourStyle } from '@/services/api';
import { TOUR_FORM_LIMITS as L } from './tourForm';
import { STYLE_LABEL } from './ui';

export const ERROR = '#FF6B6B';
export const SIDE = 24;

// 화면 위 줄: 뒤로가기 · 제목 · 오른쪽 버튼 (듀오에선 뒤로가기가 오른쪽 여백으로 — StripBackSlot)
export function TourHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <StripBackSlot size={36}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
      ) : <View style={{ width: 36 }} />}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerRight}>{right ?? <View style={{ width: 36 }} />}</View>
    </View>
  );
}

export function HeaderButton({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.headerButton, primary && styles.headerButtonPrimary, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={[styles.headerButtonText, primary && styles.headerButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export function FieldLabel({ text, required, note, error }: { text: string; required?: boolean; note?: string; error?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}{required && <Text style={styles.required}> *</Text>}</Text>
      {note && !error && <Text style={styles.note}>{note}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Selector({ label, placeholder, disabled, error, icon = 'chevron-down', onPress }: {
  label: string; placeholder?: boolean; disabled?: boolean; error?: boolean; icon?: 'chevron-down' | 'calendar-outline'; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.selector, error && styles.inputError, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.selectorText, placeholder && styles.placeholder]} numberOfLines={1}>{label}</Text>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

export function Suffixed({ suffix, error, children }: { suffix: string; error?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.suffixed, error && styles.inputError]}>
      {children}
      <Text style={styles.suffix}>{suffix}</Text>
    </View>
  );
}

// 인원 칸: −  n명  + (min~max)
export function Stepper({ value, min, max, onChange, error, label }: { value: number; min: number; max: number; onChange: (v: number) => void; error?: boolean; label: string }) {
  return (
    <View style={[styles.stepper, error && styles.inputError]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 줄이기`} disabled={value <= min} hitSlop={6}
        onPress={() => onChange(value - 1)} style={({ pressed }) => [styles.stepButton, (pressed || value <= min) && { opacity: 0.35 }]}>
        <Ionicons name="remove" size={18} color={Colors.brand.white} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${label} ${value}명`}>{value}명</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 늘리기`} disabled={value >= max} hitSlop={6}
        onPress={() => onChange(value + 1)} style={({ pressed }) => [styles.stepButton, (pressed || value >= max) && { opacity: 0.35 }]}>
        <Ionicons name="add" size={18} color="#00E5FF" />
      </Pressable>
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange, error }: { options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void; error?: boolean }) {
  return (
    <View style={styles.row}>
      {options.map(o => (
        <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: value === o.value }} onPress={() => onChange(o.value)}
          style={({ pressed }) => [styles.chip, value === o.value && styles.chipOn, error && value !== o.value && styles.inputError, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.chipText, value === o.value && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const STYLE_OPTIONS: { value: TourStyle; label: string }[] = [
  { value: 'DIVING_ONLY', label: STYLE_LABEL.DIVING_ONLY }, { value: 'DIVING_SIGHTSEEING', label: STYLE_LABEL.DIVING_SIGHTSEEING },
];

// 포함 · 불포함: 한 줄씩 추가 · 삭제 (한 줄 40자, 20줄까지)
export function ItemList({ title, mark, items, onChange }: { title: string; mark: string; items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const line = draft.trim();
    if (!line || items.length >= L.itemCount) return;
    onChange([...items, line]);
    setDraft('');
  };
  return (
    <View>
      <FieldLabel text={title} note={`${items.length}/${L.itemCount}`} />
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.item}>
          <Text style={styles.itemMark}>{mark}</Text>
          <Text style={styles.itemText}>{item}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item} 삭제`} hitSlop={8} onPress={() => onChange(items.filter((_, i) => i !== index))}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>
      ))}
      {items.length < L.itemCount && (
        <View style={styles.itemAdd}>
          <TextInput style={styles.itemInput} value={draft} onChangeText={setDraft} onSubmitEditing={add} blurOnSubmit={false}
            placeholder="+ 항목 추가" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={L.itemLength} returnKeyType="done" />
          {!!draft.trim() && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${title} 추가`} onPress={add} style={({ pressed }) => [styles.itemAddButton, pressed && { opacity: 0.6 }]}>
              <Text style={styles.itemAddText}>추가</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// 16장 문의 링크: 1~5개, ✕로 삭제 · '＋ 링크 추가'는 팝업 (TourLinkPopup)
export function LinkList({ links, error, onRemove, onAdd, showProfileHint }: {
  links: TourLink[]; error?: string; onRemove: (index: number) => void; onAdd: () => void; showProfileHint?: boolean;
}) {
  return (
    <View>
      <FieldLabel text="문의 링크" required note={`${links.length}/${L.linkMax}`} error={error} />
      {links.map((link, index) => (
        <View key={`${index}-${link.url}`} style={styles.item}>
          <Ionicons name="link" size={15} color="#00E5FF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemText} numberOfLines={1}>{link.name}</Text>
            <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${link.name} 삭제`} hitSlop={8} onPress={() => onRemove(index)}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>
      ))}
      {links.length < L.linkMax && (
        <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.linkAdd, error && styles.inputError, pressed && { opacity: 0.6 }]}>
          <Text style={styles.linkAddText}>＋ 링크 추가</Text>
        </Pressable>
      )}
      <Text style={styles.guide}>참가 문의를 받을 곳이에요. 상세의 '문의하기'를 누르면 열려요.{showProfileHint ? '\n프로필에 링크를 넣어 두면 다음 등록 · 제안부터 자동으로 채워져요.' : ''}</Text>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  suffixedInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white, paddingVertical: 14 },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 10 },
  hint: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#00E5FF', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  half: { flex: 1 },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  inputError: { borderColor: ERROR },
  retry: { fontFamily: 'SUIT-Regular', fontSize: 12, color: ERROR, marginTop: 6 },
  box: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.6)', gap: 4 },
  boxText: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 20, color: '#B8D4F0' },
  reviewNote: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,138,117,0.15)', gap: 6 },
  reviewNoteTitle: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#FFB4A2' },
  reviewNoteText: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: Colors.brand.white },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: 20, gap: 8 },
  backButton: { width: 36, height: 36 },
  backCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  headerRight: { minWidth: 36, alignItems: 'flex-end' },
  headerButton: { paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,62,115,0.9)' },
  headerButtonPrimary: { backgroundColor: '#00B4D8' },
  headerButtonText: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#B8D4F0' },
  headerButtonTextPrimary: { color: '#FFFFFF' },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 20, marginBottom: 8 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  required: { color: '#00E5FF' },
  note: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  error: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: ERROR, flexShrink: 1 },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 10 },
  inputError: { borderColor: ERROR },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  placeholder: { color: 'rgba(255,255,255,0.35)' },
  suffixed: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  suffix: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)', marginLeft: 6 },
  stepper: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 8, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  stepButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  chip: {
    flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(2,62,115,0.9)', borderWidth: 1, borderColor: 'transparent',
  },
  chipOn: { backgroundColor: '#00B4D8' },
  chipText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#B8D4F0' },
  chipTextOn: { color: '#FFFFFF' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
  },
  itemMark: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF', width: 14, textAlign: 'center' },
  itemText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  linkUrl: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  linkAdd: { alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)' },
  linkAddText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: '#00E5FF' },
  itemAdd: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14 },
  itemInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white, paddingVertical: 12 },
  itemAddButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  itemAddText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
});
