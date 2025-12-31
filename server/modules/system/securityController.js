/**
 * 安全管理控制器
 * 
 * 包含：
 * - 安全设置管理
 * - 审计日志查询
 * - IP黑名单管理
 * - 备份管理
 * - 活动会话管理
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import { getDatabase } from '../../config/database.js'
import auditLogger, { AuditActionTypes } from '../../utils/auditLogger.js'
import { addToBlacklist, removeFromBlacklist } from '../../middleware/security.js'
import { triggerBackup, getBackupHistory } from '../../jobs/backupScheduler.js'
import fs from 'fs'

// 动态导入 COS 工具（可能未配置）
let cosUploader = null
async function getCosUploader() {
  if (!cosUploader) {
    try {
      const module = await import('../../utils/cosUploader.js')
      cosUploader = module.default // 获取 default export
    } catch (error) {
      console.warn('COS 模块加载失败:', error.message)
    }
  }
  return cosUploader
}

// ==================== 默认安全设置 ====================
const DEFAULT_SECURITY_SETTINGS = [
  // 登录安全设置
  { key: 'login_max_attempts', value: '5', type: 'number', category: 'login', description: '最大登录尝试次数' },
  { key: 'login_lockout_duration', value: '15', type: 'number', category: 'login', description: '账号锁定时长（分钟）' },
  { key: 'login_remember_days', value: '7', type: 'number', category: 'login', description: '记住登录状态天数' },
  { key: 'login_require_captcha_after', value: '3', type: 'number', category: 'login', description: '多少次失败后需要验证码' },
  
  // 密码安全设置
  { key: 'password_min_length', value: '8', type: 'number', category: 'password', description: '密码最小长度' },
  { key: 'password_require_uppercase', value: 'true', type: 'boolean', category: 'password', description: '密码需要大写字母' },
  { key: 'password_require_lowercase', value: 'true', type: 'boolean', category: 'password', description: '密码需要小写字母' },
  { key: 'password_require_number', value: 'true', type: 'boolean', category: 'password', description: '密码需要数字' },
  { key: 'password_require_special', value: 'false', type: 'boolean', category: 'password', description: '密码需要特殊字符' },
  { key: 'password_expire_days', value: '90', type: 'number', category: 'password', description: '密码有效期（天，0为永不过期）' },
  
  // 会话安全设置
  { key: 'session_timeout', value: '30', type: 'number', category: 'session', description: '会话超时时间（分钟）' },
  { key: 'session_single_login', value: 'false', type: 'boolean', category: 'session', description: '单点登录（同一账号只能一处登录）' },
  { key: 'session_remember_max_days', value: '30', type: 'number', category: 'session', description: '记住登录最长天数' },
  
  // 安全审计设置
  { key: 'audit_enabled', value: 'true', type: 'boolean', category: 'audit', description: '启用操作审计' },
  { key: 'audit_sensitive_operations', value: 'true', type: 'boolean', category: 'audit', description: '记录敏感操作' },
  { key: 'audit_retention_days', value: '365', type: 'number', category: 'audit', description: '审计日志保留天数' },
]

// ==================== 安全设置 ====================

/**
 * 初始化安全设置（如果表为空则插入默认值）
 */
export async function initSecuritySettings(req, res) {
  try {
    const db = getDatabase()
    
    // 先检查表结构，添加缺少的列（兼容已有表）
    try {
      await db.prepare(`
        ALTER TABLE security_settings ADD COLUMN IF NOT EXISTS setting_type TEXT DEFAULT 'string'
      `).run()
    } catch (e) {
      // 列可能已存在，忽略
    }
    
    try {
      await db.prepare(`
        ALTER TABLE security_settings ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
      `).run()
    } catch (e) {
      // 列可能已存在，忽略
    }
    
    // 确保 setting_key 有唯一约束（ON CONFLICT 需要）
    try {
      await db.prepare(`
        ALTER TABLE security_settings ADD CONSTRAINT security_settings_setting_key_unique UNIQUE (setting_key)
      `).run()
    } catch (e) {
      // 约束可能已存在，忽略
    }
    
    // 检查是否已有数据
    const existing = await db.prepare('SELECT COUNT(*) as count FROM security_settings').get()
    
    if (existing.count > 0) {
      return success(res, { initialized: false, message: '安全设置已存在' })
    }
    
    // 插入默认设置（使用先查询后插入的方式，避免依赖唯一约束）
    let insertedCount = 0
    for (const setting of DEFAULT_SECURITY_SETTINGS) {
      // 先检查是否已存在
      const exists = await db.prepare(
        'SELECT 1 FROM security_settings WHERE setting_key = ?'
      ).get(setting.key)
      
      if (!exists) {
        await db.prepare(`
          INSERT INTO security_settings (setting_key, setting_value, setting_type, category, description)
          VALUES (?, ?, ?, ?, ?)
        `).run(setting.key, setting.value, setting.type, setting.category, setting.description)
        insertedCount++
      }
    }
    
    return success(res, { initialized: true, count: insertedCount }, '安全设置初始化成功')
  } catch (error) {
    console.error('初始化安全设置失败:', error)
    return serverError(res, '初始化安全设置失败: ' + error.message)
  }
}

