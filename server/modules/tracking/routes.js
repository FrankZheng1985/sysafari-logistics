/**
 * 物流跟踪模块路由
 */

import { Router } from 'express'
import {
  getBillTracking,
  addManualNode,
  updateTracking,
  deleteTracking,
  batchRefresh,
  getTemplates,
  getStats,
  getTrackingSupplementInfo,
  getApiConfigs,
  getApiConfig,
  createApiConfig,
  updateApiConfig,
  deleteApiConfig,
} from './controller.js'

const router = Router()

// ==================== 跟踪记录 ====================

// 获取提单跟踪记录
router.get('/tracking/bill/:billId', getBillTracking)

// 添加手动跟踪节点
router.post('/tracking/bill/:billId/node', addManualNode)

// 更新跟踪记录
router.put('/tracking/:id', updateTracking)

// 删除跟踪记录
router.delete('/tracking/:id', deleteTracking)

// 批量刷新跟踪状态
router.post('/tracking/batch-refresh', batchRefresh)

// 获取节点模板
router.get('/tracking/templates', getTemplates)

// 获取跟踪统计
router.get('/tracking/stats', getStats)

// 获取补充信息（码头、船名航次等）- 用于创建提单时自动填充
router.get('/tracking/supplement-info', getTrackingSupplementInfo)

// ==================== API配置管理 ====================

// 获取API配置列表
router.get('/tracking/api-configs', getApiConfigs)

// 获取单个API配置
router.get('/tracking/api-configs/:id', getApiConfig)

// 创建API配置
router.post('/tracking/api-configs', createApiConfig)

// 更新API配置
router.put('/tracking/api-configs/:id', updateApiConfig)

// 删除API配置
router.delete('/tracking/api-configs/:id', deleteApiConfig)

export default router
