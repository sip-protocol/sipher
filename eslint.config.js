// ESLint flat config (v9+).
//
// Scope: only enforces a single guard rule across the agent package, banning
// direct reads of process.env.SOLANA_NETWORK and process.env.SOLANA_RPC_URL
// outside the canonical site `packages/agent/src/config/network.ts`. This is
// the rule that prevents the silent-mainnet-leak class of bugs from coming
// back after the B12/B13 migrations.
//
// We deliberately don't enable typescript-eslint rules yet — the project's
// existing style is enforced by tsc + Prettier at the file level, and dragging
// in lots of rules would create a wave of drive-by changes the
// auth-surface-hardening PR shouldn't carry. The plugin IS registered so that
// existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
// comments scattered through herald/tools/*.ts validate (referencing a rule
// from an unregistered plugin would itself error).

import tsParser from '@typescript-eslint/parser'
import tseslint from 'typescript-eslint'

export default [
  // Global ignores — build artifacts, node_modules, and any generated dist
  // output anywhere in the workspace. Without this, `pnpm build` populates
  // `packages/agent/dist/` and a subsequent `pnpm lint` scans those .js
  // files (which carry the same disable-directive scaffolding as src) and
  // errors on the unregistered plugin reference (no flat-config block
  // matches them, so the typescript-eslint plugin isn't loaded for that
  // scan path).
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      'packages/agent/coverage/**',
    ],
  },
  {
    files: ['packages/agent/src/**/*.ts'],
    ignores: [
      'packages/agent/src/config/network.ts',
      'packages/agent/src/**/__tests__/**',
      'packages/agent/src/**/*.test.ts',
      'packages/agent/src/**/*.spec.ts',
    ],
    linterOptions: {
      // Pre-existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
      // comments live across herald/tools/* from before any ESLint setup. We
      // load the plugin (so the rule name resolves) but don't enable the rule
      // — the disable directives are no-ops, and we suppress the warning that
      // otherwise screams about every one of them. Dropping the dead
      // directives is a separate cleanup.
      reportUnusedDisableDirectives: false,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(SOLANA_NETWORK|SOLANA_RPC_URL)$/]",
          message:
            'Use loadNetworkConfig() instead of reading process.env.SOLANA_NETWORK / SOLANA_RPC_URL directly. See packages/agent/src/config/network.ts.',
        },
      ],
    },
  },
]
