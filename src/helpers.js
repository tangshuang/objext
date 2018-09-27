import Objext from './objext'
import {
  isArray,
  isObject,
  isInstanceOf,
  setProto,
  valueOf,
  makeKeyChain,
  assign,
  parse,
  each,
  isEqual,
} from './utils'

/**
 * 本页的所有target都必须是一个Objext的实例
 */

export function xset(target, path, value) {
  let chain = makeKeyChain(path)
  let key = chain.pop()
  let node = target

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

  xdefine(node, key, value)
  
  let data = target.$$data
  let oldValue = parse(data, path)
  if (!isEqual(oldValue, value)) {
    assign(data, path, value)
  }
}

export function xdefine(target, key, value) {
  let data = xcreate(value, key, target)
  let $$ = data
  Object.defineProperty(target, key, {
    configurable : true,
    enumerable : true,
    set: (v) => {
      if (target.$$locked) {
        return
      }
      
      // 校验数据
      // 会冒泡上去
      target.$validate(key, v)

      let oldData = valueOf(target.$$data)
      let oldValue = oldData[key]
      let data = xcreate(v, key, target)
      $$ = data

      // 改动$$data上的数据，由于父子节点之间的$$data是引用关系，因此，当子节点的这个动作被触发时，父节点的$$data也被修改了
      // 由于数据的继承性，只有当数据值被真正修改的时候，才更新$$data
      if (!isEqual(oldValue, v)) {
        assign(target.$$data, key, v)
      }

      // 触发watch
      // 会冒泡上去
      let newData = valueOf(target.$$data)
      target.$dispatch(key, newData, oldData)
    },
    get() {
      /**
       * 这里需要详细解释一下
       * 由于依赖收集中$$dep仅在顶层的this中才会被给key和getter，因此，只能收集到顶层属性
       * 但是，由于在进行监听时，deep为true，因此，即使是只有顶层属性被监听，当顶层属性的深级属性变动时，这个监听也会被触发，因此也能带来依赖响应
       */
      if (target.$$dep && target.$$dep.key && target.$$dep.getter) {
        target.$$dep.dependency = key
        target.$$dep.target = target
        target.$collect()
      }

      return $$
    },
  })
}

export function xcreate(value, key, target) {
  if (isInstanceOf(value, Objext)) {
    value.$define('$$key', key)
    value.$define('$$parent', target)
    return value
  }
  else if (isObject(value)) {
    return xobject(value, key, target)
  }
  else if (isArray(value)) {
    return xarray(value, key, target)
  }
  else {
    return value
  }
}
export function xobject(value, key, target) {
  let objx = new Objext()

  objx.$define('$$key', key)
  objx.$define('$$parent', target)

  // 创建引用，这样当修改子节点的时候，父节点自动修改
  if (!target.$$data[key]) {
    target.$$data[key] = {}
  }

  Object.defineProperty(objx, '$$data', {
    configurable: true,
    get: () => target.$$data[key],
  })
  Object.defineProperty(objx, '$$locked', {
    configurable: true,
    get: () => target.$$locked,
  })
  
  objx.$put(value)

  return objx
}
export function xarray(value, key, target) {
  let data = []
  let prototypes = Objext.prototype
  //  创建一个proto作为一个数组新原型，这个原型的push等方法经过改造
  let proto = []

  // 创建引用，这样当修改子节点的时候，父节点自动修改
  if (!target.$$data[key]) {
    target.$$data[key] = []
  }
  
  let descriptors = {
    $$key: { 
      value: key,
    },
    $$parent: { 
      value: target,
    },
    $$data: { 
      value: target.$$data[key],
    },
    // 下面这些属性都是为了冒泡准备的，array没有$set等设置相关的属性
    $$locked: {
      get: () => target.$$locked,
    },
    $$listeners: {
      value: [],
    },
    $$validators: {
      value: [],
    },
    $$inited: {
      value: true,
    },
    $dispatch: {
      value: prototypes.$dispatch.bind(data),
    },
    $validate: {
      value: prototypes.$validate.bind(data),
    },
  }

  let methods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']
  methods.forEach((method) => {
    descriptors[method] = {
      value: function(...args) {
        if (target.$$locked) {
          return
        }

        // 这里注意：数组的这些方法没有校验逻辑，因为你不知道这些方法到底要对那个元素进行修改
        
        let oldData = valueOf(target.$$data)
        
        Array.prototype[method].call(target.$$data[key], ...args)
        Array.prototype[method].call(this, ...args)
        // TODO: 根据不同类型的操作判断是否要重新xdefine
        this.forEach((item, i) => {
          // 调整元素的path信息，该元素的子元素path也会被调整
          xdefine(this, i , item)
        })
        
        let newData = valueOf(target.$$data)
        target.$dispatch(key, newData, oldData)
      }
    }
  })

  Object.defineProperties(proto, descriptors)
  // 用proto作为数组的原型
  setProto(data, proto)
  value.forEach((item, i) => {
    xdefine(data, i, item)
    target.$$data[key][i] = item
  })
  return data
}