/**
 * 最后里程模块 - 路由配置
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 承运商管理 ====================

// 获取承运商列表
router.get('/carriers', controller.getCarriers)

// 获取承运商详情
router.get('/carriers/:id', controller.getCarrierById)

// 创建承运商
router.post('/carriers', controller.createCarrier)

// 更新承运商
router.put('/carriers/:id', controller.updateCarrier)

// 删除承运商
router.delete('/carriers/:id', controller.deleteCarrier)

// ==================== Zone配置管理 ====================

// 获取承运商的Zone列表
router.get('/carriers/:carrierId/zones', controller.getZones)

// 创建Zone
router.post('/carriers/:carrierId/zones', controller.createZone)

// 批量创建Zone
router.post('/carriers/:carrierId/zones/batch', controller.batchCreateZones)

// 更新Zone
router.put('/zones/:id', controller.updateZone)

// 删除Zone
router.delete('/zones/:id', controller.deleteZone)

// ==================== 费率卡管理 ====================

// 获取费率卡列表
router.get('/rate-cards', controller.getRateCards)

// 获取费率卡详情
router.get('/rate-cards/:id', controller.getRateCardById)

// 创建费率卡
router.post('/rate-cards', controller.createRateCard)

// 更新费率卡
router.put('/rate-cards/:id', controller.updateRateCard)

// 删除费率卡
router.delete('/rate-cards/:id', controller.deleteRateCard)

// ==================== 费率明细管理 ====================

// 批量创建费率明细
router.post('/rate-cards/:rateCardId/tiers/batch', controller.batchCreateRateTiers)

// 更新费率明细
router.put('/tiers/:id', controller.updateRateTier)

// 删除费率明细
router.delete('/tiers/:id', controller.deleteRateTier)

// ==================== 附加费管理 ====================

// 创建附加费
router.post('/rate-cards/:rateCardId/surcharges', controller.createSurcharge)

// 更新附加费
router.put('/surcharges/:id', controller.updateSurcharge)

// 删除附加费
router.delete('/surcharges/:id', controller.deleteSurcharge)

// ==================== 运单管理 ====================

// 获取运单列表
router.get('/shipments', controller.getShipments)

// 获取运单详情
router.get('/shipments/:id', controller.getShipmentById)

// 创建运单
router.post('/shipments', controller.createShipment)

// 更新运单
router.put('/shipments/:id', controller.updateShipment)

// 删除运单
router.delete('/shipments/:id', controller.deleteShipment)

// 获取运单轨迹
router.get('/shipments/:id/tracking', controller.getShipmentTracking)

// 同步运单轨迹（从承运商API）
router.post('/shipments/:id/sync-tracking', controller.syncShipmentTracking)

// 重新获取面单
router.post('/shipments/:id/refresh-label', controller.refreshShipmentLabel)

// 取消运单（调用承运商API）
router.post('/shipments/:id/cancel', controller.cancelShipmentAPI)

// 创建运单并调用承运商API打单
router.post('/shipments/book', controller.createAndBookShipment)

// ==================== 费用计算 ====================

// 计算运费
router.post('/calculate', controller.calculateFreight)

// 多承运商比价
router.post('/compare-quotes', controller.compareCarrierQuotes)

// 快速报价
router.get('/quick-quote', controller.quickQuote)

// 根据邮编匹配Zone
router.get('/match-zone', controller.matchZone)

export default router
