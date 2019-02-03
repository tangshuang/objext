# Objext

A js object super extension.

Supporting:

- get/set properties by using keyPath
- responsive, watch changes by keyPath
- data version, create/reset snapshots
- data validation
- data lock, immutable after locked

【[中文文档](README-zh.md)】

## Install & Usage

Install the pacakge in your project:

```
npm i objext
```

And then import it in your code:

```js
import Objext from 'objext'
```

Or use CommonJS:

```js
const { Objext } = require('objext')
```

Or use in browser:

```html
<script src="node_modules/objext/dist/objext.js"></script>
<script>
const { Objext } = window['objext']
</script>
```

And then create a objext instance:

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

As you seen, just pass a normal js object into the constructor to create a objext instance.

Now you can use `objx` as a normal object, however, you can use more feature.

## Data operation with keyPath

In normal js object, you can read a property by using `obj.prop`, however when you read a deeper property like `obj.body.feet`, if `obj.body` is undefined, you will get an TypeError. Using objext $get to avoid this.

### $get(keyPath)

Get data by keyPath. keyPath is a string which is the path to get the deep property value.

It will return the value you want to get, notice, if the property is a computed property, the return value will be the computed result.

```js
let feet = objx.$get('body.feet')
let feet = objx.body.feet
```

The difference between the previous sentences is, if original objx.body.feet is an object, objx.body.feet will return an objext instance, not the original object, so that you can use $get on it too.

### $set(keyPath, value)

Set data by keyPath.

```js
objx.$set('body.feet', 1)
objx.body.feet = 1
```

However, if objx.body is not defined, it will be set as an object automaticly:

```js
console.log(objx.body) // undefined
objx.$set('body.feet', 1)
console.log(objx.body) // an objext instance which has 'feet' property
```

Notice, directly add a property to an objext instance is not allowed too, you must use `$set` or `$update` to add new properties.

### $remove(keyPath)

Remove data by keyPath.

```js
objx.$remove('body.feet')
```

Notice, it is completely not like `delete` operation. `delete objx.body.feet` is not allowed when you using objext, because it will broken reactive feature of objext.

## Responsive data

If you have used Vue or Mobx, you may be familar with responsive data. Objext support responsive data, and you can watch the change of data change.

### $watch(keyPath, callback, deep)

It is very like angular's $watch method:

```js
objx.$watch('body.head.hair', (e, newValue, oldValue) => {
  // ...
})
```

Then I use `$set` or directly set objx.body.head.hair to change its value, the callback function will run:

```js
objx.$set('body.head.hair', 'black')
objx.body.head.hair = 'black'
```

The paramater `e` of callback contains:

- oldValue
- newValue
- path: the real changed property's keyPath
- key: the value of $watch's first parameter `keyPath`
- target: the parent node of changed property
- preventDefault(): stop invoke other callbacks of real keyPath
- stopPropagation(): stop invoke callbacks of this property's parents and ancestors
- isEqual(): a helper function to compare oldValue and newValue

So you can do like this:

```js
objx.$watch('body.head.hair', ({ oldValue, newValue, isEqual }) => {
  if (!isEqual(oldValue, newValue)) {
    // do something...
  }
})
```

`deep` is to set watch children properties.

```js
objx.$watch('body', ({ path }) => {
  console.log(path + ' changed') // => 'body.head.hair changed'
}, true)
objx.body.head.hair = 'red' // this will trigger the callback function too
```

When you want to watch any change, you can set keyPath to be `*`:

```js
objx.$watch('*', () => {
  // run when any property changed
})
```

### $unwatch(keyPath, callback)

Remove the watcher.

## Computed properties

Objext supports computed properties, and you can watch the change of computed properties too:

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
objx.age = 20 // the $watch callback will run, because objx.height is dependent on objx.age
```

Notice, it only supports getter, setter will be dropped if you give.

## Version controlable data

When you use objext to manage some data, your data may change always. However, sometimes you want to recover previous data. Objext provides a more modern version control of data like git do.

### $commit(tag)

Create a snapshot of current data with name by `tag`.

### $reset(tag)

Recover data with the snapshot whose name is `tag`.

```js
objx.name = 'tomy'
objx.$commit('version1')
objx.name = 'jimy'
objx.$reset('version1')
console.log(objx.name) // => 'tomy'
```

### $revert(tag)

Remove snapshots whose name is `tag`.
If you want to remove all snapshots, don't pass tag.


## Validate

Objext provide ability to validate data.

### $formulate(validators)

Set validate rules. `validators` is an array, which contains items has the following structure:

```js
{
  path: 'body.head',
  check: value => value !== null, // should return boolean
  message: 'should not be null', // when validate fail, return this message to warn
  warn: error => {}, // the function to run when validate fail,
}
```

### $validate()

Run all validators, if one failed, will not run the left ones.

## Data lock

You can lock data before some operation.

### $lock()

Lock data, then data is not writable with objext api.


```js
objx.name = 'tomy'
objx.$lock()
objx.name = 'pina'
console.log(objx.name) // => 'tomy'
```

### $unlock()

Unlock data.

## Other APIs

You can use methods as chain like:

```js
objx.$silent(true).$set('name', 'lily').$silent(false)
```

### $put(data)

Reset all data to be new.
The current properties will be removed firstly, and new data will be set into objext instance.

### $update(data)

Update existing data one time, watchers will only run after all data updated.
If some properties do not exist, they will be added to the data.

### $silent(is)

Change the silent mode. When silent mode is on, no watchers will be trigger when data change.

```js
objx.$watch('name', () => console.log('name changed.'))
objx.$silent(true)
objx.$set('name', 'lily') // this will not trigger watcher because of silent mode
objx.$silent(false)
```

### $batchStart() / $batchEnd()

During batch updating, watchers will not be triggered until $batchEnd() run.

```js
objx.$batchStart()
// the following $set will not trigger watchers
objx.$set('body.main', 'left')
objx.$set('name', 'ceci')
objx.$set('body.main', 'right')
// when $batchEnd() run, all watchers will be invoked.
// the watchers of 'body.main' will only run once with final value 'right'
objx.$batchEnd()
```

`$update` and `$put` use $batchStart/$batchEnd inside.

### $clone()

Clone current objext instance to a new objext instance.

### $hash

A identity of current objext instance, you can it to compare two objext instances:

```js
if (objx1.$hash === objx2.$hash) {
  // ...
}
```

### valueOf()

Get current objext instance's original js object.

### toString()

Get current objext instance's original js object's json string.
