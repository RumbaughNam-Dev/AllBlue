import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import LinkIcon from '@/components/LinkIcon';

// 프로필 링크 '더보기' 팝업: 링크 전부를 한 줄씩 (아이콘 + 이름), 누르면 닫고 그 주소로
// 틀은 프로필 링크 추가 팝업(ProfileLinkPopup)과 같은 가운데 유리 판, 줄은 프로필 편집의 링크 목록과 같은 모양
export default function LinksPopup({ visible, links, onClose, onOpen }: {
  visible: boolean;
  links: { name: string; url: string }[];
  onClose: () => void;
  onOpen: (url: string) => void;
}) {
  // 아이폰 듀오: 오른쪽 여백(카메라 · 상태 표시)을 빼고 그림
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.center, { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]} pointerEvents="box-none">
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>링크 {links.length}</Text>
          <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {links.map((link, index) => (
              <Pressable
                key={`${index}-${link.url}`}
                accessibilityRole="link"
                accessibilityLabel={`${link.name} 열기`}
                onPress={() => { onClose(); onOpen(link.url); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.icon}><LinkIcon url={link.url} size={18} /></View>
                <Text style={styles.name} numberOfLines={1}>{link.name}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  list: { gap: 8, paddingTop: 16 },
  row: {
    height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  icon: { width: 20, alignItems: 'center' },
  name: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  close: {
    height: 50, marginTop: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  closeText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
});
