import React from 'react';
import HomeScreen from '@/features/home/HomeScreen';
import { SplitScene } from '@/features/split/SplitPane';

// 앱 첫 화면 = 홈 (2026-11-09). 캘린더는 /calendar 탭으로 옮김
export default function TabHome() {
  return <SplitScene tab="home"><HomeScreen /></SplitScene>;
}
