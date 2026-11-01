import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

// 프로필 링크 (13장): 하얀 링크 아이콘 + 이름 칩, 누르면 그 주소로 (URL은 안 보임)
export default function LinkChips({ links }: { links: { name: string; url: string }[] }) {
  if (!links.length) return null;
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url));
  return (
    <View style={styles.row}>
      {links.map((link, index) => (
        <Pressable
          key={`${index}-${link.url}`}
          accessibilityRole="link"
          accessibilityLabel={`${link.name} 열기`}
          onPress={() => open(link.url)}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="link" size={15} color={Colors.brand.white} />
          <Text style={styles.text} numberOfLines={1}>{link.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  text: { flexShrink: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
});
