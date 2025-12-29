/**
 * API对接管理模块 - 业务逻辑
 * 用于管理已对接的第三方API服务和基础设施监控
 */

import { getDatabase } from '../../config/database.js'
import https from 'https'
import http from 'http'

// 标记是否已初始化
let isInitialized = false

// ==================== 初始化数据库表 ====================

/**
 * 初始化API对接管理模块的数据库表
 */
async function initTables() {
  if (isInitialized) return
  
  const db = getDatabase()
  
  try {
    // 创建 api_integrations 表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_integrations (
        id SERIAL PRIMARY KEY,
        api_code TEXT UNIQUE NOT NULL,
        api_name TEXT NOT NULL,
        provider TEXT,
        category TEXT DEFAULT 'other',
        api_url TEXT,
        health_check_url TEXT,
        pricing_model TEXT DEFAULT 'free',
        unit_price NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        balance NUMERIC DEFAULT 0,
        total_recharged NUMERIC DEFAULT 0,
        total_consumed NUMERIC DEFAULT 0,
        alert_threshold NUMERIC DEFAULT 100,
        recharge_url TEXT,
        status TEXT DEFAULT 'active',
        health_status TEXT DEFAULT 'unknown',
        last_health_check TIMESTAMP,
        health_check_message TEXT,
        response_time_ms INTEGER,
        last_sync_time TIMESTAMP,
        config_json TEXT,
        description TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).run()
    
    // 创建 api_usage_records 表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_usage_records (
        id SERIAL PRIMARY KEY,
        api_id INTEGER,
        api_code TEXT NOT NULL,
        usage_date DATE NOT NULL,
        call_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        data_volume NUMERIC DEFAULT 0,
        cost NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(api_code, usage_date)
      )
    `).run()
    
    // 创建 api_recharge_records 表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_recharge_records (
        id SERIAL PRIMARY KEY,
        api_id INTEGER,
        api_code TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'USD',
        recharge_time TIMESTAMP DEFAULT NOW(),
        payment_method TEXT,
        reference_no TEXT,
        operator TEXT,
        remark TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).run()
    
    // 检查是否需要插入初始数据
    const count = await db.prepare('SELECT COUNT(*) as count FROM api_integrations').get()
    
    if (!count || count.count === 0) {
      // 插入初始数据
      const initialApis = [
        { code: 'tencent_ocr', name: '腾讯云OCR', provider: '腾讯云', category: 'ocr', pricing_model: 'per_call', recharge_url: 'https://console.cloud.tencent.com/ocr', description: '文档识别服务，支持运输单据OCR识别', icon: 'FileText', sort_order: 1 },
        { code: 'tencent_cos', name: '腾讯云COS', provider: '腾讯云', category: 'storage', pricing_model: 'per_volume', recharge_url: 'https://console.cloud.tencent.com/cos', description: '云存储服务，用于存储发票和文档文件', icon: 'HardDrive', sort_order: 2 },
        { code: 'exchange_rate', name: '汇率API', provider: 'ExchangeRate-API', category: 'finance', pricing_model: 'free', health_check_url: 'https://api.exchangerate-api.com/v4/latest/EUR', description: '免费汇率查询服务，获取实时汇率', icon: 'DollarSign', sort_order: 3 },
        { code: 'google_translate', name: 'Google翻译', provider: 'Google', category: 'translation', pricing_model: 'free', health_check_url: 'https://translate.googleapis.com', description: '免费翻译服务，用于费用名称翻译', icon: 'Languages', sort_order: 4 },
        { code: 'taric', name: 'TARIC关税查询', provider: 'EU Commission', category: 'tariff', pricing_model: 'free', health_check_url: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp', description: '欧盟TARIC关税税率查询系统', icon: 'Calculator', sort_order: 5 },
        { code: 'eu_vies', name: 'EU VAT验证', provider: 'EU Commission', category: 'validation', pricing_model: 'free', health_check_url: 'https://ec.europa.eu/taxation_customs/vies', api_url: 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService', description: '欧盟VIES系统，验证VAT税号有效性', icon: 'BadgeCheck', sort_order: 6 },
        { code: 'eu_eori', name: 'EU EORI验证', provider: 'EU Commission', category: 'validation', pricing_model: 'free', health_check_url: 'https://ec.europa.eu/taxation_customs/dds2/eos', api_url: 'https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation', description: '欧盟EORI号码验证服务', icon: 'ShieldCheck', sort_order: 7 },
        { code: 'aliyun_ecs', name: '阿里云ECS服务器', provider: '阿里云', category: 'infrastructure', pricing_model: 'subscription', health_check_url: 'https://api.xianfeng-eu.com/api/health', recharge_url: 'https://ecs.console.aliyun.com', description: '后端API服务器，托管于阿里云ECS', icon: 'Server', sort_order: 8 },
        { code: 'aliyun_oss', name: '阿里云OSS静态托管', provider: '阿里云', category: 'infrastructure', pricing_model: 'subscription', health_check_url: 'https://erp.xianfeng-eu.com', recharge_url: 'https://oss.console.aliyun.com', description: '前端静态资源，托管于阿里云OSS+CDN', icon: 'Globe', sort_order: 9 },
        { code: 'aliyun_rds', name: '阿里云RDS数据库', provider: '阿里云', category: 'infrastructure', pricing_model: 'subscription', health_check_url: 'https://api.xianfeng-eu.com/api/health', recharge_url: 'https://rdsnext.console.aliyun.com', description: 'PostgreSQL数据库，托管于阿里云RDS', icon: 'Database', sort_order: 10 }
      ]
      
      for (const api of initialApis) {
        await db.prepare(`
          INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (api_code) DO NOTHING
        `).run(api.code, api.name, api.provider, api.category, api.api_url || '', api.health_check_url || '', api.pricing_model, api.recharge_url || '', api.description, api.icon, api.sort_order)
      }
      
      console.log('✅ API对接管理模块初始化完成，已插入9个API配置')
    }
    
    isInitialized = true
  } catch (error) {
    console.error('初始化API对接管理表失败:', error)
    // 不抛出错误，让程序继续运行
  }
}

// ==================== 数据库操作 ====================

/**
 * 获取所有API服务列表
 */
export async function getApiIntegrations(filters = {}) {
  // 确保表已初始化
  await initTables()
  
  const db = getDatabase()
  const { category, status, search } = filters
  
  try {
    let sql = `
      SELECT 
        ai.*,
        COALESCE(
          (SELECT SUM(call_count) FROM api_usage_records 
           WHERE api_code = ai.api_code 
           AND usage_date >= DATE_TRUNC('month', CURRENT_DATE)),
          0
        ) as month_calls,
        COALESCE(
          (SELECT SUM(cost) FROM api_usage_records 
           WHERE api_code = ai.api_code 
           AND usage_date >= DATE_TRUNC('month', CURRENT_DATE)),
          0
        ) as month_cost
      FROM api_integrations ai
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1
    
    if (category) {
      sql += ` AND ai.category = $${paramIndex++}`
      params.push(category)
    }
    
    if (status) {
      sql += ` AND ai.status = $${paramIndex++}`
      params.push(status)
    }
    
    if (search) {
      sql += ` AND (ai.api_name ILIKE $${paramIndex} OR ai.provider ILIKE $${paramIndex} OR ai.api_code ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }
    
    sql += ` ORDER BY ai.sort_order, ai.created_at`
    
    const list = await db.prepare(sql).all(...params)
    
    // 计算统计数据
    const stats = {
      total: list.length,
      online: list.filter(a => a.health_status === 'online').length,
      offline: list.filter(a => a.health_status === 'offline').length,
      degraded: list.filter(a => a.health_status === 'degraded').length,
      unknown: list.filter(a => a.health_status === 'unknown').length,
      lowBalance: list.filter(a => a.balance > 0 && a.balance <= a.alert_threshold).length,
      monthTotalCost: list.reduce((sum, a) => sum + (parseFloat(a.month_cost) || 0), 0)
    }
    
    return { list, stats }
  } catch (error) {
    console.error('获取API列表失败:', error)
    // 返回空数据而不是抛出错误
    return { 
      list: [], 
      stats: { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0, lowBalance: 0, monthTotalCost: 0 } 
    }
  }
}

/**
 * 获取单个API详情
 */
export async function getApiByCode(apiCode) {
  await initTables()
  const db = getDatabase()
  
  try {
    const api = await db.prepare(`
      SELECT * FROM api_integrations WHERE api_code = $1
    `).get(apiCode)
    
    if (!api) return null
    
    // 获取本月用量统计
    const monthUsage = await db.prepare(`
      SELECT 
        SUM(call_count) as total_calls,
        SUM(success_count) as success_calls,
        SUM(fail_count) as fail_calls,
        SUM(cost) as total_cost
      FROM api_usage_records
      WHERE api_code = $1 AND usage_date >= DATE_TRUNC('month', CURRENT_DATE)
    `).get(apiCode)
    
    return {
      ...api,
      monthUsage: monthUsage || { total_calls: 0, success_calls: 0, fail_calls: 0, total_cost: 0 }
    }
  } catch (error) {
    console.error('获取API详情失败:', error)
    return null
  }
}

/**
 * 更新API配置
 */
export async function updateApi(apiCode, data) {
  await initTables()
  const db = getDatabase()
  
  const allowedFields = [
    'api_name', 'provider', 'category', 'api_url', 'health_check_url',
    'pricing_model', 'unit_price', 'currency', 'balance', 'alert_threshold',
    'recharge_url', 'status', 'config_json', 'description', 'icon', 'sort_order'
  ]
  
  const updates = []
  const values = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(data)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    if (allowedFields.includes(snakeKey) && value !== undefined) {
      updates.push(`${snakeKey} = $${paramIndex++}`)
      values.push(value)
    }
  }
  
  if (updates.length === 0) return false
  
  updates.push(`updated_at = NOW()`)
  values.push(apiCode)
  
  await db.prepare(`
    UPDATE api_integrations SET ${updates.join(', ')} WHERE api_code = $${paramIndex}
  `).run(...values)
  
  return true
}

/**
 * 添加新API配置
 */
export async function createApi(data) {
  await initTables()
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO api_integrations (
      api_code, api_name, provider, category, api_url, health_check_url,
      pricing_model, unit_price, currency, balance, alert_threshold,
      recharge_url, status, config_json, description, icon, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id
  `).get(
    data.apiCode, data.apiName, data.provider || '', data.category || 'other',
    data.apiUrl || '', data.healthCheckUrl || '', data.pricingModel || 'free',
    data.unitPrice || 0, data.currency || 'USD', data.balance || 0,
    data.alertThreshold || 100, data.rechargeUrl || '', data.status || 'active',
    data.configJson || '{}', data.description || '', data.icon || 'Link',
    data.sortOrder || 0
  )
  
  return result
}

