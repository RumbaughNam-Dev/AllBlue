import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Session} from '../storage/sessions';
import SessionChart from '../components/SessionChart';

const {width: SCREEN_W} = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.3;

interface Props {
  sessions: Session[];
  onBack: () => void;
  onDetailOpenChange?: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

interface DateGroup {
  dateKey: string;
  label: string;
  sessions: Session[];
}

function getDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${h}시 ${min}분`;
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

// ─── Slide Panel (reusable for level 2 & 3) ───

function SlidePanel({
  visible,
  onClose,
  onSwipeActive,
  childOpen,
  noSafeArea,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onSwipeActive?: (active: boolean) => void;
  childOpen?: boolean;
  noSafeArea?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_W)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const childOpenRef = useRef(false);
  childOpenRef.current = !!childOpen;

  React.useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_W);
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 65,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [visible, slideAnim]);

  const close = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_W,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      closeRef.current();
    });
  }, [slideAnim]);

  const EDGE_WIDTH = 30;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, gs) =>
        !childOpenRef.current &&
        e.nativeEvent.pageX - gs.dx <= EDGE_WIDTH &&
        gs.dx > 10 &&
        Math.abs(gs.dx) > Math.abs(gs.dy * 2),
      onPanResponderGrant: () => {
        onSwipeActive?.(true);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          slideAnim.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        onSwipeActive?.(false);
        if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
          close();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 9,
            tension: 65,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, SCREEN_W],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={close}
        />
      </Animated.View>
      <Animated.View
        style={[styles.slidePanel, {transform: [{translateX: slideAnim}]}]}
        {...panResponder.panHandlers}>
        {noSafeArea ? (
          <View style={styles.slidePanelInner}>
            {typeof children === 'function'
              ? (children as (close: () => void) => React.ReactNode)(close)
              : children}
          </View>
        ) : (
          <SafeAreaView style={styles.slidePanelInner} edges={['top']}>
            {typeof children === 'function'
              ? (children as (close: () => void) => React.ReactNode)(close)
              : children}
          </SafeAreaView>
        )}
        <View style={{height: insets.bottom, backgroundColor: '#0B1929'}} />
      </Animated.View>
    </>
  );
}

// ─── Level 3: Session Detail ───

function SessionDetail({
  session,
  onClose,
  onDelete,
}: {
  session: Session;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const firstContraction =
    session.lapTimes.length > 0 ? formatLapTime(session.lapTimes[0]) : '-';
  const totalTaps = session.lapTimes.length;
  const totalDuration = formatDuration(session.duration);

  return (
    <View style={styles.panelContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>세션 상세</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Alert.alert('삭제', '이 세션 기록을 삭제하시겠습니까?', [
              {text: '취소', style: 'cancel'},
              {
                text: '삭제',
                style: 'destructive',
                onPress: () => {
                  const id = session.id;
                  onClose();
                  onDelete?.(id);
                },
              },
            ]);
          }}>
          <Text style={styles.deleteText}>삭제</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailSummary}>
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
      </View>
    </View>
  );
}

// ─── Level 2: Sessions for a Date ───

function DateSessions({
  group,
  onClose,
  onDelete,
  onDetailOpenChange,
}: {
  group: DateGroup;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onDetailOpenChange?: (open: boolean) => void;
}) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const openDetail = useCallback(
    (session: Session) => {
      setSelectedSession(session);
      setDetailVisible(true);
      onDetailOpenChange?.(true);
    },
    [onDetailOpenChange],
  );

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedSession(null);
    onDetailOpenChange?.(false);
  }, [onDetailOpenChange]);

  return (
    <View style={styles.panelContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.label}</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={group.sessions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({item, index}) => (
          <TouchableOpacity
            style={styles.listItem}
            activeOpacity={0.7}
            onPress={() => openDetail(item)}>
            <View style={styles.listItemLeft}>
              <Text style={styles.listIndex}>#{group.sessions.length - index}</Text>
              <View>
                <Text style={styles.listDate}>{formatTime(item.startTime)} 진행한 트레이닝</Text>
                <Text style={styles.listSub}>
                  {item.lapTimes.length}회 컨트랙션 · 총 {formatDuration(item.duration)} 진행
                </Text>
              </View>
            </View>
            <Text style={styles.listArrow}>›</Text>
          </TouchableOpacity>
        )}
      />

      <SlidePanel
        visible={detailVisible}
        onClose={closeDetail}
        noSafeArea
        onSwipeActive={active => onDetailOpenChange?.(active)}>
        {selectedSession && (
          <SessionDetail
            session={selectedSession}
            onClose={closeDetail}
            onDelete={id => {
              closeDetail();
              onDelete?.(id);
            }}
          />
        )}
      </SlidePanel>
    </View>
  );
}

// ─── Level 1: Date List (main) ───

export default function RecordsScreen({
  sessions,
  onBack,
  onDetailOpenChange,
  onDelete,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState<DateGroup | null>(null);
  const [dateListVisible, setDateListVisible] = useState(false);
  const [childDetailOpen, setChildDetailOpen] = useState(false);

  const dateGroups = useMemo<DateGroup[]>(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = getDateKey(s.startTime);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(s);
    }
    const groups: DateGroup[] = [];
    for (const [key, items] of map) {
      groups.push({dateKey: key, label: key, sessions: items});
    }
    return groups;
  }, [sessions]);

  const openDateGroup = useCallback(
    (group: DateGroup) => {
      setSelectedGroup(group);
      setDateListVisible(true);
      onDetailOpenChange?.(true);
    },
    [onDetailOpenChange],
  );

  const closeDateGroup = useCallback(() => {
    setDateListVisible(false);
    setSelectedGroup(null);
    onDetailOpenChange?.(false);
  }, [onDetailOpenChange]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>기록조회</Text>
        <View style={styles.backButton} />
      </View>

      {dateGroups.length === 0 ? (
        <View style={styles.emptyWithChart}>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>기록이 없습니다</Text>
          </View>
        </View>
      ) : (
        <View style={styles.bodyContainer}>
          <FlatList
            data={dateGroups}
            keyExtractor={item => item.dateKey}
            contentContainerStyle={styles.listContent}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.listItem}
                activeOpacity={0.7}
                onPress={() => openDateGroup(item)}>
                <View style={styles.listItemLeft}>
                  <View>
                    <Text style={styles.listDate}>{item.label}</Text>
                    <Text style={styles.listSub}>
                      {item.sessions.length}회 진행
                    </Text>
                  </View>
                </View>
                <Text style={styles.listArrow}>›</Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.chartFixed}>
            <View style={styles.chartDivider} />
            <SessionChart sessions={sessions} />
          </View>
        </View>
      )}

      <SlidePanel
        visible={dateListVisible}
        onClose={closeDateGroup}
        childOpen={childDetailOpen}
        onSwipeActive={active => onDetailOpenChange?.(active)}>
        {selectedGroup && (
          <DateSessions
            group={selectedGroup}
            onClose={closeDateGroup}
            onDelete={onDelete}
            onDetailOpenChange={open => {
              setChildDetailOpen(open);
              onDetailOpenChange?.(open);
            }}
          />
        )}
      </SlidePanel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1929',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#0EA5E9',
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif-medium'},
    }),
  },
  listContent: {
    paddingVertical: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIndex: {
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: '700',
    width: 40,
  },
  listDate: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif'},
    }),
  },
  listSub: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 3,
  },
  listArrow: {
    color: '#475569',
    fontSize: 22,
    fontWeight: '300',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  slidePanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SCREEN_W,
    backgroundColor: '#0B1929',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: -4, height: 0},
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  slidePanelInner: {
    flex: 1,
  },
  panelContent: {
    flex: 1,
  },
  bodyContainer: {
    flex: 1,
  },
  emptyWithChart: {
    flex: 1,
  },
  chartFixed: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  chartDivider: {
    height: 0,
  },
  detailSummary: {
    padding: 20,
    gap: 12,
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
    borderColor: 'rgba(14, 165, 233, 0.15)',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#0EA5E9',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
