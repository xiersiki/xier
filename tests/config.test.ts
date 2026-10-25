import { expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

it('preserves pending local settings when another window broadcasts configuration', async () => {
  const initial = { themeMode: 'system', primaryColor: '#BB5BE7', language: 'zh', fontSize: 14,
    minimizeToTray: false, provider: '', defaultModel: null };
  vi.mocked(window.api.getConfig).mockImplementation(async key => initial[key as keyof typeof initial]);
  let broadcast!: (config: Record<string, unknown>) => void;
  vi.mocked(window.api.onConfigChange).mockImplementation(cb => { broadcast = cb; return () => {}; });
  const { useConfig, configReady } = await import('../renderer/hooks/useConfig');
  await configReady;
  vi.useFakeTimers();
  try {
    const config = useConfig();
    config.themeMode = 'dark'; config.fontSize = 18;
    broadcast({ ...initial, provider: 'updated-by-another-window' });
    expect(config.themeMode).toBe('dark');
    expect(config.fontSize).toBe(18);
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    expect(window.api.updateConfig).toHaveBeenCalledWith({ themeMode: 'dark', fontSize: 18 });
  } finally { vi.useRealTimers(); }
});
