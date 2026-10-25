// @vitest-environment node
import { afterEach, expect, test } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const cli = resolve('scripts/check-sdd.mjs');
const repos: string[] = [];
afterEach(() => repos.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'xier-spec-'));
  repos.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('commit', '-qm', 'baseline', '--allow-empty');
  const base = git('rev-parse', 'HEAD');
  const put = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const run = (ref = base) => {
    git('add', '-A');
    const result = spawnSync(process.execPath, [cli, '--base', ref], { cwd: root, encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { root, base, git, put, run };
}
function change(r: ReturnType<typeof repo>, files = ['main/feature.ts']) {
  const dir = 'openspec/changes/example';
  r.put(`${dir}/proposal.md`, '# Why\nA useful behavior.');
  r.put(`${dir}/design.md`, '# Design\nTest the public boundary.');
  r.put(`${dir}/tasks.md`, '- [x] 1. Deliver the behavior\n');
  r.put(`${dir}/specs/feature/spec.md`, '## ADDED Requirements\n### Requirement: Behavior\nThe app SHALL respond.\n#### Scenario: Request\n- **WHEN** requested\n- **THEN** respond\n');
  r.put(`${dir}/evidence/red.txt`, 'expected 1, received 0; test failed\n');
  r.put(`${dir}/evidence/green.txt`, '1 test passed\n');
  r.put(`${dir}/evidence/refactor.txt`, '1 test passed after extraction\n');
  const stage = (name: string, exitCode: number) => ({ command: 'npm test', exitCode, evidence: `evidence/${name}.txt`, summary: `${name} result` });
  const record = { version: 1, files, mode: 'red-green-refactor', seam: 'public CLI', cycles: [{ scenario: 'Request responds', red: stage('red', 1), green: stage('green', 0), refactor: stage('refactor', 0) }] };
  const save = () => r.put(`${dir}/tdd.json`, JSON.stringify(record));
  save();
  files.forEach(file => r.put(file, 'changed\n'));
  return { dir, record, save };
}

test('完整行为交付通过公开 CLI', () => {
  const r = repo();
  change(r);
  const result = r.run();
  expect(result.status, result.output).toBe(0);
  expect(result.output).toContain('SDD/TDD gate passed');
});

test('行为文件没有本次 change 时失败', () => {
  const r = repo();
  r.put('main/feature.ts', 'changed');
  const result = r.run();
  expect(result.status, result.output).toBe(1);
  expect(result.output).toContain('Uncovered file: main/feature.ts');
});

test('缺失设计或行为规格会指出必需产物', () => {
  for (const file of ['design.md', 'specs/feature/spec.md', 'proposal.md']) {
    const r = repo(); const c = change(r);
    rmSync(join(r.root, c.dir, file));
    const result = r.run();
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(file === 'specs/feature/spec.md' ? 'specs' : file);
  }
});

test('未完成、空白或没有任务的交付失败', () => {
  for (const tasks of ['- [x] Done\n- [ ] Pending', '', '# Tasks\nLater']) {
    const r = repo(); const c = change(r);
    r.put(`${c.dir}/tasks.md`, tasks);
    const result = r.run();
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('tasks.md');
  }
});

test('缺少红绿重构阶段或错误结果会阻止交付', () => {
  const cases = [
    (c: ReturnType<typeof change>) => { delete (c.record.cycles[0] as any).red; },
    (c: ReturnType<typeof change>) => { c.record.cycles[0].red.exitCode = 0; },
    (c: ReturnType<typeof change>) => { c.record.cycles[0].green.exitCode = 1; },
    (c: ReturnType<typeof change>) => { c.record.cycles[0].refactor.summary = ''; },
    (c: ReturnType<typeof change>) => { c.record.cycles = []; },
  ];
  for (const invalidate of cases) {
    const r = repo(); const c = change(r); invalidate(c); c.save();
    const result = r.run();
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('tdd.json');
  }
});

test('证据必须是 change 内存在的非空文件，拒绝越界和符号链接', () => {
  for (const path of ['evidence/missing.txt', 'evidence/empty.txt', '../../outside.txt', 'evidence/link.txt']) {
    const r = repo(); const c = change(r);
    r.put('openspec/outside.txt', 'outside');
    r.put(`${c.dir}/evidence/empty.txt`, '');
    symlinkSync(join(r.root, 'openspec/outside.txt'), join(r.root, c.dir, 'evidence/link.txt'));
    c.record.files.push('openspec/outside.txt');
    c.record.cycles[0].red.evidence = path; c.save();
    const result = r.run();
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('evidence');
  }
});

test('纯说明文档不需要制造 TDD 记录', () => {
  const r = repo();
  r.put('README.md', '# Updated');
  r.put('docs/guide.md', '# Guide');
  r.put('site/guide/development.md', '# Development');
  const result = r.run();
  expect(result.status, result.output).toBe(0);
});

test('无行为变化的依赖更新可用有理由和证据的适用验证', () => {
  const r = repo(); const c = change(r, ['package.json', 'package-lock.json']);
  rmSync(join(r.root, c.dir, 'specs'), { recursive: true });
  r.put(`${c.dir}/.openspec.yaml`, 'schema: spec-driven\nskip_specs: true\n');
  r.put(`${c.dir}/tdd.json`, JSON.stringify({ version: 1, mode: 'verification-only', files: c.record.files, reason: 'Only dependency versions; no behavior contract change', checks: [c.record.cycles[0].green] }));
  const result = r.run();
  expect(result.status, result.output).toBe(0);
});

test('行为代码不能借 verification-only 豁免 TDD', () => {
  const r = repo(); const c = change(r);
  r.put(`${c.dir}/tdd.json`, JSON.stringify({ version: 1, mode: 'verification-only', files: c.record.files, reason: 'Claim config only', checks: [c.record.cycles[0].green] }));
  const result = r.run();
  expect(result.status, result.output).toBe(1);
  expect(result.output).toContain('Behavior requires TDD: main/feature.ts');
});

test('归档后继续检查同一份交付证据与主规格覆盖', () => {
  const r = repo(); const c = change(r, ['main/feature.ts', 'openspec/specs/feature/spec.md']);
  const archive = 'openspec/changes/archive/2026-10-25-example';
  mkdirSync(dirname(join(r.root, archive)), { recursive: true });
  renameSync(join(r.root, c.dir), join(r.root, archive));
  const result = r.run();
  expect(result.status, result.output).toBe(0);
  r.put(`${archive}/tasks.md`, '- [ ] incomplete');
  expect(r.run().status).toBe(1);
});

test('base 参数缺失或选项错误不能被当成空 diff 放行', () => {
  const r = repo();
  for (const args of [[], ['--wrong', r.base], ['--base', 'missing-ref']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: r.root, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Usage:|Invalid base/);
  }
});

test('files 记录必须是明确的相对路径数组', () => {
  const r = repo(); const c = change(r);
  r.put(`${c.dir}/tdd.json`, JSON.stringify({ ...c.record, files: ['main/feature.ts', '../outside', '*'] }));
  const result = r.run();
  expect(result.status, result.output).toBe(1);
  expect(result.output).toContain('Invalid files');
});

test('未触及的历史 change 不能覆盖新代码，遗漏或删除的文件也必须被声明', () => {
  const r = repo(); change(r);
  r.git('add', '-A'); r.git('commit', '-qm', 'old delivery');
  const base = r.git('rev-parse', 'HEAD');
  r.put('main/feature.ts', 'next behavior');
  expect(r.run(base).output).toContain('Uncovered file: main/feature.ts');
  r.put('renderer/extra.ts', 'extra');
  expect(r.run().output).toContain('Uncovered file: renderer/extra.ts');
  rmSync(join(r.root, 'main/feature.ts'));
  expect(r.run(base).output).toContain('Uncovered file: main/feature.ts');
});

test('记录的命令只作为数据，不执行 shell 文本', () => {
  const r = repo(); const c = change(r);
  c.record.cycles[0].green.command = 'exit 99; this-command-must-never-run'; c.save();
  expect(r.run().status).toBe(0);
});
