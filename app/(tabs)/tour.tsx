import React from 'react';
import TourHomeScreen from '@/features/tour/TourHomeScreen';
import { SplitScene } from '@/features/split/SplitPane';

// 투어 탭 (2026-11-06 새 설계). 구현을 확인할 때까지 admin에게만 보임 — (tabs)/_layout의 showTour
export default function TabTour() {
  return <SplitScene tab="tour"><TourHomeScreen /></SplitScene>;
}
