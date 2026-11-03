import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import type { TourSearchConditions } from '@/services/api';
import PopupBackdrop from '@/components/PopupBackdrop';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import { regionName, useTourRegions } from './useTourRegions';

export const EMPTY_SEARCH: TourSearchConditions = { title: '', instructor: '', continent: '', country: '', from: '', to: '' };
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

type Props = {
  visible: boolean;
  initial: TourSearchConditions;
  onClose: () => void;
  onSearch: (conditions: TourSearchConditions) => void;
};
type Sheet = 'continent' | 'country' | 'from' | 'to' | null;

// 3장 검색 팝업: 투어명 · 인솔 강사 · 지역(대륙 → 나라) · 기간. 모든 조건은 선택이고 함께 쓰면 AND.
export default function TourSearchPopup({ visible, initial, onClose, onSearch }: Props) {
  const [draft, setDraft] = useState(initial);
  const [sheet, setSheet] = useState<Sheet>(null);
  const { continents, countries, failed, reload, countriesOf } = useTourRegions();
  // '조건 변경'은 입력값 그대로 다시 엶
  useEffect(() => { if (visible) setDraft(initial); }, [visible]);

  const set = (patch: Partial<TourSearchConditions>) => setDraft(prev => ({ ...prev, ...patch }));
  const continentItems = [{ label: '전체', value: '' }, ...continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))];
  const countryItems = [{ label: '전체', value: '' }, ...countriesOf(draft.continent).map(c => ({ label: c.nameKo ?? c.name, value: c.code }))];

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <View style={styles.header}>
            <Text style={styles.title}>투어 검색</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <Text style={styles.label}>투어명</Text>
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={title => set({ title })}
            placeholder="투어명을 입력하세요"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={40}
            returnKeyType="search"
            onSubmitEditing={() => onSearch(draft)}
          />

          <Text style={styles.label}>투어 인솔 강사</Text>
          <TextInput
            style={styles.input}
            value={draft.instructor}
            onChangeText={instructor => set({ instructor })}
            placeholder="강사 닉네임을 입력하세요"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={40}
            returnKeyType="search"
            onSubmitEditing={() => onSearch(draft)}
          />

          <Text style={styles.label}>지역</Text>
          <View style={styles.row}>
            <Selector label={draft.continent ? regionName(continents, draft.continent) : '대륙 전체'} onPress={() => (failed ? reload() : setSheet('continent'))} />
            {/* 대륙을 고르기 전까지 나라는 비활성 */}
            <Selector label={draft.country ? regionName(countries, draft.country) : '나라 전체'} disabled={!draft.continent} onPress={() => setSheet('country')} />
          </View>

          <Text style={styles.label}>투어 기간</Text>
          <View style={styles.row}>
            <Selector label={draft.from ? draft.from.replace(/-/g, '.') : '시작일'} placeholder={!draft.from} icon="calendar-outline" onPress={() => setSheet('from')} />
            <Text style={styles.tilde}>~</Text>
            <Selector label={draft.to ? draft.to.replace(/-/g, '.') : '종료일'} placeholder={!draft.to} icon="calendar-outline" onPress={() => setSheet('to')} />
          </View>
          <Text style={styles.hint}>입력한 기간과 일정이 겹치는 투어를 찾습니다</Text>

          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" onPress={() => setDraft(EMPTY_SEARCH)} style={({ pressed }) => [styles.reset, pressed && { opacity: 0.6 }]}>
              <Text style={styles.resetText}>초기화</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onSearch(draft)} style={({ pressed }) => [styles.search, glassClear, pressed && { opacity: 0.85 }]}>
              <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
              <Text style={styles.searchText}>검색</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={sheet === 'continent'}
        onClose={() => setSheet(null)}
        title="대륙"
        items={continentItems}
        selectedValue={draft.continent}
        fitContent
        onSelect={continent => { if (continent !== draft.continent) set({ continent, country: '' }); }}
      />
      <BottomSheet
        visible={sheet === 'country'}
        onClose={() => setSheet(null)}
        title={`나라 (${regionName(continents, draft.continent)})`}
        items={countryItems}
        selectedValue={draft.country}
        searchable={countryItems.length > 9}
        onSelect={country => set({ country })}
      />
      <DatePickerSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        selectedDate={draft.from}
        onSelect={from => set({ from, to: draft.to && draft.to < from ? from : draft.to })}
      />
      <DatePickerSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        selectedDate={draft.to || draft.from}
        minDate={draft.from || undefined}
        onSelect={to => set({ to })}
      />
    </Modal>
  );
}

function Selector({ label, placeholder, disabled, icon = 'chevron-down', onPress }: {
  label: string; placeholder?: boolean; disabled?: boolean; icon?: 'chevron-down' | 'calendar-outline'; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.selector, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.selectorText, placeholder && styles.placeholder]} numberOfLines={1}>{label}</Text>
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  panel: {
    alignSelf: 'center', width: '100%', maxWidth: 440,
    borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 14, marginBottom: 6 },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white },
  placeholder: { color: 'rgba(255,255,255,0.35)' },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
  reset: {
    flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  resetText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  search: {
    flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brand.white,
  },
  searchText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.primary },
});
