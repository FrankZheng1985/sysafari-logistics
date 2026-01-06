/**
 * 服务订阅管理 - 数据模型
 * 管理 SSL 证书、认证服务、API 服务、云服务等的到期和费用
 */

import { getDatabase } from '../../config/database.js'

/**
 * 获取订阅列表
 */
export async function getSubscriptions(filters = {}) {
  const db = getDatabase()
  const { category, status, environment, search, page = 1, pageSize = 50 } = filters
  
  let query = `
    SELECT * FROM service_subscriptions
    WHERE 1=1
  `
  const params = []
  let paramIndex = 1
  
  if (category) {
    query += ` AND category = $${paramIndex++}`
    params.push(category)
  }
  
  if (status) {
    query += ` AND status = $${paramIndex++}`
    params.push(status)
  }
  
  if (environment) {
    query += ` AND (environment = $${paramIndex++} OR environment = 'all')`
    params.push(environment)
  }
  
  if (search) {
    query += ` AND (name ILIKE $${paramIndex} OR provider ILIKE $${paramIndex} OR domain ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  // 获取总数
  const countResult = await db.prepare(
    query.replace('SELECT *', 'SELECT COUNT(*) as total')
  ).get(...params)
  
  // 排序和分页
  query += ` ORDER BY 
    CASE status 
      WHEN 'expired' THEN 1 
      WHEN 'expiring' THEN 2 
      WHEN 'active' THEN 3 
      ELSE 4 
    END,
    expire_date ASC NULLS LAST
  `
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  params.push(pageSize, (page - 1) * pageSize)
  
  const items = await db.prepare(query).all(...params)
  
  return {
    items,
    total: countResult?.total || 0,
    page,
    pageSize,
    totalPages: Math.ceil((countResult?.total || 0) / pageSize)
  }
}

/**
 * 获取单个订阅
 */
export async function getSubscriptionById(id) {
  const db = getDatabase()
  return await db.prepare('SELECT * FROM service_subscriptions WHERE id = $1').get(id)
}

/**
 * 创建订阅
 */
export async function createSubscription(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO service_subscriptions (
      name, category, provider, description, domain, environment,
      start_date, expire_date, auto_renew, renew_cycle_days,
      is_paid, cost_amount, cost_currency, billing_cycle,
      remind_days, remind_email, status, config, notes, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20
    ) RETURNING *
  `).get(
    data.name,
    data.category,
    data.provider,
    data.description,
    data.domain,
    data.environment || 'production',
    data.startDate,
    data.expireDate,
    data.autoRenew || false,
    data.renewCycleDays,
    data.isPaid || false,
    data.costAmount,
    data.costCurrency || 'CNY',
    data.billingCycle,
    data.remindDays || 30,
    data.remindEmail,
    data.status || 'active',
    data.config ? JSON.stringify(data.config) : null,
    data.notes,
    data.createdBy
  )
  
  // 记录日志
  await addLog(result.id, 'created', null, result, '创建服务订阅', data.createdBy)
  
  return result
}

/**
 * 更新订阅
 */
export async function updateSubscription(id, data) {
  const db = getDatabase()
  
  // 获取旧数据
  const oldData = await getSubscriptionById(id)
  if (!oldData) return null
  
  const result = await db.prepare(`
    UPDATE service_subscriptions SET
      name = COALESCE($1, name),
      category = COALESCE($2, category),
      provider = COALESCE($3, provider),
      description = COALESCE($4, description),
      domain = COALESCE($5, domain),
      environment = COALESCE($6, environment),
      start_date = COALESCE($7, start_date),
      expire_date = COALESCE($8, expire_date),
      auto_renew = COALESCE($9, auto_renew),
      renew_cycle_days = COALESCE($10, renew_cycle_days),
      is_paid = COALESCE($11, is_paid),
      cost_amount = COALESCE($12, cost_amount),
      cost_currency = COALESCE($13, cost_currency),
      billing_cycle = COALESCE($14, billing_cycle),
      remind_days = COALESCE($15, remind_days),
      remind_email = COALESCE($16, remind_email),
      status = COALESCE($17, status),
      config = COALESCE($18, config),
      notes = COALESCE($19, notes),
      updated_at = CURRENT_TIMESTAMP,
      updated_by = $20
    WHERE id = $21
    RETURNING *
  `).get(
    data.name,
    data.category,
    data.provider,
    data.description,
    data.domain,
    data.environment,
    data.startDate,
    data.expireDate,
    data.autoRenew,
    data.renewCycleDays,
    data.isPaid,
    data.costAmount,
    data.costCurrency,
    data.billingCycle,
    data.remindDays,
    data.remindEmail,
    data.status,
    data.config ? JSON.stringify(data.config) : null,
    data.notes,
    data.updatedBy,
    id
  )
  
  // 记录日志
  await addLog(id, 'updated', oldData, result, '更新服务订阅', data.updatedBy)
  
  return result
}

