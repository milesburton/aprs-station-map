import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/main.tsx',
        'src/App.tsx', // Main app component (tested via E2E)
        'src/vite-env.d.ts',
        'src/test-setup.ts',
        'src/**/index.ts', // Barrel exports
        'src/components/**', // React components (tested via integration)
        'src/hooks/**', // React hooks (tested via components)
        'src/server/**', // Backend code (tested separately)
        'src/utils/logger.ts', // Logging utility (no business logic)
      ],
      thresholds: {
        lines: 97, // Allow some browser-specific code
        functions: 95, // Browser API wrappers excluded
        branches: 85, // Some conditional branches are platform-specific
        statements: 97,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
