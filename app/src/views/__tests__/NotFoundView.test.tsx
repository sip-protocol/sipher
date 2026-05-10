import { render, screen } from '@testing-library/react'
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
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
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
})
