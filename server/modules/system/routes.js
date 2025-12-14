/**
 * 系统管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 认证相关路由 ====================

// 用户登录（传统方式，保留兼容）
router.post('/auth/login', controller.login)

// 获取当前用户信息
router.get('/auth/me', controller.getCurrentUser)

// Auth0 用户信息（新增）
router.get('/auth/profile', controller.getAuth0Profile)

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

export default router

