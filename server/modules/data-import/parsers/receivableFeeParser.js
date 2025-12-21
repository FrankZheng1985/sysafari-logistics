/**
 * 应收费用数据解析器
 * 解析Excel应收费用数据并导入到fees表（fee_type = 'receivable'）
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 应收费用（销售报价）字段映射
const RECEIVABLE_FIELD_MAPPING = {
  '提单号': { field: 'bill_number', required: true },
  '包价一口价': { field: 'fixed_price', type: 'number' },
  '港杂': { field: 'port_fee', type: 'number' },
  '清关停靠费': { field: 'customs_stop_fee', type: 'number' },
  '运输费': { field: 'transport_charge', type: 'number' },
  '清关等待费': { field: 'customs_wait_fee', type: 'number' },
  '关税': { field: 'duty_charge', type: 'number' },
  'HS CODE超10个费用': { field: 'hs_code_extra_fee', type: 'number' },
  '税号代理费': { field: 'tax_agent_fee', type: 'number' },
  '清关费': { field: 'customs_fee', type: 'number' },
  'T1费': { field: 't1_fee', type: 'number' },
  '税号使用费': { field: 'tax_number_fee', type: 'number' },
  '卸货压车费': { field: 'unload_fee', type: 'number' },
  '分单费': { field: 'split_fee', type: 'number' },
  '堆存费': { field: 'storage_fee', type: 'number' },
  '服务费': { field: 'service_fee', type: 'number' },
  '其他': { field: 'other_charge', type: 'number' },
  '应收合计': { field: 'total_receivable', type: 'number' },
  '客户发票号码': { field: 'customer_invoice_no' },
  '账单发票号码': { field: 'bill_invoice_no' },
  '已开发票金额': { field: 'invoiced_amount', type: 'number' },
  '未开票金额': { field: 'uninvoiced_amount', type: 'number' }
}

/**
 * 获取字段映射配置
 */
export function getFieldMapping() {
  return Object.entries(RECEIVABLE_FIELD_MAPPING).map(([excelField, config]) => ({
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
  
  // 应收费用表
  const headers = Object.keys(RECEIVABLE_FIELD_MAPPING)
  const exampleRow = [
    'BP2500001', // 提单号
    '0',         // 包价一口价
    '0',         // 港杂
    '0',         // 清关停靠费
    '1182',      // 运输费
    '0',         // 清关等待费
    '371.23',    // 关税
    '180',       // HS CODE超10个费用
    '0',         // 税号代理费
    '100',       // 清关费
    '0',         // T1费
    '0',         // 税号使用费
    '100',       // 卸货压车费
    '400',       // 分单费
    '0',         // 堆存费
    '0',         // 服务费
    '0',         // 其他
    '2333.23',   // 应收合计
    '20250721001', // 客户发票号码
    'GL040758',    // 账单发票号码
    '2333.23',     // 已开发票金额
    '0'            // 未开票金额
  ]
  
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  
  // 设置列宽
  ws['!cols'] = headers.map(() => ({ wch: 15 }))
  
  XLSX.utils.book_append_sheet(wb, ws, '应收费用')
  
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
          const mapping = RECEIVABLE_FIELD_MAPPING[header]
          
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
    const feeFields = ['fixed_price', 'port_fee', 'customs_stop_fee', 'transport_charge', 
                       'customs_wait_fee', 'duty_charge', 'hs_code_extra_fee', 'tax_agent_fee',
                       'customs_fee', 't1_fee', 'tax_number_fee', 'unload_fee', 'split_fee',
                       'storage_fee', 'service_fee', 'other_charge']
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
      
      // 导入应收费用
      await importReceivableFees(db, billId, row)
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}

/**
 * 导入应收费用
 */
async function importReceivableFees(db, billId, row) {
  const feeTypes = [
    { field: 'fixed_price', name: '包价一口价', category: 'package' },
    { field: 'port_fee', name: '港杂', category: 'port' },
    { field: 'customs_stop_fee', name: '清关停靠费', category: 'customs' },
    { field: 'transport_charge', name: '运输费', category: 'transport' },
    { field: 'customs_wait_fee', name: '清关等待费', category: 'customs' },
    { field: 'duty_charge', name: '关税', category: 'duty' },
    { field: 'hs_code_extra_fee', name: 'HS CODE超10个费用', category: 'customs' },
    { field: 'tax_agent_fee', name: '税号代理费', category: 'tax' },
    { field: 'customs_fee', name: '清关费', category: 'customs' },
    { field: 't1_fee', name: 'T1费', category: 'customs' },
    { field: 'tax_number_fee', name: '税号使用费', category: 'tax' },
    { field: 'unload_fee', name: '卸货压车费', category: 'handling' },
    { field: 'split_fee', name: '分单费', category: 'document' },
    { field: 'storage_fee', name: '堆存费', category: 'storage' },
    { field: 'service_fee', name: '服务费', category: 'service' },
    { field: 'other_charge', name: '其他', category: 'other' }
  ]
  
  for (const feeType of feeTypes) {
    const amount = row[feeType.field]
    if (amount && amount > 0) {
      // 检查是否已存在
      const existing = await db.prepare(
        'SELECT id FROM fees WHERE bill_id = $1 AND fee_name = $2 AND fee_type = $3'
      ).get(billId, feeType.name, 'receivable')
      
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
          VALUES ($1, $2, $3, 'receivable', $4, $5, 'EUR', $6, 'unpaid', NOW())
        `).run(feeId, feeNumber, billId, feeType.name, amount, feeType.category)
      }
    }
  }
}