/**
 * 获取所有安全设置
 */
export async function getSecuritySettings(req, res) {
  try {
    const db = getDatabase()
    const settings = await db.prepare(`
      SELECT setting_key, setting_value, setting_type, category, description, updated_at
      FROM security_settings
      ORDER BY category, setting_key
    `).all()
    
    // 按分类分组
    const grouped = {}
    const categories = {
      login: '登录安全',
      password: '密码策略',
      session: '会话管理',
      api: 'API安全',
      audit: '安全审计',
      backup: '数据备份'
    }
    
    for (const s of settings) {
      const category = s.category || 'general'
      if (!grouped[category]) {
        grouped[category] = {
          name: categories[category] || category,
          settings: []
        }
      }
      
      // 转换值类型
      let value = s.setting_value
      if (s.setting_type === 'number') {
        value = Number(value)
      } else if (s.setting_type === 'boolean') {
        value = value === 'true' || value === '1'
      }
      
      grouped[category].settings.push({
        key: s.setting_key,
        value,
        type: s.setting_type,
        description: s.description,
        updatedAt: s.updated_at
      })
    }
    
    return success(res, grouped)
  } catch (error) {
    console.error('获取安全设置失败:', error)
    return serverError(res, '获取安全设置失败')
  }
}

/**
 * 更新安全设置
 */
export async function updateSecuritySettings(req, res) {
  try {
    const { settings } = req.body
    
    if (!settings || typeof settings !== 'object') {
      return badRequest(res, '无效的设置数据')
    }
    
    const db = getDatabase()
    
    // 获取旧值用于审计
    const oldSettings = {}
    for (const key of Object.keys(settings)) {
      const old = await db.prepare('SELECT setting_value FROM security_settings WHERE setting_key = ?').get(key)
      if (old) {
        oldSettings[key] = old.setting_value
      }
    }
    
    // 更新设置
    for (const [key, value] of Object.entries(settings)) {
      await db.prepare(`
        UPDATE security_settings 
        SET setting_value = ?, updated_at = NOW()
        WHERE setting_key = ?
      `).run(String(value), key)
    }
    
    // 记录审计日志
    await auditLogger.logSecuritySettingChange(
      { oldSettings, newSettings: settings },
      req.user,
      req
    )
    
    return success(res, null, '安全设置已更新')
  } catch (error) {
    console.error('更新安全设置失败:', error)
    return serverError(res, '更新安全设置失败')
  }
}

// ==================== 审计日志 ====================

/**
 * 获取审计日志列表
 */
