import { expect, it } from 'vitest';
import { ContentController } from '../renderer/features/content/controller';

it('imports a UTF-8 copy with normalized line endings while preserving Chinese and emoji', () => {
  const editor = new ContentController();
  expect(editor.state.doc.toString()).toBe('');
  const source = new TextEncoder().encode('你好😀\r\n第二行');
  editor.importText('说明.md', source);
  expect(editor.state.doc.toString()).toBe('你好😀\n第二行');
  expect(new TextDecoder().decode(source)).toBe('你好😀\r\n第二行');
});

it('rejects oversized or invalid UTF-8 imports without losing the current draft', () => {
  const editor = new ContentController();
  editor.importText('边界.txt', new TextEncoder().encode('😀'.repeat(20000)));
  expect(editor.state.doc.length).toBe(40000);
  expect(() => editor.importText('过长.txt', new TextEncoder().encode('字'.repeat(20001)))).toThrow('20,000');
  expect(() => editor.importText('损坏.txt', new Uint8Array([0xff]))).toThrow();
  expect(editor.state.doc.toString()).toBe('😀'.repeat(20000));
});

it('sends only the captured selection and presents a complete suggestion without changing the draft', async () => {
  const sent: unknown[] = [];
  const port: import('../common/content/contracts').AgentPort = {
    observe: () => () => {},
    start: async request => { sent.push(request); return { requestId: request.requestId, sequence: 2, status: 'completed', result: { replacement: '简洁文本' } }; },
    get: async requestId => ({ requestId, sequence: 0, status: 'unknown' }),
    cancel: async requestId => ({ requestId, sequence: 3, status: 'cancelled' }),
  };
  const editor = new ContentController(port);
  editor.importText('说明.md', new TextEncoder().encode('前文。冗长的文本。后文。'));
  editor.select(3, 8);
  await editor.generate('更精简');
  expect(sent).toEqual([expect.objectContaining({ selectedText: '冗长的文本', requirement: '更精简' })]);
  expect(JSON.stringify(sent)).not.toContain('后文');
  expect(editor.suggestion?.result?.replacement).toBe('简洁文本');
  expect(editor.state.doc.toString()).toBe('前文。冗长的文本。后文。');
});

function immediatePort(): import('../common/content/contracts').AgentPort {
  return {
    observe: () => () => {},
    start: async request => ({ requestId: request.requestId, sequence: 2, status: 'completed', result: { replacement: '简洁文本' } }),
    get: async requestId => ({ requestId, sequence: 0, status: 'unknown' }),
    cancel: async requestId => ({ requestId, sequence: 3, status: 'cancelled' }),
  };
}
it('accepts at the captured range only once and undoes subsequent typing before the suggestion', async () => {
  const editor = new ContentController(immediatePort());
  editor.importText('说明.md', new TextEncoder().encode('前文。冗长的文本。后文。'));
  editor.select(3, 8);
  await editor.generate('精简');
  editor.select(0, 2);
  expect(editor.accept()).toBe(true);
  expect(editor.accept()).toBe(false);
  expect(editor.state.doc.toString()).toBe('前文。简洁文本。后文。');
  editor.dispatch(editor.state.update({ changes: { from: editor.state.doc.length, insert: '！' }, userEvent: 'input.type' }));
  editor.undo();
  expect(editor.state.doc.toString()).toBe('前文。简洁文本。后文。');
  editor.undo();
  expect(editor.state.doc.toString()).toBe('前文。冗长的文本。后文。');
  expect(editor.accept()).toBe(false);
});

it('keeps a proposal stale even if edits during generation are undone before completion', async () => {
  let complete!: (snapshot: import('../common/content/contracts').RunSnapshot) => void;
  let requestId = '';
  const port = immediatePort();
  port.start = request => { requestId = request.requestId; return new Promise(resolve => { complete = resolve; }); };
  const editor = new ContentController(port);
  editor.importText('原文.txt', new TextEncoder().encode('原始内容'));
  editor.select(0, 4);
  const generating = editor.generate('精简');
  editor.dispatch(editor.state.update({ changes: { from: 4, insert: '变更' } }));
  editor.undo();
  complete({ requestId, sequence: 2, status: 'completed', result: { replacement: '新内容' } });
  await generating;
  expect(editor.suggestion?.status).toBe('stale');
  expect(editor.accept()).toBe(false);
  expect(editor.state.doc.toString()).toBe('原始内容');
});

it('attaches late completion to the original draft and restores its editor history when switching back', async () => {
  let complete!: (snapshot: import('../common/content/contracts').RunSnapshot) => void;
  let requestId = '';
  const port = immediatePort();
  port.start = request => { requestId = request.requestId; return new Promise(resolve => { complete = resolve; }); };
  const editor = new ContentController(port);
  editor.importText('第一份.txt', new TextEncoder().encode('第一份内容'));
  const firstId = editor.draftId;
  editor.select(0, 5);
  const generating = editor.generate('精简');
  editor.importText('第二份.txt', new TextEncoder().encode('第二份内容'));
  complete({ requestId, sequence: 2, status: 'completed', result: { replacement: '第一份建议' } });
  await generating;
  expect(editor.suggestion).toBeUndefined();
  expect(editor.accept()).toBe(false);
  expect(editor.state.doc.toString()).toBe('第二份内容');
  editor.selectDraft(firstId);
  expect(editor.suggestion?.result?.replacement).toBe('第一份建议');
  expect(editor.accept()).toBe(true);
  editor.undo();
  expect(editor.state.doc.toString()).toBe('第一份内容');
});

