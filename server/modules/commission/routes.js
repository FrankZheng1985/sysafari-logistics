/**
 * 业务员提成模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 提成规则管理 ====================

// 获取规则列表
router.get('/rules', controller.getRules)

// 获取规则详情
router.get('/rules/:id', controller.getRuleById)

// 创建规则
router.post('/rules', controller.createRule)

// 更新规则
router.put('/rules/:id', controller.updateRule)

// 删除规则
router.delete('/rules/:id', controller.deleteRule)

// ==================== 惩罚规则管理 ====================

// 获取惩罚规则列表
router.get('/penalty-rules', controller.getPenaltyRules)

// 获取惩罚规则详情
router.get('/penalty-rules/:id', controller.getPenaltyRuleById)

// 创建惩罚规则
router.post('/penalty-rules', controller.createPenaltyRule)

// 更新惩罚规则
router.put('/penalty-rules/:id', controller.updatePenaltyRule)

// 删除惩罚规则
router.delete('/penalty-rules/:id', controller.deletePenaltyRule)

// ==================== 惩罚记录管理 ====================

// 获取惩罚记录列表
router.get('/penalty-records', controller.getPenaltyRecords)

// 创建惩罚记录
router.post('/penalty-records', controller.createPenaltyRecord)

// 更新惩罚记录状态
router.put('/penalty-records/:id/status', controller.updatePenaltyRecordStatus)

// 取消惩罚记录
router.delete('/penalty-records/:id', controller.deletePenaltyRecord)

// ==================== 方案配置 ====================

// 获取方案配置
router.get('/scheme-config', controller.getSchemeConfig)

// ==================== 提成记录管理 ====================

// 获取提成记录列表
router.get('/records', controller.getRecords)

// 获取记录详情
router.get('/records/:id', controller.getRecordById)

// 手动计算提成
router.post('/calculate', controller.calculateCommission)

// 取消提成记录
router.put('/records/:id/cancel', controller.cancelRecord)

// ==================== 结算管理 ====================

// 获取结算单列表
router.get('/settlements', controller.getSettlements)

// 获取结算单汇总统计
router.get('/settlements/summary', controller.getSettlementsSummary)

// 获取结算单详情
router.get('/settlements/:id', controller.getSettlementById)

// 导出结算单PDF
router.get('/settlements/:id/export', controller.exportSettlement)

// 生成月度结算单（单个业务员）
router.post('/settlements/generate', controller.generateSettlement)

// 自动批量生成结算单（所有业务员）
router.post('/settlements/auto-generate', controller.autoGenerateSettlements)

// 批量提交审批
router.put('/settlements/batch-submit', controller.batchSubmitSettlements)

// 提交审批
router.put('/settlements/:id/submit', controller.submitSettlement)

// 审批通过（自动生成财务凭证）
router.put('/settlements/:id/approve', controller.approveSettlement)

// 驳回
router.put('/settlements/:id/reject', controller.rejectSettlement)

// 标记已发放（更新财务凭证状态）
router.put('/settlements/:id/paid', controller.markSettlementPaid)

// ==================== 统计分析 ====================

// 获取提成统计
router.get('/stats', controller.getStats)

// 获取业务员排行
router.get('/ranking', controller.getSalespersonRanking)

export default router
