import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': 'http://localhost:5174',
      '/ws': { target: 'ws://localhost:5174', ws: true },
      '/ws/spectrum': { target: 'ws://localhost:5174', ws: true },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {}, // Disable all proxies in preview mode
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
