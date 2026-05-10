const LINKS = [
  { href: 'https://docs.sip-protocol.org', label: 'Docs' },
  { href: 'https://blog.sip-protocol.org', label: 'Blog' },
  { href: 'https://github.com/sip-protocol/sipher', label: 'GitHub' },
  { href: 'https://x.com/SIPProtocol', label: 'X' },
  { href: 'https://sip-protocol.org', label: 'sip-protocol.org' },
]

export function Footer() {
  return (
    <footer
      data-testid="app-footer"
      className="border-t border-line px-4 py-4 lg:px-6 flex flex-wrap items-center gap-4 text-2xs text-text-muted"
    >
      <nav className="flex flex-wrap gap-3">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <span className="ml-auto">© 2026 SIP Labs</span>
    </footer>
  )
}
