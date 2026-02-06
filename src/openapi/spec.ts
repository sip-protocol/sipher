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

    // ─── Private Transfer (Unified Chain-Agnostic) ────────────────────────────
    '/v1/transfer/private': {
      post: {
        summary: 'Build unified private transfer (chain-agnostic)',
        description: 'Builds a private transfer to a stealth address on any supported chain. Returns chain-specific transaction data (Solana unsigned tx, EVM tx descriptor, or NEAR action descriptors). Currently supports: solana, ethereum, polygon, arbitrum, optimism, base, near.',
        tags: ['Transfer'],
        operationId: 'transferPrivate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sender: { type: 'string', minLength: 1, description: 'Sender address (format varies by chain)' },
                  recipientMetaAddress: {
                    type: 'object',
                    properties: {
                      spendingKey: { type: 'string', pattern: '^0x[0-9a-fA-F]{64,66}$', description: '32-byte (ed25519) or 33-byte (secp256k1) hex key' },
                      viewingKey: { type: 'string', pattern: '^0x[0-9a-fA-F]{64,66}$', description: '32-byte (ed25519) or 33-byte (secp256k1) hex key' },
                      chain: { type: 'string', enum: ['solana', 'near', 'aptos', 'sui', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bitcoin', 'zcash', 'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx'] },
                      label: { type: 'string' },
                    },
                    required: ['spendingKey', 'viewingKey', 'chain'],
                  },
                  amount: positiveIntString,
                  token: { type: 'string', description: 'Token contract/mint address. Omit for native currency.' },
                },
                required: ['sender', 'recipientMetaAddress', 'amount'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Private transfer built successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        chain: { type: 'string' },
                        curve: { type: 'string', enum: ['ed25519', 'secp256k1'] },
                        stealthAddress: { type: 'string', description: 'Chain-native stealth address' },
                        ephemeralPublicKey: hexString32,
                        viewTag: { type: 'integer', minimum: 0, maximum: 255 },
                        commitment: { type: 'string' },
                        blindingFactor: hexString32,
                        viewingKeyHash: hexString32,
                        sharedSecret: hexString32,
                        chainData: {
                          oneOf: [
                            {
                              type: 'object',
                              title: 'SolanaTransferData',
                              properties: {
                                type: { type: 'string', enum: ['solana'] },
                                transaction: { type: 'string', description: 'Base64-encoded unsigned transaction' },
                                mint: { type: 'string' },
                              },
                              required: ['type', 'transaction'],
                            },
                            {
                              type: 'object',
                              title: 'EvmTransferData',
                              properties: {
                                type: { type: 'string', enum: ['evm'] },
                                to: { type: 'string', description: 'Recipient or token contract address' },
                                value: { type: 'string', description: 'Native currency amount (wei)' },
                                data: { type: 'string', description: 'Calldata (0x for native, ABI-encoded for ERC20)' },
                                chainId: { type: 'integer' },
                                tokenContract: { type: 'string' },
                              },
                              required: ['type', 'to', 'value', 'data', 'chainId'],
                            },
                            {
                              type: 'object',
                              title: 'NearTransferData',
                              properties: {
                                type: { type: 'string', enum: ['near'] },
                                receiverId: { type: 'string' },
                                actions: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      type: { type: 'string', enum: ['Transfer', 'FunctionCall'] },
                                      amount: { type: 'string' },
                                      methodName: { type: 'string' },
                                      args: { type: 'string' },
                                      gas: { type: 'string' },
                                      deposit: { type: 'string' },
                                    },
                                    required: ['type'],
                                  },
                                },
                                tokenContract: { type: 'string' },
                              },
                              required: ['type', 'receiverId', 'actions'],
                            },
                          ],
                          discriminator: { propertyName: 'type' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorResponse } } },
          422: {
            description: 'Chain not supported for transfers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', enum: ['CHAIN_TRANSFER_UNSUPPORTED'] },
                        message: { type: 'string' },
                        supportedChains: { type: 'array', items: { type: 'string' } },
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

    // ─── Proofs ───────────────────────────────────────────────────────────────
    '/v1/proofs/funding/generate': {
      post: {
        summary: 'Generate funding proof',
        description: 'Generates a ZK proof that balance >= minimumRequired without revealing the balance.',
        tags: ['Proofs'],
        operationId: 'proofsFundingGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  balance: { type: 'string', pattern: '^[0-9]+$', description: 'User balance (private)' },
                  minimumRequired: { type: 'string', pattern: '^[0-9]+$', description: 'Minimum required amount (public)' },
                  blindingFactor: hexString32,
                  assetId: { type: 'string', description: 'Asset identifier (e.g., SOL)' },
                  userAddress: { type: 'string', description: 'User address for ownership proof' },
                  ownershipSignature: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Signature proving address ownership' },
                },
                required: ['balance', 'minimumRequired', 'blindingFactor', 'assetId', 'userAddress', 'ownershipSignature'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Proof generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        proof: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['funding'] },
                            proof: { type: 'string' },
                            publicInputs: { type: 'array', items: { type: 'string' } },
                          },
                        },
                        publicInputs: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or proof generation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/proofs/funding/verify': {
      post: {
        summary: 'Verify funding proof',
        description: 'Verifies a previously generated funding proof.',
        tags: ['Proofs'],
        operationId: 'proofsFundingVerify',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['funding'] },
                  proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  publicInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' } },
                },
                required: ['type', 'proof', 'publicInputs'],
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
                      properties: { valid: { type: 'boolean' } },
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

    '/v1/proofs/validity/generate': {
      post: {
        summary: 'Generate validity proof',
        description: 'Generates a ZK proof that an intent is authorized by the sender without revealing the sender.',
        tags: ['Proofs'],
        operationId: 'proofsValidityGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  intentHash: hexString32,
                  senderAddress: { type: 'string' },
                  senderBlinding: hexString32,
                  senderSecret: hexString32,
                  authorizationSignature: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  nonce: hexString32,
                  timestamp: { type: 'integer' },
                  expiry: { type: 'integer' },
                },
                required: ['intentHash', 'senderAddress', 'senderBlinding', 'senderSecret', 'authorizationSignature', 'nonce', 'timestamp', 'expiry'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Proof generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        proof: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['validity'] },
                            proof: { type: 'string' },
                            publicInputs: { type: 'array', items: { type: 'string' } },
                          },
                        },
                        publicInputs: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or proof generation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/proofs/validity/verify': {
      post: {
        summary: 'Verify validity proof',
        description: 'Verifies a previously generated validity proof.',
        tags: ['Proofs'],
        operationId: 'proofsValidityVerify',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['validity'] },
                  proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  publicInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' } },
                },
                required: ['type', 'proof', 'publicInputs'],
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
                      properties: { valid: { type: 'boolean' } },
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

    '/v1/proofs/fulfillment/generate': {
      post: {
        summary: 'Generate fulfillment proof',
        description: 'Generates a ZK proof that the solver delivered output >= minimum to the correct recipient.',
        tags: ['Proofs'],
        operationId: 'proofsFulfillmentGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  intentHash: hexString32,
                  outputAmount: { type: 'string', pattern: '^[0-9]+$' },
                  outputBlinding: hexString32,
                  minOutputAmount: { type: 'string', pattern: '^[0-9]+$' },
                  recipientStealth: hexString32,
                  solverId: { type: 'string' },
                  solverSecret: hexString32,
                  oracleAttestation: {
                    type: 'object',
                    properties: {
                      recipient: hexString32,
                      amount: { type: 'string', pattern: '^[0-9]+$' },
                      txHash: hexString32,
                      blockNumber: { type: 'string', pattern: '^[0-9]+$' },
                      signature: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                    },
                    required: ['recipient', 'amount', 'txHash', 'blockNumber', 'signature'],
                  },
                  fulfillmentTime: { type: 'integer' },
                  expiry: { type: 'integer' },
                },
                required: ['intentHash', 'outputAmount', 'outputBlinding', 'minOutputAmount', 'recipientStealth', 'solverId', 'solverSecret', 'oracleAttestation', 'fulfillmentTime', 'expiry'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Proof generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        proof: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['fulfillment'] },
                            proof: { type: 'string' },
                            publicInputs: { type: 'array', items: { type: 'string' } },
                          },
                        },
                        publicInputs: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or proof generation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Range Proofs (STARK) ────────────────────────────────────────────────
    '/v1/proofs/range/generate': {
      post: {
        summary: 'Generate STARK range proof',
        description: 'Generates a STARK-based range proof that value >= threshold on a Pedersen commitment without revealing the value. Uses M31 limb decomposition. Currently uses a mock STARK prover — real Murkl integration coming soon.',
        tags: ['Proofs'],
        operationId: 'proofsRangeGenerate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: { type: 'string', pattern: '^[0-9]+$', description: 'Value to prove (private, not revealed)' },
                  threshold: { type: 'string', pattern: '^[0-9]+$', description: 'Minimum threshold (public)' },
                  blindingFactor: hexString32,
                  commitment: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Optional existing Pedersen commitment. If omitted, one is created from value + blindingFactor.' },
                },
                required: ['value', 'threshold', 'blindingFactor'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Range proof generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    warning: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        proof: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['range'] },
                            proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                            publicInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' } },
                          },
                        },
                        commitment: { type: 'string', description: 'Pedersen commitment hex' },
                        metadata: {
                          type: 'object',
                          properties: {
                            prover: { type: 'string', enum: ['mock-stark'] },
                            decomposition: { type: 'string', enum: ['m31-limbs'] },
                            limbCount: { type: 'integer' },
                            security: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or proof generation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/proofs/range/verify': {
      post: {
        summary: 'Verify STARK range proof',
        description: 'Verifies a previously generated STARK range proof.',
        tags: ['Proofs'],
        operationId: 'proofsRangeVerify',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['range'] },
                  proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  publicInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' } },
                },
                required: ['type', 'proof', 'publicInputs'],
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
                      properties: { valid: { type: 'boolean' } },
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

    // ─── Backends ────────────────────────────────────────────────────────────
    '/v1/backends': {
      get: {
        summary: 'List privacy backends',
        description: 'Returns all registered privacy backends with capabilities, health state, and priority. Backends implement different privacy strategies (stealth addresses, FHE, MPC).',
        tags: ['Backends'],
        operationId: 'backendsList',
        responses: {
          200: {
            description: 'List of registered backends',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        backends: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string', example: 'sip-native' },
                              type: { type: 'string' },
                              chains: { type: 'array', items: { type: 'string' } },
                              enabled: { type: 'boolean' },
                              priority: { type: 'integer' },
                              capabilities: {
                                type: 'object',
                                properties: {
                                  hiddenAmount: { type: 'boolean' },
                                  hiddenSender: { type: 'boolean' },
                                  hiddenRecipient: { type: 'boolean' },
                                  hiddenCompute: { type: 'boolean' },
                                  complianceSupport: { type: 'boolean' },
                                  setupRequired: { type: 'boolean' },
                                  latencyEstimate: { type: 'string', enum: ['fast', 'medium', 'slow'] },
                                  supportedTokens: { type: 'string', enum: ['native', 'spl', 'all'] },
                                  minAmount: { type: 'string', description: 'BigInt as string' },
                                  maxAmount: { type: 'string', description: 'BigInt as string' },
                                },
                              },
                              health: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                  circuitState: { type: 'string', enum: ['closed', 'open', 'half-open'] },
                                  isHealthy: { type: 'boolean' },
                                  consecutiveFailures: { type: 'integer' },
                                  lastChecked: { type: 'integer' },
                                  lastFailureReason: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                        total: { type: 'integer' },
                        totalEnabled: { type: 'integer' },
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

    '/v1/backends/{id}/health': {
      get: {
        summary: 'Check backend health',
        description: 'Probes a specific backend for availability, returns circuit breaker state, metrics, and capabilities.',
        tags: ['Backends'],
        operationId: 'backendsHealth',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Backend name (e.g., sip-native)',
          },
        ],
        responses: {
          200: {
            description: 'Backend health details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        available: { type: 'boolean' },
                        estimatedCost: { type: 'string', description: 'BigInt as string' },
                        estimatedTime: { type: 'integer', description: 'Estimated time in ms' },
                        health: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            circuitState: { type: 'string', enum: ['closed', 'open', 'half-open'] },
                            isHealthy: { type: 'boolean' },
                            consecutiveFailures: { type: 'integer' },
                            consecutiveSuccesses: { type: 'integer' },
                            lastChecked: { type: 'integer' },
                            lastFailureReason: { type: 'string' },
                          },
                        },
                        metrics: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            totalRequests: { type: 'integer' },
                            successfulRequests: { type: 'integer' },
                            failedRequests: { type: 'integer' },
                            averageLatencyMs: { type: 'number' },
                          },
                        },
                        capabilities: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Backend not found', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/backends/select': {
      post: {
        summary: 'Select preferred backend',
        description: 'Sets the preferred privacy backend for the authenticated API key. Requires a tiered API key.',
        tags: ['Backends'],
        operationId: 'backendsSelect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  backend: { type: 'string', minLength: 1, description: 'Backend name to prefer', example: 'sip-native' },
                },
                required: ['backend'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Backend preference saved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        keyId: { type: 'string' },
                        preferredBackend: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error or missing API key', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── C-SPL ──────────────────────────────────────────────────────────────
    '/v1/cspl/wrap': {
      post: {
        summary: 'Wrap SPL tokens into confidential balance',
        description: 'Wraps standard SPL tokens into a confidential (C-SPL) balance with encrypted amounts.',
        tags: ['C-SPL'],
        operationId: 'csplWrap',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mint: { ...solanaAddress, description: 'SPL token mint address' },
                  amount: positiveIntString,
                  owner: solanaAddress,
                  createAccount: { type: 'boolean', default: true, description: 'Create C-SPL account if missing' },
                },
                required: ['mint', 'amount', 'owner'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens wrapped into confidential balance',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        signature: { type: 'string', description: 'Transaction signature' },
                        csplMint: { type: 'string', description: 'Confidential token mint address' },
                        encryptedBalance: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Encrypted balance as hex' },
                        token: { type: 'object', description: 'C-SPL token metadata' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or operation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/cspl/unwrap': {
      post: {
        summary: 'Unwrap confidential tokens back to SPL',
        description: 'Unwraps confidential (C-SPL) tokens back to standard SPL token balance.',
        tags: ['C-SPL'],
        operationId: 'csplUnwrap',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csplMint: { type: 'string', description: 'C-SPL token mint identifier' },
                  encryptedAmount: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Encrypted amount as hex' },
                  owner: solanaAddress,
                  proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Optional proof of ownership' },
                },
                required: ['csplMint', 'encryptedAmount', 'owner'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens unwrapped',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        signature: { type: 'string', description: 'Transaction signature' },
                        amount: { type: 'string', description: 'Decrypted amount as string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or operation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/cspl/transfer': {
      post: {
        summary: 'Confidential token transfer',
        description: 'Transfers confidential (C-SPL) tokens with hidden amount between accounts.',
        tags: ['C-SPL'],
        operationId: 'csplTransfer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csplMint: { type: 'string', description: 'C-SPL token mint identifier' },
                  from: solanaAddress,
                  to: solanaAddress,
                  encryptedAmount: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Encrypted transfer amount as hex' },
                  memo: { type: 'string', maxLength: 256, description: 'Optional memo' },
                },
                required: ['csplMint', 'from', 'to', 'encryptedAmount'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Confidential transfer completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        signature: { type: 'string', description: 'Transaction signature' },
                        newSenderBalance: { type: 'string', pattern: '^0x[0-9a-fA-F]+$', description: 'Updated sender encrypted balance' },
                        recipientPendingUpdated: { type: 'boolean', description: 'Whether recipient pending balance was updated' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation or operation error', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    '/v1/proofs/fulfillment/verify': {
      post: {
        summary: 'Verify fulfillment proof',
        description: 'Verifies a previously generated fulfillment proof.',
        tags: ['Proofs'],
        operationId: 'proofsFulfillmentVerify',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['fulfillment'] },
                  proof: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                  publicInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' } },
                },
                required: ['type', 'proof', 'publicInputs'],
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
                      properties: { valid: { type: 'boolean' } },
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
  // ─── Arcium MPC ──────────────────────────────────────────────────────────
    '/v1/arcium/compute': {
      post: {
        tags: ['Arcium'],
        operationId: 'submitArciumComputation',
        summary: 'Submit MPC computation',
        description: 'Submit an encrypted computation to the Arcium MPC cluster. Returns a computation ID for status polling.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  circuitId: { type: 'string', enum: ['private_transfer', 'check_balance', 'validate_swap'], description: 'Circuit identifier' },
                  encryptedInputs: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' }, minItems: 1, maxItems: 10, description: 'Encrypted inputs as hex strings' },
                  chain: { type: 'string', default: 'solana', description: 'Target chain' },
                  cipher: { type: 'string', enum: ['aes128', 'aes192', 'aes256', 'rescue'], default: 'aes256' },
                  viewingKey: { type: 'object', properties: { key: { type: 'string' }, path: { type: 'string' }, hash: { type: 'string' } } },
                  cluster: { type: 'string', description: 'MPC cluster to use' },
                  timeout: { type: 'integer', description: 'Timeout in milliseconds' },
                },
                required: ['circuitId', 'encryptedInputs'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Computation submitted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    warning: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        computationId: { type: 'string', pattern: '^arc_[0-9a-fA-F]{64}$' },
                        status: { type: 'string', enum: ['submitted'] },
                        estimatedCompletion: { type: 'integer' },
                        circuitId: { type: 'string' },
                        chain: { type: 'string' },
                        inputCount: { type: 'integer' },
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
    '/v1/arcium/compute/{id}/status': {
      get: {
        tags: ['Arcium'],
        operationId: 'getArciumComputationStatus',
        summary: 'Get computation status',
        description: 'Poll the status of an MPC computation. Status progresses: submitted → encrypting → processing → finalizing → completed.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^arc_[0-9a-fA-F]{64}$' }, description: 'Computation ID' },
        ],
        responses: {
          200: {
            description: 'Computation status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        computationId: { type: 'string' },
                        circuitId: { type: 'string' },
                        chain: { type: 'string' },
                        status: { type: 'string', enum: ['submitted', 'encrypting', 'processing', 'finalizing', 'completed'] },
                        progress: { type: 'integer', minimum: 0, maximum: 100 },
                        output: { type: 'string', description: 'Only present when status is completed' },
                        proof: { type: 'string', description: 'Only present when status is completed' },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Computation not found', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/v1/arcium/decrypt': {
      post: {
        tags: ['Arcium'],
        operationId: 'decryptArciumResult',
        summary: 'Decrypt computation result',
        description: 'Decrypt the output of a completed MPC computation using a viewing key.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  computationId: { type: 'string', pattern: '^arc_[0-9a-fA-F]{64}$' },
                  viewingKey: {
                    type: 'object',
                    properties: {
                      key: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                      path: { type: 'string' },
                      hash: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' },
                    },
                    required: ['key', 'path', 'hash'],
                  },
                },
                required: ['computationId', 'viewingKey'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Decryption result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        computationId: { type: 'string' },
                        circuitId: { type: 'string' },
                        decryptedOutput: { type: 'string' },
                        verificationHash: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Decrypt failed or computation incomplete', content: { 'application/json': { schema: errorResponse } } },
          404: { description: 'Computation not found', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
  // ─── Inco FHE ──────────────────────────────────────────────────────────
    '/v1/inco/encrypt': {
      post: {
        tags: ['Inco'],
        operationId: 'encryptIncoValue',
        summary: 'Encrypt value with FHE',
        description: 'Encrypt a plaintext value using Fully Homomorphic Encryption (FHEW or TFHE scheme). Returns ciphertext and noise budget.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  plaintext: { oneOf: [{ type: 'number' }, { type: 'string' }], description: 'Value to encrypt' },
                  scheme: { type: 'string', enum: ['fhew', 'tfhe'], description: 'FHE scheme to use' },
                  label: { type: 'string', description: 'Optional label for the encryption' },
                },
                required: ['plaintext', 'scheme'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Value encrypted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    warning: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        encryptionId: { type: 'string', pattern: '^inc_[0-9a-fA-F]{64}$' },
                        ciphertext: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
                        scheme: { type: 'string', enum: ['fhew', 'tfhe'] },
                        noiseBudget: { type: 'integer' },
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
    '/v1/inco/compute': {
      post: {
        tags: ['Inco'],
        operationId: 'computeIncoCiphertexts',
        summary: 'Compute on encrypted data',
        description: 'Perform a homomorphic operation on FHE ciphertexts. Operations complete synchronously. Tracks noise budget consumption.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  operation: { type: 'string', enum: ['add', 'mul', 'not', 'compare_eq', 'compare_lt'], description: 'Homomorphic operation' },
                  ciphertexts: { type: 'array', items: { type: 'string', pattern: '^0x[0-9a-fA-F]+$' }, minItems: 1, maxItems: 3, description: 'Ciphertexts to operate on' },
                  scheme: { type: 'string', enum: ['fhew', 'tfhe'], default: 'tfhe' },
                },
                required: ['operation', 'ciphertexts'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Computation completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    warning: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        computationId: { type: 'string', pattern: '^inc_[0-9a-fA-F]{64}$' },
                        operation: { type: 'string' },
                        scheme: { type: 'string' },
                        operandCount: { type: 'integer' },
                        resultCiphertext: { type: 'string' },
                        noiseBudgetRemaining: { type: 'integer' },
                        status: { type: 'string', enum: ['completed'] },
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
    '/v1/inco/decrypt': {
      post: {
        tags: ['Inco'],
        operationId: 'decryptIncoResult',
        summary: 'Decrypt FHE computation result',
        description: 'Decrypt the output of a completed FHE computation. Returns the plaintext result.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  computationId: { type: 'string', pattern: '^inc_[0-9a-fA-F]{64}$', description: 'Computation ID to decrypt' },
                },
                required: ['computationId'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Decryption result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        computationId: { type: 'string' },
                        operation: { type: 'string' },
                        decryptedOutput: { type: 'string' },
                        verificationHash: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Decrypt failed or invalid computation ID', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },

    // ─── Private Swap ──────────────────────────────────────────────────────

    '/v1/swap/private': {
      post: {
        tags: ['Swap'],
        operationId: 'privateSwap',
        summary: 'Privacy-preserving token swap via Jupiter DEX',
        description: 'Composite endpoint orchestrating stealth address generation, optional C-SPL wrapping, and Jupiter DEX swap into a single privacy-preserving token swap. Output is routed to a stealth address with Pedersen commitment. Supports ephemeral stealth addresses for agents without persistent meta-address.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sender: solanaAddress,
                  inputMint: { ...solanaAddress, description: 'SPL token mint to swap from' },
                  inputAmount: { ...positiveIntString, description: 'Amount to swap (smallest units)' },
                  outputMint: { ...solanaAddress, description: 'SPL token mint to swap to' },
                  slippageBps: { type: 'integer', minimum: 1, maximum: 10000, default: 50, description: 'Slippage tolerance in basis points (default 50 = 0.5%)' },
                  recipientMetaAddress: {
                    type: 'object',
                    description: 'Optional stealth meta-address. If omitted, an ephemeral one is generated.',
                    properties: {
                      spendingKey: hexString32,
                      viewingKey: hexString32,
                      chain: { type: 'string', enum: ['solana'] },
                      label: { type: 'string' },
                    },
                    required: ['spendingKey', 'viewingKey', 'chain'],
                  },
                },
                required: ['sender', 'inputMint', 'inputAmount', 'outputMint'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Private swap built successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    beta: { type: 'boolean' },
                    warning: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        outputStealthAddress: solanaAddress,
                        ephemeralPublicKey: hexString32,
                        viewTag: { type: 'integer', minimum: 0, maximum: 255 },
                        commitment: { type: 'string', description: 'Pedersen commitment for output amount' },
                        blindingFactor: { type: 'string', description: 'Blinding factor for commitment' },
                        viewingKeyHash: hexString32,
                        sharedSecret: { type: 'string' },
                        inputMint: { type: 'string' },
                        inputAmount: { type: 'string' },
                        outputMint: { type: 'string' },
                        outputAmount: { type: 'string' },
                        outputAmountMin: { type: 'string' },
                        quoteId: { type: 'string', pattern: '^jup_[0-9a-fA-F]{64}$' },
                        priceImpactPct: { type: 'string' },
                        slippageBps: { type: 'integer' },
                        transactions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              type: { type: 'string', enum: ['wrap', 'swap'] },
                              transaction: { type: 'string', description: 'Base64-encoded transaction or signature' },
                              description: { type: 'string' },
                            },
                          },
                        },
                        executionOrder: { type: 'array', items: { type: 'string' } },
                        estimatedComputeUnits: { type: 'integer' },
                        csplWrapped: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error or unsupported token', content: { 'application/json': { schema: errorResponse } } },
          500: { description: 'Swap orchestration failed', content: { 'application/json': { schema: errorResponse } } },
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
    { name: 'Backends', description: 'Privacy backend registry, health monitoring, and selection' },
    { name: 'Proofs', description: 'ZK proof generation and verification (funding, validity, fulfillment, range)' },
    { name: 'C-SPL', description: 'Confidential SPL token operations (wrap, unwrap, transfer)' },
    { name: 'Arcium', description: 'Arcium MPC compute backend — submit computations, poll status, decrypt results' },
    { name: 'Inco', description: 'Inco FHE compute backend — encrypt values, compute on ciphertexts, decrypt results' },
    { name: 'Swap', description: 'Privacy-preserving token swaps via Jupiter DEX with stealth address routing' },
  ],
}
