/**
 * 订单数据解析器
 * 解析Excel订单数据并导入到bills_of_lading表
 */

import XLSX from 'xlsx'
import { getDatabase, generateId } from '../../../config/database.js'

// 字段映射配置（基于用户模板 2025-12-29 更新）
// 带 * 的字段为必填项
// 注意：以下字段已从模板中移除，但系统中仍保留：正本提单、提单类型、发货人、运输安排、还柜、整柜运输、尾程运输、拆箱、备注
const FIELD_MAPPING = {
  // === 基础信息 ===
  '收单日期*': { field: 'create_time', required: true, type: 'date', hint: '2025/1/15' },
  '客户名称*': { field: 'customer_name', required: true, hint: '深圳电子科技' },
  '柜号*': { field: 'container_number', required: true, hint: 'OOLU1234567' },
  '运输方式*': { field: 'transport_method', required: true, hint: '海运/空运/铁运/卡航' },
  '型号*': { field: 'container_type', required: true, hint: '20/40HQ/45HQ' },
  '船公司*': { field: 'shipping_company', required: true, hint: '中远海运' },
  '船名航次*': { field: 'vessel_voyage', required: true, hint: 'VY2501' },
  '提单号*': { field: 'bill_number', required: true, unique: true, hint: 'COSU0000000000' },
  // === 港口信息 ===
  '起运港*': { field: 'port_of_loading', required: true, hint: '深圳蛇口' },
  '目的港*': { field: 'port_of_discharge', required: true, hint: '汉堡港' },
  '目的地*': { field: 'destination', required: true, hint: '国家' },
  // === 服务信息 ===
  '服务*': { field: 'service_type', required: true, hint: '清提派超大件/税号租用' },
  '派送市场地址*': { field: 'delivery_address', required: true, hint: '派送地址/Hamburg, Germany' },
  '货柜金额*': { field: 'cargo_value', required: true, type: 'number', hint: '20000' },
  // === 时间信息 ===
  'ETD*': { field: 'etd', required: true, type: 'date', hint: '2025/1/20' },
  'ETA*': { field: 'eta', required: true, type: 'date', hint: '2025/1/23' },
  // === 货物信息 ===
  '箱/件数*': { field: 'package_count', required: true, type: 'number', hint: '500' },
  '货重量*': { field: 'weight', required: true, type: 'weight', hint: '16000kg' },
  '体积*': { field: 'volume', required: true, type: 'volume', hint: '68cbm' },
  // === 提单信息 ===
  '收货人': { field: 'consignee', required: false, hint: '公司信息' },
  '通知方': { field: 'notify_party', required: false, hint: '公司信息' },
  '货物描述': { field: 'description', required: false, hint: '是' }
}

// 用于解析时的字段名映射（去掉*号）
const FIELD_NAME_MAP = Object.entries(FIELD_MAPPING).reduce((acc, [key, value]) => {
  const cleanKey = key.replace('*', '')
  acc[cleanKey] = value
  acc[key] = value // 保留带*的映射
  return acc
}, {})

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
 * 第1行：字段标题（带*标记必填项）
 * 第2行：提示词/示例数据
 */
export async function generateTemplate() {
  // 获取所有字段标题（保留*标记）
  const headers = Object.keys(FIELD_MAPPING)
  
  // 获取对应的提示词
  const hints = Object.values(FIELD_MAPPING).map(config => config.hint || '')
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    headers,  // 第1行：字段标题
    hints     // 第2行：提示词/示例
  ])
  
  // 设置列宽
  const colWidths = headers.map(h => ({ wch: Math.max(h.length * 2, 12) }))
  ws['!cols'] = colWidths
  
  XLSX.utils.book_append_sheet(wb, ws, '订单数据')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * 检测第2行是数据行还是提示词行
 * 提示词行的特征：全是字符串，且第一列不是日期
 */
