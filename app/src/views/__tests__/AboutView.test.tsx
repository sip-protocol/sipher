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
