import React from 'react';
import FriendsScreen from '@/features/friends/FriendsScreen';
import { SplitScene } from '@/features/split/SplitPane';

export default function TabC() {
  return <SplitScene tab="c"><FriendsScreen /></SplitScene>;
}
