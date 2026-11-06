import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import DatePickerSheet from '@/components/DatePickerSheet';
import { type Conditions, SIDE, dateText, localDay, pickFrom } from './listRows';

const ACCENT = '#00E5FF';

// 전체보기 맨 위 검색 조건 (예전 검색 화면에 있던 것): 작성일 · 검색어(제목 · 내용 · 태그) · 작성자.
// 작성일은 고르면 바로, 검색어 · 작성자는 키보드의 '검색'을 누르면 찾음. 작성일이 비어 있으면 처음 ~ 오늘 (전체).
// 바형 · 접은 화면은 세 줄, 펼친 화면은 한 줄로 좌우에 늘여 놓음
export default function SearchConditions({ value, wide, onChange }: { value: Conditions; wide: boolean; onChange: (patch: Partial<Conditions>) => void }) {
  const [draft, setDraft] = useState({ q: value.q, author: value.author });
  const [sheet, setSheet] = useState<'from' | 'to' | null>(null);
  const applyText = () => onChange({ q: draft.q.trim(), author: draft.author.trim() });

  const dates = (
    <View style={[styles.row, wide && styles.dates]}>
      <Ionicons name="calendar-outline" size={16} color={ACCENT} />
      <Selector label={dateText(value.from, 'from', wide)} name="작성일 시작" wide={wide} onPress={() => setSheet('from')} />
      <Text style={styles.tilde}>~</Text>
      <Selector label={dateText(value.to, 'to', wide)} name="작성일 끝" wide={wide} onPress={() => setSheet('to')} />
      {!!(value.from || value.to) && (
        <Pressable accessibilityRole="button" accessibilityLabel="작성일 지우기" onPress={() => onChange({ from: '', to: '' })} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      )}
    </View>
  );
  const words = (
    <SearchField icon="search" value={draft.q} placeholder={wide ? '제목 · 내용 · 태그' : '검색어 (제목 · 내용 · 태그)'}
      onChange={q => setDraft(d => ({ ...d, q }))} onSubmit={applyText}
      onClear={() => { setDraft(d => ({ ...d, q: '' })); onChange({ q: '' }); }} />
  );
  const writer = (
    <SearchField icon="person-outline" value={draft.author} placeholder={wide ? '작성자' : '작성자 닉네임'}
      onChange={author => setDraft(d => ({ ...d, author }))} onSubmit={applyText}
      onClear={() => { setDraft(d => ({ ...d, author: '' })); onChange({ author: '' }); }} />
  );

  return (
    <View style={[styles.box, wide && styles.wide]}>
      {dates}
      {wide ? <View style={styles.words}>{words}</View> : words}
      {wide ? <View style={styles.writer}>{writer}</View> : writer}
      <DatePickerSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        selectedDate={value.from}
        onSelect={from => onChange(pickFrom(value, from))}
      />
      <DatePickerSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        selectedDate={value.to || localDay(new Date())}
        minDate={value.from || undefined}
        onSelect={to => onChange({ to })}
      />
    </View>
  );
}

function Selector({ label, name, wide, onPress }: { label: string; name: string; wide: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} ${label}`} onPress={onPress}
      style={({ pressed }) => [styles.selector, !wide && styles.grow, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.selectorText, !wide && styles.grow]} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

function SearchField({ icon, value, placeholder, onChange, onSubmit, onClear }: {
  icon: 'search' | 'person-outline'; value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void; onClear: () => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={ACCENT} />
      <View style={styles.field}>
        <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} returnKeyType="search" maxLength={40}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)" style={styles.input} />
        {!!value && (
          <Pressable accessibilityRole="button" accessibilityLabel="지우기" onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: SIDE, paddingBottom: 12, gap: 8 },
  // 펼친 화면: 작성일(글자만큼) · 검색어 · 작성자를 한 줄에
  wide: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dates: { flexShrink: 0 },
  words: { flex: 1.4 },
  writer: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white, paddingVertical: 10 },
});