/**
 * 删除订阅
 */
export async function deleteSubscription(id, deletedBy) {
  const db = getDatabase()
  
  const oldData = await getSubscriptionById(id)
  if (!oldData) return false
  
  await db.prepare('DELETE FROM service_subscriptions WHERE id = $1').run(id)
  
  return true
}

/**
 * 更新所有订阅状态（定时任务调用）
 */
export async function updateAllStatus() {
  const db = getDatabase()
  
  // 更新已过期的服务
  const expiredResult = await db.prepare(`
    UPDATE service_subscriptions 
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date < CURRENT_DATE 
      AND status NOT IN ('expired', 'disabled')
    RETURNING id, name
  `).all()
  
  // 更新即将到期的服务
  const expiringResult = await db.prepare(`
    UPDATE service_subscriptions 
    SET status = 'expiring', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date >= CURRENT_DATE 
      AND expire_date <= CURRENT_DATE + remind_days
      AND status = 'active'
    RETURNING id, name
  `).all()
  
  // 更新恢复正常的服务（续期后）
  const activeResult = await db.prepare(`
    UPDATE service_subscriptions 
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date > CURRENT_DATE + remind_days
      AND status = 'expiring'
    RETURNING id, name
  `).all()
  
  return {
    expired: expiredResult || [],
    expiring: expiringResult || [],
    restored: activeResult || []
  }
}

/**
 * 获取即将到期的订阅（用于提醒）
 */
export async function getExpiringSubscriptions(days = 30) {
  const db = getDatabase()
  
  return await db.prepare(`
    SELECT * FROM service_subscriptions
    WHERE expire_date IS NOT NULL
      AND expire_date <= CURRENT_DATE + $1
      AND expire_date >= CURRENT_DATE
      AND status != 'disabled'
    ORDER BY expire_date ASC
  `).all(days)
}

/**
 * 获取需要提醒的订阅（未发送过提醒或超过提醒间隔）
 */
export async function getSubscriptionsNeedRemind() {
  const db = getDatabase()
  
  return await db.prepare(`
    SELECT * FROM service_subscriptions
    WHERE expire_date IS NOT NULL
      AND expire_date <= CURRENT_DATE + remind_days
      AND expire_date >= CURRENT_DATE
      AND status != 'disabled'
      AND (last_reminded_at IS NULL OR last_reminded_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
    ORDER BY expire_date ASC
  `).all()
}

/**
 * 更新提醒时间
 */
