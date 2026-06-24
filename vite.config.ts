import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@mediapipe/pose': path.resolve(__dirname, 'src/stubs/mediapipe-pose.ts'),
    },
  },
})
