import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { resetGovernanceProvider } from '../src/services/governance-provider.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Fixtures ───────────────────────────────────────────────────────────────

const hex32 = '0x' + 'ab'.repeat(32)
const voterSecret1 = '0x' + '11'.repeat(32)
const voterSecret2 = '0x' + '22'.repeat(32)
const voterSecret3 = '0x' + '33'.repeat(32)

const validEncrypt = {
  proposalId: 'proposal-001',
  vote: 'yes' as const,
  voterSecret: voterSecret1,
}

// ─── POST /v1/governance/ballot/encrypt ─────────────────────────────────────

describe('POST /v1/governance/ballot/encrypt', () => {
  beforeEach(() => resetGovernanceProvider())

  it('encrypts a yes vote → 200', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send(validEncrypt)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.beta).toBe(true)
    expect(res.body.data.commitment).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.blindingFactor).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.nullifier).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.vote).toBe('yes')
    expect(res.body.data.proposalId).toBe('proposal-001')
    expect(res.body.data.anonymousId).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('encrypts a no vote → 200', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, vote: 'no' })
    expect(res.status).toBe(200)
    expect(res.body.data.vote).toBe('no')
  })

  it('encrypts an abstain vote → 200', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, vote: 'abstain' })
    expect(res.status).toBe(200)
    expect(res.body.data.vote).toBe('abstain')
  })

  it('uses stealth address as anonymous ID when provided', async () => {
    const stealthAddr = 'stealth123abc'
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, stealthAddress: stealthAddr })
    expect(res.status).toBe(200)
    expect(res.body.data.anonymousId).toBe(stealthAddr)
  })

  it('generates deterministic nullifier for same voter+proposal', async () => {
    const res1 = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send(validEncrypt)
    const res2 = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send(validEncrypt)
    expect(res1.body.data.nullifier).toBe(res2.body.data.nullifier)
  })

  it('generates different nullifiers for different proposals', async () => {
    const res1 = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send(validEncrypt)
    const res2 = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, proposalId: 'proposal-002' })
    expect(res1.body.data.nullifier).not.toBe(res2.body.data.nullifier)
  })

  it('rejects missing proposalId → 400', async () => {
    const { proposalId: _, ...rest } = validEncrypt
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send(rest)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid vote choice → 400', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, vote: 'maybe' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid voterSecret (non-hex) → 400', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ ...validEncrypt, voterSecret: 'not-hex' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── POST /v1/governance/ballot/submit ──────────────────────────────────────

describe('POST /v1/governance/ballot/submit', () => {
  beforeEach(() => resetGovernanceProvider())

  async function encryptAndGetBallot(proposalId: string, vote: string, secret: string) {
    const res = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ proposalId, vote, voterSecret: secret })
    return res.body.data
  }

  it('submits a valid ballot → 200', async () => {
    const ballot = await encryptAndGetBallot('proposal-001', 'yes', voterSecret1)
    const res = await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId: 'proposal-001',
        commitment: ballot.commitment,
        blindingFactor: ballot.blindingFactor,
        nullifier: ballot.nullifier,
        vote: 'yes',
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.accepted).toBe(true)
    expect(res.body.data.totalBallots).toBe(1)
    expect(res.body.data.nullifier).toBe(ballot.nullifier)
  })

  it('rejects double-vote (same nullifier) → 409', async () => {
    const ballot = await encryptAndGetBallot('proposal-001', 'yes', voterSecret1)
    const submitPayload = {
      proposalId: 'proposal-001',
      commitment: ballot.commitment,
      blindingFactor: ballot.blindingFactor,
      nullifier: ballot.nullifier,
      vote: 'yes',
    }

    const first = await request(app)
      .post('/v1/governance/ballot/submit')
      .send(submitPayload)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/governance/ballot/submit')
      .send(submitPayload)
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('GOVERNANCE_DOUBLE_VOTE')
  })

  it('accepts multiple voters on same proposal → 200', async () => {
    const ballot1 = await encryptAndGetBallot('proposal-001', 'yes', voterSecret1)
    const ballot2 = await encryptAndGetBallot('proposal-001', 'no', voterSecret2)

    const res1 = await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId: 'proposal-001',
        commitment: ballot1.commitment,
        blindingFactor: ballot1.blindingFactor,
        nullifier: ballot1.nullifier,
        vote: 'yes',
      })
    expect(res1.status).toBe(200)
    expect(res1.body.data.totalBallots).toBe(1)

    const res2 = await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId: 'proposal-001',
        commitment: ballot2.commitment,
        blindingFactor: ballot2.blindingFactor,
        nullifier: ballot2.nullifier,
        vote: 'no',
      })
    expect(res2.status).toBe(200)
    expect(res2.body.data.totalBallots).toBe(2)
  })

  it('supports idempotency', async () => {
    const ballot = await encryptAndGetBallot('proposal-idem', 'yes', voterSecret1)
    const key = '550e8400-e29b-41d4-a716-446655440080'
    const payload = {
      proposalId: 'proposal-idem',
      commitment: ballot.commitment,
      blindingFactor: ballot.blindingFactor,
      nullifier: ballot.nullifier,
      vote: 'yes',
    }

    const first = await request(app)
      .post('/v1/governance/ballot/submit')
      .set('Idempotency-Key', key)
      .send(payload)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/governance/ballot/submit')
      .set('Idempotency-Key', key)
      .send(payload)
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
  })

  it('rejects missing commitment → 400', async () => {
    const res = await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId: 'proposal-001',
        blindingFactor: hex32,
        nullifier: hex32,
        vote: 'yes',
      })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── POST /v1/governance/tally ──────────────────────────────────────────────

