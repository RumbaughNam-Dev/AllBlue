import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppSettings} from '../storage/sessions';

interface Props {
  onStart: () => void;
  onBack: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export default function ReadyScreen({
  onStart,
  onBack,
  settings,
  onSettingsChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim, glowAnim]);

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButton, {top: insets.top + 8}]}
        onPress={onBack}
        activeOpacity={0.6}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      {/* Start button - center */}
      <TouchableOpacity
        style={styles.startArea}
        activeOpacity={0.7}
        onPress={onStart}>
        <Animated.View
          style={[
            styles.glowCircle,
            {opacity: glowAnim, transform: [{scale: pulseAnim}]},
          ]}
        />
        <Animated.Text
          style={[styles.text, {transform: [{scale: pulseAnim}]}]}>
          시작
        </Animated.Text>
      </TouchableOpacity>

      {/* Toggle switches */}
      <View style={[styles.toggleContainer, {paddingBottom: insets.bottom + 20}]}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>시간 표시</Text>
          <Switch
            value={settings.showTimer}
            onValueChange={val =>
              onSettingsChange({...settings, showTimer: val})
            }
            trackColor={{false: 'rgba(255,255,255,0.1)', true: 'rgba(14,165,233,0.4)'}}
            thumbColor={settings.showTimer ? '#38BDF8' : '#64748B'}
            ios_backgroundColor="rgba(255,255,255,0.1)"
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>진동 및 사운드</Text>
          <Switch
            value={settings.hapticSound}
            onValueChange={val =>
              onSettingsChange({...settings, hapticSound: val})
            }
            trackColor={{false: 'rgba(255,255,255,0.1)', true: 'rgba(14,165,233,0.4)'}}
            thumbColor={settings.hapticSound ? '#38BDF8' : '#64748B'}
            ios_backgroundColor="rgba(255,255,255,0.1)"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1929',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backText: {
    color: '#0EA5E9',
    fontSize: 28,
    fontWeight: '600',
  },
  startArea: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#0EA5E9',
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  text: {
    color: '#E2E8F0',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 10,
    textShadowColor: 'rgba(14, 165, 233, 0.6)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 20,
  },
  toggleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleLabel: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif-medium'},
    }),
  },
});
