import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import KakaoLogo from '@/components/sns/KakaoLogo';
import { linkBrand } from '@/utils/profileLinks';

// 링크 칩 앞 아이콘: 인스타그램 · 유튜브 · 카카오톡 주소면 그 서비스 아이콘(브랜드 색), 아니면 하얀 링크 아이콘
// 브랜드 색은 로그인 화면의 SNS 버튼처럼 각 서비스 색을 씀. 인스타그램은 얇은 선이라 남색 칩 위에서 보이게 조금 밝은 분홍
export const BRAND_COLORS = { instagram: '#FF6B9A', youtube: '#FF0000', kakaotalk: '#FEE500' } as const;

// color: 서비스를 모를 때 그리는 링크 아이콘 색 (프로필 칩 · 문의하기 시트는 하양, 투어 입력 칸은 하늘색)
// 쓰는 곳: 프로필 링크 칩(LinkChips), 투어 문의 링크 목록(FormParts LinkList), 문의하기 시트(BottomSheet linkUrl)
export default function LinkIcon({ url, size = 15, color = Colors.brand.white }: { url: string; size?: number; color?: string }) {
  const brand = linkBrand(url);
  if (brand === 'instagram') return <Ionicons name="logo-instagram" size={size} color={BRAND_COLORS.instagram} accessibilityLabel="인스타그램" />;
  if (brand === 'youtube') return <Ionicons name="logo-youtube" size={size} color={BRAND_COLORS.youtube} accessibilityLabel="유튜브" />;
  if (brand === 'kakaotalk') return <KakaoLogo size={size} color={BRAND_COLORS.kakaotalk} />;
  return <Ionicons name="link" size={size} color={color} />;
}
