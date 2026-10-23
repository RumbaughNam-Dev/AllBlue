import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Animated, Easing, StyleProp, TextStyle, LayoutChangeEvent } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  pauseMs?: number;
  speed?: number; // px per second
};

// One line, no wrapping. If the text is wider than the box it slides left to show
// the end, pauses, slides back, pauses, and repeats.
export default function MarqueeText({ text, style, pauseMs = 3000, speed = 40 }: Props) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const overflow = boxWidth > 0 ? Math.max(0, textWidth - boxWidth) : 0;

  useEffect(() => {
    translateX.setValue(0);
    if (overflow <= 1) return;
    const duration = Math.max(800, (overflow / speed) * 1000);
    const slide = (toValue: number) => Animated.timing(translateX, {
      toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    });
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(pauseMs),
      slide(-overflow),
      Animated.delay(pauseMs),
      slide(0),
    ]));
    loop.start();
    return () => loop.stop();
  }, [overflow, pauseMs, speed, translateX]);

  return (
    <View style={{ overflow: 'hidden' }} onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={(w) => setTextWidth(w)}
      >
        <Animated.Text style={[style, { transform: [{ translateX }] }]}>{text}</Animated.Text>
      </ScrollView>
    </View>
  );
}
