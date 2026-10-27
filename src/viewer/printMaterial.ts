import { MeshBasicMaterial, MeshStandardMaterial, type CanvasTexture, type Mesh } from 'three'
import { PrintSurfaceError } from '../core/printErrors'
import type { PrintUvChannel } from '../core/types'

/**
 * 仅为设计增加独立采样，保留原底材、PBR 参数及所有原始贴图变换
 *
 * @param mesh 已加载但尚未提交的打印 Mesh，只修改其私有几何副本和第一材质槽副本
 * @param texture 共享设计纹理，矩阵与上传方向由 TextureBridge 管理
 * @param channel 与二维布局相同的原始 UV 通道
 * @returns 恢复原绑定并释放私有副本的幂等函数，不释放设计纹理或原模型资源
 */
export function bindDesignMaterial(mesh: Mesh, texture: CanvasTexture, channel: PrintUvChannel): () => void {
  const originalGeometry = mesh.geometry
  const originalMaterial = mesh.material
  const source = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial
  if (!(source instanceof MeshStandardMaterial) && !(source instanceof MeshBasicMaterial)) {
    throw new PrintSurfaceError('PRINT_MATERIAL_UNSUPPORTED', 'Print surface requires a glTF standard, physical, or unlit material')
  }
  const attribute = channel === 0 ? 'uv' : `uv${channel}`
  if (!originalGeometry.getAttribute(attribute)) {
    throw new PrintSurfaceError('PRINT_UV_MISSING', `Print surface ${mesh.name} does not contain UV channel ${channel}`)
  }
  const geometry = originalGeometry.clone()
  geometry.setAttribute('customforgeDesignUv', geometry.getAttribute(attribute))
  const material = source.clone()
  const originalHook = source.onBeforeCompile
  const cacheKey = source.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    originalHook.call(material, shader, renderer)
    if (!shader.vertexShader.includes('#include <common>') || !shader.vertexShader.includes('#include <uv_vertex>') || !shader.fragmentShader.includes('#include <common>') || !shader.fragmentShader.includes('#include <alphamap_fragment>')) {
      throw new PrintSurfaceError('PRINT_MATERIAL_UNSUPPORTED', 'Print material shader does not expose the required design compositing hooks')
    }
    shader.uniforms.customforgeDesignMap = { value: texture }
    shader.uniforms.customforgeDesignMatrix = { value: texture.matrix }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 customforgeDesignUv;\nvarying vec2 vCustomforgeDesignUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCustomforgeDesignUv = customforgeDesignUv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D customforgeDesignMap;\nuniform mat3 customforgeDesignMatrix;\nvarying vec2 vCustomforgeDesignUv;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        vec2 customforgeUv = (customforgeDesignMatrix * vec3(vCustomforgeDesignUv, 1.0)).xy;
        vec4 customforgeDesign = texture2D(customforgeDesignMap, customforgeUv);
        float customforgeAlpha = customforgeDesign.a + diffuseColor.a * (1.0 - customforgeDesign.a);
        vec3 customforgePremultiplied = customforgeDesign.rgb * customforgeDesign.a + diffuseColor.rgb * diffuseColor.a * (1.0 - customforgeDesign.a);
        diffuseColor = vec4(customforgeAlpha > 0.0 ? customforgePremultiplied / customforgeAlpha : vec3(0.0), customforgeAlpha);
      `)
  }
  material.customProgramCacheKey = () => `${cacheKey}|customforge-design-v1`
  material.needsUpdate = true
  mesh.geometry = geometry
  mesh.material = Array.isArray(originalMaterial) ? [material, ...originalMaterial.slice(1)] : material
  let released = false
  return () => {
    if (released) return
    released = true
    mesh.geometry = originalGeometry
    mesh.material = originalMaterial
    material.dispose()
    geometry.dispose()
  }
}
