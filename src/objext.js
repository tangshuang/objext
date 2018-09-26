import {
  isArray,
  isEqual,
  isFunction,
  isInstanceOf,
  isObject,
  unionArray,
  isEmpty,
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
  getStringHashcode,
} from './utils'
import {
  xcreate,
  xarray,
  xobject,
  xdefine,
  xset,
} from './helpers'

export default Objext
export class Objext {
  constructor(data) {
    this.$define('$$typeof', {})
    this.$define('$$snapshots', [])
    this.$define('$$validators', [])
    this.$define('$$listeners', [])
    
    this.$define('$$dep', {})
    this.$define('$$deps', [])
    
    this.$define('$$parent', null)
    this.$define('$$key', '')
    
    this.$define('$$data', {})
    this.$define('$$locked', false)

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
  /**
   * 获取当前节点的完整路径
   * @param {*} prop 
   */
  get $$path() {
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

    return makeKeyPath(chain)
  }
  get $$hash() {
    let data = this.toString()
    let hash = getStringHashcode(data)
    return hash
  }
  /**
   * 获取key对应的值
   * @param {*} key
   */
  $get(key) {
    return parse(this, key)
  }
  /**
   * 全量更新数据，老数据会被删除
   * @param {*} data 要设置的数据
   */
  $put(data) {
    if (this.$$locked) {
      return
    }

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
    if (this.$$locked) {
      return
    }

    // 确保$$data里面是有数据的，这样在getter第一次计算的时候才不会报错
    Object.assign(this.$$data, data)

    let keys = Object.keys(data)
    let getters = []
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
  }
  /**
   * 设置一个普通值属性
   * @param {*} key
   * @param {*} value
   */
  $set(path, value) {
    if (this.$$locked) {
      return
    }

    // 数据校验
    // 校验过程不中断下方的赋值，如果想要中断，可以在warn里面使用throw new Error
    this.$validate(path, value)
    
    xset(this, path, value)

    let data = this.$$data
    let oldValue = parse(data, path)
    let newValue = value
    this.$dispatch(path, newValue, oldValue)
  }
  /**
   * 移除一个属性，不能直接用delete obj.prop这样的操作，否则不能同步内部数据，不能触发$dispatch
   * @param {*} path 
   */
  $remove(path) {
    if (this.$$locked) {
      return
    }

    let chain = makeKeyChain(path)
    let key = chain.pop()
    let oldValue = parse(this.$$data, path)

    if (!chain.length) {
      delete this[key]
      delete this.$$data[key]
    }
    else {
      let target = makeKeyPath(chain)
      let node = parse(this.$$data, target)
      delete node[key]
      let $node = parse(this, target)
      delete $node[key]
    }

    this.$dispatch(path, null, oldValue)
  }
  /**
   * 设置一个计算属性
   * @param {*} key 
   * @param {*} getter 
   */
  $describe(path, getter) {
    let define = (target, key) => {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable : true,
        get() {  
          if (target.$has(key)) {
            let value = parse(target.$$data, key)
            return value
          }
          else {
            let value = getter.call(target.$$data)
            assign(target.$$data, key, value)
            return value
          }
        },
      })
    }

    let chain = makeKeyChain(path)
    let key = chain.pop()
    
    if (!chain.length) {
      define(this, key)
      return
    }
  
    let node = this
  
    for (let i = 0, len = chain.length; i < len; i ++) {
      let current = chain[i]
      let next = chain[i + 1] || key
      if (/[0-9]+/.test(next) && !isArray(node[current])) {
        xdefine(node, current, [])
      }
      else if (!isObject(node[current])) {
        xdefine(node, current, {})
      }
      node = node[current]
    }
  
