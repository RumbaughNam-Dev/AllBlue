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

export default function ScheduleSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedulePublic, setSchedulePublic] = useState(false);

  useEffect(() => {
    api.getUserSettings()
      .then((res) => {
        setSchedulePublic(res.settings.schedulePublic === 'Y');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (value: boolean) => {
    setSchedulePublic(value);
    try {
      await api.updateUserSetting('schedulePublic', value ? 'Y' : 'N');
    } catch {
      setSchedulePublic(!value);
      Alert.alert('오류', '설정 변경에 실패했습니다.');
    }
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
        <Text style={styles.headerTitle}>일정 설정</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <View style={styles.content}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>일정 공개여부</Text>
            <Switch
              value={schedulePublic}
              onValueChange={handleToggle}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(52,199,89,0.5)' }}
              thumbColor={schedulePublic ? Colors.brand.success : 'rgba(255,255,255,0.6)'}
            />
          </View>
          <Text style={styles.settingDesc}>
            공개로 설정하면 친한친구와 그룹 멤버가 내 일정을 볼 수 있습니다.
          </Text>
        </View>
      )}
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
