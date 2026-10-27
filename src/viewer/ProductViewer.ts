import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type Material,
  Texture,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { NormalizedProductConfiguration } from '../core/config'
import type { PrintUvChannel, ProductViewState, ViewerAppearance } from '../core/types'
import { PrintSurfaceError } from '../core/printErrors'
import defaultProductModelUrl from './assets/cup_decal_small_margins.glb?url&no-inline'
import { bindDesignMaterial } from './printMaterial'

/** 尚未加入活动场景的已加载模型，必须提交或释放 */
export interface PreparedProduct {
  /** 本次仅下载和解析一次的模型场景 */
  root: Object3D
  /** 已定位的打印节点 */
  surface: Mesh
  /** 选定打印节点的 extras，不读取根级示例尺寸 */
  metadata: Record<string, unknown>
  /** 用于释放独立设计采样绑定 */
  releaseBinding?: () => void
}

const DEFAULT_PRODUCT_HEIGHT = 2.35
const DEFAULT_PRODUCT_BASE_Y = -1.17
const DEFAULT_PRODUCT_ROTATION = MathUtils.degToRad(-72)
const DEFAULT_CAMERA_AZIMUTH = MathUtils.degToRad(18)
const DEFAULT_CAMERA_ELEVATION = MathUtils.degToRad(10)
const CAMERA_VIEWPORT_FILL = 0.7

type ViewChangeListener = (state: ProductViewState) => void

/**
 * 基于 Three.js 的三维产品查看器
 *
 * 负责模型加载、目标 Mesh 查找、实时纹理绑定、相机控制和资源释放
 * 当前只将纹理应用到目标 Mesh 的第一个材质槽
 */
export class ProductViewer {
  private readonly host: HTMLElement
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(35, 1, 0.05, 100)
  private readonly renderer: WebGLRenderer
  private readonly controls: OrbitControls
  private readonly loader = new GLTFLoader()
  private readonly resizeObserver: ResizeObserver
  private productRoot?: Object3D
  private currentProduct?: PreparedProduct
  private readonly disposedProducts = new WeakSet<PreparedProduct>()
  private destroyed = false
  private texture?: CanvasTexture
  private animationFrame = 0
  private readonly viewChangeListeners = new Set<ViewChangeListener>()
  private readonly handleControlsChange = (): void => {
    const state = this.getViewState()
    this.viewChangeListeners.forEach((listener) => listener(state))
  }

  /**
   * @param host 三维查看器挂载容器
   * @param ariaLabel 三维产品画布的无障碍名称
   * @param appearance WebGL 画布清屏颜色等外观配置
   */
  constructor(
    host: HTMLElement,
    ariaLabel = 'Interactive 3D product preview',
    appearance: ViewerAppearance = {},
  ) {
    this.host = host
    host.replaceChildren()

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    if (appearance.backgroundColor?.trim()) {
      this.renderer.setClearColor(appearance.backgroundColor.trim(), 1)
    }
    this.renderer.domElement.setAttribute('aria-label', ariaLabel)
    this.renderer.domElement.classList.add('customforge-viewer-canvas')
    host.append(this.renderer.domElement)

    this.camera.position.set(4.6, 2.8, 5.8)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.minDistance = 3.2
    this.controls.maxDistance = 11
    this.controls.target.set(0, 0, 0)
    this.controls.addEventListener('change', this.handleControlsChange)

    this.addStudioLighting()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.render()
  }

  /**
   * 下载并解析候选模型，不移除当前产品，也不创建二维画布
   *
   * @param product 已完成默认值补全的产品配置
   * @returns 包含原始打印节点和元数据的候选资源，调用方必须提交或释放
   * @throws 模型无效或找不到打印节点时释放候选资源并保留旧产品
   */
  async prepareProduct(product: NormalizedProductConfiguration): Promise<PreparedProduct> {
    const gltf = await this.loader.loadAsync(product.modelUrl ?? defaultProductModelUrl)
    const root = gltf.scene
    try {
      if (this.destroyed) throw new DOMException('Viewer was destroyed during model loading', 'AbortError')
      const surface = this.findSurface(root, product.surfaceMesh)
      if (!product.modelUrl) this.prepareBundledProduct(root, surface)
      const diagonal = new Box3().setFromObject(root).getSize(new Vector3()).length()
      if (!Number.isFinite(diagonal) || diagonal <= 0) throw new Error('The product has invalid bounds')
      return { root, surface, metadata: surface.userData }
    } catch (error) {
      this.disposeRoot(root)
      throw error
    }
  }

  /** 返回设备支持的单边纹理上限，必须在分配二维画布前校验 */
  getMaxTextureSize(): number {
    return this.renderer.capabilities.maxTextureSize
  }

