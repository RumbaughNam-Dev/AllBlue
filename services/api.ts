import type { Notice, NoticeInput, PopupSlide } from '@/features/notices/types';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType, type UploadProgress } from 'expo-file-system';

import { API_BASE_URL as BASE_URL } from '@/constants/Environment';

let onSessionExpired: (() => Promise<void>) | null = null;
let expiredToken: string | null = null;

export function setSessionExpiredHandler(handler: (() => Promise<void>) | null) {
  onSessionExpired = handler;
  expiredToken = null;
}

async function handleUnauthorized(token: string | null) {
  // Ignore late responses from a previous session and coalesce concurrent 401s.
  if (!token || token !== await AsyncStorage.getItem('authToken') || expiredToken === token) return;
  expiredToken = token;
  await onSessionExpired?.();
  Alert.alert('세션 만료', '로그인 세션이 만료되었습니다.\n다시 로그인해주세요.');
}

type RequestOptions = RequestInit & {
  authToken?: string;
  ignoreUnauthorized?: boolean;
};

async function parseResponse<T>(status: number, body: string, token: string | null, ignoreUnauthorized = false): Promise<T> {
  // Check authentication before parsing: an upstream 401 may have an empty or HTML body.
  if (status === 401) {
    if (!ignoreUnauthorized) await handleUnauthorized(token);
    throw { status, message: '인증이 만료되었습니다. 다시 시도해주세요.', _handled: !ignoreUnauthorized && !!token };
  }

  let data;
  try {
    data = body ? JSON.parse(body) : undefined;
  } catch {
    throw { status, message: '서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' };
  }
  if (status < 200 || status >= 300) {
    throw { ...data, status, message: data?.message || '요청을 처리하지 못했습니다.' };
  }
  return data as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authToken, ignoreUnauthorized = false, ...fetchOptions } = options;
  const token = authToken ?? await AsyncStorage.getItem('authToken');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });
    return await parseResponse<T>(res.status, await res.text(), token, ignoreUnauthorized);
  } catch (error) {
    if (controller.signal.aborted) {
      throw { message: '서버 응답이 지연되고 있습니다. 다시 시도해주세요.' };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type KakaoAuthResponse =
  | {
      isNewUser: false;
      token: string;
      user: { id: string; name?: string; nickname: string; profileImage?: string };
    }
  | {
      isNewUser: true;
      tempToken: string;
      kakaoUser: {
        kakaoId: string;
        email?: string;
        nickname?: string;
        profileImage?: string;
      };
    };

export type RegisterResponse = {
  token: string;
  user: { id: string; name?: string; nickname: string; profileImage?: string };
};

export type Profile = {
  nickname?: string;
  name?: string | null;
  level: number | string | null; badgeLevel?: string | number | null;
  description: string | null;
  shoesSize: number | null;
  finSize: string | null;
  sta: number | null;
  dynb: number | null;
  dyn: number | null;
  dnf: number | null;
  fim: number | null;
  cwtb: number | null;
  cwt: number | null;
  cnf: number | null;
};

// 캘린더 날짜 광고. startDate~endDate(YYYY-MM-DD) 구간을 borderColor 테두리로 묶어 표시
export type CalendarEvent = {
  id: number;
  startDate: string;
  endDate: string;
  title: string;
  url: string | null;
  borderColor: string;
};

export type ScheduleParticipantSummary = {
  userId?: string | null;
  nickname: string;
  name?: string;
  level?: string | number | null; badgeLevel?: string | number | null;
};

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'removed';
// notificationType: SCHEDULE_INVITE(일정 초대) · 커뮤니티 알림 COMMUNITY_* (communityPostId와 함께) · 투어 알림 TOUR_* (tourId와 함께)
export type AppNotification = { id: number; senderId: string; receiverId: string; notificationType?: string; scheduleId: number | null; communityPostId?: number | null; tourId?: number | null; title: string; body: string; readAt: string | null; createdAt: string };

export type Schedule = {
  invitationStatus?: InvitationStatus | null;
  id: number;
  title: string;
  scheduleDate: string;
  startHour: number;
  startMinute: number;
  poolName: string;
  // 직접 입력한 장소 (풀장 목록 외). 있으면 poolName과 같은 값
  customLocation?: string | null;
  categoryCode: string;
  categoryName: string;
  instructorName: string;
  participantCount: number;
  participantNames: string[];
  participants?: ScheduleParticipantSummary[];
  minLevel?: string | number | null;
  minCourseLevel?: number | null;
};

export type ScheduleParticipant = {
  canLinkTemporary?: boolean;
  // Set only on the schedule where an unregistered user was linked to this account, for the person who linked it.
  temporaryLink?: { auditId: number; sourceName: string } | null;
  canViewDivingLog?: boolean;
  canWriteDebriefing?: boolean;
  // 강사간 수강생 정보 공유 글 수: 일정을 만든 강사에게, 수락한 체험교육 · 자격증 과정 · 트레이닝 수강생(앱 사용자)일 때만 숫자.
  // null · 없음이면 버튼을 숨김 (서버가 권한을 판단)
  instructorNoteCount?: number | null;
  userId?: string | null;
  invitationStatus?: InvitationStatus;
  invitationToken?: string | null;
  id: number;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null; badgeLevel?: string | number | null;
  isGuest?: boolean;
  isTemporary?: boolean;
  hasInProgressLicense?: boolean;
  debriefingDone?: boolean;
  categoryCode?: string;
  participantLicenses?: { userLicenseId: number; code: string; nameKo: string }[];
  waiverSigned: boolean;
  medicalSigned: boolean;
  waiverUrl?: string;
  medicalUrl?: string;
  waiverUuid?: string;
  medicalUuid?: string;
  waiverReused?: boolean;
  medicalReused?: boolean;
};

export type ScheduleDetail = {
  id: number;
  title: string;
  scheduleDate: string;
  startHour: number;
  startMinute: number;
  poolName: string;
  // 직접 입력한 장소 (풀장 목록 외). 있으면 poolName과 같은 값
  customLocation?: string | null;
  categoryCode: string;
  categoryName: string;
  instructorName: string;
  visibility?: string;
  isOwner: boolean;
  myParticipantId?: number;
  creator?: {
    id: number;
    userId: string;
    nickname: string;
    name?: string | null;
    profileImage?: string | null;
    level?: string | number | null; badgeLevel?: string | number | null;
    certifications?: Certification[];
  };
  participants: ScheduleParticipant[];
};

export type InProgressLicense = {
  userLicenseId: number;
  licenseId: number;
  code: string;
  name: string;
  nameKo: string;
  levelOrder: number;
  associationId: number;
  associationName: string;
};

export type AvailableLicense = {
  licenseId: number;
  code: string;
  name: string;
  nameKo: string;
  levelOrder: number;
  isInstructor: number;
};

export type Association = {
  id: number;
  name: string;
};

export type AchievementRequirement = {
  id: number;
  name: string;
  nameKo: string;
  reqGroup: string;
  reqType: string;
  code: string | null;
  unit: string;
  minValue: number | null;
  displayValue: string | null;
  isOptional: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: number | null;
  completedByMe: boolean;
  measuredValue?: number | null;
  children?: AchievementRequirement[];
};

export type UserLicense = {
  id: number;
  licenseId: number;
  licenseName: string;
  licenseNameKo: string;
  status: string;
  license?: {
    id: number;
    code: string;
    name: string;
    nameKo: string;
    association?: {
      code: string;
      name: string;
      nameKo: string;
    };
  };
  requirements: AchievementRequirement[];
};

export type DebriefingItem = {
  id: number;
  scheduleTitle: string;
  scheduleDate: string;
  content: string;
  createdByName: string;
  createdAt: string;
};

// 미니 게임 기록: 사용자별 · 게임별 판마다 시각 · 총점 · 세부 점수 (서버 game-records.service.ts)
export type FreedivingRecordDetails = {
  wasted: boolean;
  blackout?: boolean; // 물속에서 폐 공기가 다 떨어짐 (2026-11-12부터, 예전 기록엔 없음)
  maxDepth: number; // m
  air: number; // 남은 폐 공기 0 ~ 1 (점수는 쓴 만큼: 1 - air)
  eqCount: number;
  idealEq: number;
  zoneRate: number; // 두 번째 선 유지 0 ~ 1
  diveTime: number; // 초
  points: { depth: number; air: number; eq: number; zone: number }; // 수심 40 · 공기 사용 20 · 이퀄 15 · 선 유지 25점 만점
};
export type GameRecord = { id: number; game: string; score: number; details: FreedivingRecordDetails; playedAt: string };
export type GameRecordSaved = { record: GameRecord; best: number; isBest: boolean; count: number };

// 강사간 수강생 정보 공유 (일정 상세 교육생 카드). 강사끼리만 보고 수강생에게는 어디에도 보이지 않음.
// 쓴 일정의 제목 · 날짜 · 다이빙 구분, 자격증 과정이면 그때의 과정 이름이 함께 남음
export type StudentNote = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  scheduleId: number | null;
  scheduleTitle: string;
  scheduleDate: string;
  categoryCode: string;
  categoryName: string;
  licenseNames: string[];
  author: { id: number; userId: string; nickname: string; name: string | null; profileImage: string | null; level: string; badgeLevel: string } | null;
  isMine: boolean;
};

// 앱 홈 (2026-11-09, 위쪽 가운데 로고 · 앱 첫 화면). '각종 요청' 한 줄은 아직 처리 안 한 것만, kind에 따라 누르면 갈 곳이 다름
export type HomeRequestKind =
  | 'SCHEDULE_INVITE' | 'TOUR_SEEKING_LEADER' | 'TOUR_APPLY' | 'TOUR_PROPOSAL'
  | 'ADMIN_INQUIRY' | 'ADMIN_CERT' | 'ADMIN_ORG' | 'ADMIN_TOUR_REQUEST' | 'ADMIN_TOUR_REPORT' | 'ADMIN_COMMUNITY_REPORT';
export type HomeRequest = {
  id: string; kind: HomeRequestKind; title: string; body: string; at: string;
  scheduleId?: number; tourId?: number; count?: number;
};
// 다가오는 다이빙 3 (캘린더 월 목록과 같은 모양) · 각종 요청 3 + 전체 건수 · 모집중 투어 3 · 최근 한 달 인기 에세이 3
export type HomeData = {
  upcoming: Schedule[];
  requests: { total: number; items: HomeRequest[] };
  tours: TourCard[];
  essays: CommunityCard[];
};

export type DiveBuddy = {
  isTemporary?: boolean;
  userId: string;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null; badgeLevel?: string | number | null;
  lastDiveDate: string;
  memo?: string;
};

export type CloseFriend = {
  isTemporary?: boolean;
  userId: string;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null; badgeLevel?: string | number | null;
  memo?: string;
  pinned?: boolean;
  licenseName?: string;
  phone?: string;
  email?: string;
};

export type CertRequest = {
  id: number;
  userId: string;
  userName: string;
  birthDate: string;
  imageUrl: string;
  status: string;
  createdAt: string;
};

export type Organization = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  logo?: string;
  status: 'pending' | 'approved' | 'rejected';
  membershipStatus?: 'pending' | 'approved' | 'rejected';
  isRepresentative?: boolean;
  representativeName?: string;
  representativeNickname?: string;
  createdAt?: string;
};

