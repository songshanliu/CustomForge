import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        workbench: 'src/workbench/index.ts',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
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
