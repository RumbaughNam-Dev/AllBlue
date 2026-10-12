import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, Modal, PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PopupBackdrop from '@/components/PopupBackdrop';
import { PopupSlide } from './types';
import { styles } from './ui';

type Props = { items: PopupSlide[]; onClose: () => void; onHideToday: () => void };
export default function PopupCarousel({ items, onClose, onHideToday }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(width - 40, 480);
  const cardHeight = Math.max(160, Math.min(430, height - insets.top - insets.bottom - 160));
  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState<{ next: number; direction: number } | null>(null);
  const [touching, setTouching] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const translation = useRef(new Animated.Value(0)).current;
  const running = useRef(false);
  const move = (direction = 1) => {
    if (running.current || items.length < 2) return;
    running.current = true;
    setTransition({ next: (index + direction + items.length) % items.length, direction });
  };
  const latestMove = useRef(move); latestMove.current = move;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => setTouching(true),
    onPanResponderRelease: (_, g) => { setTouching(false); if (Math.abs(g.dx) > 35) latestMove.current(g.dx > 0 ? 1 : -1); },
    onPanResponderTerminate: () => setTouching(false),
  })).current;
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (items.length < 2 || touching || transition || !foreground) return;
    const timer = setTimeout(() => latestMove.current(1), 5000);
    return () => clearTimeout(timer);
  }, [index, touching, transition, foreground, items.length]);
  useEffect(() => {
    if (!transition) return;
    translation.setValue(0);
    const animation = Animated.timing(translation, { toValue: transition.direction * cardWidth, duration: 350, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (!finished) return;
      setIndex(transition.next); setTransition(null); running.current = false;
    });
    return () => animation.stop();
  }, [transition, cardWidth, translation]);
  const slide = (item: PopupSlide) => <ScrollView key={item.id} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
    <Text style={styles.title}>{item.title}</Text>
    {item.kind === 'image' && <Image accessibilityLabel={item.title} source={{ uri: item.imageUrl }} resizeMode="contain" style={{ width: '100%', height: cardHeight - 100 }} />}
    {!!item.content && <Text style={styles.body}>{item.content}</Text>}
  </ScrollView>;
  if (!items.length) return null;
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <PopupBackdrop />
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: 'rgba(0,15,35,0.4)' }}>
      <View accessibilityViewIsModal style={{ width: cardWidth, backgroundColor: '#144A84', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
        <View {...pan.panHandlers} onTouchStart={() => setTouching(true)} onTouchEnd={() => setTouching(false)} onTouchCancel={() => setTouching(false)} style={{ height: cardHeight, overflow: 'hidden' }}>
          <Animated.View style={{ position: 'absolute', width: cardWidth, height: cardHeight, transform: [{ translateX: transition ? translation : 0 }] }}>{slide(items[index])}</Animated.View>
          {transition && <Animated.View style={{ position: 'absolute', width: cardWidth, height: cardHeight, left: -transition.direction * cardWidth, transform: [{ translateX: translation }] }}>{slide(items[transition.next])}</Animated.View>}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 7 }} accessibilityLabel={`${items.length}개 중 ${index + 1}번째`}>
          {items.map((item, i) => <View key={item.id} style={{ width: i === index ? 22 : 5, height: 5, borderRadius: 3, backgroundColor: i === index ? 'white' : 'rgba(255,255,255,0.3)' }} />)}
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Pressable onPress={onHideToday} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56 }}><Text style={[styles.muted, { fontSize: 13 }]}>오늘 하루 보지 않기</Text></Pressable>
          <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}><Text style={styles.buttonText}>닫기</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
