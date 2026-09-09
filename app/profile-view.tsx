import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, Profile } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';
import { useAuth } from '@/contexts/AuthContext';

const LEVEL_LABELS: Record<string, string> = {
  I: 'AIDA Instructor',
  T: 'AIDA Instructor Trainer',
  '4': 'AIDA 4',
  '3': 'AIDA 3',
  '2': 'AIDA 2',
  '1': 'AIDA 1',
};

function formatRecord(val: number | null, unit?: string): string {
  if (val === null || val === undefined) return '--';
  return unit ? `${val}${unit}` : String(val);
}

export default function ProfileViewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const { user: me } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userInfo, setUserInfo] = useState<{ id: number; nickname: string; name?: string; profileImage?: string } | null>(null);
  const [isMyStudent, setIsMyStudent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.getUserProfile(userId)
      .then((res) => {
        setProfile(res.profile);
        setUserInfo(res.user);
        setIsMyStudent(res.isMyStudent ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const levelLabel = profile?.diverLevel ? (LEVEL_LABELS[profile.diverLevel] ?? profile.diverLevel) : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {userInfo?.profileImage ? (
                <Image source={{ uri: userInfo.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{userInfo?.nickname?.charAt(0) ?? '?'}</Text>
                </View>
              )}
            </View>
            <View style={styles.nameArea}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {userInfo?.nickname ?? '사용자'}{userInfo?.name ? ` (${userInfo.name})` : ''}
                </Text>
                <LevelBadge level={profile?.level} />
              </View>
              {levelLabel ? <Text style={styles.role}>{levelLabel}</Text> : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              onPress={() => router.back()}
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          {/* Bio */}
          {profile?.description ? (
            <View style={styles.bioSection}>
              {profile.description.split('\n').map((line, i) => (
                <Text key={i} style={styles.bioText}>{line}</Text>
              ))}
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* Info */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>발사이즈</Text>
              <Text style={styles.infoValue}>
                {profile?.shoesSize ?? '--'}{profile?.finSize ? ` / ${profile.finSize}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Diving Records */}
          <View style={styles.recordSection}>
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>STA</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.sta ?? null, '초')}</Text>
              </View>
            </View>
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>DYNB</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.dynb ?? null, 'm')}</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>DYN</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.dyn ?? null, 'm')}</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>DNF</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.dnf ?? null, 'm')}</Text>
              </View>
            </View>
            <View style={{ height: 6 }} />
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>FIM</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.fim ?? null, 'm')}</Text>
              </View>
            </View>
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>CWTB</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.cwtb ?? null, 'm')}</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>CWT</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.cwt ?? null, 'm')}</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>CNF</Text>
                <Text style={styles.recordValue}>{formatRecord(profile?.cnf ?? null, 'm')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
        </ScrollView>

        {isMyStudent && userInfo && (
          <View style={styles.bottomArea}>
            <Pressable
              style={({ pressed }) => [styles.logButton, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({
                pathname: '/achievement',
                params: {
                  participantId: String(userInfo.id),
                  participantName: userInfo.name ? `${userInfo.nickname} (${userInfo.name})` : userInfo.nickname,
                  participantLevel: profile?.level != null ? String(profile.level) : '',
                  modal: '1',
                },
              })}
            >
              <Text style={styles.logButtonText}>다이빙 로그</Text>
            </Pressable>
          </View>
        )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  avatarWrap: {
    marginRight: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 42, padding: 2,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'SUIT-Bold', fontSize: 32, color: Colors.brand.white },
  nameArea: { flex: 1, justifyContent: 'center', height: 84 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white },
  role: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 20, color: Colors.brand.white },
  bioSection: { marginBottom: 20 },
  bioText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 24 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  infoSection: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)', width: 80 },
  infoValue: { fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  recordSection: { gap: 8 },
  recordRow: { flexDirection: 'row' },
  recordItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)', width: 46 },
  recordValue: { fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  bottomArea: { paddingHorizontal: 24, paddingBottom: 12 },
  logButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  logButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
