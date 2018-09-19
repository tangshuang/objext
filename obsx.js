class Obsx {
  constructor(data) {
    this.$define('_editing', false, true)
    this.$define('_typeof', {})
    this.$define('_snapshots', [])
    this.$define('_data', {})
    this.$define('_validators', {})

    // 下面这两个会被子元素用到，watchers和子元素共享
    this.$define('_watchers', [], true)
    this.$define('_path', '', true)

    // setTimeout使得时序推后
    setTimeout(() => this.$put(data))
  }
  $define(key, value, writable) {
    Object.defineProperty(this, key, { value, writable })
  }
  /**
   * 设置一个key的值
   * @param {*} key
   * @param {*} value
   */
  $set(key, value) {
    let cloned = clone(value)
    let path = this._path ? this._path + '.' + key : key

    var transferArrayMethods = (arr, path) => {
      class xArray extends Array {}
      let obxarr = new xArray(...arr)
      let methods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']
      methods.forEach((method) => {
        let action = obxarr[method].bind(obxarr)
        let fn = (...args) => {
          let cloned = clone(obxarr)
          action(...args)
          obxarr.forEach((item, i) => {
            if (isInstanceOf(item, Obsx) && item._path.indexOf(path + '.') === 0) {
              item._path = path + '.' + i
            }
            define(obxarr, i, item, path + '.' + i)
          })
          this.$dispatch(path, obxarr, cloned)
        }
        xArray.prototype[method] = fn
      })
      return obxarr
    }
    var compile = (value, path) => {
      if (isArray(value)) {
        let list = [].concat(value)
        each(list, (item, i) => {
          item = compile(item, path + '.' + i)
          define(list, i, item, path + '.' + i)
        })
        let arr = transferArrayMethods(list, path)
        return arr
      }
      else if (isObject(value)) {
        let obx = new Obsx(value)

        obx._path = path
        obx._watchers = this._watchers

        return obx
      }
      else {
        return value
      }
    }
    var define = (obj, prop, value, path) => {
      Object.defineProperty(obj, prop, {
        configurable : true,
        enumerable : true,
        set: (v) => {
          let data = compile(v, path)
          this.$dispatch(path, data, value)
          value = data
        },
        get() {
          return value
        },
      })
    }
    var set = (obj, key, value) => {
      let data = compile(value, path)
      let chain = key.split('.')
    
      if (!chain.length) {
        define(obj, key, data, path)
        return
      }
    
      let tail = chain.pop()
      let target = obj
    
      for (let i = 0, len = chain.length; i < len; i ++) {
        let key = chain[i]
        let next = chain[i + 1] || tail
        if (/[0-9]+/.test(next) && !Array.isArray(target[key])) {
          target[key] = []
        }
        else if (typeof target[key] !== 'object') {
          target[key] = compile({}, path)
        }
        target = target[key]
      }
    
      define(target, tail, data, path)
    }    
    
    set(this, key, cloned)
    assign(this._data, key, cloned)
  }
  /**
   * 增量更新数据
   * @param {*} data
   */
  $update(data) {
    let keys = Object.keys(data)
    keys.forEach(key => this.$set(key, data[key]))
  }
  /**
   * 全量更新数据，老数据会被删除
   * @param {*} data 要设置的数据
   */
  $put(data) {
    // 先把当前视图的所有数据删掉
    let currentKeys = Object.keys(this._data)
    currentKeys.forEach((key) => {
      delete this._data[key]
      delete this[key]
    })
    // 但是，这里注意，快照还是保留的，也就是说可以在editing中间使用put
    this.$update(data)
  }
  /**
   * 获取视图上的数据
   */
  $data() {
    let data = clone(this._data)
    return data
  }
  /**
   * 获取key对应的值
   * @param {*} key
   */
  $get(key) {
    let data = this._data
    return parse(data, key)
  }
  /**
   * 判断一个key是否在当前dataview中存在
   * @param {*} key
   */
  $has(key) {
    let target = this
    let keys = key.split(/\.|\[|\]/).filter(item => !!item)

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]
      if (typeof target !== 'object' || !inObject(key, target)) {
        return false
      }
      target = target[key]
    }

    return true
  }
  $watch(key, fn, deep) {
    this._watchers.push({
      key,
      fn,
      deep,
    })
  }
  $unwatch(key, fn) {
    let indexes = []
    this._watchers.forEach((item, i) => {
      if (item.key === key && item.fn === fn) {
        indexes.push(i)
      }
    })
    // 从后往前删，不会出现问题
    indexes.reverse()
    indexes.forEach(i => this._watchers.splice(i, 1))
  }
  $dispatch(key, newValue, oldValue) {
    let watchers = this._watchers.filter(item => item.key === key || (item.deep && key.indexOf(item.key + '.') === 0))
    watchers.forEach((item) => {
      item.fn(newValue, oldValue)
    })
  }
  /**
   * 基于当前视图，克隆出一个新视图
   */
  $clone() {
    let data = this.$data()
    return new Obsx(data)
  }
  /**
   * 开启编辑模式
   */
  $editBegin() {
    this._editing = true
    let data = this.$data()
    this._snapshots.length = 0
    this._snapshots.push({
      tag: 'origin',
      data
    })
  }
  /**
   * 完成编辑，关闭编辑模式
   */
  $editEnd() {
    this._editing = false
    this._snapshots.length = 0
  }
  /**
   * 创建一个快照，使用editReset可以恢复这个快照
   * @param {*} tagName
   */
  $editTag(tagName) {
    let data = this.$data()
    this._snapshots.push({
      tag: tagName,
      data
    })
  }
  /**
   * 取消编辑过程中的全部改动，将数据恢复到编辑开始时的内容
   */
  $editReset(tagName = 'origin') {
    let index = this._snapshots.findIndex(item => item.tag === tagName)
    if (index === -1) {
      return
    }
    let items = this._snapshots.slice(0, index + 1)
    let item = items.pop()
    this._snapshots.length = 0
    items.forEach(item => this._snapshots.push(item))
    this.$put(item.data)
  }
  /**
   * 设置校验器
   * @param {*} validators 格式如下：
   * {
   *   'name': {
   *     fn: value => typeof value === 'string', // 校验函数
   *     message: '名字必须为一个有效字符串', // 校验失败时的提示语
   *   },
   *   'body.head': { // keyPath，属性路径
   *     fn: value => typeof value === 'object',
   *     message: '头必须是一个对象',
   *   },
   * }
   */
  $formulate(validators) {
    Object.assign(this._validators, validators)
  }
  /**
   * 一次性校验全部数据
   * @param {Function} warn 当校验失败时执行怎样的动作
   * @param {Boolean} all 是否要校验所有规则，为false时，只要遇到第一个不符合规则的，就结束校验
   */
  $validate(warn, all) {
    let validators = this._validators
    let keys = Object.keys(validators)
    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]
      let validator = validators[key]
      if (isObject(validator)) {
        continue
      }
      let { fn, message } = validator
      let value = this.$get(key)
      let res = fn(value)
      if (!res) {
        warn(message, value, key)
        if (!all) {
          return
        }
      }
    }
  }
  toString() {
    return JSON.stringify(this._data)
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

/**
 * 根据keyPath读取对象属性值
 * @param {*} obj 
 * @param {*} path 
 */
function parse(obj, path) {
  let chain = path.split('.')

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
  let chain = path.split('.')

  if (!chain.length) {
    obj[path] = value
    return
  }

  let tail = chain.pop()
  let target = obj

  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    let next = chain[i + 1] || tail
    if (/[0-9]+/.test(next) && !Array.isArray(target[key])) {
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
