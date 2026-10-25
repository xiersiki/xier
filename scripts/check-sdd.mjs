#!/usr/bin/env node
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';

const isDoc = file => /^(?:README|AGENTS|CONTRIBUTING|CHANGELOG|SECURITY|LICENSE)(?:\.md)?$/i.test(file) || /^(?:docs|site)\/.*\.md$/.test(file) || /^\.agents\/skills\/.*(?:\.md|\.openspec-target)$/.test(file);
const isConfig = file => /^(?:package(?:-lock)?\.json|site\/package(?:-lock)?\.json|\.nvmrc|\.gitignore|\.npmrc|\.github\/.*\.ya?ml|openspec\/config\.ya?ml|openspec\/specs\/.*\.md)$/.test(file);

function validateChange(dir) {
  for (const name of ['proposal.md', 'design.md']) {
    if (!existsSync(`${dir}${name}`) || !readFileSync(`${dir}${name}`, 'utf8').trim()) throw new Error(`Missing ${dir}${name}`);
  }
  const skipSpecs = existsSync(`${dir}.openspec.yaml`) && /^skip_specs:\s*true\s*(?:#.*)?$/m.test(readFileSync(`${dir}.openspec.yaml`, 'utf8'));
  if (!skipSpecs && (!existsSync(`${dir}specs`) || !readdirSync(`${dir}specs`, { recursive: true }).some(file => file.endsWith('spec.md')))) throw new Error(`Missing ${dir}specs`);
  const tasks = readFileSync(`${dir}tasks.md`, 'utf8');
  // Follow OpenSpec's CommonMark checkbox semantics; only x/X is complete.
  const markers = tasks.split('\n').flatMap(line => {
    const item = line.match(/^\s*(?:[-*+]|\d{1,9}[.)])\s*\[([^\]]*)\](.*)/);
    if (!item) return [];
    const marker = item[1].trim();
    if (marker.length > 1) return [];
    // A Markdown link is not a task; whitespace-only boxes still count.
    if (/^[([]/.test(item[2]) && (marker || !item[1])) return [];
    return [marker.toLowerCase()];
  });
  if (!markers.length || markers.some(marker => marker !== 'x')) throw new Error(`Incomplete ${dir}tasks.md`);
  const record = JSON.parse(readFileSync(`${dir}tdd.json`, 'utf8'));
  const fail = detail => { throw new Error(`${dir}tdd.json: ${detail}`); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  if (!Array.isArray(record.files) || record.files.some(file => !text(file) || isAbsolute(file) || file.includes('\\') || /[*?\[\]]/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..'))) fail('Invalid files: use exact repository-relative paths');
  if (record.version !== 1) fail('Unsupported version');
  const validateStage = (stage, name) => {
    if (!stage || !text(stage.command) || !text(stage.summary) || !text(stage.evidence) || !Number.isInteger(stage.exitCode) || (name === 'red' ? stage.exitCode < 1 || stage.exitCode > 125 : stage.exitCode !== 0)) fail(`Invalid ${name} evidence`);
    try {
      const location = resolve(dir, stage.evidence);
      const local = relative(realpathSync(dir), realpathSync(location));
      if (isAbsolute(stage.evidence) || stage.evidence.split(/[\\/]/).includes('..') || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local) || !statSync(location).isFile() || !readFileSync(location, 'utf8').trim()) fail('Invalid evidence path/content');
    } catch { fail(`Invalid evidence file: ${stage.evidence}`); }
  };
  if (record.mode === 'verification-only') {
    for (const file of record.files) if (!isDoc(file) && !isConfig(file) && !file.startsWith('openspec/changes/')) fail(`Behavior requires TDD: ${file}`);
    if (!text(record.reason) || !Array.isArray(record.checks) || !record.checks.length) fail('Missing verification reason/checks');
    record.checks.forEach(stage => validateStage(stage, 'verification'));
  } else {
    if (skipSpecs || record.mode !== 'red-green-refactor' || !text(record.seam) || !Array.isArray(record.cycles) || !record.cycles.length) fail('Missing red-green-refactor cycles/seam/specs');
    for (const cycle of record.cycles) {
      if (!text(cycle.scenario)) fail('Missing scenario');
      for (const name of ['red', 'green', 'refactor']) validateStage(cycle[name], name);
    }
  }
  return record.files;
}

try {
  if (process.argv.length !== 4 || process.argv[2] !== '--base') throw new Error('Usage: node scripts/check-sdd.mjs --base <git-ref>');
  let base;
  try {
    base = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${process.argv[3]}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { throw new Error(`Invalid base: ${process.argv[3]}`); }
  const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, '--'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const changes = [...new Set(files.map(file => file.match(/^openspec\/changes\/(?:archive\/[^/]+|(?!(?:archive)\/)[^/]+)\//)?.[0]).filter(Boolean))].filter(existsSync);
  const covered = new Set();
  for (const dir of changes) {
    for (const file of validateChange(dir)) covered.add(file);
  }
  for (const file of files.filter(file => !file.startsWith('openspec/changes/') && !isDoc(file))) {
    if (!covered.has(file)) throw new Error(`Uncovered file: ${file}`);
  }
  console.log('SDD/TDD gate passed');
} catch (error) {
  console.error(`SDD/TDD gate failed: ${error.message}`);
  process.exitCode = 1;
}
