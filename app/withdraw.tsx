import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handleWithdraw = () => {
    Alert.alert(
      '회원탈퇴',
      '그래도 탈퇴하시겠어요?\n탈퇴 후에는 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await api.withdrawAccount();
              await logout();
              router.replace('/login');
            } catch (e: any) {
              if (!e._handled) Alert.alert('오류', '회원탈퇴에 실패했습니다.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>회원탈퇴</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.warningIcon}>!</Text>
        <Text style={styles.mainText}>데이터 복구가 불가능합니다.</Text>
        <Text style={styles.subText}>
          회원탈퇴 시 계정 정보, 프로필, 문의 내역 등{'\n'}
          모든 데이터가 영구적으로 삭제되며{'\n'}
          복구가 불가능합니다.
        </Text>
      </View>

      <View style={styles.bottomArea}>
        <Pressable
          style={({ pressed }) => [styles.withdrawButton, pressed && { opacity: 0.85 }, processing && { opacity: 0.5 }]}
          onPress={handleWithdraw}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color={Colors.brand.white} />
          ) : (
            <Text style={styles.withdrawText}>회원탈퇴</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  warningIcon: {
    fontFamily: 'SUIT-Bold', fontSize: 32, color: '#E53030',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(229,48,48,0.12)',
    textAlign: 'center', lineHeight: 60,
    marginBottom: 24, overflow: 'hidden',
  },
  mainText: {
    fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white,
    textAlign: 'center', marginBottom: 12,
  },
  subText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 22,
  },
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  withdrawButton: {
    height: 54, borderRadius: 14,
    backgroundColor: '#E53030',
    alignItems: 'center', justifyContent: 'center',
  },
  withdrawText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
});
