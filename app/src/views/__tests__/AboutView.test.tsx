import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AboutView from '../AboutView'

function renderAbout() {
  return render(
    <MemoryRouter>
      <AboutView />
    </MemoryRouter>,
  )
}

describe('AboutView', () => {
  it('renders the hero h1', () => {
    renderAbout()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('mentions both wallet and agent identities', () => {
    renderAbout()
    expect(screen.getAllByText(/wallet/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/agent/i).length).toBeGreaterThan(0)
  })

  it('renders Open SIPHER link to /', () => {
    renderAbout()
    const link = screen.getByRole('link', { name: /open sipher/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders docs link with target=_blank', () => {
    renderAbout()
    const link = screen.getByRole('link', { name: /read the docs/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('docs.sip-protocol.org'))
    expect(link).toHaveAttribute('target', '_blank')
  })
})

describe('AboutView body content', () => {
  it('contains the positioning tagline with 9+ chains', () => {
    renderAbout()
    expect(
      screen.getByText(
        /Multi-chain privacy command center for shielded transfers across 9\+ chains\./,
      ),
    ).toBeInTheDocument()
  })

  it('mentions stealth addresses and Pedersen commitments as privacy primitives', () => {
    renderAbout()
    const body = screen.getByTestId('about-view').textContent ?? ''
    expect(/stealth addresses?/i.test(body)).toBe(true)
    expect(/Pedersen commitments?/i.test(body)).toBe(true)
    expect(/viewing keys?/i.test(body)).toBe(true)
  })

  it('mentions HERALD and SENTINEL agent components', () => {
    renderAbout()
    const body = screen.getByTestId('about-view').textContent ?? ''
    expect(/HERALD/.test(body)).toBe(true)
    expect(/SENTINEL/.test(body)).toBe(true)
  })

  it('renders a ROADMAP link', () => {
    renderAbout()
    const link = screen.getByRole('link', { name: /roadmap/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('ROADMAP'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
