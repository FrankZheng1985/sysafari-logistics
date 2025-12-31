/**
 * 应付费用数据解析器
 * 解析Excel应付费用数据（服务成本）并导入到fees表（fee_type = 'payable'）
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 应付费用（服务成本）字段映射
const PAYABLE_FIELD_MAPPING = {
  '提单号': { field: 'bill_number', required: true },
  '运费': { field: 'transport_fee', type: 'number' },
  '其他杂费': { field: 'other_fee', type: 'number' },
  '运输服务商': { field: 'transport_provider' },
  '清关操作费': { field: 'customs_operation_fee', type: 'number' },
  'HS CODE操作费': { field: 'hs_code_fee', type: 'number' },
  '关税': { field: 'duty', type: 'number' },
  '清关服务商': { field: 'customs_provider' },
  '公司服务费': { field: 'company_service_fee', type: 'number' },
  '台头服务商': { field: 'truck_provider' },
  '应付合计': { field: 'total_payable', type: 'number' }
}

/**
 * 获取字段映射配置
 */
export function getFieldMapping() {
  return Object.entries(PAYABLE_FIELD_MAPPING).map(([excelField, config]) => ({
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
  const wb = XLSX.utils.book_new()
  
  // 应付费用表
  const headers = Object.keys(PAYABLE_FIELD_MAPPING)
  const exampleRow = [
    'BP2500001',    // 提单号
    '1182',         // 运费
    '70',           // 其他杂费
    '安百',         // 运输服务商
    '100',          // 清关操作费
    '180',          // HS CODE操作费
    '371.23',       // 关税
    'ASL',          // 清关服务商
    '400',          // 公司服务费
    'DBHI-澳门',    // 台头服务商
    '2303.23'       // 应付合计
  ]
  
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  
  // 设置列宽
  ws['!cols'] = headers.map(() => ({ wch: 15 }))
  
  XLSX.utils.book_append_sheet(wb, ws, '应付费用-服务成本')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * 解析Excel文件
 */
export async function parseExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    
    const data = []
    const columns = []
    
    // 解析所有工作表
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      
      if (rawData.length < 2) continue
      
      const headers = rawData[0].map(h => String(h).trim())
      columns.push(...headers.filter(h => !columns.includes(h)))
      
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i]
        
        // 跳过空行
        if (!row || row.every(cell => !cell && cell !== 0)) continue
        
        const record = {
          _rowIndex: i + 1,
          _sheetName: sheetName
        }
        
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j]
          const value = row[j]
          const mapping = PAYABLE_FIELD_MAPPING[header]
          
          if (mapping) {
            record[mapping.field] = formatValue(value, mapping.type)
          }
          // 保存原始值用于预览
          record[`_${header}`] = value
        }
        
        data.push(record)
      }
    }
    
    return { success: true, data, columns }
    
  } catch (err) {
    return { success: false, error: '解析Excel文件失败: ' + err.message }
  }
}

/**
 * 格式化值
 */
