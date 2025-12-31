/**
 * 清关合同模板 - 路由配置
 */

import { Router } from 'express'
import * as controller from './controller.js'
import { generateContractPdf, getContractPdf } from './pdf-generator.js'

const router = Router()

// =====================================================
// 模板配置路由
// =====================================================

// 获取所有模板配置
router.get('/config', controller.getTemplateConfig)

// 更新模板配置（批量）
router.put('/config', controller.updateTemplateConfig)

// =====================================================
// 赔偿标准路由
// =====================================================

// 获取赔偿标准列表
router.get('/compensation', controller.getCompensationRules)

// 创建赔偿标准
router.post('/compensation', controller.createCompensationRule)

// 更新赔偿标准
router.put('/compensation/:id', controller.updateCompensationRule)

// 删除赔偿标准
router.delete('/compensation/:id', controller.deleteCompensationRule)

// =====================================================
// 保险配置路由
// =====================================================

// 获取保险配置
router.get('/insurance', controller.getInsuranceConfig)

// 更新保险配置（批量）
router.put('/insurance', controller.updateInsuranceConfig)

// 更新单个保险配置
router.put('/insurance/:id', controller.updateInsuranceConfig)

// =====================================================
// 高峰期路由
// =====================================================

// 获取高峰期列表
router.get('/peak-seasons', controller.getPeakSeasons)

// 创建高峰期
router.post('/peak-seasons', controller.createPeakSeason)

// 更新高峰期
router.put('/peak-seasons/:id', controller.updatePeakSeason)

// 删除高峰期
router.delete('/peak-seasons/:id', controller.deletePeakSeason)

// =====================================================
// 合同路由
// =====================================================

// 获取合同统计
router.get('/contracts/stats', controller.getContractStats)

// 获取合同列表
router.get('/contracts', controller.getContracts)

// 获取合同详情
router.get('/contracts/:id', controller.getContract)

// 创建合同
router.post('/contracts', controller.createContract)

// 更新合同
router.put('/contracts/:id', controller.updateContract)

// 删除合同
router.delete('/contracts/:id', controller.deleteContract)

// 提交审批
router.put('/contracts/:id/submit', controller.submitContract)

// 审批通过
router.put('/contracts/:id/approve', controller.approveContract)

// 审批驳回
router.put('/contracts/:id/reject', controller.rejectContract)

// 生成PDF
router.post('/contracts/:id/pdf', generateContractPdf)

// 获取PDF
router.get('/contracts/:id/pdf', getContractPdf)

export default router
