import React from 'react';
import CommunityHomeScreen from '@/features/community/CommunityHomeScreen';
import { SplitScene } from '@/features/split/SplitPane';

export default function TabCommunity() {
  return <SplitScene tab="community"><CommunityHomeScreen /></SplitScene>;
}
