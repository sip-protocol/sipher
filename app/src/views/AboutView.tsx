import { Link } from 'react-router-dom'

export default function AboutView() {
  return (
    <div data-testid="about-view" className="flex flex-col gap-12 max-w-4xl mx-auto py-8">
      <title>SIPHER — About</title>
      <meta name="description" content="About SIPHER — privacy primitives, multi-chain support, and dual-identity architecture." />
      <meta property="og:title" content="SIPHER — About" />
      <meta property="og:description" content="About SIPHER — privacy primitives, multi-chain support, and dual-identity architecture." />
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
          Privacy-by-default for Solana
        </h1>
        <p className="text-base text-text-secondary leading-relaxed">
          Multi-chain privacy command center for shielded transfers across 9+ chains.
        </p>
        <p className="text-sm text-text-secondary leading-relaxed">
          SIPHER is a wallet and an autonomous agent for shielded payments, swaps, and stealth-address management. Stealth output by default. Real Pedersen commitments. Multi-chain.
        </p>
        <div className="flex gap-3">
          <Link
            to="/"
            className="text-sm px-4 py-2 rounded-md text-bg font-semibold"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Open SIPHER
          </Link>
          <a
            href="https://docs.sip-protocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
          >
            Read the docs
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Privacy primitives</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          SIPHER combines three cryptographic primitives to deliver transaction privacy: <strong>stealth addresses</strong> (one-time recipient addresses that prevent linkability across payments), <strong>Pedersen commitments</strong> (homomorphic hiding of transfer amounts), and <strong>viewing keys</strong> (selective disclosure so auditors and compliance partners can verify activity without breaking the privacy guarantees for the rest of the network).
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-strong rounded-2xl p-6 flex flex-col gap-3">
          <div className="text-2xs text-cyan" style={{ letterSpacing: 'var(--tracking-widest)' }}>
            ◆ WALLET
          </div>
          <h2 className="text-lg font-semibold">Stealth-first wallet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Every received payment lands at a one-time stealth address. Viewing keys give selective disclosure for compliance. 9+ chains supported via cross-chain shielded transfers — Solana (native + L2s), Ethereum and its testnets (Sepolia, Arbitrum, Base, Optimism), and NEAR via Intents.
          </p>
        </div>
        <div className="glass-strong rounded-2xl p-6 flex flex-col gap-3">
          <div className="text-2xs text-violet" style={{ letterSpacing: 'var(--tracking-widest)' }}>
            ◇ AGENT
          </div>
          <h2 className="text-lg font-semibold">Autonomous co-pilot</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Each SIPHER user has two identities — a wallet they sign with, and an agent that acts on their behalf. <strong>HERALD</strong> responds to mentions on X. <strong>SENTINEL</strong> audits high-risk actions before they fire. <strong>Ask SIPHER</strong> chat handles privacy operations conversationally — deposits, swaps, sweeps, threat checks.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Architecture</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Anchor program on Solana mainnet. Pedersen commitments hide amounts. Stealth addresses hide recipients. Viewing keys preserve compliance. Read the <a href="https://docs.sip-protocol.org" target="_blank" rel="noopener noreferrer" className="text-cyan underline">technical docs</a> for the full breakdown.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Roadmap</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          See the public roadmap for current and upcoming milestones — same-chain Ethereum privacy in flight (M18), proof composition research and a denominated note mixer planned for late 2026.{' '}
          <a
            href="https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan underline"
          >
            View ROADMAP.md →
          </a>
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <a
          href="https://github.com/sip-protocol/sipher"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
        >
          Star on GitHub
        </a>
        <a
          href="https://x.com/SIPProtocol"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
        >
          Follow on X
        </a>
      </section>
    </div>
  )
}
