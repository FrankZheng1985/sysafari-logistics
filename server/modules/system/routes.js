/**
 * 系统管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'
import * as apiIntegrationsController from './apiIntegrationsController.js'
import { authenticate } from '../../middleware/auth.js'

const router = express.Router()

// ==================== 认证相关路由 ====================

// 用户登录（传统方式，保留兼容）
router.post('/auth/login', controller.login)

// 获取当前用户信息
router.get('/auth/me', controller.getCurrentUser)

// Auth0 用户信息（需要认证）
router.get('/auth/profile', authenticate, controller.getAuth0Profile)

// Auth0 用户绑定管理（需要认证）
router.get('/auth/pending-users', authenticate, controller.getPendingAuth0Users)
router.post('/auth/bind-user', authenticate, controller.bindAuth0User)
router.post('/auth/create-and-bind', authenticate, controller.createAndBindUser)

// 修改当前用户密码
router.put('/auth/change-password', (req, res) => {
  // 使用当前登录用户ID
  req.params.id = req.user?.id
  return controller.changePassword(req, res)
})

// ==================== 用户管理路由 ====================

// 获取用户列表
router.get('/users', controller.getUsers)

// 获取单个用户
router.get('/users/:id', controller.getUserById)

// 创建用户
router.post('/users', controller.createUser)

// 更新用户
router.put('/users/:id', controller.updateUser)

// 更新用户状态
router.put('/users/:id/status', controller.updateUserStatus)

// 修改用户密码（管理员操作）
router.put('/users/:id/password', controller.changePassword)

// 删除用户
router.delete('/users/:id', controller.deleteUser)

// ==================== 角色管理路由 ====================

// 获取角色列表
router.get('/roles', controller.getRoles)

// 获取单个角色
router.get('/roles/:roleCode', controller.getRoleByCode)

// 创建角色
router.post('/roles', controller.createRole)

// 更新角色
router.put('/roles/:roleCode', controller.updateRole)

// 删除角色
router.delete('/roles/:roleCode', controller.deleteRole)

// 获取角色权限
router.get('/roles/:roleCode/permissions', controller.getRolePermissions)

// 更新角色权限
router.put('/roles/:roleCode/permissions', controller.updateRolePermissions)

// ==================== 权限管理路由 ====================

// 获取所有权限
router.get('/permissions', controller.getPermissions)

// ==================== 系统设置路由 ====================

// 获取系统设置
router.get('/system/settings', controller.getSystemSettings)

// 更新系统设置
router.put('/system/settings', controller.updateSystemSettings)

// 兼容旧API：获取系统设置（支持key参数）
router.get('/system-settings', controller.getSystemSettingsByKey)

// 兼容旧API：保存系统设置
router.post('/system-settings', controller.saveSystemSetting)

// 兼容旧API：批量保存系统设置
router.post('/system-settings/batch', controller.saveSystemSettingsBatch)

// 获取安全设置
router.get('/system/settings/security', controller.getSecuritySettings)

// 更新安全设置
router.put('/system/settings/security', controller.updateSecuritySettings)

// ==================== 登录日志路由 ====================

// 获取登录日志
router.get('/system/login-logs', controller.getLoginLogs)

// ==================== API对接管理路由 ====================

// 获取API服务列表
router.get('/api-integrations', apiIntegrationsController.getApiIntegrations)

// 获取分类列表
router.get('/api-integrations/categories', apiIntegrationsController.getCategories)

// 批量健康检查
router.post('/api-integrations/health-check-all', apiIntegrationsController.healthCheckAll)

// 批量同步数据（余额、用量）
router.post('/api-integrations/sync-all', apiIntegrationsController.syncAllApiData)

// 获取单个API详情
router.get('/api-integrations/:code', apiIntegrationsController.getApiByCode)

// 更新API配置
router.put('/api-integrations/:code', apiIntegrationsController.updateApi)

// 添加新API
router.post('/api-integrations', apiIntegrationsController.createApi)

// 删除API
router.delete('/api-integrations/:code', apiIntegrationsController.deleteApi)

// 单个API健康检查
router.post('/api-integrations/:code/health-check', apiIntegrationsController.healthCheck)

// 单个API数据同步（余额、用量）
router.post('/api-integrations/:code/sync-data', apiIntegrationsController.syncApiData)

// 获取用量历史
router.get('/api-integrations/:code/usage', apiIntegrationsController.getUsageHistory)

// 同步用量数据（手动录入）
router.post('/api-integrations/:code/sync', apiIntegrationsController.syncUsage)

// 记录充值
router.post('/api-integrations/:code/recharge', apiIntegrationsController.recordRecharge)

// 获取充值记录
router.get('/api-integrations/:code/recharge-history', apiIntegrationsController.getRechargeHistory)

export default router

