/**
 * 中间件统一导出
 */

const auth = require('./auth')
const logger = require('./logger')
const errorHandler = require('./errorHandler')

module.exports = {
  ...auth,
  ...logger,
  ...errorHandler
}

