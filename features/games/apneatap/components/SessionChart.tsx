import React, {useState} from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets, SafeAreaProvider} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import {Session} from '../storage/sessions';


interface Props {
  sessions: Session[];
}

const COLOR_DURATION = '#0EA5E9';
const COLOR_FIRST_TAP = '#10B981';
const COLOR_TAPS = '#F59E0B';
const CHART_FONT = Platform.select({ios: 'Avenir Next', android: 'sans-serif'}) as string;

const TOOLTIP_W = 150;
const TOOLTIP_H = 78;

function formatDurationShort(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
  return `${sec}s`;
}

function formatDurationFull(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min}분 ${sec}초`;
  }
  return `${sec}초`;
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${mo}.${day} ${h}:${min}`;
}

function getNiceMax(val: number): number {
  if (val <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const normalized = val / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return Math.ceil(val / (nice * magnitude)) * nice * magnitude;
}

interface TooltipData {
  index: number;
  x: number;
  duration: number;
  firstTap: number;
  taps: number;
  dateTime: string;
}

function ChartContent({
  sessions,
  width,
  height,
  fullscreen,
  onRequestFullscreen,
  onCloseFullscreen,
  filterType,
  countOption,
  monthOption,
  onFilterTypeChange,
  onCountChange,
  onMonthChange,
}: {
  sessions: Session[];
  width: number;
  height: number;
  fullscreen: boolean;
  onRequestFullscreen?: () => void;
  onCloseFullscreen?: () => void;
  filterType: FilterType;
  countOption: CountOption;
  monthOption: MonthOption;
  onFilterTypeChange: (t: FilterType) => void;
  onCountChange: (c: CountOption) => void;
  onMonthChange: (m: MonthOption) => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const LEFT_MARGIN = 55;
  const RIGHT_MARGIN = 50;
  const TOP_MARGIN = 40;
  const BOTTOM_MARGIN = 45;
  const PLOT_HEIGHT = height - TOP_MARGIN - BOTTOM_MARGIN;

  const data = [...sessions].reverse();
  const numPoints = data.length;

  const durations = data.map(s => s.duration);
  const firstTaps = data.map(s => s.lapTimes.length > 0 ? s.lapTimes[0] : 0);
  const taps = data.map(s => s.lapTimes.length);

  const maxDuration = Math.max(...durations, 1);
  const maxTaps = Math.max(...taps, 1);
  const niceDuration = getNiceMax(maxDuration / 1000) * 1000;
  const niceTaps = getNiceMax(maxTaps);

  const availableW = width - LEFT_MARGIN - RIGHT_MARGIN;
  const minSpacing = fullscreen ? 60 : 50;
  const pointSpacing = numPoints <= 1 ? availableW : Math.max(availableW / (numPoints - 1), minSpacing);
  const chartWidth = numPoints <= 1
    ? width
    : Math.max(width, LEFT_MARGIN + (numPoints - 1) * pointSpacing + RIGHT_MARGIN);

  const yScaleDuration = (val: number) =>
    TOP_MARGIN + PLOT_HEIGHT - (val / niceDuration) * PLOT_HEIGHT;
  const yScaleTaps = (val: number) =>
    TOP_MARGIN + PLOT_HEIGHT - (val / niceTaps) * PLOT_HEIGHT;
  const xScale = (i: number) =>
    numPoints <= 1 ? LEFT_MARGIN + availableW / 2 : LEFT_MARGIN + i * pointSpacing;

  const baselineY = TOP_MARGIN + PLOT_HEIGHT;

  const linePts = durations
    .map((v, i) => `${xScale(i)},${yScaleDuration(v)}`)
    .join(' ');

  const firstTapLinePts = firstTaps
    .map((v, i) => `${xScale(i)},${yScaleDuration(v)}`)
    .join(' ');

  const durationTicks = Array.from({length: 5}, (_, i) => (niceDuration / 4) * i);
  const tapTicks = Array.from({length: 5}, (_, i) => Math.round((niceTaps / 4) * i));

  const barWidth = Math.min(pointSpacing * 0.4, 24);

  const handlePress = (index: number) => {
    if (tooltip?.index === index) {
      setTooltip(null);
      return;
    }
    setTooltip({
      index,
      x: xScale(index),
      duration: durations[index],
      firstTap: firstTaps[index],
      taps: taps[index],
      dateTime: formatDateTime(data[index].startTime),
    });
  };

  const getTooltipX = (x: number) => {
    let tx = x - TOOLTIP_W / 2;
    if (tx < LEFT_MARGIN) tx = LEFT_MARGIN;
    if (tx + TOOLTIP_W > chartWidth - RIGHT_MARGIN) {
      tx = chartWidth - RIGHT_MARGIN - TOOLTIP_W;
    }
    return tx;
  };

  return (
    <View style={fullscreen ? styles.fullContainer : styles.container}>
      {fullscreen ? (
        /* Fullscreen: single row with close + filter */
        <View style={styles.fullscreenTopRow}>
          <TouchableOpacity onPress={onCloseFullscreen} style={styles.fullscreenBtn}>
            <Text style={styles.fullscreenBtnText}>닫기</Text>
          </TouchableOpacity>
          <View style={styles.topDivider} />
          <View style={styles.filterTypeRow}>
            <TouchableOpacity
              style={[styles.filterTypeBtn, filterType === 'count' && styles.filterTypeBtnActive]}
              onPress={() => onFilterTypeChange('count')}>
              <Text style={[styles.filterTypeBtnText, filterType === 'count' && styles.filterTypeBtnTextActive]}>횟수</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTypeBtn, filterType === 'month' && styles.filterTypeBtnActive]}
              onPress={() => onFilterTypeChange('month')}>
              <Text style={[styles.filterTypeBtnText, filterType === 'month' && styles.filterTypeBtnTextActive]}>월</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.topDivider} />
          <View style={styles.filterOptionsRow}>
            {filterType === 'count'
              ? COUNT_OPTIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.filterOptionBtn, countOption === c && styles.filterOptionBtnActive]}
                    onPress={() => onCountChange(c)}>
                    <Text style={[styles.filterOptionText, countOption === c && styles.filterOptionTextActive]}>{c}회</Text>
                  </TouchableOpacity>
                ))
              : MONTH_OPTIONS.map(m => (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.filterOptionBtn, monthOption === m.value && styles.filterOptionBtnActive]}
                    onPress={() => onMonthChange(m.value)}>
                    <Text style={[styles.filterOptionText, monthOption === m.value && styles.filterOptionTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
          </View>
          <View style={styles.fullscreenLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, {backgroundColor: COLOR_DURATION}]} />
              <Text style={styles.legendText}>시간</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLineDashed, {backgroundColor: COLOR_FIRST_TAP}]} />
              <Text style={styles.legendText}>첫 컨트랙션</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBar, {backgroundColor: COLOR_TAPS}]} />
              <Text style={styles.legendText}>횟수</Text>
            </View>
          </View>
        </View>
      ) : (
        /* Normal: legend row + filter bar */
        <>
          <View style={styles.legendRow}>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, {backgroundColor: COLOR_DURATION}]} />
                <Text style={styles.legendText}>총 시간</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLineDashed, {backgroundColor: COLOR_FIRST_TAP}]} />
                <Text style={styles.legendText}>첫 컨트랙션</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBar, {backgroundColor: COLOR_TAPS}]} />
                <Text style={styles.legendText}>횟수</Text>
              </View>
            </View>
            {onRequestFullscreen && (
              <TouchableOpacity onPress={onRequestFullscreen} style={styles.fullscreenBtn}>
                <Text style={styles.fullscreenBtnText}>전체화면</Text>
              </TouchableOpacity>
            )}
          </View>
          <FilterBar
            filterType={filterType}
            countOption={countOption}
            monthOption={monthOption}
            onFilterTypeChange={onFilterTypeChange}
            onCountChange={onCountChange}
            onMonthChange={onMonthChange}
          />
        </>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={chartWidth > width}
        bounces={false}>
        <Svg width={chartWidth} height={height - 40}>
          {/* Grid lines & left Y labels (duration) */}
          {durationTicks.map((tick, i) => (
            <React.Fragment key={`dg-${i}`}>
              <Line
                x1={LEFT_MARGIN}
                y1={yScaleDuration(tick)}
                x2={chartWidth - RIGHT_MARGIN}
                y2={yScaleDuration(tick)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <SvgText
                x={LEFT_MARGIN - 8}
                y={yScaleDuration(tick) + 4}
                textAnchor="end"
                fill="#64748B"
                fontSize={10}
                fontFamily={CHART_FONT}>
                {formatDurationShort(tick)}
              </SvgText>
            </React.Fragment>
          ))}
          {/* Top grid + label */}
          <Line
            x1={LEFT_MARGIN}
            y1={yScaleDuration(niceDuration)}
            x2={chartWidth - RIGHT_MARGIN}
            y2={yScaleDuration(niceDuration)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
          <SvgText
            x={LEFT_MARGIN - 8}
            y={yScaleDuration(niceDuration) + 4}
            textAnchor="end"
            fill="#64748B"
            fontSize={10}
            fontFamily={CHART_FONT}>
            {formatDurationShort(niceDuration)}
          </SvgText>

          {/* Right Y labels (taps) */}
          {tapTicks.map((tick, i) => (
            <SvgText
              key={`tl-${i}`}
              x={chartWidth - RIGHT_MARGIN + 8}
              y={yScaleTaps(tick) + 4}
              textAnchor="start"
              fill="#64748B"
              fontSize={10}
              fontFamily={CHART_FONT}>
              {tick}
            </SvgText>
          ))}
          <SvgText
            x={chartWidth - RIGHT_MARGIN + 8}
            y={yScaleTaps(niceTaps) + 4}
            textAnchor="start"
            fill="#64748B"
            fontSize={10}
            fontFamily={CHART_FONT}>
            {niceTaps}
          </SvgText>

          {/* Axis labels */}
          <SvgText
            x={8}
            y={TOP_MARGIN - 8}
            fill={COLOR_DURATION}
            fontSize={9}
            fontFamily={CHART_FONT}
            fontWeight="600">
            시간
          </SvgText>
          <SvgText
            x={chartWidth - 12}
            y={TOP_MARGIN - 8}
            textAnchor="end"
            fill={COLOR_TAPS}
            fontSize={9}
            fontFamily={CHART_FONT}
            fontWeight="600">
            횟수
          </SvgText>

          {/* Bars (taps) */}
          {taps.map((v, i) => {
            const barH = (v / niceTaps) * PLOT_HEIGHT;
            return (
              <React.Fragment key={`bar-${i}`}>
                <Rect
                  x={xScale(i) - barWidth / 2}
                  y={baselineY - barH}
                  width={barWidth}
                  height={barH}
                  rx={3}
                  fill={COLOR_TAPS}
                  opacity={0.3}
                />
                <Rect
                  x={xScale(i) - barWidth / 2}
                  y={baselineY - barH}
                  width={barWidth}
                  height={Math.min(barH, 4)}
                  rx={3}
                  fill={COLOR_TAPS}
                  opacity={0.6}
                />
              </React.Fragment>
            );
          })}

          {/* Duration line */}
          {numPoints > 1 && (
            <Polyline
              points={linePts}
              fill="none"
              stroke={COLOR_DURATION}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* First tap line */}
          {numPoints > 1 && (
            <Polyline
              points={firstTapLinePts}
              fill="none"
              stroke={COLOR_FIRST_TAP}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="6,3"
            />
          )}

          {/* First tap points */}
          {firstTaps.map((v, i) => (
            <Circle
              key={`ft-${i}`}
              cx={xScale(i)}
              cy={yScaleDuration(v)}
              r={tooltip?.index === i ? 5 : 3}
              fill={COLOR_FIRST_TAP}
              onPress={() => handlePress(i)}
            />
          ))}

          {/* Duration points */}
          {durations.map((v, i) => (
            <React.Fragment key={`dp-${i}`}>
              <Circle
                cx={xScale(i)}
                cy={yScaleDuration(v)}
                r={20}
                fill="transparent"
                onPress={() => handlePress(i)}
              />
              <Circle
                cx={xScale(i)}
                cy={yScaleDuration(v)}
                r={tooltip?.index === i ? 6 : 4}
                fill={COLOR_DURATION}
                onPress={() => handlePress(i)}
              />
            </React.Fragment>
          ))}

          {/* Bar hit areas */}
          {taps.map((_, i) => (
            <Rect
              key={`bh-${i}`}
              x={xScale(i) - barWidth}
              y={TOP_MARGIN}
              width={barWidth * 2}
              height={PLOT_HEIGHT}
              fill="transparent"
              onPress={() => handlePress(i)}
            />
          ))}

          {/* Tooltip vertical line */}
          {tooltip && (
            <Line
              x1={tooltip.x}
              y1={TOP_MARGIN}
              x2={tooltip.x}
              y2={baselineY}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}

          {/* X-axis: show label only for tooltip */}
          {tooltip && (
            <SvgText
              x={tooltip.x}
              y={baselineY + 16}
              textAnchor="middle"
              fill="#E2E8F0"
              fontSize={10}
              fontWeight="600"
              fontFamily={CHART_FONT}>
              {tooltip.dateTime}
            </SvgText>
          )}

          {/* X-axis tick marks */}
          {data.map((_, i) => (
            <Line
              key={`xt-${i}`}
              x1={xScale(i)}
              y1={baselineY}
              x2={xScale(i)}
              y2={baselineY + 4}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          ))}

          {/* Tooltip box */}
          {tooltip && (
            <>
              <Rect
                x={getTooltipX(tooltip.x)}
                y={4}
                width={TOOLTIP_W}
                height={TOOLTIP_H}
                rx={8}
                fill="#1E293B"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />
              <SvgText
                x={getTooltipX(tooltip.x) + 10}
                y={20}
                fill="#94A3B8"
                fontSize={10}
                fontFamily={CHART_FONT}>
                {tooltip.dateTime}
              </SvgText>
              <SvgText
                x={getTooltipX(tooltip.x) + 10}
                y={35}
                fill={COLOR_DURATION}
                fontSize={11}
                fontWeight="600"
                fontFamily={CHART_FONT}>
                {'총 시간  ' + formatDurationFull(tooltip.duration)}
              </SvgText>
              <SvgText
                x={getTooltipX(tooltip.x) + 10}
                y={51}
                fill={COLOR_FIRST_TAP}
                fontSize={11}
                fontWeight="600"
                fontFamily={CHART_FONT}>
                {'첫 컨트랙션  ' + (tooltip.firstTap > 0 ? formatDurationFull(tooltip.firstTap) : '-')}
              </SvgText>
              <SvgText
                x={getTooltipX(tooltip.x) + 10}
                y={67}
                fill={COLOR_TAPS}
                fontSize={11}
                fontWeight="600"
                fontFamily={CHART_FONT}>
                {'컨트랙션  ' + tooltip.taps + '회'}
              </SvgText>
            </>
          )}
        </Svg>
      </ScrollView>
    </View>
  );
}

type FilterType = 'count' | 'month';
type CountOption = 10 | 20 | 30 | 50;
type MonthOption = 1 | 2 | 3 | 6 | 0; // 0 = 전체

const COUNT_OPTIONS: CountOption[] = [10, 20, 30, 50];
const MONTH_OPTIONS: {value: MonthOption; label: string}[] = [
  {value: 1, label: '1개월'},
  {value: 2, label: '2개월'},
  {value: 3, label: '3개월'},
  {value: 6, label: '6개월'},
  {value: 0, label: '전체'},
];

function filterSessions(
  sessions: Session[],
  filterType: FilterType,
  countOption: CountOption,
  monthOption: MonthOption,
): Session[] {
  if (filterType === 'count') {
    return sessions.slice(0, countOption);
  }
  if (monthOption === 0) return sessions;
  const cutoff = Date.now() - monthOption * 30 * 24 * 60 * 60 * 1000;
  return sessions.filter(s => s.startTime >= cutoff);
}

function FilterBar({
  filterType,
  countOption,
  monthOption,
  onFilterTypeChange,
  onCountChange,
  onMonthChange,
}: {
  filterType: FilterType;
  countOption: CountOption;
  monthOption: MonthOption;
  onFilterTypeChange: (t: FilterType) => void;
  onCountChange: (c: CountOption) => void;
  onMonthChange: (m: MonthOption) => void;
}) {
  return (
    <View style={styles.filterContainer}>
      <View style={styles.filterTypeRow}>
        <TouchableOpacity
          style={[styles.filterTypeBtn, filterType === 'count' && styles.filterTypeBtnActive]}
          onPress={() => onFilterTypeChange('count')}>
          <Text style={[styles.filterTypeBtnText, filterType === 'count' && styles.filterTypeBtnTextActive]}>
            횟수
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTypeBtn, filterType === 'month' && styles.filterTypeBtnActive]}
          onPress={() => onFilterTypeChange('month')}>
          <Text style={[styles.filterTypeBtnText, filterType === 'month' && styles.filterTypeBtnTextActive]}>
            월
          </Text>
        </TouchableOpacity>
        <View style={styles.filterDivider} />
        {filterType === 'count'
          ? COUNT_OPTIONS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.filterOptionBtn, countOption === c && styles.filterOptionBtnActive]}
                onPress={() => onCountChange(c)}>
                <Text style={[styles.filterOptionText, countOption === c && styles.filterOptionTextActive]}>
                  {c}회
                </Text>
              </TouchableOpacity>
            ))
          : MONTH_OPTIONS.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.filterOptionBtn, monthOption === m.value && styles.filterOptionBtnActive]}
                onPress={() => onMonthChange(m.value)}>
                <Text style={[styles.filterOptionText, monthOption === m.value && styles.filterOptionTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
      </View>
    </View>
  );
}

