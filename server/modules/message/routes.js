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

// ==================== 审批相关 ====================
router.get('/approvals', controller.getApprovals)
router.get('/approvals/pending-count', controller.getPendingApprovalCount)
router.get('/approvals/:id', controller.getApprovalById)
router.post('/approvals', controller.createApproval)
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
