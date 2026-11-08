import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import LinkIcon from '@/components/LinkIcon';
import LinksPopup from '@/components/LinksPopup';

// 프로필 링크 칩에 바로 보이는 개수 (2026-11-08): 3개부터는 '더보기' 칩 → 팝업에 전부
export const VISIBLE_LINKS = 2;

// 프로필 링크 (13장): 아이콘 + 이름 칩, 누르면 그 주소로 (URL은 안 보임)
// 아이콘은 주소를 보고 인스타그램 · 유튜브 · 카카오톡이면 그 서비스 아이콘, 나머지는 하얀 링크 아이콘 (LinkIcon)
// 칩은 줄이 모자라면 다음 줄로 (링크 2개 + 더보기까지 최대 3줄), 칩 하나가 한 줄보다 길면 이름 끝을 줄임
export default function LinkChips({ links }: { links: { name: string; url: string }[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!links.length) return null;
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('링크를 열 수 없어요', url));
  const more = links.length > VISIBLE_LINKS;
  return (
    <View style={styles.row}>
      {(more ? links.slice(0, VISIBLE_LINKS) : links).map((link, index) => (
        <Pressable
          key={`${index}-${link.url}`}
          accessibilityRole="link"
          accessibilityLabel={`${link.name} 열기`}
          onPress={() => open(link.url)}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
        >
          <LinkIcon url={link.url} />
          <Text style={styles.text} numberOfLines={1}>{link.name}</Text>
        </Pressable>
      ))}
      {more ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`링크 ${links.length}개 모두 보기`}
          onPress={() => setShowAll(true)}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="ellipsis-horizontal" size={15} color={Colors.brand.white} />
          <Text style={styles.text}>더보기</Text>
        </Pressable>
      ) : null}
      <LinksPopup visible={showAll} links={links} onClose={() => setShowAll(false)} onOpen={open} />
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
