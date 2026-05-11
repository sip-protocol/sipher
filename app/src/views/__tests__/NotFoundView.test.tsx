import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFoundView from '../NotFoundView'

describe('NotFoundView', () => {
  it('renders not-found title', () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    )
    // UnauthedEmptyState renders the title in an h2 (matching the design system)
    expect(screen.getByRole('heading', { level: 2, name: /not found/i })).toBeInTheDocument()
  })

  it('renders Back to Dashboard link to /', () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /back to dashboard/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders an h1 for the route page heading', () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: /not found/i }),
    ).toBeInTheDocument()
  })

  describe('SEO metadata', () => {
    it('renders SIPHER — Not found title', async () => {
      render(
        <MemoryRouter>
          <NotFoundView />
        </MemoryRouter>,
      )
      await waitFor(() => {
        expect(document.title).toBe('SIPHER — Not found')
      })
    })
  })
})
