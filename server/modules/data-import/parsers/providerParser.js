/**
 * 服务商数据解析器
 * 解析Excel服务商数据并导入到service_providers表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 字段映射配置
const FIELD_MAPPING = {
  '服务商名称': { field: 'provider_name', required: true },
  '服务商简称': { field: 'short_name' },
  '服务商类型': { field: 'provider_type' }, // transport/customs/truck/warehouse
  '联系人': { field: 'contact_name' },
  '联系电话': { field: 'contact_phone' },
  '邮箱': { field: 'email' },
  '地址': { field: 'address' },
  '国家': { field: 'country' },
  '城市': { field: 'city' },
  '合同开始日期': { field: 'contract_start_date', type: 'date' },
  '合同结束日期': { field: 'contract_end_date', type: 'date' },
  '备注': { field: 'remark' }
}

// 服务商类型映射
const PROVIDER_TYPE_MAP = {
  '运输': 'transport',
  '运输服务商': 'transport',
  '清关': 'customs',
  '清关服务商': 'customs',
  '报关行': 'customs',
  '台头': 'truck',
  '拖车': 'truck',
  '拖头服务商': 'truck',
  '台头服务商': 'truck',
  '仓储': 'warehouse',
  '换单代理': 'doc_swap',
  '其他': 'other'
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
    ['安百物流', '安百', '运输服务商', '李四', '13900139000', 'li@example.com', '汉堡港区', '德国', '汉堡', '2024-01-01', '2025-12-31', '主要运输合作商'],
    ['ASL报关行', 'ASL', '清关服务商', '王五', '13700137000', 'wang@example.com', '汉堡', '德国', '汉堡', '2024-01-01', '2025-12-31', '主要报关合作商'],
    ['DBHI-澳门', 'DBHI', '台头服务商', '赵六', '13600136000', 'zhao@example.com', '澳门', '中国', '澳门', '2024-01-01', '2025-12-31', '拖车服务']
  ])
  
  XLSX.utils.book_append_sheet(wb, ws, '服务商数据')
  
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
          let formattedValue = formatValue(value, mapping.type)
          
          // 转换服务商类型
          if (mapping.field === 'provider_type' && formattedValue) {
            formattedValue = PROVIDER_TYPE_MAP[formattedValue] || 'other'
          }
          
          record[mapping.field] = formattedValue
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
  
  if (type === 'date') {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
    }
    if (typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }
    return null
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
    
    if (!row.provider_name) {
      rowErrors.push('服务商名称不能为空')
    } else {
      if (names.has(row.provider_name)) {
        rowErrors.push(`服务商名称 ${row.provider_name} 在文件中重复`)
      } else {
        names.add(row.provider_name)
        
        const existing = await db.prepare(
          'SELECT id FROM service_providers WHERE provider_name = ?'
        ).get(row.provider_name)
        
        if (existing) {
          rowWarnings.push(`服务商 ${row.provider_name} 已存在，将更新数据`)
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
        'SELECT id FROM service_providers WHERE provider_name = ?'
      ).get(row.provider_name)
      
      if (existing) {
        await db.prepare(`
          UPDATE service_providers SET
            short_name = COALESCE(?, short_name),
            provider_type = COALESCE(?, provider_type),
            contact_name = COALESCE(?, contact_name),
            contact_phone = COALESCE(?, contact_phone),
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            country = COALESCE(?, country),
            city = COALESCE(?, city),
            contract_start_date = COALESCE(?, contract_start_date),
            contract_end_date = COALESCE(?, contract_end_date),
            remark = COALESCE(?, remark),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          row.short_name, row.provider_type, row.contact_name,
          row.contact_phone, row.email, row.address, row.country,
          row.city, row.contract_start_date, row.contract_end_date,
          row.remark, existing.id
        )
      } else {
        const providerId = generateId()
        await db.prepare(`
          INSERT INTO service_providers (
            id, provider_name, short_name, provider_type, contact_name,
            contact_phone, email, address, country, city,
            contract_start_date, contract_end_date, remark, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        `).run(
          providerId, row.provider_name, row.short_name, row.provider_type,
          row.contact_name, row.contact_phone, row.email, row.address,
          row.country, row.city, row.contract_start_date,
          row.contract_end_date, row.remark
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
