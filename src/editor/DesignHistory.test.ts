import { describe, expect, it } from 'vitest'
import { DesignHistory } from './DesignHistory'

describe('DesignHistory', () => {
  it('moves through committed snapshots', () => {
    const history = new DesignHistory('initial', 5)
    history.push('second')
    history.push('third')

    expect(history.peekUndo()).toBe('second')
    history.confirmUndo()
    expect(history.peekRedo()).toBe('third')
    expect(history.state).toEqual({ canUndo: true, canRedo: true })
    history.confirmRedo()
    expect(history.state).toEqual({ canUndo: true, canRedo: false })
  })

  it('drops the redo branch after a new commit', () => {
    const history = new DesignHistory('initial', 5)
    history.push('second')
    history.push('third')
    history.confirmUndo()
    history.push('replacement')

    expect(history.peekRedo()).toBeUndefined()
    expect(history.peekUndo()).toBe('second')
  })

  it('keeps only the configured number of undo steps', () => {
    const history = new DesignHistory('initial', 2)
    history.push('second')
    history.push('third')
    history.push('fourth')

    history.confirmUndo()
    history.confirmUndo()
    expect(history.peekUndo()).toBeUndefined()
  })

  it('resets both directions to the supplied snapshot', () => {
    const history = new DesignHistory('initial', 5)
    history.push('second')
    history.reset('current')

    expect(history.state).toEqual({ canUndo: false, canRedo: false })
    expect(history.peekUndo()).toBeUndefined()
    expect(history.peekRedo()).toBeUndefined()
  })

  it('restores an independent area history stack', () => {
    const history = new DesignHistory('initial', 5)
    history.push('second')
    const snapshot = history.snapshot()
    history.push('third')

    history.restore(snapshot)

    expect(history.peekUndo()).toBe('initial')
    expect(history.peekRedo()).toBeUndefined()
  })

  it('rejects malformed history snapshots', () => {
    const history = new DesignHistory('initial', 2)

    expect(() => history.restore({ entries: [], index: 0 })).toThrow(
      'History snapshot is invalid',
    )
    expect(() =>
      history.restore({ entries: ['one'], index: 1 }),
    ).toThrow('History snapshot is invalid')
  })

  it('rejects an invalid history limit', () => {
    expect(() => new DesignHistory('initial', 0)).toThrow(
      'History limit must be a positive integer',
    )
  })
})
