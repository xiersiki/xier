import { execFileSync } from 'node:child_process';

try {
  const args = process.argv.slice(2);
  if (![2, 3].includes(args.length) || args[0] !== '--base' || !args[1] || (args.length === 3 && args[2] !== '--full')) {
    throw new Error('Usage: node scripts/ci-scope.mjs --base <git-ref> [--full]');
  }
  const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const base = git('rev-parse', '--verify', '--end-of-options', `${args[1]}^{commit}`).trim();
  const files = git('diff', '--name-only', '--no-renames', '-z', base, '--').split('\0').filter(Boolean);
  const scope = { app: false, site: false, desktop: false };
  for (const file of files) {
    if (/^(README|AGENTS|CONTRIBUTING|CHANGELOG|SECURITY|LICENSE)(\.md)?$/.test(file)
      || /^docs\/.*\.md$/.test(file)
      || /^openspec\/.*\.(md|yaml|yml|json|txt)$/.test(file)
      || /^\.agents\/skills\/.*(\.md|\.openspec-target)$/.test(file)) continue;
    if (/^tests\/(ci-scope|spec-workflow)\.test\.ts$/.test(file)) {
      Object.assign(scope, { app: true, site: true, desktop: true }); continue;
    }
    if (/^renderer\/components\/.*\.(vue|ts|css)$/.test(file)
      || /^renderer\/hooks\/use(FontSize|NaiveLocale|ThemeMode|PrimaryColor|TimeAgo|NaiveTheme)\.ts$/.test(file)
      || file === 'renderer/index.css'
      || /^locales\/.*\.(json|ts)$/.test(file)
      || /^tests\/[^/]+\.test\.ts$/.test(file)) {
      scope.app = true; continue;
    }
    if (file.startsWith('site/')) { scope.site = true; continue; }
    Object.assign(scope, { app: true, site: true, desktop: true });
  }
  if (args[2] === '--full') Object.assign(scope, { app: true, site: true, desktop: true });
  process.stdout.write(`${JSON.stringify(scope)}\n`);
} catch (error) {
  console.error(`CI scope failed: ${error.message}`);
  process.exitCode = 1;
}
