import React from 'react';
import { StyleSheet, View } from 'react-native';
import Colors from '@/constants/Colors';
import { SplitScene } from '@/features/split/SplitPane';

// 투어 탭: 기능을 처음부터 다시 설계하는 중이라 빈 화면 (탭은 admin에게만 보임 — (tabs)/_layout의 showTour)
export default function TabTour() {
  return <SplitScene tab="tour"><View style={styles.blank} /></SplitScene>;
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: Colors.brand.primary },
});