export type PendingMember = {
  userId: string;
  nickname: string;
  name?: string;
  phone?: string;
  profileImage?: string;
};

export type Certification = {
  id: number; name: string; nameKo: string | null; imageUrl?: string;
  code?: string | null; levelOrder?: number; isInstructor?: number;
  association?: { code: string; name: string; nameKo: string | null };
};
export type CertificationOption = Certification & {
  levelOrder: number;
  isInstructor: number;
  association: { code: string; name: string; nameKo: string | null };
};

export type ProfileResponse = {
  certifications?: Certification[];
  user: { id: number; isTemporary?: boolean; name?: string; nickname: string; profileImage?: string; organization?: Organization | null };
  profile: Profile | null;
  links?: ProfileLink[]; // 프로필 링크
  isMyStudent?: boolean;
};

export type TemporaryLinkTarget = { id: number; userId: string; nickname: string; name?: string | null; profileImage?: string | null; level?: string; badgeLevel?: string | number | null; phoneHint?: string | null };
export type TemporaryUnlinkPreview = {
  source: { id: number; nickname: string }; target: { id: number; nickname: string; name?: string | null };
  linkedAt: string; canUnlink: boolean; blockers: string[];
  counts: { schedules: number; forms: number; debriefings: number; courses: number; achievements: number };
};
export type TemporaryLinkPreview = {
  source: { id: number; nickname: string }; target: TemporaryLinkTarget;
  schedules: { id: number; title: string; date: string }[];
  counts: { schedules: number; courses: number; forms: number; debriefings: number; achievements: number };
  duplicates: { schedules: number; courses: number; achievements: number; contacts: number };
  confirmationToken: string;
};
// 프로필 링크 (프로필 편집의 '링크')
export type ProfileLink = { name: string; url: string };

