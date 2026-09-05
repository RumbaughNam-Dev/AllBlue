import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.rumbaugh.co.kr/allblue';

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
  diverLevel: string | null;
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
};

export type ScheduleParticipant = {
  id: number;
  nickname: string;
  name?: string;
  level?: string | number | null;
  isGuest?: boolean;
  hasInProgressLicense?: boolean;
  debriefingDone?: boolean;
  waiverSigned: boolean;
  medicalSigned: boolean;
  waiverUrl?: string;
  medicalUrl?: string;
  waiverUuid?: string;
  medicalUuid?: string;
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
  isOwner: boolean;
  myParticipantId?: number;
  participants: ScheduleParticipant[];
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

export type CertRequest = {
  id: number;
  userId: string;
  userName: string;
  birthDate: string;
  imageUrl: string;
  status: string;
  createdAt: string;
};

export type ProfileResponse = {
  user: { id: number; name?: string; nickname: string; profileImage?: string };
  profile: Profile | null;
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
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type } as any);

    const res = await fetch(`${BASE_URL}/profile/image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
        throw { status: 401, message: '세션 만료', _handled: true };
      }
      throw { status: res.status, ...data };
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
    participantIds: number[];
    guests?: { nickname: string; phone?: string }[];
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
    participantIds: number[];
    guests?: { nickname: string; phone?: string }[];
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

  getMonthlySchedules(year: number, month: number) {
    return request<{ schedules: Schedule[] }>(`/schedule/monthly?year=${year}&month=${month}`);
  },

  rejectCert(requestId: number, reason?: string) {
    return request<{ success: boolean }>(`/cert/requests/${requestId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || null }),
    });
  },

  async uploadCertImage(uri: string) {
    const token = await AsyncStorage.getItem('authToken');
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'cert.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type } as any);

    const res = await fetch(`${BASE_URL}/cert/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
        throw { status: 401, message: '세션 만료', _handled: true };
      }
      throw { status: res.status, ...data };
    }
    return data as { success: boolean };
  },

  updateProfile(data: Partial<Profile>) {
    return request<{ success: boolean; profile: Profile }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
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
