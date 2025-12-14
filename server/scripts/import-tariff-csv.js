/**
 * 导入TARIC税率CSV文件到数据库
 * 
 * 使用方法:
 *   node scripts/import-tariff-csv.js <csv文件路径>
 * 
 * 示例:
 *   node scripts/import-tariff-csv.js data/taric/TARIC_Sample_2025.csv
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库路径
const dbPath = path.join(__dirname, '..', 'data', 'orders.db')

// 解析CSV行
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  
  return result
}

async function importCSV(csvPath) {
  console.log('🚀 开始导入TARIC税率数据...')
  console.log(`📁 CSV文件: ${csvPath}`)
  
  // 检查文件是否存在
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ 文件不存在: ${csvPath}`)
    process.exit(1)
  }
  
  // 读取CSV文件
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    console.error('❌ CSV文件为空或格式错误')
    process.exit(1)
  }
  
  // 解析表头
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
  console.log(`📋 检测到列: ${headers.join(', ')}`)
  
  // 连接数据库
  const db = new Database(dbPath)
  
  // 准备插入语句
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO tariff_rates (
      hs_code, hs_code_10, goods_description, goods_description_cn,
      origin_country_code, duty_rate, vat_rate, anti_dumping_rate,
      unit_code, unit_name, data_source, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', 1)
  `)
  
  let successCount = 0
  let failCount = 0
  
  // 开始事务
  const transaction = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        
        // 映射列值
        const getCol = (name) => {
          const index = headers.indexOf(name)
          return index >= 0 ? values[index] : ''
        }
        
        const hsCode = getCol('hs_code') || getCol('hscode') || getCol('code')
        const hsCode10 = getCol('hs_code_10') || getCol('hscode10') || getCol('taric_code')
        const description = getCol('description') || getCol('goods_description') || getCol('desc')
        const descriptionCn = getCol('description_cn') || getCol('goods_description_cn') || getCol('desc_cn')
        const originCode = getCol('origin_country_code') || getCol('origin') || getCol('country')
        const dutyRate = parseFloat(getCol('duty_rate') || getCol('duty') || '0') || 0
        const vatRate = parseFloat(getCol('vat_rate') || getCol('vat') || '19') || 19
        const antiDumpingRate = parseFloat(getCol('anti_dumping_rate') || getCol('anti_dumping') || '0') || 0
        const unitCode = getCol('unit_code') || getCol('unit')
        const unitName = getCol('unit_name') || getCol('unit_desc')
        
        if (!hsCode) {
          failCount++
          continue
        }
        
        insertStmt.run(
          hsCode,
          hsCode10 || hsCode.padEnd(10, '0'),
          description,
          descriptionCn,
          originCode,
          dutyRate,
          vatRate,
          antiDumpingRate,
          unitCode,
          unitName
        )
        
        successCount++
        
        if (successCount % 100 === 0) {
          console.log(`  ✓ 已处理 ${successCount} 条...`)
        }
      } catch (err) {
        failCount++
        if (failCount <= 5) {
          console.error(`  ✗ 行 ${i + 1} 处理失败:`, err.message)
        }
      }
    }
  })
  
  transaction()
  
  // 关闭数据库
  db.close()
  
  console.log('')
  console.log('=' .repeat(50))
  console.log(`✅ 导入完成！`)
  console.log(`   成功: ${successCount} 条`)
  console.log(`   失败: ${failCount} 条`)
  console.log('=' .repeat(50))
}

// 获取命令行参数
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('使用方法: node scripts/import-tariff-csv.js <csv文件路径>')
  console.log('')
  console.log('示例:')
  console.log('  node scripts/import-tariff-csv.js data/taric/TARIC_Sample_2025.csv')
  process.exit(0)
}

const csvPath = path.isAbsolute(args[0]) 
  ? args[0] 
  : path.join(__dirname, '..', args[0])

importCSV(csvPath)

