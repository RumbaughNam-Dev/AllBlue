import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';

export default function OrganizationRegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { name: prefillName } = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(prefillName ?? '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickingLogo, setPickingLogo] = useState(false);

  const pickLogo = async () => {
    setPickingLogo(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    setPickingLogo(false);
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const formatPhone = (t: string) => {
    const d = t.replace(/\D/g, '');
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '단체명을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      await api.createOrganization({
        name: name.trim(),
        phone: phone.replace(/\D/g, '') || undefined,
        address: address.trim() || undefined,
        logoUri: logoUri || undefined,
      });
      Alert.alert('알림', '단체 등록요청이 완료되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '등록요청에 실패했습니다.');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.headerTitle}>단체 등록요청</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {/* Logo */}
          <Text style={styles.label}>단체 로고</Text>
          <Pressable onPress={pickLogo} disabled={pickingLogo} style={({ pressed }) => [styles.logoBox, pressed && { opacity: 0.7 }]}>
            {pickingLogo ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoPlaceholder}>로고 선택</Text>
            )}
          </Pressable>

          {/* Name */}
          <Text style={styles.label}>단체명 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="단체명을 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />

          {/* Phone */}
          <Text style={styles.label}>전화번호</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(t) => setPhone(formatPhone(t))}
            placeholder="010-0000-0000"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="phone-pad"
            maxLength={13}
          />

          {/* Address */}
          <Text style={styles.label}>주소</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="주소를 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.submitText}>등록요청</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  label: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white,
    marginTop: 20, marginBottom: 8,
  },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  logoBox: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImage: { width: 80, height: 80 },
  logoPlaceholder: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.3)',
  },
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  submitButton: {
    height: 54, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
