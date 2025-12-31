/**
 * 安全审计日志服务
 * 
 * 用于记录系统中的敏感操作，支持：
 * - 登录/登出事件
 * - 用户管理操作
 * - 权限变更
 * - 数据导出
 * - 系统配置修改
 */

import { getDatabase } from '../config/database.js'
import { getClientIp } from '../middleware/security.js'

// 操作类型枚举
export const AuditActionTypes = {
  // 认证相关
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',
  
  // 用户管理
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_STATUS_CHANGE: 'user_status_change',
  
  // 角色权限
  ROLE_CREATE: 'role_create',
  ROLE_UPDATE: 'role_update',
  ROLE_DELETE: 'role_delete',
  PERMISSION_CHANGE: 'permission_change',
  
  // 数据操作
  DATA_CREATE: 'data_create',
  DATA_UPDATE: 'data_update',
  DATA_DELETE: 'data_delete',
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  BATCH_DELETE: 'batch_delete',
  
  // 系统配置
  CONFIG_CHANGE: 'config_change',
  SECURITY_SETTING_CHANGE: 'security_setting_change',
  
  // 安全事件
  RATE_LIMIT: 'rate_limit',
  BLOCKED_ACCESS: 'blocked_access',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
}

// 操作类型中文名称
const actionNames = {
  [AuditActionTypes.LOGIN]: '用户登录',
  [AuditActionTypes.LOGOUT]: '用户登出',
  [AuditActionTypes.LOGIN_FAILED]: '登录失败',
  [AuditActionTypes.PASSWORD_CHANGE]: '修改密码',
  [AuditActionTypes.PASSWORD_RESET]: '重置密码',
  [AuditActionTypes.USER_CREATE]: '创建用户',
  [AuditActionTypes.USER_UPDATE]: '更新用户',
  [AuditActionTypes.USER_DELETE]: '删除用户',
  [AuditActionTypes.USER_STATUS_CHANGE]: '修改用户状态',
  [AuditActionTypes.ROLE_CREATE]: '创建角色',
  [AuditActionTypes.ROLE_UPDATE]: '更新角色',
  [AuditActionTypes.ROLE_DELETE]: '删除角色',
  [AuditActionTypes.PERMISSION_CHANGE]: '权限变更',
  [AuditActionTypes.DATA_CREATE]: '创建数据',
  [AuditActionTypes.DATA_UPDATE]: '更新数据',
  [AuditActionTypes.DATA_DELETE]: '删除数据',
  [AuditActionTypes.DATA_EXPORT]: '导出数据',
  [AuditActionTypes.DATA_IMPORT]: '导入数据',
  [AuditActionTypes.BATCH_DELETE]: '批量删除',
  [AuditActionTypes.CONFIG_CHANGE]: '修改配置',
  [AuditActionTypes.SECURITY_SETTING_CHANGE]: '修改安全设置',
  [AuditActionTypes.RATE_LIMIT]: '速率限制触发',
  [AuditActionTypes.BLOCKED_ACCESS]: '访问被拦截',
  [AuditActionTypes.SUSPICIOUS_ACTIVITY]: '可疑活动'
}

/**
 * 审计日志记录器类
 */
class AuditLogger {
  constructor() {
    this.enabled = true
    this.sensitiveFields = ['password', 'passwordHash', 'password_hash', 'token', 'secret', 'two_factor_secret']
  }
  
