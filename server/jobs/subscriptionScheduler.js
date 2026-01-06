/**
 * 服务订阅定时任务调度器
 * 定期检查订阅状态、SSL证书有效期，发送到期提醒
 */

import cron from 'node-cron'
import * as model from '../modules/subscription/model.js'

// 邮件服务（可选）
let emailService = null
try {
  const { sendEmail } = await import('../utils/emailService.js')
  emailService = sendEmail
} catch (e) {
  console.log('📧 邮件服务未配置，到期提醒将不会发送邮件')
}

/**
 * 检查并更新订阅状态
 */
async function checkSubscriptionStatus() {
  console.log('🔄 [订阅检查] 开始检查订阅状态...')
  
  try {
    // 更新所有订阅状态
    const statusResult = await model.updateAllStatus()
    
    console.log(`📊 [订阅检查] 状态更新完成:`)
    console.log(`   - 已过期: ${statusResult.expired.length} 个`)
    console.log(`   - 即将到期: ${statusResult.expiring.length} 个`)
    console.log(`   - 恢复正常: ${statusResult.restored.length} 个`)
    
    // 记录过期的服务
    if (statusResult.expired.length > 0) {
      console.log('⚠️ [订阅检查] 已过期的服务:')
      statusResult.expired.forEach(s => console.log(`   - ${s.name}`))
    }
    
    // 记录即将到期的服务
    if (statusResult.expiring.length > 0) {
      console.log('⏰ [订阅检查] 即将到期的服务:')
      statusResult.expiring.forEach(s => console.log(`   - ${s.name}`))
    }
    
    return statusResult
  } catch (error) {
    console.error('❌ [订阅检查] 状态检查失败:', error)
    return null
  }
}

/**
 * 检查 SSL 证书有效期
 */
async function checkSslCertificates() {
  console.log('🔒 [SSL检查] 开始检查SSL证书...')
  
  try {
    const results = await model.checkAndUpdateSslCertificates()
    
    console.log(`📊 [SSL检查] 检查完成，共 ${results.length} 个证书`)
    
    results.forEach(r => {
      if (r.error) {
        console.log(`   ❌ ${r.name} (${r.domain}): 检查失败 - ${r.error}`)
      } else {
        const status = r.daysLeft <= 14 ? '⚠️' : r.daysLeft <= 30 ? '⏰' : '✅'
        console.log(`   ${status} ${r.name} (${r.domain}): 剩余 ${r.daysLeft} 天`)
      }
    })
    
    return results
  } catch (error) {
    console.error('❌ [SSL检查] 证书检查失败:', error)
    return null
  }
}

/**
 * 发送到期提醒
 */
async function sendExpirationReminders() {
  console.log('📧 [到期提醒] 检查需要提醒的订阅...')
  
  try {
    const subscriptions = await model.getSubscriptionsNeedRemind()
    
    if (subscriptions.length === 0) {
      console.log('📧 [到期提醒] 暂无需要提醒的订阅')
      return
    }
    
    console.log(`📧 [到期提醒] 发现 ${subscriptions.length} 个需要提醒的订阅`)
    
    for (const sub of subscriptions) {
      const daysLeft = Math.ceil(
        (new Date(sub.expire_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      
      // 生成提醒消息
      const message = `
服务订阅到期提醒

服务名称: ${sub.name}
分类: ${getCategoryName(sub.category)}
提供商: ${sub.provider || '未知'}
到期日期: ${sub.expire_date}
剩余天数: ${daysLeft} 天
${sub.is_paid ? `费用: ${sub.cost_amount} ${sub.cost_currency}` : '(免费服务)'}
${sub.auto_renew ? '✅ 已开启自动续期' : '⚠️ 需要手动续期'}

请及时处理，避免服务中断。
      `.trim()
      
      console.log(`📧 [到期提醒] ${sub.name}: 剩余 ${daysLeft} 天`)
      
      // 发送邮件（如果配置了）
      if (emailService && sub.remind_email) {
        try {
          await emailService({
            to: sub.remind_email,
            subject: `[Sysafari] 服务到期提醒: ${sub.name}`,
            text: message
          })
          console.log(`   ✅ 邮件已发送至 ${sub.remind_email}`)
        } catch (emailError) {
          console.error(`   ❌ 邮件发送失败:`, emailError.message)
        }
      }
      
      // 更新提醒时间
      await model.updateRemindedAt(sub.id)
    }
    
    return subscriptions
  } catch (error) {
    console.error('❌ [到期提醒] 发送提醒失败:', error)
    return null
  }
}

/**
 * 获取分类名称
 */
function getCategoryName(category) {
  const names = {
    ssl: 'SSL证书',
    auth: '认证服务',
    api: 'API服务',
    cloud: '云服务',
    domain: '域名'
  }
  return names[category] || category
}

/**
 * 初始化定时任务
 */
export function initSubscriptionScheduler() {
  console.log('⏰ 初始化服务订阅定时任务...')
  
  // 每天早上 8:00 检查订阅状态
  cron.schedule('0 8 * * *', async () => {
    console.log('\n========== 每日订阅检查 ==========')
    await checkSubscriptionStatus()
    await sendExpirationReminders()
    console.log('========== 检查完成 ==========\n')
  }, {
    timezone: 'Asia/Shanghai'
  })
  
  // 每周一早上 9:00 检查 SSL 证书
  cron.schedule('0 9 * * 1', async () => {
    console.log('\n========== 每周SSL证书检查 ==========')
    await checkSslCertificates()
    console.log('========== 检查完成 ==========\n')
  }, {
    timezone: 'Asia/Shanghai'
  })
  
  console.log('✅ 服务订阅定时任务已启动')
  console.log('   - 每日 08:00: 检查订阅状态、发送到期提醒')
  console.log('   - 每周一 09:00: 检查SSL证书有效期')
  
  // 启动时执行一次检查
  setTimeout(async () => {
    console.log('\n========== 启动时订阅检查 ==========')
    await checkSubscriptionStatus()
    console.log('========== 检查完成 ==========\n')
  }, 5000)
}

// 导出函数供手动调用
export {
  checkSubscriptionStatus,
  checkSslCertificates,
  sendExpirationReminders
}

