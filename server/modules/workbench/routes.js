/**
 * 工作台模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = express.Router()

// 所有接口都需要认证
router.use(authenticate)

// ==================== 工作台配置 ====================
// 获取用户工作台配置
router.get('/workbench/config', controller.getWorkbenchConfig)

// 保存用户工作台配置
router.post('/workbench/config', controller.saveWorkbenchConfig)

// ==================== 工作台数据 ====================
// 获取待办任务
router.get('/workbench/pending-tasks', controller.getPendingTasks)

// 获取滞留订单预警
router.get('/workbench/stagnant-orders', controller.getStagnantOrders)

// 获取最近动态
router.get('/workbench/recent-activity', controller.getRecentActivity)

// 获取团队概览
router.get('/workbench/team-overview', controller.getTeamOverview)

// 获取公司概览
router.get('/workbench/company-overview', controller.getCompanyOverview)

// 获取日程安排
router.get('/workbench/schedule', controller.getSchedule)

// 获取订单统计
router.get('/workbench/order-stats', controller.getOrderStats)

export default router
