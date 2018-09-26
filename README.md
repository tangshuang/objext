# Objext

JS超级对象，在原生object的基础上进行扩展，支持：

- 通过keyPath获取、设置数据
- 响应式，可以通过watch监听某个keyPath
- 数据版本控制，通过commit和reset，可以随时创建快照或恢复数据
- 数据校验
- 数据锁，锁住之后，不能做任何数据修改

## 安装和使用

安装：

```
npm i objext
```

引入：

```js
import Objext from 'objext'
```

```js
const { Objext } = require('objext')
```

```html
<script src="objext/dist/objext.js"></script>
<script>
const { Objext } = window.objext 
</script>
```

实例化：

```js
const objx = new Objext({
  name: 'tomy',
  age: 10,
  body: {
    head: true,
    feet: true,
  },
  get sex() {
    return this.age > 8 ? 'male' : 'female'
  },
  say() {
    alert('Hello~')
  },
})
```

上面这个例子演示了如何创建一个超级对象，过程超级简单，只需要将一个普通对象传入new Objext作为参数即可，这样得到的对象objx和原始的对象的结构是一模一样，然而功能却比原始对象高级N倍。
