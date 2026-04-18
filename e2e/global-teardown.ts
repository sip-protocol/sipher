import fs from 'node:fs'
import path from 'node:path'

const PATHS_TO_CLEAN = [
  path.resolve(__dirname, './fixtures/storageState.json'),
  path.resolve(__dirname, './test.db'),
  path.resolve(__dirname, './test.db-journal'),
]

export default async function globalTeardown(): Promise<void> {
  for (const p of PATHS_TO_CLEAN) {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}
