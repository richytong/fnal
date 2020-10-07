const MappingIterator = require('./_internal/MappingIterator')
const MappingAsyncIterator = require('./_internal/MappingAsyncIterator')
const isArray = require('./_internal/isArray')
const isObject = require('./_internal/isObject')
const isGeneratorFunction = require('./_internal/isGeneratorFunction')
const isAsyncGeneratorFunction = require('./_internal/isAsyncGeneratorFunction')
const arrayMap = require('./_internal/arrayMap')
const generatorFunctionMap = require('./_internal/generatorFunctionMap')
const asyncGeneratorFunctionMap = require('./_internal/asyncGeneratorFunctionMap')
const reducerMap = require('./_internal/reducerMap')
const stringMap = require('./_internal/stringMap')
const setMap = require('./_internal/setMap')
const mapMap = require('./_internal/mapMap')
const objectMap = require('./_internal/objectMap')
const arrayMapSeries = require('./_internal/arrayMapSeries')
const arrayMapPool = require('./_internal/arrayMapPool')
const arrayMapWithIndex = require('./_internal/arrayMapWithIndex')
const objectMapOwn = require('./_internal/objectMapOwn')
const symbolIterator = require('./_internal/symbolIterator')

/**
 * @name map
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Functor<T> = Array<T>|Object<T>|Set<T>|Map<T>
 *   |Iterator<T>|AsyncIterator<T>|{ map: (T=>any)=>any }
 * Reducer<T> = (any, T)=>Promise|any
 *
 * var T any,
 *   mapper T=>Promise|any,
 *   functor Functor<T>
 *   args ...any,
 *   generatorFunction ...args=>Generator<T>,
 *   asyncGeneratorFunction ...args=>AsyncGenerator<T>,
 *   reducer Reducer<T>
 *
 * map(mapper)(functor) -> Promise|Functor
 *
 * map(mapper)(generatorFunction) -> ...args=>Generator
 *
 * map(mapper)(asyncGeneratorFunction) -> ...args=>AsyncGenerator
 *
 * map(mapper)(reducer) -> Reducer
 * ```
 *
 * @description
 * Apply a mapper concurrently to each item of a functor, returning the results in a functor of the same type. If order is implied by the collection, it is maintained in the result. The following list describes `map` behavior with vanilla JavaScript functors.
 *
 *  * `Array` - apply a mapper to items, returning a new array of results
 *  * `Object` - apply a mapper to object values, returning a new object of results
 *  * `Set` - apply a mapper to Set items, returning a new `Set` of results
 *  * `Map` - apply a mapper to Map values (not entries), returning a new `Map` of results
 *  * `Iterator`/`Generator` - return an iterator that applies a mapper to each iteration's value, yielding mapped iterations
 *  * `AsyncIterator`/`AsyncGenerator` - return an async iterator that applies a mapper to each async iteration's value, yielding Promises of a mapped iterations
 *  * `{ map: function }` - call `.map` directly with mapper
 *
 * ```javascript [playground]
 * const square = number => number ** 2
 *
 * console.log(
 *   map(square)([1, 2, 3, 4, 5]),
 * ) // [1, 4, 9, 16, 25]
 *
 * console.log(
 *   map(square)(new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]])),
 * ) // Map { 'a' => 1, 'b' => 4, 'c' => 9, 'd' => 16, 'e' => 25 }
 *
 * console.log(
 *   map(square)({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
 * ) // { a: 1, b: 4, c: 9, d: 16, e: 25 }
 * ```
 *
 * `map` recognizes three types of functions in functor position:
 *
 *  * Generator Functions `function* () {}` - `map(mapper)(generatorFunction)` creates a generator function that generates generators of mapped values. Async mappers are yielded synchronously and may lead to unexpected results here.
 *  * Async Generator Functions `async function* () {}` - `map(mapper)(asyncGeneratorFunction)` creates an async generator function that generates async generators of mapped values. Promises produced by async mappers are resolved.
 *  * Reducers `(accumulator, item)=>accumulator` - `map(mapper)(reducer)` creates a transducer that, when called with another reducer, creates a mapping step for each item of the reducer's reducing operation. Promises produced by async mappers are resolved.
 *
 * Use mapping generator functions to create lazy computations executed at iteration time.
 *
 * ```javascript [playground]
 * const capitalize = string => string.toUpperCase()
 *
 * const abc = function* () {
 *   yield 'a'; yield 'b'; yield 'c'
 * }
 *
 * const ABC = map(capitalize)(abc)
 *
 * const abcIter = abc()
 *
 * const ABCIter = ABC()
 *
 * console.log([...abcIter]) // ['a', 'b', 'c']
 *
 * console.log([...ABCIter]) // ['A', 'B', 'C']
 * ```
 *
 * Create a mapping transducer by supplying `map` with a reducer. A reducer is a variadic function that depicts a relationship between an accumulator and any number of arguments. A transducer is a function that accepts a reducer as an argument and returns another reducer.
 *
 * ```coffeescript [specscript]
 * Reducer<T> = (any, T)=>Promise|any
 *
 * Transducer = Reducer=>Reducer
 * ```
 *
 * The transducer signature enables chaining functionality for reducers. `map` is core to this mechanism, and provides a way via transducers to transform items of reducers. To `map`, reducers are just another category.
 *
 * ```javascript [playground]
 * const square = number => number ** 2
 *
 * const concat = (array, item) => array.concat(item)
 *
 * const mapSquare = map(square)
 * // mapSquare could potentially be a transducer, but at this point, it is
 * // undifferentiated and not necessarily locked in to transducer behavior.
 *
 * console.log(
 *   mapSquare([1, 2, 3, 4, 5]),
 * ) // [1, 4, 9, 16, 25]
 *
 * const squareConcatReducer = mapSquare(concat)
 * // now mapSquare is passed the function concat, so it assumes transducer
 * // position. squareConcatReducer is a reducer with chained functionality
 * // square and concat.
 *
 * console.log(
 *   [1, 2, 3, 4, 5].reduce(squareConcatReducer, []),
 * ) // [1, 4, 9, 16, 25]
 *
 * console.log(
 *   [1, 2, 3, 4, 5].reduce(squareConcatReducer, ''),
 * ) // '1491625'
 * ```
 *
 * @execution concurrent
 *
 * @transducing
 *
 * @TODO streamMap
 */

