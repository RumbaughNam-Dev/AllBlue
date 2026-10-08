import { useEffect, useRef } from 'react';
import { createLatestRequest } from '@/utils/latestRequest';

export function useLatestRequest() {
  const request = useRef(createLatestRequest()).current;
  useEffect(() => () => request.invalidate(), [request]);
  return request;
}
