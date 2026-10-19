// Achievement STA values use total seconds, independently from profile records.
export function parseAchievementValue(text: string, unit: string): number | null {
  const value = text.trim();
  if (!value) return null;
  if (unit === 'SEC') {
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(value);
    if (!match || Number(match[2]) > 59) throw new Error('STA는 분:초 형식으로 입력해주세요. (예: 4:01)');
    return Number(match[1]) * 60 + Number(match[2]);
  }
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value) || Number(value) > 99999.99) {
    throw new Error('거리는 0 이상의 숫자로 소수점 둘째 자리까지 입력해주세요.');
  }
  return Number(value);
}

export function achievementValueText(value: number | null | undefined, unit: string): string {
  if (value == null) return '';
  return unit === 'SEC'
    ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
    : String(value);
}

export function requirementLabel(item: { name: string; nameKo: string; isOptional: boolean }): string {
  const label = item.nameKo && item.nameKo !== item.name ? `${item.name} (${item.nameKo})` : item.name;
  return item.isOptional && !/optional/i.test(label) ? `${label} (Optional)` : label;
}
