// Do not reconcile deletions against a truncated PostgREST response.
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw result.error;
    const chunk = (result.data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < size) return rows;
  }
}
