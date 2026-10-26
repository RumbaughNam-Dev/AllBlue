import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import GlassCircle from '@/components/GlassCircle';
import { LiquidGlassView } from '@/utils/liquidGlass';

export function NoticeHeader({ title }: { title?: string }) {
  const router = useRouter();
  return <View style={styles.header}>
    <Pressable accessibilityLabel="뒤로가기" onPress={() => router.back()} style={styles.back} hitSlop={8}>
      <GlassCircle>
        <Ionicons name="chevron-back" size={LiquidGlassView ? 20 : 26} color="white" />
      </GlassCircle>
    </Pressable>
    <Text style={styles.headerTitle}>{title}</Text><View style={styles.back} />
  </View>;
}
export function NoticeError({ message, retry }: { message: string; retry?: () => void }) {
  return <View style={styles.empty}><Text style={styles.muted}>{message}</Text>
    {retry && <Pressable onPress={retry} style={styles.button}><Text style={styles.buttonText}>다시 시도</Text></Pressable>}
  </View>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'SUIT-SemiBold', fontSize: 18, color: 'white' },
  pinnedBadge: { flexShrink: 0, backgroundColor: Colors.brand.white, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  pinnedBadgeText: { fontFamily: 'SUIT-SemiBold', fontSize: 10, lineHeight: 14, color: Colors.brand.primary },
  title: { fontFamily: 'SUIT-Bold', fontSize: 23, lineHeight: 32, color: 'white' },
  body: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 25, color: 'white' },
  muted: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 25, color: '#A8BFD6' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: '#306093', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buttonText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 12 },
  input: { backgroundColor: '#20558B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14, color: 'white', padding: 16, fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 24 },
  label: { color: '#A8BFD6', fontFamily: 'SUIT-SemiBold', fontSize: 14, marginBottom: 8 },
});
