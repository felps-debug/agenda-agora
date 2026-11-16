export const DATABASE_PAGE_SIZE = 1000;

/** Fetches every offset page and fails closed when any page cannot be read. */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  errorMessage: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + DATABASE_PAGE_SIZE - 1);
    if (error) throw new Error(errorMessage);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) return rows;
  }
}