const map = mapper => function mapping(value) {
  if (isArray(value)) {
    return arrayMap(value, mapper)
  }
  if (typeof value == 'function') {
    if (isGeneratorFunction(value)) {
      return generatorFunctionMap(value, mapper)
    }
    if (isAsyncGeneratorFunction(value)) {
      return asyncGeneratorFunctionMap(value, mapper)
    }
    return reducerMap(value, mapper)
  }
  if (value == null) {
    return value
  }

  if (typeof value.next == 'function') {
    return symbolIterator in value
      ? MappingIterator(value, mapper)
      : MappingAsyncIterator(value, mapper)
  }
  if (typeof value == 'string' || value.constructor == String) {
    return stringMap(value, mapper)
  }
  if (value.constructor == Set) {
    return setMap(value, mapper)
  }
  if (value.constructor == Map) {
    return mapMap(value, mapper)
  }
  if (value.constructor == Object) {
    return objectMap(value, mapper)
  }
  return typeof value.map == 'function' ? value.map(mapper) : mapper(value)
}

/**
 * @name map.series
 *
 * @synopsis
 * ```coffeescript [specscript]
 * var T any,
 *   mapper T=>Promise|any,
 *   array Array<T>
 *
 * map.series(mapper)(array) -> Promise|Array
 * ```
 *
 * @description
 * `map` with serial execution.
 *
 * ```javascript [playground]
 * const delayedLog = number => new Promise(function (resolve) {
 *   setTimeout(function () {
 *     console.log(number)
 *     resolve()
 *   }, 1000)
 * })
 *
 * console.log('start')
 * map.series(delayedLog)([1, 2, 3, 4, 5])
 * ```
 *
 * @execution series
 */
map.series = mapper => function mappingInSeries(value) {
  if (isArray(value)) {
    return arrayMapSeries(value, mapper)
  }
  throw new TypeError(`${value} is not an Array`)
}

/**
 * @name map.pool
 *
 * @synopsis
 * ```coffeescript [specscript]
 * var maxConcurrency number,
 *   T any,
 *   mapper T=>Promise|any,
 *   array Array<T>
 *
 * map.pool(maxConcurrency, mapper)(array) -> Promise|Array
 * ```
 *
 * @description
 * `map` with limited concurrency.
 *
 * ```javascript [playground]
 * const delayedLog = x => new Promise(function (resolve) {
 *   setTimeout(function () {
 *     console.log(x)
 *     resolve()
 *   }, 1000)
 * })
 *
 * console.log('start')
 * map.pool(2, delayedLog)([1, 2, 3, 4, 5])
 * ```
 *
 * @execution concurrent
 */
map.pool = (concurrencyLimit, mapper) => function concurrentPoolMapping(value) {
  if (isArray(value)) {
    return arrayMapPool(value, mapper, concurrencyLimit)
  }
  throw new TypeError(`${value} is not an Array`)
}

/**
 * @name map.withIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * var T any,
 *   index number,
 *   array Array<T>,
 *   indexedMapper (T, index, array)=>Promise|any
 *
 * map.withIndex(indexedMapper)(array) -> Promise|Array
 * ```
 *
 * @description
 * `map` with an indexed mapper.
 *
 * ```javascript [playground]
 * const range = length => map.withIndex(
 *   (_, index) => index + 1)(Array(length))
 *
 * console.log(range(5)) // [1, 2, 3, 4, 5]
 * ```
 *
 * @execution concurrent
 *
 * @related
 * map, filter.withIndex
 */
map.withIndex = mapper => function mappingWithIndex(value) {
  if (isArray(value)) {
    return arrayMapWithIndex(value, mapper)
  }
  throw new TypeError(`${value} is not an Array`)
}

map.own = mapper => function mappingOwnProperties(value) {
  if (isObject(value) && !isArray(value)) {
    return objectMapOwn(value, mapper)
  }
  throw new TypeError(`${value} is not an Object`)
}

module.exports = map
