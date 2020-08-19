/**
 * rubico v1.5.6
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2020 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

(function (root, rubico) {
  if (typeof module == 'object') (module.exports = rubico) // CommonJS
  else if (typeof define == 'function') define(() => rubico) // AMD
  else (root.rubico = rubico) // Browser
}(this, (function () { 'use strict'

/**
 * design principles
 *
 * rubico is a module, not a utility library
 * functional code should not care about async
 * exported methods are time and space optimal
 * memory used by exported methods is properly garbage collected
 * no special types; use built-in types
 * no currying; write new functions
 * avoid variadic functions; use lists
 */

const symbolIterator = Symbol.iterator

const symbolAsyncIterator = Symbol.asyncIterator

const objectProto = Object.prototype

const nativeObjectToString = objectProto.toString

const objectToString = x => nativeObjectToString.call(x)

const generatorFunctionTag = '[object GeneratorFunction]'

const asyncGeneratorFunctionTag = '[object AsyncGeneratorFunction]'

const promiseAll = Promise.all.bind(Promise)

const isDefined = value => value != null

const isUndefined = value => typeof value == 'undefined'

const isNull = value => value === null

const isIterable = value => value != null
  && typeof value[symbolIterator] == 'function'

const isAsyncIterable = value => value != null
  && typeof value[symbolAsyncIterator] == 'function'

const isWritable = value => value != null && typeof value.write == 'function'

const isFunction = value => typeof value == 'function'

const isArray = Array.isArray

const isObject = value => value != null && value.constructor == Object

const isSet = value => value != null && value.constructor == Set

const isMap = value => value != null && value.constructor == Map

const isTypedArray = ArrayBuffer.isView

const isNumber = function (value) {
  return typeof value == 'number'
    || (value != null && value.constructor == Number)
}

const isNaN = Number.isNaN

const isBigInt = x => typeof x == 'bigint'

const isString = value => typeof value == 'string'
  || (value != null && value.constructor == String)

const isPromise = value => value != null && typeof value.then == 'function'

const range = (start, end) => Array.from({ length: end - start }, (x, i) => i + start)

const arrayOf = (item, length) => Array.from({ length }, () => item)

/**
 * @name arrayPush
 *
 * @synopsis
 * arrayPush(x Array, value any) -> undefined
const arrayPush = (array, value) => {
  array[array.length] = value
} */

/**
 * @name possiblePromiseThen
 *
 * @synopsis
 * possiblePromiseThen(value Promise|any, func function) -> Promise|any
 */
const possiblePromiseThen = (value, func) => (
  isPromise(value) ? value.then(func) : func(value))

/**
 * @name SyncThenable
 *
 * @synopsis
 * new SyncThenable(value any) -> SyncThenable
 */
const SyncThenable = function (value) { this.value = value }

/**
 * @name SyncThenable.prototype.then
 *
 * @synopsis
 * new SyncThenable(value any).then(func function) -> any
 */
SyncThenable.prototype.then = function (func) { return func(this.value) }

/**
 * @name possiblePromiseAll
 *
 * @synopsis
 * possiblePromiseAll(
 *   values Array<Promise>|Array,
 * ) -> Promise<Array>|SyncThenable<Array>
 */
const possiblePromiseAll = values => (values.some(isPromise)
  ? promiseAll(values)
  : new SyncThenable(values))

/**
 * @name funcConcat
 *
 * @synopsis
 * any -> A; any -> B; any -> C
 *
 * funcConcat(funcAB A=>B, funcBC B=>C) -> pipedFunction A=>C
 */
const funcConcat = (funcAB, funcBC) => function pipedFunction(...args) {
  const callAB = funcAB.apply(null, args)
  return isPromise(callAB)
    ? callAB.then(res => funcBC.call(null, res))
    : funcBC.call(null, callAB)
}

/**
 * @synopsis
 * isGeneratorFunction(value any) -> boolean
 */
const isGeneratorFunction = function (value) {
  const tag = objectToString(value)
  return tag == generatorFunctionTag || tag == asyncGeneratorFunctionTag
}

/**
 * @synopsis
 * isSequence(value any) -> boolean
const isSequence = value => value != null
  && (typeof value[symbolIterator] == 'function'
    || typeof value[symbolAsyncIterator] == 'function'
    || isGeneratorFunction(value)) */

/**
 * @name pipe
 *
 * @catchphrase
 * define flow: chain functions together
 *
 * @synopsis
 * any -> T
 *
 * (<T>, T)=>Promise|<T> -> Reducer<T>
 *
 * Reducer=>Reducer -> Transducer
 *
 * pipe([
 *   args=>Promise|any,
 *   ...Array<any=>Promise|any>,
 * ])(args ...any) -> output Promise|any
 *
 * pipe(
 *   Array<Transducer>,
 * )(Reducer) -> composed Reducer
 *
 * @description
 * **pipe** takes an array of functions and chains them together, each function passing its return value to the next function until all functions have been called. The final output for a given pipe and input is the result of the last function in the pipe.
 *
 * ```javascript
 * console.log(
 *   pipe([
 *     number => number + 1,
 *     number => number + 2,
 *     number => number + 3,
 *   ])(5),
 * ) // 11
 * ```
 *
 * When the first argument supplied to a pipe of functions is a non-generator function, **pipe** assumes it is being used in transducer position and iterates through its functions in reverse. This is due to an implementation detail in transducers, and enables the library Transducers API.
 *
 * ```
 * any -> T
 *
 * (<T>, T)=>Promise|<T> -> Reducer<T> // the standalone <T> means "generic of T"
 *
 * Reducer=>Reducer -> Transducer
 * ```
 *
 * A reducer is a function that takes a generic of any type T, a given instance of type T, and returns possibly a Promise of a generic of type T. A transducer is a function that takes a reducer and returns another reducer.
 *
 * ```
 * pipe(
 *   Array<Transducer>,
 * )(Reducer) -> composed Reducer
 * ```
 *
 * **pipe** supports transducer composition. When passed a reducer function, a pipe of functions returns a new reducer function that applies the transducers of the functions array in series, ending the chain with the passed in reducer. `compositeReducer` must be used in transducer position in conjunction with **reduce** or any implementation of reduce to have a transducing effect. For more information on this behavior, see [transducers](https://github.com/a-synchronous/rubico/blob/master/TRANSDUCERS.md).
 *
 * ```javascript
 * const isOdd = number => number % 2 == 1
 *
 * const square = number => number ** 2
 *
 * const add = (a, b) => a + b
 *
 * const squaredOdds = pipe([
 *   filter(isOdd),
 *   map(square),
 * ])
 *
 * console.log(
 *   [1, 2, 3, 4, 5].reduce(squaredOdds(add), 0),
 * ) // 1 + 9 + 25 -> 35
 *
 * console.log(
 *   squaredOdds([1, 2, 3, 4, 5])
 * ) // [1, 9, 25]
 * ```
 *
 * @execution series
 *
 * @transducing
 */
