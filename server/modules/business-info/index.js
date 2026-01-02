/**
 * 工商信息管理模块
 * 
 * 提供中国企业工商信息查询和管理功能
 * - 集成企查查API进行在线查询
 * - 本地缓存已查询的企业信息
 * - 支持手动添加和维护工商信息
 */

export { default as routes } from './routes.js'
export * as model from './model.js'
export * as qichachaService from './qichachaService.js'
export * as controller from './controller.js'