  /** 将校验后的候选模型一次提交，先准备私有材质绑定再释放旧模型 */
  commitProduct(product: PreparedProduct, channel: PrintUvChannel): void {
    if (this.destroyed || this.disposedProducts.has(product)) throw new DOMException('Product loading was cancelled', 'AbortError')
    if (this.texture) product.releaseBinding = bindDesignMaterial(product.surface, this.texture, channel)
    this.fitCamera(product.root)
    this.removeProduct()
    this.productRoot = product.root
    this.currentProduct = product
    this.scene.add(product.root)
  }

  /** 幂等释放未提交或已移出场景的候选模型，不释放共享设计纹理 */
  disposePreparedProduct(product: PreparedProduct): void {
    if (this.disposedProducts.has(product)) return
    this.disposedProducts.add(product)
    product.releaseBinding?.()
    this.disposeRoot(product.root)
  }

  /**
   * 保存并绑定二维编辑器生成的实时纹理
   *
   * 如果模型尚未加载，纹理会在模型加载完成后自动绑定
   *
   * @param texture 由二维画布创建的 CanvasTexture
   */
  setTexture(texture: CanvasTexture): void {
    this.texture = texture
    if (this.currentProduct) {
      this.currentProduct.releaseBinding?.()
      this.currentProduct.releaseBinding = bindDesignMaterial(this.currentProduct.surface, texture, texture.channel as PrintUvChannel)
    }
  }

  /** 根据当前模型包围盒恢复默认相机位置 */
  resetView(): void {
    if (this.productRoot) {
      this.fitCamera(this.productRoot)
    }
  }

  /** 返回当前相机位置和轨道控制目标点的独立快照 */
  getViewState(): ProductViewState {
    return {
      position: this.vectorToValue(this.camera.position),
      target: this.vectorToValue(this.controls.target),
    }
  }

  /**
   * 恢复相机位置和轨道控制目标点
   *
   * @param state 要恢复的三维观察视角
   * @returns 应用后的独立视角快照
   * @throws 坐标不是有限数值或相机与目标点重合时抛出错误
   */
  setViewState(state: ProductViewState): ProductViewState {
    this.validateViewState(state)
    this.camera.position.set(
      state.position.x,
      state.position.y,
      state.position.z,
    )
    this.controls.target.set(state.target.x, state.target.y, state.target.z)
    this.camera.updateProjectionMatrix()
    this.controls.update()
    return this.getViewState()
  }

  /**
   * 订阅三维视角变化
   *
   * 用户旋转、缩放、平移以及 API 恢复视角时都会触发
   *
   * @param listener 接收独立视角快照的监听函数
   * @returns 用于取消本次订阅的函数
   */
  onViewChange(listener: ViewChangeListener): () => void {
    this.viewChangeListeners.add(listener)
    return () => this.viewChangeListeners.delete(listener)
  }

  /** 幂等释放模型及解码位图，并使当前 WebGL 上下文失效；销毁后须创建新实例 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener('change', this.handleControlsChange)
    this.controls.dispose()
    this.viewChangeListeners.clear()
    this.removeProduct()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  private addStudioLighting(): void {
    this.scene.add(new AmbientLight('#ffffff', 0.9))

    const key = new DirectionalLight('#ffffff', 2.1)
    key.position.set(4, 5, 6)
    this.scene.add(key)

    const fill = new DirectionalLight('#e8f0f2', 1.15)
    fill.position.set(-5, 2, 4)
    this.scene.add(fill)

    const rim = new DirectionalLight('#ffffff', 0.8)
    rim.position.set(1, 4, -5)
    this.scene.add(rim)
  }

  private prepareBundledProduct(root: Object3D, surface: Mesh): void {
    surface.renderOrder = 1
    const surfaceMaterials = Array.isArray(surface.material)
      ? surface.material
      : [surface.material]
    surfaceMaterials.forEach((material) => {
      material.depthWrite = false
      material.polygonOffset = true
      material.polygonOffsetFactor = -1
      material.polygonOffsetUnits = -1
    })

    const initialBounds = new Box3().setFromObject(root)
    const initialHeight = initialBounds.getSize(new Vector3()).y
    if (!Number.isFinite(initialHeight) || initialHeight <= 0) {
      throw new Error('The bundled product has invalid bounds')
    }

    root.scale.multiplyScalar(DEFAULT_PRODUCT_HEIGHT / initialHeight)
    root.rotation.y = DEFAULT_PRODUCT_ROTATION
    root.updateMatrixWorld(true)

    const bounds = new Box3().setFromObject(root)
    const center = bounds.getCenter(new Vector3())
    root.position.x -= center.x
    root.position.y += DEFAULT_PRODUCT_BASE_Y - bounds.min.y
    root.position.z -= center.z
    root.updateMatrixWorld(true)
  }

  /**
   * 按名称查找接收实时纹理的 Mesh
   *
   * @throws 找不到对象或同名对象不是 Mesh 时抛出错误
   */
  private findSurface(root: Object3D, meshName: string): Mesh {
    const object = root.getObjectByName(meshName)
    if (!(object instanceof Mesh)) {
      throw new PrintSurfaceError('PRINT_SURFACE_MISSING', `Customizable mesh was not found: ${meshName}`)
    }
    return object
  }

