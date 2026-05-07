import { defineConfig } from 'vitest/config'

// Tests run with SIPHER_NETWORK=devnet + SIPHER_HELIUS_API_KEY=test-key
// pre-set so any tool that goes through loadNetworkConfig() (post-B12/B13
// migration) gets a deterministic config instead of FATAL on unset env.
// Tests that exercise loadNetworkConfig itself (config/network.test.ts)
// mutate these freely — vitest restores process.env between worker forks.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
    env: {
      SIPHER_NETWORK: 'devnet',
      SIPHER_HELIUS_API_KEY: 'test-key',
    },
  },
})
