import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, ShaderLib, ShaderMaterial, Texture, type WebGLRenderer } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindDesignMaterial } from './printMaterial'

function geometry(): BufferGeometry {
  const result = new BufferGeometry()
  result.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  result.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2))
  result.setAttribute('uv1', new Float32BufferAttribute([-2, 0, -1, 0, -2, 1], 2))
  return result
}

describe('independent design sampling', () => {
  it('T22 preserves shared geometry, PBR maps, factors and their original transforms', () => {
    const originalGeometry = geometry()
    const map = new Texture()
    map.channel = 1
    map.repeat.set(2, 3)
    map.offset.set(0.2, 0.4)
    map.rotation = 0.3
    const source = new MeshPhysicalMaterial({ map, color: '#aabbcc', metalness: 0.42, roughness: 0.17, transparent: true, opacity: 0.7, clearcoat: 0.6 })
    const otherSlot = new MeshStandardMaterial()
    const mesh = new Mesh(originalGeometry, [source, otherSlot])
    const shared = new Mesh(originalGeometry, source)
    const design = new CanvasTexture({} as HTMLCanvasElement)
    const originalGeometryDispose = vi.spyOn(originalGeometry, 'dispose')
    const originalMaterialDispose = vi.spyOn(source, 'dispose')
    const designDispose = vi.spyOn(design, 'dispose')
    const release = bindDesignMaterial(mesh, design, 1)
    const material = (mesh.material as MeshPhysicalMaterial[])[0]
    const privateGeometryDispose = vi.spyOn(mesh.geometry, 'dispose')
    expect(mesh.geometry).not.toBe(originalGeometry)
    expect(shared.geometry).toBe(originalGeometry)
    expect(shared.material).toBe(source)
    expect(material).toMatchObject({ map, metalness: 0.42, roughness: 0.17, opacity: 0.7, transparent: true, clearcoat: 0.6 })
    expect(material.color.equals(source.color)).toBe(true)
    expect((mesh.material as MeshPhysicalMaterial[])[1]).toBe(otherSlot)
    expect(map.repeat.toArray()).toEqual([2, 3])
    expect(map.offset.toArray()).toEqual([0.2, 0.4])
    expect(map.rotation).toBe(0.3)
    expect(map.channel).toBe(1)
    expect(mesh.geometry.getAttribute('customforgeDesignUv')).toBe(mesh.geometry.getAttribute('uv1'))
    expect(originalGeometry.getAttribute('customforgeDesignUv')).toBeUndefined()
    release()
    release()
    expect(mesh.geometry).toBe(originalGeometry)
    expect((mesh.material as MeshPhysicalMaterial[])[0]).toBe(source)
    expect(privateGeometryDispose).toHaveBeenCalledTimes(1)
    expect(originalGeometryDispose).not.toHaveBeenCalled()
    expect(originalMaterialDispose).not.toHaveBeenCalled()
    expect(designDispose).not.toHaveBeenCalled()
  })

  it.each([MeshStandardMaterial, MeshBasicMaterial])('keeps the original shader hook and composites via independent alpha sampling for %s', (Material) => {
    const source = new Material()
    source.onBeforeCompile = (shader) => { shader.uniforms.originalProbe = { value: true } }
    const mesh = new Mesh(geometry(), source)
    const design = new CanvasTexture({} as HTMLCanvasElement)
    const release = bindDesignMaterial(mesh, design, 0)
    const material = mesh.material as MeshStandardMaterial
    const shader = { ...ShaderLib.standard, uniforms: {} } as Parameters<MeshStandardMaterial['onBeforeCompile']>[0]
    material.onBeforeCompile(shader, {} as WebGLRenderer)
    expect(shader.uniforms.originalProbe.value).toBe(true)
    expect(shader.uniforms.customforgeDesignMap.value).toBe(design)
    expect(shader.uniforms.customforgeDesignMatrix.value).toBe(design.matrix)
    expect(shader.vertexShader).toContain('vCustomforgeDesignUv = customforgeDesignUv')
    expect(shader.fragmentShader).toContain('customforgeDesign.a + diffuseColor.a * (1.0 - customforgeDesign.a)')
    expect(shader.fragmentShader).not.toContain('1.0 - customforgeUv.y')
    release()
  })

  it('rejects missing UV or unsupported material before modifying the mesh', () => {
    const originalGeometry = geometry()
    const source = new ShaderMaterial()
    const mesh = new Mesh(originalGeometry, source)
    const design = new CanvasTexture({} as HTMLCanvasElement)
    expect(() => bindDesignMaterial(mesh, design, 0)).toThrow('glTF standard')
    expect(mesh.geometry).toBe(originalGeometry)
    expect(mesh.material).toBe(source)
    expect(() => bindDesignMaterial(new Mesh(originalGeometry, new MeshStandardMaterial()), design, 2)).toThrow('channel 2')
  })
})
