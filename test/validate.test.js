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
      check: value => typeof value === 'string',
      message: 'name必须为字符串',
      warn: (error) => { throw error },
    },
    {
      path: 'age',
      check: value => typeof value === 'number',
      message: 'age必须为数字',
      warn: (error) => { throw error },
    },
  ]
  
  test('修改数据的时候进行校验', () => {
    let objx = new Objext(origin)
    objx.$formulate(validators)
    let fn = () => objx.$set('name', null)
    expect(fn).toThrowError('name必须为字符串')
  })

  test('对整个数据进行一次性校验', () => {
    let objx = new Objext(origin)
    objx.$formulate(validators)
    let fn = () => objx.$validate()
    expect(fn).toThrowError('age必须为数字')
  })
})