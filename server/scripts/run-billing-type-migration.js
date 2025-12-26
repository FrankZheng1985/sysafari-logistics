/**
 * 运行 billing_type 字段迁移
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDatabase } from '../config/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigration() {
  try {
    const db = getDatabase()
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migrations/add_billing_type_to_fee_items.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    
    console.log('执行迁移...')
    
    // 分割 SQL 语句并执行
    const statements = sql.split(';').filter(s => s.trim())
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await db.pool.query(stmt)
          console.log('✅ 执行成功:', stmt.substring(0, 50) + '...')
        } catch (err) {
          // 忽略 "column already exists" 错误
          if (!err.message.includes('already exists')) {
            console.error('执行失败:', err.message)
          } else {
            console.log('⚠️ 字段已存在，跳过')
          }
        }
      }
    }
    
    console.log('✅ 迁移完成！')
    process.exit(0)
  } catch (error) {
    console.error('迁移失败:', error)
    process.exit(1)
  }
}

runMigration()

