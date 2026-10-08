import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import UserProfileView from '@/components/UserProfileView';

export default function ProfileViewScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <UserProfileView userId={userId} onClose={() => router.back()}
    onOpenLog={params => router.push({ pathname: '/achievement', params })} />;
}
