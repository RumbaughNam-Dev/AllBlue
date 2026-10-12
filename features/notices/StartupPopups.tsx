import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { localDay, PopupSlide } from './types';
import PopupCarousel from './PopupCarousel';

// Closing lasts for this app session; returning to tabs must not reopen it.
const checkedUsers = new Set<string>();
export default function StartupPopups({ userId }: { userId: string }) {
  const [items, setItems] = useState<PopupSlide[]>([]);
  const key = `startup-popups-hidden-day:${userId}`;
  useEffect(() => {
    let active = true;
    if (checkedUsers.has(userId)) return;
    (async () => {
      try {
        if (await AsyncStorage.getItem(key) === localDay()) { checkedUsers.add(userId); return; }
        const data = await api.getNoticePopups();
        if (active) { checkedUsers.add(userId); setItems(data.items); }
      } catch { /* A failed optional popup must not prevent opening the app. */ }
    })();
    return () => { active = false; };
  }, [userId, key]);
  const hideToday = async () => {
    try { await AsyncStorage.setItem(key, localDay()); setItems([]); }
    catch { Alert.alert('저장 실패', '오늘 하루 보지 않기 설정을 저장하지 못했습니다. 다시 시도해주세요.'); }
  };
  return items.length ? <PopupCarousel items={items} onClose={() => setItems([])} onHideToday={() => void hideToday()} /> : null;
}
