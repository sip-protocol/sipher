import { Router } from 'express'
import healthRouter from './health.js'
import stealthRouter from './stealth.js'
import commitmentRouter from './commitment.js'
import transferRouter from './transfer.js'
import scanRouter from './scan.js'
import viewingKeyRouter from './viewing-key.js'
import errorsRouter from './errors.js'
import privacyRouter from './privacy.js'
import rpcRouter from './rpc.js'

const router = Router()

router.use(healthRouter)
router.use(stealthRouter)
router.use(commitmentRouter)
router.use(transferRouter)
router.use(scanRouter)
router.use(viewingKeyRouter)
router.use(errorsRouter)
router.use(privacyRouter)
router.use(rpcRouter)

export default router