// ── 커뮤니티 (설계서 'AllBlue-커뮤니티-설계') ──
export type CommunityBoard = 'ESSAY' | 'FREE' | 'PROMO';
export type CommunityAuthor = { userId: string; nickname: string; profileImage: string | null; badgeLevel: string };
export type CommunityMention = { userId: string; nickname: string };
// 에세이 본문: 서식 있는 글자 조각(b 굵게 · i 기울임 · u 밑줄 · s 크기 S/L · c 글자 색)과 문단 사이 사진
export type EssaySpan = { t: string; b?: boolean; i?: boolean; u?: boolean; s?: 'S' | 'L'; c?: string };
export type EssayBlock = { type: 'p'; spans: EssaySpan[] } | { type: 'img'; url: string; w?: number; h?: number };
export type CommunityCard = {
  id: number; board: CommunityBoard; title: string; excerpt: string; imageUrl: string | null;
  likeCount: number; commentCount: number; tags: string[];
  author: CommunityAuthor; organization: { id: number; name: string; logo: string | null } | null;
  createdAt: string; updatedAt: string;
};
export type CommunityPost = Omit<CommunityCard, 'organization'> & {
  content: string | null; body: EssayBlock[] | null; images: string[]; mentions: CommunityMention[];
  organization: { id: number; name: string; logo: string | null; address: string | null; phone: string | null } | null;
  liked: boolean; canEdit: boolean; canDelete: boolean; canComment: boolean;
};
export type CommunityGreeting = { id: number; content: string; mentions?: CommunityMention[]; date: string; createdAt: string; author: CommunityAuthor; mine: boolean; canDelete: boolean };
export type CommunityHome = {
  essays: CommunityCard[]; banner: CommunityCard | null;
  greetings: { todayCount: number; items: CommunityGreeting[] };
  free: CommunityCard[]; canWriteEssay: boolean; canWritePromo: boolean;
};
// removed: 지운 댓글(DELETED) · 차단한 사람의 댓글(BLOCKED)은 대댓글이 남아 있을 때만 자리 표시로
export type CommunityComment = {
  id: number; parentId: number | null; removed: null | 'DELETED' | 'BLOCKED'; createdAt: string;
  author?: CommunityAuthor; content?: string; mentions?: CommunityMention[]; likeCount?: number; liked?: boolean; mine?: boolean; canDelete?: boolean;
};
export type CommunityThread = CommunityComment & { replies: CommunityComment[] };
export type MentionUser = CommunityAuthor & { isFriend: boolean };
export type CommunityReportTarget = 'POST' | 'COMMENT' | 'GREETING';
export type CommunityReportItem = {
  targetType: CommunityReportTarget; targetId: number; exists: boolean; board: CommunityBoard | null; postId: number | null;
  preview: string | null; author: { userId: string; nickname: string | null }; count: number;
  reasons: { code: string; count: number }[]; memo: string | null; moreMemos: number; latestAt: string;
};
export type EssayInput = { board: 'ESSAY'; title: string; body: EssayBlock[] };
export type FreeInput = { board: 'FREE'; title: string; content: string; imageUrl: string | null; tags: string[]; mentions: string[] };


// ── 투어 (2026-11-06 설계서): 등록 하나(참여자로 · 인솔자로) → 참여자 모집중 → 인솔자 모집중 → 모집 마감 ──
export type TourStatus = 'PENDING' | 'REVISION' | 'RECRUITING' | 'SEEKING_LEADER' | 'CLOSED' | 'EXPIRED';
export type TourRole = 'PARTICIPANT' | 'LEADER';
export type TourStyle = 'DIVING_ONLY' | 'DIVING_SIGHTSEEING';
export type TourLink = { name: string; url: string };
export type TourApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CLOSED' | 'CANCELED' | 'LEFT';
export type TourProposalStatus = 'WAITING' | 'HELD' | 'ACCEPTED' | 'CLOSED';
export type TourPerson = { userId: string; nickname: string; name: string | null; profileImage: string | null; badgeLevel: string; licenses: string[] };
// 목록 카드: name = 투어명, 없으면 '나라 · 형태' · count = 지금 모인 인원 · coverUrl = 대표 사진
export type TourCard = {
  id: number; status: TourStatus; registerRole: TourRole; title: string | null; name: string;
  // place: 투어 장소 (도시 이름, 2026-11-08 전에 등록한 투어는 null)
  continentCode: string; countryCode: string; countryName: string; place: string | null; startDate: string; endDate: string; tourStyle: TourStyle;
  capacity: number; count: number; fee: number | null; coverUrl: string | null;
  registrant: { userId: string; nickname: string }; leader: { userId: string; nickname: string } | null; proposalCount: number;
};
export type TourBanner = { id: number; imageUrl: string; tourId: number };
// closed: 모집 마감 줄 (2026-11-08 추가, 그 전 서버는 안 보냄)
export type TourHome = { canLead: boolean; banners: TourBanner[]; recruiting: TourCard[]; seeking: TourCard[]; closed?: TourCard[] };
export type TourPage = { items: TourCard[]; hasMore: boolean };
export type TourSearchConditions = { from: string; to: string; continent: string; country: string; statuses: TourStatus[]; q: string };
export type TourRegisterOptions = { canLead: boolean; registeredToday: boolean };
// 등록 · 수정: 참여자로는 사진 · 기간 · 지역 · 투어 장소 · 형태 · 인원만, 인솔자로는 인솔 정보(투어명 · 참가비 · 포함/불포함 · 문의 링크)까지
export type TourRegistrationInput = {
  role: TourRole; images: string[]; coverIndex: number; continentCode: string; countryCode: string; place: string; startDate: string; endDate: string;
  tourStyle: TourStyle; capacity: number; baseCount: number;
  title?: string; fee?: number | null; included?: string[]; excluded?: string[]; links?: TourLink[];
};
export type TourProposalInput = {
  images: string[]; coverIndex: number; title: string; fee: number; included: string[]; excluded: string[]; links: TourLink[]; message: string;
};
export type TourEditRequest = { id: number; status: 'PENDING' | 'REJECTED'; reviewNote: string | null; changedFields: string[]; payload: unknown };
export type TourDetail = {
  tour: {
    id: number; status: TourStatus; registerRole: TourRole; title: string | null; name: string;
    continentCode: string; continentName: string; countryCode: string; countryName: string; place: string | null;
    startDate: string; endDate: string; tourStyle: TourStyle;
    capacity: number; baseCount: number; joinedCount: number; count: number; companions: number; fee: number | null;
    images: string[]; coverIndex: number; included: string[]; excluded: string[];
    isPublic: boolean; isRegistrant: boolean; isLeader: boolean; isAdmin: boolean;
    proposalCount: number; pendingApplications: number; reviewNote: string | null;
    pendingRequest: { id: number; type: 'CREATE' | 'UPDATE' } | null; editRequest: TourEditRequest | null;
    shareUrl: string | null; canEdit: boolean;
  };
  registrant: TourPerson; leader: (TourPerson & { ledCount: number }) | null;
  members: { userId: string; nickname: string; profileImage: string | null }[];
  links: TourLink[];
  viewer: {
    application: { status: TourApplicationStatus; message: string | null } | null; canApply: boolean; canLeave: boolean;
    proposal: { id: number; status: TourProposalStatus } | null; canPropose: boolean; canReport: boolean;
  };
};
export type TourSummary = { id: number; status: TourStatus; name: string; capacity: number; count: number; startDate: string; endDate: string };
export type TourApplicationItem = { id: number; message: string | null; appliedAt: string; user: TourPerson };
export type TourProposalItem = {
  id: number; status: TourProposalStatus; title: string; fee: number; message: string | null; createdAt: string; coverUrl: string | null;
  instructor: TourPerson & { ledCount: number };
};
export type TourProposalDetail = {
  id: number; tourId: number; status: TourProposalStatus; closedReason: string | null; title: string; fee: number; message: string | null; createdAt: string;
  images: string[]; coverIndex: number; included: string[]; excluded: string[]; links: TourLink[];
  instructor: TourPerson & { ledCount: number }; canAccept: boolean; isMine: boolean;
};
export type MyTourTab = 'REGISTERED' | 'JOINED' | 'PROPOSED';
export type MyTourItem = TourCard & {
  pendingApplications?: number; reviewNote?: string | null; editRequest?: { status: 'PENDING' | 'REJECTED'; reviewNote: string | null } | null;
  applicationStatus?: TourApplicationStatus;
  proposal?: { id: number; status: TourProposalStatus; closedReason: string | null; title: string; fee: number };
};
export type CommonCode = { code: string; name: string; nameKo: string | null; extraValue: string | null; sortOrder: number };
// admin: 등록요청 · 신고 처리 · 광고 배너
export type TourRequestItem = {
  id: number; type: 'CREATE' | 'UPDATE'; requestedAt: string; changedFields: string[]; tour: TourCard;
  registrant: { userId: string; nickname: string; name: string | null };
};
export type TourReportGroup = {
  tour: TourCard; count: number; reasons: { code: string; name: string; count: number }[]; memo: string | null; moreMemos: number; latestAt: string;
};
// HIDDEN: 기간 안이지만 연결 투어가 모집 마감 · 만료 · 비공개라 안 보임
export type TourBannerItem = {
  id: number; imageUrl: string; tourId: number; tourName: string; startDate: string; endDate: string; isEnabled: boolean;
  state: 'LIVE' | 'SCHEDULED' | 'ENDED' | 'OFF' | 'HIDDEN';
};
export type TourBannerInput = { imageUrl: string; tourId: number; startDate: string; endDate: string; isEnabled: boolean };

