/**
 * 用户角色权限系统迁移脚本执行器
 * 执行 migrate-user-roles.sql 和 migrate-approval-system.sql
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
  
  if (!DATABASE_URL) {
    console.error('❌ 错误: 未配置 DATABASE_URL')
    process.exit(1)
  }
  
  console.log('📦 数据库连接:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  })
  
  const client = await pool.connect()
  
  try {
    console.log('\n🚀 开始执行用户角色权限系统迁移...\n')
    
    // ==================== 1. 执行 migrate-user-roles.sql ====================
    console.log('📄 [1/2] 执行 migrate-user-roles.sql...')
    const userRolesSql = fs.readFileSync(
      path.join(__dirname, 'migrate-user-roles.sql'), 
      'utf-8'
    )
    
    await client.query(userRolesSql)
    console.log('   ✅ migrate-user-roles.sql 执行完成\n')
    
    // ==================== 2. 执行 migrate-approval-system.sql ====================
    console.log('📄 [2/2] 执行 migrate-approval-system.sql...')
    const approvalSql = fs.readFileSync(
      path.join(__dirname, 'migrate-approval-system.sql'), 
      'utf-8'
    )
    
    await client.query(approvalSql)
    console.log('   ✅ migrate-approval-system.sql 执行完成\n')
    
    // ==================== 验证结果 ====================
    console.log('📊 验证迁移结果...\n')
    
    // 检查角色
    const rolesResult = await client.query(`
      SELECT role_code, role_name, role_level, can_manage_team, can_approve 
      FROM roles ORDER BY role_level
    `)
    console.log('角色列表:')
    console.table(rolesResult.rows)
    
    // 检查权限分类
    const permCatResult = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM permissions 
      GROUP BY category 
      ORDER BY category
    `)
    console.log('\n权限分类统计:')
    console.table(permCatResult.rows)
    
    // 检查新表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'approval%'
      ORDER BY table_name
    `)
    console.log('\n审批相关表:')
    console.table(tablesResult.rows)
    
    // 检查用户表新字段
    const userColsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('supervisor_id', 'department', 'position')
    `)
    console.log('\n用户表新字段:')
    console.table(userColsResult.rows)
    
    console.log('\n✅ 迁移全部完成！')
    
  } catch (error) {
    console.error('\n❌ 迁移执行失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行
runMigration()
