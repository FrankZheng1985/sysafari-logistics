/**
 * HS匹配记录解析器
 * 解析Excel HS匹配记录并导入到hs_match_records表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 字段映射配置
const FIELD_MAPPING = {
  '商品名称': { field: 'product_name', required: true },
  '中文品名': { field: 'product_name', required: true },
  '英文品名': { field: 'product_name_en' },
  'HS编码': { field: 'hs_code', required: true },
  '材质': { field: 'material' },
  '材质英文': { field: 'material_en' },
  '原产国': { field: 'origin_country' },
  '原产国代码': { field: 'origin_country_code' },
  '平均单价': { field: 'avg_unit_price', type: 'number' },
  '平均公斤价': { field: 'avg_kg_price', type: 'number' },
  '关税率': { field: 'duty_rate', type: 'number' },
  '增值税率': { field: 'vat_rate', type: 'number' },
  '反倾销税率': { field: 'anti_dumping_rate', type: 'number' },
  '客户名称': { field: 'customer_name' },
  '备注': { field: 'remarks' }
}

/**
 * 获取字段映射配置
 */
export function getFieldMapping() {
  return Object.entries(FIELD_MAPPING).map(([excelField, config]) => ({
    excelField,
    systemField: config.field,
    required: config.required || false,
    type: config.type || 'string'
  }))
}

/**
 * 生成导入模板
 */
export async function generateTemplate() {
  const headers = Object.keys(FIELD_MAPPING)
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ['LED灯泡', 'LED灯泡', 'LED Bulbs', '8539500000', '塑料+金属', 'Plastic+Metal', '中国', 'CN', '2.5', '15', '0', '19', '0', '深圳电子', '常用商品']
  ])
  
  XLSX.utils.book_append_sheet(wb, ws, 'HS匹配记录')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * 解析Excel文件
 */
export async function parseExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    
    if (rawData.length < 2) {
      return { success: false, error: '文件为空或没有数据行' }
    }
    
    const headers = rawData[0].map(h => String(h).trim())
    const columns = headers
    
    const data = []
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      
      if (!row || row.every(cell => !cell && cell !== 0)) continue
      
      const record = { _rowIndex: i + 1 }
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        const value = row[j]
        const mapping = FIELD_MAPPING[header]
        
        if (mapping) {
          record[mapping.field] = formatValue(value, mapping.type)
        }
        record[`_${header}`] = value
      }
      
      data.push(record)
    }
    
    return { success: true, data, columns }
    
  } catch (err) {
    return { success: false, error: '解析Excel文件失败: ' + err.message }
  }
}

function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return null
  
  if (type === 'number') {
    const num = parseFloat(String(value).replace(/[€$,%]/g, ''))
    return isNaN(num) ? 0 : num
  }
  
  return String(value).trim()
}

/**
 * 校验数据
 */
export async function validateData(data) {
  const errors = []
  const warnings = []
  let validCount = 0
  let errorCount = 0
  let warningCount = 0
  
  const db = getDatabase()
  const keys = new Set()
  
  for (const row of data) {
    const rowErrors = []
    const rowWarnings = []
    
    if (!row.product_name) {
      rowErrors.push('商品名称不能为空')
    }
    if (!row.hs_code) {
      rowErrors.push('HS编码不能为空')
    }
    
    // 使用商品名+材质+HS编码作为唯一键
    const key = `${row.product_name}|${row.material || ''}|${row.hs_code}`
    if (keys.has(key)) {
      rowWarnings.push(`记录 ${row.product_name} 在文件中重复`)
    } else {
      keys.add(key)
      
      const existing = await db.prepare(`
        SELECT id FROM hs_match_records 
        WHERE product_name = ? AND COALESCE(material, '') = COALESCE(?, '') AND hs_code = ?
      `).get(row.product_name, row.material, row.hs_code)
      
      if (existing) {
        rowWarnings.push(`记录 ${row.product_name} 已存在，将更新数据`)
      }
    }
    
    if (rowErrors.length > 0) {
      errors.push({ row: row._rowIndex, errors: rowErrors })
      errorCount++
    } else if (rowWarnings.length > 0) {
      warnings.push({ row: row._rowIndex, warnings: rowWarnings })
      warningCount++
      validCount++
    } else {
      validCount++
    }
  }
  
  return { errors, warnings, validCount, errorCount, warningCount }
}

/**
 * 导入数据
 */
export async function importData(data, options = {}) {
  const db = getDatabase()
  const errors = []
  let successCount = 0
  let errorCount = 0
  
  for (const row of data) {
    try {
      // 查找客户ID
      let customerId = null
      if (row.customer_name) {
        const customer = await db.prepare(
          'SELECT id FROM customers WHERE company_name = ?'
        ).get(row.customer_name)
        if (customer) {
          customerId = customer.id
        }
      }
      
      const existing = await db.prepare(`
        SELECT id FROM hs_match_records 
        WHERE product_name = ? AND COALESCE(material, '') = COALESCE(?, '') AND hs_code = ?
      `).get(row.product_name, row.material, row.hs_code)
      
      if (existing) {
        await db.prepare(`
          UPDATE hs_match_records SET
            product_name_en = COALESCE(?, product_name_en),
            material_en = COALESCE(?, material_en),
            origin_country = COALESCE(?, origin_country),
            origin_country_code = COALESCE(?, origin_country_code),
            avg_unit_price = COALESCE(?, avg_unit_price),
            avg_kg_price = COALESCE(?, avg_kg_price),
            duty_rate = COALESCE(?, duty_rate),
            vat_rate = COALESCE(?, vat_rate),
            anti_dumping_rate = COALESCE(?, anti_dumping_rate),
            customer_id = COALESCE(?, customer_id),
            customer_name = COALESCE(?, customer_name),
            remarks = COALESCE(?, remarks),
            match_count = match_count + 1,
            last_match_time = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          row.product_name_en, row.material_en, row.origin_country,
          row.origin_country_code, row.avg_unit_price, row.avg_kg_price,
          row.duty_rate, row.vat_rate, row.anti_dumping_rate,
          customerId, row.customer_name, row.remarks, existing.id
        )
      } else {
        await db.prepare(`
          INSERT INTO hs_match_records (
            product_name, product_name_en, hs_code, material, material_en,
            origin_country, origin_country_code, avg_unit_price, avg_kg_price,
            duty_rate, vat_rate, anti_dumping_rate, customer_id, customer_name,
            remarks, match_count, first_match_time, last_match_time, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), 'active', NOW())
        `).run(
          row.product_name, row.product_name_en, row.hs_code,
          row.material, row.material_en, row.origin_country || '中国',
          row.origin_country_code || 'CN', row.avg_unit_price || 0,
          row.avg_kg_price || 0, row.duty_rate || 0, row.vat_rate || 19,
          row.anti_dumping_rate || 0, customerId, row.customer_name,
          row.remarks
        )
      }
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}
