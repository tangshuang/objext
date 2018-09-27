/**
 * 测试数据锁
 */

import Objext from '../src/objext'

describe('测试数据上锁', () => {
  const origin = {
    name: 'tomy',
    age: 32,
    parents: ['lily', 'sam'],
    children: [
      {
        name: 'sendy',
        age: 6,
      },
      {
        name: 'ximi',
        age: 5,
      },
    ],
    hobbits: {
      basketball: true,
      swiming: true,
      football: false,
    },
    get sex() {
      return this.age > 20 ? 'female' : 'male'
    },
    get healthy() {
      return this.hobbits.swiming
    },
    think: {
      size: 'big',
      get it() {
        return this.size + '-size'
      },
    },
  }

  test('被上锁后普通属性修改无效', () => {
    let objx = new Objext(origin)
    objx.$lock()
    objx.name = 'tomi'
    expect(objx.name).toBe('tomy')
  })

  test('被上锁后深级属性修改无效', () => {
    let objx = new Objext(origin)
    objx.$lock()
    objx.hobbits.football = true
    expect(objx.hobbits.football).toBe(false)
  })

  test('被上锁之后数组元素无法被修改', () => {
    let objx = new Objext(origin)
    objx.$lock()
    objx.parents[1] = 'ximen'
    expect(objx.parents[1]).toBe('sam')
  })

  test('被上锁之后数组元素对象的子属性无法被修改', () => {
    let objx = new Objext(origin)
    objx.$lock()
    objx.children[0].age = 7
    expect(objx.children[0].age).toBe(6)
  })
})