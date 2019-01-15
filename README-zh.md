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

注意：$get得到的结果，是objext数据的一份拷贝，对该结果进行任何操作，都不会影响objext的当前数据。而且，还要考虑计算属性的问题，get得到的结果，会把计算属性转化为值，从而丢失计算的特性。

### $set(keyPath, value, dispatch)

和$get的好处一样，普通对象你不能读取一个undefined属性的子属性，更别提给它赋值。而$set就可以做到，它可以为一个不存在的深层次的属性进行赋值：

```js
const objx = new Objext({})
objx.$set('body.head.hair', 'black')
// => { body: { head: { hair: 'black' } } }
```

更重要的是，只有通过$set方法，才能让一个属性具备可响应式能力。比如你直接objx.feet = 2，feet这个属性不是响应式的，你不能用$watch去监听它。但是你objx.$set('feet', 2)之后，它就是响应式了。也就是说，必须用$set来添加属性，而不能直接像object属性赋值一样。

`dispatch`用于是否安静更新值，默认为true，表示会触发对应keyPath的watcher，而如果把`dispatch`设为false，则不会触发，实现静默更新值。

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

- oldValue: 老数据
- newValue: 新数据
- path: 被修改的属性的path信息
- match: watch的第一个参数，即当前匹配到的watcher的path值
- target: 被监听到的属性所属的objext对象
- preventDefault(): 放弃剩下的所有监听回调
- stopPropagation(): 禁止冒泡，Objext的监听采取冒泡模式，当一个节点的属性发生变化时，先是这个节点的watcher被激活，然后往它的父级不断广播，直到最顶层
- stack: 调用栈，可以大致了解调用过程，当然，通过stack定位之后，最好还是用浏览器的开发者工具来调试

如果你嫌麻烦，可以这样做更舒服：

```js
objx.$watch('body.head.hair', ({ oldValue, newValue }) => {
  // 这样更舒服吧
})
```

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

### $revert(tag)

删除名为tag的所有快照。

## 数据校验

通过设置校验器，可以对数据进行校验。它有两种校验方式，一种是在使用修改/$set添加属性的时候，另外一种是直接调用$validate方法，对整个数据进行全量校验。

这里需要注意的是，通过手动添加属性，是不能触发校验的，校验只有在使用$set进行添加属性时被使用。
其实，实际上，必须用$set来添加属性。

还有一点是，校验是后置的，也就是说，你无法在实例化时校验初始数据。

### $formulate(validators)

添加校验器。

它可以被多次执行，所有的校验器都会被记录下来。使用时应该注意，校验器一般是在使用前设置，因为添加好校验器之后，它们是不能被删除的。

_validators_是一个数组，里面包含了所有校验器配置信息，每一个元素都是一个对象，即一个校验器的配置信息。这个对象的格式如下：

```js
{
  path: 'body.head', // 要校验的路径
  determine: value => Boolean, // 是否要校验这个path，返回false的时候，将不会校验这个path
  validate: value => Boolean, // 校验函数，返回boolean值
  message: '格式不对', // 校验失败时返回的错误message信息
  warn: error => {}, // 校验失败后要执行的函数，error包含了message信息，另外还包含value和path信息
  deferred: true, // 是否异步校验，异步校验不会中断校验过程，从当前进程中脱离出去，而是交给异步进程去处理，这种情况下，你必须传warn来获得错误信息
  order: 10, // 校验顺序，从小到大排序，默认值为10
}
```

所有的校验器被放在一个队列里。在校验时，一个校验器未通过失败时，就不会往下继续校验了。

### $validate(path, next)

校验数据，校验器队列会被依次运行。

- path: 运行通过$formulate设置的path为该值的校验器。如果不传或传null，将会一次性校验所有数据。
- next: 在传了path的情况下生效，当传入next的时候，表示不是对现在已经在objext中的数据进行校验，而是用path对应的校验器去检查一个值，看这个值是否符合校验规则，只有在符合校验规则的情况下，才能写入值

校验数据的时候有一个规则，假如path对应的值是一个objext实例，校验器会自动运行这个objext实例的所有校验器，也就是说，校验一个path，会把这个path下所有的校验规则都过一遍。

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


## 链式操作
Objext的实例可以链式操作：

```js
objx.$slient(true).$set('name', 'lily').$slient(false)
```

这行代码可以不触发watch的情况下更新name属性。

## 其他接口

另外，为了更方便的使用，Objext提供了几个方法。

### $put(data)

全量更新。
用data去替换现在objext内的所有数据。原有数据会被全部清除。但是注意，watch绑定的回调不会被清除。

### $update(data)

增量更新。
批量更新data，如果data中的某个属性不存在，则增加这个属性的数据。
它不会删除任何数据，只会让数据更新或增加。

注意：$update和$put也会触发watch的东西，但是，它们是一次性触发的，在全部数据修改完之后，才会触发watch回调，而非每次修改一个属性就被触发。具体可以阅读下方的$batchStart/$batchEnd