  private fitCamera(root: Object3D, direction?: Vector3): void {
    const bounds = new Box3().setFromObject(root)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const diagonal = size.length()
    if (!Number.isFinite(diagonal) || diagonal <= 0) {
      throw new Error('The product has invalid bounds')
    }

    const viewDirection = direction?.clone() ?? this.defaultCameraDirection()
    if (viewDirection.lengthSq() === 0) {
      viewDirection.copy(this.defaultCameraDirection())
    }
    viewDirection.normalize()
    const right = new Vector3().crossVectors(this.camera.up, viewDirection)
    if (right.lengthSq() < 1e-8) {
      right.set(1, 0, 0)
    } else {
      right.normalize()
    }
    const up = new Vector3().crossVectors(viewDirection, right).normalize()
    const verticalSlope =
      Math.tan(MathUtils.degToRad(this.camera.fov / 2)) * CAMERA_VIEWPORT_FILL
    const horizontalSlope = verticalSlope * Math.max(this.camera.aspect, 0.1)
    let distance = 0

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const offset = new Vector3(x, y, z).sub(center)
          const depth = offset.dot(viewDirection)
          distance = Math.max(
            distance,
            depth + Math.abs(offset.dot(right)) / horizontalSlope,
            depth + Math.abs(offset.dot(up)) / verticalSlope,
          )
        }
      }
    }
    distance = Math.max(distance, diagonal * 0.55, 0.1)

    const minDistance = Math.max(diagonal * 0.45, distance * 0.3, 0.05)
    const maxDistance = Math.max(distance * 4, diagonal * 4)

    this.controls.target.copy(center)
    this.camera.position.copy(center).addScaledVector(viewDirection, distance)
    this.camera.near = Math.max(Math.min(distance * 0.02, diagonal * 0.01), 0.01)
    this.camera.far = Math.max(maxDistance + diagonal * 2, 10)
    this.camera.updateProjectionMatrix()
    this.controls.minDistance = minDistance
    this.controls.maxDistance = maxDistance
    this.controls.update()
  }

  private defaultCameraDirection(): Vector3 {
    const horizontal = Math.cos(DEFAULT_CAMERA_ELEVATION)
    return new Vector3(
      horizontal * Math.sin(DEFAULT_CAMERA_AZIMUTH),
      Math.sin(DEFAULT_CAMERA_ELEVATION),
      horizontal * Math.cos(DEFAULT_CAMERA_AZIMUTH),
    )
  }

  private vectorToValue(vector: Vector3): ProductViewState['position'] {
    return { x: vector.x, y: vector.y, z: vector.z }
  }

  private validateViewState(state: ProductViewState): void {
    const values = [
      state.position.x,
      state.position.y,
      state.position.z,
      state.target.x,
      state.target.y,
      state.target.z,
    ]
    if (!values.every(Number.isFinite)) {
      throw new TypeError('View position and target must contain finite numbers')
    }

    const distanceSquared =
      (state.position.x - state.target.x) ** 2 +
      (state.position.y - state.target.y) ** 2 +
      (state.position.z - state.target.z) ** 2
    if (distanceSquared <= Number.EPSILON) {
      throw new RangeError('View position and target must not be identical')
    }
  }

  private removeProduct(): void {
    if (this.currentProduct) {
      this.scene.remove(this.currentProduct.root)
      this.disposePreparedProduct(this.currentProduct)
    }
    this.currentProduct = undefined
    this.productRoot = undefined
  }

  private disposeRoot(root: Object3D): void {
    const geometries = new Set<Mesh['geometry']>()
    const materials = new Set<Material>()
    const textures = new Set<Texture>()
    const bitmaps = new Set<ImageBitmap>()
    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }
      geometries.add(object.geometry)
      const entries: Material[] = Array.isArray(object.material)
        ? object.material
        : [object.material]
      entries.forEach((material) => {
        materials.add(material)
        Object.values(material).forEach((value) => {
          if (value instanceof Texture && value !== this.texture) textures.add(value)
        })
      })
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    textures.forEach((texture) => {
      const images: unknown[] = Array.isArray(texture.image) ? texture.image : [texture.image]
      for (const image of images) {
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image)
      }
      texture.dispose()
    })
    bitmaps.forEach((bitmap) => bitmap.close())
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1)
    const height = Math.max(this.host.clientHeight, 1)
    const direction = this.camera.position.clone().sub(this.controls.target)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    if (this.productRoot && direction.lengthSq() > 0) {
      this.fitCamera(this.productRoot, direction)
    } else {
      this.camera.updateProjectionMatrix()
    }
  }

  private render = (): void => {
    this.animationFrame = requestAnimationFrame(this.render)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}
