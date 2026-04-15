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