function isHintRow(row, headers) {
  if (!row || row.length === 0) return true
  
  // 如果第一个单元格是日期类型，则是数据行
  const firstValue = row[0]
  if (firstValue instanceof Date) {
    return false
  }
  
  // 如果所有值都是字符串且没有日期/数字特征，认为是提示词行
  // 检查前5个非空单元格
  let stringCount = 0
  let dateCount = 0
  let checked = 0
  
  for (let i = 0; i < Math.min(row.length, 10); i++) {
    const value = row[i]
    if (value === null || value === undefined || value === '') continue
    
    checked++
    if (value instanceof Date) {
      dateCount++
    } else if (typeof value === 'string') {
      stringCount++
    }
    
    if (checked >= 5) break
  }
  
  // 如果发现了日期类型，肯定是数据行
  if (dateCount > 0) return false
  
  // 如果检查的单元格全是字符串，且数量较少，可能是提示词
  // 但如果第一个字符串看起来像客户名，则是数据行
  const firstNonEmpty = row.find(v => v !== null && v !== undefined && v !== '')
  if (typeof firstNonEmpty === 'string') {
    // 如果字符串很长或包含常见的示例词，认为是提示词行
    const hintKeywords = ['例如', '示例', '如：', '如:', '填写', '2025/', 'OOLU', '深圳', '宁波', '盐田']
    const isLikelyHint = hintKeywords.some(kw => String(firstNonEmpty).includes(kw))
    if (isLikelyHint && firstNonEmpty.length < 15) {
      return true
    }
  }
  
  return false
}

/**
 * 解析Excel文件
 * 智能检测数据起始行：
 * - 第1行：标题行
 * - 第2行：如果是提示词行则跳过，如果是数据行则包含
 * - 后续行：实际数据
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
    
    // 处理标题行（去掉*号以便匹配）
    const headers = rawData[0].map(h => String(h).trim())
    const columns = headers
    
    // 智能检测数据起始行
    // 检查第2行（索引1）是提示词行还是数据行
    let dataStartIndex = 1 // 默认从第2行开始（索引1）
    
    if (rawData.length >= 2) {
      const secondRow = rawData[1]
      if (isHintRow(secondRow, headers)) {
        dataStartIndex = 2 // 跳过提示词行，从第3行开始
        console.log('[订单导入] 检测到提示词行，从第3行开始读取数据')
      } else {
        console.log('[订单导入] 第2行为数据行，从第2行开始读取数据')
      }
    }
    
    // 解析数据行
    const data = []
    for (let i = dataStartIndex; i < rawData.length; i++) {
      const row = rawData[i]
      
      // 跳过空行
      if (!row || row.every(cell => !cell && cell !== 0)) {
        continue
      }
      
      const record = { _rowIndex: i + 1 }
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        const value = row[j]
        
        // 使用去掉*号的字段名进行映射
        const cleanHeader = header.replace('*', '')
        const mapping = FIELD_NAME_MAP[cleanHeader] || FIELD_NAME_MAP[header]
        
        if (mapping && mapping.field) {
          record[mapping.field] = formatValue(value, mapping.type)
        }
        // 保留原始字段名（去掉*号）
        record[`_${cleanHeader}`] = value
      }
      
      data.push(record)
    }
    
    console.log(`[订单导入] 解析完成，共 ${data.length} 条数据`)
    
    if (data.length === 0) {
      return { success: false, error: '没有找到有效数据行' }
    }
    
    return { success: true, data, columns }
    
  } catch (err) {
    console.error('[订单导入] 解析失败:', err)
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
    
    case 'weight':
      // 处理带单位的重量值，如 "16000kg" -> 16000
      if (typeof value === 'number') {
        return value
      }
      const weightStr = String(value).toLowerCase().replace(/[kg千克公斤吨t\s]/g, '')
      const weightNum = parseFloat(weightStr)
      return isNaN(weightNum) ? null : weightNum
    
    case 'volume':
      // 处理带单位的体积值，如 "68cbm" -> 68
      if (typeof value === 'number') {
        return value
      }
      const volumeStr = String(value).toLowerCase().replace(/[cbm立方米m³\s]/g, '')
      const volumeNum = parseFloat(volumeStr)
      return isNaN(volumeNum) ? null : volumeNum
      
    default:
      return String(value).trim()
  }
}

/**
 * 获取必填字段列表
 */
function getRequiredFields() {
  const required = []
  for (const [key, config] of Object.entries(FIELD_MAPPING)) {
    if (config.required && config.field) {
      const cleanKey = key.replace('*', '')
      required.push({ field: config.field, label: cleanKey })
    }
  }
  return required
}

/**
 * 校验数据
 */
