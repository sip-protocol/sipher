import { defineConfig } from 'tsup'

// Dev/watch build for the agent entrypoint.
// tsx's ESM loader cannot instantiate @bonfida/spl-name-service@3.0.21's
// vendored borsh ESM bundle (see #253); building with tsup (esbuild) and
// running the output with plain `node` avoids that loader entirely.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Transpile only the agent's own source; let Node resolve node_modules at
  // runtime. Bundling the transitive CJS chain (bs58 -> safe-buffer ->
  // require("buffer")) into a single ESM file breaks with "Dynamic require
  // not supported". Plain Node handles those deps (and Bonfida's ESM) fine.
  skipNodeModulesBundle: true,
})