export const api = {
  // ── 투어 ──
  getCodes(group: string) { return request<{ success: boolean; data?: CommonCode[]; message?: string }>(`/codes?group=${encodeURIComponent(group)}`); },
  getHome() { return request<HomeData>('/home'); },
  getTourHome() { return request<TourHome>('/tours/home'); },
  // 전체보기: 그 상태만, 최근 등록 순 10개씩 (before = 더 예전 것, after = 더 최근 것)
  getTours(status: 'RECRUITING' | 'SEEKING_LEADER' | 'CLOSED', cursor: { before?: number; after?: number } = {}) {
    const params = new URLSearchParams({ status });
    if (cursor.before) params.set('before', String(cursor.before));
    if (cursor.after) params.set('after', String(cursor.after));
    return request<TourPage>(`/tours/list?${params}`);
  },
  searchTours(conditions: TourSearchConditions, cursor: { before?: number; after?: number } = {}) {
    const params = new URLSearchParams();
    for (const key of ['from', 'to', 'continent', 'country', 'q'] as const) if (conditions[key]) params.set(key, conditions[key]);
    if (conditions.statuses.length) params.set('statuses', conditions.statuses.join(','));
    if (cursor.before) params.set('before', String(cursor.before));
    if (cursor.after) params.set('after', String(cursor.after));
    return request<TourPage>(`/tours/search?${params}`);
  },
  getMyTours(tab: MyTourTab, offset = 0) { return request<{ items: MyTourItem[]; hasMore: boolean }>(`/tours/mine?tab=${tab}&offset=${offset}`); },
  getTourRegisterOptions() { return request<TourRegisterOptions>('/tours/register-options'); },
  // 강사 프로필 '진행한 투어': 최근 출발일 순 10개씩
  getLedTours(userId: string, offset = 0) { return request<{ total: number; items: TourCard[]; hasMore: boolean }>(`/tours/led/${encodeURIComponent(userId)}?offset=${offset}`); },
  // onProgress: 보낸 바이트 / 전체 바이트 (components/UploadProgress의 진행 막대)
  async uploadTourImage(uri: string, mimeType = 'image/jpeg', onProgress?: (progress: UploadProgress) => void) {
    const token = await AsyncStorage.getItem('authToken');
    const result = await new File(uri).upload(`${BASE_URL}/tours/images`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      onProgress,
    });
    return parseResponse<{ url: string }>(result.status, result.body, token);
  },
  createTour(input: TourRegistrationInput) { return request<{ tourId: number; status: TourStatus }>('/tours', { method: 'POST', body: JSON.stringify(input) }); },
  updateTour(id: number, input: TourRegistrationInput) {
    return request<{ tourId: number; status: TourStatus; editPending?: boolean }>(`/tours/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  },
  deleteTour(id: number) { return request<{ success: boolean }>(`/tours/${id}`, { method: 'DELETE' }); },
  cancelTourEdit(id: number) { return request<{ tourId: number }>(`/tours/${id}/edit-request`, { method: 'DELETE' }); },
  getTour(id: number) { return request<TourDetail>(`/tours/${id}`); },
  applyTour(id: number, message: string) { return request<{ status: TourApplicationStatus }>(`/tours/${id}/apply`, { method: 'POST', body: JSON.stringify({ message }) }); },
  cancelTourApplication(id: number) { return request<{ status: TourApplicationStatus }>(`/tours/${id}/apply`, { method: 'DELETE' }); },
  leaveTour(id: number) { return request<{ status: TourApplicationStatus }>(`/tours/${id}/leave`, { method: 'POST' }); },
  getTourApplications(id: number) { return request<{ tour: TourSummary; items: TourApplicationItem[] }>(`/tours/${id}/applications`); },
  decideTourApplication(applicationId: number, decision: 'accept' | 'reject') {
    return request<{ status: TourApplicationStatus; tourStatus?: TourStatus }>(`/tours/applications/${applicationId}/${decision}`, { method: 'POST' });
  },
  proposeTour(id: number, input: TourProposalInput) { return request<{ proposalId: number }>(`/tours/${id}/proposals`, { method: 'POST', body: JSON.stringify(input) }); },
  getTourProposals(id: number) { return request<{ tour: TourSummary; items: TourProposalItem[] }>(`/tours/${id}/proposals`); },
  getTourProposal(proposalId: number) { return request<TourProposalDetail>(`/tours/proposals/${proposalId}`); },
  updateTourProposal(proposalId: number, input: TourProposalInput) {
    return request<{ proposalId: number }>(`/tours/proposals/${proposalId}`, { method: 'PUT', body: JSON.stringify(input) });
  },
  withdrawTourProposal(proposalId: number) { return request<{ success: boolean }>(`/tours/proposals/${proposalId}`, { method: 'DELETE' }); },
  acceptTourProposal(proposalId: number) { return request<{ tourId: number; status: TourStatus }>(`/tours/proposals/${proposalId}/accept`, { method: 'POST' }); },
  reportTour(id: number, reason: string, memo: string) { return request<{ success: boolean }>(`/tours/${id}/report`, { method: 'POST', body: JSON.stringify({ reason, memo }) }); },
  getTourRequests() { return request<{ requests: TourRequestItem[] }>('/tours/requests'); },
  approveTourRequest(id: number) { return request<{ requestId: number; tourId: number; status: TourStatus }>(`/tours/requests/${id}/approve`, { method: 'POST' }); },
  reviseTourRequest(id: number, note: string) {
    return request<{ requestId: number; tourId: number; status: TourStatus }>(`/tours/requests/${id}/revise`, { method: 'POST', body: JSON.stringify({ note }) });
  },
  getTourReports() { return request<{ tours: TourReportGroup[] }>('/tours/reports'); },
  dismissTourReports(tourId: number) { return request<{ tourId: number; status: TourStatus }>(`/tours/reports/${tourId}/dismiss`, { method: 'POST' }); },
  takeDownTour(tourId: number, note: string) {
    return request<{ tourId: number; status: TourStatus }>(`/tours/reports/${tourId}/take-down`, { method: 'POST', body: JSON.stringify({ note }) });
  },
  getTourBanners() { return request<{ liveCount: number; max: number; banners: TourBannerItem[]; ended: TourBannerItem[] }>('/tours/banners'); },
  getBannerTourOptions() { return request<{ tours: { id: number; name: string; status: TourStatus; startDate: string; endDate: string }[] }>('/tours/banners/tours'); },
  saveTourBanner(id: number | null, input: TourBannerInput) {
    return request<{ id: number }>(id ? `/tours/banners/${id}` : '/tours/banners', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) });
  },
  deleteTourBanner(id: number) { return request<{ success: boolean }>(`/tours/banners/${id}`, { method: 'DELETE' }); },

  // ── 커뮤니티 ──
  getCommunityHome() { return request<CommunityHome>('/community/home'); },
  getCommunityPosts(board: CommunityBoard, options: { before?: number; after?: number; tag?: string; q?: string } = {}) {
    const params = new URLSearchParams({ board });
    for (const [key, value] of Object.entries(options)) if (value) params.set(key, String(value));
    return request<{ items: CommunityCard[]; hasMore: boolean }>(`/community/posts?${params}`);
  },
  // 게시판 검색: 작성일(YYYY-MM-DD) · 검색어(제목 · 내용 · 태그) · 작성자. 최근 순 10개씩 (before/after)
  searchCommunityPosts(board: CommunityBoard, options: { from?: string; to?: string; q?: string; author?: string; before?: number; after?: number }) {
    const params = new URLSearchParams({ board });
    for (const [key, value] of Object.entries(options)) if (value) params.set(key, String(value));
    return request<{ items: CommunityCard[]; hasMore: boolean }>(`/community/posts/search?${params}`);
  },
  getCommunityPost(id: number) { return request<{ post: CommunityPost }>(`/community/posts/${id}`); },
  createCommunityPost(input: EssayInput | FreeInput) { return request<{ id: number }>('/community/posts', { method: 'POST', body: JSON.stringify(input) }); },
  updateCommunityPost(id: number, input: EssayInput | FreeInput) { return request<{ id: number }>(`/community/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) }); },
  deleteCommunityPost(id: number) { return request<{ success: boolean }>(`/community/posts/${id}`, { method: 'DELETE' }); },
  likeCommunity(target: 'posts' | 'comments', id: number, on: boolean) {
    return request<{ liked: boolean; likeCount: number }>(`/community/${target}/${id}/like`, { method: on ? 'POST' : 'DELETE' });
  },
  getCommunityComments(postId: number) { return request<{ count: number; comments: CommunityThread[] }>(`/community/posts/${postId}/comments`); },
  addCommunityComment(postId: number, input: { content: string; parentId?: number; mentions: string[] }) {
    return request<{ id: number }>(`/community/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(input) });
  },
  deleteCommunityComment(id: number) { return request<{ success: boolean }>(`/community/comments/${id}`, { method: 'DELETE' }); },
  getMyPromo() { return request<{ organization: { id: number; name: string; logo: string | null } | null; post: { id: number; title: string; images: string[] } | null }>('/community/promo/mine'); },
  saveMyPromo(input: { title: string; images: string[] }) { return request<{ id: number }>('/community/promo/mine', { method: 'PUT', body: JSON.stringify(input) }); },
  getGreetings(date?: string) {
    return request<{ date: string; today: string; count: number; greetedToday: boolean; items: CommunityGreeting[] }>(`/community/greetings${date ? `?date=${date}` : ''}`);
  },
  getGreetingCalendar(month: string) { return request<{ month: string; days: Record<string, number> }>(`/community/greetings/calendar?month=${month}`); },
  // mentions: 인사에서 @로 태그한 사용자 id (태그된 사람에게 푸시 + 알림)
  greet(content: string, mentions: string[] = []) {
    return request<{ id: number }>('/community/greetings', { method: 'POST', body: JSON.stringify(mentions.length ? { content, mentions } : { content }) });
  },
  deleteGreeting(id: number) { return request<{ success: boolean }>(`/community/greetings/${id}`, { method: 'DELETE' }); },
  getMentionUsers(q: string) { return request<{ users: MentionUser[] }>(`/community/mention-users?q=${encodeURIComponent(q)}`); },
  async uploadCommunityImage(uri: string, mimeType = 'image/jpeg', onProgress?: (progress: UploadProgress) => void) {
    const token = await AsyncStorage.getItem('authToken');
    const result = await new File(uri).upload(`${BASE_URL}/community/images`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      onProgress,
    });
    return parseResponse<{ url: string }>(result.status, result.body, token);
  },
  reportCommunity(input: { targetType: CommunityReportTarget; targetId: number; reason: string; memo: string }) {
    return request<{ success: boolean }>('/community/reports', { method: 'POST', body: JSON.stringify(input) });
  },
  getCommunityReports() { return request<{ items: CommunityReportItem[] }>('/community/reports'); },
  getCommunityReportCount() { return request<{ count: number }>('/community/reports/count'); },
  processCommunityReport(targetType: CommunityReportTarget, targetId: number, decision: 'dismiss' | 'take-down') {
    return request<{ success: boolean }>(`/community/reports/${targetType}/${targetId}/${decision}`, { method: 'POST' });
  },
  getNotices(offset = 0) { return request<{ notices: Notice[]; hasMore: boolean; canManage: boolean }>(`/notices?offset=${offset}`); },
  getNotice(id: number) { return request<{ notice: Notice; canManage: boolean }>(`/notices/${id}`); },
  getNoticePopups() { return request<{ items: PopupSlide[] }>('/notices/popups'); },
  createNotice(data: NoticeInput) { return request<{ notice: Notice }>('/notices', { method: 'POST', body: JSON.stringify(data) }); },
  updateNotice(id: number, data: NoticeInput) { return request<{ success: boolean }>(`/notices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); },
  deleteNotice(id: number) { return request<{ success: boolean }>(`/notices/${id}`, { method: 'DELETE' }); },
  demoLogin(code: string) {
    return request<{ token: string; user: { id: string; nickname: string; name?: string; profileImage?: string; demo: boolean } }>('/auth/demo', {
      method: 'POST', body: JSON.stringify({ code }), authToken: '', ignoreUnauthorized: true,
    });
  },

  kakaoLogin(code: string, redirectUri: string) {
    return request<KakaoAuthResponse>('/auth/kakao', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri }),
    });
  },

  getProfile() {
    return request<ProfileResponse>('/profile');
  },

  async uploadProfileImage(uri: string, onProgress?: (progress: UploadProgress) => void) {
    const token = await AsyncStorage.getItem('authToken');
    const filename = uri.split('/').pop() ?? 'photo.jpg';

    const file = new File(uri);
    const result = await file.upload(`${BASE_URL}/profile/image`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onProgress,
    });
    return parseResponse<{ success: boolean; profileImage: string }>(result.status, result.body, token);
  },

  getLastCertReject() {
    return request<{ rejected: boolean; reason?: string }>('/cert/last-reject');
  },

  checkCertPending() {
    return request<{ pending: boolean }>('/cert/pending');
  },

  getCertificationOptions() {
    return request<{ success: boolean; data: CertificationOption[] }>('/licenses');
  },

  getCertRequests() {
    return request<{ requests: CertRequest[] }>('/cert/requests');
  },

  getCertPendingCount() {
    return request<{ count: number }>('/cert/pending-count');
  },

  approveCert(requestId: number, selection: { licenseId: number } | { customName: string }) {
    return request<{ success: boolean }>(`/cert/requests/${requestId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify(selection),
    });
  },

  getDivingPools() {
    return request<{ pools: { id: number; name: string }[] }>('/diving-pools');
  },

  temporaryLinkTargets(scheduleId: number, sourceId: number, query: string) {
    return request<{ users: TemporaryLinkTarget[] }>(`/schedule/${scheduleId}/temporary-users/${sourceId}/link-targets?q=${encodeURIComponent(query)}`);
  },
  previewTemporaryLink(scheduleId: number, sourceId: number, targetId: number) {
    return request<TemporaryLinkPreview>(`/schedule/${scheduleId}/temporary-users/${sourceId}/link-preview`, { method: 'POST', body: JSON.stringify({ targetId }) });
  },
  linkTemporaryUser(scheduleId: number, sourceId: number, targetId: number, confirmationToken: string) {
    return request<{ success: boolean; auditId: number; alreadyLinked: boolean }>(`/schedule/${scheduleId}/temporary-users/${sourceId}/link`, { method: 'POST', body: JSON.stringify({ targetId, confirmationToken }) });
  },
  previewTemporaryUnlink(scheduleId: number, auditId: number) {
    return request<TemporaryUnlinkPreview>(`/schedule/${scheduleId}/temporary-links/${auditId}/unlink-preview`, { method: 'POST' });
  },
  unlinkTemporaryUser(scheduleId: number, auditId: number) {
    return request<{ success: boolean; sourceId: number }>(`/schedule/${scheduleId}/temporary-links/${auditId}/unlink`, { method: 'POST' });
  },
  createTemporaryUser(name: string) {
    return request<{ user: { id: number; userId: string; nickname: string; isTemporary: boolean; phone: string; level: string } }>('/users/temporary', {
      method: 'POST', body: JSON.stringify({ name }),
    });
  },

  searchUsers(q: string) {
    return request<{ users: { id: number; userId?: string; isTemporary?: boolean; nickname: string; profileImage?: string | null; name?: string; phone: string; birthDate?: string; level?: string | number | null; badgeLevel?: string | number | null }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
  },

  getNotifications(options: { all?: boolean; before?: number; after?: number; ceiling?: number } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined) params.set(key, String(value));
    params.set('withCommunity', 'true'); // 커뮤니티 알림도 받음
    params.set('withTourV2', 'true'); // 새 투어 알림도 받음 (지운 예전 투어 앱이 보내던 withTours와 구분)
    return request<{ items: AppNotification[]; hasMore: boolean; unreadCount: number }>(`/notifications?${params}`);
  },
  readNotification(id: number) { return request(`/notifications/${id}/read`, { method: 'PATCH' }); },
  hideNotification(id: number) { return request(`/notifications/${id}`, { method: 'DELETE' }); },
  respondToSchedule(id: number, action: 'accept' | 'reject', token: string) {
    return request(`/schedule/${id}/invitation/respond`, { method: 'POST', body: JSON.stringify({ action, token }) });
  },
  manageScheduleInvitation(id: number, participantId: number, action: 'remove' | 'resend') {
    return request(`/schedule/${id}/invitation/${participantId}`, { method: 'POST', body: JSON.stringify({ action }) });
  },

  createSchedule(data: {
    title: string;
    scheduleDate: string;
    startHour: number;
    startMinute: number;
    poolId: number | null;
    customLocation?: string | null;
    categoryCode: string;
    visibility: 'public' | 'private';
    participants: {
      userId?: number;
      guestNickname?: string;
      guestPhone?: string;
      categoryCode: string;
      userLicenseIds?: number[];
      newLicenses?: number[];
    }[];
  }) {
    return request<{ success: boolean; scheduleId: number }>('/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getScheduleDetail(id: number, filter = 'mine') {
    return request<{ schedule: ScheduleDetail }>(`/schedule/${id}?filter=${encodeURIComponent(filter)}`);
  },

  updateSchedule(id: number, data: {
    title: string;
    scheduleDate: string;
    startHour: number;
    startMinute: number;
    poolId: number | null;
    customLocation?: string | null;
    categoryCode: string;
    visibility: 'public' | 'private';
    participants: {
      userId?: number;
      guestNickname?: string;
      guestPhone?: string;
      categoryCode: string;
      userLicenseIds?: number[];
      newLicenses?: number[];
    }[];
  }) {
    return request<{ success: boolean }>(`/schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteSchedule(id: number) {
    return request<{ success: boolean }>(`/schedule/${id}`, { method: 'DELETE' });
  },

  getUserAchievements(userId: number) {
    return request<{ licenses: UserLicense[] }>(`/user/${userId}/achievements`);
  },

  getDebriefings(userId: number, page: number, limit: number = 10) {
    return request<{ debriefings: DebriefingItem[]; hasMore: boolean }>(`/user/${userId}/debriefings?page=${page}&limit=${limit}`);
  },

  // 목록 공통 규칙: 최근순 10개씩, before(더 예전) · after(더 최근) id 커서
  getStudentNotes(studentId: number, cursor: { before?: number; after?: number } = {}) {
    const query = cursor.after ? `?after=${cursor.after}` : cursor.before ? `?before=${cursor.before}` : '';
    return request<{ notes: StudentNote[]; total: number; hasMore: boolean }>(`/students/${studentId}/notes${query}`);
  },

  // 미니 게임: 판이 끝나면 저장 (내 최고 점수 · 새 최고 기록인지 돌려받음), 내 기록은 최근순 10개씩
  saveGameRecord(game: string, record: { score: number; details: FreedivingRecordDetails }) {
    return request<GameRecordSaved>(`/games/${game}/records`, { method: 'POST', body: JSON.stringify(record) });
  },

  getGameRecords(game: string, cursor: { before?: number; after?: number } = {}) {
    const query = cursor.after ? `?after=${cursor.after}` : cursor.before ? `?before=${cursor.before}` : '';
    return request<{ records: GameRecord[]; hasMore: boolean; total: number; best: number | null }>(`/games/${game}/records${query}`);
  },

  addStudentNote(studentId: number, scheduleId: number, content: string) {
    return request<{ success: boolean; id: number }>(`/students/${studentId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, content }),
    });
  },

  updateStudentNote(id: number, content: string) {
    return request<{ success: boolean }>(`/student-notes/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
  },

  deleteStudentNote(id: number) {
    return request<{ success: boolean }>(`/student-notes/${id}`, { method: 'DELETE' });
  },

  saveDebriefing(scheduleId: number, participantId: number, content: string) {
    return request<{ success: boolean }>(`/debriefing`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, participantId, content }),
    });
  },

  saveAchievementValue(requirementId: number, userId: number, value: number | null) {
    return request<{ success: boolean; message?: string }>(`/achievement/value`, {
      method: 'POST',
      body: JSON.stringify({ requirementId, userId, value }),
    });
  },

  toggleAchievement(requirementId: number, userId: number, completed: boolean) {
    return request<{ success: boolean; message?: string }>(`/achievement/toggle`, {
      method: 'POST',
      body: JSON.stringify({ requirementId, userId, completed }),
    });
  },

  async getDailySchedules(date: string, filter = 'mine') {
    if (filter !== 'mine') {
      const [year, month] = date.split('-').map(Number);
      const result = await api.getMonthlySchedules(year, month, filter);
      return { schedules: (result.schedules ?? []).filter((schedule) => schedule.scheduleDate === date) };
    }
    return request<{ schedules: Schedule[] }>(`/schedule/daily?date=${date}`);
  },

  getCalendarEvents(year: number, month: number) {
    return request<{ events: CalendarEvent[] }>(`/calendar-events?year=${year}&month=${month}`);
  },

  getMonthlySchedules(year: number, month: number, filter?: string) {
    const params = `year=${year}&month=${month}${filter && filter !== 'mine' ? `&filter=${filter}` : ''}`;
    return request<{ schedules: Schedule[] }>(`/schedule/monthly?${params}`);
  },

  rejectCert(requestId: number, reason?: string) {
    return request<{ success: boolean }>(`/cert/requests/${requestId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || null }),
    });
  },

  async uploadCertImage(uri: string, onProgress?: (progress: UploadProgress) => void) {
    const token = await AsyncStorage.getItem('authToken');
    const filename = uri.split('/').pop() ?? 'cert.jpg';

    const file = new File(uri);
    const result = await file.upload(`${BASE_URL}/cert/upload`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onProgress,
    });
    return parseResponse<{ success: boolean }>(result.status, result.body, token);
  },

  updateProfile(data: Partial<Profile> & { organizationId?: number | null; links?: ProfileLink[] }) {
    return request<{ success: boolean; profile: Profile }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 다른 유저 프로필 조회
  getUserProfile(userId: string) {
    return request<ProfileResponse>(`/profile/${userId}`);
  },

  // 친한친구
  getCloseFriends() {
    return request<{ friends: CloseFriend[] }>('/friends/close');
  },

  addCloseFriend(friendId: string) {
    return request<{ success: boolean; message?: string }>('/friends/close', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  },

  removeCloseFriend(friendId: string) {
    return request<{ success: boolean }>(`/friends/close/${friendId}`, { method: 'DELETE' });
  },

  toggleCloseFriendPin(friendId: string, pinned: boolean) {
    return request<{ success: boolean }>(`/friends/close/${friendId}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    });
  },

  updateCloseFriendMemo(friendId: string, memo: string) {
    return request<{ success: boolean }>(`/friends/close/${friendId}/memo`, {
      method: 'PATCH',
      body: JSON.stringify({ memo }),
    });
  },

  // 함께한친구 (dive buddy)
  getDiveBuddies(page: number = 1, limit: number = 20) {
    return request<{ buddies: DiveBuddy[]; hasMore: boolean }>(`/friends/buddies?page=${page}&limit=${limit}`);
  },

  // 교육생/강사
  getStudents() {
    return request<{ students: CloseFriend[] }>('/friends/students');
  },

  getInstructors() {
    return request<{ instructors: CloseFriend[] }>('/friends/instructors');
  },

  // 차단
  blockUser(blockedId: string) {
    return request<{ success: boolean }>('/friends/block', {
      method: 'POST',
      body: JSON.stringify({ blockedId }),
    });
  },

  unblockUser(blockedId: string) {
    return request<{ success: boolean }>(`/friends/block/${blockedId}`, { method: 'DELETE' });
  },

  getBlockedUsers() {
    return request<{ users: { userId: string; nickname: string; name?: string; level?: string | number | null; badgeLevel?: string | number | null }[] }>('/friends/blocked');
  },

  // 문의
  getInquiries() {
    return request<{ inquiries: { id: number; title: string; content: string; status: 'PENDING' | 'ANSWERED'; createdAt: string }[] }>('/inquiries');
  },

  getInquiryDetail(id: number) {
    return request<{ inquiry: { id: number; title: string; content: string; status: 'PENDING' | 'ANSWERED'; answer?: string; answeredAt?: string; createdAt: string; attachment?: { id: number; fileUrl: string; fileName: string; fileSize: number; mimeType: string } } }>(`/inquiries/${id}`);
  },

  async createInquiry(title: string, content: string, attachment?: { uri: string; name: string; type: string }, onProgress?: (progress: UploadProgress) => void) {
    if (!attachment) {
      return request<{ success: boolean }>('/inquiries', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
    }

    const token = await AsyncStorage.getItem('authToken');

    const file = new File(attachment.uri);
    const result = await file.upload(`${BASE_URL}/inquiries`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: attachment.type,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      parameters: { title, content },
      onProgress,
    });
    return parseResponse<{ success: boolean }>(result.status, result.body, token);
  },

  // 문의 관리 (admin)
  getInquiryPendingCount() {
    return request<{ count: number }>('/inquiries/pending-count');
  },

  getAllInquiries() {
    return request<{ inquiries: { id: number; userId: string; userName: string; title: string; status: 'PENDING' | 'ANSWERED'; createdAt: string }[] }>('/inquiries/all');
  },

  answerInquiry(id: number, answer: string) {
    return request<{ success: boolean }>(`/inquiries/${id}/answer`, {
      method: 'PATCH',
      body: JSON.stringify({ answer }),
    });
  },

  // 회원탈퇴
  withdrawAccount() {
    return request<{ success: boolean }>('/auth/withdraw', {
      method: 'DELETE',
    });
  },

  // 그룹 관리
  getFriendGroups() {
    return request<{ groups: { id: number; name: string; memberCount: number }[] }>('/friends/groups');
  },

  createFriendGroup(name: string) {
    return request<{ success: boolean; group: { id: number; name: string } }>('/friends/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  renameFriendGroup(groupId: number, name: string) {
    return request<{ success: boolean }>(`/friends/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  deleteFriendGroup(groupId: number) {
    return request<{ success: boolean }>(`/friends/groups/${groupId}`, { method: 'DELETE' });
  },

  getFriendGroupMembers(groupId: number) {
    return request<{ members: CloseFriend[] }>(`/friends/groups/${groupId}/members`);
  },

  addToFriendGroup(groupId: number, userId: string) {
    return request<{ success: boolean }>(`/friends/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  removeFromFriendGroup(groupId: number, userId: string) {
    return request<{ success: boolean }>(`/friends/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  },

  // 단체 관련
  searchOrganizations(q: string) {
    return request<{ organizations: Organization[] }>(`/organizations/search?q=${encodeURIComponent(q)}`);
  },

  async createOrganization(data: { name: string; phone?: string; address?: string; logoUri?: string }, onProgress?: (progress: UploadProgress) => void) {
    // 로고 이미지가 있으면 먼저 업로드
    let logoUrl: string | undefined;
    if (data.logoUri) {
      const token = await AsyncStorage.getItem('authToken');
      const file = new File(data.logoUri);
      const result = await file.upload(`${BASE_URL}/organizations/logo`, {
        uploadType: UploadType.MULTIPART,
        fieldName: 'logo',
        mimeType: 'image/jpeg',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        onProgress,
      });
      const parsed = await parseResponse<{ logoUrl: string }>(result.status, result.body, token);
      logoUrl = parsed.logoUrl;
    }

    return request<{ success: boolean; organization: Organization }>('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        address: data.address,
        logo: logoUrl,
      }),
    });
  },

  getPendingOrganizations() {
    return request<{ organizations: Organization[] }>('/organizations/pending');
  },

  approveOrganization(id: number) {
    return request<{ success: boolean }>(`/organizations/${id}/approve`, { method: 'PATCH' });
  },

  rejectOrganization(id: number, reason?: string) {
    return request<{ success: boolean }>(`/organizations/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  getPendingMembers() {
    return request<{ members: PendingMember[] }>('/organizations/members/pending');
  },

  approveMember(userId: string) {
    return request<{ success: boolean }>(`/organizations/members/${userId}/approve`, { method: 'PATCH' });
  },

  rejectMember(userId: string) {
    return request<{ success: boolean }>(`/organizations/members/${userId}/reject`, { method: 'PATCH' });
  },

  // 자격증 관련
  getInProgressLicenses(userId: number) {
    return request<{ licenses: InProgressLicense[] }>(`/user/${userId}/in-progress-licenses`);
  },

  getAvailableLicenses(userId: number, associationId: number) {
    return request<{ licenses: AvailableLicense[] }>(`/licenses/available?userId=${userId}&associationId=${associationId}`);
  },

  getAssociations() {
    return request<{ associations: Association[] }>('/licenses/associations');
  },

  // 푸시 토큰
  registerPushToken(token: string, authToken: string) {
    return request<{ success: boolean }>('/push/register', {
      authToken,
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  unregisterPushToken(token: string, authToken: string) {
    return request<{ success: boolean }>('/push/unregister', {
      authToken,
      ignoreUnauthorized: true,
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  // 사용자 설정
  getUserSettings() {
    // tourWishNotify: 설정 > 투어의 '투어 제안 요청 알림' (Y/N, 없으면 꺼짐) — 켠 강사 · admin에게 인솔자 모집중 알림
    return request<{ settings: { schedulePublic: string; tourWishNotify?: string } }>('/user/settings');
  },

  updateUserSetting(key: string, value: string) {
    return request<{ success: boolean }>('/user/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    });
  },

  // SMS 인증
  sendVerificationCode(phone: string, tempToken: string) {
    return request<{ success: boolean; message?: string }>('/auth/send-code', {
      method: 'POST',
      authToken: tempToken,
      ignoreUnauthorized: true,
      body: JSON.stringify({ phone }),
    });
  },

  verifyCode(phone: string, code: string, tempToken: string) {
    return request<{ success: boolean; message?: string }>('/auth/verify-code', {
      method: 'POST',
      authToken: tempToken,
      ignoreUnauthorized: true,
      body: JSON.stringify({ phone, code }),
    });
  },

  register(
    tempToken: string,
    data: {
      nickname: string;
      birthDate: string;
      phone?: string;
      kakaoTalkId?: string;
      instagramId?: string;
    }
  ) {
    return request<RegisterResponse>('/auth/register', {
      method: 'POST',
      authToken: tempToken,
      ignoreUnauthorized: true,
      body: JSON.stringify(data),
    });
  },
};
