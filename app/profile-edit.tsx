import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  Alert, Platform, KeyboardAvoidingView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, Profile } from '@/services/api';
import Spinner from '@/components/Spinner';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | undefined>(user?.profileImage);
  const [imageChanged, setImageChanged] = useState(false);
  const [nicknameTxt, setNicknameTxt] = useState(user?.nickname ?? '');
  const [nameTxt, setNameTxt] = useState(user?.name ?? '');
  const [description, setDescription] = useState('');
  const [shoesSize, setShoesSize] = useState('');
  const [finSize, setFinSize] = useState('');
  const [staMin, setStaMin] = useState('');
  const [staSec, setStaSec] = useState('');
  const [dynb, setDynb] = useState('');
  const [dyn, setDyn] = useState('');
  const [dnf, setDnf] = useState('');
  const [fim, setFim] = useState('');
  const [cwtb, setCwtb] = useState('');
  const [cwt, setCwt] = useState('');
  const [cnf, setCnf] = useState('');

  useEffect(() => {
    api.getProfile()
      .then((res) => {
        if (res.user) {
          setNicknameTxt(res.user.nickname ?? '');
          setNameTxt(res.user.name ?? '');
        }
        const p = res.profile;
        if (p) {
          setDescription(p.description ?? '');
          setShoesSize(p.shoesSize != null ? String(p.shoesSize) : '');
          setFinSize(p.finSize != null ? String(p.finSize) : '');
          if (p.sta != null) {
            const parts = String(p.sta).split('.');
            setStaMin(parts[0] ?? '');
            setStaSec(parts[1] ?? '');
          }
          setDynb(p.dynb != null ? String(p.dynb) : '');
          setDyn(p.dyn != null ? String(p.dyn) : '');
          setDnf(p.dnf != null ? String(p.dnf) : '');
          setFim(p.fim != null ? String(p.fim) : '');
          setCwtb(p.cwtb != null ? String(p.cwtb) : '');
          setCwt(p.cwt != null ? String(p.cwt) : '');
          setCnf(p.cnf != null ? String(p.cnf) : '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toNum = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
      setImageChanged(true);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (imageChanged && profileImage) {
        console.log('[프로필] 이미지 업로드 시작');
        const imgRes = await api.uploadProfileImage(profileImage);
        console.log('[프로필] 이미지 업로드 응답:', JSON.stringify(imgRes));
        await updateUser({ profileImage: imgRes.profileImage });
      }

      await api.updateProfile({
        nickname: nicknameTxt.trim() || undefined,
        name: nameTxt.trim() || null,
        description: description.trim() || null,
        shoesSize: toNum(shoesSize) as any,
        finSize: finSize.trim() || null,
        sta: (staMin.trim() || staSec.trim()) ? toNum(`${staMin.trim() || '0'}.${staSec.trim() || '0'}`) : null,
        dynb: toNum(dynb),
        dyn: toNum(dyn),
        dnf: toNum(dnf),
        fim: toNum(fim),
        cwtb: toNum(cwtb),
        cwt: toNum(cwt),
        cnf: toNum(cnf),
      });
      await updateUser({
        nickname: nicknameTxt.trim() || user?.nickname,
        name: nameTxt.trim() || undefined,
      });
      Alert.alert('알림', '프로필이 저장되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (!e._handled) {
        Alert.alert('저장 실패', e.message ?? '잠시 후 다시 시도해주세요.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.loadingArea}><Spinner /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={styles.headerCancel}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>프로필 편집</Text>
        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.brand.white} />
          ) : (
            <Text style={styles.headerSave}>저장</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Profile Image */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickImage}>
              <View style={styles.avatarWrap}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{user?.nickname?.charAt(0) ?? '?'}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable onPress={pickImage} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Text style={styles.changePhotoText}>사진 변경</Text>
            </Pressable>
          </View>

          {/* Nickname */}
          <Text style={styles.sectionLabel}>닉네임</Text>
          <TextInput
            style={styles.input}
            value={nicknameTxt}
            onChangeText={setNicknameTxt}
            placeholder="닉네임을 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />

          {/* Name */}
          <Text style={styles.sectionLabel}>이름 <Text style={styles.optionalHint}>(선택)</Text></Text>
          <TextInput
            style={styles.input}
            value={nameTxt}
            onChangeText={setNameTxt}
            placeholder="실명을 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />

          {/* Description */}
          <Text style={styles.sectionLabel}>자기소개</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="자기소개를 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={3}
          />

          {/* Sizes */}
          <Text style={styles.sectionLabel}>장비 정보</Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>발사이즈 (mm)</Text>
              <TextInput
                style={styles.input}
                value={shoesSize}
                onChangeText={setShoesSize}
                placeholder="280"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>핀사이즈</Text>
              <TextInput
                style={styles.input}
                value={finSize}
                onChangeText={setFinSize}
                placeholder="43-44"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="default"
              />
            </View>
          </View>

          {/* Pool Records */}
          <Text style={styles.sectionLabel}>수영장 기록</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>STA (분:초)</Text>
            <View style={styles.staRow}>
              <TextInput
                style={[styles.input, styles.staInput]}
                value={staMin}
                onChangeText={(t) => setStaMin(t.replace(/\D/g, '').slice(0, 2))}
                placeholder="분"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.staColon}>:</Text>
              <TextInput
                style={[styles.input, styles.staInput]}
                value={staSec}
                onChangeText={(t) => setStaSec(t.replace(/\D/g, '').slice(0, 2))}
                placeholder="초"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <View style={styles.rowInputs}>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>DYNB (m)</Text>
              <TextInput style={styles.input} value={dynb} onChangeText={setDynb} placeholder="90" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>DYN (m)</Text>
              <TextInput style={styles.input} value={dyn} onChangeText={setDyn} placeholder="--" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>DNF (m)</Text>
              <TextInput style={styles.input} value={dnf} onChangeText={setDnf} placeholder="50" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
          </View>

          {/* Depth Records */}
          <Text style={styles.sectionLabel}>수심 기록</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FIM (m)</Text>
            <TextInput style={styles.input} value={fim} onChangeText={setFim} placeholder="41.7" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
          </View>
          <View style={styles.rowInputs}>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>CWTB (m)</Text>
              <TextInput style={styles.input} value={cwtb} onChangeText={setCwtb} placeholder="42" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>CWT (m)</Text>
              <TextInput style={styles.input} value={cwt} onChangeText={setCwt} placeholder="--" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
            <View style={styles.thirdInput}>
              <Text style={styles.inputLabel}>CNF (m)</Text>
              <TextInput style={styles.input} value={cnf} onChangeText={setCnf} placeholder="20" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="decimal-pad" />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 20,
  },
  headerCancel: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  headerTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
  },
  headerSave: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: '#00E5FF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrap: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 46,
    padding: 2,
    marginBottom: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 34,
    color: Colors.brand.white,
  },
  changePhotoText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: '#00E5FF',
  },
  sectionLabel: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.white,
    marginTop: 24,
    marginBottom: 12,
  },
  optionalHint: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  input: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  thirdInput: {
    flex: 1,
  },
  staRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staInput: {
    flex: 1,
    textAlign: 'center',
  },
  staColon: {
    fontFamily: 'SUIT-Bold',
    fontSize: 20,
    color: Colors.brand.white,
  },
});
