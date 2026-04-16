/**
 * Authority-signed refund via sipher_vault program.
 *
 * v1 scope: stub that throws unless overridden by a real SDK integration in
 * subsequent work. Unit tests mock this module. Production wiring will load
 * a keypair from env and submit a sipher_vault.refund ix signed by the
 * authority. Keeping it isolated here lets the plan and tests land without
 * blocking on SDK plumbing.
 */
export async function performVaultRefund(
  pda: string,
  amount: number,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  void pda
  void amount
  throw new Error('performVaultRefund not wired — configure authority keypair + SDK integration')
}

/**
 * Emit a loud startup warning when the vault refund stub is active in a
 * production context where it would actually be invoked (spec §9.4 guard).
 *
 * Conditions for warning:
 *   - NODE_ENV === 'production'
 *   - SENTINEL_MODE is not 'off' (refunds can fire)
 *   - SENTINEL_VAULT_REFUND_WIRED !== 'true' (integration not yet shipped)
 *
 * Set SENTINEL_VAULT_REFUND_WIRED=true once the SDK integration replaces this
 * stub, or run with SENTINEL_MODE=off to suppress during staging.
 */
export function assertVaultRefundWired(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const sentinelMode = process.env.SENTINEL_MODE ?? 'advisory'
  const wired = process.env.SENTINEL_VAULT_REFUND_WIRED === 'true'

  if (isProduction && sentinelMode !== 'off' && !wired) {
    console.warn(
      '[SENTINEL] performVaultRefund is a stub; refunds will throw at runtime.\n' +
      'Set SENTINEL_VAULT_REFUND_WIRED=true once the SDK integration ships,\n' +
      'or run with SENTINEL_MODE=off until then.',
    )
  }
}
