/**
 * 版本控制
 */

import Objext from '../src/objext'

describe('测试对数据进行版本控制', () => {
  const origin = {
    name: 'tomy',
  }
  let objx = new Objext(origin)

  test('创建一个版本', () => {
    expect(objx.$$snapshots).toHaveLength(0)
    objx.$commit('origin')
    expect(objx.$$snapshots).toHaveLength(1)
  })

  test('恢复到一个版本', () => {
    objx.name = 'kitle'
    expect(objx.name).toBe('kitle')
    objx.$reset('origin')
    expect(objx.name).toBe('tomy')
  })
})