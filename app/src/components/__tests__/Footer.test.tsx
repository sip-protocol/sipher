import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from '../Footer'

describe('Footer', () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
  }

  it('renders docs link with target=_blank + rel=noopener', () => {
    renderFooter()
    const link = screen.getByRole('link', { name: /docs/i })
    expect(link).toHaveAttribute('href', 'https://docs.sip-protocol.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders blog, github, x, sip-protocol links', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: /blog/i })).toHaveAttribute('href', 'https://blog.sip-protocol.org')
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute('href', 'https://github.com/sip-protocol/sipher')
    expect(screen.getByRole('link', { name: /^x$|twitter|x \(/i })).toHaveAttribute('href', expect.stringMatching(/x\.com/))
    expect(screen.getByRole('link', { name: /sip-protocol\.org/i })).toHaveAttribute('href', 'https://sip-protocol.org')
  })

  it('renders copyright', () => {
    renderFooter()
    expect(screen.getByText(/© 2026 SIP Labs/i)).toBeInTheDocument()
  })
})
