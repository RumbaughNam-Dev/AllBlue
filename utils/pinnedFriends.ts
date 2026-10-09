import type { CloseFriend } from '@/services/api';

export function readPinnedOrder(value: string | null): string[] {
  try {
    const ids: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

export function sortPinnedFriends(friends: CloseFriend[], order: string[]): CloseFriend[] {
  const ranks = new Map(order.map((id, index) => [id, index]));
  return [...friends].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (!a.pinned) return 0;
    return (ranks.get(a.userId) ?? order.length) - (ranks.get(b.userId) ?? order.length);
  });
}

export function movePinnedId(ids: string[], from: number, to: number): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
