// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startContentRuntime } from '../main/content/opencode-runtime';
import { request } from './content-opencode-helpers';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const close of cleanup.splice(0).reverse()) await close(); });
async function options(version = '1.19.4') {
  const dir = await mkdtemp(join(tmpdir(), 'xier-content-runtime-test-'));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const fixture = join(dir, 'opencode.cjs');
  const source = await readFile(new URL('./content-opencode-runtime-fixture.cjs', import.meta.url), 'utf8');
  await writeFile(fixture, source.replace('#!/usr/bin/env node', '#!' + process.execPath).replace("const VERSION = '1.19.4'", `const VERSION = '${version}'`), { mode: 0o700 });
  return { executable: process.execPath, executableArgs: [fixture], profileRoot: join(dir, 'profile'), provider: { baseURL: 'https://api.deepseek.com/v1', apiKey: 'synthetic-only-key' }, startupTimeoutMs: 3000 };
}
it('launches an isolated, restricted CLI and cleans up the owned process and profile', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'unrelated-synthetic-key'); vi.stubEnv('OPENCODE_CONFIG', '/must-not-load');
  const opts = await options(); const runtime = await startContentRuntime(opts); cleanup.push(() => runtime.stop());
  await runtime.gateway.start(request);
  await expect.poll(async () => (await runtime.gateway.get('req-1')).status).toBe('completed');
  const facts = JSON.parse((await runtime.gateway.get('req-1')).result!.replacement);
  expect(facts).toMatchObject({ inheritedSecret: false, inheritedConfig: false, testHome: false, flags: true, permission: { '*': 'deny', StructuredOutput: 'allow' }, agentPermission: { '*': 'deny', StructuredOutput: 'allow' }, thinking: { type: 'disabled' } });
  expect(facts.cwd).toContain(opts.profileRoot); expect(facts.home).toContain(opts.profileRoot); expect(facts.configHome).toContain(opts.profileRoot);
  expect(await readdir(facts.cwd)).toEqual([]);
  await runtime.stop(); expect(await readdir(opts.profileRoot)).toEqual([]);
});
it('prevents two hosts from owning the same profile and releases only its own lock', async () => {
  const opts = await options(); const first = await startContentRuntime(opts); cleanup.push(() => first.stop());
  let error: unknown;
  try { const second = await startContentRuntime(opts); cleanup.push(() => second.stop()); } catch (e) { error = e; }
  expect(error).toBeInstanceOf(Error); expect((error as Error).message).toBe('CONTENT_PROFILE_BUSY');
  await first.stop();
  const third = await startContentRuntime(opts); cleanup.push(() => third.stop());
});
it('rejects a different CLI version before service launch and cleans failed startup artifacts', async () => {
  const opts = await options('9.9.9'); opts.startupTimeoutMs = 200;
  await expect(startContentRuntime(opts)).rejects.toThrow('CONTENT_RUNTIME_INCOMPATIBLE');
  expect(await readdir(opts.profileRoot)).toEqual([]);
});
