import { PrivacyBackendRegistry, SIPNativeBackend } from '@sip-protocol/sdk'

let registry: PrivacyBackendRegistry | null = null

export function getBackendRegistry(): PrivacyBackendRegistry {
  if (!registry) {
    registry = new PrivacyBackendRegistry({ enableHealthTracking: true })
    registry.register(new SIPNativeBackend(), { priority: 100, enabled: true })
  }
  return registry
}

export function resetBackendRegistry(): void {
  if (registry) registry.clear()
  registry = null
}
