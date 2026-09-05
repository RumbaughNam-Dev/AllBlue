import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSessionExpiredHandler } from '@/services/api';

type User = {
  id: string;
  name?: string;
  nickname: string;
  profileImage?: string;
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

  useEffect(() => {
    (async () => {
      try {
        const [onboarded, token, userData] = await Promise.all([
          AsyncStorage.getItem('hasSeenOnboarding'),
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('user'),
        ]);
        if (token && userData) {
          setLoggedIn(true);
          setUser(JSON.parse(userData));
          setHasSeenOnboarding(true);
        } else {
          setHasSeenOnboarding(false);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (token: string, userData: User) => {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setLoggedIn(true);
  };

  const updateUser = async (data: Partial<User>) => {
    const updated = { ...user!, ...data };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
    setUser(null);
    setLoggedIn(false);
  };

  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
    });
  }, []);

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
