import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  Platform, Keyboard, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';

type BottomSheetItem = { label: string; value: any };

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: BottomSheetItem[];
  onSelect: (value: any) => void;
  searchable?: boolean;
  selectedValue?: any;
};

export default function BottomSheet({ visible, onClose, title, items, onSelect, searchable, selectedValue }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [filterText, setFilterText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const ITEM_HEIGHT = 49; // paddingVertical 14 * 2 + fontSize 16 + border 1

  useEffect(() => {
    if (!searchable) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    };
    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => { sub1.remove(); sub2.remove(); };
  }, [searchable]);

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      keyboardAnim.setValue(0);
      setMounted(true);
      setFilterText('');
      slideAnim.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start(() => {
        if (selectedValue !== undefined && scrollRef.current) {
          const idx = items.findIndex((item) => {
            if (typeof item.value === 'object' && typeof selectedValue === 'object') {
              return JSON.stringify(item.value) === JSON.stringify(selectedValue);
            }
            return item.value === selectedValue;
          });
          if (idx > 0) {
            scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
          }
        }
      });
    } else if (mounted) {
      Keyboard.dismiss();
      keyboardAnim.setValue(0);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: screenHeight, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const filtered = filterText.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(filterText.trim().toLowerCase()))
    : items;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>
      <Animated.View style={[
        styles.container,
        { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }], bottom: searchable ? keyboardAnim : 0 },
      ]}>
        <Text style={styles.title}>{title}</Text>
        {searchable && (
          <TextInput
            style={styles.searchInput}
            value={filterText}
            onChangeText={setFilterText}
            placeholder="검색"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCorrect={false}
          />
        )}
        <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedValue !== undefined && (
                typeof item.value === 'object' && typeof selectedValue === 'object'
                  ? JSON.stringify(item.value) === JSON.stringify(selectedValue)
                  : item.value === selectedValue
              );
              return (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>{item.label}</Text>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.brand.deep, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 24, height: '50%',
  },
  title: {
    fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, marginBottom: 16,
  },
  scroll: { marginBottom: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemText: { fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white },
  itemTextSelected: { fontFamily: 'SUIT-Bold', color: Colors.brand.accent },
  checkMark: { fontSize: 16, color: Colors.brand.accent, marginLeft: 8 },
  searchInput: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', paddingVertical: 24,
  },
});
