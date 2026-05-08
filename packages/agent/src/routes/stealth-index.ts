import { Router, Request, Response } from 'express'

export const stealthIndexRouter = Router()

interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

stealthIndexRouter.get('/index', (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'auth middleware did not attach wallet' },
    })
    return
  }

  // Stub tree -- real derivation lands when the SDK viewing-key index is wired.
  // For now return the wallet itself as the root node so the FE Privacy Graph
  // can render a one-node tree without throwing on missing data.
  const tree: StealthNode[] = [
    {
      index: 0,
      derivationPath: "m/0'",
      stealthAddress: wallet,
      parentIndex: null,
      createdAt: new Date().toISOString(),
    },
  ]

  res.json({ tree, rootWallet: wallet })
})
