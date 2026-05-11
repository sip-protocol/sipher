import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DemoCtaCard from '../DemoCtaCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockReset()
})

describe('<DemoCtaCard />', () => {
  it('renders the CTA copy and link', () => {
    render(
      <MemoryRouter>
        <DemoCtaCard />
      </MemoryRouter>,
    )
    expect(screen.getByText(/curious how it looks populated/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view sample dashboard/i })).toBeInTheDocument()
  })

  it('navigates to /demo when the CTA is clicked', () => {
    render(
      <MemoryRouter>
        <DemoCtaCard />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: /view sample dashboard/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/demo')
  })
})
