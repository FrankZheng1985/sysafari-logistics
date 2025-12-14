/**
 * 模块统一导出
 * 方便在主应用中集成
 */

// 基础数据模块
const masterdataRoutes = require('./masterdata/routes')
const masterdataController = require('./masterdata/controller')
const masterdataModel = require('./masterdata/model')

module.exports = {
  // 路由
  routes: {
    masterdata: masterdataRoutes
  },
  
  // 控制器
  controllers: {
    masterdata: masterdataController
  },
  
  // 模型
  models: {
    masterdata: masterdataModel
  }
}

