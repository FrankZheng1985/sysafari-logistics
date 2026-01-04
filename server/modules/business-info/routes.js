/**
 * 工商信息管理 - 路由配置
 */

import { Router } from 'express'
import * as controller from './controller.js'

const router = Router()

// ==================== 企查查API查询 ====================

// 搜索企业（支持企查查API + 本地缓存）
router.get('/search', controller.searchCompany)

// 获取企业详情
router.get('/detail', controller.getCompanyDetail)

// 获取API配置状态和统计
router.get('/config-status', controller.getConfigStatus)

// 获取统计信息
router.get('/stats', controller.getStats)

// ==================== 本地工商信息库管理 ====================

// 获取工商信息列表
router.get('/', controller.getList)

// 获取单条工商信息
router.get('/:id', controller.getById)

// 手动添加工商信息
router.post('/', controller.create)

// 更新工商信息
router.put('/:id', controller.update)

// 删除工商信息
router.delete('/:id', controller.remove)

// 关联工商信息到客户
router.post('/:id/link-customer', controller.linkToCustomer)

export default router

