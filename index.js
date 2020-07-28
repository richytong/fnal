/* rubico v1.2.0
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2020 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.rubico = {}));
}(this, function (exports) { 'use strict'

/* design principles
 *
 * rubico is a module, not a utility library
 * functional code should not care about async
 * exported methods are time and space optimal
 * memory used by exported methods is properly garbage collected
 * no special types; use built-in types
 * no currying; write new functions
 * avoid variadic functions; use lists
 */

const isDefined = x => x !== undefined && x !== null

const isUndefined = x => x === undefined

const isNull = x => x === null

const isIterable = x => isDefined(x) && isDefined(x[Symbol.iterator])

const isAsyncIterable = x => isDefined(x) && isDefined(x[Symbol.asyncIterator])

const isWritable = x => x && typeof x.write === 'function'

const isFunction = x => typeof x === 'function'

const isArray = Array.isArray

const numberTypedArrays = new Set([
  'Uint8ClampedArray',
  'Uint8Array', 'Int8Array',
  'Uint16Array', 'Int16Array',
  'Uint32Array', 'Int32Array',
  'Float32Array', 'Float64Array',
])

const isNumberTypedArray = x => x && x.constructor && (
  numberTypedArrays.has(x.constructor.name)
)

const bigIntTypedArrays = new Set([
  'BigUint64Array', 'BigInt64Array',
])

const isBigIntTypedArray = x => x && x.constructor && (
  bigIntTypedArrays.has(x.constructor.name)
)

const isNumber = x => typeof x === 'number' && !isNaN(x)

const isBigInt = x => typeof x === 'bigint'

const isString = x => typeof x === 'string'

const isPromise = x => x && typeof x.then === 'function'

const is = fn => x => x && x.constructor === fn

const range = (start, end) => Array.from({ length: end - start }, (x, i) => i + start)

const arrayOf = (item, length) => Array.from({ length }, () => item)

/*
 * @synopsis
 * new PossiblePromise(p any|Promise<any>) -> any|Promise<any>
 */
const PossiblePromise = function(p) {
  this.value = p
}

/*
 * @synopsis
 * new PossiblePromise(p any|Promise<any>).then(f function) -> any|Promise<any>
 */
PossiblePromise.prototype.then = function(f) {
  return isPromise(this.value) ? this.value.then(f) : f(this.value)
}

/*
 * @synopsis
 * PossiblePromise.then(p any|Promise<any>, f function) -> any|Promise<any>
 */
PossiblePromise.then = (p, f) => isPromise(p) ? p.then(f) : f(p)

/*
 * @synopsis
 * PossiblePromise.catch(
 *   p any|Promise<any>,
 *   f Error=>any|Promise<any>,
 * ) -> any|Promise<any>
 */
PossiblePromise.catch = (p, f) => isPromise(p) ? p.catch(f) : p

/*
 * @synopsis
 * PossiblePromise.all(
 *   ps Array<any>|Promise<Array<any>>,
 * ) -> Array<any>|Promise<Array<any>>
 */
PossiblePromise.all = ps => (ps.some(isPromise)
  ? Promise.all(ps)
  : new PossiblePromise(ps))

/*
 * @synopsis
 * toFunction(x any|function) -> ()=>any|function
 */
const toFunction = x => isFunction(x) ? x : () => x

/*
 * @synopsis
 * iteratorPipe(iter Iterator<function>, args Array<any>) -> any|Promise<any>
 */
const iteratorPipe = (iter, args) => {
  const { value: f0 } = iter.next()
  let output = f0(...args)
  for (const fn of iter) {
    output = PossiblePromise.then(output, fn)
  }
  return output
}

/*
 * @synopsis
 * reverseArrayIter(arr Array<any>) -> Iterator<any>
 */
const reverseArrayIter = arr => (function*() {
  for (let i = arr.length - 1; i >= 0; i--) yield arr[i]
})()

/*
 * @synopsis
 * pipe(fns Array<function>)(...args ...any) -> any|Promise<any>
 */
const pipe = fns => {
  if (!isArray(fns)) {
    throw new TypeError('pipe(fns); fns is not an array of functions')
  }
  if (fns.length < 1) {
    throw new RangeError('pipe(fns); fns is not an array of at least one function')
  }
  for (let i = 0; i < fns.length; i++) {
    if (isFunction(fns[i])) continue
    throw new TypeError(`pipe(fns); fns[${i}] is not a function`)
  }
  return (...args) => (isFunction(args[0])
    ? iteratorPipe(reverseArrayIter(fns), args)
    : iteratorPipe(fns[Symbol.iterator].call(fns), args)
  )
}

/*
 * @synopsis
 * arrayFork(fns Array<function>, x any) -> Array<any>|Promise<Array<any>>
 */
const arrayFork = (fns, x) => {
  let isAsync = false
  const y = fns.map(fn => {
    const point = fn(x)
    if (isPromise(point)) isAsync = true
    return point
  })
  return isAsync ? Promise.all(y) : y
}

