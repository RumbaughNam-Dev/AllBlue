import TemporaryUserLinkModal from '@/components/TemporaryUserLinkModal';
import PopupBackdrop from '@/components/PopupBackdrop';
import ProfileLink from '@/components/ProfileLink';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Modal, Platform, Linking, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { api, ScheduleDetail } from '@/services/api';
import Spinner from '@/components/Spinner';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { hasInstructorAccess } from '@/utils/userRole';

const STUDENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'LECTURE'];
const DOCUMENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'TRAINING'];
const FORM_BASE_URL = 'https://rumbaugh.co.kr/form';
const CATEGORIES_MAP: Record<string, string> = {
  EXPERIENCE: '체험교육', CERTIFICATION: '자격증 과정', LECTURE: '특강',
  TRAINING: '트레이닝', FUN_DIVE: '펀다이빙', ETC: '기타',
};

export default function ScheduleDetailScreen() {
  const { user } = useAuth();
  const isQualifiedInstructor = hasInstructorAccess(user?.level);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, filter = 'mine', sourceLabel } = useLocalSearchParams<{ id: string; filter?: string; sourceLabel?: string }>();
  const scheduleSource = filter === 'instructor' ? '강사 공개 일정'
    : filter === 'closeFriend' ? '친한친구 일정'
    : filter.startsWith('group_') ? (sourceLabel ?? '그룹 일정') : '내 일정';
  const request = useLatestRequest();
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invitationBusy, setInvitationBusy] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [linkVisible, setLinkVisible] = useState(false);
  const [linkSource, setLinkSource] = useState<{ id: number; nickname: string } | null>(null);

  const fetchDetail = useCallback((showLoading = true) => {
    if (!id || !user) return;
    const isCurrent = request.start();
    if (showLoading) { setLoading(true); setSchedule(null); }
    api.getScheduleDetail(Number(id), filter)
      .then((res) => { if (isCurrent()) setSchedule(res.schedule); })
      .catch((e) => {
        if (isCurrent()) setSchedule(null);
        if (isCurrent() && !e._handled) Alert.alert('오류', '일정을 불러올 수 없습니다.');
      })
      .finally(() => { if (isCurrent()) { setLoading(false); setRefreshing(false); } });
  }, [id, filter, request, user?.id]);

  const initialLoad = useRef(true);

  useEffect(() => { fetchDetail(); return () => request.invalidate(); }, [fetchDetail, request]);

  useFocusEffect(
    useCallback(() => {
      if (initialLoad.current) {
        initialLoad.current = false;
      } else {
        fetchDetail(false);
      }
      // External browsers do not blur the navigation route. Refresh when the
      // app resumes, including returns that do not submit or change a document.
      let appState = AppState.currentState;
      const subscription = AppState.addEventListener('change', (nextState) => {
        const resumed = appState !== 'active' && nextState === 'active';
        appState = nextState;
        if (resumed) fetchDetail(false);
      });
      return () => {
        subscription.remove();
        request.invalidate();
      };
    }, [fetchDetail, request])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDetail(false);
  };

  const participantLabel = schedule
    ? (STUDENT_CATEGORIES.includes(schedule.categoryCode) ? '교육생' : '참석자')
    : '참석자';

  const isOwner = schedule?.isOwner ?? false;
  const myParticipantId = schedule?.myParticipantId;

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSchedule(Number(id));
            Alert.alert('알림', '일정이 삭제되었습니다.', [
              { text: '확인', onPress: () => router.back() },
            ]);
          } catch (e: any) {
            if (!e._handled) Alert.alert('삭제 실패', e.message ?? '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const handleInvitation = async (participantId: number, action: 'accept' | 'reject' | 'remove' | 'resend', token?: string | null) => {
    if (invitationBusy) return;
    setInvitationBusy(true);
    try {
      if (action === 'accept' || action === 'reject') {
        if (!token) return;
        await api.respondToSchedule(Number(id), action, token);
      } else await api.manageScheduleInvitation(Number(id), participantId, action);
      if (action === 'reject') router.back();
      else fetchDetail(false);
    } catch (e: any) {
      if (!e._handled) Alert.alert('요청 처리 실패', e.message ?? '다시 시도해주세요.');
    } finally { setInvitationBusy(false); }
  };

  const openFormUrl = async (url: string) => {
    try {
      if (Platform.OS === 'ios') {
        // SFSafariViewController의 상단 제스처 영역이 웹 페이지 버튼 터치를 방해하므로
        // iOS에서는 시스템 사파리로 열기 (복귀 시 AppState로 새로고침)
        await Linking.openURL(url);
      } else {
        // Android resolves this promise when the browser opens, not on return.
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      Alert.alert('문서 열기 실패', '브라우저를 열지 못했습니다. 다시 시도해주세요.');
    }
  };

  const openDocument = (uuid?: string, participantId?: number) => {
    if (!uuid) {
      Alert.alert('알림', '서류가 등록되지 않았습니다.');
      return;
    }
    if (!isOwner && myParticipantId !== participantId) {
      Alert.alert('알림', '내 일정 또는 내 문서만 조회할 수 있어요.');
      return;
    }
    void openFormUrl(`${FORM_BASE_URL}/${uuid}?from=instructor`);
  };

  const copyScheduleUrl = async () => {
    setMenuVisible(false);
    if (!schedule) return;
    try {
      await Clipboard.setStringAsync(`https://rumbaugh.co.kr/allblue/schedule.html?id=${encodeURIComponent(String(schedule.id))}`);
      Alert.alert('알림', '일정 URL이 복사되었습니다.');
    } catch {
      Alert.alert('복사 실패', '일정 URL을 복사하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const copyFormUrl = async (uuid?: string, participantId?: number) => {
    if (!uuid) return;
    if (!isOwner && myParticipantId !== participantId) {
      Alert.alert('알림', '내 일정 또는 내 문서만 조회할 수 있어요.');
      return;
    }
    const url = `${FORM_BASE_URL}/${uuid}`;
    await Clipboard.setStringAsync(url);
    Alert.alert('알림', 'URL이 복사되었습니다.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {schedule?.title ?? ''}
        </Text>
        <Pressable
          onPress={() => setMenuVisible(!menuVisible)}
          style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.menuCircle}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </View>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : schedule ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Info rows */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>일정 구분</Text>
              <Text style={styles.infoValue}>{scheduleSource}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>장소</Text>
              <Text style={styles.infoValue}>{schedule.poolName || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>분류</Text>
              <Text style={styles.infoValue}>{schedule.categoryName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>일시</Text>
              <Text style={styles.infoValue}>
                {(() => {
                  const d = new Date(schedule.scheduleDate + 'T00:00:00');
                  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ${String(schedule.startHour).padStart(2, '0')}시 ${String(schedule.startMinute).padStart(2, '0')}분`;
                })()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Participants */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{participantLabel}</Text>
            <Pressable onPress={handleRefresh} disabled={refreshing} style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.5 }]}>
              <Text style={[styles.refreshIcon, refreshing && { opacity: 0.3 }]}>↻</Text>
            </Pressable>
          </View>
          {schedule.participants.length === 0 ? (
            <Text style={styles.emptyText}>{participantLabel}가 없습니다</Text>
          ) : (
            schedule.participants.map((p) => {
              const isMe = !p.isGuest && myParticipantId === p.id;
              const showCopyUrl = isOwner && !isMe;
              const showSignButton = isMe && !isOwner;
              const category = p.categoryCode ?? schedule.categoryCode;
              const accepted = !p.invitationStatus || p.invitationStatus === 'accepted';
              const showDocuments = accepted && DOCUMENT_CATEGORIES.includes(category);
              const showLogs = accepted && STUDENT_CATEGORIES.includes(category);

              const openFormForSign = (uuid?: string) => {
                if (!uuid) return;
                void openFormUrl(`${FORM_BASE_URL}/${uuid}`);
              };

              return (
              <View key={`${p.isGuest ? 'g' : 'u'}_${p.id}`} style={styles.participantCard}>
                <View style={styles.participantHeader}>
                  <ProfileLink userId={p.isGuest || (p.isTemporary && !isOwner) ? null : p.userId} label={p.nickname}><ProfileAvatar profileImage={p.isGuest ? null : p.profileImage} nickname={p.nickname} level={p.level} /></ProfileLink>
                  <View style={styles.participantInfo}>
                    <ProfileLink userId={p.isGuest || (p.isTemporary && !isOwner) ? null : p.userId} label={p.nickname} style={styles.participantNameRow}>
                      <Text style={styles.participantName}>
                        {p.nickname}{p.isTemporary ? ' · 임시 사용자' : ''}{p.name && p.name !== p.nickname ? ` (${p.name})` : ''}
                      </Text>
                    </ProfileLink>
                    <Text style={styles.participantMetaText}>
                      {CATEGORIES_MAP[category] ?? category}
                    </Text>
                  </View>
                </View>
                {p.participantLicenses && p.participantLicenses.length > 0 && (
                  <View style={styles.licenseList}>
                    {p.participantLicenses.map((license, index) => (
                      <View key={`${license.nameKo}_${index}`} style={styles.licenseRow}>
                        <View style={styles.licenseDot} />
                        <Text style={styles.licenseText}>{license.nameKo}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {p.canLinkTemporary && <Pressable accessibilityRole="button" onPress={() => { setLinkSource({ id: p.id, nickname: p.nickname }); setLinkVisible(true); }}
                  style={{ padding: 12, marginTop: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>가입 사용자로 연결</Text>
                </Pressable>}
                {p.invitationStatus === 'pending' && (isOwner || isMe) && (
                  <View style={[styles.cardSection, styles.invitationSection]}>
                    <Text style={styles.invitationStatus}>{isOwner ? '일정등록 요청을 보냈어요!' : '일정 등록 요청'}</Text>
                    {isMe && !isOwner && <View style={styles.invitationActions}>
                      {(['accept', 'reject'] as const).map(action => (
                        <Pressable key={action} accessibilityRole="button" disabled={invitationBusy}
                          style={({ pressed }) => [styles.actionButton, styles.invitationButton, action === 'accept' && styles.actionButtonDone, (pressed || invitationBusy) && { opacity: 0.5 }]}
                          onPress={() => handleInvitation(p.id, action, p.invitationToken)}>
                          <Text style={[styles.actionButtonText, action === 'accept' && styles.actionButtonTextDone]}>{action === 'accept' ? '수락' : '거절'}</Text>
                        </Pressable>
                      ))}
                    </View>}
                  </View>
                )}
                {p.invitationStatus === 'rejected' && isOwner && (
                  <View style={[styles.cardSection, styles.invitationSection]}>
                    <Text style={[styles.invitationStatus, { color: '#FF9292' }]}>일정등록 요청을 거부했어요. 😢</Text>
                    <View style={styles.invitationActions}>
                    {(['remove', 'resend'] as const).map(action => (
                      <Pressable key={action} disabled={invitationBusy} style={styles.actionButton} onPress={() => handleInvitation(p.id, action)}>
                        <Text style={styles.actionButtonText}>{action === 'remove' ? '요청 지우기' : '다시 요청하기'}</Text>
                      </Pressable>
                    ))}
                    </View>
                  </View>
                )}
                {showDocuments && (isOwner || isMe) && (<View style={styles.cardSection}>
                <View style={styles.docRow}>
                  <Text style={styles.docLabel}>면책동의서</Text>
                  <View style={styles.docActions}>
                    {p.waiverSigned ? (
                      <Pressable onPress={() => openDocument(p.waiverUuid, p.id)}>
                        <View style={[styles.docBadge, styles.docBadgeSigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextSigned]}>완료</Text>
                        </View>
                      </Pressable>
                    ) : (
                      <>
                        <View style={[styles.docBadge, styles.docBadgeUnsigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextUnsigned]}>미제출</Text>
                        </View>
                        {p.waiverUuid && !p.waiverReused && showCopyUrl && (
                          <Pressable onPress={() => copyFormUrl(p.waiverUuid, p.id)} style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.copyText}>URL 복사</Text>
                          </Pressable>
                        )}
                        {p.waiverUuid && !p.waiverReused && showSignButton && (
                          <Pressable onPress={() => openFormForSign(p.waiverUuid)} style={({ pressed }) => [styles.signButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.signText}>서명하기</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.docRow}>
                  <Text style={styles.docLabel}>의료진술서</Text>
                  <View style={styles.docActions}>
                    {p.medicalSigned ? (
                      <Pressable onPress={() => openDocument(p.medicalUuid, p.id)}>
                        <View style={[styles.docBadge, styles.docBadgeSigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextSigned]}>완료</Text>
                        </View>
                      </Pressable>
                    ) : (
                      <>
                        <View style={[styles.docBadge, styles.docBadgeUnsigned]}>
                          <Text style={[styles.docBadgeText, styles.docTextUnsigned]}>미제출</Text>
                        </View>
                        {p.medicalUuid && !p.medicalReused && showCopyUrl && (
                          <Pressable onPress={() => copyFormUrl(p.medicalUuid, p.id)} style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.copyText}>URL 복사</Text>
                          </Pressable>
                        )}
                        {p.medicalUuid && !p.medicalReused && showSignButton && (
                          <Pressable onPress={() => openFormForSign(p.medicalUuid)} style={({ pressed }) => [styles.signButton, pressed && { opacity: 0.6 }]}>
                            <Text style={styles.signText}>서명하기</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </View>
                </View>)}
                {/* 라이센스 정보 / 디브리핑 버튼 */}
                {(() => {
                  const isOwnLog = !!user?.id && p.userId === user.id;
                  const showLicense = isOwnLog || (showLogs && !p.isGuest && isQualifiedInstructor && p.canViewDivingLog === true);
                  const showDebriefing = accepted && (showLogs || category === 'TRAINING') && !p.isGuest && isOwner && !isOwnLog && isQualifiedInstructor && p.canWriteDebriefing === true;
                  if (!showLicense && !showDebriefing) return null;
                  return (
                    <View style={styles.actionRow}>
                      {showLicense && (
                        <Pressable
                          onPress={() => {
                            if (p.isGuest) {
                              Alert.alert('알림', '앱 사용자가 아닙니다.');
                              return;
                            }
                            router.push({
                              pathname: '/achievement',
                              params: {
                                participantId: String(p.id),
                                profileUserId: p.isGuest ? undefined : p.userId ?? undefined,
                                participantName: p.name ? `${p.nickname} (${p.name})` : p.nickname,
                                participantLevel: p.level != null ? String(p.level) : '',
                              },
                            });
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.actionButtonText}>다이빙 로그</Text>
                        </Pressable>
                      )}
                      {showDebriefing && (
                        <Pressable
                          onPress={() => {
                            router.push({
                              pathname: '/debriefing',
                              params: {
                                scheduleId: String(schedule!.id),
                                participantId: String(p.id),
                                profileUserId: p.isGuest ? undefined : p.userId ?? undefined,
                                participantName: p.name ? `${p.nickname} (${p.name})` : p.nickname,
                                isGuest: p.isGuest ? '1' : '0',
                                participantCategory: category,
                              },
                            });
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.actionButtonText}>디브리핑</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
              </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>일정 정보를 찾을 수 없습니다</Text>
        </View>
      )}

      <TemporaryUserLinkModal visible={linkVisible} scheduleId={Number(id)} source={linkSource}
        onClose={() => setLinkVisible(false)} onLinked={() => { setLinkVisible(false); fetchDetail(false); }} />

      {/* Dropdown Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <PopupBackdrop />
          <View style={[styles.menuDropdown, { top: Platform.OS === 'ios' ? insets.top + 52 : 52 }]}>
            <Pressable
              disabled={!schedule}
              style={({ pressed }) => [styles.menuItem, !schedule && { opacity: 0.4 }, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={copyScheduleUrl}
            >
              <Ionicons name="copy-outline" size={20} color={Colors.brand.white} accessible={false} />
              <Text style={styles.menuItemText}>일정 URL 복사</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                if (!isOwner) {
                  Alert.alert('알림', '내 일정만 수정할 수 있습니다.');
                  return;
                }
                if (schedule) {
                  router.push({ pathname: '/schedule-add', params: { id: String(schedule.id), date: schedule.scheduleDate } });
                }
              }}
            >
              <Ionicons name="create-outline" size={20} color={Colors.brand.white} accessible={false} />
              <Text style={styles.menuItemText}>수정</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                if (!isOwner) {
                  Alert.alert('알림', '내 일정만 삭제할 수 있습니다.');
                  return;
                }
                handleDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={'#FF6B6B'} accessible={false} />
              <Text style={[styles.menuItemText, styles.menuItemDelete]}>삭제</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: {
    flex: 1, fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center',
  },
  menuButton: {
    width: 36, height: 36,
  },
  menuCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  hamburgerLine: {
    width: 18, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuDropdown: {
    position: 'absolute', right: 20,
    backgroundColor: Colors.brand.deep ?? '#022B4A',
    borderRadius: 12, minWidth: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  menuItemText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
  },
  menuItemDelete: {
    color: '#FF6B6B',
  },
  menuDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  infoSection: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    width: 60, marginRight: 16,
  },
  infoValue: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    flex: 1,
  },
  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
  },
  refreshButton: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 20, color: 'rgba(255,255,255,0.5)',
  },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', paddingVertical: 20,
  },
  participantCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14,
  },
  participantHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  participantInfo: { flex: 1, minWidth: 0, minHeight: 40, justifyContent: 'center', gap: 2 },
  participantNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  participantName: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, lineHeight: 20, color: Colors.brand.white, flexShrink: 1,
  },
  cardSection: {
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  invitationSection: { gap: 10 },
  invitationStatus: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 20, color: '#FFD166',
  },
  invitationActions: { flexDirection: 'row', gap: 8 },
  invitationButton: { minHeight: 40, justifyContent: 'center' },
  actionRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  actionButton: {
    flex: 1, backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning,
  },
  actionButtonDone: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  actionButtonTextDone: {
    color: Colors.brand.success,
  },
  participantMetaText: {
    fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.55)',
  },
  licenseList: { gap: 4, marginLeft: 52, marginTop: 8 },
  licenseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  licenseDot: { width: 3, height: 3, borderRadius: 2, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.45)' },
  licenseText: {
    flex: 1, minWidth: 0, fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 19, color: 'rgba(255,255,255,0.7)',
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  docLabel: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)',
  },
  docActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  copyButton: {
    backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  copyText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.warning,
  },
  signButton: {
    backgroundColor: 'rgba(235,160,60,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  signText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 11, color: Colors.brand.warning,
  },
  docBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  docBadgeSigned: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  docBadgeUnsigned: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  docBadgeText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 12,
  },
  docTextSigned: {
    color: Colors.brand.success,
  },
  docTextUnsigned: {
    color: 'rgba(255,255,255,0.3)',
  },
});
