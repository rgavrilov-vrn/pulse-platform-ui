import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Прокси на Spring Boot. Фронтенд обращается к /api/... — Vite перешлёт на backend.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // context-path бэкенда /pulse-platform уже включён в URL
        rewrite: (path) => `/pulse-platform${path}`,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
