import { defineConfig } from 'vite'

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  server: {
    host: '0.0.0.0',
  },
})

