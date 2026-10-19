// Older servers may return records created by saving only course achievements.
export async function loadDebriefingPage<T extends { content?: string | null }>(
  fetchPage: (page: number) => Promise<{ debriefings: T[]; hasMore: boolean }>,
  startPage: number,
): Promise<{ debriefings: T[]; hasMore: boolean; page: number }> {
  let page = startPage;
  for (;;) {
    const response = await fetchPage(page);
    const debriefings = response.debriefings.filter(item => !!item.content?.trim());
    if (debriefings.length || !response.hasMore) return { debriefings, hasMore: response.hasMore, page };
    // Empty visible pages must not hide real notes on later server pages.
    page++;
  }
}
