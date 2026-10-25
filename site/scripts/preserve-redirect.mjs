import { copyFile } from 'node:fs/promises'

// Existing Pages users may still use this URL. Keep its bytes and route intact.
await copyFile(
  new URL('../../docs/auth-redirect.html', import.meta.url),
  new URL('../.vitepress/dist/auth-redirect.html', import.meta.url),
)
