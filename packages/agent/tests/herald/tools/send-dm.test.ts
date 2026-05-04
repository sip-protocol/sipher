// packages/agent/tests/herald/tools/send-dm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_USER_ID,
  VALID_DM_EVENT_ID,
  SAMPLE_DM_TEXT,
  makeXSendDmResult,
  type ToolSchemaLike,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockSendDmToParticipant,
  mockGuardianEmit,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockSendDmToParticipant: vi.fn(),
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  sendDMTool,
  executeSendDM,
} from '../../../src/herald/tools/send-dm.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({
    v2: { sendDmToParticipant: mockSendDmToParticipant },
  })
  mockSendDmToParticipant.mockResolvedValue(makeXSendDmResult())
})

describe('sendDMTool definition', () => {
  it('has correct name', () => {
    expect(sendDMTool.name).toBe('sendDM')
  })

  it('declares required user_id and text fields', () => {
    const schema = sendDMTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual(['user_id', 'text'])
  })

  it('has a non-empty description', () => {
    expect(sendDMTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSendDM — happy path', () => {
  it('returns { sent: true, dm_id } from v2.sendDmToParticipant response', async () => {
    const r = await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(r).toEqual({ sent: true, dm_id: VALID_DM_EVENT_ID })
  })
})

describe('executeSendDM — branches', () => {
  it('throws when budget gate blocks dm_create (THROWS, not silent)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/budget gate.*dm_create blocked/i)

    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('throws gate error (not validation error) when budget blocked AND fields are empty (gate runs first)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeSendDM({ user_id: '', text: '' }),
    ).rejects.toThrow(/budget gate.*dm_create blocked/i)

    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when user_id is %s', async (_label, user_id) => {
    await expect(
      executeSendDM({ user_id, text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/user_id is required/i)
    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when text is %s', async (_label, text) => {
    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text }),
    ).rejects.toThrow(/text is required/i)
    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })
})

describe('executeSendDM — service interaction', () => {
  it('calls canMakeCall with "dm_create"', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(mockCanMakeCall).toHaveBeenCalledWith('dm_create')
  })

  it('calls v2.sendDmToParticipant with user_id and {text} payload', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })

    expect(mockSendDmToParticipant).toHaveBeenCalledTimes(1)
    expect(mockSendDmToParticipant).toHaveBeenCalledWith(VALID_USER_ID, {
      text: SAMPLE_DM_TEXT,
    })
  })

  it('tracks dm_create cost with resource count 1', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_create', 1)
  })

  it('emits herald:dm event with user_id and dm_id in data, level routine, no wallet field', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })

    expect(mockGuardianEmit).toHaveBeenCalledTimes(1)
    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toStrictEqual({
      source: 'herald',
      type: 'herald:dm',
      level: 'routine',
      data: { user_id: VALID_USER_ID, dm_id: VALID_DM_EVENT_ID },
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    })
  })

  it('propagates v2.sendDmToParticipant throw and does NOT emit bus event or track cost', async () => {
    mockSendDmToParticipant.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/429 rate limit/)

    expect(mockTrackXApiCost).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })
})
