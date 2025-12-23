/**
 * 订单数据解析器
 * 解析Excel订单数据并导入到bills_of_lading表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 字段映射配置
const FIELD_MAPPING = {
  '序号': { field: null, required: false },
  '收单日期': { field: 'create_time', required: false, type: 'date' },
  '客户名称': { field: 'customer_name', required: false },
  '柜号': { field: 'container_number', required: true },
  '正本提单': { field: 'original_bill_received', required: false },
  '是否授权': { field: 'is_authorized', required: false },
  '运输方式': { field: 'transport_method', required: false },
  '型号': { field: 'container_type', required: false }, // 集装箱类型(如40HQ、20GP)
  '船公司': { field: 'shipping_company', required: false }, // 船公司名称(如EMC、COSCO)
  '船名航次': { field: 'vessel_voyage', required: false },
  '提单号': { field: 'bill_number', required: true, unique: true },
  '起运港': { field: 'port_of_loading', required: false },
  '目的地': { field: 'destination', required: false },
  '服务': { field: 'service_type', required: false }, // 销售产品
  '派送市场地址': { field: 'delivery_address', required: false },
  '货柜金额': { field: 'cargo_value', required: false, type: 'number' },
  '资料发送日期': { field: 'documents_sent_date', required: false, type: 'date' },
  'CMR发送日期': { field: 'cmr_sent_date', required: false, type: 'date' },
  'ETD': { field: 'etd', required: false, type: 'date' },
  'ETA': { field: 'eta', required: false, type: 'date' },
  '清关完成日期': { field: 'customs_cleared_date', required: false, type: 'date' },
  '清关完成期限': { field: 'customs_cleared_date', required: false, type: 'date' }, // 别名
  '提柜日期': { field: 'pickup_date', required: false, type: 'date' },
  '装柜日期': { field: 'pickup_date', required: false, type: 'date' }, // 别名（装柜=提柜）
  '卸货日期': { field: 'cmr_unloading_complete_time', required: false, type: 'date' },
  '卸柜日期': { field: 'cmr_unloading_complete_time', required: false, type: 'date' }, // 别名
  '箱/件数': { field: 'package_count', required: false, type: 'number' },
  '货量': { field: 'weight', required: false, type: 'number' },
  '体积': { field: 'volume', required: false, type: 'number' }
}

/**
 * 获取字段映射配置
 */
export function getFieldMapping() {
  return Object.entries(FIELD_MAPPING).map(([excelField, config]) => ({
    excelField,
    systemField: config.field,
    required: config.required,
    type: config.type || 'string'
  }))
}

/**
 * 生成导入模板
 */
