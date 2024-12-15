const isPromise = require('./isPromise')
const promiseRace = require('./promiseRace')
const promiseAll = require('./promiseAll')
const symbolIterator = require('./symbolIterator')

/**
 * @name _setMapPoolAsync
 *
 * @synopsis
 * ```coffeescript [specscript]
 * _setMapPoolAsync(
 *   s Set,
 *   iterator Iterator,
 *   concurrency number,
 *   f function,
 *   result Set,
 *   promises Set,
 * ) -> result Promise<Set>
 * ```
 */
const _setMapPoolAsync = async function (
  s, iterator, concurrency, f, result, promises,
) {
  let iteration = iterator.next()
  while (!iteration.done) {
    if (promises.size >= concurrency) {
      await promiseRace(promises)
    }
    const resultItem = f(iteration.value, iteration.value, s)
    if (isPromise(resultItem)) {
      const selfDeletingPromise = resultItem.then(resolvedValue => {
        promises.delete(selfDeletingPromise)
        result.add(resolvedValue)
      })
      promises.add(selfDeletingPromise)
    } else {
      result.add(resultItem)
    }
    iteration = iterator.next()
  }
  if (promises.size > 0) {
    await promiseAll(promises)
  }
  return result
}

/**
 * @name setMapPool
 *
 * @synopsis
 * ```coffeescript [specscript]
 * setMapPool(s Set, concurrency number, f function) -> Promise|Set
 * ```
 *
 * @description
 * Apply a function `f` with limited concurrency to each item of a set `s`, returning an array of results.
 */
const setMapPool = function (s, concurrency, f) {
  const result = new Set()
  const iterator = s[symbolIterator]()
  let iteration = iterator.next()
  while (!iteration.done) {
    const resultItem = f(iteration.value, iteration.value, s)
    if (isPromise(resultItem)) {
      const promises = new Set()
      const selfDeletingPromise = resultItem.then(resolvedValue => {
        promises.delete(selfDeletingPromise)
        result.add(resolvedValue)
      })
      promises.add(selfDeletingPromise)
      return _setMapPoolAsync(s, iterator, concurrency, f, result, promises)
    }
    result.add(resultItem)
    iteration = iterator.next()
  }
  return result
}

module.exports = setMapPool