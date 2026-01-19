/**
 * 报价作废功能数据库迁移脚本
 * 执行命令: node server/scripts/database/migrate-quotation-void.js
 */

import { query, testConnection } from '../../config/database.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function migrate() {
  console.log('🚀 开始执行报价作废功能数据库迁移...\n')
  
  // 测试数据库连接
  console.log('1️⃣ 测试数据库连接...')
  const connected = await testConnection()
  if (!connected) {
    console.error('❌ 数据库连接失败，迁移中止')
    process.exit(1)
  }
  
  try {
    // 读取迁移SQL文件
    const migrationPath = path.join(__dirname, '../../database/migrations/add_quotation_void_fields.sql')
    console.log('\n2️⃣ 读取迁移文件:', migrationPath)
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ 迁移文件不存在:', migrationPath)
      process.exit(1)
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    console.log('✅ 迁移文件读取成功\n')
    
    // 分割SQL语句（按分号分隔，但忽略注释中的分号）
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--')) // 移除注释行
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
    
    console.log(`3️⃣ 开始执行 ${statements.length} 条SQL语句...\n`)
    
    // 执行每条SQL语句
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      console.log(`   [${i + 1}/${statements.length}] 执行: ${stmt.substring(0, 60)}...`)
      
      try {
        await query(stmt)
        console.log(`   ✅ 成功\n`)
      } catch (error) {
        // 忽略 already exists 错误
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate column')) {
          console.log(`   ⚠️ 字段已存在，跳过\n`)
        } else {
          throw error
        }
      }
    }
    
    // 验证迁移结果
    console.log('4️⃣ 验证迁移结果...')
    const result = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'quotations' 
        AND column_name IN ('is_void', 'void_reason', 'void_time', 'void_by', 'void_by_name')
      ORDER BY column_name
    `)
    
    if (result.rows.length === 5) {
      console.log('✅ 迁移成功！新增字段：')
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`)
      })
    } else {
      console.warn(`⚠️ 警告：只找到 ${result.rows.length}/5 个新增字段`)
    }
    
    console.log('\n🎉 迁移完成！')
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message)
    console.error(error)
    process.exit(1)
  }
}

migrate()
