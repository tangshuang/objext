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
      chain = chain.concat(makeChain(path))
    }

    return makePath(chain)
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

  static create(value, key = '', target = null) {
    if (isInstanceOf(value, Objext)) {
      value.$define('$$key', key)
      value.$define('$$parent', target)
      return value
    }
    else if (isObject(value)) {
      return Objext.xobject(value, key, target)
    }
    else if (isArray(value)) {
      return Objext.xarray(value, key, target)
    }
    else {
      return value
    }
  }
  static xobject(value, key, target) {
    let data = Object.assign({}, value)
    let objx = new Objext()

    objx.$define('$$key', key)
    objx.$define('$$parent', target)
    objx.$put(data)

    return objx
  }
  static xarray(value, key, target) {
    let data = [].concat(value)
    //  创建一个proto作为一个数组新原型，这个原型的push等方法经过改造
    let proto = []
    let descriptors = {
      $$key: { value: key },
      $$parent: { value: target },
    }
    let methods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']
    methods.forEach((method) => {
      descriptors[method] = {
        value: function(...args) {
          let oldValue = valueOf(this)
          Array.prototype[method].call(this, ...args)
          this.forEach((item, i) => {
            // 调整元素的path信息，该元素的子元素path也会被调整
            this[i] = Objext.create(item, i, this)
          })
          let newValue = valueOf(this)
          let root = target.$$root
          let path = target.$path()
          root.$dispatch(path, newValue, oldValue)
        }
      }
    })
    Object.defineProperties(proto, descriptors)
    // 用proto作为arr的原型
    setProto(data, proto)
    return data
  }
}


/**
 * 浅遍历对象
 * @param {*} data 
 * @param {*} fn 
 */
function each(data, fn) {
  let keys = Object.keys(data)
  keys.forEach(key => fn(data[key], key))
}

/**
 * 深遍历对象
 * @param {*} data 
 * @param {*} fn 
 */
function traverse(data, fn) {
  let traverse = (data, path = '') => {
    each(data, (value, key) => {
      path = path ? path + '.' + key : key
      fn(value, key, data, path)
      if (typeof value === 'object') {
        traverse(value, path)
      }
    })
  }
  traverse(data)
}

function makeChain(path) {
  let chain = path.toString().split(/\.|\[|\]/).filter(item => !!item)
  return chain
}
function makePath(chain) {
  let path = ''
  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    if (/^[0-9]+$/.test(key)) {
      path += '[' + key + ']'
    }
    else {
      path += path ? '.' + key : key
    }
  }
  return path
}
/**
 * 将一个不规则的路径转化为规则路径
 * @param {*} path 
 */
function make(path) {
  let chain = makeChain(path)
  return makePath(chain)
}

/**
 * 根据keyPath读取对象属性值
 * @param {*} obj 
 * @param {*} path 
 */
function parse(obj, path) {
  let chain = makeChain(path)

  if (!chain.length) {
    return obj
  }

  let target = obj
  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    if (target[key] === undefined) {
      return undefined
    }
    target = target[key]
  }
  return target
}

/**
 * 根据keyPath设置对象的属性值
 * @param {*} obj 
 * @param {*} path 
 * @param {*} value 
 */
function assign(obj, path, value) {
  let chain = makeChain(path)
  let tail = chain.pop()

  if (!chain.length) {
    obj[path] = value
    return
  }

  let target = obj

  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    let next = chain[i + 1] || tail
    if (/^[0-9]+$/.test(next) && !Array.isArray(target[key])) {
      target[key] = []
    }
    else if (typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }

  target[tail] = value
}

/**
 * 克隆一个对象
 * @param {*} obj 
 * @param {*} fn 
 */
function clone(obj, fn) {
  let parents = []
  let clone = function(origin, path = '', obj) {
    if (!isObject(origin) && !isArray(origin)) {
      return origin
    }

    let result = isArray(origin) ? [] : {}
    let keys = Object.keys(origin)

    parents.push({ obj, path, origin, result })

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]
      let value = origin[key]
      let referer = parents.find(item => item.origin === value)
      let computed = isFunction(fn) ? fn(value, key, origin, path, obj, referer) : value

      if (!isObject(computed) && !isArray(computed)) {
        result[key] = computed
      }
      else {
        if (referer) {
          result[key] = referer.result
        }
        else {
          result[key] = clone(computed, path ? path + '.' + key : key)
        }
      }
    }

    return result
  }

  let result = clone(obj, '', obj)
  parents = null
  return result
}

function isArray(arr) {
  return Array.isArray(arr)
} 

function isFunction(fn) {
  return typeof fn === 'function'
}

function isObject(obj) {
  return obj && typeof obj === 'object' && obj.constructor === Object
}

function isInstanceOf(ins, cons) {
  return ins instanceof cons
}

function isEqual(val1, val2) {
  function equal(obj1, obj2) {
    let keys1 = Object.keys(obj1)
    let keys2 = Object.keys(obj2)
    let keys = unionArray(keys1, keys2)

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]

      if (!inArray(key, keys1)) {
        return false
      }
      if (!inArray(key, keys2)) {
        return false
      }

      let value1 = obj1[key]
      let value2 = obj2[key]
      if (!isEqual(value1, value2)) {
        return false
      }
    }

    return true
  }

  if (isObject(val1) && isObject(val2)) {
    return equal(val1, val2)
  }
  else if (isArray(val1) && isArray(val2)) {
    return equal(val1, val2)
  }
  else {
    return val1 === val2
  }
}

/**
 * 求数组的并集
 * @param {*} a 
 * @param {*} b 
 */
function unionArray(a, b) {
  return a.concat(b.filter(v => !inArray(v, a)))
}

function inheritOf(obj) {
  if (!isObject(obj) || !isArray(obj)) {
    return obj
  }
  let result = isArray(obj) ? [] : {}
  setProto(result, obj)
  for (let prop in obj) {
    let value = obj[prop]
    if (isObject(value) || isArray(value)) {
      result[prop] = inheritOf(value)
    }
  }
  return result
}

function valueOf(obj) {
  if (!isObject(obj) || !isArray(obj)) {
    return obj
  }
  let result = isArray(obj) ? [] : {}
  for (let key in obj) {
    let value = obj[key]
    if (isObject(value) || isArray(value)) {
      result[key] = valueOf(value)
    }
    else {
      result[key] = value
    }
  }
  return result
}

function setProto(obj, proto) {
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(obj, proto)
  }
  else {
    obj.__proto__ = proto
  }
} 
