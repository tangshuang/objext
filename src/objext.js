import {
  isArray,
  isEqual,
  isFunction,
  isInstanceOf,
  isObject,
  unionArray,
  each,
  traverse,
  makeKeyPath,
  makeKeyChain,
  parse,
  assign,
  clone,
  inheritOf,
  valueOf,
  setProto,
} from './utils'
import {
  xcreate,
} from './helpers'

/**
 * js超级对象
 * - 支持keyPath获取、设置数据
 * - 响应式，可以通过watch监听某个keyPath
 * - 数据版本控制，通过打tag和reset，可以随时恢复数据
 * - 数据校验
 */

class Objext {
  constructor(data) {
    this.$define('$$editing', false)
    this.$define('$$typeof', {})
    this.$define('$$snapshots', [])
    this.$define('$$validators', [])
    this.$define('$$listeners', [])
    
    this.$define('$$dep', {})
    this.$define('$$deps', [])
    
    this.$define('$$parent', null)
    this.$define('$$key', '')
    
    // 创建初始镜像
    this.$$snapshots.push({
      tag: 'origin',
      data: {},
    })

    // 写入数据
    if (data) {
      this.$put(data)
    }
  }
  /**
   * 在试图上设置一个不可枚举属性
   * @param {*} key 
   * @param {*} value 
   */
  $define(key, value) {
    Object.defineProperty(this, key, { value, configurable: true })
  }
  /**
   * 获取当前节点的根节点
   */
  get $$root() {
    let root = this
    while (root.$$parent) {
      root = root.$$parent
    }
    return root
  }
  get $$data() {
    let snapshots = this.$$snapshots
    let snapshot = snapshots[snapshots.length - 1]
    return snapshot.data
  }
  /**
   * 获取当前节点的完整路径
   * @param {*} prop 
   */
  $path(path) {
    let key = this.$$key
    let chain = [key]
    while (this.$$parent) {
      let key = this.$$parent.$$key
      if (key) {
        chain.unshift(key)
      }
      else {
        break
      }
    }

    // 传了prop的情况下，会拼出更详细的路径
    if (path) {
      chain = chain.concat(makeKeyChain(path))
    }

    return makeKeyPath(chain)
  }
  /**
   * 全量更新数据，老数据会被删除
   * @param {*} data 要设置的数据
   */
  $put(data) {
    // 先把当前视图的所有数据删掉
    let keys = Object.keys(this)
    let current = this.$$data
    keys.forEach((key) => {
      delete current[key]
      delete this[key]
    })
    this.$update(data)
  }
  /**
   * 增量更新数据
   * @param {*} data
   */
  $update(data) {
    let keys = Object.keys(data)
    let getters = []
    keys.forEach((key) => {
      let descriptor = Object.getOwnPropertyDescriptor(data, key)
      if (descriptor.get) {
        getters.push({
          key,
          getter: descriptor.get.bind(this),
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
  }
  /**
   * 依赖监听
   */
  $dependent() {
    let root = this.$$root
    let { getter, path, target } = root.$$dep
    if (root.$$deps.find(item => item.path === path && item.getter === getter && item.target === target)) {
      return false
    }
    let callback = () => {
      let oldValue = parse(root.$$data, path)
      let newValue = root.$collect(path, getter)
      root.$dispatch(path, newValue, oldValue)
    }
    root.$$deps.push({ path, getter, target })
    root.$watch(target, callback, true)
    return true
  }
  /**
   * 依赖收集
   * @param {*} getter 
   */
  $collect(path, getter) {
    let root = this.$$root
    root.$define('$$dep', { path, getter })
    let value = getter()
    assign(root.$$data, path, value)
    root.$define('$$dep', {})
    return value
  }
  /**
   * 设置一个普通值属性
   * @param {*} key
   * @param {*} value
   */
  $set(path, value) {
    var $this = this
    var root = this.$$root
    // 设置getter和setter，使set操作能够响应式
    var define = (target, key, value) => {
      Object.defineProperty(target, key, {
        configurable : true,
        enumerable : true,
        set: (v) => {
          let data = Objext.create(v, key, target)
          let newValue = valueOf(data)
          let oldValue = valueOf(value)

          let path = $this.$path(key)
          root.$dispatch(path, newValue, oldValue)

          value = data
          assign(root.$$data, path, newValue)
        },
        get() {
          let path = $this.$path(key)
          // 依赖收集
          if (root.$$dep.getter && root.$$dep.path) {
            root.$$dep.target = path
            root.$dependent()
          }

          return value
        },
      })
    }
    var set = (target, path, value) => {
      let chain = makeChain(path)
      let key = chain.pop()

      if (!chain.length) {
        let data = Objext.create(value, key, target)
        define(target, key, data)
        return
      }
    
      let node = target
    
      for (let i = 0, len = chain.length; i < len; i ++) {
        let key = chain[i]
        let next = chain[i + 1] || tail
        if (/[0-9]+/.test(next) && !Array.isArray(node[key])) {
          let data = Objext.xarray([], key, node)
          define(node, key, data)
        }
        else if (!isObject(node[key])) {
          let data = Objext.xobject({}, key, node)
          define(node, key, data)
        }
        node = node[key]
      }
    
      let data = Objext.create(value, key, node)
      define(node, key, data)
    }
    
    set(this, path, value)

    let current = this.$$data
    assign(current, path, value)
    let oldValue = parse(current, path)
    let newValue = value
    root.$dispatch(path, newValue, oldValue)
  }
  /**
   * 设置一个计算属性
   * @param {*} key 
   * @param {*} getter 
   */
  $describe(path, getter) {
    var $this = this
    var root = this.$$root
    var define = (target, key) => {
      Object.defineProperty(target, key, {
        configurable: true,
        get() {
          // 依赖收集
          let path = $this.$path(key)
          if (root.$$dep.getter && root.$$dep.path) {
            root.$$dep.target = path
            root.$dependent()
          }
  
          let value = parse(target.$$data, key)
          return value
        },
      })
    }
    var set = (target, path) => {
      let chain = makeChain(path)
      let key = chain.pop()
      
      if (!chain.length) {
        define(target, key)
        return
      }
    
      let node = target
    
      for (let i = 0, len = chain.length; i < len; i ++) {
        let key = chain[i]
        let next = chain[i + 1] || tail
        if (/[0-9]+/.test(next) && !Array.isArray(node[key])) {
          let data = Objext.xarray([], key, node)
          define(node, key, data)
        }
        else if (!isObject(node[key])) {
          let data = Objext.xobject({}, key, node)
          define(node, key, data)
        }
        node = node[key]
      }
    
      define(node, key)
    }
    
    set(this, path)

    let current = this.$$data
    let oldValue = parse(current, path)
    let newValue = root.$collect(path, getter)
    assign(current, path, newValue)
    root.$dispatch(path, newValue, oldValue)
  }
  /**
   * 获取key对应的值
   * @param {*} key
   */
  $get(key) {
    return parse(this, key)
  }
  /**
   * 判断一个key是否在当前dataview中存在
   * @param {*} key
   */
  $has(key) {
    let target = this
    let chain = key.split(/\.|\[|\]/).filter(item => !!item)

    for (let i = 0, len = chain.length; i < len; i ++) {
      let key = chain[i]
      if (typeof target !== 'object' || !inObject(key, target)) {
        return false
      }
      target = target[key]
    }

    return true
  }
  $watch(path, fn, deep) {
    this.$$listeners.push({
      path,
      fn,
      deep,
    })
  }
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
  }
  $dispatch(path, newValue, oldValue) {
    let listeners = this.$$listeners.filter(item => item.path === path || (item.deep && path.indexOf(item.path + '.') === 0))
    listeners.forEach((item) => {
      item.fn(newValue, oldValue)
    })
  }
  /**
   * 基于当前视图，克隆出一个新视图
   */
  $clone() {
    let data = this.$$data
    let value = valueOf(data)
    return new Objext(value)
  }
  /**
   * 创建一个快照，使用editReset可以恢复这个快照
   */
  $shot(tag) {
    let current = this.$$data
    let data = inheritOf(current)
    this.$$snapshots.push({
      tag,
      data,
    })
  }
  /**
   * 取消编辑过程中的全部改动，将数据恢复到编辑开始时的内容
   */
  $reset(tag = 'origin') {
    let index = -1
    let snapshots = this.$$snapshots
    for (let i = snapshots.length; i >= 0; i --) {
      let item = snapshots[i]
      if (item.tag === tag) {
        index = i
        break
      }
    }
    if (index === -1) {
      return
    }
    let items = snapshots.slice(0, index + 1)
    let item = items.pop()
    snapshots.length = 0
    items.forEach(item => snapshots.push(item))
    this.$put(item.data)
  }
  /**
   * 设置校验器
   * @param {*} validators 格式如下：
   * [
   *    {
   *        path: 'body.head',
   *        fn: value => typeof value === 'object',
   *        message: '头必须是一个对象',
   *    }
   * ]
   */
  $formulate(validators) {
    validators.forEach(item => this.$$validators.push(item))
  }
  /**
   * 一次性校验全部数据
   * @param {Function} warn 当校验失败时执行怎样的动作
   */
  $validate(path, warn) {
    let validators = this.$$validators.filter(item => item.path === path)
    for (let i = 0, len = validators.length; i < len; i ++) {
      let item = validators[i]
      if (!isObject(item)) {
        return
      }
      let { fn, message } = validator
      let value = this.$get(key)
      let bool = fn(value)
      if (!bool) {
        if (isFunction(warn)) {
          return warn(message, value, path)
        }
        else {
          throw new Error(message)
        }
      }
    }
  }
  toString() {
    return JSON.stringify(valueOf(this.$$data))
  }
}
