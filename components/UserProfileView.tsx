import { formatSta } from '@/utils/sta';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, Profile, Organization, Certification } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';
import { useAuth } from '@/contexts/AuthContext';
import { hasInstructorAccess } from '@/utils/userRole';

function formatRecord(val: number | null, unit?: string): string {
  if (val === null || val === undefined) return '--';
  return unit ? `${val}${unit}` : String(val);
}

export type ProfileLogParams = { participantId: string; profileUserId: string; participantName: string; participantLevel: string; modal: string };

type Props = { userId: string; onClose: () => void; onOpenLog?: (params: ProfileLogParams) => void };

export default function UserProfileView({ userId, onClose, onOpenLog }: Props) {
  const insets = useSafeAreaInsets();

  const { user: me } = useAuth();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userInfo, setUserInfo] = useState<{ id: number; isTemporary?: boolean; nickname: string; name?: string; profileImage?: string } | null>(null);
  const [isMyStudent, setIsMyStudent] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setIsMyStudent(false);
    setUserInfo(null);
    setLoading(true); setError(false); setProfile(null); setCertifications([]); setOrganization(null);
    if (!userId) { setLoading(false); setError(true); return; }
    api.getUserProfile(userId)
      .then((res) => {
        if (!active) return;
        setProfile(res.profile);
        setCertifications(res.certifications ?? []);
        setUserInfo(res.user);
        setIsMyStudent(res.isMyStudent ?? false);
        if (res.user.organization && res.user.organization.status !== 'rejected') {
          setOrganization(res.user.organization);
        }
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, me?.id, retry]);


  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loading || error ? (
        <View style={styles.loadingArea}>
          <Pressable style={styles.loadingClose} onPress={onClose} accessibilityRole="button" accessibilityLabel="프로필 닫기"><Text style={styles.closeX}>✕</Text></Pressable>
          {loading ? <Spinner /> : <>
            <Text style={styles.bioText}>프로필을 불러오지 못했습니다.</Text>
            <Pressable onPress={() => setRetry(value => value + 1)} accessibilityRole="button"><Text style={styles.bioText}>다시 시도</Text></Pressable>
          </>}
        </View>
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
                  {userInfo?.nickname ?? '사용자'}{userInfo?.isTemporary ? ' · 임시 사용자' : ''}{userInfo?.name && userInfo.name !== userInfo.nickname ? ` (${userInfo.name})` : ''}
                </Text>
                <LevelBadge level={profile?.level} />
              </View>
              {certifications.map((cert) => (
                  <Text key={cert.id} style={styles.role}>{cert.nameKo?.trim() || cert.name}</Text>
                ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              onPress={onClose} accessibilityRole="button" accessibilityLabel="프로필 닫기"
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          {/* Organization */}
          {organization && (profile?.level === 5 || profile?.level === '5' || profile?.level === 'A') && (
            <View style={styles.orgSection}>
              <Text style={styles.orgLabel}>소속단체</Text>
              <Text style={styles.orgName}>{organization.name}</Text>
            </View>
          )}

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
                <Text style={styles.recordValue}>{formatSta(profile?.sta)}</Text>
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

        {onOpenLog && hasInstructorAccess(me?.level) && isMyStudent && userInfo && (
          <View style={styles.bottomArea}>
            <Pressable
              style={({ pressed }) => [styles.logButton, pressed && { opacity: 0.85 }]}
              onPress={() => onOpenLog({
                  participantId: String(userInfo.id),
                  profileUserId: userId,
                  participantName: userInfo.name ? `${userInfo.nickname} (${userInfo.name})` : userInfo.nickname,
                  participantLevel: profile?.level != null ? String(profile.level) : '',
                  modal: '1',
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
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingClose: { position: 'absolute', top: 0, right: 24, padding: 10 },
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
  orgSection: { marginBottom: 16 },
  orgLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  orgName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
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
