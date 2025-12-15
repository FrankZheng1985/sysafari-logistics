/**
 * 修复演示账号密码
 * 将 demo_admin 和 demo_operator 的密码设置为 demo123
 * 
 * 运行方式: 
 * 1. 设置环境变量 DATABASE_URL 指向测试数据库
 * 2. node server/scripts/fix-demo-password.js
 */

import pg from 'pg'
import crypto from 'crypto'

// 密码哈希函数（与系统保持一致）
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
}

async function fixDemoPassword() {
  // 测试数据库连接字符串
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
  
  if (!DATABASE_URL) {
    console.error('❌ 请设置 DATABASE_URL 或 DATABASE_URL_TEST 环境变量')
    process.exit(1)
  }

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔗 连接数据库...')
    
    // 计算 demo123 的密码哈希
    const newPasswordHash = hashPassword('demo123')
    console.log('📝 新密码哈希:', newPasswordHash)
    
    // 更新演示用户密码
    const result = await pool.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE username IN ('demo_admin', 'demo_operator')
      RETURNING id, username, name
    `, [newPasswordHash])
    
    if (result.rowCount > 0) {
      console.log('✅ 成功更新以下用户的密码:')
      result.rows.forEach(user => {
        console.log(`   - ${user.username} (${user.name})`)
      })
      console.log('\n🎉 演示账号密码已更新为: demo123')
    } else {
      console.log('⚠️ 没有找到演示用户 (demo_admin, demo_operator)')
    }
    
  } catch (error) {
    console.error('❌ 更新失败:', error.message)
  } finally {
    await pool.end()
  }
}

fixDemoPassword()

