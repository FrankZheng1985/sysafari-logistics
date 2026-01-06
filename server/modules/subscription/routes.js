/**
 * 服务订阅管理 - 路由
 */

import { Router } from 'express'
import { authenticate, requireRole } from '../../middleware/auth.js'
import * as controller from './controller.js'

const router = Router()

// 所有路由都需要认证
router.use(authenticate)

// 获取统计数据
router.get('/statistics', controller.getStatistics)

// 获取即将到期的订阅
router.get('/expiring', controller.getExpiringSubscriptions)

// 检查 SSL 证书
router.get('/check-ssl', controller.checkSslCertificate)

// 检查并更新所有状态（需要管理员权限）
router.post('/check-status', requireRole(['admin', 'boss']), controller.checkAndUpdateStatus)

// 获取订阅列表
router.get('/', controller.getSubscriptions)

// 获取单个订阅详情
router.get('/:id', controller.getSubscriptionById)

// 获取操作日志
router.get('/:id/logs', controller.getLogs)

// 创建订阅（需要管理员权限）
router.post('/', requireRole(['admin', 'boss']), controller.createSubscription)

// 更新订阅（需要管理员权限）
router.put('/:id', requireRole(['admin', 'boss']), controller.updateSubscription)

// 续期订阅（需要管理员权限）
router.post('/:id/renew', requireRole(['admin', 'boss']), controller.renewSubscription)

// 删除订阅（需要管理员权限）
router.delete('/:id', requireRole(['admin']), controller.deleteSubscription)

export default router

