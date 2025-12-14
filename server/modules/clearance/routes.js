/**
 * 清关单证模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 单证类型路由 ====================

// 获取单证类型列表
router.get('/clearance/document-types', controller.getDocumentTypes)

// ==================== 清关单证管理路由 ====================

// 获取清关单证统计
router.get('/clearance/stats', controller.getClearanceStats)

// 获取清关单证列表
router.get('/clearance/documents', controller.getClearanceDocuments)

// 获取订单的清关单证
router.get('/clearance/bills/:billId/documents', controller.getClearanceDocumentsByBill)

// 获取清关单证详情
router.get('/clearance/documents/:id', controller.getClearanceDocumentById)

// 创建清关单证
router.post('/clearance/documents', controller.createClearanceDocument)

// 更新清关单证
router.put('/clearance/documents/:id', controller.updateClearanceDocument)

// 删除清关单证
router.delete('/clearance/documents/:id', controller.deleteClearanceDocument)

// 审核清关单证
router.put('/clearance/documents/:id/review', controller.reviewClearanceDocument)

// 更新清关单证状态
router.put('/clearance/documents/:id/status', controller.updateClearanceDocumentStatus)

export default router

