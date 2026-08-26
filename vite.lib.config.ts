import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    minify: false,
    outDir: 'dist',
    rolldownOptions: {
      external: [/^fabric(?:\/.*)?$/, /^three(?:\/.*)?$/],
    },
    sourcemap: true,
    target: 'es2022',
  },
})
