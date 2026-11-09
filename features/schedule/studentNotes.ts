// 강사간 수강생 정보 공유 — 서버 student-notes.service.ts와 같은 규칙
export const NOTE_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'TRAINING'];
export const NOTE_MAX = 1000;
// 글을 쓰거나 지우면 { studentId, total }을 보내 일정 상세 카드의 숫자를 바로 맞춤 (펼친 화면 오른쪽 칸은 다시 불러오지 않으므로)
export const STUDENT_NOTES_CHANGED = 'studentNotesChanged';
export type StudentNotesChanged = { studentId: number; total: number };

// '토요일 AIDA (2026.11.12) · 자격증 과정 · AIDA 2'
export function noteContext({ scheduleTitle, scheduleDate, categoryName, licenseNames }: {
  scheduleTitle: string; scheduleDate: string; categoryName: string; licenseNames: string[];
}) {
  return [`${scheduleTitle} (${scheduleDate.replace(/-/g, '.')})`, categoryName, ...licenseNames].filter(Boolean).join(' · ');
}
