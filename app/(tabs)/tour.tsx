import React from 'react';
import TourHomeScreen from '@/features/tour/TourHomeScreen';
import { SplitScene } from '@/features/split/SplitPane';

// 투어 탭 (지금은 admin에게만 보임)
export default function TabTour() {
  return <SplitScene tab="tour"><TourHomeScreen /></SplitScene>;
}
