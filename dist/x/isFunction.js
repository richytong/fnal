/**
 * rubico v2.1.0
 * https://github.com/a-synchronous/rubico
 * (c) 2019-2023 Richard Tong
 * rubico may be freely distributed under the MIT license.
 */

(function (root, isFunction) {
  if (typeof module == 'object') (module.exports = isFunction) // CommonJS
  else if (typeof define == 'function') define(() => isFunction) // AMD
  else (root.isFunction = isFunction) // Browser
}(typeof globalThis == 'object' ? globalThis : this, (function () { 'use strict'

const isFunction = value => typeof value == 'function'

return isFunction
}())))
