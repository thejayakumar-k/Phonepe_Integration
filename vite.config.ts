import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure environment variables are available
  envPrefix: 'VITE_',
  // maplibre-gl dynamically loads its Web Worker via `import.meta.url`,
  // which breaks inside Vite's pre-bundled deps (maplibre-gl-worker.mjs
  // is never emitted), leaving the map blank. Serve the real package files.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
