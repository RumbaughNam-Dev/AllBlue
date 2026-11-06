import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import { useWindowedList } from '@/features/community/useWindowedList';
import { CenterMessage } from '@/features/community/ui';
import { api, type TourCard, type TourSearchConditions, type TourStatus } from '@/services/api';
import { FieldLabel, formStyles as fs, Selector, TourHeader } from './FormParts';
import TourGridList from './TourGridList';
import { StatusBadge, TourPhotoCard } from './TourCards';
import { regionName, useTourRegions } from './useTourRegions';
import { kstDay } from './ui';
import { useTourRouter } from './nav';

const SIDE = 20;
const STATUSES: { value: TourStatus; label: string }[] = [
  { value: 'RECRUITING', label: '참여자 모집중' }, { value: 'SEEKING_LEADER', label: '인솔자 모집중' }, { value: 'CLOSED', label: '모집 마감' },
];
// 출발일 기본: 오늘 ~ 한 달 뒤 · 참여자 · 인솔자 모집중 (모집 마감은 골랐을 때만)
const initialConditions = (): TourSearchConditions => ({
  from: kstDay(0), to: kstDay(30), continent: '', country: '', statuses: ['RECRUITING', 'SEEKING_LEADER'], q: '',
});
type Sheet = 'continent' | 'country' | 'from' | 'to' | null;

// 12장 투어 검색 (전체 화면, 팝업 아님): 위에 조건, 아래에 결과 (최근 등록 순 10개씩, 큰 사진 카드)
export default function TourSearchScreen() {
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [conditions, setConditions] = useState<TourSearchConditions>(initialConditions);
  const [keyword, setKeyword] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const { continents, countries, countriesOf } = useTourRegions();
  const conditionsRef = useRef(conditions); conditionsRef.current = conditions;
  const list = useWindowedList<TourCard>(cursor => api.searchTours(conditionsRef.current, cursor));
  const reloadRef = useRef(list.reload); reloadRef.current = list.reload;
  // 조건이 바뀌면 처음부터 다시 (검색어는 키보드의 '검색'을 누를 때)
  useEffect(() => { void reloadRef.current('first'); }, [conditions]);

  const set = useCallback(<K extends keyof TourSearchConditions>(key: K, value: TourSearchConditions[K]) => setConditions(prev => ({ ...prev, [key]: value })), []);
  const toggleStatus = (status: TourStatus) => setConditions(prev => {
    const has = prev.statuses.includes(status);
    const next = has ? prev.statuses.filter(s => s !== status) : [...prev.statuses, status];
    return { ...prev, statuses: next.length ? next : prev.statuses }; // 하나는 남김
  });

  const header = (
    <View style={styles.conditions}>
      <FieldLabel text="출발일" />
      <View style={fs.row}>
        <Selector label={conditions.from.replace(/-/g, '.') || '처음'} placeholder={!conditions.from} icon="calendar-outline" onPress={() => setSheet('from')} />
        <Text style={fs.tilde}>~</Text>
        <Selector label={conditions.to.replace(/-/g, '.') || '끝'} placeholder={!conditions.to} icon="calendar-outline" onPress={() => setSheet('to')} />
      </View>
      <FieldLabel text="지역" />
      <View style={fs.row}>
        <Selector label={regionName(continents, conditions.continent) || '대륙 전체'} placeholder={!conditions.continent} onPress={() => setSheet('continent')} />
        <Selector label={regionName(countries, conditions.country) || '나라 전체'} placeholder={!conditions.country} disabled={!conditions.continent} onPress={() => setSheet('country')} />
      </View>
      <FieldLabel text="상태" />
      <View style={fs.row}>
        {STATUSES.map(s => {
          const on = conditions.statuses.includes(s.value);
          return (
            <Pressable key={s.value} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleStatus(s.value)}
              style={({ pressed }) => [styles.status, on && styles.statusOn, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.statusText, on && styles.statusTextOn]} numberOfLines={1}>{s.label}{on ? ' ✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      <FieldLabel text="검색어" />
      <TextInput style={fs.input} value={keyword} onChangeText={setKeyword} returnKeyType="search" onSubmitEditing={() => set('q', keyword.trim())}
        placeholder="투어명 · 인솔 강사 · 등록자 닉네임" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={40} />
      <Text style={styles.sort}>출발일 기준 · 최근 등록 순</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TourHeader title="투어 검색" onBack={() => router.back()} />
      {list.state === 'error' ? <CenterMessage message="검색하지 못했어요." onRetry={() => void list.reload()} /> : (
        <TourGridList list={list} width={width} side={SIDE} bottom={insets.bottom} header={header}
          empty={list.state === 'loading' ? '' : '검색된 투어가 없어요.'}
          renderCard={(tour, cardWidth) => (
            <TourPhotoCard tour={tour} width={cardWidth} badge={<StatusBadge status={tour.status} small />}
              onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(tour.id) } })} />
          )} />
      )}
      <BottomSheet visible={sheet === 'continent'} onClose={() => setSheet(null)} title="대륙" fitContent
        items={[{ label: '대륙 전체', value: '' }, ...continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))]} selectedValue={conditions.continent}
        onSelect={code => setConditions(prev => (code === prev.continent ? prev : { ...prev, continent: code, country: '' }))} />
      <BottomSheet visible={sheet === 'country'} onClose={() => setSheet(null)} title={`나라 (${regionName(continents, conditions.continent)})`}
        items={[{ label: '나라 전체', value: '' }, ...countriesOf(conditions.continent).map(c => ({ label: c.nameKo ?? c.name, value: c.code }))]}
        selectedValue={conditions.country} searchable={countriesOf(conditions.continent).length > 8} onSelect={code => set('country', code)} />
      <DatePickerSheet visible={sheet === 'from'} onClose={() => setSheet(null)} selectedDate={conditions.from || kstDay(0)}
        onSelect={date => setConditions(prev => ({ ...prev, from: date, to: prev.to && prev.to < date ? date : prev.to }))} />
      <DatePickerSheet visible={sheet === 'to'} onClose={() => setSheet(null)} selectedDate={conditions.to || conditions.from || kstDay(0)} minDate={conditions.from || undefined}
        onSelect={date => set('to', date)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  conditions: { paddingBottom: 6 },
  status: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: 'rgba(2,62,115,0.9)' },
  statusOn: { backgroundColor: '#00B4D8' },
  statusText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: '#B8D4F0' },
  statusTextOn: { color: '#FFFFFF' },
  sort: { marginTop: 14, fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
});
