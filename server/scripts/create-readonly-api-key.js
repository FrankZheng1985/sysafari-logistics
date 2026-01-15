/**
 * 创建只读 API Key 脚本
 * 用于外部系统只读访问先锋物流ERP数据
 * 
 * 使用方法:
 * cd server && node scripts/create-readonly-api-key.js [名称] [client_id]
 * 
 * 示例:
 * node scripts/create-readonly-api-key.js "数据分析平台" "data_analytics"
 */

import crypto from 'crypto'
import { getDatabase, closeDatabase } from '../config/database.js'

/**
 * 生成 API Key
 */
function generateApiKey() {
  const randomPart = crypto.randomBytes(24).toString('hex')
  return `sk_read_${randomPart}`
}

/**
 * 计算 API Key 哈希
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * 创建只读 API Key
 */
async function createReadOnlyApiKey(name, clientId, expiresInDays = null) {
  const db = getDatabase()
  
  try {
    // 生成 API Key
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)
    
    // 计算过期时间
    let expiresAt = null
    if (expiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    }
    
    // 插入数据库
    const query = `
      INSERT INTO api_keys (
        name, 
        key_value, 
        key_hash, 
        client_id, 
        permissions, 
        rate_limit, 
        expires_at, 
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, name, client_id, permissions, rate_limit, expires_at, created_at
    `
    
    const values = [
      name,
      apiKey,  // 原始值，只在创建时显示
      keyHash,
      clientId,
      JSON.stringify(['read']),  // 只读权限
      1000,  // 每分钟1000次请求
      expiresAt,
      true
    ]
    
    const result = await db.prepare(query).get(...values)
    const record = result
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ 只读 API Key 创建成功！')
    console.log('='.repeat(60))
    console.log('\n📋 基本信息:')
    console.log(`   ID: ${record.id}`)
    console.log(`   名称: ${record.name}`)
    console.log(`   客户端ID: ${record.client_id}`)
    console.log(`   权限: ${record.permissions}`)
    console.log(`   速率限制: ${record.rate_limit} 次/分钟`)
    console.log(`   过期时间: ${record.expires_at || '永不过期'}`)
    console.log(`   创建时间: ${record.created_at}`)
    
    console.log('\n🔑 API Key（请妥善保存，此密钥只显示一次！）:')
    console.log('─'.repeat(60))
    console.log(`   ${apiKey}`)
    console.log('─'.repeat(60))
    
    console.log('\n📖 使用方法:')
    console.log('\n   方式1: Authorization Header')
    console.log('   curl -H "Authorization: Bearer ' + apiKey + '" \\')
    console.log('        https://api.xianfeng-eu.com/internal-api/health')
    
    console.log('\n   方式2: X-API-Key Header')
    console.log('   curl -H "X-API-Key: ' + apiKey + '" \\')
    console.log('        https://api.xianfeng-eu.com/internal-api/health')
    
    console.log('\n📚 可用的只读接口:')
    console.log('   GET /internal-api/health         - 健康检查')
    console.log('   GET /internal-api/orders         - 获取订单列表')
    console.log('   GET /internal-api/orders/:id     - 获取订单详情')
    console.log('   GET /internal-api/orders/stats   - 获取订单统计')
    console.log('   GET /internal-api/invoices       - 获取发票列表')
    console.log('   GET /internal-api/invoices/:id   - 获取发票详情')
    console.log('   GET /internal-api/payments       - 获取付款记录')
    console.log('   GET /internal-api/payments/:id   - 获取付款详情')
    console.log('   GET /internal-api/stats          - 获取综合统计')
    console.log('   GET /internal-api/financial-summary - 获取财务汇总')
    console.log('   GET /internal-api/monthly-stats  - 获取月度统计')
    
    console.log('\n⚠️  注意事项:')
    console.log('   - 此 API Key 只有读取权限，不能进行写入操作')
    console.log('   - 请妥善保管，不要在公开场合泄露')
    console.log('   - 如需禁用，请在数据库中将 is_active 设为 FALSE')
    console.log('\n' + '='.repeat(60) + '\n')
    
    return { apiKey, record }
  } catch (error) {
    console.error('创建 API Key 失败:', error.message)
    throw error
  }
}

// 主程序
async function main() {
  const args = process.argv.slice(2)
  
  // 默认值
  let name = '只读API账号'
  let clientId = 'readonly_client'
  let expiresInDays = null
  
  // 解析参数
  if (args.length >= 1) {
    name = args[0]
  }
  if (args.length >= 2) {
    clientId = args[1]
  }
  if (args.length >= 3) {
    expiresInDays = parseInt(args[2])
    if (isNaN(expiresInDays)) {
      expiresInDays = null
    }
  }
  
  console.log('\n🔧 正在创建只读 API Key...')
  console.log(`   名称: ${name}`)
  console.log(`   客户端ID: ${clientId}`)
  console.log(`   有效期: ${expiresInDays ? expiresInDays + '天' : '永久'}`)
  
  try {
    await createReadOnlyApiKey(name, clientId, expiresInDays)
  } finally {
    closeDatabase()
  }
}

main().then(() => {
  process.exit(0)
}).catch(err => {
  console.error('执行失败:', err)
  closeDatabase()
  process.exit(1)
})
