import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SparkleEffect from '../components/SparkleEffect';
import {Session} from '../storage/sessions';

interface Props {
  session: Session;
  onFinish: () => void;
}

function formatDuration(ms: number) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const secStr = sec.toFixed(2);
  if (min > 0) {
    return `${min}분 ${secStr}초`;
  }
  return `${secStr}초`;
}

function formatLapTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${min.toString().padStart(2, '0')}:${sec
    .toString()
    .padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export default function CompleteScreen({session, onFinish}: Props) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;
  const infoSlide = useRef(new Animated.Value(30)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringScale, {
        toValue: 3,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 35,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Info cards fade in after title
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(infoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(infoSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scaleAnim, textOpacity, infoOpacity, infoSlide, ringScale, ringOpacity]);

  const firstContraction =
    session.lapTimes.length > 0 ? formatLapTime(session.lapTimes[0]) : '-';
  const totalTaps = session.lapTimes.length;
  const totalDuration = formatDuration(session.duration);

  return (
    <View style={[styles.container, {paddingBottom: insets.bottom + 20}]}>
      <SparkleEffect color="rgba(255, 215, 0, 0.9)" />

      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringOpacity,
            transform: [{scale: ringScale}],
          },
        ]}
      />

      <View style={styles.topSection}>
        <View style={styles.titleContainer}>
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: textOpacity,
                transform: [{scale: scaleAnim}],
              },
            ]}>
            고생하셨습니다!
          </Animated.Text>
          <Animated.Text
            style={[
              styles.subTitle,
              {
                opacity: textOpacity,
                transform: [{scale: scaleAnim}],
              },
            ]}>
            GREAT JOB
          </Animated.Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.infoSection,
          {
            opacity: infoOpacity,
            transform: [{translateY: infoSlide}],
          },
        ]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>첫 컨트랙션 시간</Text>
          <Text style={styles.infoValue}>{firstContraction}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>약한 컨트랙션 횟수</Text>
          <Text style={styles.infoValue}>{totalTaps}회</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>총 숨참은 시간</Text>
          <Text style={styles.infoValue}>{totalDuration}</Text>
        </View>
      </Animated.View>

      <Animated.View style={{opacity: infoOpacity}}>
        <TouchableOpacity
          style={styles.homeButton}
          activeOpacity={0.7}
          onPress={onFinish}>
          <Text style={styles.homeButtonText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    color: '#FFD700',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 25,
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif-medium'},
    }),
  },
  subTitle: {
    marginTop: 12,
    color: 'rgba(255, 215, 0, 0.5)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 8,
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif'},
    }),
  },
  infoSection: {
    width: '85%',
    gap: 12,
    marginBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  homeButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  homeButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
