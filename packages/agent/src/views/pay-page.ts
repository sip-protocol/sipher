import type { PaymentLink } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// XSS prevention — escape all dynamic content before injecting into HTML
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────────────────────────────────────
// Base HTML wrapper with Tailwind CDN + dark theme
// ─────────────────────────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            accent: '#6366f1',
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center p-4">
  ${body}
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

function formatExpiry(expiresAt: number): string {
  const diffMs = expiresAt - Date.now()
  if (diffMs <= 0) return 'Expired'

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m`

  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ${diffHr % 24}h`
}

// ─────────────────────────────────────────────────────────────────────────────
// Page renderers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the main payment page for a pending payment link.
 * All dynamic content is XSS-escaped.
 */
export function renderPaymentPage(link: PaymentLink): string {
  const amountDisplay = link.amount !== null
    ? `${escapeHtml(String(link.amount))} ${escapeHtml(link.token)}`
    : `Any amount of ${escapeHtml(link.token)}`

  const memoHtml = link.memo
    ? `<p class="text-gray-400 text-sm mt-1">${escapeHtml(link.memo)}</p>`
    : ''

  const expiryLabel = formatExpiry(link.expires_at)
  const truncatedAddress = escapeHtml(truncateAddress(link.stealth_address))

  const body = `
<div class="w-full max-w-md">
  <!-- Card -->
  <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
          🔒
        </div>
        <div>
          <h1 class="text-white font-bold text-lg leading-tight">Sipher Private Payment</h1>
          <p class="text-indigo-200 text-xs">Powered by SIP Protocol</p>
        </div>
      </div>
    </div>

    <!-- Payment Details -->
    <div class="px-6 py-5 space-y-4">

      <!-- Amount -->
      <div class="text-center py-2">
        <p class="text-4xl font-bold text-white tracking-tight">${amountDisplay}</p>
        ${memoHtml}
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-800"></div>

      <!-- Stealth Address -->
      <div class="bg-gray-800/60 rounded-xl p-3">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Recipient (stealth address)</p>
        <p class="text-gray-300 font-mono text-sm break-all">${truncatedAddress}</p>
      </div>

      <!-- Privacy badge -->
      <div class="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/50 rounded-xl px-3 py-2">
        <span class="text-indigo-400 text-sm">🛡</span>
        <p class="text-indigo-300 text-xs font-medium">Privacy: Stealth address — unlinkable</p>
      </div>

      <!-- Expiry -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500">Expires in</span>
        <span class="text-amber-400 font-medium">${escapeHtml(expiryLabel)}</span>
      </div>

    </div>

    <!-- CTA -->
    <div class="px-6 pb-6">
      <button
        id="pay-btn"
        data-link-id="${escapeHtml(link.id)}"
        data-stealth-address="${escapeHtml(link.stealth_address)}"
        data-ephemeral-pubkey="${escapeHtml(link.ephemeral_pubkey)}"
        data-amount="${link.amount !== null ? escapeHtml(String(link.amount)) : ''}"
        data-token="${escapeHtml(link.token)}"
        data-expires-at="${escapeHtml(String(link.expires_at))}"
        class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-900/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        <span>Connect Wallet &amp; Pay</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

  </div>

  <!-- Footer -->
  <p class="text-center text-gray-600 text-xs mt-4">
    Powered by <a href="https://sip-protocol.org" class="text-indigo-500 hover:text-indigo-400 transition-colors">SIP Protocol</a>
    &mdash; The privacy standard for Web3
  </p>
</div>`

  return baseHtml('Sipher Private Payment', body)
}

/**
 * Render a 410 Gone page when the payment link has expired.
 */
export function renderExpiredPage(): string {
  const body = `
<div class="w-full max-w-md text-center">
  <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl px-8 py-10">
    <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
      ⌛
    </div>
    <h1 class="text-2xl font-bold text-white mb-2">Payment Link Expired</h1>
    <p class="text-gray-400 text-sm leading-relaxed">
      This payment link is no longer valid. Please request a new link from the sender.
    </p>
  </div>
  <p class="text-center text-gray-600 text-xs mt-4">
    Powered by <a href="https://sip-protocol.org" class="text-indigo-500 hover:text-indigo-400 transition-colors">SIP Protocol</a>
  </p>
</div>`

  return baseHtml('Payment Link Expired — Sipher', body)
}

/**
 * Render a confirmation page when the payment link has already been paid.
 * Shows a Solscan link for the confirming transaction.
 */
export function renderPaidPage(txSignature: string): string {
  const safeTx = escapeHtml(txSignature)
  const solscanUrl = `https://solscan.io/tx/${safeTx}`

  const body = `
<div class="w-full max-w-md text-center">
  <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl px-8 py-10">
    <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
      ✅
    </div>
    <h1 class="text-2xl font-bold text-white mb-2">Payment Completed</h1>
    <p class="text-gray-400 text-sm leading-relaxed mb-5">
      This payment has already been fulfilled. Thank you!
    </p>

    <div class="bg-gray-800/60 rounded-xl p-3 mb-4">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Transaction</p>
      <a
        href="${solscanUrl}"
        target="_blank"
        rel="noopener noreferrer"
        class="text-indigo-400 hover:text-indigo-300 font-mono text-xs break-all transition-colors"
      >${safeTx}</a>
    </div>

    <a
      href="${solscanUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      View on Solscan
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
    </a>
  </div>
  <p class="text-center text-gray-600 text-xs mt-4">
    Powered by <a href="https://sip-protocol.org" class="text-indigo-500 hover:text-indigo-400 transition-colors">SIP Protocol</a>
  </p>
</div>`

  return baseHtml('Payment Completed — Sipher', body)
}

/**
 * Render a 404 Not Found page for unknown payment link IDs.
 */
export function renderNotFoundPage(): string {
  const body = `
<div class="w-full max-w-md text-center">
  <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl px-8 py-10">
    <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
      🔍
    </div>
    <h1 class="text-2xl font-bold text-white mb-2">Payment Link Not Found</h1>
    <p class="text-gray-400 text-sm leading-relaxed">
      This payment link does not exist or has been removed. Please check the URL and try again.
    </p>
  </div>
  <p class="text-center text-gray-600 text-xs mt-4">
    Powered by <a href="https://sip-protocol.org" class="text-indigo-500 hover:text-indigo-400 transition-colors">SIP Protocol</a>
  </p>
</div>`

  return baseHtml('Not Found — Sipher', body)
}