describe('POST /v1/governance/tally', () => {
  beforeEach(() => resetGovernanceProvider())

  async function submitVote(proposalId: string, vote: string, secret: string) {
    const encryptRes = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ proposalId, vote, voterSecret: secret })
    const ballot = encryptRes.body.data
    await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId,
        commitment: ballot.commitment,
        blindingFactor: ballot.blindingFactor,
        nullifier: ballot.nullifier,
        vote,
      })
  }

  it('tallies votes with homomorphic verification → 200', async () => {
    await submitVote('proposal-tally', 'yes', voterSecret1)
    await submitVote('proposal-tally', 'no', voterSecret2)
    await submitVote('proposal-tally', 'yes', voterSecret3)

    const res = await request(app)
      .post('/v1/governance/tally')
      .send({ proposalId: 'proposal-tally' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.tallyId).toMatch(/^tly_[0-9a-f]{64}$/)
    expect(res.body.data.totalVotes).toBe(3)
    expect(res.body.data.yesVotes).toBe(2)
    expect(res.body.data.noVotes).toBe(1)
    expect(res.body.data.abstainVotes).toBe(0)
    expect(res.body.data.tallyCommitment).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.tallyBlinding).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.verificationHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.verified).toBe(true)
  })

  it('tallies single vote → 200', async () => {
    await submitVote('proposal-single', 'yes', voterSecret1)
    const res = await request(app)
      .post('/v1/governance/tally')
      .send({ proposalId: 'proposal-single' })
    expect(res.status).toBe(200)
    expect(res.body.data.totalVotes).toBe(1)
    expect(res.body.data.yesVotes).toBe(1)
    expect(res.body.data.verified).toBe(true)
  })

  it('returns 404 for unknown proposal', async () => {
    const res = await request(app)
      .post('/v1/governance/tally')
      .send({ proposalId: 'nonexistent-proposal' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('GOVERNANCE_PROPOSAL_NOT_FOUND')
  })

  it('supports idempotency', async () => {
    await submitVote('proposal-tally-idem', 'yes', voterSecret1)
    const key = '550e8400-e29b-41d4-a716-446655440081'

    const first = await request(app)
      .post('/v1/governance/tally')
      .set('Idempotency-Key', key)
      .send({ proposalId: 'proposal-tally-idem' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/governance/tally')
      .set('Idempotency-Key', key)
      .send({ proposalId: 'proposal-tally-idem' })
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.tallyId).toBe(first.body.data.tallyId)
  })

  it('rejects missing proposalId → 400', async () => {
    const res = await request(app)
      .post('/v1/governance/tally')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── GET /v1/governance/tally/:id ───────────────────────────────────────────

describe('GET /v1/governance/tally/:id', () => {
  beforeEach(() => resetGovernanceProvider())

  it('retrieves tally by ID → 200', async () => {
    // Submit a vote and tally
    const encryptRes = await request(app)
      .post('/v1/governance/ballot/encrypt')
      .send({ proposalId: 'proposal-get', vote: 'yes', voterSecret: voterSecret1 })
    const ballot = encryptRes.body.data
    await request(app)
      .post('/v1/governance/ballot/submit')
      .send({
        proposalId: 'proposal-get',
        commitment: ballot.commitment,
        blindingFactor: ballot.blindingFactor,
        nullifier: ballot.nullifier,
        vote: 'yes',
      })
    const tallyRes = await request(app)
      .post('/v1/governance/tally')
      .send({ proposalId: 'proposal-get' })
    const { tallyId } = tallyRes.body.data

    const res = await request(app)
      .get(`/v1/governance/tally/${tallyId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.tallyId).toBe(tallyId)
    expect(res.body.data.proposalId).toBe('proposal-get')
    expect(res.body.data.totalVotes).toBe(1)
  })

  it('returns 404 for unknown tally ID', async () => {
    const fakeId = 'tly_' + 'ff'.repeat(32)
    const res = await request(app)
      .get(`/v1/governance/tally/${fakeId}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('GOVERNANCE_TALLY_NOT_FOUND')
  })

  it('returns 400 for invalid tally ID format', async () => {
    const res = await request(app)
      .get('/v1/governance/tally/invalid-id')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── E2E Flow ───────────────────────────────────────────────────────────────

describe('Governance E2E flow', () => {
  beforeEach(() => resetGovernanceProvider())

  it('full lifecycle: encrypt → submit → tally → get tally', async () => {
    const proposalId = 'e2e-proposal'

    // 3 voters: 2 yes, 1 abstain
    const voters = [
      { vote: 'yes', secret: voterSecret1 },
      { vote: 'yes', secret: voterSecret2 },
      { vote: 'abstain', secret: voterSecret3 },
    ]

    for (const voter of voters) {
      const encryptRes = await request(app)
        .post('/v1/governance/ballot/encrypt')
        .send({ proposalId, vote: voter.vote, voterSecret: voter.secret })
      expect(encryptRes.status).toBe(200)
      const ballot = encryptRes.body.data

      const submitRes = await request(app)
        .post('/v1/governance/ballot/submit')
        .send({
          proposalId,
          commitment: ballot.commitment,
          blindingFactor: ballot.blindingFactor,
          nullifier: ballot.nullifier,
          vote: voter.vote,
        })
      expect(submitRes.status).toBe(200)
      expect(submitRes.body.data.accepted).toBe(true)
    }

    // Tally
    const tallyRes = await request(app)
      .post('/v1/governance/tally')
      .send({ proposalId })
    expect(tallyRes.status).toBe(200)
    expect(tallyRes.body.data.totalVotes).toBe(3)
    expect(tallyRes.body.data.yesVotes).toBe(2)
    expect(tallyRes.body.data.noVotes).toBe(0)
    expect(tallyRes.body.data.abstainVotes).toBe(1)
    expect(tallyRes.body.data.verified).toBe(true)

    // Get tally
    const getTallyRes = await request(app)
      .get(`/v1/governance/tally/${tallyRes.body.data.tallyId}`)
    expect(getTallyRes.status).toBe(200)
    expect(getTallyRes.body.data.totalVotes).toBe(3)
    expect(getTallyRes.body.data.verified).toBe(true)
  })
})