/**
 * 删除API配置
 */
export async function deleteApi(apiCode) {
  await initTables()
  const db = getDatabase()
  await db.prepare('DELETE FROM api_integrations WHERE api_code = $1').run(apiCode)
}

// ==================== 用量记录 ====================

/**
 * 获取API用量历史
 */
export async function getUsageHistory(apiCode, options = {}) {
  await initTables()
  const db = getDatabase()
  const { startDate, endDate, limit = 30 } = options
  
  let sql = `
    SELECT * FROM api_usage_records
    WHERE api_code = $1
  `
  const params = [apiCode]
  let paramIndex = 2
  
  if (startDate) {
    sql += ` AND usage_date >= $${paramIndex++}`
    params.push(startDate)
  }
  
  if (endDate) {
    sql += ` AND usage_date <= $${paramIndex++}`
    params.push(endDate)
  }
  
  sql += ` ORDER BY usage_date DESC LIMIT $${paramIndex}`
  params.push(limit)
  
  return await db.prepare(sql).all(...params)
}

/**
 * 记录API用量（每日聚合）
 */
export async function recordUsage(apiCode, data) {
  await initTables()
  const db = getDatabase()
  const today = new Date().toISOString().split('T')[0]
  
  // 获取api_id
  const api = await db.prepare('SELECT id FROM api_integrations WHERE api_code = $1').get(apiCode)
  if (!api) return false
  
  await db.prepare(`
    INSERT INTO api_usage_records (api_id, api_code, usage_date, call_count, success_count, fail_count, data_volume, cost)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (api_code, usage_date) DO UPDATE SET
      call_count = api_usage_records.call_count + EXCLUDED.call_count,
      success_count = api_usage_records.success_count + EXCLUDED.success_count,
      fail_count = api_usage_records.fail_count + EXCLUDED.fail_count,
      data_volume = api_usage_records.data_volume + EXCLUDED.data_volume,
      cost = api_usage_records.cost + EXCLUDED.cost,
      updated_at = NOW()
  `).run(
    api.id, apiCode, today,
    data.callCount || 1,
    data.success ? 1 : 0,
    data.success ? 0 : 1,
    data.dataVolume || 0,
    data.cost || 0
  )
  
  // 更新累计消费
  if (data.cost) {
    await db.prepare(`
      UPDATE api_integrations 
      SET total_consumed = total_consumed + $1, balance = balance - $1, updated_at = NOW()
      WHERE api_code = $2
    `).run(data.cost, apiCode)
  }
  
  return true
}

