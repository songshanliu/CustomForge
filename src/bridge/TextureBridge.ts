import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from 'three'
import type { DesignPrintMapping } from '../core/types'
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
   * @param mapping 已解析的域、通道和上传方向，只作用于设计纹理
   */
  constructor(editor: DesignEditor, viewer: ProductViewer, mapping: DesignPrintMapping) {
    this.texture = new CanvasTexture(editor.textureCanvas)
    this.texture.colorSpace = SRGBColorSpace
    this.setMapping(mapping)
    this.texture.anisotropy = 4
    viewer.setTexture(this.texture)

    this.stopListening = editor.onTextureRender(() => this.scheduleUpdate())
    this.scheduleUpdate()
  }

  /**
   * 完整更新设计域、通道和方向，切换回原始模式时复位矩阵
   *
   * @param mapping 与二维辅助布局共用的已解析映射
   */
  setMapping(mapping: DesignPrintMapping): void {
    const { domain } = mapping
    const spanU = domain.maxU - domain.minU, spanV = domain.maxV - domain.minV
    this.texture.channel = mapping.uvChannel
    this.texture.flipY = mapping.textureFlipY
    this.texture.wrapS = ClampToEdgeWrapping
    this.texture.wrapT = ClampToEdgeWrapping
    this.texture.repeat.set(1 / spanU, 1 / spanV)
    this.texture.offset.set(-domain.minU / spanU, -domain.minV / spanV)
    this.texture.center.set(0, 0)
    this.texture.rotation = 0
    this.texture.updateMatrix()
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
