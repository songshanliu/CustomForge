import {
  ACESFilmicToneMapping,
  Box3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { NormalizedProductConfiguration } from '../core/config'

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
    this.renderer.shadowMap.enabled = true
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D product preview')
    host.append(this.renderer.domElement)
    host.dataset.renderState = 'pending'

    this.scene.background = new Color('#eef0ef')
    this.camera.position.set(4.6, 2.8, 5.8)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.minDistance = 3.2
    this.controls.maxDistance = 11
    this.controls.target.set(0, 0, 0)

    this.addEnvironment()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.render()
  }

  /**
   * 加载远程模型或创建内置演示模型
   *
   * @param product 已完成默认值补全的产品配置
   * @throws 模型加载失败或找不到目标 Mesh 时抛出错误
   */
  async loadProduct(product: NormalizedProductConfiguration): Promise<void> {
    this.removeProduct()

    if (product.modelUrl) {
      const gltf = await this.loader.loadAsync(product.modelUrl)
      this.productRoot = gltf.scene
      this.surface = this.findSurface(gltf.scene, product.surfaceMesh)
    } else {
      const demo = this.createDemoProduct()
      this.productRoot = demo.root
      this.surface = demo.surface
    }

    this.scene.add(this.productRoot)
    if (this.texture) {
      this.attachTexture(this.texture)
    }
    this.fitCamera(this.productRoot)
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

  private addEnvironment(): void {
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

    const handle = new Mesh(new TorusGeometry(0.72, 0.16, 24, 72), ceramic)
    handle.rotation.y = Math.PI / 2
    handle.position.set(-1.18, 0.05, 0)
    handle.scale.y = 1.15
    handle.castShadow = true
    root.add(handle)

    return { root, surface }
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
    const distance = Math.max(radius / Math.tan(MathUtils.degToRad(this.camera.fov / 2)), 3)

    this.controls.target.copy(center)
    this.camera.position.copy(center).add(new Vector3(distance * 0.55, distance * 0.42, distance))
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
