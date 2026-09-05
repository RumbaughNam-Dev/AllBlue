import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/Colors';

export default function ClassManagementIllustration() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const personLeftStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.2, 0.6], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.2, 0.6], outputRange: [-40, -40, 0], extrapolate: 'clamp' }) }],
  };

  const personRightStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.3, 0.7], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.3, 0.7], outputRange: [40, 40, 0], extrapolate: 'clamp' }) }],
  };

  const linkStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ scaleX: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }) }],
  };

  const calendarStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [30, 30, 0], extrapolate: 'clamp' }) },
      { scale: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.8, 0.8, 1], extrapolate: 'clamp' }) },
    ],
  };

  const checkStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }) }],
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.personLeft, personLeftStyle]}>
        <View style={[styles.personHead, { backgroundColor: Colors.brand.primary }]} />
        <View style={[styles.personBody, { backgroundColor: Colors.brand.primaryLight }]} />
        <View style={styles.labelTag}>
          <View style={[styles.labelDot, { backgroundColor: Colors.brand.accent }]} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.connectionLine, linkStyle]}>
        <View style={styles.dashedSegment} />
        <View style={styles.dashedSegment} />
        <View style={styles.dashedSegment} />
      </Animated.View>

      <Animated.View style={[styles.personRight, personRightStyle]}>
        <View style={[styles.personHead, { backgroundColor: Colors.brand.accent }]} />
        <View style={[styles.personBody, { backgroundColor: '#7DD3E8' }]} />
        <View style={styles.labelTag}>
          <View style={[styles.labelDot, { backgroundColor: Colors.brand.primary }]} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.calendarCard, calendarStyle]}>
        <View style={styles.calendarHeader}>
          <View style={styles.calendarHeaderBar} />
        </View>
        <View style={styles.calendarGrid}>
          {[...Array(12)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.calendarDot,
                i === 4 && { backgroundColor: Colors.brand.primary },
                i === 7 && { backgroundColor: Colors.brand.accent },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.checkBadge, checkStyle]}>
        <View style={styles.checkMark} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 260, height: 220, alignItems: 'center', justifyContent: 'center' },
  personLeft: { position: 'absolute', left: 20, top: 30, alignItems: 'center' },
  personRight: { position: 'absolute', right: 20, top: 30, alignItems: 'center' },
  personHead: { width: 36, height: 36, borderRadius: 18 },
  personBody: { width: 44, height: 28, borderRadius: 14, marginTop: 4 },
  labelTag: { marginTop: 6, width: 24, height: 8, borderRadius: 4, backgroundColor: '#E8F4FD', alignItems: 'center', justifyContent: 'center' },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  connectionLine: { position: 'absolute', top: 55, flexDirection: 'row', gap: 6 },
  dashedSegment: { width: 16, height: 3, borderRadius: 1.5, backgroundColor: Colors.brand.accent, opacity: 0.5 },
  calendarCard: {
    position: 'absolute', bottom: 10, width: 160, height: 80, backgroundColor: Colors.brand.white,
    borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  calendarHeader: { marginBottom: 10 },
  calendarHeaderBar: { width: 60, height: 6, borderRadius: 3, backgroundColor: Colors.brand.primary, opacity: 0.3 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendarDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E0E0E0' },
  checkBadge: {
    position: 'absolute', right: 55, bottom: 70, width: 28, height: 28,
    borderRadius: 14, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { width: 10, height: 6, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: Colors.brand.white, transform: [{ rotate: '-45deg' }, { translateY: -1 }] },
});
