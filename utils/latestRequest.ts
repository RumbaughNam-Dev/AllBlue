// Each request receives a predicate that becomes false when superseded or invalidated.
export function createLatestRequest() {
  let version = 0;
  return {
    start() {
      const requestVersion = ++version;
      return () => requestVersion === version;
    },
    invalidate() { version++; },
  };
}
