/**
 * 数据校验
 */

import Objext from '../src/objext'

describe('对数据进行校验', () => {
  const origin = {
    name: 'tomy',
    age: null,
  }
  const validators = [
    {
      path: 'name',
      validate: value => typeof value === 'string',
      message: 'name必须为字符串',
      warn: (error) => { throw error },
    },
    {
      path: 'age',
      validate: value => typeof value === 'number',
      message: 'age必须为数字',
      warn: (error) => { throw error },
    },
  ]

  test('修改数据的时候进行校验', () => {
    let objx = new Objext(origin)
    objx.$formulate(validators)
    objx.$strict(true)
    let fn = () => objx.$set('name', null)
    expect(fn).toThrowError('name必须为字符串')
  })

  test('对整个数据进行一次性校验', () => {
    let objx = new Objext(origin)
    objx.$formulate(validators)
    let fn = () => objx.$validate()
    expect(fn).toThrowError('age必须为数字')
  })
  test('校验某个属性的子属性', () => {
    let objx = new Objext({
      items: [
        { id: 10, name: 'honey' },
        { id: 20, name: null }
      ]
    })
    objx.items[1].$formulate({
      path: 'name',
      validate: value => typeof value === 'string',
      message: 'name必须为字符串xxx',
      warn: (error) => { throw error },
    })
    let fn = () => objx.$validate('items')
    expect(fn).toThrowError('name必须为字符串xxx')
  })
  test('校验顺序', () => {
    let objx = new Objext({
      items: [
        { id: 10, name: 'honey' },
        { id: 20, name: null }
      ]
    })
    objx.items[1].$formulate([
      {
        path: 'name',
        validate: value => typeof value === 'string',
        message: 'name必须为字符串:2',
        warn: (error) => { throw error },
        order: 10,
      },
      {
        path: 'name',
        validate: value => typeof value === 'string',
        message: 'name必须为字符串:1',
        warn: (error) => { throw error },
        order: 1, // order更小，先校验
      }
    ])
    let fn = () => objx.$validate('items')
    expect(fn).toThrowError('name必须为字符串:1')
  })
})
