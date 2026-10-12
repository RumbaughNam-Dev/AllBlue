import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, AccessibilityInfo, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CloseFriend } from '@/services/api';
import { movePinnedId } from '@/utils/pinnedFriends';
import { notifyHoldProgress } from '@/utils/haptics';

type Props = {
  friends: CloseFriend[];
  disabled: boolean;
  renderFriend: (friend: CloseFriend, handle: React.ReactNode) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  onDraggingChange: (dragging: boolean) => void;
  getScrollOffset: () => number;
  autoScroll: (pageY: number, elapsedMs: number) => void;
};
type Drag = { id: string; from: number; to: number; dy: number; pageY: number; startScroll: number; translation: number };

export function DragHandle({ label, disabled, onStart, onMove, onEnd, onStep }: {
  label: string; disabled: boolean;
  onStart: () => void; onMove: (dy: number, pageY: number) => void;
  onEnd: (cancelled: boolean) => void; onStep: (direction: number) => void;
}) {
  const callbacks = useRef({ disabled, onStart, onMove, onEnd });
  callbacks.current = { disabled, onStart, onMove, onEnd };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const pulses = useRef<ReturnType<typeof setTimeout>[]>([]);
  const progress = useRef(new Animated.Value(0)).current;
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pulses.current.forEach(clearTimeout);
    pulses.current = [];
    progress.stopAnimation();
    progress.setValue(0);
    setOrigin(null);
  };
  const finish = (cancelled: boolean) => {
    clear();
    if (active.current) callbacks.current.onEnd(cancelled);
    active.current = false;
  };
  useEffect(() => () => finish(true), []);
  useEffect(() => { if (disabled) finish(true); }, [disabled]);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !callbacks.current.disabled,
    onPanResponderGrant: event => {
      clear();
      if (callbacks.current.disabled) return;
      setOrigin({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
      Animated.timing(progress, { toValue: 1, duration: 350, easing: Easing.linear, useNativeDriver: true }).start();
      // Subtle ticks while filling; never repeat during the subsequent drag.
      pulses.current = [80, 160, 240, 320].map(delay => setTimeout(() => {
        if (!callbacks.current.disabled) void notifyHoldProgress();
      }, delay));
      timer.current = setTimeout(() => {
        clear();
        if (callbacks.current.disabled) return;
        active.current = true;
        callbacks.current.onStart();
      }, 350);
    },
    onPanResponderMove: (_, gesture) => {
      if (active.current) callbacks.current.onMove(gesture.dy, gesture.moveY);
      else if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) clear();
    },
    onPanResponderRelease: () => finish(false),
    onPanResponderTerminate: () => finish(true),
    onPanResponderTerminationRequest: () => !active.current,
  })).current;
  return <View
    {...responder.panHandlers}
    style={styles.handle}
    accessible accessibilityRole="adjustable"
    accessibilityLabel={`${label} 고정 순서`}
    accessibilityHint="길게 누른 뒤 위아래로 끌어서 순서를 변경합니다."
    accessibilityState={{ disabled }}
    accessibilityActions={[{ name: 'increment', label: '아래로 이동' }, { name: 'decrement', label: '위로 이동' }]}
    onAccessibilityAction={event => {
      if (!disabled) onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1);
    }}
  >
    <View pointerEvents="none"><Ionicons name="reorder-three-outline" size={26} color={disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)'} /></View>
    {origin && <View pointerEvents="none" accessible={false} style={{ position: 'absolute', left: origin.x - 28, top: origin.y - 28, width: 56, height: 56, transform: [{ scale: 2 }] }}>
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)' }} />
      {/* Overlapping segments form a continuous ring, revealed clockwise from 12 o'clock on the native driver. */}
      {Array.from({ length: 72 }, (_, i) => {
        const angle = i * Math.PI * 2 / 72;
        return <Animated.View key={i} style={{
          position: 'absolute', width: 3.5, height: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF',
          left: 28 + Math.sin(angle) * 26.5 - 1.75, top: 28 - Math.cos(angle) * 26.5 - 1.5,
          transform: [{ rotate: `${i * 5}deg` }],
          opacity: progress.interpolate({ inputRange: [i / 72, (i + 1) / 72], outputRange: [0, 1], extrapolate: 'clamp' }),
        }} />;
      })}
    </View>}
  </View>;
}

