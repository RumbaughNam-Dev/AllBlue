import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UploadProgress } from 'expo-file-system';
import Colors from '@/constants/Colors';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import PopupBackdrop from '@/components/PopupBackdrop';
import Spinner from '@/components/Spinner';

// 업로드 진행 팝업 (2026-11-08): 사진 · 파일을 올리는 동안 파일마다 진행 막대를 보여 줌.
// - 틀은 앱 팝업(투어 Popup)과 같은 남색 유리 판, 막대는 투어 상세 '모집현황' 막대와 같은 색
// - 진행률을 아직 못 받았거나 전체 크기를 모르면 막대 대신 앱 공통 Spinner
// - 빨리 끝나는 업로드는 띄우지 않음 (깜빡임 방지 · iOS 알림 창이 닫힌 뒤에 뜨게)
// 쓰는 법: const uploads = useUploadProgress(); await uploads.run(files, (file, onProgress) => api.uploadX(file.uri, onProgress));
//         화면에 <UploadProgressPopup {...uploads.popup} />

export type UploadFile = { label: string; uri: string; kind?: 'image' | 'file'; mimeType?: string };
export type OnUploadProgress = (progress: UploadProgress) => void;
export type UploadRunner = <T>(files: UploadFile[], upload: (file: UploadFile, onProgress: OnUploadProgress, index: number) => Promise<T>) => Promise<T[]>;
type UploadItem = UploadFile & { status: 'waiting' | 'uploading' | 'done'; sent: number; total: number };

const SHOW_AFTER_MS = 400;
const TRACK = '#0D1B2A'; // 투어 상세 모집현황 막대와 같은 바탕 · 채움
const FILL = Colors.brand.accent;
const CYAN = '#00E5FF';

// 한 장씩 차례로 올리고 결과를 같은 순서로 돌려줌. 실패하면 팝업을 닫고 그대로 던짐 (화면의 오류 알림이 뜸)
export function useUploadProgress() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const run: UploadRunner = useCallback(async <T,>(
    files: UploadFile[], upload: (file: UploadFile, onProgress: OnUploadProgress, index: number) => Promise<T>,
  ): Promise<T[]> => {
    if (!files.length) return [];
    const patch = (index: number, next: Partial<UploadItem>) => {
      if (alive.current) setItems(prev => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
    };
    setItems(files.map(file => ({ ...file, status: 'waiting', sent: 0, total: 0 })));
    timer.current = setTimeout(() => { if (alive.current) setVisible(true); }, SHOW_AFTER_MS);
    try {
      const results: T[] = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        patch(index, { status: 'uploading' });
        let shown = -1;
        results.push(await upload(file, ({ bytesSent, totalBytes }) => {
          // 1%씩 바뀔 때만 다시 그림
          const percent = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : -1;
          if (percent === shown) return;
          shown = percent;
          patch(index, { sent: bytesSent, total: totalBytes });
        }, index));
        patch(index, { status: 'done' });
      }
      return results;
    } finally {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (alive.current) setVisible(false);
    }
  }, []);

  return { run, popup: { visible, items } };
}

export function UploadProgressPopup({ visible, items, title }: { visible: boolean; items: UploadItem[]; title?: string }) {
  // 아이폰 듀오: 오른쪽 여백(카메라 · 상태 표시)을 빼고 그림 (투어 Popup과 같게)
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const images = items.every(item => item.kind !== 'file');
  const done = items.filter(item => item.status === 'done').length;
  return (
    // 올리는 중에는 닫을 수 없음 (Android 뒤로가기도 무시)
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <PopupBackdrop />
      <View style={[styles.center, { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]}>
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>{title ?? (images ? '사진 올리는 중' : '파일 올리는 중')}</Text>
          <Text style={styles.subtitle}>
            {items.length > 1 ? `${done} / ${items.length}${images ? '장' : '개'} 올렸어요` : '다 올릴 때까지 화면을 닫지 말아 주세요'}
          </Text>
          <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {items.map((item, index) => <UploadRow key={`${index}-${item.uri}`} item={item} />)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const known = item.total > 0;
  const ratio = item.status === 'done' ? 1 : known ? Math.min(1, item.sent / item.total) : 0;
  const percent = Math.round(ratio * 100);
  const detail = item.status === 'done' ? '완료'
    : item.status === 'waiting' ? '기다리는 중'
    : known ? `${formatBytes(item.sent)} / ${formatBytes(item.total)}`
    : '준비 중';
  return (
    <View style={styles.row}>
      {item.kind === 'file' ? (
        <View style={[styles.thumb, styles.fileThumb]}><Ionicons name="document-text-outline" size={20} color="#B8D4F0" /></View>
      ) : <Image source={{ uri: item.uri }} style={styles.thumb} />}
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={`${item.label} 올리는 중`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
      </View>
      <View style={styles.side}>
        {item.status === 'done' ? <Ionicons name="checkmark-circle" size={22} color={CYAN} />
          : item.status === 'waiting' ? <Text style={styles.waiting}>대기</Text>
          : known ? <Text style={styles.percent}>{`${percent}%`}</Text>
          : <Spinner size={20} />}
      </View>
    </View>
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  subtitle: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6 },
  list: { gap: 14, paddingTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  fileThumb: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  track: { height: 5, borderRadius: 3, backgroundColor: TRACK, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: FILL },
  detail: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  side: { width: 44, alignItems: 'flex-end', justifyContent: 'center' },
  percent: { fontFamily: 'SUIT-Bold', fontSize: 13, color: CYAN },
  waiting: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
});
