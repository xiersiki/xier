import { beforeEach, expect, it, vi } from 'vitest';
import { setPrimaryColor } from '../renderer/utils/theme';

beforeEach(() => vi.mocked(window.api.setConfig).mockClear());
it('applying initial theme colors does not persist defaults over a saved preference', () => {
  setPrimaryColor('#78658F');
  expect(window.api.setConfig).not.toHaveBeenCalled();
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#78658F');
  // The persisted preference arrives asynchronously after the first paint.
  setPrimaryColor('#BB5BE7');
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#BB5BE7');
  expect(window.api.setConfig).not.toHaveBeenCalled();
});
