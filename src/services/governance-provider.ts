import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { LRUCache } from 'lru-cache'
import { commit, verifyOpening, addCommitments, addBlindings } from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'
import { CACHE_MAX_DEFAULT, CACHE_MAX_LARGE, ONE_DAY_MS, SEVEN_DAYS_MS } from '../constants.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-GOVERNANCE')
const MAX_BALLOTS_PER_PROPOSAL = CACHE_MAX_LARGE

// ─── Types ──────────────────────────────────────────────────────────────────

export type VoteChoice = 'yes' | 'no' | 'abstain'

export interface BallotEntry {
  commitment: string
  blindingFactor: string
  nullifier: string
  vote: VoteChoice
  stealthAddress?: string
  submittedAt: number
}

export interface ProposalEntry {
  proposalId: string
  ballots: BallotEntry[]
  nullifiers: Set<string>
  createdAt: number
}

export interface TallyEntry {
  tallyId: string
  proposalId: string
  totalVotes: number
  yesVotes: number
  noVotes: number
  abstainVotes: number
  tallyCommitment: string
  tallyBlinding: string
  verificationHash: string
  verified: boolean
  talliedAt: number
}

export interface EncryptBallotParams {
  proposalId: string
  vote: VoteChoice
  voterSecret: string
  stealthAddress?: string
}

export interface SubmitBallotParams {
  proposalId: string
  commitment: string
  blindingFactor: string
  nullifier: string
  vote: VoteChoice
  stealthAddress?: string
}

export interface TallyParams {
  proposalId: string
}

// ─── Caches ─────────────────────────────────────────────────────────────────

const proposalCache = new LRUCache<string, ProposalEntry>({
  max: CACHE_MAX_DEFAULT,
  ttl: SEVEN_DAYS_MS,
})

