import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Versão atual da extensão (extension/manifest.json) — o site compara com a instalada e avisa pra baixar a nova.
const extVersion = JSON.parse(readFileSync(new URL('./extension/manifest.json', import.meta.url), 'utf8')).version

export default defineConfig({
  plugins: [react()],
  define: { __EXT_VERSION__: JSON.stringify(extVersion) },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
