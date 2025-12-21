/**
 * 客户数据解析器
 * 解析Excel客户数据并导入到customers表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 字段映射配置
const FIELD_MAPPING = {
  '客户名称': { field: 'company_name', required: false },
  '客户简称': { field: 'short_name' },
  '联系人': { field: 'contact_name' },
  '联系电话': { field: 'contact_phone' },
  '邮箱': { field: 'email' },
  '地址': { field: 'address' },
  '国家': { field: 'country' },
  '城市': { field: 'city' },
  '税号': { field: 'tax_number' },
  '备注': { field: 'remark' },
  '客户类型': { field: 'customer_type' },
  '信用额度': { field: 'credit_limit', type: 'number' }
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
    ['深圳电子科技有限公司', '深圳电子', '张三', '13800138000', 'zhang@example.com', '深圳市南山区', '中国', '深圳', 'DE123456789', '重要客户', '企业客户', '100000']
  ])
  
  XLSX.utils.book_append_sheet(wb, ws, '客户数据')
  
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
    const num = parseFloat(String(value).replace(/[€$,]/g, ''))
    return isNaN(num) ? null : num
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
  const names = new Set()
  
  for (const row of data) {
    const rowErrors = []
    const rowWarnings = []
    
    // 客户名称允许为空，后续可补充
    if (row.company_name) {
      if (names.has(row.company_name)) {
        rowErrors.push(`客户名称 ${row.company_name} 在文件中重复`)
      } else {
        names.add(row.company_name)
        
        const existing = await db.prepare(
          'SELECT id FROM customers WHERE company_name = ?'
        ).get(row.company_name)
        
        if (existing) {
          rowWarnings.push(`客户 ${row.company_name} 已存在，将更新数据`)
        }
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
      const existing = await db.prepare(
        'SELECT id FROM customers WHERE company_name = ?'
      ).get(row.company_name)
      
      if (existing) {
        // 更新现有客户（使用实际存在的字段）
        await db.prepare(`
          UPDATE customers SET
            customer_name = COALESCE(?, customer_name),
            contact_person = COALESCE(?, contact_person),
            contact_phone = COALESCE(?, contact_phone),
            contact_email = COALESCE(?, contact_email),
            address = COALESCE(?, address),
            country_code = COALESCE(?, country_code),
            city = COALESCE(?, city),
            tax_number = COALESCE(?, tax_number),
            notes = COALESCE(?, notes),
            customer_type = COALESCE(?, customer_type),
            credit_limit = COALESCE(?, credit_limit),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          row.company_name, row.contact_name, row.contact_phone,
          row.email, row.address, row.country, row.city,
          row.tax_number, row.remark, row.customer_type,
          row.credit_limit, existing.id
        )
      } else {
        // 创建新客户（使用实际存在的字段）
        const customerId = generateId()
        const customerCode = 'CUS' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
        await db.prepare(`
          INSERT INTO customers (
            id, customer_code, customer_name, company_name, contact_person, contact_phone,
            contact_email, address, country_code, city, tax_number, notes,
            customer_type, credit_limit, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        `).run(
          customerId, customerCode, row.company_name || '未命名客户', row.company_name, row.contact_name,
          row.contact_phone, row.email, row.address, row.country,
          row.city, row.tax_number, row.remark, row.customer_type,
          row.credit_limit
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
