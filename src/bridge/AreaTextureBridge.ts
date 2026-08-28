import { CanvasTexture, SRGBColorSpace } from 'three'
import type { DesignEditor } from '../editor/DesignEditor'
import type { ProductViewer } from '../viewer/ProductViewer'

interface AreaTextureSession {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  texture: CanvasTexture
}

/**
 * 将当前二维设计合成到各设计区域独立的透明 CanvasTexture
 *
 * 切换区域后旧区域保留自己的输出 Canvas，多个覆盖 Mesh 可以同时显示设计
 */
export class AreaTextureBridge {
  private readonly editor: DesignEditor
  private readonly viewer: ProductViewer
  private readonly sessions = new Map<string, AreaTextureSession>()
  private readonly stopListening: () => void
  private activeAreaId?: string
  private updateFrame = 0

  /**
   * @param editor 提供底层设计 Canvas 和渲染事件的二维编辑器
   * @param viewer 接收每个区域独立纹理的三维查看器
   */
  constructor(editor: DesignEditor, viewer: ProductViewer) {
    this.editor = editor
    this.viewer = viewer
    this.stopListening = editor.onRender(() => this.scheduleUpdate())
  }

  /**
   * 重建当前产品的区域纹理会话
   *
   * @param areaIds 新产品按显示顺序排列的区域 ID
   * @param activeAreaId 初始编辑区域 ID
   * @param flipY 是否垂直翻转 CanvasTexture
   */
  configure(
    areaIds: string[],
    activeAreaId: string,
    flipY: boolean,
  ): void {
    this.reset()
    for (const areaId of areaIds) {
      const canvas = document.createElement('canvas')
      canvas.width = this.editor.textureCanvas.width
      canvas.height = this.editor.textureCanvas.height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Design area output canvas is unavailable')
      }
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.flipY = flipY
      texture.anisotropy = 4
      this.sessions.set(areaId, { canvas, context, texture })
      this.viewer.setDesignAreaTexture(areaId, texture)
    }
    this.activeAreaId = activeAreaId
    this.copyActiveDesign()
  }

  /**
   * 将后续编辑器渲染同步到指定区域
   *
   * @param areaId 已由 configure 创建纹理会话的区域 ID
   * @throws 区域不存在时抛出错误
   */
  setActiveArea(areaId: string): void {
    if (!this.sessions.has(areaId)) {
      throw new Error('Design area texture session was not found: ' + areaId)
    }
    this.activeAreaId = areaId
    this.copyActiveDesign()
  }

  /** 立即把当前编辑画布写入活动区域纹理 */
  flush(): void {
    cancelAnimationFrame(this.updateFrame)
    this.updateFrame = 0
    this.copyActiveDesign()
  }

  /** 取消编辑器订阅、动画帧并释放全部区域纹理 */
  destroy(): void {
    this.stopListening()
    this.reset()
  }

  private scheduleUpdate(): void {
    if (this.updateFrame) {
      return
    }
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = 0
      this.copyActiveDesign()
    })
  }

  private copyActiveDesign(): void {
    const session = this.activeAreaId
      ? this.sessions.get(this.activeAreaId)
      : undefined
    if (!session) {
      return
    }
    session.context.clearRect(0, 0, session.canvas.width, session.canvas.height)
    session.context.drawImage(this.editor.textureCanvas, 0, 0)
    session.texture.needsUpdate = true
  }

  private reset(): void {
    cancelAnimationFrame(this.updateFrame)
    this.updateFrame = 0
    for (const session of this.sessions.values()) {
      session.texture.dispose()
      session.canvas.width = 0
      session.canvas.height = 0
    }
    this.sessions.clear()
    this.activeAreaId = undefined
  }
}

