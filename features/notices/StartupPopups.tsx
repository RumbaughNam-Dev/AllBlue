import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { localDay, PopupSlide } from './types';
import PopupCarousel from './PopupCarousel';
import { setNoticesBusy } from '@/features/grade/store';

// Closing lasts for this app session; returning to tabs must not reopen it.
const checkedUsers = new Set<string>();
export default function StartupPopups({ userId }: { userId: string }) {
  const [items, setItems] = useState<PopupSlide[]>([]);
  const key = `startup-popups-hidden-day:${userId}`;
  useEffect(() => {
    let active = true;
    if (checkedUsers.has(userId)) return;
    setNoticesBusy(true); // 퀘스트 화면은 공지 팝업을 닫은 뒤에
    (async () => {
      let shown = false;
      try {
        if (await AsyncStorage.getItem(key) === localDay()) { checkedUsers.add(userId); return; }
        const data = await api.getNoticePopups();
        if (active) { checkedUsers.add(userId); setItems(data.items); shown = data.items.length > 0; }
      } catch { /* A failed optional popup must not prevent opening the app. */ }
      finally { if (!shown) setNoticesBusy(false); }
    })();
    return () => { active = false; };
  }, [userId, key]);
  const hideToday = async () => {
    try { await AsyncStorage.setItem(key, localDay()); setItems([]); setNoticesBusy(false); }
    catch { Alert.alert('저장 실패', '오늘 하루 보지 않기 설정을 저장하지 못했습니다. 다시 시도해주세요.'); }
  };
  return items.length ? <PopupCarousel items={items} onClose={() => { setItems([]); setNoticesBusy(false); }} onHideToday={() => void hideToday()} /> : null;
}
