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
  // 爬虫追踪
  scrapeContainer,
  scrapeBill,
  smartTrackApi,
  getCarriers,
  clearCache,
  getCacheStatsApi,
} from './controller.js'

const router = Router()

// ==================== 跟踪记录 ====================

// 获取提单跟踪记录
router.get('/bill/:billId', getBillTracking)

// 添加手动跟踪节点
router.post('/bill/:billId/node', addManualNode)

// 更新跟踪记录
router.put('/:id', updateTracking)

// 删除跟踪记录
router.delete('/:id', deleteTracking)

// 批量刷新跟踪状态
router.post('/batch-refresh', batchRefresh)

// 获取节点模板
router.get('/templates', getTemplates)

// 获取跟踪统计
router.get('/stats', getStats)

// 获取补充信息（码头、船名航次等）- 用于创建提单时自动填充
router.get('/supplement-info', getTrackingSupplementInfo)

// ==================== API配置管理 ====================

// 获取API配置列表
router.get('/api-configs', getApiConfigs)

// 获取单个API配置
router.get('/api-configs/:id', getApiConfig)

// 创建API配置
router.post('/api-configs', createApiConfig)

// 更新API配置
router.put('/api-configs/:id', updateApiConfig)

// 删除API配置
router.delete('/api-configs/:id', deleteApiConfig)

// ==================== 爬虫追踪（免费，无需API Key）====================

// 智能追踪（自动判断是集装箱号还是提单号）
router.get('/scrape', smartTrackApi)

// 按集装箱号追踪
router.get('/scrape/container', scrapeContainer)

// 按提单号追踪
router.get('/scrape/bill', scrapeBill)

// 获取支持的船公司列表
router.get('/scrape/carriers', getCarriers)

// 爬虫缓存管理
router.get('/scrape/cache/stats', getCacheStatsApi)
router.delete('/scrape/cache', clearCache)

export default router
