/**
 * 检查开发、生产、演示环境的数据库和代码差异
 * 
 * 使用方法：
 * 1. 设置环境变量（本地开发环境）
 *    export DATABASE_URL="本地数据库连接字符串"
 *    export PROD_DATABASE_URL="生产数据库连接字符串"
 *    export DEMO_DATABASE_URL="演示数据库连接字符串"
 * 
 * 2. 运行脚本
 *    node server/scripts/check-env-differences.js
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

// 数据库连接配置
const DEV_URL = process.env.DATABASE_URL
const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL_PROD
const DEMO_URL = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL_TEST

// 订单相关表（不更新）
const ORDER_TABLES = [
  'bills_of_lading',
  'packages',
  'declarations',
  'labels',
  'last_mile_orders',
  'fees',
  'invoices',
  'payments',
  'clearance_documents',
  'clearance_document_items',
  'void_applications',
  'operation_logs',
  'bill_files'
]

// 创建数据库连接池
function createPool(connectionString, envName) {
  if (!connectionString) {
    return null
  }
  
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  return {
    pool: new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 5
    }),
    name: envName
  }
}

// 获取数据库中的所有表
async function getTables(pool) {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name
  `)
  return result.rows.map(r => r.table_name)
}

// 获取表的结构信息
async function getTableStructure(pool, tableName) {
  const columnsResult = await pool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable,
      ordinal_position
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName])
  
  const indexesResult = await pool.query(`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes 
    WHERE tablename = $1 AND schemaname = 'public'
  `, [tableName])
  
  return {
    columns: columnsResult.rows,
    indexes: indexesResult.rows.map(r => r.indexname)
  }
}

// 比较两个表结构
function compareTableStructures(struct1, struct2) {
  const differences = []
  
  // 比较列
  const cols1 = struct1.columns.map(c => c.column_name)
  const cols2 = struct2.columns.map(c => c.column_name)
  
  const missingIn2 = cols1.filter(c => !cols2.includes(c))
  const missingIn1 = cols2.filter(c => !cols1.includes(c))
  
  if (missingIn2.length > 0) {
    differences.push({
      type: 'missing_columns',
      columns: missingIn2,
      direction: 'target_missing'
    })
  }
  
  if (missingIn1.length > 0) {
    differences.push({
      type: 'missing_columns',
      columns: missingIn1,
      direction: 'source_missing'
    })
  }
  
  // 比较索引
  const idx1 = struct1.indexes
  const idx2 = struct2.indexes
  
  const missingIdxIn2 = idx1.filter(i => !idx2.includes(i))
  const missingIdxIn1 = idx2.filter(i => !idx1.includes(i))
  
  if (missingIdxIn2.length > 0 || missingIdxIn1.length > 0) {
    differences.push({
      type: 'missing_indexes',
      missing_in_target: missingIdxIn2,
      missing_in_source: missingIdxIn1
    })
  }
  
  return differences
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('        环境差异检查工具')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  
  // 检查环境变量
  if (!DEV_URL) {
    console.error('❌ 错误: 未配置开发环境数据库连接 (DATABASE_URL)')
    process.exit(1)
  }
  
  if (!PROD_URL) {
    console.warn('⚠️  警告: 未配置生产环境数据库连接 (PROD_DATABASE_URL)')
  }
  
  if (!DEMO_URL) {
    console.warn('⚠️  警告: 未配置演示环境数据库连接 (DEMO_DATABASE_URL)')
  }
  
  console.log('📊 环境配置:')
  console.log(`   开发环境: ${DEV_URL ? '✅ 已配置' : '❌ 未配置'}`)
  console.log(`   生产环境: ${PROD_URL ? '✅ 已配置' : '❌ 未配置'}`)
  console.log(`   演示环境: ${DEMO_URL ? '✅ 已配置' : '❌ 未配置'}`)
  console.log('')
  
  // 创建连接池
  const devConn = createPool(DEV_URL, '开发环境')
  const prodConn = PROD_URL ? createPool(PROD_URL, '生产环境') : null
  const demoConn = DEMO_URL ? createPool(DEMO_URL, '演示环境') : null
  
  const connections = [devConn, prodConn, demoConn].filter(c => c !== null)
  
  try {
    // 测试连接
    console.log('🔌 测试数据库连接...')
    for (const conn of connections) {
      try {
        await conn.pool.query('SELECT 1')
        console.log(`   ✅ ${conn.name} 连接成功`)
      } catch (err) {
        console.error(`   ❌ ${conn.name} 连接失败: ${err.message}`)
        return
      }
    }
    console.log('')
    
    // 获取各环境的表列表
    console.log('📋 获取各环境的表列表...')
    const tablesByEnv = {}
    
    for (const conn of connections) {
      try {
        const tables = await getTables(conn.pool)
        tablesByEnv[conn.name] = tables
        console.log(`   ✅ ${conn.name}: ${tables.length} 张表`)
      } catch (err) {
        console.error(`   ❌ ${conn.name} 获取表列表失败: ${err.message}`)
        return
      }
    }
    console.log('')
    
    // 找出所有表（并集）
    const allTables = new Set()
    Object.values(tablesByEnv).forEach(tables => {
      tables.forEach(table => allTables.add(table))
    })
    
    // 排除订单相关表
    const nonOrderTables = Array.from(allTables).filter(t => !ORDER_TABLES.includes(t))
    
    console.log('═══════════════════════════════════════════════════════')
    console.log('📊 差异分析结果')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    
    // 1. 表缺失情况
    console.log('1️⃣  表缺失情况:')
    console.log('')
    
    const devTables = tablesByEnv['开发环境'] || []
    const prodTables = prodConn ? (tablesByEnv['生产环境'] || []) : []
    const demoTables = demoConn ? (tablesByEnv['演示环境'] || []) : []
    
    // 开发环境有，但生产环境没有的表
    if (prodConn) {
      const missingInProd = nonOrderTables.filter(t => 
        devTables.includes(t) && !prodTables.includes(t)
      )
      if (missingInProd.length > 0) {
        console.log('   ⚠️  生产环境缺失的表:')
        missingInProd.forEach(t => console.log(`      - ${t}`))
        console.log('')
      } else {
        console.log('   ✅ 生产环境表完整')
        console.log('')
      }
    }
    
    // 开发环境有，但演示环境没有的表
    if (demoConn) {
      const missingInDemo = nonOrderTables.filter(t => 
        devTables.includes(t) && !demoTables.includes(t)
      )
      if (missingInDemo.length > 0) {
        console.log('   ⚠️  演示环境缺失的表:')
        missingInDemo.forEach(t => console.log(`      - ${t}`))
        console.log('')
      } else {
        console.log('   ✅ 演示环境表完整')
        console.log('')
      }
    }
    
    // 2. 表结构差异
    console.log('2️⃣  表结构差异检查:')
    console.log('')
    
    let hasStructureDiff = false
    
    // 比较开发环境和生产环境
    if (prodConn) {
      const commonTables = nonOrderTables.filter(t => 
        devTables.includes(t) && prodTables.includes(t)
      )
      
      for (const tableName of commonTables.slice(0, 20)) { // 限制检查前20个表
        try {
          const devStruct = await getTableStructure(devConn.pool, tableName)
          const prodStruct = await getTableStructure(prodConn.pool, tableName)
          const diffs = compareTableStructures(devStruct, prodStruct)
          
          if (diffs.length > 0) {
            hasStructureDiff = true
            console.log(`   ⚠️  ${tableName}:`)
            diffs.forEach(diff => {
              if (diff.type === 'missing_columns') {
                if (diff.direction === 'target_missing') {
                  console.log(`      生产环境缺失列: ${diff.columns.join(', ')}`)
                } else {
                  console.log(`      开发环境缺失列: ${diff.columns.join(', ')}`)
                }
              }
            })
          }
        } catch (err) {
          // 忽略错误，继续检查其他表
        }
      }
    }
    
    if (!hasStructureDiff) {
      console.log('   ✅ 表结构一致（已检查的表）')
    }
    console.log('')
    
    // 3. 新表识别
    console.log('3️⃣  需要同步的新表（非订单表）:')
    console.log('')
    
    const newTables = []
    
    // 检查 api_integrations 相关表
    const apiTables = ['api_integrations', 'api_usage_records', 'api_recharge_records']
    const trackingTables = ['tracking_api_configs']
    
    const allNewTables = [...apiTables, ...trackingTables]
    
    for (const table of allNewTables) {
      const inDev = devTables.includes(table)
      const inProd = prodConn ? prodTables.includes(table) : false
      const inDemo = demoConn ? demoTables.includes(table) : false
      
      if (inDev && (!inProd || !inDemo)) {
        newTables.push({
          table,
          dev: '✅',
          prod: inProd ? '✅' : '❌',
          demo: inDemo ? '✅' : '❌'
        })
      }
    }
    
    if (newTables.length > 0) {
      console.log('   需要同步的新表:')
      console.log('   ' + '─'.repeat(60))
      console.log('   ' + '表名'.padEnd(30) + '开发'.padEnd(10) + '生产'.padEnd(10) + '演示')
      console.log('   ' + '─'.repeat(60))
      newTables.forEach(nt => {
        console.log(`   ${nt.table.padEnd(30)}${nt.dev.padEnd(10)}${nt.prod.padEnd(10)}${nt.demo}`)
      })
      console.log('   ' + '─'.repeat(60))
    } else {
      console.log('   ✅ 所有新表已同步')
    }
    console.log('')
    
    // 4. 总结和建议
    console.log('═══════════════════════════════════════════════════════')
    console.log('📝 同步建议')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    
    if (newTables.length > 0) {
      console.log('需要执行的同步操作:')
      console.log('')
      console.log('1. 将新表添加到主schema文件 (pg-init-schema.sql)')
      console.log('2. 运行迁移脚本同步到各环境:')
      console.log('')
      
      if (prodConn && newTables.some(nt => nt.prod === '❌')) {
        console.log('   生产环境:')
        console.log('   node server/scripts/migrate-api-integrations.sql')
        console.log('   (通过 psql 或数据库管理工具执行)')
        console.log('')
      }
      
      if (demoConn && newTables.some(nt => nt.demo === '❌')) {
        console.log('   演示环境:')
        console.log('   node server/scripts/migrate-api-integrations.sql')
        console.log('   (通过 psql 或数据库管理工具执行)')
        console.log('')
      }
      
      console.log('3. 验证同步结果:')
      console.log('   重新运行此脚本检查')
    } else {
      console.log('✅ 所有环境已同步，无需额外操作')
    }
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════')
    
  } catch (err) {
    console.error('❌ 检查失败:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    // 关闭连接
    for (const conn of connections) {
      await conn.pool.end()
    }
  }
}

main()
