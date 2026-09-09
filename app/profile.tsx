import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, Profile } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getProfile()
        .then((res) => {
          setProfile(res.profile);
          if (res.user) {
            updateUser({
              nickname: res.user.nickname,
              name: res.user.name,
              profileImage: res.user.profileImage,
            });
          }
        })
        .catch((e) => console.log('[프로필] 조회 실패:', e))
        .finally(() => setLoading(false));
      api.getCertPendingCount()
        .then((res) => setPendingCount(res.count))
        .catch(() => {});
    }, [])
  );

  const levelLabel = profile?.diverLevel ? (LEVEL_LABELS[profile.diverLevel] ?? profile.diverLevel) : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loading ? (
        <View style={styles.loadingArea}>
          <Spinner />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Profile Header */}
            <View style={styles.profileRow}>
              <View style={styles.avatarWrap}>
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{user?.nickname?.charAt(0) ?? '?'}</Text>
                  </View>
                )}
              </View>
              <View style={styles.nameArea}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {user?.nickname ?? '사용자'}{user?.name ? ` (${user.name})` : ''}
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

            {/* Contact Info */}
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

          {/* Bottom Buttons */}
          <View style={styles.bottomArea}>
            {profile?.level === 'A' && (
              <Pressable
                style={({ pressed }) => [styles.certButton, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/cert-manage')}
              >
                <View style={styles.certButtonInner}>
                  <Text style={styles.certButtonText}>자격증 등록 처리</Text>
                  {pendingCount > 0 && (
                    <Text style={styles.certCount}>{pendingCount}건</Text>
                  )}
                </View>
              </Pressable>
            )}
            {/* 자격증 등록 요청 - 햄버거 메뉴로 이동
            {profile?.level !== 5 && (
              <Pressable
                style={({ pressed }) => [styles.certButton, pressed && { opacity: 0.85 }]}
                onPress={async () => {
                  try {
                    const res = await api.checkCertPending();
                    if (res.pending) {
                      Alert.alert('알림', '이미 신청한 등록요청이 있습니다.\n요청 처리가 끝날때까지 기다려주세요.');
                      return;
                    }
                    router.push('/cert-upload');
                  } catch (e: any) {
                    if (!e._handled) router.push('/cert-upload');
                  }
                }}
              >
                <Text style={styles.certButtonText}>자격증 등록 요청</Text>
              </Pressable>
            )} */}
            <Pressable
              style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/profile-edit')}
            >
              <Text style={styles.editButtonText}>프로필 편집</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatarWrap: {
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 42,
    padding: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 32,
    color: Colors.brand.white,
  },
  nameArea: {
    flex: 1,
    justifyContent: 'center',
    height: 84,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontFamily: 'SUIT-Bold',
    fontSize: 20,
    color: Colors.brand.white,
  },
  role: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    fontSize: 20,
    color: Colors.brand.white,
  },
  bioSection: {
    marginBottom: 20,
  },
  bioText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  infoSection: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    width: 80,
  },
  infoValue: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
  },
  recordSection: {
    gap: 8,
  },
  recordRow: {
    flexDirection: 'row',
  },
  recordItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordLabel: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    width: 46,
  },
  recordValue: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 12 : 0,
  },
  certButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  certButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  certButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.primary,
  },
  certCount: {
    fontFamily: 'SUIT-Bold',
    fontSize: 13,
    color: Colors.brand.white,
    backgroundColor: '#E53030',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  editButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },
});