export async function validateData(data) {
  console.log(`[订单导入] 开始校验 ${data.length} 条数据`)
  
  const errors = []
  const warnings = []
  let validCount = 0
  let errorCount = 0
  let warningCount = 0
  
  const db = getDatabase()
  const billNumbers = new Set()
  const containerNumbers = new Set()
  const requiredFields = getRequiredFields()
  
  console.log(`[订单导入] 必填字段:`, requiredFields.map(f => f.label).join(', '))
  
  // 预先批量查询所有客户（用于校验客户是否存在）
  const customerNames = [...new Set(data.map(r => r.customer_name).filter(Boolean))]
  console.log(`[订单导入] 待校验的客户名:`, customerNames.join(', '))
  
  const existingCustomerSet = new Set()
  
  if (customerNames.length > 0) {
    const placeholders = customerNames.map(() => '?').join(',')
    const existingCustomers = await db.prepare(`
      SELECT customer_name, company_name FROM customers 
      WHERE customer_name IN (${placeholders}) OR company_name IN (${placeholders})
    `).all(...customerNames, ...customerNames)
    
    console.log(`[订单导入] 数据库中找到 ${existingCustomers.length} 个匹配客户`)
    
    for (const c of existingCustomers) {
      if (c.customer_name) existingCustomerSet.add(c.customer_name)
      if (c.company_name) existingCustomerSet.add(c.company_name)
    }
    
    console.log(`[订单导入] 有效客户名集合:`, [...existingCustomerSet].join(', '))
  }
  
  for (const row of data) {
    const rowErrors = []
    const rowWarnings = []
    
    // 调试：显示当前行的关键字段
    console.log(`[订单导入] 校验第${row._rowIndex}行: 客户=${row.customer_name}, 柜号=${row.container_number}, 提单号=${row.bill_number}`)
    
    // 检查所有必填字段
    for (const { field, label } of requiredFields) {
      const value = row[field]
      if (value === null || value === undefined || value === '') {
        rowErrors.push(`${label}不能为空`)
      }
    }
    
    // 如果有必填字段缺失，输出详细信息
    if (rowErrors.length > 0) {
      console.log(`[订单导入] 第${row._rowIndex}行校验失败:`, rowErrors.join('; '))
    }
    
    // 检查客户是否存在（如果提供了客户名称，必须是已存在的客户）
    if (row.customer_name && !existingCustomerSet.has(row.customer_name)) {
      rowErrors.push(`客户 "${row.customer_name}" 不存在，请先在客户管理中创建该客户`)
    }
    
    // 检查柜号重复
    if (row.container_number) {
      if (containerNumbers.has(row.container_number)) {
        rowWarnings.push(`柜号 ${row.container_number} 在文件中重复`)
      } else {
        containerNumbers.add(row.container_number)
      }
    }
    
    // 检查提单号重复（如果提供了提单号）
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
    } else {
      // 提单号为空时，检查柜号是否已存在
      if (row.container_number) {
        const existingByContainer = await db.prepare(
          'SELECT id, bill_number FROM bills_of_lading WHERE container_number = ? LIMIT 1'
        ).get(row.container_number)
        
        if (existingByContainer) {
          rowWarnings.push(`柜号 ${row.container_number} 已存在（提单号: ${existingByContainer.bill_number}），将更新数据`)
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
 * @param {Array} data - 要导入的数据
 * @param {Object} options - 导入选项
 * @param {boolean} options.skipErrors - 是否跳过错误继续导入
 * @param {Object} options.importer - 导入者信息 { userId, userName }
 */
export async function importData(data, options = {}) {
  const db = getDatabase()
  const errors = []
  let successCount = 0
  let errorCount = 0
  
  // 获取导入者信息
  const importerId = options.importer?.userId || null
  const importerName = options.importer?.userName || null
  
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
  const existingBillMap = new Map() // bill_number -> id
  
  if (billNumbers.length > 0) {
    const placeholders = billNumbers.map(() => '?').join(',')
    const existingBills = await db.prepare(`
      SELECT id, bill_number FROM bills_of_lading WHERE bill_number IN (${placeholders})
    `).all(...billNumbers)
    
    for (const b of existingBills) {
      existingBillMap.set(b.bill_number, b.id)
    }
  }
  
  // 3. 预先批量查询所有柜号（用于没有提单号时的匹配）
  const containerNumbers = [...new Set(data.map(r => r.container_number).filter(Boolean))]
  const existingContainerMap = new Map() // container_number -> { id, bill_number }
  
  if (containerNumbers.length > 0) {
    const placeholders = containerNumbers.map(() => '?').join(',')
    const existingContainers = await db.prepare(`
      SELECT id, bill_number, container_number FROM bills_of_lading WHERE container_number IN (${placeholders})
    `).all(...containerNumbers)
    
    for (const c of existingContainers) {
      existingContainerMap.set(c.container_number, { id: c.id, bill_number: c.bill_number })
    }
  }
  
  // 4. 逐条处理数据
  for (const row of data) {
    try {
      // 跳过错误行（柜号是必填的）
      if (options.skipErrors && !row.container_number) {
        errors.push({ row: row._rowIndex, error: '柜号为空' })
        errorCount++
        continue
      }
      
      // 查找客户（不允许自动创建新客户）
      let customerId = null
      if (row.customer_name) {
        customerId = customerMap.get(row.customer_name)
        
        if (!customerId) {
          // 客户不存在，报错（不允许自动创建客户档案）
          errors.push({ row: row._rowIndex, error: `客户 "${row.customer_name}" 不存在，请先在客户管理中创建该客户` })
          errorCount++
          continue
        }
      }
      
      // 确定是否为已存在记录
      let existingId = null
      let existingBillNumber = null
      
      // 优先使用提单号匹配
      if (row.bill_number && existingBillMap.has(row.bill_number)) {
        existingId = existingBillMap.get(row.bill_number)
        existingBillNumber = row.bill_number
      }
      // 如果没有提单号，使用柜号匹配
      else if (!row.bill_number && row.container_number && existingContainerMap.has(row.container_number)) {
        const existing = existingContainerMap.get(row.container_number)
        existingId = existing.id
        existingBillNumber = existing.bill_number
      }
      
      // 根据ETA计算状态
      const hasEta = row.eta ? true : false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const etaDate = row.eta ? new Date(row.eta) : null
      const isEtaPassed = hasEta && etaDate && etaDate <= today
      
      if (existingId) {
        // 更新现有记录
        await db.prepare(`
          UPDATE bills_of_lading SET
            container_number = COALESCE(?, container_number),
            customer_id = COALESCE(?, customer_id),
            customer_name = COALESCE(?, customer_name),
            transport_method = COALESCE(?, transport_method),
            container_type = COALESCE(?, container_type),
            shipping_company = COALESCE(?, shipping_company),
            vessel = COALESCE(?, vessel),
            port_of_loading = COALESCE(?, port_of_loading),
            port_of_discharge = COALESCE(?, port_of_discharge),
            place_of_delivery = COALESCE(?, place_of_delivery),
            service_type = COALESCE(?, service_type),
            cmr_delivery_address = COALESCE(?, cmr_delivery_address),
            cargo_value = COALESCE(?, cargo_value),
            etd = COALESCE(?, etd),
            eta = COALESCE(?, eta),
            ata = COALESCE(?, ata),
            pieces = COALESCE(?, pieces),
            weight = COALESCE(?, weight),
            volume = COALESCE(?, volume),
            bill_type = COALESCE(?, bill_type),
            shipper = COALESCE(?, shipper),
            consignee = COALESCE(?, consignee),
            notify_party = COALESCE(?, notify_party),
            description = COALESCE(?, description),
            transport_arrangement = COALESCE(?, transport_arrangement),
            container_return = COALESCE(?, container_return),
            full_container_transport = COALESCE(?, full_container_transport),
            last_mile_transport = COALESCE(?, last_mile_transport),
            devanning = COALESCE(?, devanning),
            remark = COALESCE(?, remark),
            ship_status = COALESCE(?, ship_status),
            imported_by = COALESCE(?, imported_by),
            imported_by_name = COALESCE(?, imported_by_name),
            import_time = COALESCE(import_time, NOW()),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          row.container_number,                              // 1 container_number
          customerId,                                        // 2 customer_id
          row.customer_name,                                 // 3 customer_name
          row.transport_method,                              // 4 transport_method
          row.container_type,                                // 5 container_type
          row.shipping_company,                              // 6 shipping_company
          row.vessel_voyage,                                 // 7 vessel
          row.port_of_loading,                               // 8 port_of_loading
          row.port_of_discharge,                             // 9 port_of_discharge
          row.destination,                                   // 10 place_of_delivery
          row.service_type,                                  // 11 service_type
          row.delivery_address,                              // 12 cmr_delivery_address
          row.cargo_value,                                   // 13 cargo_value
          row.etd,                                           // 14 etd
          row.eta,                                           // 15 eta
          isEtaPassed ? row.eta : null,                      // 16 ata
          row.package_count,                                 // 17 pieces
          row.weight,                                        // 18 weight
          row.volume,                                        // 19 volume
          row.bill_type,                                     // 20 bill_type
          row.shipper,                                       // 21 shipper
          row.consignee,                                     // 22 consignee
          row.notify_party,                                  // 23 notify_party
          row.description,                                   // 24 description
          row.transport_arrangement,                         // 25 transport_arrangement
          row.container_return,                              // 26 container_return
          row.full_container_transport,                      // 27 full_container_transport
          row.last_mile_transport,                           // 28 last_mile_transport
          row.devanning,                                     // 29 devanning
          row.remark,                                        // 30 remark
          isEtaPassed ? '已到港' : null,                      // 31 ship_status
          importerId,                                        // 32 imported_by
          importerName,                                      // 33 imported_by_name
          existingId                                         // 34 id (WHERE)
        )
      } else {
        // 创建新记录
        const billId = generateId()
        
        // 原子操作：递增并返回新序号（防止并发导致重复）
        const seqResult = await db.prepare(
          "UPDATE order_sequences SET current_seq = current_seq + 1, updated_at = NOW() WHERE business_type = 'BILL' RETURNING current_seq"
        ).get()
        const nextSeq = seqResult?.current_seq || 1
        const year = new Date().getFullYear().toString().slice(-2)
        const orderNumber = `BP${year}${String(nextSeq).padStart(5, '0')}`
        
        // 如果没有提供提单号，使用订单号作为提单号
        const billNumber = row.bill_number || orderNumber
        
        await db.prepare(`
          INSERT INTO bills_of_lading (
            id, order_seq, order_number, bill_number, container_number, customer_id, customer_name,
            transport_method, container_type, shipping_company, vessel,
            port_of_loading, port_of_discharge, place_of_delivery, service_type, cmr_delivery_address,
            cargo_value, etd, eta, ata, pieces, weight, volume,
            bill_type, shipper, consignee, notify_party, description,
            transport_arrangement, container_return, full_container_transport, last_mile_transport, devanning,
            remark, ship_status, status, is_void, create_time,
            imported_by, imported_by_name, import_time, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, 'pending', 0, COALESCE(?, TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')),
            ?, ?, NOW(), NOW()
          )
        `).run(
          billId,                                            // 1 id
          nextSeq,                                           // 2 order_seq
          orderNumber,                                       // 3 order_number
          billNumber,                                        // 4 bill_number (使用提供的或自动生成的)
          row.container_number,                              // 5 container_number
          customerId,                                        // 6 customer_id
          row.customer_name,                                 // 7 customer_name
          row.transport_method,                              // 8 transport_method
          row.container_type,                                // 9 container_type
          row.shipping_company,                              // 10 shipping_company
          row.vessel_voyage,                                 // 11 vessel
          row.port_of_loading,                               // 12 port_of_loading
          row.port_of_discharge,                             // 13 port_of_discharge
          row.destination,                                   // 14 place_of_delivery
          row.service_type,                                  // 15 service_type
          row.delivery_address,                              // 16 cmr_delivery_address
          row.cargo_value,                                   // 17 cargo_value
          row.etd,                                           // 18 etd
          row.eta,                                           // 19 eta
          isEtaPassed ? row.eta : null,                      // 20 ata
          row.package_count,                                 // 21 pieces
          row.weight,                                        // 22 weight
          row.volume,                                        // 23 volume
          row.bill_type,                                     // 24 bill_type
          row.shipper,                                       // 25 shipper
          row.consignee,                                     // 26 consignee
          row.notify_party,                                  // 27 notify_party
          row.description,                                   // 28 description
          row.transport_arrangement,                         // 29 transport_arrangement
          row.container_return,                              // 30 container_return
          row.full_container_transport,                      // 31 full_container_transport
          row.last_mile_transport,                           // 32 last_mile_transport
          row.devanning,                                     // 33 devanning
          row.remark,                                        // 34 remark
          isEtaPassed ? '已到港' : null,                      // 35 ship_status
          row.create_time,                                   // 36 create_time
          importerId,                                        // 37 imported_by
          importerName                                       // 38 imported_by_name
        )
        
        // 添加到已存在集合，避免重复插入
        existingBillMap.set(billNumber, billId)
        existingContainerMap.set(row.container_number, { id: billId, bill_number: billNumber })
      }
      
      successCount++
      
    } catch (err) {
      errors.push({ row: row._rowIndex, error: err.message })
      errorCount++
    }
  }
  
  return { successCount, errorCount, errors }
}