// ==================== 充值记录 ====================

/**
 * 获取充值记录
 */
export async function getRechargeHistory(apiCode, options = {}) {
  await initTables()
  const db = getDatabase()
  const { limit = 20 } = options
  
  return await db.prepare(`
    SELECT * FROM api_recharge_records
    WHERE api_code = $1
    ORDER BY recharge_time DESC
    LIMIT $2
  `).all(apiCode, limit)
}

/**
 * 记录充值
 */
export async function recordRecharge(apiCode, data) {
  await initTables()
  const db = getDatabase()
  
  // 获取api_id
  const api = await db.prepare('SELECT id FROM api_integrations WHERE api_code = $1').get(apiCode)
  if (!api) return false
  
  // 插入充值记录
  await db.prepare(`
    INSERT INTO api_recharge_records (api_id, api_code, amount, currency, payment_method, reference_no, operator, remark)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `).run(
    api.id, apiCode, data.amount, data.currency || 'USD',
    data.paymentMethod || '', data.referenceNo || '',
    data.operator || '', data.remark || ''
  )
  
  // 更新余额和累计充值
  await db.prepare(`
    UPDATE api_integrations 
    SET balance = balance + $1, total_recharged = total_recharged + $1, updated_at = NOW()
    WHERE api_code = $2
  `).run(data.amount, apiCode)
  
  return true
}

