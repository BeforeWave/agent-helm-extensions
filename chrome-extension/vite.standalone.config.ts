import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'standalone',
  build: {
    outDir: '../lib/standalone',
    emptyOutDir: true,
  },
})
