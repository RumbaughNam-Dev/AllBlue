import React from 'react';
import { Pressable, Text, GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

type Props = React.PropsWithChildren<{
  userId?: string | null;
  label?: string;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  beforeOpen?: () => void;
}>;

export default function ProfileLink({ userId, label, style, beforeOpen, children, inline }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const open = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!userId) return;
    beforeOpen?.();
    if (userId === user?.id) router.push('/profile');
    else router.push({ pathname: '/profile-view', params: { userId } });
  };
  if (inline) return <Text onPress={userId ? open : undefined}
    accessibilityRole={userId ? 'link' : undefined}
    accessibilityLabel={userId ? `${label || '사용자'} 프로필 보기` : undefined}>{children}</Text>;
  return (
    <Pressable
      style={style}
      disabled={!userId}
      accessibilityRole={userId ? 'link' : undefined}
      accessibilityLabel={userId ? `${label || '사용자'} 프로필 보기` : undefined}
      onPress={open}
    >{children}</Pressable>
  );
}
