import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, Organization } from '@/services/api';
import Spinner from '@/components/Spinner';

export default function OrganizationManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    api.getPendingOrganizations()
      .then((res) => setOrganizations(res.organizations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = (org: Organization) => {
    Alert.alert('승인', `"${org.name}" 단체를 승인하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '승인', onPress: async () => {
          try {
            await api.approveOrganization(org.id);
            setOrganizations((prev) => prev.filter((o) => o.id !== org.id));
          } catch {
            Alert.alert('오류', '승인 처리에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleReject = (org: Organization) => {
    Alert.alert('반려', `"${org.name}" 단체를 반려하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '반려', style: 'destructive', onPress: async () => {
          try {
            await api.rejectOrganization(org.id);
            setOrganizations((prev) => prev.filter((o) => o.id !== org.id));
          } catch {
            Alert.alert('오류', '반려 처리에 실패했습니다.');
          }
        },
      },
    ]);
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
        <Text style={styles.headerTitle}>단체 등록처리</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : organizations.length === 0 ? (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>등록요청된 단체가 없습니다.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {organizations.map((org) => (
            <View key={org.id} style={styles.card}>
              <View style={styles.cardTop}>
                {org.logo ? (
                  <Image source={{ uri: org.logo }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoEmpty]}>
                    <Text style={styles.logoEmptyText}>로고</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{org.name}</Text>
                  <Text style={styles.orgSub}>대표: {org.representativeNickname ?? '-'}</Text>
                  {org.phone && <Text style={styles.orgSub}>{org.phone}</Text>}
                  {org.address && <Text style={styles.orgSub}>{org.address}</Text>}
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={({ pressed }) => [styles.rejectButton, pressed && { opacity: 0.7 }]}
                  onPress={() => handleReject(org)}
                >
                  <Text style={styles.rejectText}>반려</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.approveButton, pressed && { opacity: 0.85 }]}
                  onPress={() => handleApprove(org)}
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
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)',
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  logo: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden' },
  logoEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmptyText: { fontFamily: 'SUIT-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  orgName: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginBottom: 4 },
  orgSub: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
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
