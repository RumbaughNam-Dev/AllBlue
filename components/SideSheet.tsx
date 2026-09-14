import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  BackHandler,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MENU_ITEMS = [
  { key: 'cert', label: '자격증 등록 요청' },
  { key: 'inquiry', label: '문의하기' },
  { key: 'blocked', label: '차단 사용자 관리' },
  { key: 'schedule-settings', label: '일정 설정' },
];

export default function SideSheet({ visible, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetWidth = Math.min(width * 0.75, 320);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideAnim.setValue(width);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: width - sheetWidth,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: width,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [visible, onClose]);

  const handleMenuPress = async (key: string) => {
    if (key === 'inquiry') {
      onClose();
      setTimeout(() => router.push('/inquiry'), 300);
      return;
    }
    if (key === 'cert') {
      onClose();
      try {
        const res = await api.checkCertPending();
        if (res.pending) {
          Alert.alert('알림', '이미 신청한 등록요청이 있습니다.\n요청 처리가 끝날때까지 기다려주세요.');
          return;
        }
        setTimeout(() => router.push('/cert-upload'), 300);
      } catch (e: any) {
        if (!e._handled) setTimeout(() => router.push('/cert-upload'), 300);
      }
      return;
    }
    if (key === 'blocked') {
      onClose();
      setTimeout(() => router.push('/blocked-users'), 300);
      return;
    }
    if (key === 'schedule-settings') {
      onClose();
      setTimeout(() => router.push('/schedule-settings'), 300);
      return;
    }
    if (key === 'withdraw') {
      onClose();
      setTimeout(() => router.push('/withdraw'), 300);
      return;
    }
    onClose();
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      logout().then(() => router.replace('/login'));
    }, 300);
  };

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.closeCircle}>
              <Text style={styles.closeArrow}>{'>'}</Text>
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>메뉴</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
              onPress={() => handleMenuPress(item.key)}
            >
              <Text style={styles.menuItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Logout & Withdraw */}
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.6 }]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.withdrawButton, pressed && { opacity: 0.6 }]}
          onPress={() => handleMenuPress('withdraw')}
        >
          <Text style={styles.withdrawText}>회원탈퇴</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginBottom: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeArrow: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
    marginLeft: 1,
  },
  headerTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuItemText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 16,
    color: Colors.brand.white,
  },
  logoutButton: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  logoutText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  withdrawButton: {
    paddingVertical: 12,
  },
  withdrawText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
});
