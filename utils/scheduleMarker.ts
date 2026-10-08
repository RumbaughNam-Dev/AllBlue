import type { Schedule } from '@/services/api';

const COURSE_COLORS: Record<string, string> = {
  '2': '#FFE500',
  '3': '#33CC33',
  '4': '#FF9500',
  '5': '#3B92C5',
};

export function getScheduleMarkerColor(schedule: Pick<Schedule, 'categoryCode' | 'minCourseLevel'>): string {
  if (schedule.categoryCode === 'EXPERIENCE') return '#FFFFFF';
  if (schedule.categoryCode === 'CERTIFICATION') {
    return COURSE_COLORS[String(schedule.minCourseLevel ?? '')] ?? '#7B2FBE';
  }
  return '#7B2FBE';
}