export async function generateTemplate() {
  const headers = Object.keys(FIELD_MAPPING).filter(k => FIELD_MAPPING[k].field !== null)
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    // 示例数据
    [
      '2025/1/15', '深圳电子科技', 'OOLU1234567', '是', '是',
      '海运整柜', '40HQ', '中远海运/VY2501',
      'BP2500001', '深圳蛇口', '汉堡港', '清提派',
      'Hamburg, Germany', '25000', '2025/1/10', '2025/1/12',
      '2025/1/8', '2025/1/20', '2025/1/23', '2025/1/24', '2025/1/25',
      '100', '5000', '50'
    ]
  ])
  
  XLSX.utils.book_append_sheet(wb, ws, '订单数据')
  
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
    
    // 转换为JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    
    if (rawData.length < 2) {
      return { success: false, error: '文件为空或没有数据行' }
    }
    
    const headers = rawData[0].map(h => String(h).trim())
    const columns = headers
    
    // 解析数据行
    const data = []
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      
      // 跳过空行
      if (!row || row.every(cell => !cell && cell !== 0)) {
        continue
      }
      
      const record = { _rowIndex: i + 1 }
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        const value = row[j]
        const mapping = FIELD_MAPPING[header]
        
        if (mapping && mapping.field) {
          record[mapping.field] = formatValue(value, mapping.type)
        }
        // 保留原始字段名
        record[`_${header}`] = value
      }
      
      data.push(record)
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
  
  switch (type) {
    case 'date':
      if (value instanceof Date) {
        return value.toISOString().split('T')[0]
      }
      if (typeof value === 'string') {
        // 尝试解析日期字符串
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]
        }
      }
      if (typeof value === 'number') {
        // Excel日期序列号
        const date = XLSX.SSF.parse_date_code(value)
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
      }
      return null
      
    case 'number':
      if (typeof value === 'number') {
        return value
      }
      const num = parseFloat(String(value).replace(/[€$,]/g, ''))
      return isNaN(num) ? null : num
      
    default:
      return String(value).trim()
  }
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
  const billNumbers = new Set()
  
  for (const row of data) {
    const rowErrors = []
    const rowWarnings = []
    
    // 检查必填字段（客户名称可以为空，后续补充）
    if (!row.bill_number) {
      rowErrors.push('提单号不能为空')
    }
    if (!row.container_number) {
      rowErrors.push('柜号不能为空')
    }
    // 客户名称允许为空，后续可补充
    // if (!row.customer_name) {
    //   rowErrors.push('客户名称不能为空')
    // }
    
    // 检查提单号重复
    if (row.bill_number) {
      if (billNumbers.has(row.bill_number)) {
        rowErrors.push(`提单号 ${row.bill_number} 在文件中重复`)
      } else {
        billNumbers.add(row.bill_number)
        
        // 检查数据库是否已存在
        const existing = await db.prepare(
          'SELECT id FROM bills_of_lading WHERE bill_number = ?'
        ).get(row.bill_number)
        
        if (existing) {
          rowWarnings.push(`提单号 ${row.bill_number} 已存在，将更新数据`)
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
 * 导入数据（优化版：批量查询减少数据库请求）
 */
export async function importData(data, options = {}) {
  const db = getDatabase()
  const errors = []
  let successCount = 0
  let errorCount = 0
  
  // 1. 预先批量查询所有客户（减少数据库请求）
  const customerNames = [...new Set(data.map(r => r.customer_name).filter(Boolean))]
  const customerMap = new Map()
  
  if (customerNames.length > 0) {
    const placeholders = customerNames.map(() => '?').join(',')
    const existingCustomers = await db.prepare(`
      SELECT id, customer_name, company_name FROM customers 
      WHERE customer_name IN (${placeholders}) OR company_name IN (${placeholders})
    `).all(...customerNames, ...customerNames)
    
    for (const c of existingCustomers) {
      customerMap.set(c.customer_name, c.id)
      if (c.company_name) customerMap.set(c.company_name, c.id)
    }
  }
  
  // 2. 预先批量查询所有提单号（减少数据库请求）
  const billNumbers = [...new Set(data.map(r => r.bill_number).filter(Boolean))]
  const existingBillSet = new Set()
  
  if (billNumbers.length > 0) {
    const placeholders = billNumbers.map(() => '?').join(',')
    const existingBills = await db.prepare(`
      SELECT bill_number FROM bills_of_lading WHERE bill_number IN (${placeholders})
    `).all(...billNumbers)
    
    for (const b of existingBills) {
      existingBillSet.add(b.bill_number)
    }
  }
  
  // 3. 逐条处理数据
  for (const row of data) {
    try {
      // 跳过错误行（简化校验，不再重复查询数据库）
      if (options.skipErrors && (!row.bill_number || !row.container_number)) {
        errors.push({ row: row._rowIndex, error: '提单号或柜号为空' })
        errorCount++
        continue
      }
      
      // 查找或创建客户
      let customerId = null
      if (row.customer_name) {
        customerId = customerMap.get(row.customer_name)
        
        if (!customerId) {
          // 创建新客户（自动生成客户编码，设置默认级别）
          customerId = generateId()
          const customerCode = 'CUS' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase()
          await db.prepare(`
            INSERT INTO customers (id, customer_code, customer_name, company_name, customer_level, customer_type, status, created_at)
            VALUES (?, ?, ?, ?, 'normal', 'shipper', 'active', NOW())
          `).run(customerId, customerCode, row.customer_name, row.customer_name)
          // 添加到缓存，避免重复创建
          customerMap.set(row.customer_name, customerId)
        }
      }
      
      // 检查提单是否已存在
      const isExisting = existingBillSet.has(row.bill_number)
      
      if (isExisting) {
        // 更新现有记录（使用实际表字段）
        // 注意：如果有卸货日期，自动将订单状态标记为"已完成"
        const hasUnloadingTime = row.cmr_unloading_complete_time ? true : false
        
        if (hasUnloadingTime) {
          // 有卸货日期时，同时更新状态为已完成
          await db.prepare(`
            UPDATE bills_of_lading SET
              container_number = COALESCE(?, container_number),
              customer_id = COALESCE(?, customer_id),
              customer_name = COALESCE(?, customer_name),
              port_of_loading = COALESCE(?, port_of_loading),
              place_of_delivery = COALESCE(?, place_of_delivery),
              vessel = COALESCE(?, vessel),
              shipping_company = COALESCE(?, shipping_company),
              eta = COALESCE(?, eta),
              etd = COALESCE(?, etd),
              weight = COALESCE(?, weight),
              volume = COALESCE(?, volume),
              pieces = COALESCE(?, pieces),
              container_type = COALESCE(?, container_type),
              transport_method = COALESCE(?, transport_method),
              cmr_delivery_address = COALESCE(?, cmr_delivery_address),
              cmr_unloading_complete_time = COALESCE(?, cmr_unloading_complete_time),
              status = '已完成',
              complete_time = NOW(),
              updated_at = NOW()
            WHERE bill_number = ?
          `).run(
            row.container_number,
            customerId,
            row.customer_name,
            row.port_of_loading,
            row.destination,
            row.vessel_voyage,
            row.shipping_company,
            row.eta,
            row.etd,
            row.weight,
            row.volume,
            row.package_count,
            row.container_type,
            row.transport_method,
            row.delivery_address,
            row.cmr_unloading_complete_time,
            row.bill_number
          )
        } else {
          // 无卸货日期时，正常更新
          await db.prepare(`
            UPDATE bills_of_lading SET
              container_number = COALESCE(?, container_number),
              customer_id = COALESCE(?, customer_id),
              customer_name = COALESCE(?, customer_name),
              port_of_loading = COALESCE(?, port_of_loading),
              place_of_delivery = COALESCE(?, place_of_delivery),
              vessel = COALESCE(?, vessel),
              shipping_company = COALESCE(?, shipping_company),
              eta = COALESCE(?, eta),
              etd = COALESCE(?, etd),
              weight = COALESCE(?, weight),
              volume = COALESCE(?, volume),
              pieces = COALESCE(?, pieces),
              container_type = COALESCE(?, container_type),
              transport_method = COALESCE(?, transport_method),
              cmr_delivery_address = COALESCE(?, cmr_delivery_address),
              cmr_unloading_complete_time = COALESCE(?, cmr_unloading_complete_time),
              updated_at = NOW()
            WHERE bill_number = ?
          `).run(
            row.container_number,
            customerId,
            row.customer_name,
            row.port_of_loading,
            row.destination,
            row.vessel_voyage,
            row.shipping_company,
            row.eta,
            row.etd,
            row.weight,
            row.volume,
            row.package_count,
            row.container_type,
            row.transport_method,
            row.delivery_address,
            row.cmr_unloading_complete_time,
            row.bill_number
          )
        }
      } else {
        // 创建新记录（使用实际表字段）
        // 注意：如果有卸货日期，自动将订单状态设为"已完成"
        const billId = generateId()
        const hasUnloadingTime = row.cmr_unloading_complete_time ? true : false
        
        if (hasUnloadingTime) {
          // 有卸货日期时，状态为已完成，同时设置完成时间
          await db.prepare(`
            INSERT INTO bills_of_lading (
              id, bill_number, container_number, customer_id, customer_name,
              port_of_loading, place_of_delivery, vessel, shipping_company, eta, etd,
              weight, volume, pieces, container_type,
              transport_method, cmr_delivery_address, cmr_unloading_complete_time,
              status, complete_time, is_void, create_time, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '已完成', NOW(), 0, COALESCE(?, NOW()), NOW())
          `).run(
            billId,
            row.bill_number,
            row.container_number,
            customerId,
            row.customer_name,
            row.port_of_loading,
            row.destination,
            row.vessel_voyage,
            row.shipping_company,
            row.eta,
            row.etd,
            row.weight,
            row.volume,
            row.package_count,
            row.container_type,
            row.transport_method,
            row.delivery_address,
            row.cmr_unloading_complete_time,
            row.create_time
          )
        } else {
          // 无卸货日期时，状态为pending
          await db.prepare(`
            INSERT INTO bills_of_lading (
              id, bill_number, container_number, customer_id, customer_name,
              port_of_loading, place_of_delivery, vessel, shipping_company, eta, etd,
              weight, volume, pieces, container_type,
              transport_method, cmr_delivery_address, cmr_unloading_complete_time,
              status, is_void, create_time, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, COALESCE(?, NOW()), NOW())
          `).run(
            billId,
            row.bill_number,
            row.container_number,
            customerId,
            row.customer_name,
            row.port_of_loading,
            row.destination,
            row.vessel_voyage,
            row.shipping_company,
            row.eta,
            row.etd,
            row.weight,
            row.volume,
            row.package_count,
            row.container_type,
            row.transport_method,
            row.delivery_address,
            row.cmr_unloading_complete_time,
            row.create_time
          )
        }
        // 添加到已存在集合，避免重复插入
        existingBillSet.add(row.bill_number)
      }
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}
