import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue(), AutoImport({ imports: ['vue'], dts: false })],
  resolve: { alias: {
    '@common': resolve('common'), '@renderer': resolve('renderer'),
    '@main': resolve('main'), '@locales': resolve('locales'),
  } },
  test: { environment: 'happy-dom', setupFiles: ['./tests/setup.ts'], include: ['tests/**/*.test.ts'] },
});
