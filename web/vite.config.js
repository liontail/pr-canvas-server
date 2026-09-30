import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  base: '/_app/',
  plugins: [preact(), tailwindcss()],
  resolve: { alias: { '@': here('./src') } },
  build: {
    outDir: here('../public'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: here('./src/main.jsx') },
  },
  server: { proxy: { '/api': 'http://localhost:3000', '/c': 'http://localhost:3000' } },
})
