import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CloseFriend } from '@/services/api';
import { movePinnedId } from '@/utils/pinnedFriends';

type Props = {
  friends: CloseFriend[];
  disabled: boolean;
  renderFriend: (friend: CloseFriend, handle: React.ReactNode) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  onDraggingChange: (dragging: boolean) => void;
  getScrollOffset: () => number;
  autoScroll: (pageY: number) => void;
};
type Drag = { id: string; from: number; to: number; dy: number; pageY: number; startScroll: number; translation: number };

function DragHandle({ label, disabled, onStart, onMove, onEnd, onStep }: {
  label: string; disabled: boolean;
  onStart: () => void; onMove: (dy: number, pageY: number) => void;
  onEnd: (cancelled: boolean) => void; onStep: (direction: number) => void;
}) {
  const callbacks = useRef({ disabled, onStart, onMove, onEnd });
  callbacks.current = { disabled, onStart, onMove, onEnd };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const finish = (cancelled: boolean) => {
    clear();
    if (active.current) callbacks.current.onEnd(cancelled);
    active.current = false;
  };
  useEffect(() => () => finish(true), []);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !callbacks.current.disabled,
    onPanResponderGrant: () => {
      clear();
      timer.current = setTimeout(() => {
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
  ><Ionicons name="reorder-three-outline" size={26} color={disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)'} /></View>;
}

export default function PinnedFriendsList(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const drag = useRef<Drag | null>(null);
  const [visual, setVisual] = useState<Drag | null>(null);
  const signature = props.friends.map(friend => friend.userId).join('|');
  const finish = (cancelled: boolean) => {
    const current = drag.current;
    drag.current = null;
    setVisual(null);
    if (!current) return;
    latest.current.onDraggingChange(false);
    if (!cancelled && current.from !== current.to) {
      latest.current.onReorder(movePinnedId(latest.current.friends.map(friend => friend.userId), current.from, current.to));
      AccessibilityInfo.announceForAccessibility(`${current.to + 1}번째로 이동했습니다.`);
    }
  };
  useEffect(() => { finish(true); }, [signature, props.disabled]);
  useEffect(() => () => { if (drag.current) latest.current.onDraggingChange(false); }, []);

  useEffect(() => {
    if (!visual) return;
    const tick = setInterval(() => {
      const current = drag.current;
      if (!current) return;
      if (current.pageY) latest.current.autoScroll(current.pageY);
      const layout = layouts.current.get(current.id);
      if (!layout) return;
      const translation = current.dy + latest.current.getScrollOffset() - current.startScroll;
      const center = layout.y + layout.height / 2 + translation;
      let to = 0;
      latest.current.friends.forEach((friend, index) => {
        const row = layouts.current.get(friend.userId);
        if (row && center > row.y + row.height / 2) to = index + 1;
      });
      if (to > current.from) to--;
      to = Math.max(0, Math.min(latest.current.friends.length - 1, to));
      drag.current = { ...current, to, translation };
      setVisual(drag.current);
    }, 32);
    return () => clearInterval(tick);
  }, [!!visual]);

  return <View>
    {props.friends.map((friend, index) => {
      const active = visual?.id === friend.userId;
      const height = visual ? layouts.current.get(visual.id)?.height ?? 0 : 0;
      let translateY = active ? visual!.translation : 0;
      if (visual && !active) {
        if (index > visual.from && index <= visual.to) translateY = -height;
        if (index >= visual.to && index < visual.from) translateY = height;
      }
      const disabled = props.disabled || props.friends.length < 2;
      return <View key={friend.userId}
        onLayout={event => layouts.current.set(friend.userId, event.nativeEvent.layout)}
        style={{ zIndex: active ? 10 : 0, transform: [{ translateY }], opacity: active ? 0.95 : 1 }}
      >
        {props.renderFriend(friend, <DragHandle label={friend.nickname} disabled={disabled}
          onStart={() => {
            if (!layouts.current.has(friend.userId)) return;
            drag.current = { id: friend.userId, from: index, to: index, dy: 0, pageY: 0, startScroll: props.getScrollOffset(), translation: 0 };
            setVisual(drag.current);
            props.onDraggingChange(true);
          }}
          onMove={(dy, pageY) => { if (drag.current) drag.current = { ...drag.current, dy, pageY }; }}
          onEnd={finish}
          onStep={direction => {
            const to = index + direction;
            if (to >= 0 && to < props.friends.length) props.onReorder(movePinnedId(props.friends.map(f => f.userId), index, to));
          }}
        />)}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  handle: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
