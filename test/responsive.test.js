/**
 * 测试响应式
 */
import Objext from '../src/objext'

describe('测试数据响应', () => {
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

  test('监听任何变动，有任何变动时都会触发', (done) => {
    let objx = new Objext(origin)
    objx.$watch('*', (e) => {
      expect(e.key).toBe('*')
      done()
    })
    objx.hobbits.basketball = false
  })

  test('普通监听', (done) => {
    let objx = new Objext(origin)
    objx.$watch('name', (e, newValue, oldValue) => {
      expect(e.path).toBe('name')
      expect(newValue).toBe('tomi')
      expect(oldValue).toBe('tomy')
      done()
    })
    objx.name = 'tomi'
  })

  test('深度监听', (done) => {
    let objx = new Objext(origin)
    objx.$watch('hobbits', (e, newValue, oldValue) => {
      expect(e.key).toBe('hobbits') // when deep watch, e.path will give the true final path, e.key will give the watch key
      expect(e.type).toBe('deep')
      expect(newValue.football).toBe(true)
      expect(oldValue.football).toBe(false)
      done()
    }, true)
    objx.hobbits.football = true
  })

  test('监听数组元素的变动', (done) => {
    let objx = new Objext(origin)
    objx.$watch('parents[1]', (e, newValue, oldValue) => {
      expect(e.path).toBe('parents[1]')
      expect(newValue).toBe('ximen')
      expect(oldValue).toBe('sam')
      done()
    })
    objx.parents[1] = 'ximen'
  })

  test('监听数组元素对象的子属性的变动', (done) => {
    let objx = new Objext(origin)
    objx.$watch('children[0].age', (e, newValue, oldValue) => {
      expect(e.path).toBe('children[0].age')
      expect(newValue).toBe(7)
      expect(oldValue).toBe(6)
      done()
    })
    objx.children[0].age = 7
  })

  test('监听一个计算属性', (done) => {
    let objx = new Objext(origin)
    objx.$watch('sex', (e, newValue, oldValue) => {
      expect(e.path).toBe('sex')
      expect(newValue).toBe('male')
      expect(oldValue).toBe('female')
      done()
    })
    objx.age = 18
  })

  test('监听一个依赖深层级属性值的计算属性', (done) => {
    let objx = new Objext(origin)
    objx.$watch('healthy', (e, newValue, oldValue) => {
      expect(e.path).toBe('healthy')
      expect(newValue).toBe(false)
      expect(oldValue).toBe(true)
      done()
    })
    objx.hobbits.swiming = false
  })

  test('监听一个深层级的计算属性', (done) => {
    let objx = new Objext(origin)
    objx.$watch('think.it', (e, newValue, oldValue) => {
      expect(e.path).toBe('think.it')
      expect(newValue).toBe('small-size')
      expect(oldValue).toBe('big-size')
      done()
    })
    objx.think.size = 'small'
  })
})