import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PrivacyPreviewPanel } from '../PrivacyPreviewPanel'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'test-token' }),
}))

import { apiFetch } from '../../../api/client'

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
})

const fakeResponse = {
  data: {
    address: 'C1phr...85N',
    score: 68,
    grade: 'C',
    transactionsAnalyzed: 50,
    factors: {
      addressReuse: { score: 70, detail: '40 unique counterparties across 50 txs' },
      amountPatterns: { score: 80, detail: 'No round amount patterns' },
      timingCorrelation: { score: 75, detail: 'No periodic transfers' },
      counterpartyExposure: { score: 60, detail: '2 known programs' },
    },
    recommendations: [],
    projected: {
      score: 78,
      grade: 'B',
      factors: {
        addressReuse: { score: 78, detail: '41 unique counterparties' },
        amountPatterns: { score: 80, detail: 'No round patterns' },
        timingCorrelation: { score: 75, detail: 'No periodic transfers' },
        counterpartyExposure: { score: 80, detail: '2 known programs' },
      },
      delta: {
        score: 10,
        addressReuse: 8,
        amountPatterns: 0,
        timingCorrelation: 0,
        counterpartyExposure: 20,
      },
    },
  },
}

describe('PrivacyPreviewPanel', () => {
  it('renders side-by-side gauges (NOW + PROJECTED) when projected data lands', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeResponse)
    render(
      <PrivacyPreviewPanel
        address="C1phr...85N"
        projectedAmount={1.5}
        projectedToken="SOL"
        debounceMs={0}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('68')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
    })
    expect(screen.getByText(/NOW/i)).toBeInTheDocument()
    expect(screen.getByText(/PROJECTED/i)).toBeInTheDocument()
  })

  it('renders factor delta values with sign prefix', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeResponse)
    render(
      <PrivacyPreviewPanel
        address="C1phr...85N"
        projectedAmount={1.5}
        projectedToken="SOL"
        debounceMs={0}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/\+8/)).toBeInTheDocument()
      expect(screen.getByText(/\+20/)).toBeInTheDocument()
    })
  })

  it('renders empty-state copy when projectedAmount is 0', () => {
    render(
      <PrivacyPreviewPanel address="C1phr...85N" projectedAmount={0} projectedToken="SOL" />
    )
    expect(screen.getByText(/enter an amount/i)).toBeInTheDocument()
  })

  it('handles already-at-100 case with explicit copy', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        ...fakeResponse.data,
        score: 100,
        projected: {
          ...fakeResponse.data.projected,
          score: 100,
          delta: {
            score: 0,
            addressReuse: 0,
            amountPatterns: 0,
            timingCorrelation: 0,
            counterpartyExposure: 0,
          },
        },
      },
    })
    render(
      <PrivacyPreviewPanel
        address="C1phr...85N"
        projectedAmount={1}
        projectedToken="SOL"
        debounceMs={0}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/already at maximum/i)).toBeInTheDocument()
    })
  })

  it('handles no-history case with explicit copy', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        ...fakeResponse.data,
        transactionsAnalyzed: 0,
        projected: {
          ...fakeResponse.data.projected,
          delta: {
            score: 0,
            addressReuse: 0,
            amountPatterns: 0,
            timingCorrelation: 0,
            counterpartyExposure: 0,
          },
        },
      },
    })
    render(
      <PrivacyPreviewPanel
        address="C1phr...85N"
        projectedAmount={1}
        projectedToken="SOL"
        debounceMs={0}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/no prior history/i)).toBeInTheDocument()
    })
  })

  it('aborts in-flight fetch when unmounted before fetch resolves', async () => {
    // Make apiFetch hang indefinitely and reject only when its signal aborts —
    // this lets us unmount mid-flight and assert the cleanup contract: the
    // controller stored in abortRef MUST be aborted on unmount, otherwise
    // setData would fire on a torn-down component.
    ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_path: string, opts?: RequestInit & { token?: string }) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
    )

    const { unmount } = render(
      <PrivacyPreviewPanel
        address="C1phr...85N"
        projectedAmount={1}
        projectedToken="SOL"
        debounceMs={0}
      />
    )

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1)
    })

    const callArgs = (apiFetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const opts = callArgs[1] as RequestInit
    expect(opts.signal?.aborted).toBe(false)

    unmount()

    expect(opts.signal?.aborted).toBe(true)
  })
})
