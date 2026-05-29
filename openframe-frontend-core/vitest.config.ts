import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Skip the lib's own yalc snapshot folder (`.yalc/...` exists when
    // a downstream consumer's worktree symlink is bind-mounted in
    // during dev; the snapshot ships compiled-but-not-test-runnable
    // copies of the source tree and breaks vitest's setup-file
    // resolution). Also skip dist/ + node_modules for safety.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.yalc/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test.tsx',
        'vitest.setup.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