/*
 * @synopsis
 * objectFork(fns Object<function>, x any) -> Object<any>|Promise<Object<any>>
 */
const objectFork = (fns, x) => {
  const y = {}, promises = []
  for (const k in fns) {
    const point = fns[k](x)
    if (isPromise(point)) {
      promises.push(point.then(res => { y[k] = res }))
    } else {
      y[k] = point
    }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * fork(fns Object<function>|Array<function>)(x any)
 *   -> Object<any>|Array<any>|Promise<Object<any>>|Promise<Array<any>>
 */
const fork = fns => {
  if (isArray(fns)) {
    if (fns.length < 1) {
      throw new RangeError('fork(x); x is not an array of at least one function')
    }
    for (let i = 0; i < fns.length; i++) {
      if (isFunction(fns[i])) continue
      throw new TypeError(`fork(x); x[${i}] is not a function`)
    }
    return x => arrayFork(fns, x)
  }
  if (is(Object)(fns)) {
    if (Object.keys(fns).length < 1) {
      throw new RangeError('fork(x); x is not an object of at least one entry')
    }
    for (const k in fns) {
      if (isFunction(fns[k])) continue
      throw new TypeError(`fork(x); x['${k}'] is not a function`)
    }
    return x => objectFork(fns, x)
  }
  throw new TypeError('fork(x); x invalid')
}

/*
 * @synopsis
 * arrayForkSeries(
 *   fns Array<functions>,
 *   x any,
 *   i number,
 *   y Array<any>,
 * ) -> Array<any>|Promise<Array<any>>
 *
 * @note
 * TODO: iterative implementation
 */
const arrayForkSeries = (fns, x, i, y) => {
  if (i === fns.length) return y
  return PossiblePromise.then(
    fns[i](x),
    res => arrayForkSeries(fns, x, i + 1, y.concat(res)),
  )
}

/*
 * @synopsis
 * fork.series(fns Array<function>)(x any) -> Array<any>|Promise<Array<any>>
 */
fork.series = fns => {
  if (isArray(fns)) {
    if (fns.length < 1) {
      throw new RangeError(
        'fork.series(x); x is not an array of at least one function',
      )
    }
    for (let i = 0; i < fns.length; i++) {
      if (isFunction(fns[i])) continue
      throw new TypeError(`fork.series(x); x[${i}] is not a function`)
    }
    return x => arrayForkSeries(fns, x, 0, [])
  }
  throw new TypeError('fork.series(x); x invalid')
}

/*
 * @synopsis
 * assign(fns Array<function>)(x any) -> Object<any>|Promise<Object<any>>
 */
const assign = fns => {
  if (!is(Object)(fns)) {
    throw new TypeError('assign(x); x is not an object of functions')
  }
  return x => {
    if (!is(Object)(x)) {
      throw new TypeError('assign(...)(x); x is not an object')
    }
    return PossiblePromise.then(
      objectFork(fns, x),
      res => Object.assign({}, x, res),
    )
  }
}

/*
 * @synopsis
 * tap(f function)(x any) -> any|Promise<any>
 */
const tap = f => {
  if (!isFunction(f)) {
    throw new TypeError('tap(f); f is not a function')
  }
  return x => PossiblePromise.then(f(x), () => x)
}

/* TODO: https://github.com/a-synchronous/rubico/issues/100
tap.if = fn => {}
*/

const tryCatch = (f, onError) => {
  if (!isFunction(f)) {
    throw new TypeError('tryCatch(x, y); x is not a function')
  }
  if (!isFunction(onError)) {
    throw new TypeError('tryCatch(x, y); y is not a function')
  }
  return x => {
    try {
      return PossiblePromise.catch(f(x), e => onError(e, x))
    } catch (e) {
      return onError(e, x)
    }
  }
}

// TODO: reimplement to iterative
const arraySwitchCase = (fns, x, i) => {
  if (i === fns.length - 1) return fns[i](x)
  return PossiblePromise.then(
    fns[i](x),
    ok => ok ? fns[i + 1](x) : arraySwitchCase(fns, x, i + 2),
  )
}

const switchCase = fns => {
  if (!isArray(fns)) {
    throw new TypeError('switchCase(x); x is not an array of functions')
  }
  if (fns.length < 3) {
    throw new RangeError(
      'switchCase(x); x is not an array of at least three functions',
    )
  }
  if (fns.length % 2 === 0) {
    throw new RangeError(
      'switchCase(x); x is not an array of an odd number of functions',
    )
  }
  for (let i = 0; i < fns.length; i++) {
    if (isFunction(fns[i])) continue
    throw new TypeError(`switchCase(x); x[${i}] is not a function`)
  }
  return x => arraySwitchCase(fns, x, 0)
}

const mapAsyncIterable = (fn, x) => (async function*() {
  for await (const xi of x) yield fn(xi)
})()

const mapIterable = (fn, x) => (function*() {
  for (const xi of x) yield fn(xi)
})()

/*
 * @synopsis
 * mapArray(f function, x Array<any>) -> Array<any>|Promise<Array<any>>
 *
 * @note
 * x.map
 * https://v8.dev/blog/elements-kinds#avoid-polymorphism
 *
 * @note
 * Alternative implementation
 * const mapArray = (f, x) => PossiblePromise.all(x.map(f)).then(res => res)
 */
const mapArray = (f, x) => {
  let isAsync = false
  const y = x.map(xi => {
    const point = f(xi)
    if (isPromise(point)) isAsync = true
    return point
  })
  return isAsync ? Promise.all(y) : y
}

/*
 * @synopsis
 * mapIterableToArray(f function, x Iterable<any>)
 *   -> Array<any>|Promise<Array<any>>
 */
const mapIterableToArray = (fn, x) => {
  let isAsync = false
  const y = []
  for (const xi of x) {
    const point = fn(xi)
    if (isPromise(point)) isAsync = true
    y.push(point)
  }
  return isAsync ? Promise.all(y) : y
}

/*
 * @synopsis
 * mapString(f function, x string) -> string
 */
const mapString = (f, x) => PossiblePromise.then(
  mapIterableToArray(f, x),
  res => res.join(''),
)

/*
 * @synopsis
 * mapTypedArray(f function, x TypedArray<any>) -> TypedArray<any>
 */
const mapTypedArray = (f, x) => PossiblePromise.then(
  mapIterableToArray(f, x),
  res => new x.constructor(res),
)

/*
 * @synopsis
 * mapSet(f function, x Set<any>) -> Set<any>
 */
const mapSet = (f, x) => {
  const y = new Set(), promises = []
  for (const xi of x) {
    const yi = f(xi)
    if (isPromise(yi)) {
      promises.push(yi.then(res => { y.add(res) }))
    } else {
      y.add(yi)
    }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * mapMap(f function, x Map<any=>any>) -> Map<any=>any>
 */
const mapMap = (fn, x) => {
  const y = new Map(), promises = []
  for (const entry of x) {
    const point = fn(entry)
    if (isPromise(point)) {
      promises.push(point.then(res => { y.set(...res) }))
    } else {
      y.set(...point)
    }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * mapObject(f function, x Object<any>) -> Object<any>
 */
const mapObject = (fn, x) => {
  const y = {}, promises = []
  for (const k in x) {
    const point = fn(x[k])
    if (isPromise(point)) {
      promises.push(point.then(res => { y[k] = res }))
    } else {
      y[k] = point
    }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * mapReducer(f function, reducer function)
 *   -> anotherReducer (y any, xi any)=>any|Promise<any>
 */
const mapReducer = (f, reducer) => (y, xi) => (
  PossiblePromise.then(f(xi), res => reducer(y, res)))

/*
 * @synopsis
 * <T any>AsyncIterable<T>|Array<T>|string|Set<T>|Map<T>
 *   |TypedArray<T>|Iterable<T>|Object<T>|(any, T)=>any -> Mappable<T>
 *
 * <T Mappable>map(f function)(x T<any>) -> T<any>
 */
const map = f => {
  if (!isFunction(f)) {
    throw new TypeError('map(f); f is not a function')
  }
  return x => {
    if (isAsyncIterable(x)) return mapAsyncIterable(f, x)
    if (isArray(x)) return mapArray(f, x)
    if (isString(x)) return mapString(f, x)
    if (is(Set)(x)) return mapSet(f, x)
    if (is(Map)(x)) return mapMap(f, x)
    if (isNumberTypedArray(x)) return mapTypedArray(f, x)
    if (isBigIntTypedArray(x)) return mapTypedArray(f, x)
    if (isIterable(x)) return mapIterable(f, x) // for generators or custom iterators
    if (is(Object)(x)) return mapObject(f, x)
    if (isFunction(x)) return mapReducer(f, x)
    throw new TypeError('map(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * mapSeriesArray(f function, x Array<any>, i number, y Array<any>)
 *   -> Array<any>|Promise<Array<any>>
 *
 * @note
 * TODO: iterative implementation
 */
const mapSeriesArray = (f, x, i, y) => {
  if (i === x.length) return y
  return PossiblePromise.then(
    f(x[i]),
    res => mapSeriesArray(f, x, i + 1, y.concat(res)),
  )
}

/*
 * @synopsis
 * map.series(f function)(x Array<any>) -> Array<any>|Promise<Array<any>>
 */
map.series = f => {
  if (!isFunction(f)) {
    throw new TypeError('map.series(f); f is not a function')
  }
  return x => {
    if (isArray(x)) return mapSeriesArray(f, x, 0, [])
    throw new TypeError('map.series(...)(x); x invalid')
  }
}

// https://stackoverflow.com/questions/62037349/rubicos-map-pool-array-implementation
// https://stackoverflow.com/questions/39195441/limited-parallelism-with-async-await-in-typescript-es7
const mapPoolConstructor = construct => async (size, fn, x) => {
  const y = []
  const promises = new Set()
  for (const xi of x) {
    if (promises.size >= size) {
      await Promise.race(promises)
    }
    const yi = fn(xi)
    if (isPromise(yi)) {
      const p = yi.then(res => {
        promises.delete(p)
        return res
      })
      promises.add(p)
      y.push(p)
    } else {
      y.push(yi)
    }
  }
  return construct(await Promise.all(y))
}

const mapPoolArray = mapPoolConstructor(y => y)

const mapPoolSet = mapPoolConstructor(y => new Set(y))

const mapPoolMap = mapPoolConstructor(y => new Map(y))

map.pool = (size, fn) => {
  if (!isNumber(size)) {
    throw new TypeError('map.pool(size, f); size is not a number')
  }
  if (size < 1) {
    throw new RangeError('map.pool(size, f); size must be 1 or more')
  }
  if (!isFunction(fn)) {
    throw new TypeError('map.pool(size, f); f is not a function')
  }
  return x => {
    if (isArray(x)) return mapPoolArray(size, fn, x)
    if (is(Set)(x)) return mapPoolSet(size, fn, x)
    if (is(Map)(x)) return mapPoolMap(size, fn, x)
    throw new TypeError('map.pool(...)(x); x invalid')
  }
}

const mapArrayWithIndex = (fn, x) => {
  let isAsync = false
  const y = x.map((xi, i) => {
    const point = fn(xi, i, x)
    if (isPromise(point)) isAsync = true
    return point
  })
  return isAsync ? Promise.all(y) : y
}

const mapIterableWithIndexToArray = (fn, x) => {
  let isAsync = false
  const primer = []
  let i = 0
  for (const xi of x) {
    const point = fn(xi, i, x)
    if (isPromise(point)) isAsync = true
    primer.push(point)
    i += 1
  }
  return isAsync ? Promise.all(primer) : primer
}

const mapStringWithIndex = (f, x) => PossiblePromise.then(
  mapIterableWithIndexToArray(f, x),
  res => res.join(''),
)

map.withIndex = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('map.withIndex(x); x is not a function')
  }
  return x => {
    if (isArray(x)) return mapArrayWithIndex(fn, x)
    if (isString(x)) return mapStringWithIndex(fn, x)
    throw new TypeError('map.withIndex(...)(x); x invalid')
  }
}

const filterAsyncIterable = (fn, x) => (async function*() {
  for await (const xi of x) { if (await fn(xi)) yield xi }
})()

const filterIterable = (fn, x) => (function*() {
  for (const xi of x) {
    const ok = fn(xi)
    if (isPromise(ok)) {
      throw new TypeError([
        'filter(f)(x); xi is an element of x; ',
        'if x if the resulting iterator of a sync generator, ',
        'f(xi) cannot return a Promise',
      ].join(''))
    }
    if (ok) yield xi
  }
})()

const createFilterIndex = (fn, x) => {
  let isAsync = false
  const filterIndex = []
  for (const xi of x) {
    const ok = fn(xi)
    if (isPromise(ok)) isAsync = true
    filterIndex.push(ok)
  }
  return isAsync ? Promise.all(filterIndex) : filterIndex
}

const filterArray = (f, x) => PossiblePromise.then(
  createFilterIndex(f, x),
  res => x.filter((_, i) => res[i]),
)

const filterStringFromIndex = (index, x) => {
  let y = ''
  for (let i = 0; i < x.length; i++) { if (index[i]) y += x[i] }
  return y
}

const filterString = (f, x) => PossiblePromise.then(
  createFilterIndex(f, x),
  res => filterStringFromIndex(res, x),
)

const filterSet = (fn, x) => {
  const y = new Set(), promises = []
  for (const xi of x) {
    const ok = fn(xi)
    if (isPromise(ok)) {
      promises.push(ok.then(res => res && y.add(xi)))
    } else if (ok) { y.add(xi) }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

const filterMap = (fn, x) => {
  const y = new Map(), promises = []
  for (const xi of x) {
    const ok = fn(xi)
    if (isPromise(ok)) {
      promises.push(ok.then(res => res && y.set(...xi)))
    } else if (ok) { y.set(...xi) }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

const filterTypedArray = (f, x) => PossiblePromise.then(
  filterArray(f, x),
  res => new x.constructor(res),
)

const filterObject = (fn, x) => {
  const y = {}, promises = []
  for (const k in x) {
    const ok = fn(x[k])
    if (isPromise(ok)) {
      promises.push(ok.then(res => { if (res) { y[k] = x[k] } }))
    } else if (ok) { y[k] = x[k] }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

const filterReducer = (f, reducer) => (y, xi) => (
  PossiblePromise.all([f(xi), y]).then(([bool, resY]) => (
    bool ? reducer(resY, xi) : resY)))

const filter = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('filter(x); x is not a function')
  }
  return x => {
    if (isAsyncIterable(x)) return filterAsyncIterable(fn, x)
    if (isArray(x)) return filterArray(fn, x)
    if (isString(x)) return filterString(fn, x)
    if (is(Set)(x)) return filterSet(fn, x)
    if (is(Map)(x)) return filterMap(fn, x)
    if (isNumberTypedArray(x)) return filterTypedArray(fn, x)
    if (isBigIntTypedArray(x)) return filterTypedArray(fn, x)
    if (isIterable(x)) return filterIterable(fn, x) // for generators or custom iterators
    if (is(Object)(x)) return filterObject(fn, x)
    if (isFunction(x)) return filterReducer(fn, x)
    throw new TypeError('filter(...)(x); x invalid')
  }
}

const createFilterWithIndexIndex = (fn, x) => {
  let isAsync = false, i = 0
  const filterIndex = []
  for (const xi of x) {
    const ok = fn(xi, i, x)
    if (isPromise(ok)) isAsync = true
    filterIndex.push(ok)
    i += 1
  }
  return isAsync ? Promise.all(filterIndex) : filterIndex
}

/*
 * @synopsis
 * filterArrayWithIndex(predicate function, x Array<any>) -> Array<any>|Promise<Array<any>>
 */
const filterArrayWithIndex = (predicate, x) => PossiblePromise.then(
  createFilterWithIndexIndex(predicate, x),
  res => x.filter((_, i) => res[i]),
)

/*
 * @synopsis
 * filterArrayWithIndex(predicate function, x string) -> string|Promise<string>
 */
const filterStringWithIndex = (predicate, x) => PossiblePromise.then(
  createFilterWithIndexIndex(predicate, x),
  res => filterStringFromIndex(res, x),
)

/*
 * @synopsis
 * filter(predicate function)(x Array<any>|string)
 *   -> Array<any>|Promise<Array<any>>|string|Promise<string>
 */
filter.withIndex = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('filter.withIndex(f); f is not a function')
  }
  return x => {
    // if (isAsyncIterable(x)) return filterAsyncIterable(fn, x)
    if (isArray(x)) return filterArrayWithIndex(fn, x)
    if (isString(x)) return filterStringWithIndex(fn, x)
    // if (is(Set)(x)) return filterSet(fn, x)
    // if (is(Map)(x)) return filterMap(fn, x)
    // if (isNumberTypedArray(x)) return filterTypedArray(fn, x)
    // if (isBigIntTypedArray(x)) return filterTypedArray(fn, x)
    // if (isIterable(x)) return filterIterable(fn, x) // for generators or custom iterators
    // if (is(Object)(x)) return filterObject(fn, x)
    // if (isFunction(x)) return filterReducer(fn, x)
    throw new TypeError('filter.withIndex(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * asyncReduceIterator(f function, x0 any, iter Iterable<any>) -> Promise<any>
 */
const asyncReduceIterator = async (f, x0, iter) => {
  let y = x0
  for (const xi of iter) {
    y = await f(y, xi)
  }
  return y
}

/*
 * @synopsis
 * reduceIterable(f function, possiblyX0 any, x Iterable<any>)
 *   -> any|Promise<any>
 *
 * @note
 * There's an issue chaining too many synchronous .thens
 * https://stackoverflow.com/questions/62112863/what-are-the-performance-implications-if-any-of-chaining-too-many-thens-on
 */
const reduceIterable = (fn, possiblyX0, x) => {
  const iter = x[Symbol.iterator]()
  const y0 = isUndefined(possiblyX0) ? iter.next().value : possiblyX0
  if (isUndefined(y0)) {
    throw new TypeError('reduce(...)(x); x cannot be empty')
  }
  const { value, done } = iter.next()
  if (done) return y0
  let y = fn(y0, value)
  if (isPromise(y)) {
    return y.then(res => asyncReduceIterator(fn, res, iter))
  }
  for (const xi of iter) {
    y = fn(y, xi)
    if (isPromise(y)) {
      return y.then(res => asyncReduceIterator(fn, res, iter))
    }
  }
  return y
}

/*
 * @synopsis
 * reduceAsyncIterable(f function, possiblyX0 any, x AsyncIterable<any>)
 *   -> Promise<any>
 */
const reduceAsyncIterable = async (fn, possiblyY0, x) => {
  const iter = x[Symbol.asyncIterator]()
  const y0 = isUndefined(possiblyY0) ? (await iter.next()).value : possiblyY0
  if (isUndefined(y0)) {
    throw new TypeError('reduce(...)(x); x cannot be empty')
  }
  const { value, done } = await iter.next()
  if (done) return y0
  let y = await fn(y0, value)
  for await (const xi of iter) {
    y = await fn(y, xi)
  }
  return y
}

/*
 * @synopsis
 * reduceObject(f function, x0 any, x Object<any>) -> any|Promise<any>
 */
const reduceObject = (fn, x0, x) => reduceIterable(
  fn,
  x0,
  (function* () { for (const k in x) yield x[k] })(),
)

/*
 * @synopsis
 * <T any>(Iterable<T>|AsyncIterable<T>|Object<T>) -> Reducible<T>
 *
 * reduce(f function, init any|any=>any)(x Reducible<any>) -> any|Promise<any>
 *
 * @note
 * https://stackoverflow.com/questions/30233302/promise-is-it-possible-to-force-cancel-a-promise/30235261#30235261
 * https://stackoverflow.com/questions/62336381/is-this-promise-cancellation-implementation-for-reducing-an-async-iterable-on-th
 */
const reduce = (fn, init) => {
  if (!isFunction(fn)) {
    throw new TypeError('reduce(x, y); x is not a function')
  }
  return x => {
    const x0 = toFunction(init)(x)
    if (isIterable(x)) return PossiblePromise.then(
      x0,
      res => reduceIterable(fn, res, x),
    )
    if (isAsyncIterable(x)) {
      const state = { cancel: () => {} }
      const cancelToken = new Promise((_, reject) => { state.cancel = reject })
      const p = Promise.race([
        PossiblePromise.then(
          x0,
          res => reduceAsyncIterable(fn, res, x),
        ),
        cancelToken,
      ])
      p.cancel = () => { state.cancel(new Error('cancelled')) }
      return p
    }
    if (is(Object)(x)) return PossiblePromise.then(
      x0,
      res => reduceObject(fn, res, x),
    )
    throw new TypeError('reduce(...)(x); x invalid')
  }
}

const nullTransform = (fn, x0) => reduce(
  fn(() => x0),
  x0,
)

const arrayTransform = (fn, x0) => x => reduce(
  fn((y, xi) => { y.push(xi); return y }),
  x0,
)(x)

const stringTransform = (fn, x0) => reduce(
  fn((y, xi) => `${y}${xi}`),
  x0,
)

const setTransform = (fn, x0) => reduce(
  fn((y, xi) => y.add(xi)),
  x0,
)

const mapTransform = (fn, x0) => reduce(
  fn((y, xi) => y.set(xi[0], xi[1])),
  x0,
)

const stringToCharCodes = x => {
  const y = []
  for (let i = 0; i < x.length; i++) {
    y.push(x.charCodeAt(i))
  }
  return y
}

const toNumberTypedArray = (constructor, x) => {
  if (isNumber(x)) return constructor.of(x)
  if (isString(x)) return new constructor(stringToCharCodes(x))
  throw new TypeError([
    'toNumberTypedArray(typedArray, y)',
    'cannot convert y to typedArray',
  ].join('; '))
}

const firstPowerOf2After = x => {
  let y = 2
  while (y < x + 1) {
    y = y << 1
  }
  return y
}

const typedArrayConcat = (y, chunk, offset) => {
  const nextLength = offset + chunk.length
  const buf = nextLength > y.length ? (() => {
    const newBuf = new y.constructor(firstPowerOf2After(nextLength))
    newBuf.set(y, 0)
    return newBuf
  })() : y
  buf.set(chunk, offset)
  return buf
}

const numberTypedArrayTransform = (fn, x0) => x => {
  const point = reduce(
    fn(({ y, offset }, xi) => {
      const chunk = toNumberTypedArray(x0.constructor, xi)
      const buf = typedArrayConcat(y, chunk, offset)
      return { y: buf, offset: offset + chunk.length }
    }),
    { y: x0.constructor.from(x0), offset: x0.length },
  )(x)
  return isPromise(point) ? point.then(
    res => res.y.slice(0, res.offset)
  ) : point.y.slice(0, point.offset)
}

const toBigIntTypedArray = (constructor, x) => {
  if (isBigInt(x)) return constructor.of(x)
  throw new TypeError([
    'toBigIntTypedArray(typedArray, y)',
    'cannot convert y to typedArray',
  ].join('; '))
}

const bigIntTypedArrayTransform = (fn, x0) => x => {
  const point = reduce(
    fn(({ y, offset }, xi) => {
      const chunk = toBigIntTypedArray(x0.constructor, xi)
      const buf = typedArrayConcat(y, chunk, offset)
      return { y: buf, offset: offset + chunk.length }
    }),
    { y: x0.constructor.from(x0), offset: x0.length },
  )(x)
  return isPromise(point) ? point.then(
    res => res.y.slice(0, res.offset)
  ) : point.y.slice(0, point.offset)
}

const writableTransform = (fn, x0) => reduce(
  fn((y, xi) => { y.write(xi); return y }),
  x0,
)

const objectTransform = (fn, x0) => reduce(
  fn((y, xi) => {
    if (isArray(xi)) { y[xi[0]] = xi[1]; return y }
    return Object.assign(y, xi)
    // TODO: implement
    // if (is(Object)(xi)) Object.assign(y, xi)
    // else throw new TypeError('...')
  }),
  x0,
)

const _transformBranch = (fn, x0, x) => {
  if (isNull(x0)) return nullTransform(fn, x0)(x)
  if (isArray(x0)) return arrayTransform(fn, x0)(x)
  if (isString(x0)) return stringTransform(fn, x0)(x)
  if (is(Set)(x0)) return setTransform(fn, x0)(x)
  if (is(Map)(x0)) return mapTransform(fn, x0)(x)
  if (isNumberTypedArray(x0)) return numberTypedArrayTransform(fn, x0)(x)
  if (isBigIntTypedArray(x0)) return bigIntTypedArrayTransform(fn, x0)(x)
  if (isWritable(x0)) return writableTransform(fn, x0)(x)
  if (is(Object)(x0)) return objectTransform(fn, x0)(x)
  throw new TypeError('transform(x, y); x invalid')
}

const transform = (fn, init) => {
  if (!isFunction(fn)) {
    throw new TypeError('transform(x, y); y is not a function')
  }
  return x => PossiblePromise.then(
    toFunction(init)(x),
    res => _transformBranch(fn, res, x),
  )
}

const flattenIterable = (reducer, x0, x) => {
  let y = x0
  for (const xi of x) {
    if (isIterable(xi)) {
      for (const xii of xi) y = reducer(y, xii)
    } else if (is(Object)(xi)) {
      for (const k in xi) y = reducer(y, xi[k])
    } else {
      throw new TypeError('flatMap(...)(x); cannot flatten element of x')
    }
  }
  return y
}

const flattenToArray = x => flattenIterable(
  (y, xii) => { y.push(xii); return y },
  [],
  x,
)

const flattenToSet = x => flattenIterable(
  (y, xii) => y.add(xii),
  new Set(),
  x,
)

const flatMapArray = (fn, x) => {
  const y = mapArray(fn, x)
  return isPromise(y) ? y.then(flattenToArray) : flattenToArray(y)
}

const flatMapSet = (fn, x) => {
  const y = mapSet(fn, x)
  return isPromise(y) ? y.then(flattenToSet) : flattenToSet(y)
}

const flatMapReducer = (fn, reducer) => (y, xi) => {
  const yi = fn(xi)
  return isPromise(yi) ? yi.then(reduce(reducer, y)) : reduce(reducer, y)(yi)
}

const flatMap = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('flatMap(x); x is not a function')
  }
  return x => {
    if (isArray(x)) return flatMapArray(fn, x)
    if (is(Set)(x)) return flatMapSet(fn, x)
    if (isFunction(x)) return flatMapReducer(fn, x)
    throw new TypeError('flatMap(...)(x); x invalid')
  }
}

const isDelimitedBy = (delim, x) => (x
  && x[0] !== delim
  && x[x.length - 1] !== delim
  && x.slice(1, x.length - 1).includes(delim))

const arrayGet = (path, x, defaultValue) => {
  let y = x
  if (!isDefined(y)) return toFunction(defaultValue)(x)
  for (let i = 0; i < path.length; i++) {
    y = y[path[i]]
    if (!isDefined(y)) return toFunction(defaultValue)(x)
  }
  return y
}

const get = (path, defaultValue) => {
  if (isArray(path)) return x => arrayGet(path, x, defaultValue)
  if (isNumber(path)) return x => arrayGet([path], x, defaultValue)
  if (isString(path)) return (isDelimitedBy('.', path)
    ? x => arrayGet(path.split('.'), x, defaultValue)
    : x => arrayGet([path], x, defaultValue))
  throw new TypeError('get(x, y); x invalid')
}

const pickObject = (props, x) => {
  const y = {}
  for (let i = 0; i < props.length; i++) {
    if (isDefined(x[props[i]])) y[props[i]] = x[props[i]]
  }
  return y
}

const pick = props => {
  if (isArray(props)) return x => {
    if (is(Object)(x)) return pickObject(props, x)
    throw new TypeError('pick(...)(x); x is not an object')
  }
  throw new TypeError('pick(x); x is not an array')
}

const omitObject = (props, x) => {
  const y = Object.assign({}, x)
  for (let i = 0; i < props.length; i++) delete y[props[i]]
  return y
}

const omit = props => {
  if (isArray(props)) return x => {
    if (is(Object)(x)) return omitObject(props, x)
    throw new TypeError('omit(...)(x); x is not an object')
  }
  throw new TypeError('omit(x); x is not an array')
}

const anyIterable = (fn, x) => {
  const promises = []
  for (const xi of x) {
    const point = fn(xi)
    if (isPromise(point)) promises.push(point)
    else if (point) return (promises.length > 0
      ? Promise.all(promises).then(() => true)
      : true)
  }
  return (promises.length > 0
    ? Promise.all(promises).then(res => res.some(x => x))
    : false)
}

const anyObject = (fn, x) => anyIterable(
  fn,
  (function* () { for (const k in x) yield x[k] })(),
)

const any = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('any(x); x is not a function')
  }
  return x => {
    if (isIterable(x)) return anyIterable(fn, x)
    if (is(Object)(x)) return anyObject(fn, x)
    throw new TypeError('any(...)(x); x invalid')
  }
}

const allIterable = (fn, x) => {
  const promises = []
  for (const xi of x) {
    const point = fn(xi)
    if (isPromise(point)) promises.push(point)
    else if (!point) return (promises.length > 0
      ? Promise.all(promises).then(() => false)
      : false)
  }
  return (promises.length > 0
    ? Promise.all(promises).then(res => res.every(x => x))
    : true)
}

const allObject = (fn, x) => allIterable(
  fn,
  (function* () { for (const k in x) yield x[k] })(),
)

const all = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('all(x); x is not a function')
  }
  return x => {
    if (isIterable(x)) return allIterable(fn, x)
    if (is(Object)(x)) return allObject(fn, x)
    throw new TypeError('all(...)(x); x invalid')
  }
}

const arrayAnd = (fns, x) => {
  const promises = []
  for (let i = 0; i < fns.length; i++) {
    const point = fns[i](x)
    if (isPromise(point)) promises.push(point)
    else if (!point) return (promises.length > 0
      ? Promise.all(promises).then(() => false)
      : false)
  }
  return (promises.length > 0
    ? Promise.all(promises).then(res => res.every(x => x))
    : true)
}

const and = fns => {
  if (!isArray(fns)) {
    throw new TypeError('and(x); x is not an array of functions')
  }
  if (fns.length < 1) {
    throw new RangeError('and(x); x is not an array of at least one function')
  }
  for (let i = 0; i < fns.length; i++) {
    if (isFunction(fns[i])) continue
    throw new TypeError(`and(x); x[${i}] is not a function`)
  }
  return x => arrayAnd(fns, x)
}

const arrayOr = (fns, x) => {
  const promises = []
  for (let i = 0; i < fns.length; i++) {
    const point = fns[i](x)
    if (isPromise(point)) promises.push(point)
    else if (point) return (promises.length > 0
      ? Promise.all(promises).then(() => true)
      : true)
  }
  return (promises.length > 0
    ? Promise.all(promises).then(res => res.some(x => x))
    : false)
}

const or = fns => {
  if (!isArray(fns)) {
    throw new TypeError('or(x); x is not an array of functions')
  }
  if (fns.length < 1) {
    throw new RangeError('or(x); x is not an array of at least one function')
  }
  for (let i = 0; i < fns.length; i++) {
    if (isFunction(fns[i])) continue
    throw new TypeError(`or(x); x[${i}] is not a function`)
  }
  return x => arrayOr(fns, x)
}

const not = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('not(x); x is not a function')
  }
  return x => new PossiblePromise(fn(x)).then(res => !res)
}

const compare = (predicate, f, g) => x => PossiblePromise.all([
  toFunction(f)(x),
  toFunction(g)(x),
]).then(res => predicate(...res))

const eq = function(f, g) {
  if (arguments.length !== 2) {
    throw new RangeError('eq(...arguments); exactly two arguments required')
  }
  return compare((a, b) => a === b, f, g)
}

const gt = function(f, g) {
  if (arguments.length !== 2) {
    throw new RangeError('gt(...arguments); exactly two arguments required')
  }
  return compare((a, b) => a > b, f, g)
}

const lt = function(f, g) {
  if (arguments.length !== 2) {
    throw new RangeError('lt(...arguments); exactly two arguments required')
  }
  return compare((a, b) => a < b, f, g)
}

const gte = function(f, g) {
  if (arguments.length !== 2) {
    throw new RangeError('gte(...arguments); exactly two arguments required')
  }
  return compare((a, b) => a >= b, f, g)
}

const lte = function(f, g) {
  if (arguments.length !== 2) {
    throw new RangeError('lte(...arguments); exactly two arguments required')
  }
  return compare((a, b) => a <= b, f, g)
}

exports.pipe = pipe
exports.fork = fork
exports.assign = assign
exports.tap = tap
exports.tryCatch = tryCatch
exports.switchCase = switchCase
exports.map = map
exports.flatMap = flatMap
exports.filter = filter
exports.reduce = reduce
exports.transform = transform
exports.get = get
exports.pick = pick
exports.omit = omit
exports.any = any
exports.all = all
exports.and = and
exports.or = or
exports.not = not
exports.eq = eq
exports.gt = gt
exports.lt = lt
exports.gte = gte
exports.lte = lte

}))
