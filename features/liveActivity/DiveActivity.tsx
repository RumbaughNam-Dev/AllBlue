import { HStack, Image, Overlay, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, fixedSize, font, frame, foregroundStyle, hidden, kerning, lineLimit, monospacedDigit, multilineTextAlignment, padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

// 다가오는 다이빙 라이브 액티비티 (잠금화면 · 다이내믹 아일랜드, 2026-11-22 사용자 요청).
// 'widget' 함수 안은 위젯 확장에서 따로 돌아서 바깥 상수 · 함수를 못 씀 — 색 · 계산은 모두 함수 안에.
// 남은 시간은 iOS 타이머 글자가 알아서 줄어들어서 앱이 업데이트할 필요 없음. 시작 시각이 지난 뒤 다시 그리면 '다이빙 시작!'
// (앱이 꺼져 있으면 0:00에서 멈춰 있고, 앱을 열면 sync.ts가 다시 그림)
export type DiveActivityProps = {
  scheduleId: number;
  title: string;
  place: string;
  timeLabel: string; // '오후 2:00'
  dayLabel: string; // '오늘' · '내일'
  category: string;
  people: number; // 참가자 수 (강사 제외)
  startAt: number; // 시작 시각 (ms)
  shownAt: number; // 라이브 액티비티를 띄운 시각 (ms) — 타이머 범위 아래쪽
  started?: boolean; // 앱이 시작 시각 뒤에 다시 그릴 때 true (iOS는 시각이 지나도 저절로 다시 그리지 않음)
};

const DiveActivity = (props: DiveActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const cyan = environment.isLuminanceReduced ? '#FFFFFF' : '#00E5FF';
  const white = '#FFFFFF';
  const dim = '#A8BFD6';
  const lightCyan = '#00E5FF';
  const started = !!props.started || !!environment.isStale || Date.now() >= props.startAt;
  const range = { lower: new Date(Math.min(props.shownAt, props.startAt)), upper: new Date(props.startAt) };
  const meta = [props.place, `${props.dayLabel} ${props.timeLabel}`].filter(Boolean).join(' · ');

  // 홈 위쪽 로고와 같은 모양: 가는 글자 · 넓은 자간, 'b'만 청록 (SUIT 글꼴은 위젯 확장에 없어서 시스템 글꼴 light)
  const logo = (size: number) => (
    <Text modifiers={[font({ size, weight: 'light' }), kerning(size * 0.22), foregroundStyle(white)]}>
      <Text>all</Text>
      <Text modifiers={[foregroundStyle(lightCyan)]}>b</Text>
      <Text>lue</Text>
    </Text>
  );

  // 타이머는 라이브 액티비티 안에서 폭을 다 차지해서, 좁은 곳(다이내믹 아일랜드)은 남은 시간에 맞는 가장 긴 글자를 숨겨 깔고 그 위에 그림.
  // 잠금화면은 폭을 다 쓰게 두고 오른쪽 정렬
  const timer = (size: number) => (
    <Overlay alignment="trailing" modifiers={[monospacedDigit(), fixedSize({ horizontal: true, vertical: false })]}>
      <Text modifiers={[hidden(), font({ size, weight: 'bold', design: 'rounded' })]}>
        {props.startAt - Date.now() >= 3600000 ? '0:00:00' : props.startAt - Date.now() >= 600000 ? '00:00' : '0:00'}
      </Text>
      <Overlay.Content>
        <Text timerInterval={range} countsDown modifiers={[font({ size, weight: 'bold', design: 'rounded' }), foregroundStyle(cyan)]} />
      </Overlay.Content>
    </Overlay>
  );

  return {
    // 잠금화면: 맨 위 [앱 · 종류 … 날짜 시각], 제목 한 줄, 아래 [장소 · 인원 … 남은 시간]
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0B2E55')]}>
        <HStack spacing={8}>
          {logo(15)}
          {props.category ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(cyan)]}>{props.category}</Text> : null}
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(dim)]}>{`${props.dayLabel} ${props.timeLabel}`}</Text>
        </HStack>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
        <HStack alignment="bottom" spacing={8}>
          <VStack alignment="leading" spacing={4}>
            {props.place ? (
              <HStack spacing={4}>
                <Image systemName="mappin.circle.fill" size={12} color={dim} />
                <Text modifiers={[font({ size: 13 }), foregroundStyle(dim), lineLimit(1)]}>{props.place}</Text>
              </HStack>
            ) : null}
            {props.people > 0 ? (
              <HStack spacing={4}>
                <Image systemName="person.2.fill" size={11} color={dim} />
                <Text modifiers={[font({ size: 13 }), foregroundStyle(dim)]}>{`함께하는 인원 ${props.people}명`}</Text>
              </HStack>
            ) : null}
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={0}>
            {started
              ? <Text modifiers={[font({ size: 24, weight: 'bold', design: 'rounded' }), foregroundStyle(cyan)]}>다이빙 시작!</Text>
              : <Text timerInterval={range} countsDown
                  modifiers={[font({ size: 28, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(cyan), multilineTextAlignment('trailing')]} />}
          </VStack>
        </HStack>
      </VStack>
    ),
    // 다이내믹 아일랜드 (접힘)
    compactLeading: <Image systemName="water.waves" size={15} color={cyan} />,
    compactTrailing: started
      ? <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(cyan)]}>다이빙 중</Text>
      : timer(15),
    minimal: <Image systemName="water.waves" size={14} color={cyan} />,
    // 다이내믹 아일랜드 (길게 눌러 펼침)
    expandedLeading: (
      <VStack alignment="leading" spacing={3} modifiers={[padding({ leading: 6, top: 4 })]}>
        {logo(14)}
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(dim)]}>{`${props.dayLabel} ${props.timeLabel}`}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 6, top: 4 })]}>
        {started
          ? <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(cyan)]}>다이빙 중</Text>
          : timer(22)}
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={3} modifiers={[padding({ horizontal: 8, bottom: 6 }), frame({ maxWidth: 10000, alignment: 'leading' })]}>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
        <HStack spacing={4}>
          <Image systemName="mappin.circle.fill" size={12} color={dim} />
          <Text modifiers={[font({ size: 13 }), foregroundStyle(dim), lineLimit(1)]}>
            {props.people > 0 ? `${props.place} · 함께하는 인원 ${props.people}명` : props.place}
          </Text>
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity('DiveActivity', DiveActivity);