const pipe = function (funcs) {
  const functionPipeline = funcs.reduce(funcConcat),
    functionComposition = funcs.reduceRight(funcConcat)
  return function pipeline() {
    const firstArg = arguments[0]
    if (isFunction(firstArg) && !isGeneratorFunction(firstArg)) {
      return functionComposition.apply(null, arguments)
    }
    return functionPipeline.apply(null, arguments)
  }
}

/**
 * @name funcObjectAll
 *
 * @synopsis
 * funcObjectAll(
 *   funcs Object<args=>Promise|any>
 * )(args ...any) -> objectAllFuncs args=>Promise|Object
 */
const funcObjectAll = funcs => function objectAllFuncs(...args) {
  const output = {}, promises = []
  for (const key in funcs) {
    const outputItem = funcs[key].apply(null, args)
    if (isPromise(outputItem)) {
      promises.push(outputItem.then(res => {
        output[key] = res
      }))
    } else {
      output[key] = outputItem
    }
  }
  return promises.length == 0 ? output : promiseAll(promises).then(() => output)
}

/**
 * @name funcAll
 *
 * @synopsis
 * ...any -> args
 *
 * funcAll(
 *   funcs Array<args=>Promise|any>
 * ) -> allFuncs args=>Promise|Array
 */
const funcAll = funcs => function allFuncs(...args) {
  let isAsync = false
  const output = funcs.map(func => {
    const outputItem = func.apply(null, args)
    if (isPromise(outputItem)) isAsync = true
    return outputItem
  })
  return isAsync ? promiseAll(output) : output
}

/**
 * @name fork
 *
 * @catchphrase
 * duplicate and diverge flow
 *
 * @synopsis
 * ...any -> args
 *
 * fork(
 *   funcs Object<args=>Promise|any>,
 * )(args) -> Promise|Object
 *
 * fork(
 *   funcs Array<args=>Promise|any>,
 * )(args) -> Promise|Array
 *
 * @description
 * **fork** takes an array or object of optionally async functions and an input value and returns an array or object or Promise of either. The resulting array or object is the product of applying each function in the array or object of functions to any amount of input arguments.
 *
 * All functions of `funcs`, including additional forks, are executed concurrently.
 *
 * ```javascript
 * console.log(
 *   fork({
 *     greetings: fork([
 *       greeting => greeting + 'world',
 *       greeting => greeting + 'mom',
 *     ]),
 *   })('hello'),
 * ) // { greetings: ['hello world', 'hello mom'] }
 * ```
 *
 * @execution concurrent
 */
const fork = funcs => isArray(funcs) ? funcAll(funcs) : funcObjectAll(funcs)

/**
 * @name asyncFuncAllSeries
 *
 * @synopsis
 * asyncFuncAllSeries(
 *   funcs Array<function>,
 *   input any,
 *   output Array,
 *   funcsIndex number,
 * ) -> output Array
 */
const asyncFuncAllSeries = async function (funcs, args, output, funcsIndex) {
  const funcsLength = funcs.length
  while (++funcsIndex < funcsLength) {
    output[funcsIndex] = await funcs[funcsIndex].apply(null, args)
  }
  return output
}

/**
 * @name funcAllSeries
 *
 * @synopsis
 * ...any -> args
 *
 * funcAllSeries(
 *   funcs Array<args=>any>,
 * ) -> allFuncsSeries args=>Promise|Array
 */
const funcAllSeries = funcs => function allFuncsSeries(...args) {
  const funcsLength = funcs.length, output = []
  let funcsIndex = -1
  while (++funcsIndex < funcsLength) {
    const outputItem = funcs[funcsIndex].apply(null, args)
    if (isPromise(outputItem)) {
      return outputItem.then(res => {
        output[funcsIndex] = res
        return asyncFuncAllSeries(funcs, args, output, funcsIndex)
      })
    }
    output[funcsIndex] = outputItem
  }
  return output
}

/**
 * @name fork.series
 *
 * @synopsis
 * ...any -> args
 *
 * fork.series(
 *   funcs Array<args=>Promise|any>,
 * )(args) -> Promise|Array
 *
 * @catchphrase
 * fork in series
 *
 * @description
 * **fork.series** is fork with serial execution instead of concurrent execution of functions. All functions of `funcs` are then executed in series.
 *
 * ```javascript
 * const sleep = ms => () => new Promise(resolve => setTimeout(resolve, ms))
 *
 * fork.series([
 *   greeting => console.log(greeting + ' world'),
 *   sleep(1000),
 *   greeting => console.log(greeting + ' mom'),
 *   sleep(1000),
 *   greeting => console.log(greeting + ' darkness'),
 * ])('hello') // hello world
 *             // hello mom
 *             // hello darkness
 * ```
 *
 * @execution series
 */
