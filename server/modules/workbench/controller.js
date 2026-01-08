/**
 * 工作台模块 - 控制器
 */

import * as model from './model.js'
import { success as sendSuccess, error as sendError, serverError as sendServerError } from '../../utils/response.js'

/**
 * 获取用户工作台配置
 */
export async function getWorkbenchConfig(req, res) {
  try {
    const userId = req.user.userId
    const config = await model.getWorkbenchConfig(userId)
    
    if (config) {
      sendSuccess(res, config)
    } else {
      // 返回空，前端会使用默认配置
      sendSuccess(res, null)
    }
  } catch (error) {
    console.error('获取工作台配置失败:', error)
    sendServerError(res, '获取工作台配置失败')
  }
}

/**
 * 保存用户工作台配置
 */
export async function saveWorkbenchConfig(req, res) {
  try {
    const userId = req.user.userId
    const { cardOrder, hiddenCards } = req.body

    if (!Array.isArray(cardOrder) || !Array.isArray(hiddenCards)) {
      return sendError(res, '配置数据格式错误')
    }

    await model.saveWorkbenchConfig(userId, cardOrder, hiddenCards)
    sendSuccess(res, { message: '配置保存成功' })
  } catch (error) {
    console.error('保存工作台配置失败:', error)
    sendServerError(res, '保存工作台配置失败')
  }
}

/**
 * 获取待办任务
 */
export async function getPendingTasks(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const tasks = await model.getPendingTasks(userId, role)
    sendSuccess(res, tasks)
  } catch (error) {
    console.error('获取待办任务失败:', error)
    sendServerError(res, '获取待办任务失败')
  }
}

/**
 * 获取滞留订单预警
 */
export async function getStagnantOrders(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const orders = await model.getStagnantOrders(userId, role)
    sendSuccess(res, orders)
  } catch (error) {
    console.error('获取滞留订单失败:', error)
    sendServerError(res, '获取滞留订单失败')
  }
}

/**
 * 获取最近动态
 */
export async function getRecentActivity(req, res) {
  try {
    const userId = req.user.userId
    const limit = parseInt(req.query.limit) || 10
    
    const activities = await model.getRecentActivity(userId, limit)
    sendSuccess(res, activities)
  } catch (error) {
    console.error('获取最近动态失败:', error)
    sendServerError(res, '获取最近动态失败')
  }
}

/**
 * 获取团队概览
 */
export async function getTeamOverview(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    // 只有管理员和经理可以查看团队概览
    if (!['admin', 'boss', 'manager', 'finance_director'].includes(role)) {
      return sendError(res, '无权限查看团队概览', 403)
    }
    
    const teamData = await model.getTeamOverview(userId)
    sendSuccess(res, teamData)
  } catch (error) {
    console.error('获取团队概览失败:', error)
    sendServerError(res, '获取团队概览失败')
  }
}

/**
 * 获取公司概览
 */
export async function getCompanyOverview(req, res) {
  try {
    const role = req.user.role
    
    // 只有老板和管理员可以查看公司概览
    if (!['admin', 'boss'].includes(role)) {
      return sendError(res, '无权限查看公司概览', 403)
    }
    
    const companyData = await model.getCompanyOverview()
    sendSuccess(res, companyData)
  } catch (error) {
    console.error('获取公司概览失败:', error)
    sendServerError(res, '获取公司概览失败')
  }
}

/**
 * 获取日程安排
 */
export async function getSchedule(req, res) {
  try {
    const userId = req.user.userId
    const date = req.query.date
    
    const schedules = await model.getSchedule(userId, date)
    sendSuccess(res, schedules)
  } catch (error) {
    console.error('获取日程失败:', error)
    sendServerError(res, '获取日程失败')
  }
}

/**
 * 获取订单统计
 */
export async function getOrderStats(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const stats = await model.getOrderStats(userId, role)
    sendSuccess(res, stats)
  } catch (error) {
    console.error('获取订单统计失败:', error)
    sendServerError(res, '获取订单统计失败')
  }
}

/**
 * 获取TMS运输统计
 */
export async function getTmsStats(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const stats = await model.getTmsStats(userId, role)
    sendSuccess(res, stats)
  } catch (error) {
    console.error('获取TMS统计失败:', error)
    sendServerError(res, '获取TMS统计失败')
  }
}

/**
 * 获取财务统计
 */
export async function getFinanceStats(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const stats = await model.getFinanceStats(userId, role)
    sendSuccess(res, stats)
  } catch (error) {
    console.error('获取财务统计失败:', error)
    sendServerError(res, '获取财务统计失败')
  }
}

/**
 * 获取查验统计
 */
export async function getInspectionStats(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const stats = await model.getInspectionStats(userId, role)
    sendSuccess(res, stats)
  } catch (error) {
    console.error('获取查验统计失败:', error)
    sendServerError(res, '获取查验统计失败')
  }
}

/**
 * 获取单证统计
 */
export async function getDocumentStats(req, res) {
  try {
    const userId = req.user.userId
    const role = req.user.role
    
    const stats = await model.getDocumentStats(userId, role)
    sendSuccess(res, stats)
  } catch (error) {
    console.error('获取单证统计失败:', error)
    sendServerError(res, '获取单证统计失败')
  }
}
