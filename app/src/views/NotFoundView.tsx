import { Link } from 'react-router-dom'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'

export default function NotFoundView() {
  return (
    <>
      <h1 className="sr-only">Not Found</h1>
      <UnauthedEmptyState
        title="Not found"
        body="We couldn't find that page."
        cta={
          <Link
            to="/"
            className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Back to Dashboard
          </Link>
        }
      />
    </>
  )
}
