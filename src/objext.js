import {
  isArray,
  isEqual,
  isFunction,
  isInstanceOf,
  isObject,
  inObject,
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

export class Objext {
  constructor(data) {
    this.$define('$$snapshots', [])
    this.$define('$$validators', [])
    this.$define('$$listeners', [])
    
    this.$define('$$dep', {})
    this.$define('$$deps', [])
    
    this.$define('$$parent', null)
    this.$define('$$key', '')
    
    this.$define('$$data', {})
    this.$define('$$locked', false)

    this.$define('$$inited', false) // 用来记录是否已经塞过数据了

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
    
    // $$inited为true的情况下，才能进行依赖收集，否则不允许
    // 首次运行的时候，有些属性可能还没赋值上去，因为里面的this.xxx可能还是undefined，会引起一些错误
    this.$define('$$inited', true)

    // 依赖初始化值
    getters.forEach((item) => {
      this.$compute(item.key, item.getter)
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
    
    let oldData = valueOf(this.$$data)
    xset(this, path, value)
    
    let newData = valueOf(this.$$data)
    this.$dispatch(path, newData, oldData)
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
    let oldData = valueOf(this.$$data)

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

    let newData = valueOf(this.$$data)
    this.$dispatch(path, newData, oldData)
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
    this.$compute(key, getter) 
  }
  /**
   * 依赖收集
   */
  $collect() {
    let { getter, key, dependency, target } = this.$$dep

    if (this.$$deps.find(item => item.key === key && item.dependency === dependency)) {
      return false
    }
    let callback = () => {
      let oldData = valueOf(this.$$data)
      this.$compute(key, getter)
      let newData = valueOf(this.$$data)
      this.$dispatch(key, newData, oldData)
    }
    this.$$deps.push({ key, dependency })
    target.$watch(dependency, callback, true)
    return true
  }
  /**
   * 依赖计算赋值
   */
  $compute(key, getter) {
    this.$define('$$dep', { key, getter })
    let data = this.$$data
    let oldValue = parse(data, key)
    let newValue = getter.call(this)
    if (!isEqual(oldValue, newValue)) {
      assign(data, key, newValue)
    }
    this.$define('$$dep', {})
    return newValue
  }
  /**
   * 判断一个key是否在当前dataview中存在
   * @param {*} key
   */
  $has(path) {
    let target = this.$$data // 因为依赖收集里面要用到$has，如果这里直接用this的话，会导致死循环
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
  $watch(path, fn, deep) {
    if (this.$$locked) {
      return
    }

    path = makeKeyPath(makeKeyChain(path))

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
  /**
   * 触发watchers，注意，newData和oldData不是path对应的值，而是整个objx的值，在watcher的回调函数中，得到的是wathcher自己的path对应的值
   * @param {*} path 
   * @param {*} newData this的新数据
   * @param {*} oldData this的老数据
   */
  $dispatch(path, newData, oldData) {
    if (!this.$$inited) {
      return
    }

    if (this.$$locked) {
      return
    }

    let listeners = this.$$listeners.filter(item => item.path === path || (item.deep && path.toString().indexOf(item.path + '.') === 0) || item.path === '*')
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
      e.key = item.path
      e.type = item.deep ? 'deep' : 'shallow'

      let targetPath = item.path === '*' ? '' : item.path
      let newValue = parse(newData, targetPath)
      let oldValue = parse(oldData, targetPath)
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
        let parentNewData = valueOf(parent.$$data)
        let parentOldData = assign(clone(parentNewData), key, oldData)
        parent.$dispatch(finalPath, parentNewData, parentOldData)
        propagate(parent)
      }
    }
    propagate(this)
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
    for (let i = snapshots.length - 1; i >= 0; i --) {
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
    let validators = this.$$validators.filter(item => arguments.length === 0 || item.path === path) // path不传的时候，校验全部验证规则
    for (let i = 0, len = validators.length; i < len; i ++) {
      let item = validators[i]
      if (!isObject(item)) {
        continue
      }
      let { check, message, warn, path } = item // 这里path是必须的，当参数path为undefined的时候，要通过这里来获取
      let value = arguments.length < 2 ? valueOf(parse(this.$$data, path)) : data
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
  /**
   * 基于当前对象，克隆出一个新对象
   */
  $clone() {
    let data = this.$$data
    let value = valueOf(data)
    return new Objext(value)
  }
  valueOf() {
    return valueOf(this.$$data)
  }
  toString() {
    return JSON.stringify(this.valueOf())
  }
}

export default Objext
