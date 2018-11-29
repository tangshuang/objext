import {
  isEqual,
  isFunction,
  isObject,
  inObject,
  makeKeyPath,
  makeKeyChain,
  parse,
  assign,
  clone,
  valueOf,
  getStringHashcode,
} from './utils'
import {
  xset,
} from './helpers'

export class Objext {
  constructor(data) {
    this.$define('$$snapshots', [])
    this.$define('$$validators', [])
    this.$define('$$listeners', [])

    this.$define('$$data', {})
    this.$define('$$hash', '')

    this.$define('$$locked', false)
    this.$define('$$slient', false)

    this.$define('$$__dep', {})
    this.$define('$$__deps', [])

    this.$define('$$__parent', null)
    this.$define('$$__key', '')

    this.$define('$$__inited', false) // 用来记录是否已经塞过数据了
    this.$define('$$__isBatchUpdate', false) // 记录是否开启批量更新
    this.$define('$$__batch', []) // 用来记录批量一次更新的内容

    // 写入数据
    if (data) {
      this.$put(data)
    }

    // 每当值发生变化时，hash被更新
    this.$watch('*', ({ newValue, oldValue }) => {
      if (!isEqual(newValue, oldValue)) {
        this.$define('$$hash', getStringHashcode(this.toString()))
      }
    })
  }

  /**
   * 设置一个不可枚举属性
   * @param {*} key
   * @param {*} value
   */
  $define(key, value) {
    Object.defineProperty(this, key, { value, configurable: true })
  }
  /**
   * 设置一个不可枚举的计算属性
   * @param {*} key
   * @param {*} get
   */
  $enhance(key, get) {
    Object.defineProperty(this, key, { get, configurable: true })
  }

  /**
   * 获取key对应的值，该值是原始值的克隆，因此，即使被修改也无所谓
   * @param {*} path
   */
  $get(path) {
    return parse(this.valueOf(), path)
  }
  /**
   * 设置一个普通值属性
   * @param {*} path
   * @param {*} value
   */
  $set(path, value) {
    if (this.$$locked) {
      return this
    }

    // 数据校验
    // 校验过程不中断下方的赋值，如果想要中断，可以在warn里面使用throw new Error
    this.$validate(path, value)

    let oldData = this.valueOf()

    xset(this, path, value)

    let newData = this.valueOf()

    // 触发watch绑定的回调函数
    // 注意，批量开启时，不会触发，触发逻辑都在dispatch方法中
    this.$dispatch(path, newData, oldData)

    return this
  }
  /**
   * 移除一个属性
   * 不能直接用delete obj.prop这样的操作，否则不能同步内部数据，不能触发$dispatch
   * @param {*} path
   */
  $remove(path) {
    if (this.$$locked) {
      return this
    }

    if (!this.$has(path)) {
      return this
    }

    let chain = makeKeyChain(path)
    let key = chain.pop()
    let oldData = this.valueOf()

    if (!chain.length) {
      delete this[key]
      delete this.$$data[key]
    }
    else {
      let target = makeKeyPath(chain)
      let data = parse(this.$$data, target)
      let node = parse(this, target)
      delete data[key]
      delete node[key]
    }

    let newData = this.valueOf()
    this.$dispatch(path, newData, oldData)

    return this
  }
  /**
   * 判断一个key是否在当前数据中存在
   * @param {*} path
   */
  $has(path) {
    let target = this
    let chain = makeKeyChain(path)

    for (let i = 0, len = chain.length; i < len; i ++) {
      let key = chain[i]
      if (typeof target !== 'object' || !inObject(key, target)) {
        return false
      }
      target = target[key]
    }

    return true
  }

  /**
   * 全量更新数据，老数据会被删除
   * @param {*} data 要设置的数据
   */
  $put(data) {
    if (this.$$locked) {
      return this
    }

    // 先把当前视图的所有数据删掉
    let keys = Object.keys(this)
    let current = this.$$data
    keys.forEach((key) => {
      delete current[key]
      delete this[key]
    })

    // 把数据塞进去
    this.$update(data)

    // 更新hash
    this.$define('$$hash', getStringHashcode(this.toString()))

    return this
  }
  /**
   * 增量更新数据
   * @param {*} data
   */
  $update(data) {
    if (this.$$locked) {
      return this
    }

    let keys = Object.keys(data)
    let getters = []

    this.$batchStart()

    keys.forEach((key) => {
      let descriptor = Object.getOwnPropertyDescriptor(data, key)
      if (descriptor.get) {
        getters.push({
          key,
          getter: descriptor.get,
        })
      }
      else {
        this.$set(key, data[key])
      }
    })

    // 设置计算属性
    getters.forEach((item) => {
      this.$describe(item.key, item.getter)
    })

    this.$batchEnd()

    // $$__inited为true的情况下，才能进行依赖收集，否则不允许
    // 首次运行的时候，有些属性可能还没赋值上去，因为里面的this.xxx可能还是undefined，会引起一些错误，因此，必须将$$__inited设置为false，阻止计算属性初始化操作
    this.$define('$$__inited', true)

    // 依赖初始化值
    getters.forEach((item) => {
      this.$__compute(item.key, item.getter)
    })

    return this
  }


