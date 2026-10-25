import { expect, it, vi } from 'vitest';
import { fetchAllRows } from '../renderer/services/pagination';

it('loads all pages instead of treating API row limits as remote deletions', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(await fetchAllRows(fetchPage)).toEqual(rows);
  expect(fetchPage).toHaveBeenCalledTimes(3);
});

it('rejects partial results when a later page fails', async () => {
  const fetchPage = vi.fn(async (from: number) => from === 0
    ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
    : { data: null, error: new Error('offline') });
  await expect(fetchAllRows(fetchPage)).rejects.toThrow('offline');
});
