import { Router } from 'express'
import { loadNetworkConfig } from '../config/network.js'

export const configRouter = Router()

configRouter.get('/', (_req, res) => {
  // CRITICAL: explicit whitelist of fields exposed to the UI. NEVER include
  // rpcUrl or anything derived from SIPHER_HELIUS_API_KEY — that key stays
  // server-side only. Adding a field here is a deliberate choice, reviewed.
  try {
    const cfg = loadNetworkConfig()
    res.json({
      network: cfg.network,
      clusterName: cfg.clusterName,
      publicRpcUrl: cfg.publicRpcUrl,
      programIds: cfg.programIds,
      vaultConfig: cfg.vaultConfig,
      beta: cfg.beta,
      solscanSuffix: cfg.solscanSuffix,
    })
  } catch {
    // Boot validation already runs loadNetworkConfig() at agent startup,
    // so this branch is reached only if env vars are mutated post-boot —
    // exotic but defensible. Never leak FATAL message contents to clients.
    res.status(500).json({ error: 'server configuration error' })
  }
})
