import { Router } from 'express'
import { getPaymentLink, markPaymentLinkPaid } from '../db.js'
import {
  renderPaymentPage,
  renderExpiredPage,
  renderPaidPage,
  renderNotFoundPage,
} from '../views/pay-page.js'

export const payRouter = Router()

payRouter.get('/:id', (req, res) => {
  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).type('html').send(renderNotFoundPage())
    return
  }

  if (link.status === 'paid' && link.paid_tx) {
    res.type('html').send(renderPaidPage(link.paid_tx))
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).type('html').send(renderExpiredPage())
    return
  }

  res.type('html').send(renderPaymentPage(link))
})

payRouter.post('/:id/confirm', (req, res) => {
  const { txSignature } = req.body

  if (!txSignature || typeof txSignature !== 'string') {
    res.status(400).json({ error: 'txSignature is required' })
    return
  }

  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' })
    return
  }

  if (link.status === 'paid') {
    res.status(409).json({ error: 'Payment link already paid' })
    return
  }

  markPaymentLinkPaid(req.params.id, txSignature)
  res.json({ success: true, message: 'Payment confirmed' })
})
