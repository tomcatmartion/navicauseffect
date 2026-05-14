/**
 * Hybrid 集成自检：委托 Vitest（避免 tsx 直拉 `server-only` 依赖链）
 * 用法：pnpm exec tsx scripts/test-hybrid-pipeline.ts
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'src/lib/ziwei/hybrid/__tests__/hybrid-modules.test.ts'],
  { cwd: root, stdio: 'inherit', shell: true },
)
process.exit(typeof r.status === 'number' && r.status !== null ? r.status : 1)