const tallyCache = new LRUCache<string, TallyEntry>({
  max: CACHE_MAX_DEFAULT,
  ttl: ONE_DAY_MS,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashWithTag(...parts: string[]): string {
  const payload = parts.join('')
  const input = new Uint8Array(DOMAIN_TAG.length + new TextEncoder().encode(payload).length)
  input.set(DOMAIN_TAG)
  input.set(new TextEncoder().encode(payload), DOMAIN_TAG.length)
  return '0x' + bytesToHex(keccak_256(input))
}

function generateNullifier(voterSecret: string, proposalId: string): string {
  return hashWithTag('NULLIFIER', voterSecret, proposalId)
}

function getOrCreateProposal(proposalId: string): ProposalEntry {
  let proposal = proposalCache.get(proposalId)
  if (!proposal) {
    proposal = {
      proposalId,
      ballots: [],
      nullifiers: new Set<string>(),
      createdAt: Date.now(),
    }
    proposalCache.set(proposalId, proposal)
  }
  return proposal
}

// ─── Encrypt Ballot ─────────────────────────────────────────────────────────

export function encryptBallot(params: EncryptBallotParams): {
  commitment: string
  blindingFactor: string
  nullifier: string
  vote: VoteChoice
  proposalId: string
  anonymousId: string
} {
  const { proposalId, vote, voterSecret, stealthAddress } = params

  // Encode vote: yes=1, no=0, abstain=0
  const voteValue = vote === 'yes' ? 1n : 0n

  // Create Pedersen commitment for the vote
  const result = commit(voteValue)

  // Generate nullifier from voterSecret + proposalId
  const nullifier = generateNullifier(voterSecret, proposalId)

  // Anonymous ID: stealth address or hash of voterSecret
  const anonymousId = stealthAddress || hashWithTag('ANON', voterSecret)

  return {
    commitment: result.commitment as string,
    blindingFactor: result.blinding as string,
    nullifier,
    vote,
    proposalId,
    anonymousId,
  }
}

// ─── Submit Ballot ──────────────────────────────────────────────────────────

export function submitBallot(params: SubmitBallotParams): {
  proposalId: string
  nullifier: string
  accepted: boolean
  totalBallots: number
} {
  const { proposalId, commitment, blindingFactor, nullifier, vote, stealthAddress } = params

  const proposal = getOrCreateProposal(proposalId)

  // Check for double-vote via nullifier
  if (proposal.nullifiers.has(nullifier)) {
    const err = new Error(`Duplicate vote detected for proposal: ${proposalId}`)
    err.name = 'GovernanceDoubleVoteError'
    throw err
  }

  // Cap ballots per proposal to prevent memory exhaustion
  if (proposal.ballots.length >= MAX_BALLOTS_PER_PROPOSAL) {
    const err = new Error(
      `Proposal ${proposalId} has reached the maximum of ${MAX_BALLOTS_PER_PROPOSAL} ballots.`
    )
    err.name = 'GovernanceBallotLimitError'
    throw err
  }

  // Store ballot
  const ballot: BallotEntry = {
    commitment,
    blindingFactor,
    nullifier,
    vote,
    stealthAddress,
    submittedAt: Date.now(),
  }
  proposal.ballots.push(ballot)
  proposal.nullifiers.add(nullifier)
  proposalCache.set(proposalId, proposal)

  return {
    proposalId,
    nullifier,
    accepted: true,
    totalBallots: proposal.ballots.length,
  }
}

// ─── Tally Votes ────────────────────────────────────────────────────────────

export function tallyVotes(params: TallyParams): {
  tallyId: string
  proposalId: string
  totalVotes: number
  yesVotes: number
  noVotes: number
  abstainVotes: number
  tallyCommitment: string
  tallyBlinding: string
  verificationHash: string
  verified: boolean
} {
  const { proposalId } = params
  const proposal = proposalCache.get(proposalId)

  if (!proposal) {
    const err = new Error(`Proposal not found: ${proposalId}`)
    err.name = 'GovernanceProposalNotFoundError'
    throw err
  }

  if (proposal.ballots.length === 0) {
    const err = new Error(`No ballots submitted for proposal: ${proposalId}`)
    err.name = 'GovernanceTallyError'
    throw err
  }

  // Count votes by category
  let yesVotes = 0
  let noVotes = 0
  let abstainVotes = 0
  for (const ballot of proposal.ballots) {
    if (ballot.vote === 'yes') yesVotes++
    else if (ballot.vote === 'no') noVotes++
    else abstainVotes++
  }

  // Homomorphic tally: cascade pairwise addCommitments + addBlindings
  let tallyCommitment = proposal.ballots[0].commitment as HexString
  let tallyBlinding = proposal.ballots[0].blindingFactor as HexString

  for (let i = 1; i < proposal.ballots.length; i++) {
    const addResult = addCommitments(
      tallyCommitment,
      proposal.ballots[i].commitment as HexString
    )
    tallyCommitment = addResult.commitment as HexString
    tallyBlinding = addBlindings(
      tallyBlinding,
      proposal.ballots[i].blindingFactor as HexString
    ) as HexString
  }

  // Verify the tally: sum of yes votes should match the tally commitment
  const verified = verifyOpening(tallyCommitment, BigInt(yesVotes), tallyBlinding)

  // Generate tally ID
  const now = Date.now()
  const tallyId = 'tly_' + bytesToHex(keccak_256(
    new TextEncoder().encode(DOMAIN_TAG + 'TALLY' + proposalId + now.toString())
  ))

  // Generate verification hash
  const verificationHash = hashWithTag('VERIFY', tallyId, tallyCommitment, String(proposal.ballots.length))

  // Store tally result
  const tallyEntry: TallyEntry = {
    tallyId,
    proposalId,
    totalVotes: proposal.ballots.length,
    yesVotes,
    noVotes,
    abstainVotes,
    tallyCommitment: tallyCommitment as string,
    tallyBlinding: tallyBlinding as string,
    verificationHash,
    verified,
    talliedAt: now,
  }
  tallyCache.set(tallyId, tallyEntry)

  return tallyEntry
}

// ─── Get Tally ──────────────────────────────────────────────────────────────

export function getTally(tallyId: string): TallyEntry | null {
  return tallyCache.get(tallyId) || null
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function resetGovernanceProvider(): void {
  proposalCache.clear()
  tallyCache.clear()
}
