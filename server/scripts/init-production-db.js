/**
 * 生产数据库初始化脚本
 * 
 * 功能：
 * 1. 在新的生产数据库中创建所有表
 * 2. 从演示数据库迁移基础数据
 * 3. 创建管理员账号
 * 
 * 使用方法：
 * 1. 设置环境变量
 *    export SOURCE_DATABASE_URL="现有数据库连接字符串"
 *    export TARGET_DATABASE_URL="新生产数据库连接字符串"
 * 
 * 2. 运行脚本
 *    node server/scripts/init-production-db.js
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库连接配置
const SOURCE_URL = process.env.SOURCE_DATABASE_URL
const TARGET_URL = process.env.TARGET_DATABASE_URL

// 需要迁移的基础数据表
const BASIC_DATA_TABLES = [
  'shipping_companies',
  'container_codes',
  'ports_of_loading',
  'destination_ports',
  'countries',
  'air_ports',
  'transport_methods',
  'vat_rates',
  'service_fee_categories',
  'service_fees',
  'tariff_rates',
  'roles',
  'permissions',
  'role_permissions'
]

// 创建数据库连接池
function createPool(connectionString) {
  return new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5
  })
}

// 生成密码哈希（与 system/model.js 保持一致）
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
}

// 从源数据库复制表结构到目标数据库
async function copyTableStructure(sourcePool, targetPool) {
  // 获取所有表名
  const tablesResult = await sourcePool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name
  `)
  
  const tables = tablesResult.rows.map(r => r.table_name)
  console.log(`   📋 发现 ${tables.length} 张表`)
  
  for (const tableName of tables) {
    try {
      // 获取表的完整 DDL
      const columnsResult = await sourcePool.query(`
        SELECT 
          column_name, 
          data_type, 
          character_maximum_length,
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName])
      
      if (columnsResult.rows.length === 0) continue
      
      // 构建 CREATE TABLE 语句
      const columns = columnsResult.rows.map(col => {
        let def = `${col.column_name} ${col.data_type}`
        if (col.character_maximum_length) {
          def = `${col.column_name} ${col.data_type}(${col.character_maximum_length})`
        }
        if (col.column_default && col.column_default.includes('nextval')) {
          def = `${col.column_name} SERIAL`
        }
        if (col.is_nullable === 'NO' && !col.column_default?.includes('nextval')) {
          // 不强制 NOT NULL，避免插入问题
        }
        return def
      }).join(', ')
      
      // 先删除旧表再创建
      await targetPool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`)
      await targetPool.query(`CREATE TABLE ${tableName} (${columns})`)
      
      // 添加主键约束（如果存在 id 列）
      const hasId = columnsResult.rows.some(c => c.column_name === 'id')
      if (hasId) {
        try {
          await targetPool.query(`ALTER TABLE ${tableName} ADD PRIMARY KEY (id)`)
        } catch (e) {
          // 忽略主键已存在错误
        }
      }
      
    } catch (err) {
      console.warn(`   ⚠️ 创建表 ${tableName} 失败: ${err.message.substring(0, 80)}`)
    }
  }
  
  console.log(`   ✅ 表结构复制完成`)
}

// 获取表的所有数据
async function getTableData(pool, tableName) {
  try {
    const result = await pool.query(`SELECT * FROM ${tableName}`)
    return result.rows
  } catch (err) {
    console.error(`❌ 读取表 ${tableName} 失败:`, err.message)
    return []
  }
}

// 获取表的列信息
async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName])
  return result.rows.map(r => r.column_name)
}

// 插入数据到表
async function insertTableData(pool, tableName, rows) {
  if (rows.length === 0) {
    console.log(`   ⏭️  ${tableName}: 无数据`)
    return 0
  }
  
  // 获取列名
  const columns = Object.keys(rows[0])
  
  let insertedCount = 0
  for (const row of rows) {
    const values = columns.map(col => row[col])
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    
    try {
      await pool.query(`
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `, values)
      insertedCount++
    } catch (err) {
      // 忽略重复键错误
      if (!err.message.includes('duplicate') && !err.message.includes('unique')) {
        console.warn(`   ⚠️ 插入失败: ${err.message.substring(0, 80)}`)
      }
    }
  }
  
  console.log(`   ✅ ${tableName}: ${insertedCount}/${rows.length} 条`)
  return insertedCount
}

// 更新序列值
async function updateSequences(pool) {
  const tables = [
    'shipping_companies',
    'container_codes',
    'ports_of_loading',
    'destination_ports',
    'countries',
    'air_ports',
    'transport_methods',
    'vat_rates',
    'service_fee_categories',
    'service_fees',
    'tariff_rates',
    'roles',
    'permissions',
    'role_permissions',
    'users'
  ]
  
  for (const table of tables) {
    try {
      await pool.query(`
        SELECT setval(pg_get_serial_sequence('${table}', 'id'), 
          COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)
      `)
    } catch (err) {
      // 忽略没有序列的表
    }
  }
}

// 创建或更新管理员账号
async function createAdminUser(pool) {
  const adminPassword = hashPassword('admin123')
  
  try {
    // 检查是否已存在管理员
    const existing = await pool.query(
      `SELECT id FROM users WHERE username = 'admin'`
    )
    
    if (existing.rows.length > 0) {
      // 更新管理员密码（确保使用正确的 salt）
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = 'admin'`,
        [adminPassword]
      )
      console.log('   ✅ 管理员密码已更新 (密码: admin123)')
      return
    }
    
    await pool.query(`
      INSERT INTO users (username, name, email, role, password_hash, status, login_count, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, ['admin', '系统管理员', 'admin@xianfenghk.com', 'admin', adminPassword, 'active', 0])
    
    console.log('   ✅ 管理员账号创建成功 (用户名: admin, 密码: admin123)')
  } catch (err) {
    console.error('   ❌ 创建管理员失败:', err.message)
  }
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('           生产数据库初始化脚本                           ')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  
  // 检查环境变量
  if (!SOURCE_URL) {
    console.error('❌ 错误: 请设置 SOURCE_DATABASE_URL 环境变量（演示数据库）')
    process.exit(1)
  }
  
  if (!TARGET_URL) {
    console.error('❌ 错误: 请设置 TARGET_DATABASE_URL 环境变量（生产数据库）')
    process.exit(1)
  }
  
  console.log('📊 源数据库 (演示):', SOURCE_URL.replace(/:[^:@]+@/, ':***@'))
  console.log('📊 目标数据库 (生产):', TARGET_URL.replace(/:[^:@]+@/, ':***@'))
  console.log('')
  
  const sourcePool = createPool(SOURCE_URL)
  const targetPool = createPool(TARGET_URL)
  
  try {
    // 测试连接
    console.log('🔌 测试数据库连接...')
    await sourcePool.query('SELECT 1')
    console.log('   ✅ 源数据库连接成功')
    await targetPool.query('SELECT 1')
    console.log('   ✅ 目标数据库连接成功')
    console.log('')
    
    // 步骤 1: 从源数据库复制表结构
    console.log('📝 步骤 1: 从源数据库复制表结构...')
    await copyTableStructure(sourcePool, targetPool)
    console.log('')
    
    // 步骤 2: 迁移基础数据
    console.log('📦 步骤 2: 迁移基础数据...')
    for (const tableName of BASIC_DATA_TABLES) {
      const data = await getTableData(sourcePool, tableName)
      await insertTableData(targetPool, tableName, data)
    }
    console.log('')
    
    // 步骤 3: 更新序列
    console.log('🔢 步骤 3: 更新序列值...')
    await updateSequences(targetPool)
    console.log('   ✅ 序列更新完成')
    console.log('')
    
    // 步骤 4: 创建管理员账号
    console.log('👤 步骤 4: 创建管理员账号...')
    await createAdminUser(targetPool)
    console.log('')
    
    // 完成
    console.log('═══════════════════════════════════════════════════════')
    console.log('✅ 生产数据库初始化完成！')
    console.log('')
    console.log('📋 下一步操作:')
    console.log('   1. 在 Render Dashboard 更新 API 服务的 DATABASE_URL')
    console.log('   2. 重新部署 API 服务')
    console.log('   3. 测试生产环境登录')
    console.log('═══════════════════════════════════════════════════════')
    
  } catch (err) {
    console.error('❌ 初始化失败:', err.message)
    process.exit(1)
  } finally {
    await sourcePool.end()
    await targetPool.end()
  }
}

main()
