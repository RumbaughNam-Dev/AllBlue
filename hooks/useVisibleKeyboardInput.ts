import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, SectionList, TextInput, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

// Measure the actual viewport after keyboard avoidance; do not assume a keyboard height.
export function useVisibleKeyboardInput() {
  const listRef = useRef<SectionList<any> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);

  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      const scroll = listRef.current?.getScrollResponder() ?? scrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (focused.current !== input || height <= 0) return;
          // Leave room for a sticky section heading and padding around the input.
          const visibleTop = top + (listRef.current ? 44 : 12);
          const visibleBottom = top + height - 12;
          const delta = inputTop + inputHeight > visibleBottom
            ? inputTop + inputHeight - visibleBottom
            : inputTop < visibleTop ? inputTop - visibleTop : 0;
          if (delta !== 0) scroll.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
        });
      });
    });
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', reveal);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', reveal);
    return () => {
      shown.remove();
      changed.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      focused.current = null;
    };
  }, [reveal]);

  const focus = useCallback((input: TextInput | null) => {
    focused.current = input;
    reveal();
  }, [reveal]);
  const blur = useCallback((input: TextInput | null) => {
    if (focused.current === input) focused.current = null;
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);
  return { listRef, scrollRef, focus, blur, onScroll, onLayout: reveal };
}
