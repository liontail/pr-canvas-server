import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  base: '/_app/',
  plugins: [preact()],
  build: {
    outDir: here('../public'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: here('./src/main.jsx') },
  },
  server: { proxy: { '/api': 'http://localhost:3000', '/c': 'http://localhost:3000' } },
})
