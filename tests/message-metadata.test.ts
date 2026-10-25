import { expect, it, vi } from 'vitest';
import { upsertMessages, fetchMessages } from '../renderer/services/messageRepo';
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('../renderer/services/client', () => ({ getUserClient: async () => ({ from: () => ({
  upsert: (rows: Record<string, unknown>[]) => {
    state.rows = rows;
    return { select: async () => ({ data: rows, error: null }) };
  },
  select: () => ({ eq: () => ({ order: () => ({ order: () => ({ range: async () => ({ data: state.rows, error: null }) }) }) }) }),
}) }) }));

it('round-trips reasoning, partial text and error metadata through the cloud repository', async () => {
  const result = await upsertMessages('user', [{ id: 'answer', conversationId: 'conversation', type: 'answer', createdAt: 1,
    content: 'partial', reasoningContent: 'reasoning', finishReason: 'incomplete', error: 'interrupted', status: 'error' }]);
  expect(result.success).toBe(true);
  const fetched = await fetchMessages('user');
  expect(fetched[0]).toMatchObject({ content: 'partial', reasoningContent: 'reasoning', finishReason: 'incomplete', error: 'interrupted', status: 'error' });
  expect(state.rows[0].content).toBe('partial');
});

it('reads original messages with absent or empty metadata without losing their content', async () => {
  state.rows = [
    { id: 'legacy', content: 'original answer', type: 'answer', status: 'success', created_at: '2025-01-01', updated_at: '2025-01-01' },
    { id: 'migrated', content: 'other answer', type: 'answer', status: 'success', metadata: {}, created_at: '2025-01-01', updated_at: '2025-01-01' },
  ];
  const fetched = await fetchMessages('user');
  expect(fetched.map(m => m.content)).toEqual(['original answer', 'other answer']);
  expect(fetched.every(m => !m.reasoningContent && !m.error)).toBe(true);
});
