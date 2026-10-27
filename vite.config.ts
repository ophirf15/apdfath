import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { convertPlugin } from './server/vite-convert-plugin'

export default defineConfig({
  plugins: [react(), convertPlugin()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
