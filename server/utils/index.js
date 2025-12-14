/**
 * 工具函数统一导出
 */

const response = require('./response')
const sequence = require('./sequence')
const validator = require('./validator')

module.exports = {
  ...response,
  ...sequence,
  ...validator
}

