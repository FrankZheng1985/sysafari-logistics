/**
 * 模块统一导出
 * 方便在主应用中集成
 * ES Module 语法
 */

// 基础数据模块
import masterdataRoutes from './masterdata/routes.js'
import * as masterdataController from './masterdata/controller.js'
import * as masterdataModel from './masterdata/model.js'

// 询价模块
import inquiryRoutes from './inquiry/routes.js'
import * as inquiryController from './inquiry/controller.js'
import * as inquiryModel from './inquiry/model.js'

// 路由
export const routes = {
  masterdata: masterdataRoutes,
  inquiry: inquiryRoutes
}

// 控制器
export const controllers = {
  masterdata: masterdataController,
  inquiry: inquiryController
}

// 模型
export const models = {
  masterdata: masterdataModel,
  inquiry: inquiryModel
}

// 默认导出
export default {
  routes,
  controllers,
  models
}

