import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  define: { __SUPABASE_URL__: JSON.stringify(loadEnv(mode, process.cwd()).VITE_SUPABASE_URL ?? '') },
  resolve: {
    alias: {
      '@common': resolve(__dirname, 'common'),
      '@main': resolve(__dirname, 'main'),
      '@renderer': resolve(__dirname, 'renderer'),
      '@locales': resolve(__dirname, 'locales')
    }
  }
}));
