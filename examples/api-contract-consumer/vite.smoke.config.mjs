import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, normalizePath, searchForWorkspaceRoot } from 'vite'

const baseline = process.env.CUSTOMFORGE_SMOKE_BASELINE

// 仅由回归脚本显式启用，开发页面不会暴露任意本地文件路径
export default defineConfig({
  ...(baseline ? { server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), baseline] } } } : {}),
  plugins: [{
    name: 'customforge-smoke-model',
    enforce: 'pre',
    resolveId(source, importer) {
      if (baseline && importer?.startsWith(normalizePath(resolve(baseline))) && (source === 'fabric' || source === 'three' || source.startsWith('three/'))) {
        return this.resolve(source, resolve(process.cwd(), 'src/main.ts'), { skipSelf: true })
      }
    },
    async configureServer(server) {
      const path = process.env.CUSTOMFORGE_SMOKE_MODEL
      if (!path) return
      const bytes = await readFile(path)
      server.middlewares.use('/__customforge_smoke/model.glb', (_request, response) => {
        response.setHeader('Content-Type', 'model/gltf-binary')
        response.setHeader('Cache-Control', 'no-store')
        response.end(bytes)
      })
    },
  }],
})