export async function getAuditLogs(req, res) {
  try {
    const { 
      userId, username, actionType, resourceType, 
      startDate, endDate, result,
      page, pageSize 
    } = req.query
    
    const logs = await auditLogger.getLogs({
      userId,
      username,
      actionType,
      resourceType,
      startDate,
      endDate,
      result,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, logs.list, {
      total: logs.total,
      page: logs.page,
      pageSize: logs.pageSize
    })
  } catch (error) {
    console.error('获取审计日志失败:', error)
    return serverError(res, '获取审计日志失败')
  }
}

/**
 * 获取审计日志统计
 */
export async function getAuditStatistics(req, res) {
  try {
    const { days = 7 } = req.query
    const stats = await auditLogger.getStatistics(parseInt(days))
    return success(res, stats)
  } catch (error) {
    console.error('获取审计统计失败:', error)
    return serverError(res, '获取审计统计失败')
  }
}

/**
 * 获取操作类型列表
 */
export function getAuditActionTypes(req, res) {
  const types = Object.entries(AuditActionTypes).map(([key, value]) => ({
    code: value,
    name: key
  }))
  return success(res, types)
}

// ==================== IP黑名单管理 ====================

/**
 * 获取IP黑名单列表
 */
export async function getIpBlacklist(req, res) {
  try {
    const db = getDatabase()
    const { page = 1, pageSize = 20, active } = req.query
    
    let query = 'SELECT * FROM ip_blacklist WHERE 1=1'
    const params = []
    
    if (active !== undefined) {
      query += ' AND is_active = ?'
      params.push(active === 'true')
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const totalResult = await db.prepare(countQuery).get(...params)
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = await db.prepare(query).all(...params)
    
    return successWithPagination(res, list.map(item => ({
      id: item.id,
      ipAddress: item.ip_address,
      reason: item.reason,
      blockedAt: item.blocked_at,
      blockedBy: item.blocked_by,
      expiresAt: item.expires_at,
      isActive: item.is_active,
      createdAt: item.created_at
    })), {
      total: totalResult?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取IP黑名单失败:', error)
    return serverError(res, '获取IP黑名单失败')
  }
}

/**
 * 添加IP到黑名单
 */
export async function addIpToBlacklist(req, res) {
  try {
    const { ipAddress, reason, expiresInMinutes } = req.body
    
    if (!ipAddress) {
      return badRequest(res, 'IP地址为必填项')
    }
    
    // 验证IP格式
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(ipAddress)) {
      return badRequest(res, 'IP地址格式无效')
    }
    
    await addToBlacklist(
      ipAddress, 
      reason || '手动添加', 
      req.user?.username || 'admin',
      expiresInMinutes
    )
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'ip_blacklist_add',
      resourceType: 'ip_blacklist',
      resourceId: ipAddress,
      description: `添加IP到黑名单: ${ipAddress}`,
      user: req.user,
      req
    })
    
    return success(res, null, 'IP已添加到黑名单')
  } catch (error) {
    console.error('添加IP到黑名单失败:', error)
    return serverError(res, '添加IP到黑名单失败')
  }
}

/**
 * 从黑名单移除IP
 */
export async function removeIpFromBlacklist(req, res) {
  try {
    const { ipAddress } = req.params
    
    await removeFromBlacklist(ipAddress)
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'ip_blacklist_remove',
      resourceType: 'ip_blacklist',
      resourceId: ipAddress,
      description: `从黑名单移除IP: ${ipAddress}`,
      user: req.user,
      req
    })
    
    return success(res, null, 'IP已从黑名单移除')
  } catch (error) {
    console.error('从黑名单移除IP失败:', error)
    return serverError(res, '从黑名单移除IP失败')
  }
}

// ==================== 登录尝试记录 ====================

/**
 * 获取登录尝试记录
 */
