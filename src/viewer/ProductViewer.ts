import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { NormalizedProductConfiguration } from '../core/config'
import type { UvLayout } from '../core/uv'
import defaultProductModelUrl from './assets/cup_decal_small_margins.glb?url&no-inline'
import { extractUvLayout } from './uvLayout'

const DEFAULT_PRODUCT_HEIGHT = 2.35
const DEFAULT_PRODUCT_BASE_Y = -1.17
const DEFAULT_PRODUCT_ROTATION = MathUtils.degToRad(-72)
const DEFAULT_CAMERA_AZIMUTH = MathUtils.degToRad(18)
const DEFAULT_CAMERA_ELEVATION = MathUtils.degToRad(10)
const DEFAULT_CAMERA_DISTANCE_SCALE = 2.1

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
  private surface?: Mesh
  private texture?: CanvasTexture
  private animationFrame = 0

  /**
   * @param host 三维查看器挂载容器
   */
  constructor(host: HTMLElement) {
    this.host = host
    host.replaceChildren()

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D product preview')
    this.renderer.domElement.classList.add('customforge-viewer-canvas')
    host.append(this.renderer.domElement)
    host.dataset.renderState = 'pending'

    this.camera.position.set(4.6, 2.8, 5.8)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.minDistance = 3.2
    this.controls.maxDistance = 11
    this.controls.target.set(0, 0, 0)

    this.addStudioLighting()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.render()
  }

  /**
   * 加载远程模型或随包提供的默认 GLB 模型
   *
   * @param product 已完成默认值补全的产品配置
   * @returns 目标 Mesh 第一个材质槽使用的 UV 三角形布局
   * @throws 模型加载失败、找不到目标 Mesh 或目标 Mesh 缺少有效 UV 时抛出错误
   */
  async loadProduct(product: NormalizedProductConfiguration): Promise<UvLayout> {
    this.removeProduct()

    if (product.modelUrl) {
      const gltf = await this.loader.loadAsync(product.modelUrl)
      this.productRoot = gltf.scene
      this.surface = this.findSurface(gltf.scene, product.surfaceMesh)
    } else {
      const gltf = await this.loader.loadAsync(defaultProductModelUrl)
      this.productRoot = gltf.scene
      this.surface = this.findSurface(gltf.scene, product.surfaceMesh)
      this.prepareBundledProduct(gltf.scene, this.surface)
    }

    const surface = this.surface
    if (!surface) {
      throw new Error('Customizable mesh was not initialized')
    }
    const uvLayout = extractUvLayout(surface)

    this.scene.add(this.productRoot)
    if (this.texture) {
      this.attachTexture(this.texture)
    }
    this.fitCamera(this.productRoot)
    return uvLayout
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
    if (this.surface) {
      this.attachTexture(texture)
    }
  }

  /** 根据当前模型包围盒恢复默认相机位置 */
  resetView(): void {
    if (this.productRoot) {
      this.fitCamera(this.productRoot)
    }
  }

  /** 释放动画帧、相机控制、模型材质和 WebGLRenderer */
  destroy(): void {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.removeProduct()
    this.renderer.dispose()
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
      throw new Error(`Customizable mesh was not found: ${meshName}`)
    }
    return object
  }

  /**
   * 将纹理应用到目标 Mesh 的第一个材质槽
   *
   * 非 MeshStandardMaterial 会被替换为基础标准材质
   */
  private attachTexture(texture: CanvasTexture): void {
    if (!this.surface) {
      return
    }

    const materials = Array.isArray(this.surface.material)
      ? this.surface.material
      : [this.surface.material]
    const material = materials[0]

    if (!(material instanceof MeshStandardMaterial)) {
      const replacement = new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.45,
        map: texture,
      })
      this.surface.material = replacement
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
    const distance =
      Math.max(radius / Math.tan(MathUtils.degToRad(this.camera.fov / 2)), 3) *
      DEFAULT_CAMERA_DISTANCE_SCALE
    const horizontalDistance = distance * Math.cos(DEFAULT_CAMERA_ELEVATION)
    const offset = new Vector3(
      horizontalDistance * Math.sin(DEFAULT_CAMERA_AZIMUTH),
      distance * Math.sin(DEFAULT_CAMERA_ELEVATION),
      horizontalDistance * Math.cos(DEFAULT_CAMERA_AZIMUTH),
    )

    this.controls.target.copy(center)
    this.camera.position.copy(center).add(offset)
    this.camera.near = Math.max(distance / 100, 0.01)
    this.camera.far = distance * 100
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  private removeProduct(): void {
    if (!this.productRoot) {
      return
    }

    this.scene.remove(this.productRoot)
    this.productRoot.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }
      object.geometry.dispose()
      const materials: Material[] = Array.isArray(object.material)
        ? object.material
        : [object.material]
      materials.forEach((material) => material.dispose())
    })
    this.productRoot = undefined
    this.surface = undefined
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
