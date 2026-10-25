import { BrowserWindow, ipcMain, shell } from 'electron';
import { createServer } from 'node:http';
import { OAUTH_REDIRECT_URL, validateOAuthUrl } from '@common/oauth';

let registered = false;
let active = false;
let pending: { senderId: number; cancel: () => void } | undefined;
export function registerOAuthHandler() {
  if (registered) return;
  registered = true;
  ipcMain.on('oauth:cancel', event => {
    if (pending?.senderId === event.sender.id) pending.cancel();
  });
  ipcMain.handle('oauth:authorize', async (event, value: string) => {
    const url = validateOAuthUrl(value, __SUPABASE_URL__);
    if (active) throw new Error('已有登录流程正在进行，请完成后重试');
    active = true;
    try {
      return await new Promise<string>((resolve, reject) => {
        let settled = false;
        const server = createServer((request, response) => {
          const callback = new URL(request.url ?? '/', OAUTH_REDIRECT_URL);
          if (request.method !== 'GET' || callback.pathname !== '/auth/callback') {
            response.writeHead(404).end(); return;
          }
          const code = callback.searchParams.get('code');
          const error = callback.searchParams.get('error_description');
          if (!code && !error) { response.writeHead(400).end('Missing authorization code'); return; }
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
          response.end('<!doctype html><title>Xier 登录</title><main style="font:18px system-ui;margin:80px auto;max-width:600px"><h1>授权结果已返回 Xier</h1><p>请回到 Xier 查看登录结果。此页面可以关闭。</p></main>');
          finish(error ? new Error(error) : undefined, code ?? undefined);
          BrowserWindow.fromWebContents(event.sender)?.show();
          BrowserWindow.fromWebContents(event.sender)?.focus();
        });
        const timer = setTimeout(() => finish(new Error('登录超时，请重试')), 5 * 60 * 1000);
        const cancel = () => finish(new Error('登录窗口已关闭'));
        pending = { senderId: event.sender.id, cancel: () => finish(new Error('登录已取消')) };
        function finish(error?: Error, code?: string) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          event.sender.removeListener('destroyed', cancel);
          server.close();
          if (error) reject(error); else resolve(code!);
        }
        event.sender.once('destroyed', cancel);
        server.once('error', (error: NodeJS.ErrnoException) => finish(new Error(
          error.code === 'EADDRINUSE' ? '本机登录回调端口 54323 已被占用，请关闭其他 Xier 实例后重试'
            : `无法启动本机登录回调（${error.code ?? error.message}）`,
        )));
        server.listen(54323, '127.0.0.1', () => { void shell.openExternal(url).catch(finish); });
      });
    } finally { active = false; pending = undefined; }
  });
}
