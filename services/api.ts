import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';

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
  level: number | string | null;
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

export type ScheduleParticipantSummary = {
  userId?: string | null;
  nickname: string;
  name?: string;
  level?: string | number | null;
};

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'removed';
export type AppNotification = { id: number; senderId: string; receiverId: string; scheduleId: number; title: string; body: string; readAt: string | null; createdAt: string };

export type Schedule = {
  invitationStatus?: InvitationStatus | null;
  id: number;
  title: string;
  scheduleDate: string;
  startHour: number;
  startMinute: number;
  poolName: string;
  categoryCode: string;
  categoryName: string;
  instructorName: string;
  participantCount: number;
  participantNames: string[];
  participants?: ScheduleParticipantSummary[];
  minLevel?: string | number | null;
};

export type ScheduleParticipant = {
  canLinkTemporary?: boolean;
  canViewDivingLog?: boolean;
  canWriteDebriefing?: boolean;
  userId?: string | null;
  invitationStatus?: InvitationStatus;
  invitationToken?: string | null;
  id: number;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null;
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
  categoryCode: string;
  categoryName: string;
  instructorName: string;
  visibility?: string;
  isOwner: boolean;
  myParticipantId?: number;
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

export type DiveBuddy = {
  isTemporary?: boolean;
  userId: string;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null;
  lastDiveDate: string;
  memo?: string;
};

export type CloseFriend = {
  isTemporary?: boolean;
  userId: string;
  nickname: string;
  profileImage?: string | null;
  name?: string;
  level?: string | number | null;
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

export type Certification = { id: number; name: string; nameKo: string | null };
export type CertificationOption = Certification & {
  levelOrder: number;
  isInstructor: number;
  association: { code: string; name: string; nameKo: string | null };
};

export type ProfileResponse = {
  certifications?: Certification[];
  user: { id: number; isTemporary?: boolean; name?: string; nickname: string; profileImage?: string; organization?: Organization | null };
  profile: Profile | null;
  isMyStudent?: boolean;
};

export type TemporaryLinkTarget = { id: number; userId: string; nickname: string; name?: string | null; profileImage?: string | null; level?: string; phoneHint?: string | null };
export type TemporaryLinkPreview = {
  source: { id: number; nickname: string }; target: TemporaryLinkTarget;
  schedules: { id: number; title: string; date: string }[];
  counts: { schedules: number; courses: number; forms: number; debriefings: number; achievements: number };
  duplicates: { schedules: number; courses: number; achievements: number; contacts: number };
  confirmationToken: string;
};
export const api = {
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

  async uploadProfileImage(uri: string) {
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

  approveCert(requestId: number, licenseId: number) {
    return request<{ success: boolean }>(`/cert/requests/${requestId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ licenseId }),
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
  createTemporaryUser(name: string) {
    return request<{ user: { id: number; userId: string; nickname: string; isTemporary: boolean; phone: string; level: string } }>('/users/temporary', {
      method: 'POST', body: JSON.stringify({ name }),
    });
  },

  searchUsers(q: string) {
    return request<{ users: { id: number; userId?: string; isTemporary?: boolean; nickname: string; profileImage?: string | null; name?: string; phone: string; birthDate?: string; level?: string | number | null }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
  },

  getNotifications(options: { all?: boolean; before?: number; after?: number; ceiling?: number } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined) params.set(key, String(value));
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

  saveDebriefing(scheduleId: number, participantId: number, content: string) {
    return request<{ success: boolean }>(`/debriefing`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, participantId, content }),
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

  async uploadCertImage(uri: string) {
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
    });
    return parseResponse<{ success: boolean }>(result.status, result.body, token);
  },

  updateProfile(data: Partial<Profile> & { organizationId?: number | null }) {
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
    return request<{ users: { userId: string; nickname: string; name?: string; level?: string | number | null }[] }>('/friends/blocked');
  },

  // 문의
  getInquiries() {
    return request<{ inquiries: { id: number; title: string; content: string; status: 'PENDING' | 'ANSWERED'; createdAt: string }[] }>('/inquiries');
  },

  getInquiryDetail(id: number) {
    return request<{ inquiry: { id: number; title: string; content: string; status: 'PENDING' | 'ANSWERED'; answer?: string; answeredAt?: string; createdAt: string; attachment?: { id: number; fileUrl: string; fileName: string; fileSize: number; mimeType: string } } }>(`/inquiries/${id}`);
  },

  async createInquiry(title: string, content: string, attachment?: { uri: string; name: string; type: string }) {
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

  async createOrganization(data: { name: string; phone?: string; address?: string; logoUri?: string }) {
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
    return request<{ settings: { schedulePublic: string } }>('/user/settings');
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
