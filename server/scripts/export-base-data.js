/**
 * 基础数据导出脚本
 * 将本地数据库的基础数据导出为SQL文件，用于同步到生产环境
 * 
 * 使用方法：
 * node scripts/export-base-data.js [table_name]
 * 
 * 示例：
 * node scripts/export-base-data.js              # 导出所有基础数据
 * node scripts/export-base-data.js countries    # 只导出国家数据
 * node scripts/export-base-data.js tariff_rates # 只导出HS税率数据
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 未配置数据库连接')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

// 需要导出的基础数据表
const BASE_DATA_TABLES = [
  { 
    name: 'countries', 
    primaryKey: 'id',
    conflictKey: 'code',
    description: '国家数据'
  },
  { 
    name: 'cities', 
    primaryKey: 'id',
    conflictKey: 'id',
    description: '城市数据'
  },
  { 
    name: 'ports_of_loading', 
    primaryKey: 'id',
    conflictKey: 'port_code',
    description: '起运港数据'
  },
  { 
    name: 'destination_ports', 
    primaryKey: 'id',
    conflictKey: 'port_code',
    description: '目的港数据'
  },
  { 
    name: 'air_ports', 
    primaryKey: 'id',
    conflictKey: 'code',
    description: '空运港口数据'
  },
  { 
    name: 'shipping_companies', 
    primaryKey: 'id',
    conflictKey: 'code',
    description: '船公司数据'
  },
  { 
    name: 'vat_rates', 
    primaryKey: 'id',
    conflictKey: 'country_code',
    description: 'VAT税率数据'
  },
  { 
    name: 'products', 
    primaryKey: 'id',
    conflictKey: 'product_code',
    description: '产品定价数据'
  },
  { 
    name: 'product_fee_items', 
    primaryKey: 'id',
    conflictKey: 'id',
    description: '产品费用项数据'
  }
]

// HS税率数据（大量数据，单独处理）
const HS_DATA_TABLES = [
  { 
    name: 'tariff_rates', 
    primaryKey: 'id',
    conflictKey: 'hs_code',
    description: 'HS税率数据库',
    batchSize: 5000 // 分批导出
  }
]

/**
 * 获取表的列信息
 */
