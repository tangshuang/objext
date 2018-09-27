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

## 基于keyPath的数据操作

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

## 响应式数据

Objext创建到对象是响应式的，和vue的那种模式一样，当一个属性发生变化时，是可以被监测到的。

### $watch(keyPath, callback, deep)

和angular的$watch使用很像，它用来监听一个属性发生变化：

```js
objx.$watch('body.head.hair', (e, newValue, oldValue) => {
  // e: 包含一些信息，你可以用来进行判断 
  // newValue: 新值
  // oldValue: 老值
  // 任何对body.head.hair的修改都会触发callback，即使newValue===oldValue，因此，你必须在callback里面自己做逻辑去判断是否要执行一些代码
})
```

我们看下e里面都有些什么：

- path: 被修改的属性的path信息
- key: watch的第一个参数
- target: 被监听到的属性所属的对象
- preventDefault(): 放弃剩下的所有监听回调
- stopPropagation(): 禁止冒泡，Objext的监听采取冒泡模式，当一个节点的属性发生变化时，先是这个节点的watcher被激活，然后往它的父级不断广播，直到最顶层


**deep**

当第三个参数deep设置为true的时候，表示深度观察，它的深层级节点发生变动的时候也能监听到。

**keyPath为'*'**

将keyPath设置为'*'表示监听任何变化。

### $unwatch(keyPath, callback)

$watch的反函数，取消某个监听。

### 计算属性

Objext支持计算属性，传入原生的计算属性，之后可以得到一个响应式的计算属性，并且具备缓存能力。注意，仅支持传入getter，setter将被直接丢掉。

```js
const objx = new Objext({
  age: 10,
  get height() {
    return this.age * 12.5
  },
})
objx.$watch('height', (e, newValue, oldValue) => {
  console.log(newValue)
})
objx.age = 20
// 由于height属性依赖age属性，因此，当修改age属性时，height也会同时被改变。
```

## 数据版本控制

一个数据，在通过Objext的方法进行修改时，它是基于当前的一个镜像，如果你玩过docker的话，对镜像应该比较熟悉。Objext提供了数据版本控制的能力，通过两个方法，可以实现创建一个快照，和恢复一个快照的能力。

### $commit(tag)

创建一个名为tag的快照。

### $reset(tag)

恢复到名为tag的快照的数据。

```js
objx.name = 'tomy'
objx.$commit('version1')
objx.name = 'jimy'
objx.$reset('version1')
console.log(objx.name) // => 'tomy'
```

## 数据校验

通过设置校验器，可以对数据进行校验。它有两种校验方式，一种是在使用$set修改/添加属性的时候，另外一种是直接调用$validate方法，对整个数据进行全量校验。

这里需要注意的是，通过手动修改/赋值属性，是不能触发校验的，校验只有在使用$set时被使用。

还有一点是，校验是后置的，也就是说，你无法在实例化时校验初始数据。

### $formulate(validators)

添加校验器。

它可以被多次执行，所有的校验器都会被记录下来。使用时应该注意，校验器一般是在使用前设置，因为添加好校验器之后，它们是不能被删除的。

_validators_是一个数组，里面包含了所有校验器配置信息，每一个元素都是一个对象，即一个校验器的配置信息。这个对象的格式如下：

```js
{
  path: 'body.head', // 要校验的路径
  check: value => Boolean, // 校验函数，返回boolean值
  message: '格式不对', // 校验失败时返回的错误message信息
  warn: error => {}, // 校验失败后要执行的函数，error包含了message信息，另外还包含value和path信息
}
```

所有的校验器被放在一个队列里。在校验时，一个校验器未通过失败时，就不会往下继续校验了。

### $validate()

一次性校验所有数据，校验器队列会被依次运行。

## 数据锁

通过锁开关，可以实现对数据的锁定和解锁。对象被锁死之后，无法进行修改操作。

### $lock()

锁死数据。

```js
objx.name = 'tomy'
objx.$lock()
objx.name = 'pina'
console.log(objx.name) // => 'tomy'
```

上锁后，深层级的数据也被上锁，无法被修改。

### $unlock()

解锁数据。

## 其他

另外，为了更方便的获取对象的信息，Objext提供了几个更便捷的方法。

### $clone()

基于当前数据，克隆出一个新的Objext对象，在保持数据相同的情况下，和原对象没有任何关系。

### $$hash

这是一个属性，可以获取当前对象的hash值，在判断两个Objext对象的实际内容是否相等时，可以利用它来进行判断。

### valueOf()

快速获取当前Objext对象的原生对象内容。

### toString()

获取原生对象值的字符串形式。