export default function SessionChart({sessions}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('count');
  const [countOption, setCountOption] = useState<CountOption>(10);
  const [monthOption, setMonthOption] = useState<MonthOption>(1);
  const screenW = Dimensions.get('window').width;

  const filtered = filterSessions(sessions, filterType, countOption, monthOption);

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>기록이 없습니다</Text>
      </View>
    );
  }

  const openFullscreen = async () => {
    setFullscreen(true);
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
      );
    } catch {
      // Orientation lock not supported on this device
    }
  };

  const closeFullscreen = async () => {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    } catch {
      // Orientation lock not supported on this device
    }
    setFullscreen(false);
  };

  return (
    <>
      <ChartContent
        sessions={filtered}
        width={screenW}
        height={260}
        fullscreen={false}
        onRequestFullscreen={openFullscreen}
        filterType={filterType}
        countOption={countOption}
        monthOption={monthOption}
        onFilterTypeChange={setFilterType}
        onCountChange={setCountOption}
        onMonthChange={setMonthOption}
      />

      <Modal
        visible={fullscreen}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right', 'landscape']}
        statusBarTranslucent
        onRequestClose={closeFullscreen}>
        <View style={styles.fullscreenModal}>
          <FullscreenChart
            sessions={filtered}
            onClose={closeFullscreen}
            filterType={filterType}
            countOption={countOption}
            monthOption={monthOption}
            onFilterTypeChange={setFilterType}
            onCountChange={setCountOption}
            onMonthChange={setMonthOption}
          />
        </View>
      </Modal>
    </>
  );
}

