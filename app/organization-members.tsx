import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, PendingMember } from '@/services/api';
import Spinner from '@/components/Spinner';

export default function OrganizationMembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPendingMembers()
      .then((res) => setMembers(res.members ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maskPhone = (p?: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
    return p;
  };

  const handleApprove = (member: PendingMember) => {
    Alert.alert('승인', `${member.nickname}님의 소속 등록을 승인하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '승인', onPress: async () => {
          try {
            await api.approveMember(member.userId);
            setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
          } catch {
            Alert.alert('오류', '승인 처리에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleReject = (member: PendingMember) => {
    Alert.alert('반려', `${member.nickname}님의 소속 등록을 반려하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '반려', style: 'destructive', onPress: async () => {
          try {
            await api.rejectMember(member.userId);
            setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
          } catch {
            Alert.alert('오류', '반려 처리에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>소속 등록요청 처리</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : members.length === 0 ? (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>소속 등록요청이 없습니다.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {members.map((member) => (
            <View key={member.userId} style={styles.card}>
              <View style={styles.cardTop}>
                {member.profileImage ? (
                  <Image source={{ uri: member.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Text style={styles.avatarText}>{member.nickname?.charAt(0) ?? '?'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {member.nickname}{member.name ? ` (${member.name})` : ''}
                  </Text>
                  {member.phone && (
                    <Text style={styles.memberPhone}>{maskPhone(member.phone)}</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={({ pressed }) => [styles.rejectButton, pressed && { opacity: 0.7 }]}
                  onPress={() => handleReject(member)}
                >
                  <Text style={styles.rejectText}>반려</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.approveButton, pressed && { opacity: 0.85 }]}
                  onPress={() => handleApprove(member)}
                >
                  <Text style={styles.approveText}>승인</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
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
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  memberName: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  memberPhone: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  rejectButton: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  approveButton: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  approveText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.primary },
});
