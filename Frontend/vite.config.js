import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Frontend y API comparten origen: Vite redirige /api al backend en desarrollo.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
