/**
 * 系统管理模块 - 路由定义
 * 包含用户管理、角色权限、审批流程等
 */

import express from 'express'
import * as controller from './controller.js'
import * as apiIntegrationsController from './apiIntegrationsController.js'
import * as securityController from './securityController.js'
import * as approvalSettingsController from './approvalSettingsController.js'
import { authenticate, authorize, requireRole, requireTeamManager, requireApprover } from '../../middleware/auth.js'

const router = express.Router()

// ==================== 最近活动路由 ====================

// 获取最近活动（用于仪表盘）
router.get('/recent-activities', controller.getRecentActivities)

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

// 修改当前用户密码（支持 POST 和 PUT）- 需要认证
router.post('/auth/change-password', authenticate, (req, res) => {
  // 使用当前登录用户ID
  req.params.id = req.user?.id
  return controller.changePassword(req, res)
})
router.put('/auth/change-password', authenticate, (req, res) => {
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

// 重置用户密码（管理员操作，不需要旧密码）
router.post('/users/:id/reset-password', controller.resetPassword)

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

// 获取COS存储桶使用情况
router.get('/api-integrations/cos/storage', apiIntegrationsController.getCosStorage)

// ==================== 安全管理路由 ====================

// 安全概览（需要管理员权限）
router.get('/security/overview', authenticate, requireRole('admin'), securityController.getSecurityOverview)

// 安全设置
router.post('/security/settings/init', authenticate, requireRole('admin'), securityController.initSecuritySettings)
router.get('/security/settings', authenticate, requireRole('admin'), securityController.getSecuritySettings)
router.put('/security/settings', authenticate, requireRole('admin'), securityController.updateSecuritySettings)

// 审计日志
router.get('/security/audit-logs', authenticate, requireRole('admin'), securityController.getAuditLogs)
router.get('/security/audit-logs/statistics', authenticate, requireRole('admin'), securityController.getAuditStatistics)
router.get('/security/audit-logs/action-types', authenticate, securityController.getAuditActionTypes)

// IP黑名单
router.get('/security/ip-blacklist', authenticate, requireRole('admin'), securityController.getIpBlacklist)
router.post('/security/ip-blacklist', authenticate, requireRole('admin'), securityController.addIpToBlacklist)
router.delete('/security/ip-blacklist/:ipAddress', authenticate, requireRole('admin'), securityController.removeIpFromBlacklist)

// 登录尝试记录
router.get('/security/login-attempts', authenticate, requireRole('admin'), securityController.getLoginAttempts)

// 活动会话
router.get('/security/active-sessions', authenticate, requireRole('admin'), securityController.getActiveSessions)
router.delete('/security/active-sessions/:sessionId', authenticate, requireRole('admin'), securityController.terminateSession)

// 备份管理
router.get('/security/backups', authenticate, requireRole('admin'), securityController.getBackups)
router.post('/security/backups', authenticate, requireRole('admin'), securityController.createBackup)
router.delete('/security/backups/:id', authenticate, requireRole('admin'), securityController.deleteBackup)
router.get('/security/backups/:id/download', authenticate, requireRole('admin'), securityController.getBackupDownloadUrl)
router.get('/security/backups/:id/file', authenticate, requireRole('admin'), securityController.downloadBackupFile)
router.post('/security/backups/:id/restore', authenticate, requireRole('admin'), securityController.restoreBackup)
router.get('/security/restore-records', authenticate, requireRole('admin'), securityController.getRestoreRecords)
router.get('/security/backup-settings', authenticate, requireRole('admin'), securityController.getBackupSettings)
router.put('/security/backup-settings', authenticate, requireRole('admin'), securityController.updateBackupSettings)

// ==================== 审批管理路由 ====================

// 获取审批列表（全部）
router.get('/approvals', authenticate, controller.getApprovals)

// 获取待审批列表（审批人视角）
router.get('/approvals/pending', authenticate, controller.getPendingApprovals)

// 获取待审批数量
router.get('/approvals/pending/count', authenticate, controller.getPendingApprovalCount)

// 获取我的申请
router.get('/approvals/my', authenticate, controller.getMyApprovals)

// 获取审批详情
router.get('/approvals/:id', authenticate, controller.getApprovalById)

// 创建审批请求
router.post('/approvals', authenticate, controller.createApprovalRequest)

// 审批通过
router.post('/approvals/:id/approve', authenticate, requireApprover, controller.approveRequest)

// 审批拒绝
router.post('/approvals/:id/reject', authenticate, requireApprover, controller.rejectRequest)

// 取消审批请求
router.post('/approvals/:id/cancel', authenticate, controller.cancelApprovalRequest)

// 获取审批通知
router.get('/approval-notifications', authenticate, controller.getApprovalNotifications)

// 标记通知已读
router.put('/approval-notifications/:id/read', authenticate, controller.markNotificationRead)

// ==================== 团队管理路由 ====================

// 获取团队成员
router.get('/team/members', authenticate, requireTeamManager, controller.getTeamMembersList)

// 获取可授予的权限列表
router.get('/team/grantable-permissions', authenticate, requireTeamManager, controller.getGrantablePermissionsList)

// 检查操作是否需要审批
router.post('/team/check-approval', authenticate, controller.checkApprovalRequired)

// 获取可选择的上级列表
router.get('/supervisors', authenticate, controller.getSupervisorCandidates)

// ==================== 翻译服务路由 ====================

// 翻译文本（中文 -> 英文）
router.post('/translate', controller.translateText)

// ==================== 审批权限设置路由 ====================

// 获取所有审批触发点
router.get('/approval-settings/triggers', authenticate, approvalSettingsController.getApprovalTriggers)

// 更新触发点配置
router.put('/approval-settings/triggers/:id', authenticate, requireRole(['admin', 'boss']), approvalSettingsController.updateApprovalTrigger)

// 切换触发点启用状态
router.put('/approval-settings/triggers/:id/toggle', authenticate, requireRole(['admin', 'boss']), approvalSettingsController.toggleApprovalTrigger)

// 获取业务模块列表（用于申请新触发点）
router.get('/approval-settings/business-modules', authenticate, approvalSettingsController.getBusinessModules)

// 提交新触发点申请
router.post('/approval-settings/trigger-requests', authenticate, approvalSettingsController.createTriggerRequest)

// 获取触发点申请列表
router.get('/approval-settings/trigger-requests', authenticate, approvalSettingsController.getTriggerRequests)

// 更新触发点申请状态（开发人员操作）
router.put('/approval-settings/trigger-requests/:id/status', authenticate, requireRole(['admin', 'boss']), approvalSettingsController.updateTriggerRequestStatus)

// 获取审批全局配置
router.get('/approval-settings/configs', authenticate, approvalSettingsController.getApprovalConfigs)

// 更新审批全局配置
router.put('/approval-settings/configs', authenticate, requireRole(['admin', 'boss']), approvalSettingsController.updateApprovalConfigs)

export default router

