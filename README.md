# AllBlue

프리다이빙 일정, 교육, 자격증과 친구를 관리하는 Expo SDK 57 앱입니다.

## 실행과 검증

```sh
npm install
npm start
npm run typecheck
npm test
```

`npm test`는 네트워크나 실기기를 사용하지 않고 인증, 환경 분기, 온보딩과 비동기 응답 순서를 검증합니다.

## API 환경

일반 API는 `constants/Environment.ts`에서 환경에 따라 분기합니다. 카카오·구글·네이버·애플 로그인 콜백은 변경 전과 같이 운영 도메인을 사용합니다.

| 실행 환경 | API |
| --- | --- |
| 로컬 Metro, development, preview | `https://api-dev.rumbaugh.co.kr/allblue` |
| production | `https://api.rumbaugh.co.kr/allblue` |

배포 앱에서는 설치된 앱의 EAS Update 채널을 우선 사용합니다. 채널이 없는 로컬 export에서는 `EXPO_PUBLIC_APP_ENV`를 사용하며, 미설정 시 개발 서버를 선택합니다. 로컬 Metro는 항상 개발 서버를 사용합니다. `NODE_ENV`로 API 서버를 선택하지 않습니다.

빌드 프로필은 `eas.json`에 정의되어 있습니다. OTA는 `npm run update` 또는 `npm run update:preview`로 해당 EAS 환경·채널을 지정합니다. 이 명령들은 실제 업데이트를 게시합니다.

로그인 콜백은 모든 환경에서 기존 주소인 `https://api.rumbaugh.co.kr/allblue/auth/{provider}/callback`을 사용합니다. `provider`는 `kakao`, `google`, `naver`, `apple`이며, 각 소셜 서비스에 등록된 redirect URI 및 서버 콜백과 일치해야 합니다. 소셜 서비스 콘솔·백엔드 설정은 이 저장소에서 관리하지 않습니다.

## 코드 구성

- `app/`: Expo Router 경로. 친구·일정 편집 경로는 기능별 화면을 내보냅니다.
- `features/friends/`: 친구 화면, 상태·API 처리 훅, 스타일.
- `features/schedule/`: 일정 편집 화면, 상태·API 처리 훅, 스타일.
- `hooks/`: 달력 데이터, 검색, 이전 요청 무효화 등 공통 로직.
- `services/`: API, 푸시 및 Firebase 설정.
- `contexts/`: 로그인 상태와 온보딩 완료 상태.
- `utils/`: 사용자 레벨 판별, 전화번호 표시, 요청 순서 관리.

강사 UI는 기존 프로필 기준에 맞춰 레벨 `5`와 관리자 `A`에 표시합니다. 이는 화면 표시 규칙이며 서버의 권한 검사를 대체하지 않습니다.

## 데모 계정 로그인

로그인 화면의 `데모 모드로 체험하기`에서 별도로 제공한 접속 코드를 입력합니다. `POST /allblue/auth/demo`가 서버에 지정된 공용 계정의 24시간 세션을 발급하며 SNS 로그인은 거치지 않습니다. 계정 비밀번호·접속 코드·고정 토큰은 앱 소스나 EAS 환경에 포함하지 않습니다.

데모 계정은 기존 앱 화면을 사용합니다. 공용 계정이므로 개인정보를 입력하지 않아야 하며, 기기 푸시와 실제 계정 탈퇴를 지원합니다. 탈퇴 후 같은 코드로 접속하면 새 ID의 빈 계정을 생성하며 이전 세션은 무효화됩니다. 버튼에 날짜 기반 만료는 없습니다. 향후 제거 시 변경 내용을 심사 메모에 설명한 새 버전으로 제출하고, 심사에 필요한 접근 수단을 유지합니다.

배포 번호: iOS/Android 공통 1.0.1 (13). EAS remote 번호와 app.json을 함께 맞추고 production autoIncrement를 끄고 제출합니다. 다음 배포 시 양쪽 번호를 함께 올려야 합니다.
