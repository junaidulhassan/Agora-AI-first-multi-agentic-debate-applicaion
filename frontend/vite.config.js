import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const backend = process.env.AGORA_BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: backend, ws: true, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
})
