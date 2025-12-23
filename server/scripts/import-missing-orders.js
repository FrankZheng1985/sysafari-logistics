/**
 * 导入缺失订单脚本
 * 将Excel"先锋业务数据统计表"中缺失的13条订单导入系统
 */

import XLSX from 'xlsx'
import { importData } from '../modules/data-import/parsers/orderParser.js'
import { getDatabase } from '../config/database.js'

// 缺失的提单号列表
const MISSING_BILL_NUMBERS = [
  '180-44226873',
  'WAE2025112100078',
  'WAE2025112600084',
  'WAE2025120200043',
  'WAE2025120300144',
  '149509046835',
  '010501318206',
  'OOLU8881147600',
  'WAE2025121700034',
  'COSU6437502420',
  'COSU6436967510',
  '010501258921',
  '010501258939'
]

/**
 * 将Excel日期序列号转换为日期字符串
 */
function excelDateToString(excelDate) {
  if (!excelDate) return null
  if (typeof excelDate === 'string') return excelDate
  if (typeof excelDate === 'number') {
    // Excel日期序列号转换
    const date = XLSX.SSF.parse_date_code(excelDate)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  return null
}

/**
 * 从Excel提取缺失订单数据
 */
function extractMissingOrders(excelPath) {
  const workbook = XLSX.readFile(excelPath)
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
  
  const orders = []
  
  for (let i = 2; i < data.length; i++) {
    const row = data[i]
    const billNumber = String(row[10] || '').trim()
    
    if (MISSING_BILL_NUMBERS.includes(billNumber)) {
      // 映射Excel数据到系统字段
      const order = {
        _rowIndex: i + 1,
        bill_number: billNumber,
        container_number: String(row[3] || '').trim(),
        customer_name: String(row[2] || '').trim(),
        container_type: String(row[7] || '').trim(),
        shipping_company: String(row[8] || '').trim(),
        vessel_voyage: String(row[9] || '').trim(),
        port_of_loading: String(row[11] || '').trim(),
        destination: String(row[12] || '').trim(),
        port_of_discharge: String(row[12] || '').trim(), // 目的地也作为目的港
        service_type: String(row[13] || '').trim(),
        delivery_address: String(row[14] || '').trim(),
        cargo_value: row[15] ? parseFloat(row[15]) : null,
        etd: excelDateToString(row[18]),
        eta: excelDateToString(row[19]),
        customs_cleared_date: excelDateToString(row[20]),
        pickup_date: excelDateToString(row[21]),
        cmr_unloading_complete_time: excelDateToString(row[22]),
        package_count: row[23] ? parseInt(row[23]) : null,
        weight: row[24] ? parseFloat(String(row[24]).replace(/\s/g, '')) : null,
        volume: row[25] ? parseFloat(row[25]) : null,
        transport_method: String(row[6] || '').trim(),
        create_time: excelDateToString(row[1]) // 收单日期
      }
      
      orders.push(order)
      console.log(`提取订单: ${billNumber} | 客户: ${order.customer_name} | 柜号: ${order.container_number}`)
    }
  }
  
  return orders
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('开始导入缺失订单')
  console.log('========================================\n')
  
  const excelPath = '/Users/fengzheng/Downloads/先锋业务数据统计表.xlsx'
  
  // 1. 提取缺失订单数据
  console.log('步骤1: 从Excel提取缺失订单数据...\n')
  const orders = extractMissingOrders(excelPath)
  
  console.log(`\n共提取 ${orders.length} 条订单\n`)
  
  if (orders.length === 0) {
    console.log('没有找到需要导入的订单')
    process.exit(0)
  }
  
  // 2. 执行导入
  console.log('步骤2: 开始导入数据库...\n')
  
  try {
    const result = await importData(orders, { skipErrors: false })
    
    console.log('\n========================================')
    console.log('导入完成!')
    console.log('========================================')
    console.log(`成功: ${result.successCount} 条`)
    console.log(`失败: ${result.errorCount} 条`)
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n错误详情:')
      result.errors.forEach(err => {
        console.log(`  行 ${err.row}: ${err.error}`)
      })
    }
    
    // 3. 验证导入结果
    console.log('\n步骤3: 验证导入结果...\n')
    const db = getDatabase()
    
    for (const billNumber of MISSING_BILL_NUMBERS) {
      const bill = await db.prepare(
        'SELECT id, bill_number, container_number, customer_name, status FROM bills_of_lading WHERE bill_number = ?'
      ).get(billNumber)
      
      if (bill) {
        console.log(`✅ ${billNumber} - 已存在 (客户: ${bill.customer_name}, 状态: ${bill.status})`)
      } else {
        console.log(`❌ ${billNumber} - 未找到`)
      }
    }
    
  } catch (error) {
    console.error('导入失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
  
  console.log('\n导入脚本执行完毕')
  process.exit(0)
}

main()

