import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/Colors';

export default function TransparentManagementIllustration() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const cardStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 0.4], outputRange: [40, 0], extrapolate: 'clamp' }) }],
  };

  const row1Style = {
    opacity: progress.interpolate({ inputRange: [0, 0.3, 0.5], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.3, 0.6], outputRange: [-30, -30, 0], extrapolate: 'clamp' }) }],
  };

  const row2Style = {
    opacity: progress.interpolate({ inputRange: [0, 0.4, 0.7], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.4, 0.7], outputRange: [-30, -30, 0], extrapolate: 'clamp' }) }],
  };

  const row3Style = {
    opacity: progress.interpolate({ inputRange: [0, 0.5, 0.8], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.5, 0.8], outputRange: [-30, -30, 0], extrapolate: 'clamp' }) }],
  };

  const eyeStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 0.7, 0.9, 1], outputRange: [0, 0, 1.2, 1], extrapolate: 'clamp' }) }],
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <View style={styles.listIcon} />
            <View style={[styles.listIcon, { width: 16 }]} />
          </View>
          <View style={styles.headerTitle} />
        </View>

        <Animated.View style={[styles.row, row1Style]}>
          <View style={[styles.avatar, { backgroundColor: Colors.brand.primary }]} />
          <View style={styles.rowContent}>
            <View style={[styles.textLine, { width: 80 }]} />
            <View style={[styles.textLineSmall, { width: 50 }]} />
          </View>
          <View style={[styles.badge, { backgroundColor: '#E8F8ED' }]}>
            <View style={[styles.badgeDot, { backgroundColor: '#22C55E' }]} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.row, row2Style]}>
          <View style={[styles.avatar, { backgroundColor: Colors.brand.accent }]} />
          <View style={styles.rowContent}>
            <View style={[styles.textLine, { width: 70 }]} />
            <View style={[styles.textLineSmall, { width: 60 }]} />
          </View>
          <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
            <View style={[styles.badgeDot, { backgroundColor: '#FF9800' }]} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.row, row3Style]}>
          <View style={[styles.avatar, { backgroundColor: '#7DD3E8' }]} />
          <View style={styles.rowContent}>
            <View style={[styles.textLine, { width: 90 }]} />
            <View style={[styles.textLineSmall, { width: 45 }]} />
          </View>
          <View style={[styles.badge, { backgroundColor: '#E8F4FD' }]}>
            <View style={[styles.badgeDot, { backgroundColor: Colors.brand.primary }]} />
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.eyeContainer, eyeStyle]}>
        <View style={styles.eyeOuter}>
          <View style={styles.eyeInner} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 260, height: 220, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 220, backgroundColor: Colors.brand.white, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIcon: { gap: 3, marginRight: 10 },
  listIcon: { width: 20, height: 3, borderRadius: 1.5, backgroundColor: Colors.brand.primary },
  headerTitle: { width: 80, height: 8, borderRadius: 4, backgroundColor: Colors.brand.primary, opacity: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  rowContent: { flex: 1, marginLeft: 10, gap: 4 },
  textLine: { height: 6, borderRadius: 3, backgroundColor: '#E0E0E0' },
  textLineSmall: { height: 4, borderRadius: 2, backgroundColor: '#F0F0F0' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  eyeContainer: { position: 'absolute', top: 10, right: 20 },
  eyeOuter: {
    width: 36, height: 22, borderRadius: 11, borderWidth: 2.5,
    borderColor: Colors.brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  eyeInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brand.accent },
});
