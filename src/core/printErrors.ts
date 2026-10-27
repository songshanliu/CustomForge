import type { PrintDiagnosticCode } from './types'

/** 可按 code 处理的打印配置错误，抛出时不会静默迁移设计 */
export class PrintSurfaceError extends Error {
  /** 稳定 SDK 错误标识，与业务响应码无关 */
  readonly code: PrintDiagnosticCode

  /**
   * @param code 错误标识
   * @param message 默认英文说明
   */
  constructor(code: PrintDiagnosticCode, message: string) {
    super(message)
    this.name = 'PrintSurfaceError'
    this.code = code
  }
}
