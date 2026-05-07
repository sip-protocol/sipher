// Legacy export kept so any straggler importer still resolves cleanly.
// New code should pull useAuthState from './useAuthState' directly.
export { useAuthSyncContext as useAuth } from '../providers/AuthSyncProvider'
