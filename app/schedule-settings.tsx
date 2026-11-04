import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAuth } from '@/contexts/AuthContext';
import { hasInstructorAccess } from '@/utils/userRole';

type SettingKey = 'schedulePublic' | 'tourWishNotify';

// 우측 상단 메뉴 > 설정: 제목별로 묶음 (일정 · 투어). 투어는 강사·admin만 보임
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const showTour = hasInstructorAccess(user?.level);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<SettingKey, boolean>>({ schedulePublic: false, tourWishNotify: false });

  useEffect(() => {
    api.getUserSettings()
      .then((res) => {
        setValues({
          schedulePublic: res.settings.schedulePublic === 'Y',
          tourWishNotify: res.settings.tourWishNotify === 'Y',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: SettingKey, value: boolean) => {
    setValues(prev => ({ ...prev, [key]: value }));
    try {
      await api.updateUserSetting(key, value ? 'Y' : 'N');
    } catch {
      setValues(prev => ({ ...prev, [key]: !value }));
      Alert.alert('오류', '설정 변경에 실패했습니다.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <StripBackSlot size={36}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>일정</Text>
          <ToggleRow label="일정 공개여부" value={values.schedulePublic} onChange={v => handleToggle('schedulePublic', v)} />
          <Text style={styles.settingDesc}>
            공개로 설정하면 친한친구와 그룹 멤버가 내 일정을 볼 수 있습니다.
          </Text>

          {showTour && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionGap]}>투어</Text>
              <ToggleRow label="투어 역제안 알림 허용" value={values.tourWishNotify} onChange={v => handleToggle('tourWishNotify', v)} />
              <Text style={styles.settingDesc}>
                켜 두면 투어에 가고 싶은 다이버의 역제안 알림을 받을 수 있습니다.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(52,199,89,0.5)' }}
        thumbColor={value ? Colors.brand.success : 'rgba(255,255,255,0.6)'}
      />
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
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  sectionTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 13, color: 'rgba(255,255,255,0.5)',
    marginBottom: 8, paddingHorizontal: 4,
  },
  sectionGap: { marginTop: 28 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
  },
  settingDesc: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 8, paddingHorizontal: 4, lineHeight: 18,
  },
});
