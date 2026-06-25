import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from '@solana/web3.js'
import {
  buildDepositSolTx, buildRefundSolTx, buildPrivateSendSolTx, DEFAULT_FEE_BPS,
} from '@sipher/sdk'
import { assembleWithdrawArtifacts } from './stealth.js'
import type {
  VaultPrivacyProvider, DepositResult, PrivateWithdrawResult, RefundResult, StealthMetaAddress,
} from './types.js'

/**
 * Reference privacy provider backed by the sipher vault (native SOL).
 *
 * Privacy model: commingling/decorrelation, NOT a cryptographic graph-break. The
 * shared depositor signature links the depositor to each payout on-chain; amounts
 * are visible (TIER_1). Unlinkability comes from many users sharing the depositor
 * + batching/jitter — supply ONE shared depositor keypair to every call.
 */
export class SipherVaultPrivacyProvider implements VaultPrivacyProvider {
  readonly feeBps: number

  constructor(private readonly connection: Connection, opts: { feeBps?: number } = {}) {
    this.feeBps = opts.feeBps ?? DEFAULT_FEE_BPS
  }

  private async signAndSubmit(tx: Transaction, signer: Keypair): Promise<string> {
    tx.sign(signer)
    const sig = await this.connection.sendRawTransaction(tx.serialize())
    await this.connection.confirmTransaction(sig, 'confirmed')
    return sig
  }

  async buildFundingTx(args: {
    fromPk: string; depositorPk: string; amountLamports: bigint; recentBlockhash: string
  }): Promise<Transaction> {
    const tx = new Transaction()
    tx.feePayer = new PublicKey(args.fromPk)
    tx.recentBlockhash = args.recentBlockhash
    tx.add(SystemProgram.transfer({
      fromPubkey: new PublicKey(args.fromPk),
      toPubkey: new PublicKey(args.depositorPk),
      lamports: args.amountLamports,
    }))
    return tx
  }

  async verifyFunding(args: {
    depositorPk: string; expectedLamports: bigint; txSignature: string
  }): Promise<void> {
    const tx = await this.connection.getTransaction(args.txSignature, {
      commitment: 'confirmed', maxSupportedTransactionVersion: 0,
    })
    if (!tx) throw new Error(`Funding transaction ${args.txSignature} not found or not yet confirmed`)
    if (tx.meta?.err) {
      throw new Error(`Funding transaction ${args.txSignature} failed: ${JSON.stringify(tx.meta.err)}`)
    }
    // NOTE: production should additionally assert the credited lamport delta on
    // depositorPk equals expectedLamports by inspecting tx.meta pre/post balances.
  }

  async deposit(args: { depositorKp: Keypair; lamports: bigint }): Promise<DepositResult> {
    const { transaction } = await buildDepositSolTx(
      this.connection,
      args.depositorKp.publicKey,
      args.lamports,
    )
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return { txSignature, depositedLamports: args.lamports }
  }

  async refund(args: { depositorKp: Keypair }): Promise<RefundResult> {
    const { transaction, refundAmount } = await buildRefundSolTx(
      this.connection,
      args.depositorKp.publicKey,
    )
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return { txSignature, refundedLamports: refundAmount }
  }

  previewWithdraw(grossLamports: bigint): { feeLamports: bigint; netLamports: bigint } {
    const feeLamports = (grossLamports * BigInt(this.feeBps)) / 10_000n
    return { feeLamports, netLamports: grossLamports - feeLamports }
  }

  async privateWithdraw(args: {
    depositorKp: Keypair; recipient: StealthMetaAddress; lamports: bigint
  }): Promise<PrivateWithdrawResult> {
    const a = assembleWithdrawArtifacts(args.recipient, args.lamports)
    const { transaction, netAmount, feeAmount, stealthAddress } = await buildPrivateSendSolTx({
      connection: this.connection,
      depositor: args.depositorKp.publicKey,
      amount: args.lamports,
      stealthPubkey: a.stealthPubkey,
      amountCommitment: a.amountCommitment,
      ephemeralPubkey: a.ephemeralPubkey,
      viewingKeyHash: a.viewingKeyHash,
      encryptedAmount: a.encryptedAmount,
      proof: a.proof,
    })
    const txSignature = await this.signAndSubmit(transaction, args.depositorKp)
    return {
      txSignature,
      withdrawnLamports: netAmount,
      feeLamports: feeAmount,
      stealthAddress: stealthAddress.toBase58(),
    }
  }
}