  /**
   * 记录审计日志
   * 
   * @param {Object} params 日志参数
   * @param {string} params.actionType - 操作类型
   * @param {string} params.resourceType - 资源类型（user, role, customer, bill等）
   * @param {string} params.resourceId - 资源ID
   * @param {string} params.resourceName - 资源名称
   * @param {Object} params.oldValue - 修改前的值
   * @param {Object} params.newValue - 修改后的值
   * @param {string} params.description - 操作描述
   * @param {string} params.result - 操作结果（success/failed）
   * @param {string} params.errorMessage - 错误信息
   * @param {Object} params.user - 操作用户
   * @param {Object} params.req - Express请求对象
   */
  async log(params) {
    if (!this.enabled) return
    
    const {
      actionType,
      resourceType,
      resourceId,
      resourceName,
      oldValue,
      newValue,
      description,
      result = 'success',
      errorMessage,
      user,
      req
    } = params
    
    try {
      const db = getDatabase()
      
      // 过滤敏感字段
      const filteredOldValue = this.filterSensitiveData(oldValue)
      const filteredNewValue = this.filterSensitiveData(newValue)
      
      await db.prepare(`
        INSERT INTO security_audit_logs (
          user_id, username, user_role,
          action_type, action_name, resource_type, resource_id, resource_name,
          old_value, new_value, description,
          ip_address, user_agent, request_url, request_method,
          result, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user?.id || null,
        user?.username || user?.name || '系统',
        user?.role || null,
        actionType,
        actionNames[actionType] || actionType,
        resourceType || null,
        resourceId || null,
        resourceName || null,
        filteredOldValue ? JSON.stringify(filteredOldValue) : null,
        filteredNewValue ? JSON.stringify(filteredNewValue) : null,
        description || null,
        req ? getClientIp(req) : null,
        req?.get?.('User-Agent') || null,
        req?.originalUrl || null,
        req?.method || null,
        result,
        errorMessage || null
      )
      
      // 控制台输出重要操作
      if (this.isImportantAction(actionType)) {
        console.log(`🔐 [审计] ${actionNames[actionType] || actionType} - ${user?.username || '系统'} - ${resourceType}:${resourceId}`)
      }
      
    } catch (error) {
      console.error('记录审计日志失败:', error.message)
    }
  }
  
  /**
   * 快捷方法：记录登录事件
   */
  async logLogin(user, req, success = true, failReason = null) {
    await this.log({
      actionType: success ? AuditActionTypes.LOGIN : AuditActionTypes.LOGIN_FAILED,
      resourceType: 'user',
      resourceId: user?.id?.toString(),
      resourceName: user?.username || user?.name,
      description: success ? '用户成功登录' : `登录失败: ${failReason}`,
      result: success ? 'success' : 'failed',
      errorMessage: failReason,
      user,
      req
    })
  }
  
  /**
   * 快捷方法：记录登出事件
   */
  async logLogout(user, req) {
    await this.log({
      actionType: AuditActionTypes.LOGOUT,
      resourceType: 'user',
      resourceId: user?.id?.toString(),
      resourceName: user?.username,
      description: '用户登出',
      user,
      req
    })
  }
  
  /**
   * 快捷方法：记录用户创建
   */
  async logUserCreate(newUser, operator, req) {
    await this.log({
      actionType: AuditActionTypes.USER_CREATE,
      resourceType: 'user',
      resourceId: newUser?.id?.toString(),
      resourceName: newUser?.username,
      newValue: newUser,
      description: `创建用户: ${newUser?.username}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录用户更新
   */
  async logUserUpdate(userId, oldData, newData, operator, req) {
    await this.log({
      actionType: AuditActionTypes.USER_UPDATE,
      resourceType: 'user',
      resourceId: userId?.toString(),
      resourceName: oldData?.username || newData?.username,
      oldValue: oldData,
      newValue: newData,
      description: `更新用户: ${oldData?.username}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录用户删除
   */
  async logUserDelete(deletedUser, operator, req) {
    await this.log({
      actionType: AuditActionTypes.USER_DELETE,
      resourceType: 'user',
      resourceId: deletedUser?.id?.toString(),
      resourceName: deletedUser?.username,
      oldValue: deletedUser,
      description: `删除用户: ${deletedUser?.username}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录密码修改
   */
  async logPasswordChange(userId, username, operator, req) {
    await this.log({
      actionType: AuditActionTypes.PASSWORD_CHANGE,
      resourceType: 'user',
      resourceId: userId?.toString(),
      resourceName: username,
      description: `修改密码: ${username}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录权限变更
   */
  async logPermissionChange(roleCode, oldPermissions, newPermissions, operator, req) {
    await this.log({
      actionType: AuditActionTypes.PERMISSION_CHANGE,
      resourceType: 'role',
      resourceId: roleCode,
      resourceName: roleCode,
      oldValue: { permissions: oldPermissions },
      newValue: { permissions: newPermissions },
      description: `修改角色权限: ${roleCode}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录数据导出
   */
  async logDataExport(dataType, filters, recordCount, operator, req) {
    await this.log({
      actionType: AuditActionTypes.DATA_EXPORT,
      resourceType: dataType,
      newValue: { filters, recordCount },
      description: `导出${dataType}数据，共${recordCount}条记录`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录配置变更
   */
  async logConfigChange(settingKey, oldValue, newValue, operator, req) {
    await this.log({
      actionType: AuditActionTypes.CONFIG_CHANGE,
      resourceType: 'config',
      resourceId: settingKey,
      resourceName: settingKey,
      oldValue: { value: oldValue },
      newValue: { value: newValue },
      description: `修改配置: ${settingKey}`,
      user: operator,
      req
    })
  }
  
  /**
   * 快捷方法：记录安全设置变更
   */
  async logSecuritySettingChange(settings, operator, req) {
    await this.log({
      actionType: AuditActionTypes.SECURITY_SETTING_CHANGE,
      resourceType: 'security_setting',
      newValue: settings,
      description: '修改安全设置',
      user: operator,
      req
    })
  }
  
  /**
   * 过滤敏感数据
   */
  filterSensitiveData(data) {
    if (!data || typeof data !== 'object') return data
    
    const filtered = Array.isArray(data) ? [...data] : { ...data }
    
    for (const key of Object.keys(filtered)) {
      if (this.sensitiveFields.includes(key.toLowerCase())) {
        filtered[key] = '***已隐藏***'
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = this.filterSensitiveData(filtered[key])
      }
    }
    
    return filtered
  }
  
  /**
   * 判断是否是重要操作
   */
  isImportantAction(actionType) {
    const importantActions = [
      AuditActionTypes.USER_CREATE,
      AuditActionTypes.USER_DELETE,
      AuditActionTypes.PERMISSION_CHANGE,
      AuditActionTypes.SECURITY_SETTING_CHANGE,
      AuditActionTypes.DATA_EXPORT,
      AuditActionTypes.BATCH_DELETE
    ]
    return importantActions.includes(actionType)
  }
  
  /**
   * 获取审计日志
   */
  async getLogs(params = {}) {
    const db = getDatabase()
    const { 
      userId, 
      username, 
      actionType, 
      resourceType, 
      startDate, 
      endDate, 
      result,
      page = 1, 
      pageSize = 20 
    } = params
    
    let query = 'SELECT * FROM security_audit_logs WHERE 1=1'
    const queryParams = []
    
    if (userId) {
      query += ' AND user_id = ?'
      queryParams.push(userId)
    }
    
    if (username) {
      query += ' AND username LIKE ?'
      queryParams.push(`%${username}%`)
    }
    
    if (actionType) {
      query += ' AND action_type = ?'
      queryParams.push(actionType)
    }
    
    if (resourceType) {
      query += ' AND resource_type = ?'
      queryParams.push(resourceType)
    }
    
    if (startDate) {
      query += ' AND created_at >= ?'
      queryParams.push(startDate)
    }
    
    if (endDate) {
      query += ' AND created_at <= ?'
      queryParams.push(endDate)
    }
    
    if (result) {
      query += ' AND result = ?'
      queryParams.push(result)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const totalResult = await db.prepare(countQuery).get(...queryParams)
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    queryParams.push(pageSize, (page - 1) * pageSize)
    
    const list = await db.prepare(query).all(...queryParams)
    
    return {
      list: list.map(this.convertLogToCamelCase),
      total: totalResult?.total || 0,
      page,
      pageSize
    }
  }
  
  /**
   * 转换日志字段为驼峰命名
   */
  convertLogToCamelCase(row) {
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      userRole: row.user_role,
      actionType: row.action_type,
      actionName: row.action_name,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      oldValue: row.old_value ? JSON.parse(row.old_value) : null,
      newValue: row.new_value ? JSON.parse(row.new_value) : null,
      description: row.description,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestUrl: row.request_url,
      requestMethod: row.request_method,
      result: row.result,
      errorMessage: row.error_message,
      createdAt: row.created_at
    }
  }
  
  /**
   * 获取统计数据
   */
  async getStatistics(days = 7) {
    const db = getDatabase()
    
    // 按操作类型统计
    const byAction = await db.prepare(`
      SELECT action_type, COUNT(*) as count
      FROM security_audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY action_type
      ORDER BY count DESC
    `).all()
    
    // 按结果统计
    const byResult = await db.prepare(`
      SELECT result, COUNT(*) as count
      FROM security_audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY result
    `).all()
    
    // 按用户统计
    const byUser = await db.prepare(`
      SELECT username, COUNT(*) as count
      FROM security_audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY username
      ORDER BY count DESC
      LIMIT 10
    `).all()
    
    // 每日趋势
    const dailyTrend = await db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM security_audit_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all()
    
    return {
      byAction,
      byResult,
      byUser,
      dailyTrend
    }
  }
}

// 创建单例实例
const auditLogger = new AuditLogger()

export { auditLogger }
export default auditLogger
