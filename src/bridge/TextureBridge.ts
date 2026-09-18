import { CanvasTexture, SRGBColorSpace } from 'three'
import type { DesignEditor } from '../editor/DesignEditor'
import type { ProductViewer } from '../viewer/ProductViewer'

/**
 * 将二维编辑画布转换为 Three.js 实时纹理
 *
 * 多次画布渲染会合并到下一个动画帧，避免重复标记纹理更新
 */
export class TextureBridge {
  /** 绑定到三维产品材质的实时 CanvasTexture */
  readonly texture: CanvasTexture

  private readonly stopListening: () => void
  private updateFrame = 0

  /**
   * @param editor 提供不含交互控件的纹理 Canvas 和渲染事件的二维编辑器
   * @param viewer 接收实时纹理的三维查看器
   * @param flipY 是否垂直翻转纹理
   */
  constructor(editor: DesignEditor, viewer: ProductViewer, flipY: boolean) {
    this.texture = new CanvasTexture(editor.textureCanvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.flipY = flipY
    this.texture.anisotropy = 4
    viewer.setTexture(this.texture)

    this.stopListening = editor.onRender(() => this.scheduleUpdate())
    this.scheduleUpdate()
  }

  /**
   * 更新纹理垂直翻转状态并立即标记刷新
   *
   * @param flipY 是否垂直翻转纹理
   */
  setFlipY(flipY: boolean): void {
    this.texture.flipY = flipY
    this.texture.needsUpdate = true
  }

  /** 取消编辑器订阅、动画帧并释放 CanvasTexture */
  destroy(): void {
    this.stopListening()
    cancelAnimationFrame(this.updateFrame)
    this.texture.dispose()
  }

  /** 将同一帧内的多次画布渲染合并为一次纹理更新 */
  private scheduleUpdate(): void {
    if (this.updateFrame) {
      return
    }

    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = 0
      this.texture.needsUpdate = true
    })
  }
}
