import React from 'react';
import { useAppRouter, useScreenParams } from '@/features/split/SplitPane';
import UserProfileView from '@/components/UserProfileView';

export default function ProfileViewScreen() {
  const router = useAppRouter();
  const { userId } = useScreenParams<{ userId: string }>();
  return <UserProfileView userId={userId} onClose={() => router.back()}
    onOpenLog={params => router.push({ pathname: '/achievement', params })} />;
}
