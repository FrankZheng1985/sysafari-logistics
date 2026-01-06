/**
 * 消息模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 消息相关 ====================
router.get('/messages', controller.getMessages)
router.get('/messages/unread-count', controller.getUnreadCount)
router.get('/messages/recent', controller.getRecentMessages)
router.get('/messages/:id', controller.getMessageById)
router.post('/messages', controller.createMessage)
router.post('/messages/batch', controller.createMessages)
router.put('/messages/:id/read', controller.markAsRead)
router.post('/messages/mark-read', controller.markMultipleAsRead)
router.post('/messages/mark-all-read', controller.markAllAsRead)
router.delete('/messages/:id', controller.deleteMessage)

// ==================== 审批相关（已弃用，请使用统一审批 API）====================
// ⚠️ 以下路由已弃用，保留仅为向后兼容
// 新系统请使用: /api/unified-approvals/* 或 /api/system/unified-approvals/*
// 
// @deprecated 请使用 GET /api/unified-approvals
router.get('/approvals', controller.getApprovals)
// @deprecated 请使用 GET /api/unified-approvals/pending-count  
router.get('/approvals/pending-count', controller.getPendingApprovalCount)
// @deprecated 请使用 GET /api/unified-approvals/:id
router.get('/approvals/:id', controller.getApprovalById)
// @deprecated 请使用 unifiedApprovalService.createApproval()
router.post('/approvals', controller.createApproval)
// @deprecated 请使用 POST /api/unified-approvals/:id/approve 或 /reject
router.put('/approvals/:id/process', controller.processApproval)

// ==================== 预警相关 ====================
router.get('/alerts/rules', controller.getAlertRules)
router.put('/alerts/rules/:id', controller.updateAlertRule)
router.get('/alerts/logs', controller.getAlertLogs)
router.get('/alerts/active-count', controller.getActiveAlertCount)
router.get('/alerts/stats', controller.getAlertStats)
router.put('/alerts/logs/:id/handle', controller.handleAlert)
router.put('/alerts/logs/:id/ignore', controller.ignoreAlert)

// ==================== 综合 ====================
router.get('/notifications/overview', controller.getNotificationOverview)

export default router
