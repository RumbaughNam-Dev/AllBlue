import React, { useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import type { LocalImage } from './tourForm';

const COLUMNS = 4;
const GAP = 8;

type Props = {
  images: LocalImage[];
  max: number;
  width: number;
  error?: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  // The screen stops scrolling while a photo is being dragged.
  onDragChange: (dragging: boolean) => void;
};

// 소개 이미지: 맨 앞이 대표. 길게 누른 채 끌면 순서 변경, ✕로 삭제.
export default function TourImageGrid({ images, max, width, error, onAdd, onRemove, onMove, onDragChange }: Props) {
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);
  // True once the drag has taken over the touch from the photo's press.
  const grantedRef = useRef(false);
  const targetRef = useRef<number | null>(null);
  const offset = useRef(new Animated.ValueXY()).current;
  const latest = useRef({ count: images.length, size, onMove, onDragChange });
  latest.current = { count: images.length, size, onMove, onDragChange };

  const slotAt = (from: number, dx: number, dy: number) => {
    const { count, size: s } = latest.current;
    const col = Math.round((from % COLUMNS) + dx / (s + GAP));
    const row = Math.round(Math.floor(from / COLUMNS) + dy / (s + GAP));
    const clampedCol = Math.max(0, Math.min(COLUMNS - 1, col));
    return Math.max(0, Math.min(count - 1, Math.max(0, row) * COLUMNS + clampedCol));
  };

  const finish = (apply: boolean) => {
    const from = draggingRef.current, to = targetRef.current;
    draggingRef.current = null; targetRef.current = null; grantedRef.current = false;
    setDragging(null); setTarget(null);
    offset.setValue({ x: 0, y: 0 });
    latest.current.onDragChange(false);
    if (apply && from !== null && to !== null && from !== to) latest.current.onMove(from, to);
  };

  const responder = useRef(PanResponder.create({
    // Only after a long press picked a photo up: then take the touch away from the photo's press.
    onMoveShouldSetPanResponderCapture: () => draggingRef.current !== null,
    onPanResponderGrant: () => { grantedRef.current = true; },
    onPanResponderMove: (_, g) => {
      if (draggingRef.current === null) return;
      offset.setValue({ x: g.dx, y: g.dy });
      const slot = slotAt(draggingRef.current, g.dx, g.dy);
      if (slot !== targetRef.current) { targetRef.current = slot; setTarget(slot); }
    },
    onPanResponderRelease: () => finish(true),
    onPanResponderTerminate: () => finish(false),
    onPanResponderTerminationRequest: () => false,
  })).current;

  const pickUp = (index: number) => {
    draggingRef.current = index; targetRef.current = index;
    setDragging(index); setTarget(index);
    latest.current.onDragChange(true);
  };

  return (
    <View style={[styles.grid, { width }]} {...responder.panHandlers}>
      {images.map((image, index) => {
        const lifted = dragging === index;
        return (
          <Animated.View
            key={image.uri}
            style={[
              { width: size, height: size },
              target === index && dragging !== null && !lifted && styles.dropTarget,
              lifted && { zIndex: 2, transform: [...offset.getTranslateTransform(), { scale: 1.08 }], opacity: 0.9 },
            ]}
          >
            <Pressable
              accessibilityLabel={`소개 이미지 ${index + 1}`}
              accessibilityHint="길게 누른 채 끌어서 순서를 바꿔요"
              delayLongPress={300}
              onLongPress={() => pickUp(index)}
              // Picked up but let go without moving: put it back. (When the drag takes over, the press is
              // cancelled too; the drag then finishes on release instead.)
              onPressOut={() => setTimeout(() => { if (draggingRef.current !== null && !grantedRef.current) finish(false); }, 50)}
              style={styles.fill}
            >
              <Image source={{ uri: image.uri }} style={[styles.image, { width: size, height: size }]} />
              {index === 0 && (
                <View style={styles.coverBadge}><Text style={styles.coverText}>대표</Text></View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`소개 이미지 ${index + 1} 삭제`}
              hitSlop={8}
              onPress={() => onRemove(index)}
              style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={14} color={Colors.brand.white} />
            </Pressable>
          </Animated.View>
        );
      })}
      {images.length < max && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="소개 이미지 추가"
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { width: size, height: size }, error && styles.addError, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" />
          <Text style={styles.addCount}>{images.length}/{max}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  fill: {
    flex: 1,
  },
  image: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dropTarget: {
    opacity: 0.5,
  },
  coverBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 10,
    color: Colors.brand.white,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  add: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addError: {
    borderColor: '#FF6B6B',
  },
  addCount: {
    fontFamily: 'SUIT-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
});
