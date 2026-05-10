import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  it('renders trigger element', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument()
  })

  it('does not show tooltip content by default', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip on mouseEnter', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful info')
  })

  it('hides tooltip on mouseLeave', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip on focus', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful info')
  })

  it('hides tooltip on blur', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button'))
    fireEvent.blur(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('sets aria-describedby on trigger when shown', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    const trigger = screen.getByRole('button')
    const tooltip = screen.getByRole('tooltip')
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)
  })

  it('hides tooltip on Escape key', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('toggles tooltip on click (touch + keyboard activation)', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    // open
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful info')
    // close
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