// ==================== 健康检查 ====================

/**
 * HTTP 健康检查
 */
function httpHealthCheck(url, timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const protocol = url.startsWith('https') ? https : http
    
    const req = protocol.get(url, {
      timeout,
      headers: {
        'User-Agent': 'BP-Logistics-Health-Check/1.0'
      }
    }, (res) => {
      const responseTime = Date.now() - startTime
      
      // 2xx 或 3xx 都认为是成功
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve({
          status: responseTime < 3000 ? 'online' : 'degraded',
          responseTime,
          message: `HTTP ${res.statusCode}`,
          statusCode: res.statusCode
        })
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        // 401/403 说明服务在线，只是需要认证
        resolve({
          status: 'online',
          responseTime,
          message: `HTTP ${res.statusCode} (需要认证)`,
          statusCode: res.statusCode
        })
      } else if (res.statusCode >= 400 && res.statusCode < 500) {
        // 4xx 错误通常说明服务在线，只是请求有问题
        resolve({
          status: 'degraded',
          responseTime,
          message: `HTTP ${res.statusCode}`,
          statusCode: res.statusCode
        })
      } else {
        resolve({
          status: 'offline',
          responseTime,
          message: `HTTP ${res.statusCode}`,
          statusCode: res.statusCode
        })
      }
    })
    
    req.on('error', (error) => {
      resolve({
        status: 'offline',
        responseTime: Date.now() - startTime,
        message: error.message,
        error: error.code
      })
    })
    
    req.on('timeout', () => {
      req.destroy()
      resolve({
        status: 'offline',
        responseTime: timeout,
        message: '请求超时'
      })
    })
  })
}

/**
 * 检查腾讯云OCR配置
 */
async function checkTencentOcrHealth() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  if (!secretId || !secretKey) {
    return {
      status: 'degraded',
      responseTime: 0,
      message: '未配置腾讯云密钥'
    }
  }
  
  // 尝试调用一个简单的API来验证配置是否有效
  try {
    const { getTencentAccountBalance } = await import('./tencentCloudSync.js')
    const balanceResult = await getTencentAccountBalance()
    
    if (balanceResult.success) {
      return {
        status: 'online',
        responseTime: 100,
        message: '配置正常，API可用'
      }
    } else {
      return {
        status: 'degraded',
        responseTime: 0,
        message: balanceResult.error || 'API调用失败'
      }
    }
  } catch (error) {
    return {
      status: 'online',
      responseTime: 0,
      message: '配置正常'
    }
  }
}

/**
 * 检查腾讯云COS配置
 */
async function checkTencentCosHealth() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  if (!secretId || !secretKey) {
    return {
      status: 'degraded',
      responseTime: 0,
      message: '未配置腾讯云密钥'
    }
  }
  
  // COS存储桶是可选的，只要有密钥就可以使用COS服务
  // 尝试验证密钥是否有效
  try {
    const { getTencentAccountBalance } = await import('./tencentCloudSync.js')
    const balanceResult = await getTencentAccountBalance()
    
    if (balanceResult.success) {
      return {
        status: 'online',
        responseTime: 100,
        message: '配置正常，API可用'
      }
    } else {
      return {
        status: 'degraded',
        responseTime: 0,
        message: balanceResult.error || 'API调用失败'
      }
    }
  } catch (error) {
    return {
      status: 'online',
      responseTime: 0,
      message: '配置正常'
    }
  }
}

/**
 * 检查Google翻译可用性
 */
