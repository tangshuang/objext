/**
 * 浅遍历对象
 * @param {*} data
 * @param {*} fn
 */
export function each(data, fn) {
  let keys = Object.keys(data)
  keys.forEach(key => fn(data[key], key))
}

/**
 * 深遍历对象
 * @param {*} data
 * @param {*} fn
 */
export function traverse(data, fn) {
  let traverse = (data, path = '') => {
    each(data, (value, key) => {
      path = path ? path + '.' + key : key
      if (isObject(value) || isArray(value)) {
        fn(value, key, data, path, true)
        traverse(value, path)
      }
      else {
        fn(value, key, data, path, false)
      }
    })
  }
  traverse(data)
}

/**
 * 将一个不规则的路径转化为规则路径
 * @example
 * makeKeyPath(makeKeyChain('name.0..body[0].head')) => name[0].body[0].head
 */
export function makeKeyChain(path) {
  let chain = path.toString().split(/\.|\[|\]/).filter(item => !!item)
  return chain
}
export function makeKeyPath(chain) {
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
 * 根据keyPath读取对象属性值
 * @param {*} obj
 * @param {*} path
 * @example
 * parse({ child: [ { body: { head: true } } ] }, 'child[0].body.head') => true
 */
export function parse(obj, path) {
  let chain = makeKeyChain(path)

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
 * @example
 * assign({}, 'body.head', true) => { body: { head: true } }
 */
export function assign(obj, path, value) {
  let chain = makeKeyChain(path)

  if (!chain.length) {
    return obj
  }

  let key = chain.pop()

  if (!chain.length) {
    obj[key] = value
    return obj
  }

  let target = obj

  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    let next = chain[i + 1] || key
    if (/^[0-9]+$/.test(next) && !Array.isArray(target[key])) {
      target[key] = []
    }
    else if (typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }

  target[key] = value

  return obj
}

/**
 * 深克隆一个对象
 * @param {*} obj
 */
export function clone(obj) {
  let parents = []
  let clone = function(origin) {
    if (!isObject(origin) && !isArray(origin)) {
      return origin
    }

    let result = isArray(origin) ? [] : {}
    let keys = Object.keys(origin)

    parents.push({ origin, result })

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]
      let value = origin[key]
      let referer = parents.find(item => item.origin === value)

      if (referer) {
        result[key] = referer.result
      }
      else {
        result[key] = clone(value)
      }
    }

    return result
  }

  let result = clone(obj)
  parents = null
  return result
}

export function isArray(arr) {
  return Array.isArray(arr)
}

export function isFunction(fn) {
  return typeof fn === 'function'
}

export function isObject(obj) {
  return obj && typeof obj === 'object' && obj.constructor === Object
}

export function inArray(item, arr) {
  return arr.indexOf(item) > -1
}

export function inObject(key, obj) {
  return inArray(key, Object.keys(obj))
}

export function isInstanceOf(ins, cons) {
  return ins instanceof cons
}

export function isEmpty(value) {
  if (isArray(value)) {
    return value.length === 0
  }
  else if (isObject(value)) {
    return Object.keys(value).length
  }
  else if (typeof value === 'string') {
    return value === ''
  }
  else if (value === null || value === undefined || isNaN(value)) {
    return true
  }
  else {
     return false
  }
}

export function isEqual(val1, val2) {
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
 * @example
 * unionArray([1, 2], [1, 3]) => [1, 2, 3]
 */
export function unionArray(a, b) {
  return a.concat(b.filter(v => !inArray(v, a)))
}

/**
 * 以某个对象作为原型创建一个对象
 * @param {*} obj
 */
export function inheritOf(obj) {
  if (!isObject(obj) && !isArray(obj)) {
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

/**
 * 获取一个复杂结构对象的字面量值，它会同时读取原型链上的可枚举值
 * @param {*} obj
 */
export function valueOf(obj) {
  if (obj && typeof obj === 'object') {
    let result = isArray(obj) ? [] : {}
    for (let key in obj) {
      let value = obj[key]
      if (value && typeof value === 'object') {
        result[key] = valueOf(value)
      }
      else {
        result[key] = value
      }
    }
    return result
  }
  else {
    return obj
  }
}

/**
 * 重新设置对象的原型为proto
 * @param {*} obj
 * @param {*} proto
 */
export function setProto(obj, proto) {
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(obj, proto)
  }
  else {
    obj.__proto__ = proto
  }
}

export function sort(obj) {
  let keys = Object.keys(obj)
  keys.sort()
  let o = {}
  keys.forEach((key) => {
    let value = obj[key]
    if (isObject(value)) {
      value = sort(value)
    }
    o[key] = value
  })
  return o
}

export function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serialize(replacer, cycleReplacer), spaces)
}

function serialize(replacer, cycleReplacer) {
  let stack = []
  let keys = []

  if (cycleReplacer == null) {
    cycleReplacer = function(key, value) {
      if (stack[0] === value) {
        return "[Circular ~]"
      }
      return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
    }
  }

  return function(key, value) {
    if (stack.length > 0) {
      let thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) {
        value = cycleReplacer.call(this, key, value)
      }
    }
    else {
      stack.push(value)
    }

    return replacer == null ? value : replacer.call(this, key, value)
  }
}

// https://github.com/darkskyapp/string-hash/blob/master/index.js
export function getStringHashcode(str) {
  let hash = 5381
  let i = str.length

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }

  return hash >>> 0
}

export function getObjectHashcode(obj) {
  let o = stringify(obj)
  let n = JSON.parse(o)
  let m = sort(n)
  let str = JSON.stringify(m)
  let hash = getStringHashcode(str)
  return hash
}

export function defineProperty(target, key, value, configurable = true) {
  Object.defineProperty(target, key, { value, configurable })
}
export function defineProperties(target, options, configurable = true) {
  let props = Object.keys(options)
  props.forEach((prop) => {
    defineProperty(target, prop, options[prop], configurable)
  })
}
