import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      // HTTP API — mirrors your Nginx `/api` → ${API_URL} (no trailing slash)
      '^/api': {
        target: process.env.API_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // no pathRewrite: keep `/api/...` intact like Nginx did
      },
      // WebSockets — mirrors `/ws` → ${API_URL}/ws
      '^/ws': {
        target: process.env.API_URL || 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      // Realtime WebSocket for voice
      '^/realtime': {
        target: process.env.API_URL || 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
})
