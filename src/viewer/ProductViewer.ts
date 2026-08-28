import {
  ACESFilmicToneMapping,
  Box3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type Material,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { NormalizedProductConfiguration } from '../core/config'
import type { DesignArea, ProductProcessingProgress } from '../core/types'
import { createCandidateOverlayGeometry } from '../design-area/overlayGeometry'
import {
  XAtlasInitializationError,
  XAtlasParameterizer,
} from '../design-area/XAtlasParameterizer'
import { createSurfaceGeometrySnapshot } from '../processing/geometrySnapshot'
import {
  SurfaceAnalysisCancelledError,
  SurfaceAnalysisCoordinator,
} from '../processing/SurfaceAnalysisCoordinator'
import type { SurfaceCandidate } from '../processing/types'
import { extractUvGuideLayout, type UvGuideLayout } from './uvLayout'

interface AutomaticAreaRecord {
  area: DesignArea
  candidate: SurfaceCandidate
  guideLayout: UvGuideLayout
  material: MeshStandardMaterial
  overlay: Mesh
}

/** 查看器为一个设计区域返回的公共信息和内部辅助轮廓 */
export interface ProductViewerDesignArea {
  /** 可通过 ProductCustomizer 查询的区域信息 */
  area: DesignArea

  /** 由来源三角形和最终 UV 生成的稳定区域指纹 */
  areaFingerprint: string

  /** 二维编辑器显示的当前区域 UV 边界 */
  guideLayout: UvGuideLayout
}

/** 查看器完成产品加载后返回的设计区域集合 */
export interface ProductViewerLoadResult {
  /** 按自动评分或配置顺序排列的设计区域 */
  designAreas: ProductViewerDesignArea[]

  /** 由静态 Mesh 路径、位置、索引和材质分组生成的稳定模型指纹 */
  modelFingerprint: string
}

type ProgressListener = (progress: ProductProcessingProgress) => void

/**
 * 基于 Three.js 的三维产品查看器
 *
 * 自动模式会分析全部受支持的静态 Mesh，为候选表面生成独立 UV 覆盖 Mesh，
 * 原模型的几何体、材质和纹理保持不变
 */
export class ProductViewer {
  private readonly host: HTMLElement
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(35, 1, 0.05, 100)
  private readonly renderer: WebGLRenderer
  private readonly controls: OrbitControls
  private readonly loader = new GLTFLoader()
  private readonly resizeObserver: ResizeObserver
  private readonly textureWidth: number
  private readonly textureHeight: number
  private readonly floor: Mesh
  private readonly analysisCoordinator = new SurfaceAnalysisCoordinator()
  private readonly parameterizer = new XAtlasParameterizer()
  private readonly automaticAreas = new Map<string, AutomaticAreaRecord>()
  private readonly meshIds = new Map<Mesh, string>()
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private productRoot?: Object3D
  private surface?: Mesh
  private configuredAreaId?: string
  private surfacePickListener?: (areaId: string) => void
  private loadSequence = 0
  private animationFrame = 0

  /**
   * @param host 三维查看器挂载容器
   * @param textureWidth 二维输出纹理宽度，单位为像素
   * @param textureHeight 二维输出纹理高度，单位为像素
   */
  constructor(host: HTMLElement, textureWidth: number, textureHeight: number) {
    this.host = host
    this.textureWidth = textureWidth
    this.textureHeight = textureHeight
    host.replaceChildren()

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D product preview',
    )
    this.renderer.domElement.classList.add('customforge-viewer-canvas')
    this.renderer.domElement.addEventListener('click', this.handleSurfacePick)
    host.append(this.renderer.domElement)
    host.dataset.renderState = 'pending'

    this.scene.background = new Color('#eef0ef')
    this.camera.position.set(4.6, 2.8, 5.8)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0, 0)

    this.floor = this.addEnvironment()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.render()
  }

  /**
   * 加载产品并生成可编辑区域
   *
   * 自动模式支持 URL 和资源自包含的 GLB Blob 或 ArrayBuffer，
   * 几何分区和 xatlas 参数化均在 Worker 中执行
   *
   * @param product 已完成默认值补全的产品配置
   * @param onProgress 自动模型处理进度监听器
   * @returns 按评分排列的设计区域和二维辅助轮廓
   * @throws 模型不受支持、未找到候选区域或 UV 参数化全部失败时抛出错误
   */
  async loadProduct(
    product: NormalizedProductConfiguration,
    onProgress?: ProgressListener,
  ): Promise<ProductViewerLoadResult> {
    const sequence = ++this.loadSequence
    this.analysisCoordinator.cancel()
    this.removeProduct()
    onProgress?.({
      stage: 'loading-model',
      progress: 0,
      completed: 0,
      total: 1,
    })

    const loaded = await this.loadProductRoot(product)
    if (sequence !== this.loadSequence) {
      this.disposeObject(loaded.root)
      throw new SurfaceAnalysisCancelledError()
    }
    onProgress?.({
      stage: 'loading-model',
      progress: 1,
      completed: 1,
      total: 1,
    })

    this.productRoot = loaded.root
    this.scene.add(loaded.root)
    this.fitCamera(loaded.root)
    try {
      const designAreas = product.designAreas.mode === 'auto'
        ? await this.createAutomaticAreas(
            loaded.root,
            product,
            sequence,
            onProgress,
          )
        : [
            this.createConfiguredArea(
              loaded.root,
              loaded.demoSurface,
              product,
            ),
          ]
      if (sequence !== this.loadSequence) {
        throw new SurfaceAnalysisCancelledError()
      }
      onProgress?.({
        stage: 'preparing-editor',
        progress: 1,
        completed: 1,
        total: 1,
      })
      return {
        designAreas,
        modelFingerprint: this.createModelFingerprint(loaded.root),
      }
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.removeProduct()
      }
      throw error
    }
  }

  /**
   * 将单区域纹理绑定到 existing-UV 目标 Mesh
   *
   * 新的多区域调用方应使用 `setDesignAreaTexture()` 指定区域
   *
   * @param texture 由二维输出 Canvas 创建的纹理
   */
  setTexture(texture: CanvasTexture): void {
    this.attachConfiguredTexture(texture)
  }

  /**
   * 将区域独立纹理绑定到自动覆盖 Mesh 或 existing-uv 目标 Mesh
   *
   * @param areaId 当前产品内的设计区域 ID
   * @param texture 由区域输出 Canvas 创建的纹理
   * @throws 区域不存在时抛出错误
   */
  setDesignAreaTexture(areaId: string, texture: CanvasTexture): void {
    const automatic = this.automaticAreas.get(areaId)
    if (automatic) {
      automatic.material.map = texture
      automatic.material.needsUpdate = true
      return
    }
    if (this.surface && this.configuredAreaId === areaId) {
      this.attachConfiguredTexture(texture)
      return
    }
    throw new Error('Design area was not found in the viewer: ' + areaId)
  }

  /**
   * 设置当前活动区域并更新三维区域状态
   *
   * @param areaId 当前产品内的设计区域 ID
   * @throws 区域不存在时抛出错误
   */
  setActiveDesignArea(areaId: string): void {
    if (
      !this.automaticAreas.has(areaId) &&
      this.configuredAreaId !== areaId
    ) {
      throw new Error('Design area was not found in the viewer: ' + areaId)
    }
    for (const [id, record] of this.automaticAreas) {
      record.overlay.renderOrder = id === areaId ? 20 : 10
      record.material.emissive.set(id === areaId ? '#12383d' : '#000000')
      record.material.emissiveIntensity = id === areaId ? 0.12 : 0
    }
  }

  /**
   * 进入三维表面候选选择模式
   *
   * 当前实现会选择包含命中三角形的自动候选；候选未直接包含命中点时，
   * 降级为命中 Mesh 上评分最高的候选
   *
   * @param listener 成功命中候选后接收区域 ID 的函数
   * @throws 当前产品未启用自动区域时抛出错误
   */
  beginSurfacePick(listener: (areaId: string) => void): void {
    if (this.automaticAreas.size === 0) {
      throw new Error('Surface picking requires automatic design areas')
    }
    this.surfacePickListener = listener
    this.controls.enabled = false
    this.renderer.domElement.dataset.surfacePick = 'active'
  }

  /** 退出三维表面候选选择模式 */
  cancelSurfacePick(): void {
    this.surfacePickListener = undefined
    this.controls.enabled = true
    delete this.renderer.domElement.dataset.surfacePick
  }

  /** 返回当前是否等待用户点击三维表面 */
  isSurfacePickActive(): boolean {
    return this.surfacePickListener !== undefined
  }

  /** 根据当前模型包围盒恢复默认相机位置 */
  resetView(): void {
    if (this.productRoot) {
      this.fitCamera(this.productRoot)
    }
  }

  /** 释放分析任务、动画帧、相机控制、模型材质和 WebGLRenderer */
  destroy(): void {
    this.loadSequence += 1
    this.analysisCoordinator.destroy()
    this.cancelSurfacePick()
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.removeProduct()
    this.renderer.domElement.removeEventListener('click', this.handleSurfacePick)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private async loadProductRoot(
    product: NormalizedProductConfiguration,
  ): Promise<{ root: Object3D; demoSurface?: Mesh }> {
    const source = product.model ?? product.modelUrl
    if (!source) {
      const demo = this.createDemoProduct()
      return { root: demo.root, demoSurface: demo.surface }
    }
    if (typeof source === 'string') {
      const gltf = await this.loader.loadAsync(source)
      return { root: gltf.scene }
    }
    const buffer = source instanceof Blob
      ? await source.arrayBuffer()
      : source.slice(0)
    const gltf = await this.loader.parseAsync(buffer, '')
    return { root: gltf.scene }
  }

  private async createAutomaticAreas(
    root: Object3D,
    product: NormalizedProductConfiguration,
    sequence: number,
    onProgress?: ProgressListener,
  ): Promise<ProductViewerDesignArea[]> {
    onProgress?.({
      stage: 'inspecting-geometry',
      progress: 0,
      completed: 0,
      total: 1,
    })
    const meshes = this.collectStaticMeshes(root)
    if (meshes.length === 0) {
      throw new Error('Model does not contain a supported static triangle Mesh')
    }
    const snapshots = meshes.map(({ id, mesh }) =>
      createSurfaceGeometrySnapshot(id, mesh.geometry),
    )
    onProgress?.({
      stage: 'inspecting-geometry',
      progress: 1,
      completed: meshes.length,
      total: meshes.length,
    })
    onProgress?.({
      stage: 'finding-design-areas',
      progress: 0,
      completed: 0,
      total: meshes.length,
    })
    const angles = product.designAreas.strategy === 'flat'
      ? { adjacent: 34, deviation: 42 }
      : product.designAreas.strategy === 'visible'
        ? { adjacent: 52, deviation: 68 }
        : { adjacent: 44, deviation: 58 }
    const analysis = await this.analysisCoordinator.analyze(
      snapshots,
      {
        maxAreas: Math.min(product.designAreas.maxAreas * 3, 12),
        adjacentAngleDegrees: angles.adjacent,
        normalDeviationDegrees: angles.deviation,
        minimumAreaRatio: 0.004,
      },
      ({ completedMeshes, totalMeshes }) => {
        onProgress?.({
          stage: 'finding-design-areas',
          progress: completedMeshes / Math.max(totalMeshes, 1),
          completed: completedMeshes,
          total: totalMeshes,
        })
      },
    )
    if (sequence !== this.loadSequence) {
      throw new SurfaceAnalysisCancelledError()
    }
    if (analysis.candidates.length === 0) {
      throw new Error('No usable automatic design area was found')
    }

    const sourceMeshes = new Map(meshes.map(({ id, mesh }) => [id, mesh]))
    const designAreas: ProductViewerDesignArea[] = []
    const total = Math.min(
      analysis.candidates.length,
      product.designAreas.maxAreas,
    )
    onProgress?.({
      stage: 'unwrapping-surface',
      progress: 0,
      completed: 0,
      total,
    })
    for (const candidate of analysis.candidates) {
      if (designAreas.length >= product.designAreas.maxAreas) {
        break
      }
      const source = sourceMeshes.get(candidate.meshId)
      if (!source) {
        continue
      }
      let geometry = createCandidateOverlayGeometry(source, candidate)
      try {
        geometry = await this.parameterizer.unwrap(
          geometry,
          product.designAreas.textureSize,
          this.textureWidth,
          this.textureHeight,
          ({ progress }) => {
            onProgress?.({
              stage: 'unwrapping-surface',
              progress: Math.min(
                (designAreas.length + progress) / Math.max(total, 1),
                1,
              ),
              completed: designAreas.length,
              total,
            })
          },
        )
      } catch (error) {
        geometry.dispose()
        if (error instanceof XAtlasInitializationError) {
          throw error
        }
        continue
      }
      if (sequence !== this.loadSequence) {
        geometry.dispose()
        throw new SurfaceAnalysisCancelledError()
      }
      const material = new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.45,
        metalness: 0,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: DoubleSide,
      })
      const overlay = new Mesh(geometry, material)
      overlay.name = 'CustomForgeDesignArea-' + (designAreas.length + 1)
      overlay.castShadow = false
      overlay.receiveShadow = false
      overlay.renderOrder = 10
      source.add(overlay)

      const area: DesignArea = {
        id: candidate.id,
        label: 'Area ' + (designAreas.length + 1),
        source: 'auto',
        score: candidate.score,
        confidence: candidate.score,
        textureSize: product.designAreas.textureSize,
        metrics: {
          surfaceArea: candidate.areaRatio * analysis.surfaceArea,
          visibility: 0,
          compactness: candidate.compactness,
          angleDistortion: 1 - candidate.normalConsistency,
          areaDistortion: 1 - candidate.compactness,
        },
      }
      const guideLayout = extractUvGuideLayout(geometry)
      const record: AutomaticAreaRecord = {
        area,
        candidate,
        guideLayout,
        material,
        overlay,
      }
      this.automaticAreas.set(area.id, record)
      designAreas.push({
        area,
        areaFingerprint: this.createAreaFingerprint(
          candidate.meshId,
          candidate.triangleIndices,
          geometry,
        ),
        guideLayout,
      })
      onProgress?.({
        stage: 'unwrapping-surface',
        progress: designAreas.length / Math.max(total, 1),
        completed: designAreas.length,
        total,
      })
    }
    if (designAreas.length === 0) {
      throw new Error('Automatic UV parameterization failed for every candidate')
    }
    return designAreas
  }

  private createConfiguredArea(
    root: Object3D,
    demoSurface: Mesh | undefined,
    product: NormalizedProductConfiguration,
  ): ProductViewerDesignArea {
    const surface = demoSurface ?? this.findSurface(root, product.surfaceMesh)
    const id = 'existing-uv:' + product.surfaceMesh
    const guideLayout = extractUvGuideLayout(surface.geometry)
    const area: DesignArea = {
      id,
      label: 'Area 1',
      source: 'configured',
      score: 1,
      confidence: 1,
      textureSize: product.designAreas.textureSize,
      metrics: {
        surfaceArea: 0,
        visibility: 0,
        compactness: 1,
        angleDistortion: 0,
        areaDistortion: 0,
      },
    }
    this.surface = surface
    this.configuredAreaId = id
    return {
      area,
      areaFingerprint: this.createAreaFingerprint(
        id,
        undefined,
        surface.geometry,
      ),
      guideLayout,
    }
  }

  private createAreaFingerprint(
    sourceId: string,
    sourceTriangleIndices: Uint32Array | undefined,
    geometry: Mesh['geometry'],
  ): string {
    let primaryHash = 2_166_136_261
    let secondaryHash = 2_654_435_761
    const updateByte = (value: number): void => {
      primaryHash ^= value
      primaryHash = Math.imul(primaryHash, 16_777_619) >>> 0
      secondaryHash ^= value
      secondaryHash = Math.imul(secondaryHash, 2_246_822_519) >>> 0
      secondaryHash ^= secondaryHash >>> 13
    }
    const updateString = (value: string): void => {
      for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        updateByte(code & 0xff)
        updateByte(code >>> 8)
      }
    }
    const scratch = new DataView(new ArrayBuffer(4))
    const updateNumber = (value: number): void => {
      scratch.setFloat32(0, value, true)
      for (let offset = 0; offset < 4; offset += 1) {
        updateByte(scratch.getUint8(offset))
      }
    }

    updateString(sourceId)
    sourceTriangleIndices?.forEach(updateNumber)
    const uv = geometry.getAttribute('uv')
    if (uv) {
      for (let index = 0; index < uv.count; index += 1) {
        updateNumber(uv.getX(index))
        updateNumber(uv.getY(index))
      }
    }
    const geometryIndex = geometry.index
    if (geometryIndex) {
      for (let index = 0; index < geometryIndex.count; index += 1) {
        updateNumber(geometryIndex.getX(index))
      }
    }
    return 'area-' +
      primaryHash.toString(16).padStart(8, '0') +
      secondaryHash.toString(16).padStart(8, '0')
  }

  private collectStaticMeshes(root: Object3D): Array<{ id: string; mesh: Mesh }> {
    const entries: Array<{ id: string; mesh: Mesh }> = []
    const visit = (object: Object3D, path: string): void => {
      object.children.forEach((child, index) => {
        const segment = (child.name.trim() || child.type) + '[' + index + ']'
        const childPath = path + '/' + segment
        if (child instanceof Mesh) {
          const flags = child as Mesh & {
            isInstancedMesh?: boolean
            isSkinnedMesh?: boolean
          }
          const morphAttributes = child.geometry.morphAttributes
          const hasMorphTargets = [
            morphAttributes.position,
            morphAttributes.normal,
            morphAttributes.color,
          ].some((attributes) => (attributes?.length ?? 0) > 0)
          if (
            !flags.isInstancedMesh &&
            !flags.isSkinnedMesh &&
            !hasMorphTargets
          ) {
            entries.push({ id: childPath, mesh: child })
            this.meshIds.set(child, childPath)
          }
        }
        visit(child, childPath)
      })
    }
    visit(root, 'scene')
    return entries
  }

  private createModelFingerprint(root: Object3D): string {
    let primaryHash = 2_166_136_261
    let secondaryHash = 2_654_435_761
    const updateByte = (value: number): void => {
      primaryHash ^= value
      primaryHash = Math.imul(primaryHash, 16_777_619) >>> 0
      secondaryHash ^= value
      secondaryHash = Math.imul(secondaryHash, 2_246_822_519) >>> 0
      secondaryHash ^= secondaryHash >>> 13
    }
    const updateString = (value: string): void => {
      for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        updateByte(code & 0xff)
        updateByte(code >>> 8)
      }
    }
    const scratch = new DataView(new ArrayBuffer(4))
    const updateNumber = (value: number): void => {
      scratch.setFloat32(0, value, true)
      for (let offset = 0; offset < 4; offset += 1) {
        updateByte(scratch.getUint8(offset))
      }
    }
    const visit = (object: Object3D, path: string): void => {
      object.children.forEach((child, index) => {
        const segment = (child.name.trim() || child.type) + '[' + index + ']'
        const childPath = path + '/' + segment
        if (child instanceof Mesh && !child.name.startsWith('CustomForgeDesignArea-')) {
          updateString(childPath)
          const position = child.geometry.getAttribute('position')
          if (position) {
            for (let vertex = 0; vertex < position.count; vertex += 1) {
              updateNumber(position.getX(vertex))
              updateNumber(position.getY(vertex))
              updateNumber(position.getZ(vertex))
            }
          }
          const indexAttribute = child.geometry.index
          if (indexAttribute) {
            for (let offset = 0; offset < indexAttribute.count; offset += 1) {
              updateNumber(indexAttribute.getX(offset))
            }
          }
          for (const group of child.geometry.groups) {
            updateNumber(group.start)
            updateNumber(group.count)
            updateNumber(group.materialIndex ?? 0)
          }
        }
        visit(child, childPath)
      })
    }
    visit(root, 'scene')
    return 'cf-' +
      primaryHash.toString(16).padStart(8, '0') +
      secondaryHash.toString(16).padStart(8, '0')
  }

  private addEnvironment(): Mesh {
    const sky = new HemisphereLight('#ffffff', '#7c8581', 2.2)
    this.scene.add(sky)
    const key = new DirectionalLight('#ffffff', 3.8)
    key.position.set(4, 6, 5)
    key.castShadow = true
    this.scene.add(key)
    const fill = new DirectionalLight('#b7dce0', 1.2)
    fill.position.set(-5, 2, 3)
    this.scene.add(fill)
    const floor = new Mesh(
      new PlaneGeometry(30, 30),
      new MeshStandardMaterial({ color: '#dfe3e1', roughness: 0.95 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.34
    floor.receiveShadow = true
    this.scene.add(floor)
    return floor
  }

  private createDemoProduct(): { root: Group; surface: Mesh } {
    const root = new Group()
    root.rotation.y = MathUtils.degToRad(-14)
    const bodyMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.42,
      metalness: 0,
    })
    const surface = new Mesh(
      new CylinderGeometry(1.28, 1.16, 2.35, 96, 1, true),
      bodyMaterial,
    )
    surface.name = 'PrintArea'
    surface.castShadow = true
    surface.receiveShadow = true
    root.add(surface)
    const ceramic = new MeshStandardMaterial({
      color: '#f4f4f1',
      roughness: 0.35,
    })
    const rim = new Mesh(new TorusGeometry(1.28, 0.08, 20, 96), ceramic)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.18
    rim.castShadow = true
    root.add(rim)
    const inside = new Mesh(
      new CircleGeometry(1.2, 96),
      new MeshStandardMaterial({ color: '#29312f', roughness: 0.7 }),
    )
    inside.rotation.x = -Math.PI / 2
    inside.position.y = 1.16
    root.add(inside)
    const bottom = new Mesh(new CircleGeometry(1.15, 96), ceramic)
    bottom.rotation.x = Math.PI / 2
    bottom.position.y = -1.17
    root.add(bottom)
    return { root, surface }
  }

  private findSurface(root: Object3D, meshName: string): Mesh {
    const object = root.getObjectByName(meshName)
    if (!(object instanceof Mesh)) {
      throw new Error('Customizable mesh was not found: ' + meshName)
    }
    return object
  }

  private attachConfiguredTexture(texture: CanvasTexture): void {
    if (!this.surface) {
      return
    }
    const materials = Array.isArray(this.surface.material)
      ? this.surface.material
      : [this.surface.material]
    const material = materials[0]
    if (!(material instanceof MeshStandardMaterial)) {
      this.surface.material = new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.45,
        map: texture,
      })
      return
    }
    material.map = texture
    material.color.set('#ffffff')
    material.needsUpdate = true
  }

  private fitCamera(root: Object3D): void {
    const bounds = new Box3().setFromObject(root)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const radius = Math.max(size.x, size.y, size.z) * 0.5
    const safeRadius = Math.max(radius, 0.01)
    const distance =
      safeRadius / Math.tan(MathUtils.degToRad(this.camera.fov / 2))
    this.controls.target.copy(center)
    this.camera.position
      .copy(center)
      .add(new Vector3(distance * 0.55, distance * 0.42, distance))
    this.controls.minDistance = safeRadius * 1.25
    this.controls.maxDistance = safeRadius * 12
    this.floor.position.y = bounds.min.y - safeRadius * 0.04
    this.camera.near = Math.max(distance / 100, 0.001)
    this.camera.far = distance * 100
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  private removeProduct(): void {
    this.analysisCoordinator.cancel()
    this.cancelSurfacePick()
    if (this.productRoot) {
      this.scene.remove(this.productRoot)
      this.disposeObject(this.productRoot)
    }
    this.productRoot = undefined
    this.surface = undefined
    this.configuredAreaId = undefined
    this.automaticAreas.clear()
    this.meshIds.clear()
  }

  private disposeObject(root: Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }
      object.geometry.dispose()
      const materials: Material[] = Array.isArray(object.material)
        ? object.material
        : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }

  private handleSurfacePick = (event: MouseEvent): void => {
    const listener = this.surfacePickListener
    if (!listener) {
      return
    }
    const bounds = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
      -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersection = this.raycaster
      .intersectObjects([...this.meshIds.keys()], false)[0]
    if (!intersection || !(intersection.object instanceof Mesh)) {
      return
    }
    const meshId = this.meshIds.get(intersection.object)
    if (!meshId) {
      return
    }
    const records = [...this.automaticAreas.values()]
      .filter((record) => record.candidate.meshId === meshId)
      .sort((first, second) =>
        second.area.score - first.area.score ||
        first.area.id.localeCompare(second.area.id),
      )
    const faceIndex = intersection.faceIndex
    const matched = faceIndex == null
      ? records[0]
      : records.find((record) =>
          record.candidate.triangleIndices.includes(faceIndex),
        ) ?? records[0]
    if (!matched) {
      return
    }
    this.cancelSurfacePick()
    listener(matched.area.id)
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1)
    const height = Math.max(this.host.clientHeight, 1)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private render = (): void => {
    this.animationFrame = requestAnimationFrame(this.render)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.markRenderState()
  }

  private markRenderState(): void {
    if (this.host.dataset.renderState === 'nonblank') {
      return
    }
    const context = this.renderer.getContext()
    const width = context.drawingBufferWidth
    const height = context.drawingBufferHeight
    if (width < 2 || height < 2) {
      return
    }
    const pixel = new Uint8Array(4)
    let minimum = 255
    let maximum = 0
    for (const xRatio of [0.25, 0.5, 0.75]) {
      for (const yRatio of [0.25, 0.5, 0.75]) {
        context.readPixels(
          Math.floor(width * xRatio),
          Math.floor(height * yRatio),
          1,
          1,
          context.RGBA,
          context.UNSIGNED_BYTE,
          pixel,
        )
        const luminance = (pixel[0] + pixel[1] + pixel[2]) / 3
        minimum = Math.min(minimum, luminance)
        maximum = Math.max(maximum, luminance)
      }
    }
    if (maximum - minimum > 8) {
      this.host.dataset.renderState = 'nonblank'
    }
  }
}
