/**
 * 通过keyPath设置/获取数据
 */

import Objext from '../src/objext'

describe('测试通过keyPath获取/修改/删除数据', () => {
  const origin = {
    hobbits: {
      basketball: true,
      swiming: true,
      football: false,
    },
  }

  test('通过keyPath获取一个属性', () => {
    let objx = new Objext(origin)
    expect(objx.hobbits.football).toBe(false)
    expect(objx.$get('hobbits.football')).toBe(false)
    expect(objx.$get('test.football')).toBe(undefined) // test属性不存在也没关系
  })

  test('通过keyPath修改一个属性', () => {
    let objx = new Objext(origin)
    expect(objx.hobbits.football).toBe(false)
    objx.$set('hobbits.football', true)
    expect(objx.hobbits.football).toBe(true)
  })

  test('通过keyPath添加一个属性', () => {
    let objx = new Objext(origin)
    expect(objx.test).toBe(undefined)
    objx.$set('test.a', true) // test属性不存在，但是经过$set之后它顺利存在了
    expect(objx.test.a).toBe(true)
  })

  test('通过keyPath删除一个属性', () => {
    let objx = new Objext(origin)
    expect(objx.hobbits.football).toBe(false)

    objx.$remove('hobbits.football')
    expect(objx.hobbits.football).toBe(undefined)
    expect(objx.$has('hobbits.football')).toBe(false)
  })
})
