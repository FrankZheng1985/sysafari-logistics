/**
 * 从 Excel 同步所有字段到数据库
 * 对比 Excel 和数据库的差异，并更新所有字段
 * 
 * 使用方法: node server/scripts/sync-all-fields-from-excel.js
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

// 字段映射: Excel列名 -> 数据库字段名
const FIELD_MAPPING = {
  '收单日期': 'create_time',
  '客户名称': 'customer_name',
  '柜号': 'container_number',
  '正本提单': 'original_bill_received',
  '是否授权': 'is_authorized',
  '运输方式': 'transport_method',
  '型号': 'container_type',
  '船公司': 'shipping_company',
  '船名航次': 'vessel',
  '提单号': 'bill_number',  // 主键，不更新
  '起运港': 'port_of_loading',
  '目的地': 'place_of_delivery',
  '目的港': 'port_of_discharge',
  '服务': 'service_type',
  '派送市场地址': 'cmr_delivery_address',
  '派送地址': 'cmr_delivery_address',
  '货柜金额': 'cargo_value',
  '资料发送日期': 'documents_sent_date',
  'CMR发送日期': 'cmr_sent_date',
  'ETD': 'etd',
  'ETA': 'eta',
  '清关完成日期': 'customs_release_time',
  '清关完成期限': 'customs_release_time',
  '提柜日期': 'cmr_pickup_time',
  '装柜日期': 'cmr_pickup_time',
  '卸货日期': 'cmr_unloading_complete_time',
  '卸柜日期': 'cmr_unloading_complete_time',
  '箱/件数': 'pieces',
  '货量': 'weight',
  '体积': 'volume'
}

// 日期字段
const DATE_FIELDS = ['create_time', 'etd', 'eta', 'customs_release_time', 'cmr_pickup_time', 'cmr_unloading_complete_time', 'documents_sent_date', 'cmr_sent_date']

// 数字字段
const NUMBER_FIELDS = ['cargo_value', 'pieces', 'weight', 'volume']

/**
 * 格式化 Excel 日期
 */
function formatDate(value) {
  if (!value) return null
  if (typeof value === 'number') {
    // Excel 日期序列号
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value).trim()
}

/**
 * 格式化数字
 */
function formatNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const num = parseFloat(String(value).replace(/[€$,]/g, ''))
  return isNaN(num) ? null : num
}

/**
 * 格式化值
 */
function formatValue(value, dbField) {
  if (value === null || value === undefined || value === '') return null
  
  if (DATE_FIELDS.includes(dbField)) {
    return formatDate(value)
  }
  if (NUMBER_FIELDS.includes(dbField)) {
    return formatNumber(value)
  }
  return String(value).trim()
}

/**
 * 比较两个值是否相等
 */
function valuesEqual(excelVal, dbVal) {
  if (excelVal === null && (dbVal === null || dbVal === undefined || dbVal === '')) return true
  if (dbVal === null && (excelVal === null || excelVal === undefined || excelVal === '')) return true
  return String(excelVal) === String(dbVal)
}

async function syncAllFields() {
  console.log('📂 读取 Excel 文件:', EXCEL_PATH)
  
  // 读取 Excel
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  
  if (rawData.length < 2) {
    console.error('❌ Excel 文件为空')
    return
  }
  
  const headers = rawData[0].map(h => String(h).trim())
  console.log('📊 Excel 列:', headers.length, '列')
  
  // 找到提单号列
  const billNumberIdx = headers.indexOf('提单号')
  if (billNumberIdx === -1) {
    console.error('❌ 找不到"提单号"列')
    return
  }
  
  // 构建列映射
  const columnMap = {}
  headers.forEach((header, idx) => {
    if (FIELD_MAPPING[header] && header !== '提单号') {
      columnMap[idx] = { header, dbField: FIELD_MAPPING[header] }
    }
  })
  
  console.log('📋 可更新字段:', Object.values(columnMap).map(c => c.header).join(', '))
  console.log('')
  
  const client = await pool.connect()
  
  try {
    let totalUpdates = 0
    let recordsUpdated = 0
    let recordsSkipped = 0
    
    // 遍历 Excel 数据行
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      const billNumber = String(row[billNumberIdx] || '').trim()
      
      if (!billNumber) continue
      
      // 查询数据库中的记录
      const dbResult = await client.query(
        'SELECT * FROM bills_of_lading WHERE bill_number = $1',
        [billNumber]
      )
      
      if (dbResult.rows.length === 0) {
        console.log(`⏭️  ${billNumber} - 数据库中不存在`)
        recordsSkipped++
        continue
      }
      
      const dbRecord = dbResult.rows[0]
      const updates = []
      const values = []
      let paramIdx = 1
      
      // 对比每个字段
      for (const [colIdx, { header, dbField }] of Object.entries(columnMap)) {
        const excelValue = formatValue(row[colIdx], dbField)
        const dbValue = dbRecord[dbField]
        
        // 只有当 Excel 有值且与数据库不同时才更新
        if (excelValue !== null && !valuesEqual(excelValue, dbValue)) {
          updates.push(`${dbField} = $${paramIdx}`)
          values.push(excelValue)
          paramIdx++
          
          // 记录差异
          console.log(`  📝 ${billNumber}.${header}: "${dbValue || '空'}" -> "${excelValue}"`)
          totalUpdates++
        }
      }
      
      // 执行更新
      if (updates.length > 0) {
        values.push(billNumber)
        const sql = `UPDATE bills_of_lading SET ${updates.join(', ')}, updated_at = NOW() WHERE bill_number = $${paramIdx}`
        await client.query(sql, values)
        recordsUpdated++
      }
    }
    
    console.log('')
    console.log('========== 同步完成 ==========')
    console.log(`📊 总字段更新: ${totalUpdates} 个`)
    console.log(`📋 更新记录数: ${recordsUpdated} 条`)
    console.log(`⏭️  跳过记录数: ${recordsSkipped} 条`)
    
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行
syncAllFields()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(err => {
    console.error('💥 脚本执行失败:', err)
    process.exit(1)
  })