async function getTableColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1 
    ORDER BY ordinal_position
  `, [tableName])
  return result.rows
}

/**
 * 格式化SQL值
 */
function formatValue(value, dataType) {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  
  if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('double') || dataType.includes('real')) {
    return value
  }
  
  if (dataType.includes('bool')) {
    return value ? 'TRUE' : 'FALSE'
  }
  
  if (dataType.includes('timestamp') || dataType.includes('date')) {
    if (value instanceof Date) {
      return `'${value.toISOString()}'`
    }
    return `'${value}'`
  }
  
  // 字符串类型，转义单引号
  const escaped = String(value).replace(/'/g, "''")
  return `'${escaped}'`
}

/**
 * 导出单个表的数据
 */
async function exportTable(tableConfig, outputDir) {
  const { name, primaryKey, conflictKey, description, batchSize } = tableConfig
  
  console.log(`\n📦 导出 ${name} (${description})...`)
  
  try {
    // 获取列信息
    const columns = await getTableColumns(name)
    if (columns.length === 0) {
      console.log(`   ⚠️ 表 ${name} 不存在或没有列`)
      return { table: name, count: 0, file: null }
    }
    
    const columnNames = columns.map(c => c.column_name)
    const columnTypes = {}
    columns.forEach(c => { columnTypes[c.column_name] = c.data_type })
    
    // 获取数据总数
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${name}`)
    const total = parseInt(countResult.rows[0].total)
    
    if (total === 0) {
      console.log(`   ⚠️ 表 ${name} 没有数据`)
      return { table: name, count: 0, file: null }
    }
    
    console.log(`   共 ${total} 条数据`)
    
    // 生成SQL文件
    const fileName = `${name}_data.sql`
    const filePath = path.join(outputDir, fileName)
    
    // 写入文件头
    let sql = `-- ${description}\n`
    sql += `-- 导出时间: ${new Date().toISOString()}\n`
    sql += `-- 数据量: ${total} 条\n\n`
    
    // 非主键列用于更新
    const updateColumns = columnNames.filter(c => c !== primaryKey && c !== conflictKey)
    
    // 分批处理大数据
    const batch = batchSize || 10000
    let offset = 0
    let fileIndex = 1
    
    while (offset < total) {
      const result = await pool.query(`
        SELECT * FROM ${name} 
        ORDER BY ${primaryKey}
        LIMIT ${batch} OFFSET ${offset}
      `)
      
      for (const row of result.rows) {
        const values = columnNames.map(col => formatValue(row[col], columnTypes[col]))
        
        sql += `INSERT INTO ${name} (${columnNames.join(', ')}) VALUES (${values.join(', ')})`
        
        // 添加 ON CONFLICT 处理
        if (updateColumns.length > 0) {
          const updateSet = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')
          sql += ` ON CONFLICT (${conflictKey}) DO UPDATE SET ${updateSet}`
        } else {
          sql += ` ON CONFLICT (${conflictKey}) DO NOTHING`
        }
        
        sql += ';\n'
      }
      
      offset += batch
      
      // 大数据分文件
      if (batchSize && offset < total) {
        fs.writeFileSync(filePath.replace('.sql', `_${fileIndex}.sql`), sql)
        console.log(`   ✅ 已导出 ${offset}/${total} 条 -> ${fileName.replace('.sql', `_${fileIndex}.sql`)}`)
        sql = `-- ${description} (续 ${fileIndex + 1})\n\n`
        fileIndex++
      }
    }
    
    // 写入文件
    if (batchSize && fileIndex > 1) {
      fs.writeFileSync(filePath.replace('.sql', `_${fileIndex}.sql`), sql)
      console.log(`   ✅ 已导出 ${total}/${total} 条 -> ${fileName.replace('.sql', `_${fileIndex}.sql`)}`)
      console.log(`   📁 共生成 ${fileIndex} 个文件`)
    } else {
      fs.writeFileSync(filePath, sql)
      console.log(`   ✅ 已导出 ${total} 条 -> ${fileName}`)
    }
    
    return { table: name, count: total, file: fileName }
    
  } catch (err) {
    console.error(`   ❌ 导出失败: ${err.message}`)
    return { table: name, count: 0, file: null, error: err.message }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const targetTable = args[0]
  
  // 创建输出目录
  const outputDir = path.join(__dirname, '../exports')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  console.log('═══════════════════════════════════════════════════════')
  console.log('              基础数据导出工具 v1.0')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`📂 输出目录: ${outputDir}`)
  
  const results = []
  
  if (targetTable) {
    // 导出指定表
    const allTables = [...BASE_DATA_TABLES, ...HS_DATA_TABLES]
    const tableConfig = allTables.find(t => t.name === targetTable)
    
    if (!tableConfig) {
      console.error(`\n❌ 未找到表: ${targetTable}`)
      console.log('\n可用的表:')
      allTables.forEach(t => console.log(`  - ${t.name} (${t.description})`))
      process.exit(1)
    }
    
    const result = await exportTable(tableConfig, outputDir)
    results.push(result)
  } else {
    // 导出所有基础数据
    console.log('\n📋 导出基础数据表...')
    for (const tableConfig of BASE_DATA_TABLES) {
      const result = await exportTable(tableConfig, outputDir)
      results.push(result)
    }
    
    console.log('\n📋 导出HS税率数据...')
    for (const tableConfig of HS_DATA_TABLES) {
      const result = await exportTable(tableConfig, outputDir)
      results.push(result)
    }
  }
  
  // 汇总
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('                    导出汇总')
  console.log('═══════════════════════════════════════════════════════')
  
  let totalCount = 0
  for (const result of results) {
    if (result.count > 0) {
      console.log(`  ✅ ${result.table}: ${result.count} 条`)
      totalCount += result.count
    } else if (result.error) {
      console.log(`  ❌ ${result.table}: ${result.error}`)
    } else {
      console.log(`  ⚠️ ${result.table}: 无数据`)
    }
  }
  
  console.log(`\n📊 总计导出: ${totalCount} 条数据`)
  console.log(`📂 文件位置: ${outputDir}`)
  console.log('\n💡 提示: 将导出的 SQL 文件通过 Render PostgreSQL Shell 执行即可同步数据')
  
  await pool.end()
}

main().catch(err => {
  console.error('导出失败:', err)
  process.exit(1)
})