export async function getLoginAttempts(req, res) {
  try {
    const db = getDatabase()
    const { username, ip, success: successFilter, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM login_attempts WHERE 1=1'
    const params = []
    
    if (username) {
      query += ' AND username LIKE ?'
      params.push(`%${username}%`)
    }
    
    if (ip) {
      query += ' AND ip_address LIKE ?'
      params.push(`%${ip}%`)
    }
    
    if (successFilter !== undefined) {
      query += ' AND success = ?'
      params.push(successFilter === 'true')
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const totalResult = await db.prepare(countQuery).get(...params)
    
    // 分页
    query += ' ORDER BY attempt_time DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = await db.prepare(query).all(...params)
    
    return successWithPagination(res, list.map(item => ({
      id: item.id,
      username: item.username,
      ipAddress: item.ip_address,
      userAgent: item.user_agent,
      attemptTime: item.attempt_time,
      success: item.success,
      failureReason: item.failure_reason
    })), {
      total: totalResult?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取登录尝试记录失败:', error)
    return serverError(res, '获取登录尝试记录失败')
  }
}

// ==================== 活动会话管理 ====================

/**
 * 获取活动会话列表
 */
export async function getActiveSessions(req, res) {
  try {
    const db = getDatabase()
    const { userId, page = 1, pageSize = 20 } = req.query
    
    let query = `
      SELECT s.*, u.username, u.name 
      FROM active_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_active = TRUE
    `
    const params = []
    
    if (userId) {
      query += ' AND s.user_id = ?'
      params.push(userId)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT s.*, u.username, u.name', 'SELECT COUNT(*) as total')
    const totalResult = await db.prepare(countQuery).get(...params)
    
    // 分页
    query += ' ORDER BY s.last_activity DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = await db.prepare(query).all(...params)
    
    return successWithPagination(res, list.map(item => ({
      id: item.id,
      sessionId: item.session_id,
      userId: item.user_id,
      username: item.username,
      name: item.name,
      ipAddress: item.ip_address,
      userAgent: item.user_agent,
      deviceInfo: item.device_info,
      loginTime: item.login_time,
      lastActivity: item.last_activity,
      expiresAt: item.expires_at
    })), {
      total: totalResult?.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取活动会话失败:', error)
    return serverError(res, '获取活动会话失败')
  }
}

/**
 * 强制终止会话
 */
export async function terminateSession(req, res) {
  try {
    const { sessionId } = req.params
    const db = getDatabase()
    
    // 获取会话信息
    const session = await db.prepare('SELECT * FROM active_sessions WHERE session_id = ?').get(sessionId)
    
    if (!session) {
      return notFound(res, '会话不存在')
    }
    
    // 终止会话
    await db.prepare('UPDATE active_sessions SET is_active = FALSE WHERE session_id = ?').run(sessionId)
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'session_terminate',
      resourceType: 'session',
      resourceId: sessionId,
      description: `强制终止会话: ${sessionId}`,
      user: req.user,
      req
    })
    
    return success(res, null, '会话已终止')
  } catch (error) {
    console.error('终止会话失败:', error)
    return serverError(res, '终止会话失败')
  }
}

// ==================== 备份管理 ====================

/**
 * 获取备份历史
 */
export async function getBackups(req, res) {
  try {
    const { limit = 20, status, type } = req.query
    const db = getDatabase()
    
    let sql = `
      SELECT id, backup_name, backup_type, backup_size, backup_path, backup_status,
             started_at, completed_at, error_message, created_by, created_at,
             cos_key, is_cloud_synced, file_name, description, restored_at, restore_count
      FROM backup_records
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1
    
    if (status) {
      sql += ` AND backup_status = $${paramIndex++}`
      params.push(status)
    }
    if (type) {
      sql += ` AND backup_type = $${paramIndex++}`
      params.push(type)
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(parseInt(limit))
    
    const backups = await db.prepare(sql).all(...params)
    
    return success(res, backups.map(item => ({
      id: item.id,
      backupName: item.backup_name,
      backupType: item.backup_type,
      backupSize: item.backup_size,
      backupPath: item.backup_path,
      backupStatus: item.backup_status,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      errorMessage: item.error_message,
      createdBy: item.created_by,
      createdAt: item.created_at,
      cosKey: item.cos_key,
      isCloudSynced: item.is_cloud_synced === 1,
      fileName: item.file_name,
      description: item.description,
      restoredAt: item.restored_at,
      restoreCount: item.restore_count || 0
    })))
  } catch (error) {
    console.error('获取备份历史失败:', error)
    return serverError(res, '获取备份历史失败')
  }
}

/**
 * 手动触发备份
 */
export async function createBackup(req, res) {
  try {
    const { type = 'full', description } = req.body
    
    // 异步执行备份（不阻塞响应）
    triggerBackup(type).catch(err => {
      console.error('备份执行失败:', err.message)
    })
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'backup_create',
      resourceType: 'backup',
      description: `手动触发${type === 'full' ? '完整' : '增量'}备份${description ? ': ' + description : ''}`,
      user: req.user,
      req
    })
    
    return success(res, null, '备份任务已启动，请稍后查看备份历史')
  } catch (error) {
    console.error('触发备份失败:', error)
    return serverError(res, '触发备份失败')
  }
}

/**
 * 删除备份
 */
export async function deleteBackup(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    // 获取备份记录
    const backup = await db.prepare(`
      SELECT * FROM backup_records WHERE id = $1
    `).get(id)
    
    if (!backup) {
      return notFound(res, '备份记录不存在')
    }
    
    // 删除本地文件
    if (backup.backup_path && fs.existsSync(backup.backup_path)) {
      try {
        fs.unlinkSync(backup.backup_path)
      } catch (e) {
        console.warn('删除本地备份文件失败:', e.message)
      }
    }
    
    // 删除 COS 文件
    if (backup.cos_key) {
      try {
        const cos = await getCosUploader()
        if (cos && cos.isCosConfigured && cos.isCosConfigured()) {
          await cos.deleteFile(backup.cos_key)
        }
      } catch (e) {
        console.warn('删除 COS 备份文件失败:', e.message)
      }
    }
    
    // 删除数据库记录
    await db.prepare(`DELETE FROM backup_records WHERE id = $1`).run(id)
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'backup_delete',
      resourceType: 'backup',
      resourceId: id,
      resourceName: backup.backup_name,
      description: `删除备份: ${backup.backup_name}`,
      user: req.user,
      req
    })
    
    return success(res, null, '备份已删除')
  } catch (error) {
    console.error('删除备份失败:', error)
    return serverError(res, '删除备份失败')
  }
}

/**
 * 获取备份下载链接
 */
export async function getBackupDownloadUrl(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    // 获取备份记录
    const backup = await db.prepare(`
      SELECT * FROM backup_records WHERE id = $1
    `).get(id)
    
    if (!backup) {
      return notFound(res, '备份记录不存在')
    }
    
    if (backup.backup_status !== 'completed') {
      return badRequest(res, '该备份尚未完成，无法下载')
    }
    
    let downloadUrl = null
    let source = 'local'
    
    // 优先从 COS 获取下载链接
    if (backup.cos_key && backup.is_cloud_synced) {
      try {
        const cos = await getCosUploader()
        if (cos && cos.isCosConfigured && cos.isCosConfigured()) {
          downloadUrl = await cos.getSignedUrl(backup.cos_key, 3600) // 1小时有效
          source = 'cos'
        }
      } catch (e) {
        console.warn('获取 COS 下载链接失败:', e.message)
      }
    }
    
    // 如果 COS 不可用，检查本地文件
    if (!downloadUrl && backup.backup_path && fs.existsSync(backup.backup_path)) {
      // 返回本地文件路径，前端需要通过另一个接口下载
      downloadUrl = `/api/security/backups/${id}/file`
      source = 'local'
    }
    
    if (!downloadUrl) {
      return notFound(res, '备份文件不可用')
    }
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'backup_download',
      resourceType: 'backup',
      resourceId: id,
      resourceName: backup.backup_name,
      description: `下载备份: ${backup.backup_name} (来源: ${source})`,
      user: req.user,
      req
    })
    
    return success(res, {
      downloadUrl,
      source,
      fileName: backup.file_name || backup.backup_name,
      fileSize: backup.backup_size,
      expiresIn: source === 'cos' ? 3600 : null
    })
  } catch (error) {
    console.error('获取下载链接失败:', error)
    return serverError(res, '获取下载链接失败')
  }
}

/**
 * 下载本地备份文件
 */
export async function downloadBackupFile(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    // 获取备份记录
    const backup = await db.prepare(`
      SELECT * FROM backup_records WHERE id = $1
    `).get(id)
    
    if (!backup) {
      return notFound(res, '备份记录不存在')
    }
    
    if (!backup.backup_path || !fs.existsSync(backup.backup_path)) {
      return notFound(res, '本地备份文件不存在')
    }
    
    const fileName = backup.file_name || `backup_${backup.id}.sql.gz`
    
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', fs.statSync(backup.backup_path).size)
    
    const fileStream = fs.createReadStream(backup.backup_path)
    fileStream.pipe(res)
  } catch (error) {
    console.error('下载备份文件失败:', error)
    return serverError(res, '下载备份文件失败')
  }
}

/**
 * 恢复数据库
 */
export async function restoreBackup(req, res) {
  try {
    const { id } = req.params
    const { noBackupBefore = false, force = false } = req.body
    const db = getDatabase()
    
    // 检查权限（只有超级管理员可以恢复）
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return badRequest(res, '只有管理员可以执行恢复操作')
    }
    
    // 获取备份记录
    const backup = await db.prepare(`
      SELECT * FROM backup_records WHERE id = $1
    `).get(id)
    
    if (!backup) {
      return notFound(res, '备份记录不存在')
    }
    
    if (backup.backup_status !== 'completed') {
      return badRequest(res, '该备份尚未完成，无法恢复')
    }
    
    // 记录审计日志（恢复开始）
    await auditLogger.log({
      actionType: 'backup_restore_start',
      resourceType: 'backup',
      resourceId: id,
      resourceName: backup.backup_name,
      description: `开始恢复数据库: ${backup.backup_name}`,
      user: req.user,
      req
    })
    
    // 异步执行恢复（不阻塞响应）
    const restorePromise = (async () => {
      try {
        // 动态导入恢复脚本
        const { performRestore } = await import('../../scripts/restore-database.js')
        
        const result = await performRestore({
          backupId: id,
          noBackup: noBackupBefore,
          force: true, // API 调用时强制执行
          restoredBy: req.user?.username || 'api',
          ipAddress: req.ip
        })
        
        if (result.success) {
          // 记录审计日志（恢复成功）
          await auditLogger.log({
            actionType: 'backup_restore_success',
            resourceType: 'backup',
            resourceId: id,
            resourceName: backup.backup_name,
            description: `数据库恢复成功: ${backup.backup_name}，耗时 ${result.duration} 秒`,
            user: req.user,
            req
          })
        }
        
        return result
      } catch (error) {
        // 记录审计日志（恢复失败）
        await auditLogger.log({
          actionType: 'backup_restore_failed',
          resourceType: 'backup',
          resourceId: id,
          resourceName: backup.backup_name,
          description: `数据库恢复失败: ${error.message}`,
          result: 'failure',
          user: req.user,
          req
        })
        throw error
      }
    })()
    
    restorePromise.catch(err => {
      console.error('恢复执行失败:', err.message)
    })
    
    return success(res, {
      backupId: id,
      backupName: backup.backup_name,
      message: '恢复任务已启动，请稍后查看恢复状态'
    }, '恢复任务已启动')
  } catch (error) {
    console.error('触发恢复失败:', error)
    return serverError(res, '触发恢复失败')
  }
}

/**
 * 获取恢复记录
 */
export async function getRestoreRecords(req, res) {
  try {
    const { limit = 20, backupId } = req.query
    const db = getDatabase()
    
    let sql = `
      SELECT * FROM restore_records
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1
    
    if (backupId) {
      sql += ` AND backup_id = $${paramIndex++}`
      params.push(backupId)
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(parseInt(limit))
    
    const records = await db.prepare(sql).all(...params)
    
    return success(res, records.map(item => ({
      id: item.id,
      backupId: item.backup_id,
      backupName: item.backup_name,
      restoreType: item.restore_type,
      restoreStatus: item.restore_status,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      errorMessage: item.error_message,
      restoredBy: item.restored_by,
      ipAddress: item.ip_address,
      createdAt: item.created_at
    })))
  } catch (error) {
    console.error('获取恢复记录失败:', error)
    return serverError(res, '获取恢复记录失败')
  }
}

/**
 * 获取备份设置
 */
export async function getBackupSettings(req, res) {
  try {
    const db = getDatabase()
    
    const settings = await db.prepare(`
      SELECT setting_key, setting_value FROM security_settings 
      WHERE setting_key LIKE 'backup_%'
    `).all()
    
    const result = {
      enabled: true,
      frequency: 'daily',
      time: '03:00',
      retentionCount: 30,
      uploadToCos: true
    }
    
    for (const s of settings) {
      switch (s.setting_key) {
        case 'backup_enabled':
          result.enabled = s.setting_value !== 'false'
          break
        case 'backup_frequency':
          result.frequency = s.setting_value || 'daily'
          break
        case 'backup_time':
          result.time = s.setting_value || '03:00'
          break
        case 'backup_retention_count':
          result.retentionCount = parseInt(s.setting_value) || 30
          break
        case 'backup_upload_to_cos':
          result.uploadToCos = s.setting_value !== 'false'
          break
      }
    }
    
    // 检查 COS 是否已配置
    let cosConfigured = false
    try {
      const cos = await getCosUploader()
      cosConfigured = cos && cos.isCosConfigured && cos.isCosConfigured()
    } catch (e) {
      // 忽略
    }
    
    return success(res, {
      ...result,
      cosConfigured
    })
  } catch (error) {
    console.error('获取备份设置失败:', error)
    return serverError(res, '获取备份设置失败')
  }
}

/**
 * 更新备份设置
 */
export async function updateBackupSettings(req, res) {
  try {
    const { enabled, frequency, time, retentionCount, uploadToCos } = req.body
    const db = getDatabase()
    
    const settingsToUpdate = []
    
    if (enabled !== undefined) {
      settingsToUpdate.push({ key: 'backup_enabled', value: enabled ? 'true' : 'false' })
    }
    if (frequency) {
      settingsToUpdate.push({ key: 'backup_frequency', value: frequency })
    }
    if (time) {
      settingsToUpdate.push({ key: 'backup_time', value: time })
    }
    if (retentionCount !== undefined) {
      settingsToUpdate.push({ key: 'backup_retention_count', value: String(retentionCount) })
    }
    if (uploadToCos !== undefined) {
      settingsToUpdate.push({ key: 'backup_upload_to_cos', value: uploadToCos ? 'true' : 'false' })
    }
    
    for (const setting of settingsToUpdate) {
      await db.prepare(`
        INSERT INTO security_settings (setting_key, setting_value, setting_type, category, description)
        VALUES ($1, $2, 'string', 'backup', '')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2
      `).run(setting.key, setting.value)
    }
    
    // 记录审计日志
    await auditLogger.log({
      actionType: 'backup_settings_update',
      resourceType: 'settings',
      description: '更新备份设置',
      user: req.user,
      req
    })
    
    return success(res, null, '备份设置已更新')
  } catch (error) {
    console.error('更新备份设置失败:', error)
    return serverError(res, '更新备份设置失败')
  }
}

// ==================== 安全概览 ====================

/**
 * 获取安全概览数据
 */
export async function getSecurityOverview(req, res) {
  try {
    const db = getDatabase()
    
    // 今日登录失败次数
    const failedLogins = await db.prepare(`
      SELECT COUNT(*) as count FROM login_attempts 
      WHERE success = FALSE AND attempt_time >= CURRENT_DATE
    `).get()
    
    // 活动会话数
    const activeSessions = await db.prepare(`
      SELECT COUNT(*) as count FROM active_sessions WHERE is_active = TRUE
    `).get()
    
    // 黑名单IP数量
    const blockedIps = await db.prepare(`
      SELECT COUNT(*) as count FROM ip_blacklist WHERE is_active = TRUE
    `).get()
    
    // 最近7天审计日志数量
    const auditCount = await db.prepare(`
      SELECT COUNT(*) as count FROM security_audit_logs 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `).get()
    
    // 最近备份状态
    const lastBackup = await db.prepare(`
      SELECT * FROM backup_records ORDER BY created_at DESC LIMIT 1
    `).get()
    
    // 最近登录失败的用户
    const recentFailedUsers = await db.prepare(`
      SELECT username, COUNT(*) as count, MAX(attempt_time) as last_attempt
      FROM login_attempts 
      WHERE success = FALSE AND attempt_time >= NOW() - INTERVAL '24 hours'
      GROUP BY username
      ORDER BY count DESC
      LIMIT 5
    `).all()
    
    return success(res, {
      failedLoginsToday: failedLogins?.count || 0,
      activeSessions: activeSessions?.count || 0,
      blockedIps: blockedIps?.count || 0,
      auditLogsLast7Days: auditCount?.count || 0,
      lastBackup: lastBackup ? {
        name: lastBackup.backup_name,
        status: lastBackup.backup_status,
        time: lastBackup.created_at
      } : null,
      recentFailedUsers: recentFailedUsers.map(u => ({
        username: u.username,
        failCount: u.count,
        lastAttempt: u.last_attempt
      }))
    })
  } catch (error) {
    console.error('获取安全概览失败:', error)
    return serverError(res, '获取安全概览失败')
  }
}

export default {
  // 安全设置
  initSecuritySettings,
  getSecuritySettings,
  updateSecuritySettings,
  // 审计日志
  getAuditLogs,
  getAuditStatistics,
  getAuditActionTypes,
  // IP黑名单
  getIpBlacklist,
  addIpToBlacklist,
  removeIpFromBlacklist,
  // 登录尝试
  getLoginAttempts,
  // 活动会话
  getActiveSessions,
  terminateSession,
  // 备份管理
  getBackups,
  createBackup,
  deleteBackup,
  getBackupDownloadUrl,
  downloadBackupFile,
  restoreBackup,
  getRestoreRecords,
  getBackupSettings,
  updateBackupSettings,
  // 概览
  getSecurityOverview
}