interface FullscreenProps {
  sessions: Session[];
  onClose: () => void;
  filterType: FilterType;
  countOption: CountOption;
  monthOption: MonthOption;
  onFilterTypeChange: (t: FilterType) => void;
  onCountChange: (c: CountOption) => void;
  onMonthChange: (m: MonthOption) => void;
}

function FullscreenChartInner(props: FullscreenProps) {
  const insets = useSafeAreaInsets();
  const {width, height} = Dimensions.get('window');
  const [dims, setDims] = useState({w: width, h: height});

  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({window}: {window: {width: number; height: number}}) => {
      setDims({w: window.width, h: window.height});
    });
    return () => sub.remove();
  }, []);

  const leftPad = Platform.OS === 'ios' ? insets.left : 0;
  const verticalPad = 20;

  return (
    <View style={{flex: 1, paddingLeft: leftPad, paddingTop: verticalPad, paddingBottom: verticalPad}}>
      <ChartContent
        sessions={props.sessions}
        width={dims.w - leftPad}
        height={dims.h - verticalPad * 2}
        fullscreen={true}
        onCloseFullscreen={props.onClose}
        filterType={props.filterType}
        countOption={props.countOption}
        monthOption={props.monthOption}
        onFilterTypeChange={props.onFilterTypeChange}
        onCountChange={props.onCountChange}
        onMonthChange={props.onMonthChange}
      />
    </View>
  );
}

function FullscreenChart(props: FullscreenProps) {
  return (
    <SafeAreaProvider>
      <FullscreenChartInner {...props} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  fullContainer: {
    flex: 1,
    paddingTop: 8,
  },
  fullscreenTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  topDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fullscreenLegend: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 'auto',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    marginRight: 6,
  },
  legendLineDashed: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginRight: 6,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  legendBar: {
    width: 10,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
    opacity: 0.6,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  fullscreenBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fullscreenBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#0B1929',
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filterTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 2,
  },
  filterTypeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterTypeBtnActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  filterTypeBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  filterTypeBtnTextActive: {
    color: '#0EA5E9',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterOptionBtn: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterOptionBtnActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
  },
  filterOptionText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#0EA5E9',
  },
  empty: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
  },
});
