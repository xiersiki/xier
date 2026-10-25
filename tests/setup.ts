import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (typeof window !== 'undefined') window.api = {
  getConfig: vi.fn(async () => undefined), setConfig: vi.fn(), updateConfig: vi.fn(),
  onConfigChange: vi.fn(() => () => {}), startADialogue: vi.fn(), stopADialogue: vi.fn(),
  onDialogueBack: vi.fn(() => () => {}),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
} as unknown as WindowApi;

vi.mock('@renderer/utils/notify', () => ({ notify: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@renderer/i18n', () => ({ default: { global: { t: () => '[已停止生成]' } }, getLanguage: () => 'zh', setLanguage: vi.fn() }));
