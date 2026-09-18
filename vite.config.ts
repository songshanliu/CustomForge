import { defineConfig } from 'vite'

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  server: {
    host: '127.0.0.1',
  },
})

