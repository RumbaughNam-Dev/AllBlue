import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';

const BASE_URL = __DEV__
  ? 'https://api-dev.rumbaugh.co.kr/allblue'
  : 'https://api.rumbaugh.co.kr/allblue';

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function handleUnauthorized() {
  Alert.alert(
    '세션 만료',
    '로그인 세션이 만료되었습니다.\n다시 로그인해주세요.',
    [
      {
        text: '확인',
        onPress: () => onSessionExpired?.(),
      },
    ]
  );
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem('authToken');
  console.log(`[API] ${options.method ?? 'GET'} ${path} | token: ${token ? token.substring(0, 20) + '...' : 'NULL'}`);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
      throw { status: 401, message: '세션 만료', _handled: true };
    }
    throw { status: res.status, ...data };
  }

  return data;
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
  nickname: string;
  name?: string;
  level?: string | number | null;
};

export type Schedule = {
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
  id: number;
  nickname: string;
  name?: string;
  level?: string | number | null;
  isGuest?: boolean;
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
  userId: string;
  nickname: string;
  name?: string;
  level?: string | number | null;
  lastDiveDate: string;
  memo?: string;
};

export type CloseFriend = {
  userId: string;
  nickname: string;
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

export type ProfileResponse = {
  user: { id: number; name?: string; nickname: string; profileImage?: string; organization?: Organization | null };
  profile: Profile | null;
  isMyStudent?: boolean;
};

export const api = {
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
    const data = JSON.parse(result.body);
    if (result.status < 200 || result.status >= 300) {
      if (result.status === 401) {
        handleUnauthorized();
        throw { status: 401, message: '세션 만료', _handled: true };
      }
      throw { status: result.status, ...data };
    }
    return data as { success: boolean; profileImage: string };
  },

  getLastCertReject() {
    return request<{ rejected: boolean; reason?: string }>('/cert/last-reject');
  },

  checkCertPending() {
    return request<{ pending: boolean }>('/cert/pending');
  },

  getCertRequests() {
    return request<{ requests: CertRequest[] }>('/cert/requests');
  },

  getCertPendingCount() {
    return request<{ count: number }>('/cert/pending-count');
  },

  approveCert(requestId: number, level: string) {
    return request<{ success: boolean }>(`/cert/requests/${requestId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ level }),
    });
  },

  getDivingPools() {
    return request<{ pools: { id: number; name: string }[] }>('/diving-pools');
  },

  searchUsers(q: string) {
    return request<{ users: { id: number; nickname: string; name?: string; phone: string; birthDate?: string; level?: string | number | null }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
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

  getScheduleDetail(id: number) {
    return request<{ schedule: ScheduleDetail }>(`/schedule/${id}`);
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

  getDailySchedules(date: string) {
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
    const data = JSON.parse(result.body);
    if (result.status < 200 || result.status >= 300) {
      if (result.status === 401) {
        handleUnauthorized();
        throw { status: 401, message: '세션 만료', _handled: true };
      }
      throw { status: result.status, ...data };
    }
    return data as { success: boolean };
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

    console.log('[API] POST /inquiries (multipart)', { fileName: attachment.name, type: attachment.type });
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
    const data = JSON.parse(result.body);
    console.log('[API] POST /inquiries response:', result.status, data);
    if (result.status < 200 || result.status >= 300) {
      if (result.status === 401) {
        handleUnauthorized();
        throw { status: 401, message: '세션 만료', _handled: true };
      }
      throw new Error(data?.message || '문의 등록 실패');
    }
    return data as { success: boolean };
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
      const parsed = JSON.parse(result.body);
      if (result.status >= 200 && result.status < 300) {
        logoUrl = parsed.logoUrl;
      }
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
  registerPushToken(token: string) {
    return request<{ success: boolean }>('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  unregisterPushToken(token: string) {
    return request<{ success: boolean }>('/push/unregister', {
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
      headers: { Authorization: `Bearer ${tempToken}` },
      body: JSON.stringify({ phone }),
    });
  },

  verifyCode(phone: string, code: string, tempToken: string) {
    return request<{ success: boolean; message?: string }>('/auth/verify-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
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
      headers: { Authorization: `Bearer ${tempToken}` },
      body: JSON.stringify(data),
    });
  },
};
