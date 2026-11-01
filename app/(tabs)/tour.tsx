import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SplitScene } from '@/features/split/SplitPane';
import Colors from '@/constants/Colors';

// 투어 탭 (지금은 admin에게만 보임). 실제 투어 화면을 만들기 전까지 자리만 잡아 둠
export default function TabTour() {
  return (
    <SplitScene tab="tour">
      <View style={styles.container}>
        <Text style={styles.emptyText}>투어 화면을 준비하고 있어요</Text>
      </View>
    </SplitScene>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
  },
});
