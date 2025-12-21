/**
 * 导出 tariff_rates 为 CSV 格式（更高效的导入方式）
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

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function exportToCSV() {
  console.log('📦 导出 tariff_rates 为 CSV...')
  
  const outputDir = path.join(__dirname, '../exports')
  const csvPath = path.join(outputDir, 'tariff_rates_data.csv')
  
  // 获取数据
  const result = await pool.query('SELECT * FROM tariff_rates ORDER BY id')
  console.log(`   共 ${result.rows.length} 条数据`)
  
  // 获取列名
  const columns = Object.keys(result.rows[0] || {})
  
  // 写入CSV
  const writeStream = fs.createWriteStream(csvPath)
  
  // 写入表头
  writeStream.write(columns.join(',') + '\n')
  
  // 写入数据
  for (const row of result.rows) {
    const values = columns.map(col => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string') {
        // 转义引号和换行
        return `"${val.replace(/"/g, '""').replace(/\n/g, '\\n')}"`
      }
      return val
    })
    writeStream.write(values.join(',') + '\n')
  }
  
  writeStream.end()
  
  console.log(`   ✅ 已导出到: ${csvPath}`)
  console.log(`   文件大小: ${(fs.statSync(csvPath).size / 1024 / 1024).toFixed(2)} MB`)
  
  await pool.end()
}

exportToCSV().catch(console.error)
