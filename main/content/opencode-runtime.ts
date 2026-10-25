import { promisify } from 'node:util';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OpenCodeGateway } from '../../services/content-gateway/gateway';
export interface ContentRuntimeOptions {
  /** Trusted host configuration only, never renderer input. */
  executable: string;
  executableArgs?: string[];
  profileRoot: string;
  provider: { baseURL: string; apiKey: string };
  startupTimeoutMs?: number;
}
export interface ContentRuntime { gateway: OpenCodeGateway; stop(): Promise<void> }
async function availablePort() {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve())); return port;
}
/** External service integration, not an OS sandbox. The host owns the returned lifetime. */
export async function startContentRuntime(options: ContentRuntimeOptions): Promise<ContentRuntime> {
  await mkdir(options.profileRoot, { recursive: true, mode: 0o700 });
  const lock = join(options.profileRoot, '.content-lock');
  try { await mkdir(lock, { mode: 0o700 }); } catch (error) {
    throw new Error((error as NodeJS.ErrnoException).code === 'EEXIST' ? 'CONTENT_PROFILE_BUSY' : 'CONTENT_RUNTIME_START_FAILED');
  }
  let root: string | undefined;
  let child: ChildProcess | undefined; let exited: Promise<void> | undefined; let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const kill = setTimeout(() => child?.kill('SIGKILL'), 2000); kill.unref();
      await exited; clearTimeout(kill);
    }
    if (root) await rm(root, { recursive: true, force: true });
    await rmdir(lock);
  })();
  try {
    root = await mkdtemp(join(options.profileRoot, 'run-'));
    const directories = Object.fromEntries(['work', 'home', 'config', 'data', 'cache', 'state'].map(name => [name, join(root!, name)]));
    await Promise.all(Object.values(directories).map(path => mkdir(path, { mode: 0o700 })));
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'LANG', 'LC_ALL']) if (process.env[key]) env[key] = process.env[key];
    const password = randomUUID();
    Object.assign(env, { HOME: directories.home, USERPROFILE: directories.home,
      XDG_CONFIG_HOME: directories.config, XDG_DATA_HOME: directories.data, XDG_CACHE_HOME: directories.cache, XDG_STATE_HOME: directories.state,
      TMPDIR: directories.cache, TMP: directories.cache, TEMP: directories.cache,
      OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_DISABLE_CLAUDE_CODE: 'true', OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true', OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
      OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_PURE: 'true', OPENCODE_SERVER_PASSWORD: password,
      OPENCODE_CONFIG_CONTENT: JSON.stringify({ model: 'xier-content/deepseek-flash', small_model: 'xier-content/deepseek-flash', default_agent: 'content', share: 'disabled', autoupdate: false,
        permission: { '*': 'deny', StructuredOutput: 'allow' },
        agent: { title: { disable: true }, summary: { disable: true }, content: { mode: 'primary', prompt: 'Edit only the supplied text. Return structured output. Do not inspect files, run commands or access the network.', permission: { '*': 'deny', StructuredOutput: 'allow' } } },
        provider: { 'xier-content': { npm: '@ai-sdk/openai-compatible', name: 'Xier content', options: { baseURL: options.provider.baseURL, apiKey: options.provider.apiKey }, models: { 'deepseek-flash': { name: 'DeepSeek Flash', options: { thinking: { type: 'disabled' } }, limit: { context: 64000, output: 4096 } } } } },
      }),
    });
    const versionEnv = { ...env }; delete versionEnv.OPENCODE_CONFIG_CONTENT;
    const version = await promisify(execFile)(options.executable, [...(options.executableArgs ?? []), '--version'], { cwd: directories.work, env: versionEnv, timeout: 3000, maxBuffer: 1024, windowsHide: true });
    if (version.stdout.trim() !== '1.19.4') throw new Error('CONTENT_RUNTIME_INCOMPATIBLE');
    const port = await availablePort(); const baseUrl = `http://127.0.0.1:${port}`;
    const headers = { authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64') };
    child = spawn(options.executable, [...(options.executableArgs ?? []), 'serve', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: directories.work, env, stdio: 'ignore', windowsHide: true });
    let ended = false;
    exited = new Promise(resolve => { child!.once('error', () => { ended = true; resolve(); }); child!.once('exit', () => { ended = true; resolve(); }); });
    const deadline = Date.now() + (options.startupTimeoutMs ?? 15000);
    while (Date.now() < deadline && !ended) {
      try {
        const response = await fetch(baseUrl + '/global/health', { headers, signal: AbortSignal.timeout(500) });
        const health = response.ok ? await response.json() : undefined;
        if (health?.healthy && health.version === '1.19.4') return { gateway: new OpenCodeGateway({ baseUrl, headers, directory: directories.work, model: { providerID: 'xier-content', modelID: 'deepseek-flash' } }), stop };
      } catch { /* Retry health only, never generation. */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('CONTENT_RUNTIME_START_FAILED');
  } catch (error) { await stop(); throw new Error(error instanceof Error && error.message === 'CONTENT_RUNTIME_INCOMPATIBLE' ? error.message : 'CONTENT_RUNTIME_START_FAILED'); }
}
