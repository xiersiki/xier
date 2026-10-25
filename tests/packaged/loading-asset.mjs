import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import asar from '@electron/asar';

test('desktop package ships the loading page requested at startup', () => {
  const appDirectory = join('out', `Xier-${process.platform}-${process.arch}`);
  const resources = process.platform === 'darwin'
    ? join(appDirectory, 'Xier.app', 'Contents', 'Resources')
    : join(appDirectory, 'resources');
  const actual = asar.extractFile(join(resources, 'app.asar'), '.vite/build/loading.html');
  assert.deepEqual(actual, readFileSync('public/loading.html'));
});
