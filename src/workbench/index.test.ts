import { describe, expect, it } from 'vitest'
import * as workbenchApi from './index'

describe('Workbench public API', () => {
  it('only exposes the approved runtime entries', () => {
    expect(Object.keys(workbenchApi).sort()).toEqual([
      'CustomForgeWorkbench',
      'createWorkbench',
    ])
  })
})
