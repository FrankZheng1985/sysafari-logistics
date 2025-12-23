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
  '目的港': { field: 'port_of_discharge', required: false }, // 目的港（卸货港）
  '服务': { field: 'service_type', required: false }, // 销售产品
  '派送市场地址': { field: 'delivery_address', required: false },
  '派送地址': { field: 'delivery_address', required: false }, // 派送地址别名
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
  '体积': { field: 'volume', required: false, type: 'number' },
  // === 新增字段（2025-12-24）===
  // 提单基础信息
  '提单类型': { field: 'bill_type', required: false }, // 如：正本、电放、海运单等
  '航次': { field: 'voyage', required: false }, // 单独的航次号
  // 参与方信息
  '发货人': { field: 'shipper', required: false }, // 托运人
  '收货人': { field: 'consignee', required: false }, // 收货人
  '通知方': { field: 'notify_party', required: false }, // 到货通知方
  // 货物信息
  '货物描述': { field: 'description', required: false }, // 货物品名描述
  // 附加属性
  '运输安排': { field: 'transport_arrangement', required: false }, // 运输安排方式
  '收货人类型': { field: 'consignee_type', required: false }, // 如：个人、公司等
  '还柜': { field: 'container_return', required: false }, // 还柜要求
  '整柜运输': { field: 'full_container_transport', required: false }, // 是否整柜运输
  '尾程运输': { field: 'last_mile_transport', required: false }, // 尾程运输方式
  '拆箱': { field: 'devanning', required: false }, // 是否需要拆箱
  'T1申报': { field: 't1_declaration', required: false }, // T1报关类型
  // 其他
  '备注': { field: 'remark', required: false }, // 订单备注
  '中转港': { field: 'skip_port', required: false } // 中转港口
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
    // 示例数据（对应41个字段，去除别名字段）
    [
      // 原有字段(26个有效字段值)
      '2025/1/15',              // 收单日期
      '深圳电子科技',            // 客户名称
      'OOLU1234567',            // 柜号
      '是',                      // 正本提单
      '是',                      // 是否授权
      '海运整柜',                // 运输方式
      '40HQ',                   // 型号
      '中远海运',                // 船公司
      'VY2501',                 // 船名航次
      'BP2500001',              // 提单号
      '深圳蛇口',                // 起运港
      '汉堡',                    // 目的地
      '汉堡港',                  // 目的港
      '清提派',                  // 服务
      'Hamburg, Germany',       // 派送市场地址（派送地址别名共用值）
      '25000',                  // 货柜金额
      '2025/1/10',              // 资料发送日期
      '2025/1/12',              // CMR发送日期
      '2025/1/8',               // ETD
      '2025/1/20',              // ETA
      '2025/1/23',              // 清关完成日期
      '2025/1/24',              // 提柜日期
      '2025/1/25',              // 卸货日期
      '100',                    // 箱/件数
      '5000',                   // 货量
      '50',                     // 体积
      // 新增字段(15个)
      '正本',                    // 提单类型
      '2501E',                  // 航次
      '深圳发货方有限公司',       // 发货人
      'Hamburg Import GmbH',    // 收货人
      'Notify Party GmbH',      // 通知方
      '电子产品、家用电器',       // 货物描述
      '门到门',                  // 运输安排
      '公司',                    // 收货人类型
      '是',                      // 还柜
      '是',                      // 整柜运输
      '卡车运输',                // 尾程运输
      '否',                      // 拆箱
      'T1',                     // T1申报
      '请优先清关',              // 备注
      '鹿特丹'                   // 中转港
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
        // 更新现有记录（根据日期字段自动设置状态）
        // 状态流转规则（仅针对Excel导入的历史订单）：
        // - 有ETA且ETA <= 今天 -> ata=ETA, ship_status='已到港'（ETA在未来则不设置ATA）
        // - 有清关完成日期 -> customs_release_time, customs_status='已放行', doc_swap_status='已换单', doc_swap_time
        // - 有提柜日期 -> cmr_pickup_time, delivery_status='已提柜'
        // - 有卸货日期 -> cmr_unloading_complete_time, delivery_status='已送达', status='已完成'
        
        // 根据日期字段计算状态
        const hasEta = row.eta ? true : false
        const hasClearance = row.customs_cleared_date ? true : false
        const hasPickup = row.pickup_date ? true : false
        const hasUnloading = row.cmr_unloading_complete_time ? true : false
        
        // 判断ETA是否已经过去（只有ETA <= 今天才能设置ATA和已到港状态）
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const etaDate = row.eta ? new Date(row.eta) : null
        const isEtaPassed = hasEta && etaDate && etaDate <= today
        
        // 确定派送状态（按优先级：卸货 > 提柜 > 无）
        let deliveryStatus = null
        if (hasUnloading) {
          deliveryStatus = '已送达'
        } else if (hasPickup) {
          deliveryStatus = '已提柜'
        }
        
        // 确定订单状态
        const orderStatus = hasUnloading ? '已完成' : 'pending'
        
        await db.prepare(`
          UPDATE bills_of_lading SET
            container_number = COALESCE(?, container_number),
            customer_id = COALESCE(?, customer_id),
            customer_name = COALESCE(?, customer_name),
            port_of_loading = COALESCE(?, port_of_loading),
            port_of_discharge = COALESCE(?, port_of_discharge),
            place_of_delivery = COALESCE(?, place_of_delivery),
            vessel = COALESCE(?, vessel),
            shipping_company = COALESCE(?, shipping_company),
            eta = COALESCE(?, eta),
            ata = COALESCE(?, ata),
            etd = COALESCE(?, etd),
            weight = COALESCE(?, weight),
            volume = COALESCE(?, volume),
            pieces = COALESCE(?, pieces),
            container_type = COALESCE(?, container_type),
            transport_method = COALESCE(?, transport_method),
            cmr_delivery_address = COALESCE(?, cmr_delivery_address),
            cmr_unloading_complete_time = COALESCE(?, cmr_unloading_complete_time),
            cmr_pickup_time = COALESCE(?, cmr_pickup_time),
            service_type = COALESCE(?, service_type),
            cargo_value = COALESCE(?, cargo_value),
            documents_sent_date = COALESCE(?, documents_sent_date),
            cmr_sent_date = COALESCE(?, cmr_sent_date),
            ship_status = COALESCE(?, ship_status),
            customs_status = COALESCE(?, customs_status),
            customs_release_time = COALESCE(?, customs_release_time),
            doc_swap_status = COALESCE(?, doc_swap_status),
            doc_swap_time = COALESCE(?, doc_swap_time),
            delivery_status = COALESCE(?, delivery_status),
            status = ?,
            complete_time = CASE WHEN ? = '已完成' THEN COALESCE(complete_time, TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')) ELSE complete_time END,
            -- 新增字段(15个)
            bill_type = COALESCE(?, bill_type),
            voyage = COALESCE(?, voyage),
            shipper = COALESCE(?, shipper),
            consignee = COALESCE(?, consignee),
            notify_party = COALESCE(?, notify_party),
            description = COALESCE(?, description),
            transport_arrangement = COALESCE(?, transport_arrangement),
            consignee_type = COALESCE(?, consignee_type),
            container_return = COALESCE(?, container_return),
            full_container_transport = COALESCE(?, full_container_transport),
            last_mile_transport = COALESCE(?, last_mile_transport),
            devanning = COALESCE(?, devanning),
            t1_declaration = COALESCE(?, t1_declaration),
            remark = COALESCE(?, remark),
            skip_port = COALESCE(?, skip_port),
            updated_at = NOW()
          WHERE bill_number = ?
        `).run(
          row.container_number,                              // 1
          customerId,                                        // 2
          row.customer_name,                                 // 3
          row.port_of_loading,                               // 4
          row.port_of_discharge,                             // 5
          row.destination,                                   // 6
          row.vessel_voyage,                                 // 7
          row.shipping_company,                              // 8
          row.eta,                                           // 9 eta
          isEtaPassed ? row.eta : null,                      // 10 ata (只有ETA已过去才设置ATA)
          row.etd,                                           // 11
          row.weight,                                        // 12
          row.volume,                                        // 13
          row.package_count,                                 // 14
          row.container_type,                                // 15
          row.transport_method,                              // 16
          row.delivery_address,                              // 17
          row.cmr_unloading_complete_time,                   // 18
          row.pickup_date,                                   // 19 cmr_pickup_time
          row.service_type,                                  // 20
          row.cargo_value,                                   // 21
          row.documents_sent_date,                           // 22
          row.cmr_sent_date,                                 // 23
          isEtaPassed ? '已到港' : null,                      // 24 ship_status (只有ETA已过去才设置已到港)
          hasClearance ? '已放行' : null,                     // 25 customs_status
          row.customs_cleared_date,                          // 26 customs_release_time
          hasClearance ? '已换单' : null,                     // 27 doc_swap_status
          row.customs_cleared_date,                          // 28 doc_swap_time
          deliveryStatus,                                    // 29 delivery_status
          orderStatus,                                       // 30 status
          orderStatus,                                       // 31 status (for CASE)
          // 新增字段参数(15个)
          row.bill_type,                                     // 32 提单类型
          row.voyage,                                        // 33 航次
          row.shipper,                                       // 34 发货人
          row.consignee,                                     // 35 收货人
          row.notify_party,                                  // 36 通知方
          row.description,                                   // 37 货物描述
          row.transport_arrangement,                         // 38 运输安排
          row.consignee_type,                                // 39 收货人类型
          row.container_return,                              // 40 还柜
          row.full_container_transport,                      // 41 整柜运输
          row.last_mile_transport,                           // 42 尾程运输
          row.devanning,                                     // 43 拆箱
          row.t1_declaration,                                // 44 T1申报
          row.remark,                                        // 45 备注
          row.skip_port,                                     // 46 中转港
          row.bill_number                                    // 47
        )
      } else {
        // 创建新记录（根据日期字段自动设置状态，仅针对Excel导入的历史订单）
        const billId = generateId()
        
        // 生成订单序号和订单号
        const seqResult = await db.prepare(
          "SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'"
        ).get()
        const nextSeq = (seqResult?.current_seq || 0) + 1
        const year = new Date().getFullYear().toString().slice(-2)
        const orderNumber = `BP${year}${String(nextSeq).padStart(5, '0')}`
        
        // 更新序列计数器
        await db.prepare(
          "UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = 'BILL'"
        ).run(nextSeq)
        
        // 根据日期字段计算状态
        const hasEta = row.eta ? true : false
        const hasClearance = row.customs_cleared_date ? true : false
        const hasPickup = row.pickup_date ? true : false
        const hasUnloading = row.cmr_unloading_complete_time ? true : false
        
        // 判断ETA是否已经过去（只有ETA <= 今天才能设置ATA和已到港状态）
        const today2 = new Date()
        today2.setHours(0, 0, 0, 0)
        const etaDate2 = row.eta ? new Date(row.eta) : null
        const isEtaPassed2 = hasEta && etaDate2 && etaDate2 <= today2
        
        // 确定派送状态（按优先级：卸货 > 提柜 > 无）
        let deliveryStatus = null
        if (hasUnloading) {
          deliveryStatus = '已送达'
        } else if (hasPickup) {
          deliveryStatus = '已提柜'
        }
        
        // 确定订单状态
        const orderStatus = hasUnloading ? '已完成' : 'pending'
        
        await db.prepare(`
          INSERT INTO bills_of_lading (
            id, order_seq, order_number, bill_number, container_number, customer_id, customer_name,
            port_of_loading, port_of_discharge, place_of_delivery, vessel, shipping_company, 
            eta, ata, etd, weight, volume, pieces, container_type,
            transport_method, cmr_delivery_address, cmr_unloading_complete_time, cmr_pickup_time,
            service_type, cargo_value, documents_sent_date, cmr_sent_date,
            ship_status, customs_status, customs_release_time, doc_swap_status, doc_swap_time,
            delivery_status, status, complete_time, is_void, create_time,
            -- 新增字段(15个)
            bill_type, voyage, shipper, consignee, notify_party, description,
            transport_arrangement, consignee_type, container_return, full_container_transport,
            last_mile_transport, devanning, t1_declaration, remark, skip_port,
            updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, CASE WHEN ? = '已完成' THEN TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') ELSE NULL END, 0, COALESCE(?, TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')),
            -- 新增字段值(15个)
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            NOW()
          )
        `).run(
          billId,                                            // 1 id
          nextSeq,                                           // 2 order_seq (新增)
          orderNumber,                                       // 3 order_number (新增)
          row.bill_number,                                   // 4
          row.container_number,                              // 5
          customerId,                                        // 6
          row.customer_name,                                 // 7
          row.port_of_loading,                               // 8
          row.port_of_discharge,                             // 9
          row.destination,                                   // 10 place_of_delivery
          row.vessel_voyage,                                 // 11 vessel
          row.shipping_company,                              // 12
          row.eta,                                           // 13 eta
          isEtaPassed2 ? row.eta : null,                     // 14 ata (只有ETA已过去才设置ATA)
          row.etd,                                           // 15
          row.weight,                                        // 16
          row.volume,                                        // 17
          row.package_count,                                 // 18 pieces
          row.container_type,                                // 19
          row.transport_method,                              // 20
          row.delivery_address,                              // 21 cmr_delivery_address
          row.cmr_unloading_complete_time,                   // 22
          row.pickup_date,                                   // 23 cmr_pickup_time
          row.service_type,                                  // 24
          row.cargo_value,                                   // 25
          row.documents_sent_date,                           // 26
          row.cmr_sent_date,                                 // 27
          isEtaPassed2 ? '已到港' : null,                     // 28 ship_status (只有ETA已过去才设置已到港)
          hasClearance ? '已放行' : null,                     // 29 customs_status
          row.customs_cleared_date,                          // 30 customs_release_time
          hasClearance ? '已换单' : null,                     // 31 doc_swap_status
          row.customs_cleared_date,                          // 32 doc_swap_time
          deliveryStatus,                                    // 33 delivery_status
          orderStatus,                                       // 34 status
          orderStatus,                                       // 35 status (for CASE)
          row.create_time,                                   // 36 create_time
          // 新增字段参数(15个)
          row.bill_type,                                     // 37 提单类型
          row.voyage,                                        // 38 航次
          row.shipper,                                       // 39 发货人
          row.consignee,                                     // 40 收货人
          row.notify_party,                                  // 41 通知方
          row.description,                                   // 42 货物描述
          row.transport_arrangement,                         // 43 运输安排
          row.consignee_type,                                // 44 收货人类型
          row.container_return,                              // 45 还柜
          row.full_container_transport,                      // 46 整柜运输
          row.last_mile_transport,                           // 47 尾程运输
          row.devanning,                                     // 48 拆箱
          row.t1_declaration,                                // 49 T1申报
          row.remark,                                        // 50 备注
          row.skip_port                                      // 51 中转港
        )
        
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
