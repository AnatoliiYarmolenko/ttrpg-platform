import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path, { dirname }  from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  envDir: '../',
  plugins: [react()],
  cacheDir: '/tmp/ttrpg-platform-client-vite-cache',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setupTests.js',
    fileParallelism: false,
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      treeshake: {
        annotations: true,
        moduleSideEffects: false,
      },
      output: {
        manualChunks(id) {
          const vendorPackages = ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'];
          if (vendorPackages.some(pkg => id.includes(`/node_modules/${pkg}/`))) {
            return 'vendor';
          }
        },
      },
    },
  },
})