export default function PinnedFriendsList(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const drag = useRef<Drag | null>(null);
  // React state changes only at drag start/end, never for each pointer move.
  const [activeId, setActiveId] = useState<string | null>(null);
  const translations = useRef(new Map<string, Animated.Value>());
  const frame = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const signature = props.friends.map(friend => friend.userId).join('|');
  const translationFor = (id: string) => {
    let value = translations.current.get(id);
    if (!value) {
      value = new Animated.Value(0);
      translations.current.set(id, value);
    }
    return value;
  };
  const stopFrames = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    lastFrame.current = null;
  };
  const updatePosition = () => {
    const current = drag.current;
    if (!current) return;
    const layout = layouts.current.get(current.id);
    if (!layout) return;
    const translation = current.dy + latest.current.getScrollOffset() - current.startScroll;
    if (translation !== current.translation) {
      translationFor(current.id).setValue(translation);
      current.translation = translation;
    }
    const center = layout.y + layout.height / 2 + translation;
    let to = 0;
    latest.current.friends.forEach((friend, index) => {
      const row = layouts.current.get(friend.userId);
      if (row && center > row.y + row.height / 2) to = index + 1;
    });
    if (to > current.from) to--;
    to = Math.max(0, Math.min(latest.current.friends.length - 1, to));
    if (to === current.to) return;
    current.to = to;
    latest.current.friends.forEach((friend, index) => {
      if (friend.userId === current.id) return;
      let offset = 0;
      if (index > current.from && index <= to) offset = -layout.height;
      if (index >= to && index < current.from) offset = layout.height;
      Animated.spring(translationFor(friend.userId), {
        toValue: offset, damping: 24, stiffness: 260, mass: 0.8,
        useNativeDriver: true,
      }).start();
    });
  };
  const animateFrame = (timestamp: number) => {
    if (!drag.current) return;
    const elapsed = lastFrame.current === null ? 16 : Math.min(32, timestamp - lastFrame.current);
    lastFrame.current = timestamp;
    if (drag.current.pageY) latest.current.autoScroll(drag.current.pageY, elapsed);
    updatePosition();
    frame.current = requestAnimationFrame(animateFrame);
  };
  const finish = (cancelled: boolean) => {
    if (!cancelled) updatePosition();
    const current = drag.current;
    drag.current = null;
    stopFrames();
    if (!current) return;
    translations.current.forEach(value => { value.stopAnimation(); value.setValue(0); });
    setActiveId(null);
    latest.current.onDraggingChange(false);
    if (!cancelled && current.from !== current.to) {
      latest.current.onReorder(movePinnedId(latest.current.friends.map(friend => friend.userId), current.from, current.to));
      AccessibilityInfo.announceForAccessibility(`${current.to + 1}번째로 이동했습니다.`);
    }
  };
  useEffect(() => {
    finish(true);
    const ids = new Set(latest.current.friends.map(friend => friend.userId));
    for (const id of translations.current.keys()) {
      if (!ids.has(id)) { translations.current.delete(id); layouts.current.delete(id); }
    }
  }, [signature, props.disabled]);
  useEffect(() => () => {
    stopFrames();
    translations.current.forEach(value => value.stopAnimation());
    if (drag.current) latest.current.onDraggingChange(false);
    drag.current = null;
  }, []);

  return <View>
    {props.friends.map((friend, index) => {
      const active = activeId === friend.userId;
      const disabled = props.disabled || props.friends.length < 2;
      return <Animated.View key={friend.userId}
        onLayout={event => layouts.current.set(friend.userId, event.nativeEvent.layout)}
        style={{ zIndex: active ? 10 : 0, transform: [{ translateY: translationFor(friend.userId) }], opacity: active ? 0.95 : 1 }}
      >
        {props.renderFriend(friend, <DragHandle label={friend.nickname} disabled={disabled}
          onStart={() => {
            if (disabled || drag.current || !layouts.current.has(friend.userId)) return;
            drag.current = { id: friend.userId, from: index, to: index, dy: 0, pageY: 0, startScroll: props.getScrollOffset(), translation: 0 };
            translationFor(friend.userId).stopAnimation();
            setActiveId(friend.userId);
            stopFrames();
            frame.current = requestAnimationFrame(animateFrame);
            props.onDraggingChange(true);
          }}
          onMove={(dy, pageY) => {
            if (!drag.current) return;
            drag.current.dy = dy;
            drag.current.pageY = pageY;
            updatePosition();
          }}
          onEnd={finish}
          onStep={direction => {
            const to = index + direction;
            if (to >= 0 && to < props.friends.length) props.onReorder(movePinnedId(props.friends.map(f => f.userId), index, to));
          }}
        />)}
      </Animated.View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  handle: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
