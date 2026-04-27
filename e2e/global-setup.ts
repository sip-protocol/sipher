import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mintAdminJwt } from './fixtures/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ORIGIN = 'http://localhost:5173'
const BACKEND_BASE = 'http://localhost:3000'
const STORAGE_STATE_PATH = path.resolve(__dirname, './fixtures/storageState.json')

export default async function globalSetup(): Promise<void> {
  const keypairPath =
    process.env.E2E_ADMIN_KEYPAIR_PATH ?? '/Users/rector/Documents/secret/cipher-admin.json'

  if (!fs.existsSync(keypairPath)) {
    throw new Error(
      `E2E admin keypair not found at ${keypairPath}. Set E2E_ADMIN_KEYPAIR_PATH env var.`
    )
  }

  const { token, isAdmin, wallet } = await mintAdminJwt(keypairPath, BACKEND_BASE)
  if (!isAdmin) {
    throw new Error(`Minted JWT for ${wallet} is not admin. Check AUTHORIZED_WALLETS env.`)
  }

  const zustandPayload = {
    state: { token, isAdmin },
    version: 0,
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_ORIGIN,
        localStorage: [{ name: 'sipher-auth', value: JSON.stringify(zustandPayload) }],
      },
    ],
  }

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2))
  console.log(`[e2e] storageState written (wallet=${wallet}, isAdmin=${isAdmin})`)
}
