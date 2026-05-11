import { useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'

/**
 * DemoCtaCard — unauthed-Dashboard CTA inviting visitors to preview the
 * populated /demo experience without committing a wallet. Rendered above
 * the empty PrivacyGraph slot on DashboardView when status !== 'authed'.
 *
 * The "link" is a click-handled anchor (not Link) so we can keep the
 * navigation gesture observable via the mocked useNavigate hook in tests.
 * `href="/demo"` preserves middle-click + accessibility semantics.
 */
export default function DemoCtaCard() {
  const navigate = useNavigate()

  return (
    <div
      data-testid="demo-cta-card"
      className="rounded-lg border border-line bg-glass-1 p-5 text-center"
    >
      <p className="text-sm text-text-secondary mb-3">Curious how it looks populated?</p>
      <a
        role="link"
        href="/demo"
        onClick={(e) => {
          e.preventDefault()
          navigate('/demo')
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline cursor-pointer"
      >
        View sample dashboard
        <ArrowRight size={14} weight="bold" />
      </a>
    </div>
  )
}
