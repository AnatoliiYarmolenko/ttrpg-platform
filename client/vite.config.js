import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setupTests.js',
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
      "@": path.resolve(__dirname, "./src"), // Кажемо, що @ це папка src
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
        },
      },
    },
  },
})
