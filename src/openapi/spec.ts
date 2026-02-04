import { ErrorCode, ERROR_CATALOG } from '../errors/codes.js'

// ─── Shared Schema Definitions ──────────────────────────────────────────────

const hexString32 = {
  type: 'string' as const,
  pattern: '^0x[0-9a-fA-F]{64}$',
  description: '0x-prefixed 32-byte hex string',
  example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
}

const solanaAddress = {
  type: 'string' as const,
  minLength: 32,
  maxLength: 44,
  description: 'Base58-encoded Solana public key',
  example: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
}

const positiveIntString = {
  type: 'string' as const,
  pattern: '^[1-9]\\d*$',
  description: 'Positive integer as string (no leading zeros)',
  example: '1000000000',
}

const errorResponse = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, enum: [false] },
    error: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' as const },
        message: { type: 'string' as const },
        details: {},
      },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
}

// ─── OpenAPI 3.1 Specification ──────────────────────────────────────────────

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Sipher — Privacy-as-a-Skill API',
    version: '0.1.0',
    description: 'REST API wrapping SIP Protocol\'s privacy SDK for Solana agents. Stealth addresses, Pedersen commitments, shielded transfers, and viewing key compliance.',
    contact: {
      name: 'SIP Protocol',
      url: 'https://sip-protocol.org',
      email: 'hello@sip-protocol.org',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    { url: 'https://sipher.sip-protocol.org', description: 'Production' },
    { url: 'http://localhost:5006', description: 'Local development' },
  ],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication. Also accepts Authorization: Bearer <key>.',
      },
    },
    schemas: {
      ErrorResponse: errorResponse,
      StealthMetaAddress: {
        type: 'object',
        properties: {
          spendingKey: hexString32,
          viewingKey: hexString32,
          chain: { type: 'string', enum: ['solana'] },
          label: { type: 'string' },
        },
        required: ['spendingKey', 'viewingKey', 'chain'],
      },
      StealthAddress: {
        type: 'object',
        properties: {
          address: hexString32,
          ephemeralPublicKey: hexString32,
          viewTag: { type: 'integer', minimum: 0, maximum: 255 },
        },
        required: ['address', 'ephemeralPublicKey', 'viewTag'],
      },
      ViewingKey: {
        type: 'object',
        properties: {
          key: hexString32,
          path: { type: 'string' },
          hash: hexString32,
        },
        required: ['key', 'path', 'hash'],
      },
    },
  },
  paths: {
    // ─── Health ───────────────────────────────────────────────────────────────
    '/v1/health': {
      get: {
        summary: 'Health check',
        tags: ['Health'],
        security: [],
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy', 'unhealthy', 'shutting_down'] },
                        version: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'integer', description: 'Uptime in seconds' },
                        solana: {
                          type: 'object',
                          properties: {
                            connected: { type: 'boolean' },
                            cluster: { type: 'string' },
                            slot: { type: 'integer' },
                            latencyMs: { type: 'integer' },
                          },
                        },
                        memory: {
                          type: 'object',
                          properties: {
                            heapUsedMB: { type: 'number' },
                            rssMB: { type: 'number' },
                          },
                        },
                        endpoints: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: 'Service unhealthy or shutting down', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Returns 200 only if all critical systems are healthy. Use as Docker/k8s readiness probe.',
        tags: ['Health'],
        security: [],
        operationId: 'getReady',
        responses: {
          200: {
            description: 'Service is ready to accept requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        ready: { type: 'boolean' },
                        checks: {
                          type: 'object',
                          properties: {
                            solana: { type: 'boolean' },
                            shutdown: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: 'Service not ready', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/errors': {
      get: {
        summary: 'Error code catalog',
        description: 'Returns all API error codes with descriptions, HTTP statuses, and retry guidance.',
        tags: ['Health'],
        security: [],
        operationId: 'getErrors',
        responses: {
          200: {
            description: 'Error catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        totalCodes: { type: 'integer' },
                        errors: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              code: { type: 'string' },
                              httpStatus: { type: 'integer' },
                              description: { type: 'string' },
                              retryable: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Stealth ──────────────────────────────────────────────────────────────
    '/v1/stealth/generate': {
      post: {
        summary: 'Generate stealth meta-address keypair',
        tags: ['Stealth'],
        operationId: 'stealthGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: 'Optional label for the keypair' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Stealth meta-address generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        metaAddress: { $ref: '#/components/schemas/StealthMetaAddress' },
                        spendingPrivateKey: hexString32,
                        viewingPrivateKey: hexString32,
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/stealth/derive': {
      post: {
        summary: 'Derive one-time stealth address',
        tags: ['Stealth'],
        operationId: 'stealthDerive',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  recipientMetaAddress: { $ref: '#/components/schemas/StealthMetaAddress' },
                },
                required: ['recipientMetaAddress'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Stealth address derived',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        stealthAddress: { $ref: '#/components/schemas/StealthAddress' },
                        sharedSecret: hexString32,
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/stealth/check': {
      post: {
        summary: 'Check stealth address ownership',
        tags: ['Stealth'],
        operationId: 'stealthCheck',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  stealthAddress: { $ref: '#/components/schemas/StealthAddress' },
                  spendingPrivateKey: hexString32,
                  viewingPrivateKey: hexString32,
                },
                required: ['stealthAddress', 'spendingPrivateKey', 'viewingPrivateKey'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Ownership check result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        isOwner: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/stealth/generate/batch': {
      post: {
        summary: 'Batch generate stealth keypairs',
        description: 'Generate multiple stealth meta-address keypairs in a single call. Max 100 per request.',
        tags: ['Stealth'],
        operationId: 'stealthGenerateBatch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer', minimum: 1, maximum: 100, description: 'Number of keypairs to generate' },
                  label: { type: 'string', description: 'Optional label applied to all keypairs' },
                },
                required: ['count'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch generation results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              index: { type: 'integer' },
                              success: { type: 'boolean' },
                              data: {
                                type: 'object',
                                properties: {
                                  metaAddress: { $ref: '#/components/schemas/StealthMetaAddress' },
                                  spendingPrivateKey: hexString32,
                                  viewingPrivateKey: hexString32,
                                },
                              },
                              error: { type: 'string' },
                            },
                          },
                        },
                        summary: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            succeeded: { type: 'integer' },
                            failed: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Transfer ─────────────────────────────────────────────────────────────
    '/v1/transfer/shield': {
      post: {
        summary: 'Build shielded transfer (unsigned)',
        description: 'Creates an unsigned Solana transaction sending to a stealth address with Pedersen commitment.',
        tags: ['Transfer'],
        operationId: 'transferShield',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sender: solanaAddress,
                  recipientMetaAddress: { $ref: '#/components/schemas/StealthMetaAddress' },
                  amount: positiveIntString,
                  mint: { ...solanaAddress, description: 'Optional SPL token mint. Omit for native SOL.' },
                },
                required: ['sender', 'recipientMetaAddress', 'amount'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Unsigned transaction built',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        transaction: { type: 'string', description: 'Base64-encoded unsigned transaction' },
                        stealthAddress: { type: 'string' },
                        ephemeralPublicKey: hexString32,
                        viewTag: { type: 'integer' },
                        commitment: hexString32,
                        blindingFactor: hexString32,
                        viewingKeyHash: hexString32,
                        sharedSecret: hexString32,
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/transfer/claim': {
      post: {
        summary: 'Claim stealth payment (signed)',
        description: 'Derives stealth private key, signs and submits claim transaction on-chain.',
        tags: ['Transfer'],
        operationId: 'transferClaim',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  stealthAddress: solanaAddress,
                  ephemeralPublicKey: solanaAddress,
                  spendingPrivateKey: hexString32,
                  viewingPrivateKey: hexString32,
                  destinationAddress: solanaAddress,
                  mint: solanaAddress,
                },
                required: ['stealthAddress', 'ephemeralPublicKey', 'spendingPrivateKey', 'viewingPrivateKey', 'destinationAddress', 'mint'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Claim transaction submitted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        txSignature: { type: 'string' },
                        destinationAddress: { type: 'string' },
                        amount: { type: 'string' },
                        explorerUrl: { type: 'string', format: 'uri' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Scan ─────────────────────────────────────────────────────────────────
    '/v1/scan/payments': {
      post: {
        summary: 'Scan for incoming shielded payments',
        description: 'Scans Solana for SIP announcements matching the provided viewing key.',
        tags: ['Scan'],
        operationId: 'scanPayments',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  viewingPrivateKey: hexString32,
                  spendingPublicKey: hexString32,
                  fromSlot: { type: 'integer', minimum: 0 },
                  toSlot: { type: 'integer', minimum: 0 },
                  limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
                },
                required: ['viewingPrivateKey', 'spendingPublicKey'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Scan results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        payments: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              stealthAddress: { type: 'string' },
                              ephemeralPublicKey: { type: 'string' },
                              txSignature: { type: 'string' },
                              slot: { type: 'integer' },
                              timestamp: { type: 'integer' },
                            },
                          },
                        },
                        scanned: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Commitment ───────────────────────────────────────────────────────────
    '/v1/commitment/create': {
      post: {
        summary: 'Create Pedersen commitment',
        tags: ['Commitment'],
        operationId: 'commitmentCreate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: { type: 'string', pattern: '^[0-9]+$', description: 'Non-negative integer string' },
                  blindingFactor: { ...hexString32, description: 'Optional custom blinding factor' },
                },
                required: ['value'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Commitment created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        commitment: { type: 'string', description: 'Hex-encoded curve point' },
                        blindingFactor: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/commitment/verify': {
      post: {
        summary: 'Verify Pedersen commitment',
        tags: ['Commitment'],
        operationId: 'commitmentVerify',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  commitment: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  value: { type: 'string', pattern: '^[0-9]+$' },
                  blindingFactor: hexString32,
                },
                required: ['commitment', 'value', 'blindingFactor'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Verification result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/commitment/add': {
      post: {
        summary: 'Add two commitments (homomorphic)',
        tags: ['Commitment'],
        operationId: 'commitmentAdd',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  commitmentA: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  commitmentB: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  blindingA: hexString32,
                  blindingB: hexString32,
                },
                required: ['commitmentA', 'commitmentB', 'blindingA', 'blindingB'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Sum commitment',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        commitment: { type: 'string' },
                        blindingFactor: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/commitment/subtract': {
      post: {
        summary: 'Subtract two commitments (homomorphic)',
        tags: ['Commitment'],
        operationId: 'commitmentSubtract',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  commitmentA: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  commitmentB: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  blindingA: hexString32,
                  blindingB: hexString32,
                },
                required: ['commitmentA', 'commitmentB', 'blindingA', 'blindingB'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Difference commitment',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        commitment: { type: 'string' },
                        blindingFactor: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/commitment/create/batch': {
      post: {
        summary: 'Batch create Pedersen commitments',
        description: 'Create multiple Pedersen commitments in a single call. Max 100 per request.',
        tags: ['Commitment'],
        operationId: 'commitmentCreateBatch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    items: {
                      type: 'object',
                      properties: {
                        value: { type: 'string', pattern: '^[0-9]+$' },
                        blindingFactor: hexString32,
                      },
                      required: ['value'],
                    },
                  },
                },
                required: ['items'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch commitment results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              index: { type: 'integer' },
                              success: { type: 'boolean' },
                              data: {
                                type: 'object',
                                properties: {
                                  commitment: { type: 'string' },
                                  blindingFactor: { type: 'string' },
                                },
                              },
                              error: { type: 'string' },
                            },
                          },
                        },
                        summary: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            succeeded: { type: 'integer' },
                            failed: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/scan/payments/batch': {
      post: {
        summary: 'Batch scan for payments across multiple key pairs',
        description: 'Scan for incoming shielded payments across multiple viewing key pairs. Max 100 key pairs per request.',
        tags: ['Scan'],
        operationId: 'scanPaymentsBatch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  keyPairs: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    items: {
                      type: 'object',
                      properties: {
                        viewingPrivateKey: hexString32,
                        spendingPublicKey: hexString32,
                        label: { type: 'string' },
                      },
                      required: ['viewingPrivateKey', 'spendingPublicKey'],
                    },
                  },
                  fromSlot: { type: 'integer', minimum: 0 },
                  toSlot: { type: 'integer', minimum: 0 },
                  limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
                },
                required: ['keyPairs'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch scan results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              index: { type: 'integer' },
                              label: { type: 'string' },
                              success: { type: 'boolean' },
                              data: {
                                type: 'object',
                                properties: {
                                  payments: { type: 'array', items: { type: 'object' } },
                                  scanned: { type: 'integer' },
                                },
                              },
                              error: { type: 'string' },
                            },
                          },
                        },
                        summary: {
                          type: 'object',
                          properties: {
                            totalKeyPairs: { type: 'integer' },
                            totalPaymentsFound: { type: 'integer' },
                            transactionsScanned: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Viewing Key ──────────────────────────────────────────────────────────
    '/v1/viewing-key/generate': {
      post: {
        summary: 'Generate viewing key',
        tags: ['Viewing Key'],
        operationId: 'viewingKeyGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  path: { type: 'string', default: 'm/0', description: 'Derivation path' },
                  label: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Viewing key generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/ViewingKey' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/viewing-key/derive': {
      post: {
        summary: 'Derive child viewing key (BIP32-style)',
        description: 'Derives a child viewing key from a master key using HMAC-SHA512. Supports hierarchical key trees for scoped compliance access (per-auditor, per-timeframe).',
        tags: ['Viewing Key'],
        operationId: 'viewingKeyDerive',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  masterKey: { $ref: '#/components/schemas/ViewingKey' },
                  childPath: { type: 'string', description: 'Derivation path segment (e.g., "audit", "2026/Q1")', minLength: 1 },
                },
                required: ['masterKey', 'childPath'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Derived child viewing key',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        key: hexString32,
                        path: { type: 'string' },
                        hash: hexString32,
                        derivedFrom: {
                          type: 'object',
                          properties: {
                            parentHash: hexString32,
                            parentPath: { type: 'string' },
                            childPath: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/viewing-key/verify-hierarchy': {
      post: {
        summary: 'Verify viewing key parent-child relationship',
        description: 'Verifies that a child viewing key was derived from a specific parent key at a given path.',
        tags: ['Viewing Key'],
        operationId: 'viewingKeyVerifyHierarchy',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  parentKey: { $ref: '#/components/schemas/ViewingKey' },
                  childKey: { $ref: '#/components/schemas/ViewingKey' },
                  childPath: { type: 'string', minLength: 1 },
                },
                required: ['parentKey', 'childKey', 'childPath'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Hierarchy verification result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                        expectedPath: { type: 'string' },
                        actualPath: { type: 'string' },
                        parentHash: hexString32,
                        childHash: hexString32,
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/viewing-key/disclose': {
      post: {
        summary: 'Encrypt transaction for disclosure',
        description: 'Encrypts transaction data so only the viewing key holder can decrypt it (selective compliance).',
        tags: ['Viewing Key'],
        operationId: 'viewingKeyDisclose',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  viewingKey: { $ref: '#/components/schemas/ViewingKey' },
                  transactionData: {
                    type: 'object',
                    properties: {
                      sender: { type: 'string' },
                      recipient: { type: 'string' },
                      amount: { type: 'string' },
                      timestamp: { type: 'integer' },
                    },
                    required: ['sender', 'recipient', 'amount', 'timestamp'],
                  },
                },
                required: ['viewingKey', 'transactionData'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Encrypted disclosure',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        ciphertext: { type: 'string' },
                        nonce: { type: 'string' },
                        viewingKeyHash: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/viewing-key/decrypt': {
      post: {
        summary: 'Decrypt transaction with viewing key',
        tags: ['Viewing Key'],
        operationId: 'viewingKeyDecrypt',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  viewingKey: { $ref: '#/components/schemas/ViewingKey' },
                  encrypted: {
                    type: 'object',
                    properties: {
                      ciphertext: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                      nonce: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                      viewingKeyHash: hexString32,
                    },
                    required: ['ciphertext', 'nonce', 'viewingKeyHash'],
                  },
                },
                required: ['viewingKey', 'encrypted'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Decrypted transaction data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        sender: { type: 'string' },
                        recipient: { type: 'string' },
                        amount: { type: 'string' },
                        timestamp: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
          500: { description: 'Decryption failed (key mismatch)', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Privacy ─────────────────────────────────────────────────────────────
    '/v1/privacy/score': {
      post: {
        summary: 'Analyze wallet privacy score',
        description: 'Analyzes on-chain activity of a Solana wallet and returns a 0-100 privacy score with breakdown by factor and actionable recommendations.',
        tags: ['Privacy'],
        operationId: 'privacyScore',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  address: solanaAddress,
                  limit: { type: 'integer', minimum: 10, maximum: 500, default: 100, description: 'Number of recent transactions to analyze' },
                },
                required: ['address'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Privacy score analysis',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        address: { type: 'string' },
                        score: { type: 'integer', minimum: 0, maximum: 100 },
                        grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
                        transactionsAnalyzed: { type: 'integer' },
                        factors: {
                          type: 'object',
                          properties: {
                            addressReuse: {
                              type: 'object',
                              properties: { score: { type: 'integer' }, detail: { type: 'string' } },
                            },
                            amountPatterns: {
                              type: 'object',
                              properties: { score: { type: 'integer' }, detail: { type: 'string' } },
                            },
                            timingCorrelation: {
                              type: 'object',
                              properties: { score: { type: 'integer' }, detail: { type: 'string' } },
                            },
                            counterpartyExposure: {
                              type: 'object',
                              properties: { score: { type: 'integer' }, detail: { type: 'string' } },
                            },
                          },
                        },
                        recommendations: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid address', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/v1/rpc/providers': {
      get: {
        tags: ['RPC'],
        summary: 'List supported RPC providers and active configuration',
        operationId: 'getRpcProviders',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: {
            description: 'Active provider info and supported provider list',
            content: {
              'application/json': {
                schema: {
                  type: 'object' as const,
                  properties: {
                    success: { type: 'boolean' as const, enum: [true] },
                    data: {
                      type: 'object' as const,
                      properties: {
                        active: {
                          type: 'object' as const,
                          properties: {
                            provider: { type: 'string' as const, enum: ['generic', 'helius', 'quicknode', 'triton'] },
                            endpoint: { type: 'string' as const, description: 'Masked RPC endpoint URL' },
                            connected: { type: 'boolean' as const },
                            cluster: { type: 'string' as const },
                            latencyMs: { type: 'number' as const },
                          },
                        },
                        supported: {
                          type: 'array' as const,
                          items: {
                            type: 'object' as const,
                            properties: {
                              name: { type: 'string' as const },
                              description: { type: 'string' as const },
                              config: { type: 'array' as const, items: { type: 'string' as const } },
                              url: { type: 'string' as const },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Server health, readiness, and error catalog' },
    { name: 'Stealth', description: 'Stealth address generation, derivation, and ownership check' },
    { name: 'Transfer', description: 'Build shielded transfers and claim stealth payments' },
    { name: 'Scan', description: 'Scan for incoming shielded payments' },
    { name: 'Commitment', description: 'Pedersen commitment operations (create, verify, homomorphic add/subtract)' },
    { name: 'Viewing Key', description: 'Viewing key generation, encryption for disclosure, and decryption' },
    { name: 'Privacy', description: 'Wallet privacy analysis and surveillance scoring' },
    { name: 'RPC', description: 'RPC provider configuration and status' },
  ],
}