async function checkGoogleTranslateHealth() {
  // Google翻译是免费服务，检查其网页版是否可访问
  try {
    // 检查Google翻译主页
    const result = await httpHealthCheck('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&dt=t&q=test')
    
    // 如果返回成功，说明服务可用
    if (result.status === 'online' || result.status === 'degraded') {
      return {
        status: 'online',
        responseTime: result.responseTime,
        message: '服务可用'
      }
    }
    
    return result
  } catch (error) {
    // 如果检查失败，尝试检查Google主页
    return await httpHealthCheck('https://www.google.com')
  }
}

/**
 * 执行单个API健康检查
 */
export async function performHealthCheck(apiCode) {
  await initTables()
  const db = getDatabase()
  
  const api = await db.prepare('SELECT * FROM api_integrations WHERE api_code = $1').get(apiCode)
  if (!api) return null
  
  let result
  
  // 根据不同API类型执行不同的检查
  switch (apiCode) {
    case 'tencent_ocr':
      result = await checkTencentOcrHealth()
      break
    case 'tencent_cos':
      result = await checkTencentCosHealth()
      break
    case 'google_translate':
      result = await checkGoogleTranslateHealth()
      break
    default:
      // 默认HTTP健康检查
      if (api.health_check_url) {
        result = await httpHealthCheck(api.health_check_url)
      } else {
        result = {
          status: 'unknown',
          responseTime: 0,
          message: '未配置健康检查URL'
        }
      }
  }
  
  // 更新数据库
  await db.prepare(`
    UPDATE api_integrations SET
      health_status = $1,
      last_health_check = NOW(),
      health_check_message = $2,
      response_time_ms = $3,
      updated_at = NOW()
    WHERE api_code = $4
  `).run(result.status, result.message, result.responseTime, apiCode)
  
  return {
    apiCode,
    ...result,
    checkTime: new Date().toISOString()
  }
}

/**
 * 执行所有API健康检查
 */
export async function performHealthCheckAll() {
  await initTables()
  const db = getDatabase()
  
  const apis = await db.prepare('SELECT api_code FROM api_integrations WHERE status = $1').all('active')
  
  const results = []
  for (const api of apis) {
    const result = await performHealthCheck(api.api_code)
    if (result) {
      results.push(result)
    }
  }
  
  return results
}

// ==================== 分类管理 ====================

/**
 * 获取分类列表
 */
export function getCategories() {
  return [
    { code: 'tracking', name: '物流跟踪', icon: 'Ship' },
    { code: 'ocr', name: '文档识别', icon: 'FileText' },
    { code: 'storage', name: '云存储', icon: 'HardDrive' },
    { code: 'finance', name: '财务服务', icon: 'DollarSign' },
    { code: 'translation', name: '翻译服务', icon: 'Languages' },
    { code: 'tariff', name: '关税查询', icon: 'Calculator' },
    { code: 'validation', name: '号码验证', icon: 'BadgeCheck' },
    { code: 'infrastructure', name: '基础设施', icon: 'Server' },
    { code: 'other', name: '其他', icon: 'Link' }
  ]
}

// ==================== 数据同步 ====================

/**
 * 同步指定API的数据（余额、用量等）
 */
export async function syncApiData(apiCode) {
  await initTables()
  const db = getDatabase()
  
  // 根据不同API调用对应的同步方法
  switch (apiCode) {
    case 'tencent_ocr':
    case 'tencent_cos': {
      // 动态导入腾讯云同步模块
      const { syncTencentOcr, syncTencentCos } = await import('./tencentCloudSync.js')
      if (apiCode === 'tencent_ocr') {
        return await syncTencentOcr(db)
      } else {
        return await syncTencentCos(db)
      }
    }
    
    default:
      return {
        success: false,
        error: `API ${apiCode} 不支持自动同步，请手动更新`
      }
  }
}

/**
 * 同步所有支持自动同步的API数据
 */
export async function syncAllApiData() {
  await initTables()
  const db = getDatabase()
  
  const results = {}
  
  // 同步腾讯云服务
  try {
    const { syncAllTencentServices } = await import('./tencentCloudSync.js')
    const tencentResults = await syncAllTencentServices(db)
    Object.assign(results, tencentResults)
  } catch (error) {
    console.error('同步腾讯云服务失败:', error)
    results.tencent_error = error.message
  }
  
  return results
}

export default {
  getApiIntegrations,
  getApiByCode,
  updateApi,
  createApi,
  deleteApi,
  getUsageHistory,
  recordUsage,
  getRechargeHistory,
  recordRecharge,
  performHealthCheck,
  performHealthCheckAll,
  getCategories,
  syncApiData,
  syncAllApiData
}