fork.series = funcAllSeries

/**
 * @name assign
 *
 * @catchphrase
 * fork, then merge results
 *
 * @synopsis
 * assign(
 *   funcs Object<input=>Promise|any>,
 * )(input Object) -> output Promise|Object
 *
 * @description
 * **assign** accepts an object of optionally async functions and an object input and returns an output object or a Promise of an object. The output is composed of the original input and an object computed from a concurrent evaluation of the object of functions with the input. `result` is each function of `funcs` applied with Object `value` merged into the input Object `value`. If any functions of `funcs` is asynchronous, `result` is a Promise.
 *
 * All functions of `funcs`, including additional forks, are executed concurrently.
 *
 * ```javascript
 * console.log(
 *   assign({
 *     squared: ({ number }) => number ** 2,
 *     cubed: ({ number }) => number ** 3,
 *   })({ number: 3 }),
 * ) // { number: 3, squared: 9, cubed: 27 }
 * ```
 *
 * @execution concurrent
 */
const assign = function (funcs) {
  const allFuncs = funcObjectAll.call(null, funcs)
  return function assignment(input) {
    const output = allFuncs.call(null, input)
    return isPromise(output)
      ? output.then(res => ({ ...input, ...res }))
      : ({ ...input, ...output })
  }
}

/**
 * @name tap
 *
 * @synopsis
 * tap(function)(input any) -> Promise|input
 *
 * @catchphrase
 * spy on flow
 *
 * @description
 * **tap** accepts a function and any input, calls the function with the input, and returns the original input. This is useful for running side effects in function pipelines, e.g. logging out data in a pipeline to the console.
 *
 * ```javascript
 * pipe([
 *   tap(console.log),
 *   value => value + 'bar'
 *   tap(console.log),
 * ])('foo') // 'foo'
 *           // 'foobar'
 * ```
 */
const tap = func => function tapping(input) {
  const call = func.call(null, input)
  return isPromise(call) ? call.then(() => input) : input
}

/**
 * @name tap.if
 *
 * @synopsis
 * <T any>tap.if(
 *   cond T=>boolean,
 *   func T=>any,
 * )(value T) -> result Promise|T
 *
 * @catchphrase
 * Conditional tap
 *
 * @description
 * **tap.if** takes a condition `cond`, a function `func`, and an input `value`, returning the `result` as the unchanged `value`. If `cond` applied with `value` is falsy, `func` is not called; otherwise, `func` is called with `value`. `result` is a Promise if either `func` or `cond` is asynchronous.
 *
 * ```javascript
 * const isOdd = number => number % 2 == 1
 *
 * pipe([
 *   tap.if(isOdd, number => {
 *     console.log('odd', number)
 *   }),
 *   number => number ** 2,
 *   tap.if(isOdd, number => {
 *     console.log('squared odd', number)
 *   }),
 * ])(3) // odd 3
 *       // squared odd 9
 * ```
 *
 * @TODO
 */
tap.if = (cond, func) => {}

/**
 * @name tryCatch
 *
 * @catchphrase
 * try a function, catch with another
 *
 * @synopsis
 * tryCatch(
 *   tryer args=>Promise|any,
 *   catcher (err Error|any, ...args)=>Promise|any,
 * )(args ...any) -> Promise|any
 *
 * @description
 * **tryCatch** takes two functions, a tryer and a catcher, and returns a tryCatcher function that, when called, calls the tryer with the arguments. If the tryer throws an Error or returns a Promise that rejects, tryCatch calls the catcher with the thrown value and the arguments. If the tryer called with the arguments does not throw, the tryCatcher returns the result of that call.
 *
 * ```javascript
 * const errorThrower = tryCatch(
 *   message => {
 *     throw new Error(message)
 *   },
 *   (err, message) => {
 *     console.log(err)
 *     return `${message} from catcher`
 *   },
 * )
 *
 * console.log(errorThrower('hello')) // Error: hello
 *                                    // hello from catcher
 * ```
 */
const tryCatch = (tryer, catcher) => function tryCatcher(...args) {
  try {
    const output = tryer(...args)
    return isPromise(output)
      ? output.catch(err => catcher(err, ...args)) : output
  } catch (err) {
    return catcher(err, ...args)
  }
}

/**
 * @name asyncFuncSwitch
 *
 * @synopsis
 * asyncFuncSwitch(
 *   funcs Array<args=>Promise|any>,
 *   args Array,
 *   funcsIndex number,
 * ) -> Promise|any
 */
const asyncFuncSwitch = async function (funcs, args, funcsIndex) {
  const lastIndex = funcs.length - 1
  while ((funcsIndex += 2) < lastIndex) {
    if (await funcs[funcsIndex](...args)) {
      return funcs[funcsIndex + 1](...args)
    }
  }
  return funcs[funcsIndex](...args)
}

/**
 * @name funcConditional
 *
 * @synopsis
 * funcConditional(
 *   funcs Array<args=>Promise|any>,
 * )(args ...any) -> Promise|any
 */
const funcConditional = funcs => function funcSwitching(...args) {
  const lastIndex = funcs.length - 1
  let funcsIndex = -2
  while ((funcsIndex += 2) < lastIndex) {
    const shouldReturnNext = funcs[funcsIndex](...args)
    if (isPromise(shouldReturnNext)) {
      return shouldReturnNext.then(res => res
        ? funcs[funcsIndex + 1](...args)
        : asyncFuncSwitch(funcs, args, funcsIndex))
    }
    if (shouldReturnNext) {
      return funcs[funcsIndex + 1](...args)
    }
  }
  return funcs[funcsIndex](...args)
}

