import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/Colors';
import PageIndicator from '@/components/onboarding/PageIndicator';
import ClassManagementIllustration from '@/components/onboarding/ClassManagementIllustration';
import TransparentManagementIllustration from '@/components/onboarding/TransparentManagementIllustration';
import OpenAccessIllustration from '@/components/onboarding/OpenAccessIllustration';

const TOTAL_PAGES = 4;

const PAGES = [
  {
    title: '쉬운 수업 관리',
    description:
      '강사와 수강생을 쉽게 매칭하고\n수업 일정, 프로필 어디에서든\n한눈에 확인하세요.',
    Illustration: ClassManagementIllustration,
  },
  {
    title: '투명한 강습 관리',
    description:
      '누구나 어디에서든 강습과 트레이닝을\n신청할 수 있고, 언제 누구에게\n몇 명이 참여하는지 확인할 수 있어요.',
    Illustration: TransparentManagementIllustration,
  },
  {
    title: '틀에 얽매이지 않는\n자유로운 사용',
    description:
      '어디에 속한 누구든\n이 앱을 자유롭게 사용할 수 있어요.\n제한 없이, 모두에게 열려 있습니다.',
    Illustration: OpenAccessIllustration,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleStart = useCallback(async () => {
    await completeOnboarding();
    router.replace('/login');
  }, [completeOnboarding, router]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setLayout((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }, []);

  const { width, height } = layout;

  if (width === 0) {
    return <View style={styles.root} onLayout={onLayout} />;
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Animated.ScrollView
        key={`scroll-${width}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        snapToOffsets={Array.from({ length: TOTAL_PAGES }, (_, i) => i * width)}
        decelerationRate="fast"
        bounces={false}
      >
        {PAGES.map((page, index) => (
          <ContentPage
            key={index}
            page={page}
            index={index}
            scrollX={scrollX}
            pageWidth={width}
            pageHeight={height}
          />
        ))}

        <View style={[styles.ctaPage, { width, height }]}>
          <CTAPage scrollX={scrollX} pageWidth={width} onPress={handleStart} />
        </View>
      </Animated.ScrollView>

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        <PageIndicator totalPages={TOTAL_PAGES} scrollX={scrollX} pageWidth={width} />
        <SwipeHint scrollX={scrollX} pageWidth={width} />
      </View>
    </View>
  );
}

function ContentPage({
  page,
  index,
  scrollX,
  pageWidth,
  pageHeight,
}: {
  page: (typeof PAGES)[number];
  index: number;
  scrollX: Animated.Value;
  pageWidth: number;
  pageHeight: number;
}) {
  const { Illustration } = page;

  const inputRange = [
    (index - 0.5) * pageWidth,
    index * pageWidth,
    (index + 0.5) * pageWidth,
  ];

  const contentOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const contentTranslateY = scrollX.interpolate({
    inputRange,
    outputRange: [40, 0, 40],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.contentPage, { width: pageWidth, height: pageHeight }]}>
      <Animated.View
        style={[
          styles.contentInner,
          { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
        ]}
      >
        <View style={styles.illustrationArea}>
          <Illustration />
        </View>
        <Text style={styles.pageTitle}>{page.title}</Text>
        <Text style={styles.pageDescription}>{page.description}</Text>
      </Animated.View>
    </View>
  );
}

function CTAPage({
  scrollX,
  pageWidth,
  onPress,
}: {
  scrollX: Animated.Value;
  pageWidth: number;
  onPress: () => void;
}) {
  const opacity = scrollX.interpolate({
    inputRange: [2.5 * pageWidth, 3 * pageWidth],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange: [2.5 * pageWidth, 3 * pageWidth],
    outputRange: [30, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.ctaInner, { opacity, transform: [{ translateY }] }]}>
      <Pressable onPress={onPress}>
        <Text style={styles.ctaText}>시작하기</Text>
      </Pressable>
    </Animated.View>
  );
}

function SwipeHint({ scrollX, pageWidth }: { scrollX: Animated.Value; pageWidth: number }) {
  const opacity = scrollX.interpolate({
    inputRange: [0, pageWidth * 0.5],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.swipeHint, { opacity }]}>
      <Text style={styles.swipeHintText}>스와이프로 계속</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.brand.primary },
  contentPage: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  contentInner: { alignItems: 'center' },
  illustrationArea: { marginBottom: 48 },
  pageTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 28,
    color: Colors.brand.white,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  pageDescription: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 26,
  },
  ctaPage: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.brand.primary },
  ctaInner: { alignItems: 'center', justifyContent: 'center' },
  ctaText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 24,
    color: Colors.brand.white,
    letterSpacing: 2,
  },
  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingTop: 16, gap: 16,
  },
  swipeHint: { position: 'absolute', bottom: 24, right: 24 },
  swipeHintText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
