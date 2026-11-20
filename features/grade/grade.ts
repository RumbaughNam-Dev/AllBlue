// 프로필 활동 등급 (2026-11-20 사용자 확정, 설계: 구글 슬라이드 'AllBlue-등급퀘스트-설계')
// 등급 5단계 × 레벨 1~99, 100xp = 1레벨. 서버 quests.service.ts의 gradeOf와 같은 계산
export const GRADES = ['프린이', '물춘기', '물잘알', '고인물', '프친자'] as const;
// 프로필 테두리 색: 프린이 흰색(no license) · 물춘기 노랑 · 물잘알 파랑 · 고인물 빨강 · 프친자 초록
export const GRADE_COLORS = ['#FFFFFF', '#FFD43B', '#339AF0', '#FA5252', '#40C057'] as const;
// 등급 색 위 글자 색 (흰색 · 노랑 위는 진한 파랑)
export const GRADE_TEXT_COLORS = ['#144A84', '#144A84', '#FFFFFF', '#FFFFFF', '#FFFFFF'] as const;
export const XP_PER_LEVEL = 100;
export const LEVELS_PER_GRADE = 99;
export const XP_PER_GRADE = XP_PER_LEVEL * LEVELS_PER_GRADE;
export const MAX_XP = XP_PER_GRADE * GRADES.length;

export type Grade = { totalXp: number; gradeIndex: number; grade: string; level: number; xp: number; maxed: boolean };

export function gradeOf(totalXp: number): Grade {
  const total = Math.max(0, Math.min(MAX_XP, Math.floor(totalXp) || 0));
  const maxed = total >= MAX_XP;
  const gradeIndex = Math.min(GRADES.length - 1, Math.floor(total / XP_PER_GRADE));
  const within = total - gradeIndex * XP_PER_GRADE;
  const level = Math.min(LEVELS_PER_GRADE, Math.floor(within / XP_PER_LEVEL) + 1);
  const xp = maxed ? XP_PER_LEVEL : within % XP_PER_LEVEL;
  return { totalXp: total, gradeIndex, grade: GRADES[gradeIndex], level, xp, maxed };
}

export const gradeColor = (g: Pick<Grade, 'gradeIndex'>) => GRADE_COLORS[g.gradeIndex] ?? GRADE_COLORS[0];
export const gradeTextColor = (g: Pick<Grade, 'gradeIndex'>) => GRADE_TEXT_COLORS[g.gradeIndex] ?? GRADE_TEXT_COLORS[0];
export const gradeLabel = (g: Pick<Grade, 'grade' | 'level'>) => `${g.grade} Lv ${g.level}`;
