/**
 * 执行权限初始化脚本
 * 使用方法: node server/scripts/run-init-permissions.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 获取数据库连接
const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  process.exit(1)
}

// 判断是否为本地数据库
const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')

async function main() {
  console.log('🔄 开始执行权限初始化脚本...')
  console.log(`📍 数据库: ${isLocalhost ? '本地' : '云端'}`)
  
  // 读取 SQL 文件
  const sqlPath = path.join(__dirname, 'init-all-permissions.sql')
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8')
  
  // 创建数据库连接
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  })
  
  try {
    // 执行 SQL
    const result = await pool.query(sqlContent)
    
    console.log('\n✅ 权限初始化完成！\n')
    
    // 查询并显示结果
    const categoryStats = await pool.query(`
      SELECT 
        category AS "权限分类",
        COUNT(*) AS "权限数量"
      FROM permissions
      GROUP BY category
      ORDER BY 
        CASE category
          WHEN 'order' THEN 1
          WHEN 'document' THEN 2
          WHEN 'inspection' THEN 3
          WHEN 'cmr' THEN 4
          WHEN 'crm' THEN 5
          WHEN 'supplier' THEN 6
          WHEN 'finance' THEN 7
          WHEN 'product' THEN 8
          WHEN 'tool' THEN 9
          WHEN 'system' THEN 10
          ELSE 99
        END
    `)
    
    console.log('📊 权限分类统计:')
    console.log('─'.repeat(30))
    categoryStats.rows.forEach(row => {
      const icons = {
        'order': '📦',
        'document': '📄',
        'inspection': '🔍',
        'cmr': '🚚',
        'crm': '👥',
        'supplier': '🏭',
        'finance': '💰',
        'product': '🏷️',
        'tool': '🔧',
        'system': '⚙️'
      }
      const icon = icons[row['权限分类']] || '📌'
      console.log(`${icon} ${row['权限分类'].padEnd(12)} : ${row['权限数量']} 个权限`)
    })
    console.log('─'.repeat(30))
    
    // 总计
    const total = await pool.query('SELECT COUNT(*) as total FROM permissions')
    console.log(`📋 总计: ${total.rows[0].total} 个权限\n`)
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
