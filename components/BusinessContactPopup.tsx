import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';

const EMAIL = 'rumbau.studio@gmail.com';
const INSTAGRAM = 'rumbaugh.nam';

export default function BusinessContactPopup({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const open = async (url: string) => {
    onClose();
    try { await Linking.openURL(url); }
    catch {
      Alert.alert('연결할 수 없습니다', url.startsWith('mailto:')
        ? `메일 앱을 설정한 후 다시 시도해주세요.\n${EMAIL}`
        : `인스타그램에서 @${INSTAGRAM} 계정으로 DM을 보내주세요.`);
    }
  };
  return <View style={[styles.overlay, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="광고 문의 닫기" onPress={onClose} />
    <View accessibilityViewIsModal style={[styles.card, glassClear]}>
      <GlassBackground radius={24} tintColor={PANEL_TINT} />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.header}>
          <View style={styles.symbol}><Ionicons name="chatbubbles-outline" size={25} color={Colors.brand.accent} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color="white" /></Pressable>
        </View>
        <Text style={styles.title}>광고 문의</Text>
        <Text style={styles.description}>광고 문의는 아래 메일이나 인스타그램 DM으로 해 주세요.</Text>
        <Pressable accessibilityRole="button" onPress={() => void open(`mailto:${EMAIL}`)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <View style={styles.icon}><Ionicons name="mail-outline" size={24} color="white" /></View>
          <View style={styles.buttonContent}><Text style={styles.buttonTitle}>메일 보내기</Text><Text style={styles.address}>{EMAIL}</Text></View>
          <Ionicons name="chevron-forward" size={18} color="#A8BFD6" />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void open(`https://ig.me/m/${INSTAGRAM}`)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <View style={styles.icon}><Ionicons name="logo-instagram" size={24} color="white" /></View>
          <View style={styles.buttonContent}><Text style={styles.buttonTitle}>인스타 DM 보내기</Text><Text style={styles.address}>@{INSTAGRAM}</Text></View>
          <Ionicons name="chevron-forward" size={18} color="#A8BFD6" />
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,15,35,0.4)' },
  card: { width: '100%', maxWidth: 440, maxHeight: '100%', backgroundColor: Colors.brand.primary, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  content: { padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  symbol: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,180,216,0.14)' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: 'white', fontFamily: 'SUIT-Bold', fontSize: 24, lineHeight: 32 },
  description: { color: '#A8BFD6', fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 24, marginTop: 10, marginBottom: 24 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#306093', marginBottom: 12 },
  pressed: { opacity: 0.7 },
  icon: { width: 36, alignItems: 'center' },
  buttonContent: { flex: 1 },
  buttonTitle: { color: 'white', fontFamily: 'SUIT-SemiBold', fontSize: 15, lineHeight: 23 },
  address: { color: '#B5CBE0', fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 19, marginTop: 3 },
});