  /**
   * 是否禁止触发watch回调，以安静模式更新数据
   * @param {*} is 为true表示启用安静模式，执行完一些操作之后，要使用false关闭安静模式，否则永远都无法触发watch回调
   */
  $slient(is) {
    this.$define('$$slient', !!is)
    return this
  }
  /**
   * 开启批量更新模式
   * 批量更新模式开启后，仅在执行batchEnd方法时才会触发watch回调，这样可以避免在一次批量操作中对同一个path进行了多次watch回调触发
   */
  $batchStart() {
    this.$define('$$__isBatchUpdate', true)
    return this
  }
  /**
   * 结束批量更新模式
   */
  $batchEnd() {
    // 不再触发dispatch操作
    if (!this.$$slient) {
      // 把收集到的变动集中起来，去重，得到最小集
      let batch = {}
      this.$$__batch.forEach(({ path, newData, oldData }) => {
        batch[path] = {
          path,
          newData,
        }
        // 对于老数据，只用最开始那个，后面的oldData其实都不是真正的oldData
        if (typeof batch[path].oldData === 'undefined') {
          batch[path].oldData = oldData
        }
      })
      let list = Object.values(batch)
      list.forEach(({ path, newData, oldData }) => this.$dispatch({ path, newData, oldData }))
    }

    // 重置信息
    this.$$__batch.length = 0
    this.$define('$$__isBatchUpdate', false)
    return this
  }

  /**
   * 设置一个计算属性
   * @param {*} key
   * @param {*} getter
   */
  $describe(key, getter) {
    Object.defineProperty(this, key, {
      configurable: true,
      enumerable : true,
      get: () => {
        let value = parse(this.$$data, key)
        return value
      },
    })

    // 依赖收集
    this.$__compute(key, getter)
    return this
  }
  /**
   * 依赖收集
   */
  $__collect() {
    let { getter, key, dependency, target } = this.$$__dep

    if (this.$$__deps.find(item => item.key === key && item.dependency === dependency)) {
      return false
    }

    let callback = () => {
      let oldData = this.valueOf()
      this.$__compute(key, getter)
      let newData = this.valueOf()
      this.$dispatch(key, newData, oldData)
    }
    this.$$__deps.push({ key, dependency })
    target.$watch(dependency, callback, true)
    return true
  }
  /**
   * 依赖计算赋值
   */
  $__compute(key, getter) {
    this.$define('$$__dep', { key, getter })
    let data = this.$$data
    let newValue = getter.call(this)
    assign(data, key, newValue)
    this.$define('$$__dep', {})
    return newValue
  }

  /**
   * 添加一个watch回调
   * @param {*} path
   * @param {*} fn
   * @param {*} deep
   */
  $watch(path, fn, deep) {
    path = makeKeyPath(makeKeyChain(path))

    this.$$listeners.push({
      path,
      fn,
      deep,
    })

    return this
  }
  /**
   * 去除一个watch回调
   * @param {*} path
   * @param {*} fn
   */
  $unwatch(path, fn) {
    let indexes = []
    this.$$listeners.forEach((item, i) => {
      if (item.path === path && item.fn === fn) {
        indexes.push(i)
      }
    })
    // 从后往前删，不会出现问题
    indexes.reverse()
    indexes.forEach(i => this.$$listeners.splice(i, 1))
    return this
  }
  /**
   * 触发watchers，注意，newData和oldData不是path对应的值，而是整个objx的值，通过path从它们中获取对应的值，在watcher的回调函数中，得到的是wathcher自己的path对应的值
   * @param {*} path
   * @param {*} newData this的新数据
   * @param {*} oldData this的老数据
   */
  $dispatch(path, newData, oldData) {
    if (!this.$$__inited) {
      return this
    }

    if (this.$$locked) {
      return this
    }

    // 收集批量修改过程中的的变动
    if (this.$$__isBatchUpdate) {
      this.$$__batch.push({ path, newData, oldData })
      return this
    }

    if (this.$$slient) {
      return this
    }

    let listeners = this.$$listeners.filter(item => item.path === path || (item.deep && path.toString().indexOf(item.path + '.') === 0) || item.path === '*')
    let propagation = true
    let pipeline = true
    let stopPropagation = () => propagation = false
    let preventDefault = () => pipeline = false

    for (let i = 0, len = listeners.length; i < len; i ++) {
      let item = listeners[i]
      let targetPath = item.path === '*' ? '' : item.path
      let newValue = parse(newData, targetPath)
      let oldValue = parse(oldData, targetPath)
      let e = {}

      Object.defineProperties(e, {
        key: { value: item.path },
        type: { value: item.deep ? 'deep' : 'shallow' },
        path: { value: path },
        target: { value: this },
        newValue: { value: newValue },
        oldValue: { value: oldValue },
        stopPropagation: { value: stopPropagation },
        preventDefault: { value: preventDefault },
      })

      item.fn(e, newValue, oldValue)

      // 阻止继续执行其他listener
      if (!pipeline) {
        break
      }
    }

    // 阻止冒泡
    if (!propagation) {
      return this
    }

    // 向上冒泡
    let propagate = (target) => {
      let parent = target.$$__parent
      let key = target.$$__key
      if (parent && parent.$dispatch) {
        let fullPath = key + '.' + path
        let finalPath = makeKeyPath(makeKeyChain(fullPath))
        let parentNewData = parent.$$data
        let parentOldData = assign(clone(parentNewData), key, oldData)
        parent.$dispatch(finalPath, parentNewData, parentOldData)
        propagate(parent)
      }
    }
    propagate(this)

    return this
  }