function formatValue(value, type) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  if (type === 'number') {
    if (typeof value === 'number') return value
    const num = parseFloat(String(value).replace(/[€$,]/g, ''))
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
  
  for (const row of data) {
    const rowErrors = []
    const rowWarnings = []
    
    // 检查提单号
    if (!row.bill_number) {
      rowErrors.push('提单号不能为空')
    } else {
      // 检查提单是否存在
      const bill = await db.prepare(
        'SELECT id FROM bills_of_lading WHERE bill_number = $1'
      ).get(row.bill_number)
      
      if (!bill) {
        rowWarnings.push(`提单号 ${row.bill_number} 不存在，将跳过`)
      }
    }
    
    // 检查是否有任何费用数据
    const feeFields = ['transport_fee', 'other_fee', 'customs_operation_fee', 
                       'hs_code_fee', 'duty', 'company_service_fee']
    const hasAnyFee = feeFields.some(field => row[field] && row[field] > 0)
    
    if (!hasAnyFee && !rowErrors.length) {
      rowWarnings.push('该行没有任何费用数据')
    }
    
    if (rowErrors.length > 0) {
      errors.push({ row: row._rowIndex, sheet: row._sheetName, errors: rowErrors })
      errorCount++
    } else if (rowWarnings.length > 0) {
      warnings.push({ row: row._rowIndex, sheet: row._sheetName, warnings: rowWarnings })
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
      // 查找提单
      const bill = await db.prepare(
        'SELECT id FROM bills_of_lading WHERE bill_number = $1'
      ).get(row.bill_number)
      
      if (!bill) {
        if (!options.skipErrors) {
          errors.push({ row: row._rowIndex, error: `提单号 ${row.bill_number} 不存在` })
          errorCount++
        }
        continue
      }
      
      const billId = bill.id
      
      // 导入应付费用
      await importPayableFees(db, billId, row)
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}

/**
 * 导入应付费用（服务成本）
 */
async function importPayableFees(db, billId, row) {
  const feeTypes = [
    { field: 'transport_fee', name: '运费', category: 'transport' },
    { field: 'other_fee', name: '其他杂费', category: 'other' },
    { field: 'customs_operation_fee', name: '清关操作费', category: 'customs' },
    { field: 'hs_code_fee', name: 'HS CODE操作费', category: 'customs' },
    { field: 'duty', name: '关税', category: 'duty' },
    { field: 'company_service_fee', name: '公司服务费', category: 'service' }
  ]
  
  for (const feeType of feeTypes) {
    const amount = row[feeType.field]
    if (amount && amount > 0) {
      // 检查是否已存在
      const existing = await db.prepare(
        'SELECT id FROM fees WHERE bill_id = $1 AND fee_name = $2 AND fee_type = $3'
      ).get(billId, feeType.name, 'payable')
      
      if (existing) {
        // 更新已存在的费用
        await db.prepare(`
          UPDATE fees SET amount = $1, category = $2, updated_at = NOW() WHERE id = $3
        `).run(amount, feeType.category, existing.id)
      } else {
        // 插入新费用
        const feeId = generateId()
        const feeNumber = 'FEE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
        await db.prepare(`
          INSERT INTO fees (id, fee_number, bill_id, fee_type, fee_name, amount, currency, category, payment_status, created_at)
          VALUES ($1, $2, $3, 'payable', $4, $5, 'EUR', $6, 'unpaid', NOW())
        `).run(feeId, feeNumber, billId, feeType.name, amount, feeType.category)
      }
    }
  }
  
  // 保存服务商信息到订单
  if (row.transport_provider) {
    await updateBillProvider(db, billId, 'transport_provider', row.transport_provider)
  }
  if (row.customs_provider) {
    await updateBillProvider(db, billId, 'customs_provider', row.customs_provider)
  }
  if (row.truck_provider) {
    await updateBillProvider(db, billId, 'truck_provider', row.truck_provider)
  }
}

/**
 * 更新订单服务商（存储到 cmr_service_provider 字段）
 */
async function updateBillProvider(db, billId, field, providerName) {
  // 查找或创建服务商
  let provider = await db.prepare(
    'SELECT id FROM service_providers WHERE provider_name = $1'
  ).get(providerName)
  
  if (!provider) {
    // service_providers.id 是 SERIAL 自增，使用 RETURNING 获取
    const providerCode = 'SP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
    const result = await db.prepare(`
      INSERT INTO service_providers (provider_code, provider_name, status, created_at)
      VALUES ($1, $2, 'active', NOW())
      RETURNING id
    `).get(providerCode, providerName)
    provider = { id: result?.id }
  }
  
  // 更新订单的服务商字段
  await db.prepare(`
    UPDATE bills_of_lading SET cmr_service_provider = $1, updated_at = NOW()
    WHERE id = $2
  `).run(providerName, billId)
}
