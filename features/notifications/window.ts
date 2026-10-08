// A bounded, bidirectional inbox window. Trim a whole page to keep refetch
// boundaries stable even when the oldest server page contains fewer than 10 rows.
export function mergeNotificationWindow<T extends { id: number }>(current: T[], page: T[], direction: 'older' | 'newer') {
  const incoming = page.filter(item => !current.some(existing => existing.id === item.id));
  const combined = direction === 'older' ? [...current, ...incoming] : [...incoming, ...current];
  const trimmed = combined.length > 50 ? 10 : 0;
  const items = !trimmed ? combined : direction === 'older' ? combined.slice(trimmed) : combined.slice(0, -trimmed);
  return { items, trimmed, prepended: direction === 'newer' ? incoming.length : 0 };
}