it.each([
  ['空选区', '文本', 0, 0],
  ['选区超限', '字'.repeat(4001), 0, 4001],
  ['截断 emoji', '😀文本', 0, 1],
] as const)('does not submit an invalid selection: %s', async (_name, text, from, to) => {
  let requests = 0;
  const port = immediatePort();
  port.start = async request => { requests++; return { requestId: request.requestId, sequence: 1, status: 'running' }; };
  const editor = new ContentController(port);
  editor.importText('测试.txt', new TextEncoder().encode(text));
  editor.select(from, to);
  await editor.generate('精简');
  expect(requests).toBe(0);
  expect(editor.state.doc.toString()).toBe(text);
});

it.each([undefined, { replacement: '' }, { replacement: '新'.repeat(20001) }, { replacement: 42 }])('rejects incomplete or invalid results without offering acceptance', async result => {
  const port = immediatePort();
  port.start = async request => ({ requestId: request.requestId, sequence: 2, status: 'completed', result } as import('../common/content/contracts').RunSnapshot);
  const editor = new ContentController(port);
  editor.importText('原文.txt', new TextEncoder().encode('原始内容'));
  editor.select(0, 4);
  await editor.generate('精简');
  expect(editor.status).toBe('failed');
  expect(editor.accept()).toBe(false);
  expect(editor.state.doc.toString()).toBe('原始内容');
});

it('observes before start, ignores old snapshots and rejects without changing text', async () => {
  let listener: (snapshot: import('../common/content/contracts').RunSnapshot) => void = () => {};
  let observed = false;
  let id = '';
  const editor = new ContentController({
    observe: (_, callback) => { observed = true; listener = callback; return () => {}; },
    start: async request => { expect(observed).toBe(true); id = request.requestId; return { requestId: id, sequence: 1, status: 'running' }; },
    get: async () => ({ requestId: id, sequence: 0, status: 'unknown' }),
    cancel: async () => ({ requestId: id, sequence: 3, status: 'cancelled' }),
  });
  editor.importText('one', new TextEncoder().encode('原始内容')); editor.select(0, 4);
  await editor.generate('精简');
  listener({ requestId: id, sequence: 2, status: 'completed', result: { replacement: '建议' } });
  listener({ requestId: id, sequence: 1, status: 'running' });
  expect(editor.status).toBe('completed');
  expect(editor.suggestion?.result?.replacement).toBe('建议');
  editor.reject();
  expect(editor.suggestion?.status).toBe('rejected');
  expect(editor.accept()).toBe(false);
  expect(editor.state.doc.toString()).toBe('原始内容');
});

it('locks a running workspace and keeps unknown pending until refresh confirms completion', async () => {
  let starts = 0; let id = '';
  const editor = new ContentController({
    observe: () => () => {},
    start: async request => { starts++; id = request.requestId; return { requestId: id, sequence: 1, status: 'running' }; },
    cancel: async () => ({ requestId: id, sequence: 2, status: 'unknown' }),
    get: async () => ({ requestId: id, sequence: 3, status: 'completed', result: { replacement: '确认完成' } }),
  });
  editor.importText('one', new TextEncoder().encode('原始内容')); editor.select(0, 4);
  await editor.generate('精简'); await editor.generate('再来');
  expect(starts).toBe(1);
  await editor.cancel();
  expect(editor.status).toBe('unknown');
  await editor.generate('再来'); expect(starts).toBe(1);
  await editor.refresh(); expect(editor.status).toBe('completed');
  expect(editor.state.doc.toString()).toBe('原始内容');
  expect(editor.accept()).toBe(true);
});

it('notifies subscribers and disposal detaches, cancels and ignores late completion', async () => {
  let listener: (s: import('../common/content/contracts').RunSnapshot) => void = () => {};
  let detached = false; let cancelled = false; let id = ''; let updates = 0;
  const editor = new ContentController({
    observe: (_, callback) => { listener = callback; return () => { detached = true; }; },
    start: async request => { id = request.requestId; return { requestId: id, sequence: 1, status: 'running' }; },
    cancel: async () => { cancelled = true; return { requestId: id, sequence: 2, status: 'cancelled' }; },
    get: async () => ({ requestId: id, sequence: 0, status: 'unknown' }),
  });
  editor.subscribe(() => { updates++; });
  editor.importText('one', new TextEncoder().encode('原始内容')); editor.select(0, 4);
  await editor.generate('精简'); expect(updates).toBeGreaterThan(0);
  editor.dispose(); expect(detached).toBe(true); expect(cancelled).toBe(true);
  const before = updates;
  listener({ requestId: id, sequence: 3, status: 'completed', result: { replacement: '迟到' } });
  expect(updates).toBe(before); expect(editor.suggestion?.result).toBeUndefined();
});

it('rejects oversized typing and handles transport loss without treating it as stopped', async () => {
  const editor = new ContentController({ ...immediatePort(), start: async () => { throw new Error('transport lost'); } });
  editor.importText('limit', new TextEncoder().encode('字'.repeat(20000)));
  editor.dispatch(editor.state.update({ changes: { from: 20000, insert: '多' } }));
  expect(editor.state.doc.length).toBe(20000);
  editor.select(0, 4000);
  await editor.generate('精简');
  expect(editor.status).toBe('unknown');
  expect(editor.accept()).toBe(false);
});

it('clears a connection warning when refresh confirms completion', async () => {
  let id = '';
  const editor = new ContentController({ ...immediatePort(), start: async request => { id = request.requestId; throw new Error('offline'); },
    get: async () => ({ requestId: id, sequence: 2, status: 'completed', result: { replacement: '完成' } }),
  });
  editor.newDraft('draft', '原始内容'); editor.select(0, 4); await editor.generate('精简');
  expect(editor.errorMessage).toContain('连接中断');
  await editor.refresh(); expect(editor.status).toBe('completed'); expect(editor.errorMessage).toBeUndefined();
});
