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
<body class="bg-gray-950 text-gray-100 min-h-screen p-6">
  ${body}
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  sessions: { total: number }
  audit: { total: number; byAction: Record<string, number> }
  paymentLinks: { total: number; pending: number; paid: number; expired: number; cancelled: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page renderers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the admin login page.
 * Optionally shows an error message on failed auth attempts.
 */
export function renderLoginPage(error?: string): string {
  const errorHtml = error
    ? `<div class="bg-red-900/40 border border-red-700/60 rounded-lg px-4 py-3 mb-4">
        <p class="text-red-300 text-sm">${escapeHtml(error)}</p>
      </div>`
    : ''

  const body = `
<div class="min-h-screen flex items-center justify-center">
  <div class="w-full max-w-sm">

    <!-- Card -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
            🔐
          </div>
          <div>
            <h1 class="text-white font-bold text-lg leading-tight">Sipher Admin</h1>
            <p class="text-indigo-200 text-xs">Restricted access</p>
          </div>
        </div>
      </div>

      <!-- Login form -->
      <form method="POST" action="/admin/login" class="px-6 py-6 space-y-4">
        ${errorHtml}
        <div>
          <label for="password" class="block text-sm font-medium text-gray-400 mb-1">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-600"
            placeholder="Enter admin password"
          />
        </div>
        <button
          type="submit"
          class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Sign In
        </button>
      </form>

    </div>

  </div>
</div>`

  return baseHtml('Admin Login — Sipher', body)
}

/**
 * Render the admin dashboard with live stats.
 * All dynamic values are XSS-escaped before injection.
 */
export function renderDashboardPage(stats: DashboardStats): string {
  // Build action breakdown table rows
  const actionEntries = Object.entries(stats.audit.byAction)
  const actionRows = actionEntries.length > 0
    ? actionEntries
        .sort(([, a], [, b]) => b - a)
        .map(([action, count]) => `
          <tr class="border-t border-gray-800 hover:bg-gray-800/40 transition-colors">
            <td class="px-4 py-3 text-sm font-mono text-indigo-300">${escapeHtml(action)}</td>
            <td class="px-4 py-3 text-sm text-gray-200 text-right">${escapeHtml(String(count))}</td>
          </tr>`)
        .join('')
    : `<tr class="border-t border-gray-800">
        <td colspan="2" class="px-4 py-6 text-sm text-gray-600 text-center">No activity in the last 24 hours</td>
      </tr>`

  const body = `
<div class="max-w-5xl mx-auto">

  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold text-white">Sipher Dashboard</h1>
      <p class="text-gray-500 text-sm mt-0.5">Admin overview</p>
    </div>
    <form method="POST" action="/admin/logout">
      <button
        type="submit"
        class="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
      >
        Logout
      </button>
    </form>
  </div>

  <!-- Stat cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

    <!-- Sessions card -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p class="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Sessions</p>
      <p class="text-3xl font-bold text-white">${escapeHtml(String(stats.sessions.total))}</p>
      <p class="text-gray-600 text-xs mt-1">Total wallets seen</p>
    </div>

    <!-- Transactions card -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p class="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Transactions (24h)</p>
      <p class="text-3xl font-bold text-white">${escapeHtml(String(stats.audit.total))}</p>
      <p class="text-gray-600 text-xs mt-1">Audit log entries</p>
    </div>

    <!-- Payment links card -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p class="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Payment Links</p>
      <p class="text-3xl font-bold text-white">${escapeHtml(String(stats.paymentLinks.total))}</p>
      <div class="flex items-center gap-3 mt-2 text-xs">
        <span class="text-amber-400">${escapeHtml(String(stats.paymentLinks.pending))} pending</span>
        <span class="text-green-400">${escapeHtml(String(stats.paymentLinks.paid))} paid</span>
        <span class="text-gray-600">${escapeHtml(String(stats.paymentLinks.expired))} expired</span>
      </div>
    </div>

  </div>

  <!-- Action breakdown table -->
  <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-800">
      <h2 class="text-sm font-semibold text-gray-200">Action Breakdown (24h)</h2>
    </div>
    <table class="w-full">
      <thead>
        <tr class="text-xs text-gray-500 uppercase tracking-wider">
          <th class="px-4 py-3 text-left font-medium">Action</th>
          <th class="px-4 py-3 text-right font-medium">Count</th>
        </tr>
      </thead>
      <tbody>
        ${actionRows}
      </tbody>
    </table>
  </div>

</div>`

  return baseHtml('Sipher Dashboard', body)
}
