import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts', 'src/app.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
})
