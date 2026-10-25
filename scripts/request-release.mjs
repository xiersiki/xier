import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('package.json must contain a valid release version')
}
const result = spawnSync('gh', [
  'workflow', 'run', 'release.yml',
  '--repo', 'xiersiki/xier',
  '--ref', 'main',
  '--field', `version=${version}`,
], { stdio: 'inherit', shell: false })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
if (result.status === 0) {
  console.log('已请求可信 main 创建测试发布草稿。进度：https://github.com/xiersiki/xier/actions/workflows/release.yml')
}
