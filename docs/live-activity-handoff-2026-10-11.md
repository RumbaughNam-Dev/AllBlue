# 라이브 액티비티 작업 재개 메모

저장일: 2026-10-11 (Asia/Seoul)
사용자가 맥북 배터리 때문에 작업을 멈추고 집에서 이어갈 예정. 하루 이상 보존 요청으로 파일에 저장. 자동 삭제하지 않는다.

## 사용자 의도

- 아이폰 잠금화면의 Live Activity에 올블루 월간 캘린더를 표시하고 싶다.
- 위젯이나 배달 상태 화면을 원하는 것이 아니다.
- 화면을 최대한 활용하되 너무 촘촘한 배치로 가독성이 떨어지지 않아야 한다.
- 월간 캘린더를 제공하는 기존 앱을 찾아 달라고 요청했고 조사까지 완료했다.
- 아직 구현이나 배포를 시작하라는 요청은 없다. 사용자가 돌아오면 이 논의부터 이어간다.

## 조사 결과와 출처

1. OurDay Calendar
   - 공식 사이트에서 잠금화면에 월간 달력을 표시하는 Live Activity를 실제 아이폰 화면으로 소개한다.
   - https://couplecalendar.app/en/
   - 화면: https://couplecalendar.app/assets/feature-proof/en/live-calendar.webp
   - 앱스토어: https://apps.apple.com/us/app/ourday-calendar/id6759252117
   - 공식 사이트는 홈 화면 월간 위젯과 잠금화면 달력 Live Activity를 별도로 구분한다.
   - 이미지 도구 조회는 시간 초과했으며 사용자에게 공식 이미지 URL로 표시했다. 직접 설치하거나 실기기 동작을 확인한 것은 아니다.

2. Calendarly Lockscreen Calendar
   - 앱스토어 버전 이력에 일간, 주간, 월간 달력을 Live Activities로 표시한다고 명시되어 있다.
   - https://apps.apple.com/us/app/calendarly-lockscreen-calendar/id6758898739
   - 배경화면, 위젯 기능도 함께 있으므로 모든 월간 달력 스크린샷이 Live Activity라고 단정하면 안 된다.
   - 설치 및 실기기 검증은 하지 않았다.

## 현재 설명과 미결 사항

- 앞서 공간 제약 때문에 월간 캘린더를 너무 제한적으로 설명했으며, 실제 제공 앱이 있음을 확인하고 정정했다.
- 제안: 날짜와 올블루의 기존 일정 색상 동그라미를 중심으로 월간 달력을 구성하고, 날짜 간격을 확보하고 오늘을 명확히 강조한다. 각 칸에 일정 제목까지 넣는 구성은 피하는 방향을 제안했으나 사용자 확정은 아니다.
- 월간 달력을 표시할 수 있는 것과 계속 유지할 수 있는 것은 별개다. 실제 표시 유지/갱신/종료 방식은 후속 검토가 필요하다.
- 앞서 Apple 문서에서 잠금화면 높이 160pt 관련 제약, 최대 활성 8시간 및 종료 후 잠금화면 잔류 최대 4시간을 확인했다. 구현 전에 최신 문서와 대상 OS를 재확인한다. 위 앱들이 시간 제한을 우회한다고 추정하지 않는다.
- Apple 자료:
  - https://developer.apple.com/design/human-interface-guidelines/live-activities
  - https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- 다음 작업은 사용자 재개 요청에 맞춰 화면 구성과 플랫폼 제약을 구체화하는 것. 지금은 코드 변경, EAS 배포, 커밋/푸시를 하지 않았다.

## 프로젝트 관련 참고

- 실제 모바일 경로: /Users/rumbaughnam/Desktop/Projects/AllBlue
- 실제 백엔드 경로: /Users/rumbaughnam/Desktop/Projects/api-server
- 개발/운영은 DB 하나를 공유한다. 별도 DB라고 안내하지 않는다.
- 사용자는 네이티브 변경을 모아 추후 버전 업 및 심사할 계획이라고 밝혔다.
- 라이브 액티비티 이전에 비즈니스 문의 메뉴/팝업 변경이 로컬에 있으며 아직 EAS 배포하지 않았다. 이 메모 저장은 해당 변경의 배포를 뜻하지 않는다.
