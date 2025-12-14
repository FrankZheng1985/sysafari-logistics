/**
 * 供应商管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 供应商管理路由 ====================

// 获取供应商统计
router.get('/suppliers/stats', controller.getSupplierStats)

// 获取启用的供应商列表（下拉选择用）
router.get('/suppliers/active', controller.getActiveSuppliers)

// 生成供应商编码
router.get('/suppliers/generate-code', controller.generateSupplierCode)

// 获取供应商列表
router.get('/suppliers', controller.getSupplierList)

// 获取单个供应商
router.get('/suppliers/:id', controller.getSupplierById)

// 创建供应商
router.post('/suppliers', controller.createSupplier)

// 批量删除供应商
router.post('/suppliers/batch-delete', controller.batchDeleteSuppliers)

// 更新供应商
router.put('/suppliers/:id', controller.updateSupplier)

// 更新供应商状态
router.patch('/suppliers/:id/status', controller.updateSupplierStatus)

// 删除供应商
router.delete('/suppliers/:id', controller.deleteSupplier)

export default router
