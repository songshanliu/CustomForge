import type { HistoryState } from '../core/types'

/** 固定容量的设计快照历史 */
export class DesignHistory<T> {
  private entries: T[]
  private index = 0

  /**
   * @param initial 初始设计快照
   * @param limit 最多保留的撤销步骤数量
   */
  constructor(initial: T, private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('History limit must be a positive integer')
    }
    this.entries = [initial]
  }

  /** 当前撤销与重做可用状态 */
  get state(): HistoryState {
    return {
      canUndo: this.index > 0,
      canRedo: this.index < this.entries.length - 1,
    }
  }

  /** 当前步骤之前的快照 */
  peekUndo(): T | undefined {
    return this.entries[this.index - 1]
  }

  /** 当前步骤之后的快照 */
  peekRedo(): T | undefined {
    return this.entries[this.index + 1]
  }

  /** 添加新快照并丢弃当前步骤之后的重做分支 */
  push(snapshot: T): void {
    this.entries.splice(this.index + 1)
    this.entries.push(snapshot)
    if (this.entries.length > this.limit + 1) {
      this.entries.splice(0, this.entries.length - this.limit - 1)
    }
    this.index = this.entries.length - 1
  }

  /** 在目标快照成功恢复后确认一次撤销 */
  confirmUndo(): void {
    if (this.index > 0) {
      this.index -= 1
    }
  }

  /** 在目标快照成功恢复后确认一次重做 */
  confirmRedo(): void {
    if (this.index < this.entries.length - 1) {
      this.index += 1
    }
  }

  /** 以当前快照重新开始历史记录 */
  reset(snapshot: T): void {
    this.entries = [snapshot]
    this.index = 0
  }
}
