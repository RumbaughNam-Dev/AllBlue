import PopupBackdrop from '@/components/PopupBackdrop';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, DeviceEventEmitter, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { mergeNotificationWindow } from './window';
import { formatNotificationDate } from './date';
import Colors from '@/constants/Colors';
import { api, AppNotification } from '@/services/api';

const ROW_HEIGHT = 132;
export default function NotificationBell() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = height < 650;
  const anchor = useRef<View>(null);
  const list = useRef<FlatList<AppNotification>>(null);
  const [origin, setOrigin] = useState({ x: 20, y: 50 });
  const [visible, setVisible] = useState(false);
  const [all, setAll] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const rows = useRef<AppNotification[]>([]);
  const epoch = useRef(0);
  const busy = useRef(false);
  const moving = useRef(false);
  const older = useRef(true);
  const newer = useRef(false);
  const ceiling = useRef<number | undefined>(undefined);
  const offset = useRef(0);
  const adjust = useRef<number | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const panelWidth = Math.min(width - 32, 420), panelHeight = Math.min(height * 0.76, 660);
  const commit = (next: AppNotification[]) => { rows.current = next; setItems(next); };

  const refreshCount = useCallback(async () => {
    try { const result = await api.getNotifications(); setCount(result.unreadCount); } catch { /* keep last known count */ }
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => { if (active && AppState.currentState === 'active') void refreshCount(); };
    refresh();
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    const events = DeviceEventEmitter.addListener('notificationsChanged', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; state.remove(); events.remove(); clearInterval(timer); };
  }, [refreshCount]));
  useEffect(() => () => { epoch.current++; }, []);
  useEffect(() => {
    if (adjust.current === null) return;
    const y = adjust.current;
    adjust.current = null;
    offset.current = y;
    const frame = requestAnimationFrame(() => list.current?.scrollToOffset({ offset: y, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [items]);

  const load = async (direction: 'reset' | 'older' | 'newer', showAll = all) => {
    if (direction !== 'reset' && (busy.current || (direction === 'older' ? !older.current : !newer.current))) return;
    const version = direction === 'reset' ? ++epoch.current : epoch.current;
    busy.current = true; setLoading(true); setError(false);
    if (direction === 'reset') { ceiling.current = undefined; older.current = true; newer.current = false; commit([]); offset.current = 0; }
    try {
      const current = rows.current;
      const result = await api.getNotifications({ all: showAll, ceiling: ceiling.current,
        ...(direction === 'older' && current.length ? { before: current[current.length - 1].id } : {}),
        ...(direction === 'newer' && current.length ? { after: current[0].id } : {}),
      });
      if (version !== epoch.current) return;
      setCount(result.unreadCount);
      if (direction === 'reset') {
        ceiling.current = result.items[0]?.id;
        older.current = result.hasMore;
        commit(result.items);
      } else {
        const merged = mergeNotificationWindow(current, result.items, direction);
        if (direction === 'older') {
          older.current = result.hasMore;
          if (merged.trimmed) {
            newer.current = true;
            adjust.current = Math.max(0, offset.current - merged.trimmed * ROW_HEIGHT);
          }
        } else {
          newer.current = result.hasMore;
          if (merged.trimmed) older.current = true;
          adjust.current = offset.current + merged.prepended * ROW_HEIGHT;
        }
        commit(merged.items);
      }
    } catch { if (version === epoch.current) setError(true); }
    finally { if (version === epoch.current) { busy.current = false; setLoading(false); } }
  };
  const close = () => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setVisible(false); epoch.current++; busy.current = false;
    });
  };
  const open = () => {
    anchor.current?.measureInWindow((x, y) => {
      setOrigin({ x, y }); setVisible(true); setAll(false); void load('reset', false);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
    });
  };
  const go = async (item: AppNotification) => {
    if (moving.current) return;
    moving.current = true;
    try {
      await api.readNotification(item.id);
      DeviceEventEmitter.emit('notificationsChanged');
      setVisible(false); epoch.current++; busy.current = false; progress.setValue(0);
      router.push({ pathname: '/schedule-detail', params: { id: String(item.scheduleId), filter: 'notification' } });
    } catch { Alert.alert('알림', '알림을 열지 못했습니다. 다시 시도해주세요.'); }
    finally { moving.current = false; }
  };
  const hide = async (item: AppNotification) => {
    try { await api.hideNotification(item.id); await load('reset'); }
    catch { Alert.alert('알림', '알림을 삭제하지 못했습니다.'); }
  };
  const icon = (onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`알림 ${count}건`} onPress={onPress} style={styles.bell}>
      <Ionicons name="notifications-outline" size={25} color="white" />
      {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
    </Pressable>
  );
  return <>
    <View ref={anchor} collapsable={false}>{icon(open)}</View>
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={StyleSheet.absoluteFill}>
        <PopupBackdrop />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} accessibilityRole="button" accessibilityLabel="알림 닫기" />
        </Animated.View>
        <Animated.View style={[styles.panel, { width: panelWidth, height: panelHeight, left: (width - panelWidth) / 2, top: (height - panelHeight) / 2,
          opacity: progress, transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.x + 22 - width / 2, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.y + 22 - height / 2, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) },
          ] }]}>
          <View style={styles.header}>
            <View style={styles.headingGroup}>
              <View style={styles.eyebrowLine}><View style={styles.accentLine} /><Text style={styles.eyebrow}>ALLBLUE</Text></View>
              <Text accessibilityRole="header" style={styles.heading}>알림</Text>
              <Text style={styles.subtitle}>함께하는 다이빙의 새로운 소식</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={close}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={22} color="#D4E5F5" />
            </Pressable>
          </View>
          <View style={styles.tabs}>
            {[false, true].map(showAll => <Pressable key={String(showAll)} accessibilityRole="tab"
              accessibilityState={{ selected: all === showAll }}
              onPress={() => { if (all !== showAll) { setAll(showAll); void load('reset', showAll); } }}
              style={({ pressed }) => [styles.tab, all === showAll && styles.activeTab, pressed && styles.pressed]}>
              <Text style={[styles.tabText, all === showAll && styles.activeTabText]}>{showAll ? '전체' : '미확인'}</Text>
              {!showAll && count > 0 && <View style={[styles.countBadge, !all && styles.activeCountBadge]}>
                <Text style={[styles.countText, !all && styles.activeCountText]}>{count > 99 ? '99+' : count}</Text>
              </View>}
            </Pressable>)}
          </View>
          {error && items.length > 0 && <Pressable accessibilityRole="button" onPress={() => load('reset')} style={styles.retryInline}>
            <Text style={styles.stateDescription}>소식을 불러오지 못했어요. 다시 시도</Text>
            <Ionicons name="refresh-outline" size={18} color="#92DDEB" />
          </Pressable>}
          <FlatList testID="notification-list" ref={list} data={items} keyExtractor={item => String(item.id)} style={styles.list}
            contentContainerStyle={items.length ? styles.listContent : styles.emptyContent} showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            onEndReached={() => { if (items.length) void load('older'); }} onEndReachedThreshold={0.25}
            onScroll={event => {
              const y = event.nativeEvent.contentOffset.y, previous = offset.current; offset.current = y;
              if (y < 80 && y < previous && adjust.current === null) void load('newer');
            }} scrollEventThrottle={32}
            onContentSizeChange={() => {
              if (adjust.current !== null) { const y = adjust.current; adjust.current = null; offset.current = y; list.current?.scrollToOffset({ offset: y, animated: false }); }
            }}
            ListEmptyComponent={<View style={[styles.state, compact && styles.compactState]}>
              <View style={[styles.stateHalo, compact && styles.compactHalo]}><View style={[styles.stateIcon, compact && styles.compactIcon]}>
                {loading ? <ActivityIndicator color="#92DDEB" /> : <Ionicons name={error ? 'cloud-offline-outline' : 'notifications-outline'} size={30} color="#92DDEB" />}
              </View></View>
              <Text style={styles.stateTitle}>{loading ? '새로운 소식을 가져오고 있어요' : error ? '잠시 소식을 가져오지 못했어요' : all ? '아직 도착한 소식이 없어요' : '새로운 소식을 모두 확인했어요'}</Text>
              <Text style={styles.stateDescription}>{loading ? '잠시만 기다려 주세요.' : error ? '연결을 확인하고 다시 시도해 주세요.' : '새로운 다이빙 소식이 오면 알려드릴게요.'}</Text>
              {error && !loading && <Pressable accessibilityRole="button" onPress={() => load('reset')}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <Ionicons name="refresh-outline" size={16} color="#92DDEB" /><Text style={styles.retryText}>다시 시도</Text>
              </Pressable>}
            </View>}
            renderItem={({ item }) => <View style={styles.row}>
              <View style={[styles.card, !item.readAt && styles.unread]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.readAt ? '' : '새 알림, '}${item.title}, ${item.body}`}
                  style={({ pressed }) => [styles.rowContent, pressed && styles.pressed]} onPress={() => go(item)}>
                  <View style={styles.metaLine}>
                    <View style={styles.statusLine}>
                      <Ionicons name="calendar-outline" size={13} color={item.readAt ? '#8FA9C4' : '#92DDEB'} />
                      <Text style={[styles.statusText, !item.readAt && styles.newStatus]}>{item.readAt ? '확인한 소식' : '새로운 소식'}</Text>
                    </View>
                    <Text style={styles.date}>{formatNotificationDate(item.createdAt)}</Text>
                  </View>
                  <Text style={[styles.title, !!item.readAt && styles.readTitle]} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                </Pressable>
                {!!item.readAt && <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 알림 삭제`} onPress={() => hide(item)}
                  style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
                  <Ionicons name="close-outline" size={18} color="#8FA9C4" />
                </Pressable>}
              </View>
            </View>}
            ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator color="#92DDEB" style={styles.loadingMore} /> : null}
          />
          <View style={styles.footer}>
            <Ionicons name="information-circle-outline" size={14} color="#90ACC7" />
            <Text style={styles.footerText}>알림을 누르면 해당 일정으로 이동해요</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: 0, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  backdrop: { backgroundColor: 'transparent' },
  panel: { position: 'absolute', borderRadius: 28, backgroundColor: '#083763', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(183,221,255,0.2)', boxShadow: '0 24px 64px rgba(0, 15, 35, 0.35)' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 26, paddingBottom: 22 },
  headingGroup: { flex: 1 },
  eyebrowLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  accentLine: { width: 16, height: 2, borderRadius: 1, backgroundColor: '#92DDEB' },
  eyebrow: { color: '#92DDEB', fontSize: 10, letterSpacing: 2.2, fontFamily: 'SUIT-Bold' },
  heading: { color: Colors.brand.white, fontSize: 28, lineHeight: 36, fontFamily: 'SUIT-Bold' },
  subtitle: { color: '#A8BFD6', fontSize: 13, lineHeight: 20, fontFamily: 'SUIT-Regular', marginTop: 5 },
  closeButton: { width: 44, height: 44, marginRight: -8, marginTop: -8, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 18, padding: 4, borderRadius: 15, backgroundColor: 'rgba(0,16,40,0.24)', gap: 4 },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 11 },
  activeTab: { backgroundColor: '#E7F3FC' },
  tabText: { color: '#9DB8D2', fontSize: 14, fontFamily: 'SUIT-SemiBold' },
  activeTabText: { color: Colors.brand.deep },
  countBadge: { minWidth: 23, height: 21, paddingHorizontal: 6, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  activeCountBadge: { backgroundColor: '#CEE4F5' },
  countText: { color: '#BCD2E6', fontSize: 11, fontFamily: 'SUIT-Bold' },
  activeCountText: { color: Colors.brand.deep },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  row: { height: ROW_HEIGHT, paddingBottom: 10 },
  card: { flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(186,216,246,0.07)' },
  unread: { backgroundColor: '#144A78', borderColor: 'rgba(143,205,237,0.23)' },
  rowContent: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
  metaLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { color: '#8FA9C4', fontSize: 10, fontFamily: 'SUIT-SemiBold' },
  newStatus: { color: '#92DDEB' },
  date: { color: '#9BB5CF', fontSize: 10, fontFamily: 'SUIT-Regular' },
  title: { color: Colors.brand.white, fontSize: 15, lineHeight: 21, fontFamily: 'SUIT-SemiBold', marginBottom: 4, paddingRight: 22 },
  readTitle: { color: '#C8D9E9' },
  body: { color: '#B5CBE0', fontSize: 12, lineHeight: 18, fontFamily: 'SUIT-Regular', paddingRight: 22 },
  delete: { position: 'absolute', right: 0, bottom: 16, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  state: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  stateHalo: { width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(146,221,235,0.035)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  stateIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(146,221,235,0.07)', borderWidth: 1, borderColor: 'rgba(146,221,235,0.12)', alignItems: 'center', justifyContent: 'center' },
  compactState: { paddingVertical: 12 },
  compactHalo: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  compactIcon: { width: 56, height: 56, borderRadius: 28 },
  stateTitle: { color: '#E4EFF8', fontFamily: 'SUIT-SemiBold', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  stateDescription: { color: '#9BB5CF', fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(146,221,235,0.1)', paddingHorizontal: 18, minHeight: 44, marginTop: 20 },
  retryText: { color: '#92DDEB', fontFamily: 'SUIT-SemiBold', fontSize: 13 },
  retryInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 12 },
  loadingMore: { padding: 12 },
  footer: { flexDirection: 'row', gap: 6, paddingVertical: 17, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(186,216,246,0.09)' },
  footerText: { color: '#90ACC7', fontFamily: 'SUIT-Regular', fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.65 },
});
