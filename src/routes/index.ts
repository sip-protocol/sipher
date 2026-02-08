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
import backendsRouter from './backends.js'
import proofsRouter from './proofs.js'
import rangeProofRouter from './range-proof.js'
import csplRouter from './cspl.js'
import privateTransferRouter from './private-transfer.js'
import arciumRouter from './arcium.js'
import incoRouter from './inco.js'
import privateSwapRouter from './private-swap.js'
import sessionRouter from './session.js'
import complianceRouter from './compliance.js'
import governanceRouter from './governance.js'
import jitoRouter from './jito.js'
import billingRouter from './billing.js'
import adminRouter from './admin.js'
import demoRouter from './demo.js'

const router = Router()

router.use(demoRouter)
router.use(healthRouter)
router.use(stealthRouter)
router.use(commitmentRouter)
router.use(transferRouter)
router.use(privateTransferRouter)
router.use(scanRouter)
router.use(viewingKeyRouter)
router.use(errorsRouter)
router.use(privacyRouter)
router.use(rpcRouter)
router.use(backendsRouter)
router.use(proofsRouter)
router.use(rangeProofRouter)
router.use(csplRouter)
router.use(arciumRouter)
router.use(incoRouter)
router.use(privateSwapRouter)
router.use(sessionRouter)
router.use(complianceRouter)
router.use(governanceRouter)
router.use(jitoRouter)
router.use(billingRouter)
router.use('/admin', adminRouter)

export default router
