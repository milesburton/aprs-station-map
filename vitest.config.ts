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
        'src/App.tsx',
        'src/vite-env.d.ts',
        'src/test-setup.ts',
        'src/**/index.ts',
        'src/components/**',
        'src/server/index.ts',
        'src/server/kiss-client.ts',
        'src/server/state-manager.ts',
        'src/server/spectrum-analyzer.ts',
        'src/utils/logger.ts',
        'src/lib/**',
        'src/server/test-factories.ts',
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
