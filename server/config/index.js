/**
 * 配置统一导出
 */

const database = require('./database')
const constants = require('./constants')

module.exports = {
  ...database,
  ...constants
}