/**
 * @name switchCase
 *
 * @synopsis
 * switchCase(funcs)
 *
 * switchCase(fns Array<function>)(x any) -> Promise|any
 */
const switchCase = funcConditional

/*
 * @synopsis
 * mapAsyncIterable(f function, x AsyncIterable<any>) -> AsyncIterable<any>
 *
 * @TODO refactor for proper generator syntax
 */
const mapAsyncIterable = (fn, x) => (async function*() {
  for await (const xi of x) yield fn(xi)
})()

/*
 * @synopsis
 * mapIterable(f function, x Iterable<any>) -> Iterable<any>
 *
 * @TODO refactor for proper generator syntax
 */
const mapIterable = (fn, x) => (function*() {
  for (const xi of x) {
    yield fn(xi)
  }
})()

/**
 * @name sequenceMap
 *
 * @synopsis
 * any -> T
 *
 * Iterable<T>|AsyncIterable<T>
 *   |GeneratorFunction<T>|AsyncGeneratorFunction<T> -> Sequence<T>
 *
 * sequenceMap(seq Sequence<T>, func T=>any) -> Sequence
const iteratorMap = function* (seq, func) {
  for (const item of getIterator(seq)) {
    yield func(item)
  }
} */

/*
 * @synopsis
 * mapArray(f function, x Array<any>) -> Array<any>|Promise<Array<any>>
 *
 * @note
 * x.map
 * https://v8.dev/blog/elements-kinds#avoid-polymorphism
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
const mapString = (f, x) => possiblePromiseThen(
  mapIterableToArray(f, x),
  res => res.join(''),
)

/*
 * @synopsis
 * mapTypedArray(f function, x TypedArray<any>) -> TypedArray<any>
 */
