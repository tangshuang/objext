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

## 方法

你可以像使用普通对象一样使用objext实例，但是，这样会造成一些问题，特别是不能使用delete，也不能直接赋值一个新属性，这样会丢失这些属性的自动响应能力，如果你用过vue的话肯定对这个思路很了解。

通过Objext创建的对象拥有以下方法，这些方法全部以$开头，并且是隐藏式的，不能通过for...in枚举。


### $get(keyPath)

keyPath是指获取一个属性节点的路径，例如获取objx.body.head.hair属性，'body.head.hair'就是它的keyPath。

和普通对象不同的是，通过$get方法，可以直接用keyPath读取一个属性。用$get方法的好处是，不用担心你去获取一个undefined的属性的子属性，举个例子，objx.body为undefined，那么，你在读取objx.body.head的时候，就会报错。但是用objx.$get('body.head')就可以避免这个问题。

### $set(keyPath, value)

和$get的好处一样，普通对象你不能读取一个undefined属性的子属性，更别提给它赋值。而$set就可以做到，它可以为一个不存在的深层次的属性进行赋值：

```js
const objx = new Objext({})
objx.$set('body.head.hair', 'black')
// => { body: { head: { hair: 'black' } } }
```

更重要的是，只有通过$set方法，才能让一个属性具备可响应式能力。比如你直接objx.feet = 2，feet这个属性不是响应式的，你不能用$watch去监听它。但是你objx.$set('feet', 2)之后，它就是响应式了。

### $remove(keyPath)

用来移除某个属性，替代delete操作。

### $watch(keyPath, callback)

和angular的$watch使用很像，它用来监听一个属性发生变化：

```js
objx.$watch('body.head.hair', (e, newValue, oldValue) => {
  // e: 包含一些信息，你可以用来进行判断 
  // newValue: 新值
  // oldValue: 老值
  // 任何对body.head.hair的修改都会触发callback，即使newValue===oldValue，因此，你必须在callback里面自己做逻辑去判断是否要执行一些代码
})
```

