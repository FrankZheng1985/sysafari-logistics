/**
 * 税号自动验证定时任务
 * 每月1号凌晨2点自动检测所有税号的有效性
 */

import cron from 'node-cron'
import { getDatabase } from '../../config/database.js'
import { validateVAT, validateEORI } from './taxValidation.js'

// 批量验证的并发限制（避免API限流）
const CONCURRENT_LIMIT = 3
// 每次验证之间的延迟（毫秒）
const DELAY_BETWEEN_VALIDATIONS = 2000

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 批量验证所有税号
 */
export async function validateAllTaxNumbers() {
  console.log('🔄 [税号自动验证] 开始执行定时验证任务...')
  const startTime = Date.now()
  
  try {
    const db = await getDatabase()
    
    // 获取所有需要验证的税号（VAT和EORI）
    const taxNumbers = await db.prepare(`
      SELECT id, customer_id, tax_type, tax_number, company_name, is_verified, verified_at
      FROM customer_tax_numbers
      WHERE tax_type IN ('vat', 'eori')
      ORDER BY verified_at ASC NULLS FIRST
    `).all()
    
    console.log(`📋 [税号自动验证] 共找到 ${taxNumbers.length} 条税号需要验证`)
    
    if (taxNumbers.length === 0) {
      console.log('✅ [税号自动验证] 没有需要验证的税号')
      return { success: true, total: 0, validated: 0, failed: 0 }
    }
    
    let validated = 0
    let failed = 0
    const results = []
    
    // 逐个验证（加入延迟避免API限流）
    for (const tax of taxNumbers) {
      try {
        let result
        
        if (tax.tax_type === 'vat') {
          result = await validateVAT(tax.tax_number)
        } else if (tax.tax_type === 'eori') {
          result = await validateEORI(tax.tax_number)
        } else {
          continue
        }
        
        // 更新数据库
        const isVerified = result.valid ? 1 : 0
        const verificationData = result.verificationData || JSON.stringify({
          valid: result.valid,
          error: result.error,
          checkedAt: new Date().toISOString()
        })
        
        await db.prepare(`
          UPDATE customer_tax_numbers
          SET is_verified = ?,
              verified_at = CURRENT_TIMESTAMP,
              verification_data = ?,
              company_name = COALESCE(NULLIF(?, ''), company_name),
              company_address = COALESCE(NULLIF(?, ''), company_address),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(isVerified, verificationData, result.companyName || '', result.companyAddress || '', tax.id)
        
        results.push({
          id: tax.id,
          taxNumber: tax.tax_number,
          taxType: tax.tax_type,
          valid: result.valid,
          previousStatus: tax.is_verified === 1
        })
        
        if (result.valid) {
          validated++
        } else {
          failed++
        }
        
        console.log(`  ${result.valid ? '✅' : '❌'} [${tax.tax_type.toUpperCase()}] ${tax.tax_number} - ${result.valid ? '有效' : (result.error || '无效')}`)
        
        // 延迟避免API限流
        await delay(DELAY_BETWEEN_VALIDATIONS)
        
      } catch (error) {
        console.error(`  ⚠️ [${tax.tax_type.toUpperCase()}] ${tax.tax_number} 验证出错:`, error.message)
        failed++
        results.push({
          id: tax.id,
          taxNumber: tax.tax_number,
          taxType: tax.tax_type,
          valid: false,
          error: error.message
        })
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`✅ [税号自动验证] 验证完成！耗时 ${duration}s`)
    console.log(`   总计: ${taxNumbers.length} | 有效: ${validated} | 无效: ${failed}`)
    
    // 记录验证日志
    try {
      await db.prepare(`
        INSERT INTO activity_logs (module, action, description, created_at)
        VALUES ('crm', 'tax_auto_validate', ?, CURRENT_TIMESTAMP)
      `).run(JSON.stringify({
        total: taxNumbers.length,
        validated,
        failed,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      }))
    } catch (logError) {
      // 日志记录失败不影响主流程
      console.warn('⚠️ 验证日志记录失败:', logError.message)
    }
    
    return {
      success: true,
      total: taxNumbers.length,
      validated,
      failed,
      duration: `${duration}s`,
      results
    }
    
  } catch (error) {
    console.error('❌ [税号自动验证] 任务执行失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 获取上次验证时间和统计
 */
export async function getValidationStats() {
  try {
    const db = await getDatabase()
    
    // 获取统计信息
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN is_verified = 0 OR is_verified IS NULL THEN 1 ELSE 0 END) as unverified,
        MAX(verified_at) as last_verified_at
      FROM customer_tax_numbers
      WHERE tax_type IN ('vat', 'eori')
    `).get()
    
    // 获取上次自动验证的日志
    const lastAutoValidation = await db.prepare(`
      SELECT description, created_at
      FROM activity_logs
      WHERE module = 'crm' AND action = 'tax_auto_validate'
      ORDER BY created_at DESC
      LIMIT 1
    `).get()
    
    return {
      total: stats?.total || 0,
      verified: stats?.verified || 0,
      unverified: stats?.unverified || 0,
      lastVerifiedAt: stats?.last_verified_at,
      lastAutoValidation: lastAutoValidation ? {
        ...JSON.parse(lastAutoValidation.description || '{}'),
        runAt: lastAutoValidation.created_at
      } : null
    }
  } catch (error) {
    console.error('获取验证统计失败:', error)
    return { error: error.message }
  }
}

/**
 * 启动定时任务
 * Cron表达式: '0 2 1 * *' = 每月1号凌晨2点执行
 */
export function startTaxValidationScheduler() {
  // 每月1号凌晨2点执行
  const cronExpression = '0 2 1 * *'
  
  const task = cron.schedule(cronExpression, async () => {
    console.log('\n========================================')
    console.log('🕐 [税号自动验证] 定时任务触发 - ' + new Date().toISOString())
    console.log('========================================\n')
    
    await validateAllTaxNumbers()
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai' // 使用中国时区
  })
  
  console.log('📅 [税号自动验证] 定时任务已启动 - 每月1号凌晨2:00执行')
  
  return task
}

export default {
  validateAllTaxNumbers,
  getValidationStats,
  startTaxValidationScheduler
}
