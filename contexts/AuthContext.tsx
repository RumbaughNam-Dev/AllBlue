import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSessionExpiredHandler } from '@/services/api';
import { registerForPushNotifications, unregisterPushToken } from '@/services/push';

type User = {
  demo?: boolean;
  id: string;
  name?: string;
  nickname: string;
  profileImage?: string;
  level?: number | string;
};

type AuthContextType = {
  isLoggedIn: boolean;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
  user: User | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  hasSeenOnboarding: false,
  isLoading: true,
  user: null,
  login: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  completeOnboarding: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sessionVersion = useRef(0);

  const refreshPushToken = async (token: string, version: number) => {
    try {
      const pushToken = await registerForPushNotifications(token);
      if (!pushToken) return;
      if (sessionVersion.current !== version) {
        await unregisterPushToken(pushToken, token);
        return;
      }
      await AsyncStorage.setItem('pushToken', pushToken);
    } catch {
      // Push registration must not prevent login or restoring a session.
    }
  };

  const logout = useCallback(async () => {
    sessionVersion.current += 1;
    const values = await AsyncStorage.multiGet(['authToken', 'pushToken']);
    const token = values[0][1];
    const pushToken = values[1][1];
    await AsyncStorage.multiRemove(['authToken', 'user', 'pushToken']);
    setUser(null);
    setLoggedIn(false);
    // Revoke the device registration using the old credentials, without delaying logout.
    if (token && pushToken) void unregisterPushToken(pushToken, token);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  useEffect(() => {
    (async () => {
      try {
        const [onboarded, token, userData] = await Promise.all([
          AsyncStorage.getItem('hasSeenOnboarding'),
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('user'),
        ]);
        setHasSeenOnboarding(onboarded === 'true');
        if (token && userData) {
          const restoredUser: User = JSON.parse(userData);
          if (!restoredUser || typeof restoredUser.id !== 'string' || typeof restoredUser.nickname !== 'string') {
            throw new Error('Invalid stored user');
          }
          setUser(restoredUser);
          setLoggedIn(true);
          setHasSeenOnboarding(true);
          await AsyncStorage.setItem('hasSeenOnboarding', 'true');
          // 기존 로그인 유저 푸시 토큰 갱신
          void refreshPushToken(token, sessionVersion.current);
        }
      } catch {
        await logout();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (token: string, userData: User) => {
    if (!token || !userData?.id) throw new Error('로그인 정보가 올바르지 않습니다.');
    sessionVersion.current += 1;
    await AsyncStorage.multiSet([['authToken', token], ['user', JSON.stringify(userData)]]);
    setUser(userData);
    setLoggedIn(true);
    // 푸시 토큰 등록
    void refreshPushToken(token, sessionVersion.current);
  };

  const updateUser = async (data: Partial<User>) => {
    const updated = { ...user!, ...data };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, hasSeenOnboarding, isLoading, user, login, logout, updateUser, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
