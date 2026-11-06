import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import type { LocalImage } from './tourForm';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 사진 여러 장 고르기 (남은 자리만큼). 10MB가 넘는 사진은 빼고 알림. 고르지 않으면 null
export async function pickPhotos(current: LocalImage[], max: number): Promise<LocalImage[] | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
    return null;
  }
  const remaining = max - current.length;
  if (remaining <= 0) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  const tooBig = result.assets.filter(a => a.fileSize && a.fileSize > MAX_FILE_SIZE).length;
  const known = new Set(current.map(i => i.uri));
  const picked = result.assets
    .filter(a => !(a.fileSize && a.fileSize > MAX_FILE_SIZE) && !known.has(a.uri))
    .map(a => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }));
  if (tooBig) Alert.alert('알림', '10MB가 넘는 사진은 빼고 올렸어요.');
  return [...current, ...picked].slice(0, max);
}

// 이미 올린 사진은 주소 그대로, 새로 고른 사진만 올림
export async function uploadPhotos(images: LocalImage[]) {
  const urls: string[] = [];
  for (const image of images) urls.push(image.remote ? image.uri : (await api.uploadTourImage(image.uri, image.mimeType)).url);
  return urls;
}

// 사진을 지우면 대표 사진이 그 사진이었을 때 첫 장으로
export function removePhoto(images: LocalImage[], coverUri: string, index: number) {
  const next = images.filter((_, i) => i !== index);
  return { images: next, coverUri: next.some(i => i.uri === coverUri) ? coverUri : next[0]?.uri ?? '' };
}
