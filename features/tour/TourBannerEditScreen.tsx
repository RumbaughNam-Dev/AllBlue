import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Switch, Alert, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import { localToday } from './tourForm';
import { bannerFormError, BannerForm, shortDay } from './banners';
import { formatTourPeriod } from './ui';

const SIDE = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EMPTY: BannerForm = { imageUri: '', remote: false, mimeType: 'image/jpeg', tourId: null, startDate: '', endDate: '', isEnabled: true };
type Sheet = 'tour' | 'start' | 'end' | null;

// 22장 배너 추가 · 수정 (admin): 16:9 이미지, 공개 중인 투어 연결, 노출 기간, 노출 켜기/끄기, 삭제
export default function TourBannerEditScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useScreenParams<{ id?: string }>();
  const bannerId = id ? Number(id) : null;
  const [form, setForm] = useState<BannerForm>(EMPTY);
  const [tours, setTours] = useState<{ id: number; title: string; startDate: string; endDate: string }[]>([]);
  const [currentTitle, setCurrentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const today = localToday();

  useEffect(() => {
    let alive = true;
    Promise.all([api.getBannerTourOptions(), bannerId ? api.getTourBanners() : Promise.resolve(null)])
      .then(([options, list]) => {
        if (!alive) return;
        setTours(options.tours);
        const banner = list ? [...list.banners, ...list.ended].find(b => b.id === bannerId) : null;
        if (bannerId && !banner) throw new Error('배너를 찾을 수 없어요.');
        if (banner) {
          setForm({ imageUri: banner.imageUrl, remote: true, mimeType: 'image/jpeg', tourId: banner.tourId, startDate: banner.startDate, endDate: banner.endDate, isEnabled: banner.isEnabled });
          setCurrentTitle(banner.tourTitle);
        }
      })
      .catch((e: any) => { if (alive) Alert.alert('불러오지 못했어요', e?.message, [{ text: '확인', onPress: () => router.back() }]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [bannerId]);

  const update = (patch: Partial<BannerForm>) => setForm(prev => ({ ...prev, ...patch }));
  const error = bannerFormError(form);
  const tourTitle = tours.find(t => t.id === form.tourId)?.title ?? (form.tourId ? currentTitle : '');
  const tourItems = useMemo(() => tours.map(t => ({ label: `${t.title}  ·  ${formatTourPeriod(t.startDate, t.endDate)}`, value: t.id })), [tours]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) { Alert.alert('알림', '10MB가 넘는 사진은 올릴 수 없어요.'); return; }
    update({ imageUri: asset.uri, remote: false, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const save = async () => {
    if (error || saving || !form.tourId) return;
    setSaving(true);
    try {
      const imageUrl = form.remote ? form.imageUri : (await api.uploadTourImage(form.imageUri, form.mimeType)).url;
      await api.saveTourBanner(bannerId, { imageUrl, tourId: form.tourId, startDate: form.startDate, endDate: form.endDate, isEnabled: form.isEnabled });
      router.back();
    } catch (e: any) {
      if (!e?._handled) Alert.alert('저장하지 못했어요', e?.message ?? '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!bannerId) return;
    Alert.alert('배너를 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try { await api.deleteTourBanner(bannerId); router.back(); } catch (e: any) {
            if (!e?._handled) Alert.alert('알림', e?.message ?? '삭제하지 못했어요.');
          }
        },
      },
    ]);
  };

  const imageWidth = Math.min(width, 700) - SIDE * 2;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top }]}>
      <View style={styles.header}>
        <StripBackSlot size={36}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.side, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
        <Text style={styles.headerTitle}>{bannerId ? '배너 수정' : '배너 추가'}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!error || saving }} disabled={!!error || saving} onPress={save} style={({ pressed }) => [styles.saveButton, (!!error || saving) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          {saving ? <ActivityIndicator color="#032A36" size="small" /> : <Text style={styles.saveText}>저장</Text>}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.label}>배너 이미지 <Text style={styles.required}>*</Text>  <Text style={styles.note}>(가로 16:9)</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel={form.imageUri ? '배너 이미지 바꾸기' : '배너 이미지 올리기'} onPress={pickImage} style={[styles.image, { height: (imageWidth * 9) / 16 }]}>
            {form.imageUri ? <Image source={{ uri: form.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
              <View style={styles.imageEmpty}>
                <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.5)" />
                <Text style={styles.imageEmptyText}>배너 이미지 올리기 (16:9)</Text>
              </View>
            )}
            {!!form.imageUri && <View style={styles.imageChange}><Text style={styles.imageChangeText}>이미지 바꾸기</Text></View>}
          </Pressable>
          <Text style={styles.guide}>투어 소개 이미지와 따로 올려요. 홈에서는 가로 16:9 칸에 맞춰 보여요.</Text>

          <Text style={styles.label}>연결할 투어 <Text style={styles.required}>*</Text></Text>
          <Pressable accessibilityRole="button" onPress={() => setSheet('tour')} style={({ pressed }) => [styles.field, pressed && { opacity: 0.7 }]}>
            <Text style={[styles.fieldText, !tourTitle && styles.placeholder]} numberOfLines={1}>{tourTitle || '공개 중인 투어 고르기'}</Text>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
          <Text style={styles.guide}>배너를 누르면 이 투어 상세로 가요. 투어가 비공개 · 출발하면 배너도 자동으로 내려가요.</Text>

          <Text style={styles.label}>노출 기간 <Text style={styles.required}>*</Text></Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => setSheet('start')} style={({ pressed }) => [styles.field, styles.half, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.fieldText, !form.startDate && styles.placeholder]}>{form.startDate.replace(/-/g, '.') || '시작일'}</Text>
              <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
            <Text style={styles.tilde}>~</Text>
            <Pressable accessibilityRole="button" onPress={() => setSheet('end')} style={({ pressed }) => [styles.field, styles.half, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.fieldText, !form.endDate && styles.placeholder]}>{form.endDate.replace(/-/g, '.') || '종료일'}</Text>
              <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
          <Text style={styles.guide}>끝나면 자동으로 '지난 광고'로 가요. 지난 광고는 기간만 바꿔 다시 쓸 수 있어요.</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.label}>노출</Text>
            <Switch value={form.isEnabled} onValueChange={value => update({ isEnabled: value })} trackColor={{ true: '#00B4D8' }} accessibilityLabel="배너 노출" />
          </View>

          {error && form.imageUri && <Text style={styles.error}>{error}</Text>}

          {bannerId && (
            <Pressable accessibilityRole="button" onPress={remove} style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}>
              <Text style={styles.deleteText}>배너 삭제</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <BottomSheet
        visible={sheet === 'tour'}
        onClose={() => setSheet(null)}
        title="연결할 투어"
        items={tourItems}
        selectedValue={form.tourId}
        searchable={tourItems.length > 8}
        onSelect={value => update({ tourId: value })}
      />
      <DatePickerSheet
        visible={sheet === 'start'}
        onClose={() => setSheet(null)}
        selectedDate={form.startDate || today}
        onSelect={date => setForm(prev => ({ ...prev, startDate: date, endDate: prev.endDate && prev.endDate >= date ? prev.endDate : date }))}
      />
      <DatePickerSheet
        visible={sheet === 'end'}
        onClose={() => setSheet(null)}
        selectedDate={form.endDate || form.startDate || today}
        minDate={form.startDate || undefined}
        onSelect={date => update({ endDate: date })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  side: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  saveButton: { height: 32, minWidth: 56, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  saveText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#032A36' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SIDE, paddingTop: 8 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white, marginTop: 20, marginBottom: 8 },
  required: { color: '#00E5FF' },
  note: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 8 },
  image: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  imageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageEmptyText: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  imageChange: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(3,20,40,0.75)' },
  imageChangeText: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: Colors.brand.white },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  fieldText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  placeholder: { color: 'rgba(255,255,255,0.35)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  half: { flex: 1 },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  error: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#FF6B6B', marginTop: 12 },
  delete: { marginTop: 32, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  deleteText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FF8A7A' },
});