  /**
   * 创建一个快照，使用reset可以恢复这个快照
   */
  $commit(tag) {
    if (this.$$locked) {
      return this
    }

    let data = this.$$data
    this.$$snapshots.push({
      tag,
      data,
    })

    let next = clone(data)
    this.$define('$$data', next)

    return this
  }
  /**
   * 将数据恢复到快照的内容
   */
  $reset(tag) {
    if (this.$$locked) {
      return this
    }

    let data = null
    let snapshots = this.$$snapshots

    if (tag === undefined) {
      data = snapshots[snapshots.length - 1]
    }
    else {
      // 从后往前找，之所以取最后一个，是为了防止commit两个相同的tag，如果出现这种情况，应该取后面的tag，而非前面一个
      for (let i = snapshots.length - 1; i >= 0; i --) {
        let item = snapshots[i]
        if (item.tag === tag) {
          data = item.data
          break
        }
      }
    }

    if (!data) {
      return this
    }

    let next = clone(data)
    this.$define('$$data', data)
    this.$put(next)

    return this
  }
  /**
   * 将对应tag的快照从缓存中移除。
   * 注意，如果缓存中有多个相同tag的快照，它们会被同时移除。
   * @param {*} tag
   */
  $revert(tag) {
    if (this.$$locked) {
      return this
    }

    let snapshots = this.$$snapshots
    if (tag === undefined) {
      snapshots.length = 0
    }
    else {
      snapshots.forEach((item, i) => {
        if (item.tag === tag) {
          snapshots.splice(i, 1)
        }
      })
    }

    return this
  }

  /**
   * 锁定数据，无法做任何操作
   */
  $lock() {
    this.$define('$$locked', true)
    return this
  }
  /**
   * 解锁
   */
  $unlock() {
    this.$define('$$locked', false)
    return this
  }

  /**
   * 设置校验器
   * @param {*} validators 格式如下：
   * [
   *    {
   *        path: 'body.head', // 要监听的路径
   *        check: value => typeof value === 'object', // 要执行的检查器
   *        message: '头必须是一个对象',
   *        warn: (error) => {},
   *    }
   * ]
   */
  $formulate(validators) {
    validators.forEach(item => this.$$validators.push(item))
    return this
  }
  /**
   * 校验数据
   * @param {*} path 可选，不传时校验所有规则
   * @param {*} data 可选，用该值作为备选值校验，在$set新值之前对该新值做校验时使用
   * @return {Error} 一个Error的实例，message是校验器中设置的，同时，它附带两个属性（value, path），并且它会被传给校验器中的warn函数
   */
  $validate(path, data) {
    let result = null
    let validators = this.$$validators.filter(item => arguments.length === 0 || item.path === path) // path不传的时候，校验全部验证规则
    for (let i = 0, len = validators.length; i < len; i ++) {
      let item = validators[i]
      if (!isObject(item)) {
        continue
      }
      let { check, message, warn, path } = item // 这里path是必须的，当参数path为undefined的时候，要通过这里来获取
      let value = arguments.length < 2 ? parse(this.$$data, path) : data
      let bool = check(value)
      if (!bool) {
        let error = new Error(message)
        Object.defineProperties(error, {
          value: { value },
          path: { value: path },
        })
        if (isFunction(warn)) {
          warn(error)
        }
        result = error
        break
      }
    }

    // 向上冒泡
    let propagate = (target) => {
      let parent = target.$$__parent
      let key = target.$$__key
      if (parent && parent.$validate) {
        let fullPath = key + '.' + path
        let finalPath = makeKeyPath(makeKeyChain(fullPath))
        parent.$validate(finalPath, data)
        propagate(parent)
      }
    }
    propagate(this)

    return result
  }

  /**
   * 基于当前对象，克隆出一个新对象
   */
  $clone() {
    let value = this.$$data
    return new Objext(value)
  }
  valueOf() {
    return clone(this.$$data)
  }
  toString() {
    return JSON.stringify(this.$$data)
  }
}

export default Objext
