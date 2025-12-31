/**
 * 费用数据解析器
 * 解析Excel费用数据并导入到fees表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 服务成本（应付）字段映射
const COST_FIELD_MAPPING = {
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

// 销售报价（应收）字段映射
const SALES_FIELD_MAPPING = {
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
  return {
    cost: Object.entries(COST_FIELD_MAPPING).map(([excelField, config]) => ({
      excelField,
      systemField: config.field,
      required: config.required || false,
      type: config.type || 'string'
    })),
    sales: Object.entries(SALES_FIELD_MAPPING).map(([excelField, config]) => ({
      excelField,
      systemField: config.field,
      required: config.required || false,
      type: config.type || 'string'
    }))
  }
}

/**
 * 生成导入模板
 */
export async function generateTemplate() {
  const wb = XLSX.utils.book_new()
  
  // 服务成本表
  const costHeaders = Object.keys(COST_FIELD_MAPPING)
  const costWs = XLSX.utils.aoa_to_sheet([
    costHeaders,
    ['BP2500001', '1182', '70', '安百', '100', '180', '371.23', 'ASL', '400', 'DBHI-澳门', '2303.23']
  ])
  XLSX.utils.book_append_sheet(wb, costWs, '服务成本-应付')
  
  // 销售报价表
  const salesHeaders = Object.keys(SALES_FIELD_MAPPING)
  const salesWs = XLSX.utils.aoa_to_sheet([
    salesHeaders,
    ['BP2500001', '0', '0', '0', '1182', '0', '371.23', '180', '0', '100', '0', '0', '100', '400', '0', '0', '0', '2333.23', '20250721001', 'GL040758', '2333.23', '0']
  ])
  XLSX.utils.book_append_sheet(wb, salesWs, '销售报价-应收')
  
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
      
      // 判断是成本还是销售
      const isCost = headers.some(h => ['运费', '运输服务商', '清关服务商', '台头服务商'].includes(h))
      const fieldMapping = isCost ? COST_FIELD_MAPPING : SALES_FIELD_MAPPING
      
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i]
        
        if (!row || row.every(cell => !cell && cell !== 0)) continue
        
        const record = {
          _rowIndex: i + 1,
          _sheetName: sheetName,
          _type: isCost ? 'cost' : 'sales'
        }
        
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j]
          const value = row[j]
          const mapping = fieldMapping[header]
          
          if (mapping) {
            record[mapping.field] = formatValue(value, mapping.type)
          }
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
        'SELECT id FROM bills_of_lading WHERE bill_number = ?'
      ).get(row.bill_number)
      
      if (!bill) {
        rowWarnings.push(`提单号 ${row.bill_number} 不存在，将跳过`)
      }
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
        'SELECT id FROM bills_of_lading WHERE bill_number = ?'
      ).get(row.bill_number)
      
      if (!bill) {
        if (!options.skipErrors) {
          errors.push({ row: row._rowIndex, error: `提单号 ${row.bill_number} 不存在` })
          errorCount++
        }
        continue
      }
      
      const billId = bill.id
      
      if (row._type === 'cost') {
        // 导入成本费用
        await importCostFees(db, billId, row)
      } else {
        // 导入销售费用
        await importSalesFees(db, billId, row)
      }
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}

/**
 * 导入成本费用
 */
async function importCostFees(db, billId, row) {
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
        'SELECT id FROM fees WHERE bill_id = ? AND fee_name = ? AND fee_type = ?'
      ).get(billId, feeType.name, 'payable')
      
      if (existing) {
        await db.prepare(`
          UPDATE fees SET amount = ?, category = ?, updated_at = NOW() WHERE id = ?
        `).run(amount, feeType.category, existing.id)
      } else {
        const feeId = generateId()
        // 使用时间戳+随机数确保唯一性
        const feeNumber = 'FEE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
        await db.prepare(`
          INSERT INTO fees (id, fee_number, bill_id, fee_type, fee_name, amount, currency, category, payment_status, created_at)
          VALUES (?, ?, ?, 'payable', ?, ?, 'EUR', ?, 'unpaid', NOW())
        `).run(feeId, feeNumber, billId, feeType.name, amount, feeType.category)
      }
    }
  }
  
  // 保存服务商信息
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
 * 导入销售费用
 */
async function importSalesFees(db, billId, row) {
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
        'SELECT id FROM fees WHERE bill_id = ? AND fee_name = ? AND fee_type = ?'
      ).get(billId, feeType.name, 'receivable')
      
      if (existing) {
        await db.prepare(`
          UPDATE fees SET amount = ?, category = ?, updated_at = NOW() WHERE id = ?
        `).run(amount, feeType.category, existing.id)
      } else {
        const feeId = generateId()
        // 使用时间戳+随机数确保唯一性
        const feeNumber = 'FEE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
        await db.prepare(`
          INSERT INTO fees (id, fee_number, bill_id, fee_type, fee_name, amount, currency, category, payment_status, created_at)
          VALUES (?, ?, ?, 'receivable', ?, ?, 'EUR', ?, 'unpaid', NOW())
        `).run(feeId, feeNumber, billId, feeType.name, amount, feeType.category)
      }
    }
  }
  
  // 发票信息字段在 bills_of_lading 表中不存在，跳过更新
  // 如需存储发票信息，应存入 invoices 表
}

/**
 * 更新订单服务商（仅更新 cmr_service_provider 字段）
 */
async function updateBillProvider(db, billId, field, providerName) {
  // 查找或创建服务商
  let provider = await db.prepare(
    'SELECT id FROM service_providers WHERE provider_name = ?'
  ).get(providerName)
  
  if (!provider) {
    // service_providers.id 是 SERIAL 自增，使用 RETURNING 获取
    const providerCode = 'SP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
    const result = await db.prepare(`
      INSERT INTO service_providers (provider_code, provider_name, status, created_at)
      VALUES (?, ?, 'active', NOW())
      RETURNING id
    `).get(providerCode, providerName)
    provider = { id: result?.id }
  }
  
  // bills_of_lading 只有 cmr_service_provider 字段，统一更新到这个字段
  await db.prepare(`
    UPDATE bills_of_lading SET cmr_service_provider = ?, updated_at = NOW()
    WHERE id = ?
  `).run(providerName, billId)
}