export async function updateRemindedAt(id) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE service_subscriptions 
    SET last_reminded_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `).run(id)
}

/**
 * 续期订阅
 */
export async function renewSubscription(id, newExpireDate, renewedBy) {
  const db = getDatabase()
  
  const oldData = await getSubscriptionById(id)
  if (!oldData) return null
  
  const result = await db.prepare(`
    UPDATE service_subscriptions SET
      start_date = expire_date,
      expire_date = $1,
      status = 'active',
      last_reminded_at = NULL,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = $2
    WHERE id = $3
    RETURNING *
  `).get(newExpireDate, renewedBy, id)
  
  // 记录日志
  await addLog(id, 'renewed', oldData, result, `续期至 ${newExpireDate}`, renewedBy)
  
  return result
}

/**
 * 获取统计数据
 */
export async function getStatistics() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'expiring') as expiring,
      COUNT(*) FILTER (WHERE status = 'expired') as expired,
      COUNT(*) FILTER (WHERE status = 'disabled') as disabled,
      COUNT(*) FILTER (WHERE is_paid = true) as paid,
      COUNT(*) FILTER (WHERE is_paid = false) as free,
      COUNT(*) FILTER (WHERE category = 'ssl') as ssl_count,
      COUNT(*) FILTER (WHERE category = 'auth') as auth_count,
      COUNT(*) FILTER (WHERE category = 'api') as api_count,
      COUNT(*) FILTER (WHERE category = 'cloud') as cloud_count,
      COUNT(*) FILTER (WHERE category = 'domain') as domain_count
    FROM service_subscriptions
  `).get()
  
  // 获取即将到期的服务
  const upcoming = await db.prepare(`
    SELECT id, name, category, expire_date, 
           (expire_date - CURRENT_DATE) as days_left
    FROM service_subscriptions
    WHERE expire_date IS NOT NULL
      AND expire_date >= CURRENT_DATE
      AND expire_date <= CURRENT_DATE + 30
      AND status != 'disabled'
    ORDER BY expire_date ASC
    LIMIT 5
  `).all()
  
  return { ...stats, upcoming }
}

/**
 * 添加操作日志
 */
async function addLog(subscriptionId, action, oldValue, newValue, message, createdBy) {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO service_subscription_logs (
      subscription_id, action, old_value, new_value, message, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `).run(
    subscriptionId,
    action,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    message,
    createdBy
  )
}

/**
 * 获取操作日志
 */
export async function getLogs(subscriptionId, limit = 20) {
  const db = getDatabase()
  
  return await db.prepare(`
    SELECT l.*, u.name as operator_name
    FROM service_subscription_logs l
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.subscription_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2
  `).all(subscriptionId, limit)
}

/**
 * 检查 SSL 证书有效期（通过 OpenSSL）
 */
export async function checkSslCertificate(domain) {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)
  
  try {
    const { stdout } = await execAsync(
      `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates -issuer 2>/dev/null`
    )
    
    const lines = stdout.trim().split('\n')
    const result = {}
    
    for (const line of lines) {
      if (line.startsWith('notBefore=')) {
        result.startDate = new Date(line.replace('notBefore=', '')).toISOString().split('T')[0]
      } else if (line.startsWith('notAfter=')) {
        result.expireDate = new Date(line.replace('notAfter=', '')).toISOString().split('T')[0]
      } else if (line.startsWith('issuer=')) {
        result.issuer = line.replace('issuer=', '')
      }
    }
    
    // 计算剩余天数
    if (result.expireDate) {
      const expireTime = new Date(result.expireDate).getTime()
      const now = Date.now()
      result.daysLeft = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24))
    }
    
    result.success = true
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * 批量检查并更新 SSL 证书状态
 */
export async function checkAndUpdateSslCertificates() {
  const db = getDatabase()
  
  const sslSubscriptions = await db.prepare(`
    SELECT * FROM service_subscriptions 
    WHERE category = 'ssl' AND domain IS NOT NULL AND status != 'disabled'
  `).all()
  
  const results = []
  
  for (const sub of sslSubscriptions) {
    const checkResult = await checkSslCertificate(sub.domain)
    
    if (checkResult.success) {
      // 更新数据库中的证书信息
      await db.prepare(`
        UPDATE service_subscriptions SET
          start_date = $1,
          expire_date = $2,
          last_checked_at = CURRENT_TIMESTAMP,
          check_result = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `).run(
        checkResult.startDate,
        checkResult.expireDate,
        JSON.stringify(checkResult),
        sub.id
      )
      
      results.push({
        id: sub.id,
        name: sub.name,
        domain: sub.domain,
        ...checkResult
      })
    } else {
      results.push({
        id: sub.id,
        name: sub.name,
        domain: sub.domain,
        error: checkResult.error
      })
    }
  }
  
  // 更新状态
  await updateAllStatus()
  
  return results
}

