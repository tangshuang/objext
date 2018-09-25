import Objext from './objext'
import {
  isArray,
  isObject,
  isInstanceOf,
  setProto,
} from './utils'

export function xcreate(value, key = '', target = null) {
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
  let data = Object.assign({}, value)
  let objx = new Objext()

  objx.$define('$$key', key)
  objx.$define('$$parent', target)
  objx.$put(data)

  return objx
}
export function xarray(value, key, target) {
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
          this[i] = xcreate(item, i, this)
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