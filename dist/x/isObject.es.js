/**
 * rubico v1.8.12
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2021 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

const isObject = value => {
  if (value == null) {
    return false
  }

  const typeofValue = typeof value
  return (typeofValue == 'object') || (typeofValue == 'function')
}

export default isObject
