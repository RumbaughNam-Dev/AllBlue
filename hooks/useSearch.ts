import { useEffect, useState } from 'react';
import { api } from '@/services/api';

export function useSearch<T>(query: string, search: (query: string) => Promise<T[]>, enabled = true) {
  const [results, setResults] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setCompletedQuery(null);
    setResults([]);
    setError(false);
    setSearching(enabled && !!query.trim());
    if (!enabled || !query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const items = await search(query.trim());
        if (active) { setResults(items); setCompletedQuery(query.trim()); }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, search, enabled]);
  return { results, searching, error, completedQuery };
}

const searchUsers = async (query: string) => (await api.searchUsers(query)).users ?? [];
const searchOrganizations = async (query: string) => (await api.searchOrganizations(query)).organizations ?? [];
export const useUserSearch = (query: string, enabled = true) => useSearch(query, searchUsers, enabled);
export const useOrganizationSearch = (query: string, enabled = true) => useSearch(query, searchOrganizations, enabled);