### $slient(is)

切换安静模式/响应式模式。is为true时，表示进入安静模式，所有的watchers都不会被触发。

```js
objx.$slient(true)
objx.$set('name', 'lily')
objx.$slient(false)
```

### $batchStart() / $batchEnd()

开启一个批量更新任务，开启之后，在调用$batchEnd之前，任何$set都不会触发watch回调，直到$batchEnd被调用时，所有收集到的watch才会一次性执行所有回调。

```js
objx.$batchStart()
objx.$set('body.main', 'left')
objx.$set('name', 'ceci')
objx.$set('body.main', 'right')
objx.$batchEnd()
```

上面的代码中，执行了多次$set，但是，所有的变动的回调会在$batchEnd的时候才执行，每一个属性对应的回调只会执行一次，因此body.main的变动会被视为一次，最终的新值是right，它的回调只会执行一次。

### $describe(key, getter)

设置一个计算属性。

- key: 要设置的属性名。注意，不支持keyPath方式，因为计算属性相对于当前对象。
- getter: getter函数。

### $depend(key, target)

绑定一个计算属性和其他objext实例。
当一个objext实例的某个计算属性依赖另外一个objext实例的某个属性的时候用。

```js
const objx1 = new Objext({
  name: 'tom',
  get age() {
    return objx2.weight / 2
  },
})
```

上面的代码中，objx1的age属性依赖了objx2的weight属性，但是由于计算属性的响应式效果仅对自己有效，它不能做到对外部依赖也有效果。
因此，当objx2.weight发生变化当时候，objx1并不能知道这个变化，它的age属性也就不会变，继续使用缓存，这就会造成错误。
为了解决这个问题，我提供了$bind方法，它可以绑定两个objext实例的相关属性，保证可以做到正常响应。

```js
objx1.$depend('age', objx2)
```

从它的使用上看，它是后置的，开发者要自己去绑定计算属性中包含其他实例的情况的问题。如果你不去绑定，就会遇到我上面说到的问题，记住，计算属性是使用缓存的。

- key: 自己的哪个计算属性是要被绑定的，注意，不支持keyPath形式，因为计算属性都是当前实例的顶级属性
- target: 要绑定的目标实例

通过$bind绑定之后，计算属性会被重新计算一次，可能触发watcher。

### $undepend(key, target)

解绑其他objext实例。

解绑后计算属性中的参数值会发生变化，造成计算属性计算结果的变化，可能触发watcher。
如果不传target，表示把key相关的所有target给解绑。

### $bind(context)

将当前objext实例的所有计算属性计算器中的this绑定为context，也就是说，计算器中的this指代的是context，而非当前objext实例本身。
context必须为另外一个context实例。
$bind具有$depend的功效，因此，如果你执行了$bind，可以不用再执行$depend。

要解除绑定，只需要运行`objx.$bind(false)`即可。

一般而言，这种用法只会在开发者明确知道自己要做绑定操作。否则在撰写计算器时极容易出错。

*注意* $depend和$bind独立于objext本身的数据，他不操作计算器本身，而是在objext实例的整个生命周期有效。
举个例子，如果你事先绑定了一个objx作为this，那么当你使用$put之后，希望新的计算器不绑定objx，那么必须手动调用$bind(false)，因为之前$bind的结果，对新的计算器仍然有效。

### $clone()

基于当前数据，克隆出一个新的Objext对象，在保持数据相同的情况下，和原对象没有任何关系。

### $destory()

销毁当前实例，释放内存。

### $hash

这是一个属性，可以获取当前对象的hash值，在判断两个Objext对象的实际内容是否相等时，可以利用它来进行判断。

### valueOf()

快速获取当前Objext对象的原生对象内容。

### toString()

获取原生对象值的字符串形式。

## 静态方法

Objext也输出一些静态方法，可以帮助开发者快速实现一些小功能。

### isEqual(value1, value2)

判断两个变量是否内容相等，当在判断对象/数组的时候，是判断它们的内容，而非变量的引用地址，因此，它是一个深度判断。

### clone(value)

深克隆一个对象，甚至对象中包含了自引用关系，clone也会保持这种引用。

### isEmpty(value)

判断一个值是否为空。包括空对象、空数组、空字符串、null、undefined、NaN。

### isArray(value)

判断是否为数组，它比Array.isArray更严格，它要求value必须是直接的Array实例，那些基于Array扩展的类的实例不算在内。

### isObject(value)

判断一个值是否为对象，和isArray的判断一样，它非常严格，必须是直接的Object实例才会返回true。

### inArray(item, arr)

判断一个item是否在数组arr中。

### inObject(prop, obj)

判断对象obj是否拥有属性prop。这个判断也很严格，它要求prop在obj中是可枚举的，它和 prop in obj 的判断完全不同。
