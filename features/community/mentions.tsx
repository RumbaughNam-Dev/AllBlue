import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { api, type CommunityMention, type MentionUser } from '@/services/api';

// 커서 바로 앞의 '@검색어' (띄어쓰기 전까지). 없으면 null
export function mentionQuery(text: string, caret: number) {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null;
}

// '@검색어'를 '@닉네임 '으로 바꾸고, 새 커서 자리를 돌려줌
export function insertMention(text: string, caret: number, nickname: string) {
  const found = mentionQuery(text, caret);
  if (!found) return { text, caret };
  const inserted = `@${nickname} `;
  return { text: text.slice(0, found.start) + inserted + text.slice(caret), caret: found.start + inserted.length };
}

// 글에 '@닉네임'이 남아 있는 사람만 보냄 (서버도 같은 규칙)
export const keptMentionIds = (text: string, picked: CommunityMention[]) =>
  [...new Set(picked.filter(m => text.includes(`@${m.nickname}`)).map(m => m.userId))];

// 8장 사용자 태그: @를 치면 아래(댓글 입력은 위)로 사용자 목록, 누르면 태그로 넣음
export function useMentions(text: string, setText: (text: string) => void) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [picked, setPicked] = useState<CommunityMention[]>([]);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const active = selection.start === selection.end ? mentionQuery(text, selection.start) : null;
  const query = active?.query ?? null;
  const request = useRef(0);

  useEffect(() => {
    if (query === null) { setUsers([]); return; }
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api.getMentionUsers(query)
        .then(res => { if (id === request.current) setUsers(res.users); })
        .catch(() => { if (id === request.current) setUsers([]); })
        .finally(() => { if (id === request.current) setLoading(false); });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (user: MentionUser) => {
    const next = insertMention(text, selection.start, user.nickname);
    setText(next.text);
    setSelection({ start: next.caret, end: next.caret });
    setPicked(prev => prev.some(p => p.userId === user.userId) ? prev : [...prev, { userId: user.userId, nickname: user.nickname }]);
  };

  return {
    open: query !== null,
    users, loading, pick,
    // Controlled selection so the caret lands after an inserted tag.
    inputProps: { selection, onSelectionChange: (e: { nativeEvent: { selection: { start: number; end: number } } }) => setSelection(e.nativeEvent.selection) },
    mentionIds: () => keptMentionIds(text, picked),
    // 답글 달기: 입력칸을 '@닉네임 '으로 채움 (9장)
    prefill: (mention: CommunityMention) => {
      const next = `@${mention.nickname} `;
      setText(next);
      setSelection({ start: next.length, end: next.length });
      setPicked(prev => prev.some(p => p.userId === mention.userId) ? prev : [...prev, mention]);
    },
    reset: (initial: CommunityMention[] = []) => { setPicked(initial); setSelection({ start: 0, end: 0 }); },
  };
}

export function MentionSuggestions({ users, loading, onPick }: { users: MentionUser[]; loading: boolean; onPick: (user: MentionUser) => void }) {
  return (
    <View style={styles.box}>
      {loading && !users.length ? <ActivityIndicator style={{ padding: 12 }} color="rgba(255,255,255,0.6)" />
        : !users.length ? <Text style={styles.empty}>닉네임을 입력해 보세요</Text>
        : users.slice(0, 6).map(user => (
          <Pressable key={user.userId} onPress={() => onPick(user)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            {user.profileImage ? <Image source={{ uri: user.profileImage }} style={styles.avatar} /> : (
              <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{user.nickname.charAt(0)}</Text></View>
            )}
            <Text style={styles.name} numberOfLines={1}>{user.nickname}</Text>
            {user.isFriend && <Text style={styles.friend}>친구</Text>}
          </Pressable>
        ))}
    </View>
  );
}

// 본문 · 댓글의 '@닉네임'을 강조하고, 누르면 그 사람 프로필
export function MentionText({ text, mentions, style, onOpenUser }: {
  text: string; mentions: CommunityMention[]; style: object; onOpenUser: (userId: string) => void;
}) {
  if (!mentions.length) return <Text style={style}>{text}</Text>;
  const names = [...mentions].sort((a, b) => b.nickname.length - a.nickname.length);
  const parts: React.ReactNode[] = [];
  let rest = text, key = 0;
  while (rest) {
    let best: { index: number; mention: CommunityMention } | null = null;
    for (const mention of names) {
      const index = rest.indexOf(`@${mention.nickname}`);
      if (index >= 0 && (!best || index < best.index)) best = { index, mention };
    }
    if (!best) { parts.push(rest); break; }
    if (best.index) parts.push(rest.slice(0, best.index));
    const { mention } = best;
    parts.push(<Text key={key++} style={styles.mention} onPress={() => onOpenUser(mention.userId)}>@{mention.nickname}</Text>);
    rest = rest.slice(best.index + mention.nickname.length + 1);
  }
  return <Text style={style}>{parts}</Text>;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#0F3D6E', borderRadius: 14, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  placeholder: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'white' },
  name: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'white' },
  friend: { fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.accent },
  empty: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.45)', padding: 12 },
  mention: { color: Colors.brand.accent, fontFamily: 'SUIT-SemiBold' },
});
