/**
 * 从 Excel 更新运输方式
 * 读取 Excel 文件并更新数据库中的 transport_method 字段
 * 
 * 使用方法: node server/scripts/update-transport-method-from-excel.js
 */

import pg from 'pg'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

// 数据库连接
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
})

// Excel 文件路径
const EXCEL_PATH = '/Users/fengzheng/Downloads/订单数据导入模板.xlsx'

async function updateTransportMethod() {
  console.log('📂 读取 Excel 文件:', EXCEL_PATH)
  
  // 读取 Excel
  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  
  if (rawData.length < 2) {
    console.error('❌ Excel 文件为空')
    return
  }
  
  const headers = rawData[0].map(h => String(h).trim())
  
  // 找到关键列的索引
  const billNumberIdx = headers.indexOf('提单号')
  const transportMethodIdx = headers.indexOf('运输方式')
  
  if (billNumberIdx === -1) {
    console.error('❌ 找不到"提单号"列')
    return
  }
  if (transportMethodIdx === -1) {
    console.error('❌ 找不到"运输方式"列')
    return
  }
  
  console.log(`📊 找到列: 提单号(${billNumberIdx}), 运输方式(${transportMethodIdx})`)
  
  const client = await pool.connect()
  
  try {
    let updateCount = 0
    let skipCount = 0
    let errorCount = 0
    
    // 遍历数据行
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      const billNumber = String(row[billNumberIdx] || '').trim()
      const transportMethod = String(row[transportMethodIdx] || '').trim()
      
      if (!billNumber) {
        continue
      }
      
      if (!transportMethod) {
        skipCount++
        continue
      }
      
      try {
        // 更新数据库（直接覆盖，不使用 COALESCE）
        const result = await client.query(`
          UPDATE bills_of_lading 
          SET transport_method = $1, updated_at = NOW()
          WHERE bill_number = $2
        `, [transportMethod, billNumber])
        
        if (result.rowCount > 0) {
          console.log(`  ✅ ${billNumber} -> 运输方式: ${transportMethod}`)
          updateCount++
        } else {
          console.log(`  ⏭️  ${billNumber} 记录不存在`)
          skipCount++
        }
      } catch (err) {
        console.error(`  ❌ ${billNumber}: ${err.message}`)
        errorCount++
      }
    }
    
    console.log('')
    console.log('========== 更新完成 ==========')
    console.log(`✅ 更新: ${updateCount} 条`)
    console.log(`⏭️  跳过: ${skipCount} 条`)
    console.log(`❌ 失败: ${errorCount} 条`)
    
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行
updateTransportMethod()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(err => {
    console.error('💥 脚本执行失败:', err)
    process.exit(1)
  })

