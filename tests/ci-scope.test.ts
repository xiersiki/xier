// @vitest-environment node
import { afterEach, expect, test } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const cli = resolve('scripts/ci-scope.mjs');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function repo(initial: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xier-ci-'));
  roots.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  const put = (path: string, content = 'changed') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  Object.entries(initial).forEach(([path, content]) => put(path, content));
  git('add', '-A');
  git('commit', '-qm', 'baseline', '--allow-empty');
  const base = git('rev-parse', 'HEAD');
  const run = (args = ['--base', base]) => {
    git('add', '-A');
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr, stdout: result.stdout };
  };
  return { root, base, git, put, run };
}
function selection(r: ReturnType<typeof repo>, args?: string[]) {
  const result = r.run(args);
  expect(result.status, result.output).toBe(0);
  return JSON.parse(result.stdout);
}

test('文档与规格证据不触发应用、站点或桌面构建', () => {
  const r = repo();
  r.put('README.md');
  r.put('openspec/changes/fix/evidence/red.txt');
  expect(selection(r)).toEqual({ app: false, site: false, desktop: false });
});

test('站点页面与构建配置仅选择站点检查', () => {
  const r = repo();
  r.put('site/guide/getting-started.md');
  r.put('site/.vitepress/config.mts');
  expect(selection(r)).toEqual({ app: false, site: true, desktop: false });
});

test('普通界面修复及其回归只选择应用检查', () => {
  const r = repo();
  r.put('renderer/components/MessageList.vue');
  r.put('renderer/hooks/useThemeMode.ts');
  r.put('tests/chat.test.ts');
  r.put('locales/zh-CN.json');
  expect(selection(r)).toEqual({ app: true, site: false, desktop: false });
});

test('显式完整运行不能因文档差异而跳过检查', () => {
  const r = repo();
  r.put('README.md');
  expect(selection(r, ['--base', r.base, '--full'])).toEqual({ app: true, site: true, desktop: true });
});

const resultsCli = resolve('scripts/check-ci-results.mjs');
function checkResults(needs: unknown) {
  const result = spawnSync(process.execPath, [resultsCli], { encoding: 'utf8', env: { ...process.env, CI_NEEDS: JSON.stringify(needs) } });
  return { status: result.status, output: result.stdout + result.stderr };
}
function siteResults() {
  return {
    scope: { result: 'success', outputs: { app: 'false', site: 'true', desktop: 'false' } },
    spec: { result: 'success' }, app: { result: 'skipped' },
    site: { result: 'success' }, desktop: { result: 'skipped' },
  };
}

test('required 允许明确无需运行的检查跳过', () => {
  const result = checkResults(siteResults());
  expect(result.status, result.output).toBe(0);
});

test.each(['failure', 'cancelled', 'skipped', undefined])('required 拒绝必选检查的 %s 结果', result => {
  const needs = siteResults();
  needs.site.result = result as string;
  const checked = checkResults(needs);
  expect(checked.status).toBe(1);
  expect(checked.output).toContain('site:');
});

test('required 拒绝分类、规格失败与无效范围，不把未知状态视为无需运行', () => {
  for (const job of ['scope', 'spec'] as const) {
    const needs = siteResults();
    needs[job].result = 'failure';
    expect(checkResults(needs).status).toBe(1);
  }
  const needs = siteResults();
  needs.scope.outputs.app = '';
  expect(checkResults(needs).status).toBe(1);
  expect(checkResults(null).status).toBe(1);
  expect(checkResults({}).status).toBe(1);
});

test('required 接受完整成功，也不掩盖未选中检查的异常失败', () => {
  const needs = siteResults();
  needs.scope.outputs = { app: 'true', site: 'true', desktop: 'true' };
  needs.app.result = needs.desktop.result = 'success';
  expect(checkResults(needs).status).toBe(0);
  const unexpectedFailure = siteResults();
  unexpectedFailure.app.result = 'failure';
  expect(checkResults(unexpectedFailure).status).toBe(1);
});

test.each([
  'main/index.ts', 'preload.ts', 'common/ipc.ts', 'renderer/services/sync.ts',
  'renderer/stores/auth.ts', 'renderer/dataBase.ts', 'renderer/views/login.vue',
  'renderer/hooks/useConfig.ts', 'supabase/migrations/change.sql', 'public/loading.html',
  'package-lock.json', '.nvmrc', 'forge.config.ts', '.github/workflows/ci.yml',
  'scripts/ci-scope.mjs', 'tests/ci-scope.test.ts', 'tests/spec-workflow.test.ts',
  'tests/packaged/loading-asset.mjs', 'future/unknown.ts', 'docs/auth-redirect.html',
])('高风险或未分类路径保守完整执行：%s', path => {
  const r = repo(); r.put(path);
  expect(selection(r)).toEqual({ app: true, site: true, desktop: true });
});

test('混合改动取并集，仓库文档不能盖掉应用或站点检查', () => {
  const r = repo();
  r.put('README.md'); r.put('site/index.md'); r.put('renderer/components/MessageList.vue');
  expect(selection(r)).toEqual({ app: true, site: true, desktop: false });
});

test('删除与改名为文档仍保留旧路径的高风险检查', () => {
  for (const rename of [false, true]) {
    const r = repo({ 'main/risky.ts': 'original' });
    if (rename) renameSync(join(r.root, 'main/risky.ts'), join(r.root, 'README.md'));
    else rmSync(join(r.root, 'main/risky.ts'));
    expect(selection(r)).toEqual({ app: true, site: true, desktop: true });
  }
});

test('空 diff 可跳过构建，但无效 base 或参数不能当作无改动', () => {
  const r = repo();
  expect(selection(r)).toEqual({ app: false, site: false, desktop: false });
  for (const args of [[], ['--base', 'missing'], ['--base', '--help'], ['--base', r.base, '--skip']]) {
    const result = r.run(args);
    expect(result.status).toBe(1);
    expect(result.output).toContain('CI scope failed:');
  }
});

test('比较包含未暂存的已跟踪修改，并安全处理特殊文件名', () => {
  const r = repo({ 'main/risky.ts': 'original' });
  r.put('main/risky.ts', 'modified');
  const result = spawnSync(process.execPath, [cli, '--base', r.base], { cwd: r.root, encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ app: true, site: true, desktop: true });
  r.put('unknown/line\napp=false.ts');
  expect(selection(r)).toEqual({ app: true, site: true, desktop: true });
});
