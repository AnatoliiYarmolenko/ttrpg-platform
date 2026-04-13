import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path, { dirname }  from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Або '0.0.0.0' - дозволяє доступ ззовні контейнера
    port: 5173, // Стандартний порт Vite
    strictPort: true, // Якщо порт зайнятий, Vite не буде шукати інший
    //watch: {
    //  usePolling: true, // КРИТИЧНО: змушує Vite примусово сканувати файли на зміни
    //  interval: 500,
    //  ignored: ['**/node_modules/**', '**/.git/**'], // Інтервал перевірки в мілісекундах (опціонально)
    //},
    hmr: {
      clientPort: 5173, // Вказуємо браузеру, куди стукати по WebSockets
    },
  },
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
