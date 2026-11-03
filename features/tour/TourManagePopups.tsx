import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import type { TourStatus } from '@/services/api';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import WheelPicker from './WheelPicker';
import { PROCESS_DAYS, PROCESS_OPTIONS } from './manage';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';
const CAPACITY_MIN = 2, CAPACITY_MAX = 20;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Buttons({ confirm, onCancel, onConfirm, busy, disabled }: { confirm: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
        <Text style={styles.cancelText}>취소</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy || disabled}
        onPress={onConfirm}
        style={({ pressed }) => [styles.confirm, glassClear, pressed && { opacity: 0.85 }, (busy || disabled) && { opacity: 0.5 }]}
      >
        <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
        {busy ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.confirmText}>{confirm}</Text>}
      </Pressable>
    </View>
  );
}

// 8장 '처리': 투어 상태 바꾸기 (지금 상태 표시)
export function TourProcessPopup({ tour, onClose, onSave }: {
  tour: { title: string; period: string; status: TourStatus } | null;
  onClose: () => void;
  onSave: (status: TourStatus) => Promise<void>;
}) {
  const [picked, setPicked] = useState<TourStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPicked(tour?.status ?? null); setBusy(false); }, [tour]);
  const save = async () => {
    if (!picked) return;
    setBusy(true);
    try { await onSave(picked); } finally { setBusy(false); }
  };
  return (
    <Popup visible={!!tour} title="투어 처리" onClose={onClose}>
      <Text style={styles.subtitle} numberOfLines={1}>{tour?.title}  ·  {tour?.period}</Text>
      {PROCESS_OPTIONS.map(option => {
        const selected = picked === option.status;
        return (
          <Pressable
            key={option.status}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setPicked(option.status)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? '#00E5FF' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.optionText, selected && styles.optionSelected]}>
              {option.label}{tour?.status === option.status ? ' (현재)' : ''}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.note}>{PROCESS_DAYS}일 안에 처리하지 않으면 '미처리'로 바뀌어요.{'\n'}미처리 투어는 강사 프로필의 진행 투어에서 빠져요.</Text>
      <Buttons confirm="저장" onCancel={onClose} onConfirm={save} busy={busy} disabled={!picked || picked === tour?.status} />
    </Popup>
  );
}

// 9장: 다 찬 투어에서 '+' → 모집 인원 / 최대 인원 다시 설정 (2~20명, 모집 인원 ≤ 최대 인원, 지금 값에서 시작)
export function OverCapacityPopup({ tour, onClose, onConfirm }: {
  tour: { recruitedCount: number; capacity: number } | null;
  onClose: () => void;
  onConfirm: (value: { recruitedCount: number; capacity: number }) => Promise<void>;
}) {
  return (
    <Popup visible={!!tour} title="모집 인원을 초과해요" onClose={onClose}>
      {/* 열릴 때마다 지금 값으로 새로 그려야 휠이 처음부터 그 자리에 있음 */}
      {tour && <OverCapacityBody key={`${tour.recruitedCount}/${tour.capacity}`} tour={tour} onClose={onClose} onConfirm={onConfirm} />}
    </Popup>
  );
}

function OverCapacityBody({ tour, onClose, onConfirm }: {
  tour: { recruitedCount: number; capacity: number };
  onClose: () => void;
  onConfirm: (value: { recruitedCount: number; capacity: number }) => Promise<void>;
}) {
  const [recruited, setRecruited] = useState(tour.recruitedCount);
  const [capacity, setCapacity] = useState(tour.capacity);
  const [busy, setBusy] = useState(false);
  // 모집 인원은 최대 인원보다 클 수 없음: 한쪽을 바꾸면 다른 쪽을 맞춰 줌
  const pickRecruited = (value: number) => { setRecruited(value); if (value > capacity) setCapacity(Math.min(CAPACITY_MAX, value)); };
  const pickCapacity = (value: number) => { setCapacity(value); if (recruited > value) setRecruited(value); };
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm({ recruitedCount: recruited, capacity }); } finally { setBusy(false); }
  };
  return (
    <>
      <Text style={styles.message}>현재 모집 인원과 최대 모집 인원을{'\n'}다시 설정해 주세요.</Text>
      <View style={styles.wheels}>
        <WheelPicker label="모집 인원" values={range(0, CAPACITY_MAX)} value={recruited} onChange={pickRecruited} />
        <Text style={styles.slash}>/</Text>
        <WheelPicker label="최대 인원" values={range(CAPACITY_MIN, CAPACITY_MAX)} value={capacity} onChange={pickCapacity} />
      </View>
      <Buttons confirm="확인" onCancel={onClose} onConfirm={confirm} busy={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  subtitle: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 6, marginBottom: 10 },
  message: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  optionText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  optionSelected: { fontFamily: 'SUIT-Bold', color: Colors.brand.white },
  note: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 8 },
  wheels: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  slash: { fontFamily: 'SUIT-Regular', fontSize: 22, color: 'rgba(255,255,255,0.4)', marginTop: 26 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: {
    flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  cancelText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  confirm: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  confirmText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.primary },
});
