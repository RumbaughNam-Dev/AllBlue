import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import type { TourLink } from '@/services/api';
import TourLinkPopup from '@/features/tour/TourLinkPopup';
import { moveItem } from '@/features/tour/tourForm';

const ROW = 48;
const GAP = 8;
type Editing = { index: number | null } | null; // index null = 새 링크

// 14장 프로필 편집의 링크 (선택): 이름만 목록으로, 누르면 수정 팝업(삭제 포함),
// 왼쪽 ≡를 길게 눌러 끌면 순서 변경 (프로필에 보이는 순서)
export default function ProfileLinksEditor({ links, onChange, onDragChange }: {
  links: TourLink[];
  onChange: (links: TourLink[]) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const grantedRef = useRef(false);
  const offset = useRef(new Animated.Value(0)).current;
  const latest = useRef({ links, onChange, onDragChange });
  latest.current = { links, onChange, onDragChange };

  const finish = (apply: boolean) => {
    const from = draggingRef.current, to = targetRef.current;
    draggingRef.current = null; targetRef.current = null; grantedRef.current = false;
    setDragging(null); setTarget(null); offset.setValue(0);
    latest.current.onDragChange(false);
    if (apply && from !== null && to !== null && from !== to) latest.current.onChange(moveItem(latest.current.links, from, to));
  };

  const responder = useRef(PanResponder.create({
    // ≡를 길게 눌러 집은 뒤에만 터치를 가져옴
    onMoveShouldSetPanResponderCapture: () => draggingRef.current !== null,
    onPanResponderGrant: () => { grantedRef.current = true; },
    onPanResponderMove: (_, g) => {
      if (draggingRef.current === null) return;
      offset.setValue(g.dy);
      const slot = Math.max(0, Math.min(latest.current.links.length - 1, draggingRef.current + Math.round(g.dy / (ROW + GAP))));
      if (slot !== targetRef.current) { targetRef.current = slot; setTarget(slot); }
    },
    onPanResponderRelease: () => finish(true),
    onPanResponderTerminate: () => finish(false),
    onPanResponderTerminationRequest: () => false,
  })).current;

  const pickUp = (index: number) => {
    draggingRef.current = index; targetRef.current = index;
    setDragging(index); setTarget(index);
    onDragChange(true);
  };

  const editingLink = editing?.index != null ? links[editing.index] : null;

  return (
    <View>
      <View {...responder.panHandlers} style={styles.list}>
        {links.map((link, index) => {
          const lifted = dragging === index;
          return (
            <Animated.View
              key={`${index}-${link.url}`}
              style={[
                styles.row,
                target === index && dragging !== null && !lifted && styles.dropTarget,
                lifted && { zIndex: 2, transform: [{ translateY: offset }, { scale: 1.03 }], opacity: 0.92 },
              ]}
            >
              <Pressable
                accessibilityLabel={`${link.name} 순서 바꾸기`}
                accessibilityHint="길게 누른 채 위아래로 끌어서 순서를 바꿔요"
                delayLongPress={250}
                onLongPress={() => pickUp(index)}
                onPressOut={() => setTimeout(() => { if (draggingRef.current !== null && !grantedRef.current) finish(false); }, 50)}
                hitSlop={8}
                style={styles.handle}
              >
                <Ionicons name="reorder-three" size={20} color="rgba(255,255,255,0.45)" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${link.name} 수정`}
                onPress={() => setEditing({ index })}
                style={({ pressed }) => [styles.body, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.name} numberOfLines={1}>{link.name}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setEditing({ index: null })}
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.addText}>＋ 링크 추가</Text>
      </Pressable>

      <TourLinkPopup
        visible={!!editing}
        initial={editingLink}
        onClose={() => setEditing(null)}
        onAdd={link => {
          // 추가는 목록 맨 아래, 수정은 그 자리
          onChange(editing?.index != null ? links.map((l, i) => (i === editing.index ? link : l)) : [...links, link]);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing?.index != null) onChange(links.filter((_, i) => i !== editing.index));
          setEditing(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: {
    height: ROW, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dropTarget: { borderColor: '#00E5FF' },
  handle: { width: 44, height: ROW, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, height: ROW, flexDirection: 'row', alignItems: 'center', paddingRight: 14, gap: 8 },
  name: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  add: {
    height: ROW, marginTop: GAP, borderRadius: 12, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: '#00E5FF' },
});