    define(node, key)
    node.$collect(key, getter) // 依赖收集
  }
  /**
   * 依赖监听
   */
  $dependent() {
    let { getter, key, dependency, target } = this.$$dep
    if (this.$$deps.find(item => item.key === key && item.getter === getter && item.dependency === dependency && item.target === target)) {
      return false
    }
    let callback = () => {
      let oldValue = parse(this.$$data, key)
      let newValue = getter.call(this)
      assign(this.$$data, key, newValue)

      this.$dispatch(key, newValue, oldValue)
    }
    this.$$deps.push({ getter, key, dependency, target })
    target.$watch(dependency, callback, true)
    return true
  }
  /**
   * 依赖收集
   */
  $collect(key, getter) {
    this.$define('$$dep', { key, getter })
    let value = getter.call(this)
    this.$define('$$dep', {})
    return value
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
    if (this.$$locked) {
      return
    }

    this.$$listeners.push({
      path,
      fn,
      deep,
    })
  }
  $unwatch(path, fn) {
    if (this.$$locked) {
      return
    }

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
    if (this.$$locked) {
      return
    }

    let listeners = this.$$listeners.filter(item => item.path === path || (item.deep && path.indexOf(item.path + '.') === 0) || item.path === '*')
    let propagation = true
    let pipeline = true
    let stopPropagation = () => propagation = false
    let preventDefault = () => pipeline = false
    let e = {}

    Object.defineProperties(e, {
      path: { value: path },
      target: { value: this },
      stopPropagation: { value: stopPropagation },
      preventDefault: { value: preventDefault },
    })

    for (let i = 0, len = listeners.length; i < len; i ++) {
      let item = listeners[i]
      item.fn(e, newValue, oldValue)
      
      // 阻止继续执行其他listener
      if (!pipeline) {
        break
      }
    }

    // 阻止冒泡
    if (!propagation) {
      return
    }

    // 向上冒泡
    let propagate = (target) => {
      let parent = target.$$parent
      let key = target.$$key
      if (parent && parent.$dispatch) {
        let fullPath = key + '.' + path
        let finalPath = makeKeyPath(makeKeyChain(fullPath))
        parent.$dispatch(finalPath, newValue, oldValue)
        propagate(parent)
      }
    }
    propagate(this)
  }
  /**
   * 基于当前视图，克隆出一个新视图
   */
  $clone() {
    if (this.$$locked) {
      return
    }

    let data = this.$$data
    let value = valueOf(data)
    return new Objext(value)
  }
  /**
   * 创建一个快照，使用reset可以恢复这个快照
   */
  $commit(tag) {
    if (this.$$locked) {
      return
    }

    let data = this.$$data
    this.$$snapshots.push({
      tag,
      data,
    })

    let next = inheritOf(data)
    this.$define('$$data', next)
  }
  /**
   * 取消编辑过程中的全部改动，将数据恢复到编辑开始时的内容
   */
  $reset(tag) {
    if (this.$$locked) {
      return
    }

    let data = null
    let snapshots = this.$$snapshots
    for (let i = snapshots.length; i >= 0; i --) {
      let item = snapshots[i]
      if (item.tag === tag) {
        data = item.data
        break
      }
    }
    if (!data) {
      return
    }
    
    let next = inheritOf(data)
    this.$define('$$data', next)
    let value = valueOf(data)
    this.$put(value)
  }
  $lock() {
    this.$define('$$locked', true)
  }
  $unlock() {
    this.$define('$$locked', false)
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
  }
  /**
   * 校验数据
   * @param {*} path 可选，不传时校验所有规则
   * @param {*} data 可选，用该值作为备选值校验，一般在设置值之前做校验时使用
   * @return {Error} 一个Error的实例，message是校验器中设置的，同时，它附带两个属性（value, path），并且它会被传给校验器中的warn函数
   */
  $validate(path, data) {
    let result = null
    let validators = this.$$validators.filter(item => path === undefined || item.path === path) // path不传的时候，校验全部验证规则
    for (let i = 0, len = validators.length; i < len; i ++) {
      let item = validators[i]
      if (!isObject(item)) {
        continue
      }
      let { check, message, warn, path } = item // 这里path是必须的，当参数path为undefined的时候，要通过这里来获取
      let value = data || valueOf(parse(this.$$data, path))
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
      let parent = target.$$parent
      let key = target.$$key
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
  toString() {
    return JSON.stringify(valueOf(this.$$data))
  }
}
