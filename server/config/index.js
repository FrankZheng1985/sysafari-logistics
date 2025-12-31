/**
 * 配置统一导出
 * ES Module 语法
 */

import * as database from './database.js'
import * as constants from './constants.js'

// 重新导出所有配置
export * from './database.js'
export * from './constants.js'

// 默认导出
export default {
  ...database,
  ...constants
}

