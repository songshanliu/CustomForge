import type { HistoryState } from '../core/types'

/** 可在设计区域之间保存并恢复的历史栈快照 */
export interface DesignHistorySnapshot<T> {
  /** 按时间从早到晚排列的历史条目 */
  entries: T[]

  /** 当前条目在 entries 中的索引 */
  index: number
}

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

  /** 返回可独立保存的当前历史栈 */
  snapshot(): DesignHistorySnapshot<T> {
    return {
      entries: [...this.entries],
      index: this.index,
    }
  }

  /**
   * 恢复先前保存的历史栈
   *
   * @param snapshot 由同一容量策略创建的非空历史快照
   * @throws 快照为空、索引越界或超过当前容量时抛出错误
   */
  restore(snapshot: DesignHistorySnapshot<T>): void {
    if (
      snapshot.entries.length === 0 ||
      snapshot.entries.length > this.limit + 1 ||
      !Number.isInteger(snapshot.index) ||
      snapshot.index < 0 ||
      snapshot.index >= snapshot.entries.length
    ) {
      throw new RangeError('History snapshot is invalid')
    }
    this.entries = [...snapshot.entries]
    this.index = snapshot.index
  }
}
