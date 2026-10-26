// 광고 이미지가 준비되면 null 대신 require('@/assets/images/ads/파일명.jpg')로 교체.
// null이면 자리만 차지하는 빈 박스가 표시된다.
export const AD_IMAGES: Record<'splash' | 'sideMenu' | 'calendar', number | null> = {
  splash: require('@/assets/images/ads/splash-ad.webp'), // 1200 x 900 (4:3)
  sideMenu: require('@/assets/images/ads/side-menu-ad.png'), // 1200 x 360 (10:3)
  calendar: require('@/assets/images/ads/calendar-ad.png'), // 1200 x 240 (5:1, 기기별로 좌우/상하 일부 잘림)
};

// 광고를 누르면 기본 브라우저로 여는 링크. 없으면 null.
export const AD_LINKS: Record<keyof typeof AD_IMAGES, string | null> = {
  splash: 'https://forms.gle/ntmtYbL3MNQHBctx6',
  sideMenu: 'https://pf.kakao.com/_jSwxiX',
  calendar: 'https://pf.kakao.com/_jSwxiX',
};