const mapTypedArray = (f, x) => possiblePromiseThen(
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
 *   -> anotherReducer (y any, xi any)=>Promise|any
 */
const mapReducer = (f, reducer) => (y, xi) => (
  possiblePromiseThen(f(xi), res => reducer(y, res)))

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
    if (isSet(x)) return mapSet(f, x)
    if (isMap(x)) return mapMap(f, x)
    if (isTypedArray(x)) return mapTypedArray(f, x)
    if (isIterable(x)) return mapIterable(f, x) // for generators or custom iterators
    if (isObject(x)) return mapObject(f, x)
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
  return possiblePromiseThen(
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

/*
 * @synopsis
 * mapPoolArray(size number, f function, x Array<any>) -> Promise<Array<any>>
 *
 * @note
 * https://stackoverflow.com/questions/62037349/rubicos-map-pool-array-implementation
 * https://stackoverflow.com/questions/39195441/limited-parallelism-with-async-await-in-typescript-es7
 */
const mapPoolArray = async (size, f, x) => {
  const y = []
  const promises = new Set()
  for (const xi of x) {
    if (promises.size >= size) {
      await Promise.race(promises)
    }
    const yi = f(xi)
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
  return Promise.all(y)
}

/*
 * @synopsis
 * mapPoolSet(size number, f function, x Set<any>) -> Promise<Set<any>>
 */
const mapPoolSet = (size, f, x) => (
  mapPoolArray(size, f, x).then(res => new Set(res)))

/*
 * @synopsis
 * mapPoolMap(size number, f function, x Map<any=>any>) -> Promise<Map<any=>any>>
 */
const mapPoolMap = (size, f, x) => (
  mapPoolArray(size, f, x).then(res => new Map(res))
)

/*
 * @synopsis
 * <T any>Array<T>|Set<T>|Map<T> -> MapPoolable<T>
 *
 * <T MapPoolable>map.pool(size number, f function)(x T<any>) -> Promise<T<any>>
 */
map.pool = (size, fn) => {
  if (!isNumber(size) || isNaN(size)) {
    throw new TypeError(`map.pool(size, f); invalid size ${size}`)
  }
  if (size < 1) {
    throw new RangeError('map.pool(size, f); size must be 1 or more')
  }
  if (!isFunction(fn)) {
    throw new TypeError('map.pool(size, f); f is not a function')
  }
  return x => {
    if (isArray(x)) return mapPoolArray(size, fn, x)
    if (isSet(x)) return mapPoolSet(size, fn, x)
    if (isMap(x)) return mapPoolMap(size, fn, x)
    throw new TypeError('map.pool(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * <A any, B any>mapArrayWithIndex(
 *   f (xi A, i number, x Array<A>)=>B,
 *   x Array<A>,
 * ) -> Array<B>|Promise<Array<B>>
 */
const mapArrayWithIndex = (fn, x) => {
  let isAsync = false
  const y = x.map((xi, i) => {
    const point = fn(xi, i, x)
    if (isPromise(point)) isAsync = true
    return point
  })
  return isAsync ? Promise.all(y) : y
}

/*
 * @synopsis
 * mapIterableWithIndexToArray(
 *   f (xi any, i number, x Iterable<any>)=>any,
 *   x Iterable<any>,
 * ) -> Array<any>|Promise<Array<any>>
 */
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

/*
 * @synopsis
 * mapStringWithIndex(f any=>any, x string) -> string|Promise<string>
 */
const mapStringWithIndex = (f, x) => possiblePromiseThen(
  mapIterableWithIndexToArray(f, x),
  res => res.join(''),
)

/*
 * @synopsis
 * Array<any>|string -> T
 *
 * map.withIndex(f any=>any)(x T) -> T|Promise<T>
 *
 * @TODO x can be an Object
 */
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

/*
 * @synopsis
 * filterAsyncIterable(predicate any=>any, x AsyncIterable)
 *   -> AsyncIterable<any>
 *
 * @TODO refactor for proper generator syntax
 */
const filterAsyncIterable = (predicate, x) => (async function*() {
  for await (const xi of x) { if (await predicate(xi)) yield xi }
})()

/*
 * @synopsis
 * filterIterable(predicate any=>any, x Iterable<any>) -> Iterable<any>
 *
 * @TODO refactor for proper generator syntax
 */
const filterIterable = (predicate, x) => (function*() {
  for (const xi of x) {
    const ok = predicate(xi)
    if (isPromise(ok)) {
      throw new TypeError([
        'filter(f)(x); xi is an element of x;',
        'if x if the resulting iterator of a sync generator,',
        'f(xi) cannot return a Promise',
      ].join(' '))
    }
    if (ok) yield xi
  }
})()

/*
 * @synopsis
 * createFilterIndex(predicate any=>any, x Iterable<any>)
 *   -> filterIndex Array<any>|Promise<Array<any>>
 */
const createFilterIndex = (predicate, x) => {
  let isAsync = false
  const filterIndex = []
  for (const xi of x) {
    const ok = predicate(xi)
    if (isPromise(ok)) isAsync = true
    filterIndex.push(ok)
  }
  return isAsync ? Promise.all(filterIndex) : filterIndex
}

/*
 * @synopsis
 * filterArray(predicate any=>any, x Array<any>)
 *   -> Array<any>|Promise<Array<any>>
 */
const filterArray = (predicate, x) => possiblePromiseThen(
  createFilterIndex(predicate, x),
  res => x.filter((_, i) => res[i]),
)

/*
 * @synopsis
 * filterStringFromIndex(index Array<any>, x string) -> string
 */
const filterStringFromIndex = (index, x) => {
  let y = ''
  for (let i = 0; i < x.length; i++) { if (index[i]) y += x[i] }
  return y
}

/*
 * @synopsis
 * filterString(predicate any=>any, x string) -> string|Promise<string>
 */
const filterString = (predicate, x) => possiblePromiseThen(
  createFilterIndex(predicate, x),
  res => filterStringFromIndex(res, x),
)

/*
 * @synopsis
 * filterSet(predicate any=>any, x Set<any>) -> Set<any>|Promise<Set<any>>
 */
const filterSet = (predicate, x) => {
  const y = new Set(), promises = []
  for (const xi of x) {
    const ok = predicate(xi)
    if (isPromise(ok)) {
      promises.push(ok.then(res => res && y.add(xi)))
    } else if (ok) { y.add(xi) }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * filterMap(predicate any=>any, x Map<any=>any>)
 *   -> Map<any=>any>|Promise<Map<any=>any>>
 */
const filterMap = (predicate, x) => {
  const y = new Map(), promises = []
  for (const xi of x) {
    const ok = predicate(xi)
    if (isPromise(ok)) {
      promises.push(ok.then(res => res && y.set(...xi)))
    } else if (ok) { y.set(...xi) }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * filterTypedArray(predicate any=>any, x TypedArray<any>) -> TypedArray<any>
 */
const filterTypedArray = (predicate, x) => possiblePromiseThen(
  filterArray(predicate, x),
  res => new x.constructor(res),
)

/*
 * @synopsis
 * filterObject(predicate any=>any, x Object<any>) -> Object<any>
 */
const filterObject = (predicate, x) => {
  const y = {}, promises = []
  for (const k in x) {
    const ok = predicate(x[k])
    if (isPromise(ok)) {
      promises.push(ok.then(res => { if (res) { y[k] = x[k] } }))
    } else if (ok) { y[k] = x[k] }
  }
  return promises.length > 0 ? Promise.all(promises).then(() => y) : y
}

/*
 * @synopsis
 * filterReducer(
 *   predicate any=>any,
 *   reducer (any, any)=>any,
 * ) -> (y any, xi any)=>Promise|any
 */
const filterReducer = (predicate, reducer) => (y, xi) => (
  possiblePromiseThen(predicate(xi), res => res ? reducer(y, xi) : y))

/*
 * @synopsis
 * <T any>AsyncIterable<T>|Array<T>|string|Set<T>|Map<T>
 *   |TypedArray<T>|Iterable<T>|Object<T>|(any, T)=>any -> Filterable<T>
 *
 * filter(predicate any=>any)(x Filterable<any>) -> Filterable<any>
 */
const filter = predicate => {
  if (!isFunction(predicate)) {
    throw new TypeError('filter(predicate); predicate is not a function')
  }
  return x => {
    if (isAsyncIterable(x)) return filterAsyncIterable(predicate, x)
    if (isArray(x)) return filterArray(predicate, x)
    if (isString(x)) return filterString(predicate, x)
    if (isSet(x)) return filterSet(predicate, x)
    if (isMap(x)) return filterMap(predicate, x)
    if (isTypedArray(x)) return filterTypedArray(predicate, x)
    if (isIterable(x)) return filterIterable(predicate, x) // for generators or custom iterators
    if (isObject(x)) return filterObject(predicate, x)
    if (isFunction(x)) return filterReducer(predicate, x)
    throw new TypeError('filter(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * createFilterWithIndexIndex(
 *   predicate (xi any, i number, x Iterable<any>)=>any,
 *   x Iterable<any>,
 * ) -> Array<any>|Promise<Array<any>>
 */
const createFilterWithIndexIndex = (predicate, x) => {
  let isAsync = false, i = 0
  const filterIndex = []
  for (const xi of x) {
    const ok = predicate(xi, i, x)
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
const filterArrayWithIndex = (predicate, x) => possiblePromiseThen(
  createFilterWithIndexIndex(predicate, x),
  res => x.filter((_, i) => res[i]),
)

/*
 * @synopsis
 * filterArrayWithIndex(predicate function, x string) -> string|Promise<string>
 */
const filterStringWithIndex = (predicate, x) => possiblePromiseThen(
  createFilterWithIndexIndex(predicate, x),
  res => filterStringFromIndex(res, x),
)

/*
 * @synopsis
 * filter.withIndex(predicate function)(x Array<any>|string)
 *   -> Array<any>|Promise<Array<any>>|string|Promise<string>
 */
filter.withIndex = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('filter.withIndex(f); f is not a function')
  }
  return x => {
    if (isArray(x)) return filterArrayWithIndex(fn, x)
    if (isString(x)) return filterStringWithIndex(fn, x)
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
 *   -> Promise|any
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
 * reduceObject(f function, x0 any, x Object<any>) -> Promise|any
 */
const reduceObject = (fn, x0, x) => reduceIterable(
  fn,
  x0,
  (function* () { for (const k in x) yield x[k] })(),
)

/*
 * @synopsis
 * Iterable|AsyncIterable|Object -> Reducible
 *
 * <T any>reduce(
 *   f (aggregate any, xi T)=>any,
 *   init ((x Reducible<T>)=>any)|any,
 * )(x Reducible<T>) -> reduced any
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
    const x0 = isFunction(init) ? init(x) : init
    if (isIterable(x)) return possiblePromiseThen(
      x0,
      res => reduceIterable(fn, res, x),
    )
    if (isAsyncIterable(x)) {
      const state = { cancel: () => {} }
      const cancelToken = new Promise((_, reject) => { state.cancel = reject })
      const p = Promise.race([
        possiblePromiseThen(
          x0,
          res => reduceAsyncIterable(fn, res, x),
        ),
        cancelToken,
      ])
      p.cancel = () => { state.cancel(new Error('cancelled')) }
      return p
    }
    if (isObject(x)) return possiblePromiseThen(
      x0,
      res => reduceObject(fn, res, x),
    )
    throw new TypeError('reduce(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * TODO
 */
const nullTransform = (fn, x0) => reduce(
  fn(() => x0),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const arrayTransform = (fn, x0) => x => reduce(
  fn((y, xi) => { y.push(xi); return y }),
  x0,
)(x)

/*
 * @synopsis
 * TODO
 */
const stringTransform = (fn, x0) => reduce(
  fn((y, xi) => `${y}${xi}`),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const setTransform = (fn, x0) => reduce(
  fn((y, xi) => y.add(xi)),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const mapTransform = (fn, x0) => reduce(
  fn((y, xi) => y.set(xi[0], xi[1])),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const stringToCharCodes = x => {
  const y = []
  for (let i = 0; i < x.length; i++) {
    y.push(x.charCodeAt(i))
  }
  return y
}

/*
 * @synopsis
 * TODO
 */
const toTypedArray = (constructor, x) => {
  if (isNumber(x) || isBigInt(x)) return constructor.of(x)
  if (isString(x)) return new constructor(stringToCharCodes(x))
  throw new TypeError([
    'toTypedArray(typedArray, y)',
    'cannot convert y to typedArray',
  ].join('; '))
}

/*
 * @synopsis
 * TODO
 */
const firstPowerOf2After = x => {
  let y = 2
  while (y < x + 1) {
    y = y << 1
  }
  return y
}

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * Iterable|GeneratorFunction
 *   |AsyncIterable|AsyncGeneratorFunction -> Sequence
 *
 * <T TypedArray>typedArrayTransform(fn function, x0 T)(x Sequence) -> T
 */
const typedArrayTransform = (fn, x0) => x => possiblePromiseThen(
  reduce(
    fn(({ y, offset }, xi) => {
      const chunk = toTypedArray(x0.constructor, xi)
      const buf = typedArrayConcat(y, chunk, offset)
      return { y: buf, offset: offset + chunk.length }
    }),
    { y: x0.constructor.from(x0), offset: x0.length },
  )(x),
  ({ y, offset }) => y.slice(0, offset),
)

/*
 * @synopsis
 * TODO
 */
const writableTransform = (fn, x0) => reduce(
  fn((y, xi) => { y.write(xi); return y }),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const objectTransform = (fn, x0) => reduce(
  fn((y, xi) => {
    if (isArray(xi)) { y[xi[0]] = xi[1]; return y }
    return Object.assign(y, xi)
    // TODO: implement
    // if (isObject(xi)) Object.assign(y, xi)
    // else throw new TypeError('...')
  }),
  x0,
)

/*
 * @synopsis
 * TODO
 */
const _transformBranch = (fn, x0, x) => {
  if (isNull(x0)) return nullTransform(fn, x0)(x)
  if (isArray(x0)) return arrayTransform(fn, x0)(x)
  if (isString(x0)) return stringTransform(fn, x0)(x)
  if (isSet(x0)) return setTransform(fn, x0)(x)
  if (isMap(x0)) return mapTransform(fn, x0)(x)
  if (isTypedArray(x0)) return typedArrayTransform(fn, x0)(x)
  if (isWritable(x0)) return writableTransform(fn, x0)(x)
  if (isObject(x0)) return objectTransform(fn, x0)(x)
  throw new TypeError('transform(x, y); x invalid')
}

/*
 * @synopsis
 * TODO
 */
const transform = (fn, init) => {
  if (!isFunction(fn)) {
    throw new TypeError('transform(x, y); y is not a function')
  }
  return x => possiblePromiseThen(
    isFunction(init) ? init(x) : init,
    res => _transformBranch(fn, res, x),
  )
}

/**
 * @name arrayPushArray
 *
 * @synopsis
 * arrayPushArray(x Array, array Array) -> undefined
 */
const arrayPushArray = (x, array) => {
  const offset = x.length, length = array.length
  let i = -1
  while (++i < length) {
    x[offset + i] = array[i]
  }
}

/**
 * @name arrayPushIterable
 *
 * @synopsis
 * arrayPushIterable(x Array, array Array) -> undefined
 */
const arrayPushIterable = (x, iterable) => {
  const offset = x.length
  let i = 0
  for (const value of iterable) {
    x[offset + i] = value
    i += 1
  }
}

/**
 * @name arrayFlatten
 *
 * @synopsis
 * <T any>arrayFlatten(Array<Array<T>|T>) -> Array<T>
 */
const arrayFlatten = x => {
  const y = []
  for (const xi of x) {
    (isArray(xi) ? arrayPushArray(y, xi) :
      isIterable(xi) ? arrayPushIterable(y, xi) : y.push(xi))
  }
  return y
}

/*
 * @name genericFlatten
 *
 * @synopsis
 * <T any>genericFlatten(
 *   method string,
 *   y Set<>,
 *   x Iterable<Iterable<T>|T>,
 * ) -> Set<T>
 */
const genericFlatten = (method, y, x) => {
  const add = y[method].bind(y)
  for (const xi of x) {
    if (isIterable(xi)) {
      for (const v of xi) add(v)
    } else {
      add(xi)
    }
  }
  return y
}

/**
 * @name flatMapArray
 *
 * @synopsis
 * <A any, B any>flatMapArray(
 *   func A=>Iterable<B>|B,
 *   arr Array<A>,
 * ) -> result Promise<Array<B>>|Array<B>
 */
const flatMapArray = (func, arr) => (
  possiblePromiseThen(mapArray(func, arr), arrayFlatten))

/**
 * @name flatMapSet
 *
 * @synopsis
 * <A any, B any>flatMapSet(
 *   func A=>Iterable<B>|B,
 *   set Set<A>
 * ) -> result Promise<Set<B>>|Set<B>
 */
const flatMapSet = (func, set) => possiblePromiseThen(
  mapSet(func, set),
  res => genericFlatten('add', new Set(), res),
)

/**
 * @name flatMapReducer
 *
 * @synopsis
 * <A any, B any>flatMapReducer(
 *   func A=>Iterable<B>|B,
 *   reducer (any, A)=>any
 * ) -> transducedReducer (aggregate any, value A)=>Promise|any
 */
const flatMapReducer = (func, reducer) => (aggregate, value) => (
  possiblePromiseThen(func(value), reduce(reducer, aggregate)))

/**
 * @name flatMap
 *
 * @synopsis
 * <A any, B any>flatMap(
 *   func A=>Iterable<B>|B
 * )(value Array<Array<A>|A>) -> result Array<B>
 *
 * <A any, B any>flatMap(
 *   func A=>Iterable<B>|B
 * )(value Set<Set<A>|A>) -> result Set<B>
 *
 * <A any, B any>flatMap(
 *   func A=>Iterable<B>|B
 * )(value (any, any)=>any) -> transducedReducer (any, any)=>any
 *
 * @catchphrase
 * map then flatten
 *
 * @description
 * **flatMap** accepts a mapper function `func` and an Array or Set `value`, and returns a new flattened and mapped Array or Set `result`. Each item of `result` is the result of applying the mapper function `func` to a given item of the input Array or Set `value`. The final `result` Array or Set is flattened one depth level.
 *
 * When `value` is a reducer function, the output is another reducer function `transducedReducer` that represents a flatMap step in a transducer chain. A flatMap step involves the application of the mapper function `func` to a given element of a collecting being reduced, then flattening the result into the aggregate. For more information on this behavior, please see [transducers](https://github.com/a-synchronous/rubico/blob/master/TRANSDUCERS.md).
 *
 * @example
 * console.log(
 *   flatMap(
 *     number => [number ** 2, number ** 3],
 *   )([1, 2, 3]),
 * ) // [1, 1, 4, 8, 9, 27]
 *
 * @execution concurrent
 */
const flatMap = func => {
  if (!isFunction(func)) {
    throw new TypeError('flatMap(func); func is not a function')
  }
  return value => {
    if (isArray(value)) return flatMapArray(func, value)
    if (isSet(value)) return flatMapSet(func, value)
    if (isFunction(value)) return flatMapReducer(func, value)
    throw new TypeError(`flatMap(...)(value); invalid value ${value}`)
  }
}

/**
 * @name isDelimitedBy
 *
 * @synopsis
 * isDelimitedBy(delim string, value string) -> boolean
 */
const isDelimitedBy = (delim, value) => (value != null
  && value[0] !== delim
  && value[value.length - 1] !== delim
  && value.slice(1, value.length - 1).includes(delim))

/**
 * @name arrayPathGet
 *
 * @synopsis
 * arrayPathGet(
 *   path Array<string|number>,
 *   value any,
 *   defaultValue function|any,
 * ) -> result any
 */
const arrayPathGet = (path, value, defaultValue) => {
  if (value == null) {
    return isFunction(defaultValue) ? defaultValue(value) : defaultValue
  }
  const pathLength = path.length
  let result = value, i = -1
  while (++i < pathLength) {
    result = result[path[i]]
    if (result == null) {
      return isFunction(defaultValue) ? defaultValue(value) : defaultValue
    }
  }
  return result
}

/**
 * @name get
 *
 * @synopsis
 * get(
 *   path Array<number|string>|number|string,
 *   defaultValue function|any,
 * )(value any) -> result any
 *
 * @catchphrase
 * Access a property by path
 *
 * @description
 * **get** takes an Array of Numbers or Strings, Number, or String `path` argument, a function or any `defaultValue` argument, and returns a getter function that, when supplied any `value`, returns a property on that `value` described by `path`.
 *
 * @example
 * const nestedABC = { a: { b: { c: 1 } } }
 *
 * console.log(
 *   get('a.b.c')(nestedABC),
 * ) // 1
 */
const get = (path, defaultValue) => {
  if (isArray(path)) return value => arrayPathGet(path, value, defaultValue)
  if (isNumber(path)) return value => arrayPathGet([path], value, defaultValue)
  if (isString(path)) return (isDelimitedBy('.', path)
    ? value => arrayPathGet(path.split('.'), value, defaultValue)
    : value => arrayPathGet([path], value, defaultValue))
  throw new TypeError(`get(path); invalid path ${path}`)
}

/*
 * @synopsis
 * TODO
 */
const pickObject = (props, x) => {
  const y = {}
  for (let i = 0; i < props.length; i++) {
    if (isDefined(x[props[i]])) y[props[i]] = x[props[i]]
  }
  return y
}

/*
 * @synopsis
 * TODO
 */
const pick = props => {
  if (isArray(props)) return x => {
    if (isObject(x)) return pickObject(props, x)
    throw new TypeError('pick(...)(x); x is not an object')
  }
  throw new TypeError('pick(x); x is not an array')
}

/*
 * @synopsis
 * TODO
 */
const omitObject = (props, x) => {
  const y = Object.assign({}, x)
  for (let i = 0; i < props.length; i++) delete y[props[i]]
  return y
}

/*
 * @synopsis
 * TODO
 */
const omit = props => {
  if (isArray(props)) return x => {
    if (isObject(x)) return omitObject(props, x)
    throw new TypeError('omit(...)(x); x is not an object')
  }
  throw new TypeError('omit(x); x is not an array')
}

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * TODO
 */
const anyObject = (fn, x) => anyIterable(
  fn,
  (function* () { for (const k in x) yield x[k] })(),
)

/*
 * @synopsis
 * TODO
 */
const any = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('any(x); x is not a function')
  }
  return x => {
    if (isIterable(x)) return anyIterable(fn, x)
    if (isObject(x)) return anyObject(fn, x)
    throw new TypeError('any(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * TODO
 */
const allObject = (fn, x) => allIterable(
  fn,
  (function* () { for (const k in x) yield x[k] })(),
)

/*
 * @synopsis
 * TODO
 */
const all = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('all(x); x is not a function')
  }
  return x => {
    if (isIterable(x)) return allIterable(fn, x)
    if (isObject(x)) return allObject(fn, x)
    throw new TypeError('all(...)(x); x invalid')
  }
}

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * TODO
 */
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

/*
 * @synopsis
 * TODO
 */
const or = fns => {
  if (!isArray(fns)) {
    throw new TypeError('or(fns); fns is not an array of functions')
  }
  if (fns.length < 1) {
    throw new RangeError('or(fns); fns is not an array of at least one function')
  }
  for (let i = 0; i < fns.length; i++) {
    if (isFunction(fns[i])) continue
    throw new TypeError(`or(fns); fns[${i}] is not a function`)
  }
  return x => arrayOr(fns, x)
}

/*
 * @synopsis
 * TODO
 */
const not = fn => {
  if (!isFunction(fn)) {
    throw new TypeError('not(x); x is not a function')
  }
  return x => possiblePromiseThen(fn(x), res => !res)
}

/*
 * @synopsis
 * TODO
 */
const eq = (f, g) => {
  if (isFunction(f) && isFunction(g)) return x => (
    possiblePromiseAll([f(x), g(x)]).then(([fx, gx]) => fx === gx))
  if (isFunction(f)) return x => possiblePromiseThen(f(x), fx => fx === g)
  if (isFunction(g)) return x => possiblePromiseThen(g(x), gx => f === gx)
  const h = f === g
  return () => h
}

/*
 * @synopsis
 * TODO
 */
const gt = function (f, g) {
  if (isFunction(f) && isFunction(g)) return x => (
    possiblePromiseAll([f(x), g(x)]).then(([fx, gx]) => fx > gx))
  if (isFunction(f)) return x => possiblePromiseThen(f(x), fx => fx > g)
  if (isFunction(g)) return x => possiblePromiseThen(g(x), gx => f > gx)
  const h = f > g
  return () => h
}

/*
 * @synopsis
 * TODO
 */
const lt = function (f, g) {
  if (isFunction(f) && isFunction(g)) return x => (
    possiblePromiseAll([f(x), g(x)]).then(([fx, gx]) => fx < gx))
  if (isFunction(f)) return x => possiblePromiseThen(f(x), fx => fx < g)
  if (isFunction(g)) return x => possiblePromiseThen(g(x), gx => f < gx)
  const h = f < g
  return () => h
}

/*
 * @synopsis
 * TODO
 */
const gte = function (f, g) {
  if (isFunction(f) && isFunction(g)) return x => (
    possiblePromiseAll([f(x), g(x)]).then(([fx, gx]) => fx >= gx))
  if (isFunction(f)) return x => possiblePromiseThen(f(x), fx => fx >= g)
  if (isFunction(g)) return x => possiblePromiseThen(g(x), gx => f >= gx)
  const h = f >= g
  return () => h
}

/*
 * @synopsis
 * TODO
 */
const lte = function (f, g) {
  if (isFunction(f) && isFunction(g)) return x => (
    possiblePromiseAll([f(x), g(x)]).then(([fx, gx]) => fx <= gx))
  if (isFunction(f)) return x => possiblePromiseThen(f(x), fx => fx <= g)
  if (isFunction(g)) return x => possiblePromiseThen(g(x), gx => f <= gx)
  const h = f <= g
  return () => h
}

return {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform, flatMap,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
}

})()))
