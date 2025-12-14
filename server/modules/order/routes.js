/**
 * 订单管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 提单统计 ====================

// 获取提单统计数据
router.get('/bills/stats', controller.getBillStats)

// ==================== CMR管理 ====================

// 获取CMR管理列表
router.get('/cmr/list', controller.getCMRList)

// ==================== 查验管理 ====================

// 获取查验管理列表
router.get('/inspection/list', controller.getInspectionList)
router.get('/inspections', controller.getInspectionList)

// ==================== 提单CRUD ====================

// 获取提单列表
router.get('/bills', controller.getBills)

// 获取单个提单
router.get('/bills/:id', controller.getBillById)

// 创建提单
router.post('/bills', controller.createBill)

// 更新提单
router.put('/bills/:id', controller.updateBill)

// 作废提单
router.put('/bills/:id/void', controller.voidBill)

// 恢复提单
router.put('/bills/:id/restore', controller.restoreBill)

// 删除提单
router.delete('/bills/:id', controller.deleteBill)

// ==================== 状态更新 ====================

// 更新船运状态
router.put('/bills/:id/ship-status', controller.updateShipStatus)

// 更新换单状态
router.put('/bills/:id/doc-swap-status', controller.updateDocSwapStatus)

// 更新清关状态
router.put('/bills/:id/customs-status', controller.updateCustomsStatus)

// 更新查验状态
router.put('/bills/:id/inspection', controller.updateInspection)

// 更新派送状态
router.put('/bills/:id/delivery', controller.updateDelivery)

// ==================== 操作日志 ====================

// 获取操作日志
router.get('/bills/:id/logs', controller.getOperationLogs)

// ==================== 文件管理 ====================

// 获取提单文件列表
router.get('/bills/:id/files', controller.getBillFiles)

// 删除提单文件
router.delete('/bills/:id/files/:fileId', controller.deleteBillFile)

// ==================== 作废申请 ====================

// 检查提单是否有操作记录或费用
router.get('/bills/:id/void-check', controller.checkBillOperations)

// 提交作废申请
router.post('/bills/:id/void-apply', controller.submitVoidApplication)

// 获取作废申请列表
router.get('/void-applications', controller.getVoidApplications)

// 获取作废申请详情
router.get('/void-applications/:id', controller.getVoidApplicationDetail)

// 审批通过
router.put('/void-applications/:id/approve', controller.approveVoidApplication)

// 审批拒绝
router.put('/void-applications/:id/reject', controller.rejectVoidApplication)

// ==================== 系统配置 ====================

// 获取所有系统配置
router.get('/system-configs', controller.getSystemConfigs)

// 更新系统配置
router.put('/system-configs', controller.updateSystemConfig)

export default router

