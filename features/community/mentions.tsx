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
    // 입력칸에 넣을 글자 (고른 태그는 푸른색): <TextInput ...>{mentions.styled}</TextInput>
    styled: <MentionInputText text={text} mentions={picked} />,
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
// 글을 '@닉네임'(태그) 조각과 나머지 글자로 나눔 (긴 닉네임 먼저 맞춤)
export function splitMentions(text: string, mentions: CommunityMention[]) {
  const parts: { text: string; mention?: CommunityMention }[] = [];
  const names = [...mentions].sort((a, b) => b.nickname.length - a.nickname.length);
  let rest = text;
  while (rest) {
    let best: { index: number; mention: CommunityMention } | null = null;
    for (const mention of names) {
      const index = rest.indexOf(`@${mention.nickname}`);
      if (index >= 0 && (!best || index < best.index)) best = { index, mention };
    }
    if (!best) { parts.push({ text: rest }); break; }
    if (best.index) parts.push({ text: rest.slice(0, best.index) });
    parts.push({ text: `@${best.mention.nickname}`, mention: best.mention });
    rest = rest.slice(best.index + best.mention.nickname.length + 1);
  }
  return parts;
}

// 태그는 푸른색. onOpenUser가 있으면 눌러서 프로필 (커뮤니티 홈 출석인사처럼 없으면 색만)
export function MentionText({ text, mentions, style, onOpenUser }: {
  text: string; mentions: CommunityMention[]; style: object; onOpenUser?: (userId: string) => void;
}) {
  if (!mentions.length) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {splitMentions(text, mentions).map((part, i) => (part.mention
        ? <Text key={i} style={styles.mention} onPress={onOpenUser && (() => onOpenUser(part.mention!.userId))}>{part.text}</Text>
        : part.text))}
    </Text>
  );
}

// 입력칸 안에서도 고른 사람은 푸른색으로 (TextInput에 value 대신 children으로 넘김)
export function MentionInputText({ text, mentions }: { text: string; mentions: CommunityMention[] }) {
  return (
    <>
      {splitMentions(text, mentions).map((part, i) => (part.mention ? <Text key={i} style={styles.mention}>{part.text}</Text> : part.text))}
    </>
  );
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
