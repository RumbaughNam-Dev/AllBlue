import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EssayBlock, EssaySpan } from '@/services/api';
import { ESSAY_FONT_SIZE, ESSAY_LINE_HEIGHT } from './essay';

// One span's look, shared by the reader and the editor.
export function spanStyle(span: Omit<EssaySpan, 't'>) {
  const size = span.s ?? 'M';
  return {
    fontFamily: span.b ? 'SUIT-Bold' : 'SUIT-Regular',
    fontSize: ESSAY_FONT_SIZE[size],
    lineHeight: ESSAY_LINE_HEIGHT[size],
    color: span.c ?? '#FFFFFF',
    ...(span.i ? { fontStyle: 'italic' as const } : {}),
    ...(span.u ? { textDecorationLine: 'underline' as const } : {}),
  };
}

export function Spans({ spans }: { spans: EssaySpan[] }) {
  return <>{spans.map((span, i) => <Text key={i} style={spanStyle(span)}>{span.t}</Text>)}</>;
}

// 4장 에세이 상세 본문: 쓴 서식 그대로, 사진은 폭 가득 원본 비율 (누르면 크게 보기)
export default function EssayBody({ body, onOpenImage }: { body: EssayBlock[]; onOpenImage: (url: string) => void }) {
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.body}>
      {body.map((block, i) => block.type === 'img' ? (
        <Pressable key={i} accessibilityRole="imagebutton" accessibilityLabel="사진 크게 보기" onPress={() => onOpenImage(block.url)}>
          <Image source={{ uri: block.url }} resizeMode="cover"
            style={[styles.image, { width, height: width * (block.w && block.h ? block.h / block.w : 3 / 4) }]} />
        </Pressable>
      ) : (
        <Text key={i} style={spanStyle({})}><Spans spans={block.spans} /></Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  image: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
});
