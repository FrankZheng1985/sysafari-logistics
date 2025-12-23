/**
 * 批量更新应付费用的供应商关联
 * 根据费用数据导入模板Excel文件更新fees表的supplier_id和supplier_name
 */

import XLSX from 'xlsx'
import { getDatabase } from '../config/database.js'

const EXCEL_PATH = '/Users/fengzheng/Downloads/费用数据导入模板.xlsx'

// 费用名称与供应商字段的映射关系
const FEE_SUPPLIER_MAPPING = {
  '运费': 'transport_provider',      // 运输服务商
  '其他杂费': 'transport_provider',  // 运输服务商
  '清关操作费': 'customs_provider',  // 清关服务商
  'HS CODE操作费': 'customs_provider', // 清关服务商
  '关税': 'customs_provider',        // 清关服务商
  '公司服务费': 'truck_provider'     // 台头服务商
}

async function main() {
  const db = getDatabase()
  
  console.log('📖 读取Excel文件...')
  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheet = workbook.Sheets['服务成本-应付']
  const data = XLSX.utils.sheet_to_json(sheet)
  
  console.log(`   找到 ${data.length} 条记录\n`)
  
  // Step 1: 收集所有供应商并确保它们在系统中存在
  console.log('🏢 检查供应商数据...')
  const allProviders = new Set()
  data.forEach(row => {
    if (row['运输服务商']) allProviders.add(row['运输服务商'])
    if (row['清关服务商']) allProviders.add(row['清关服务商'])
    if (row['台头服务商']) allProviders.add(row['台头服务商'])
  })
  
  // 获取系统中已有的供应商
  const existingProviders = await db.prepare(
    'SELECT id, provider_name FROM service_providers'
  ).all()
  const providerMap = new Map()
  existingProviders.forEach(p => {
    providerMap.set(p.provider_name, p.id)
  })
  
  // 创建缺失的供应商
  let createdCount = 0
  for (const providerName of allProviders) {
    if (!providerMap.has(providerName)) {
      const id = await createProvider(db, providerName)
      providerMap.set(providerName, id)
      console.log(`   ✅ 创建供应商: ${providerName}`)
      createdCount++
    }
  }
  console.log(`   供应商检查完成，新建 ${createdCount} 个\n`)
  
  // Step 2: 构建提单号到供应商的映射
  console.log('📋 构建提单-供应商映射...')
  const billProviderMap = new Map()
  data.forEach(row => {
    const billNumber = row['提单号']
    if (!billNumber) return
    
    billProviderMap.set(billNumber, {
      transport_provider: row['运输服务商'] || null,
      customs_provider: row['清关服务商'] || null,
      truck_provider: row['台头服务商'] || null
    })
  })
  console.log(`   ${billProviderMap.size} 个提单的供应商映射已建立\n`)
  
  // Step 3: 批量更新费用记录
  console.log('🔄 开始更新费用记录...')
  
  // 获取所有未关联供应商的应付费用
  const fees = await db.prepare(`
    SELECT f.id, f.fee_name, f.bill_number, b.bill_number as bol_number
    FROM fees f
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id
    WHERE f.fee_type = 'payable' 
      AND (f.supplier_id IS NULL OR f.supplier_id = '')
  `).all()
  
  console.log(`   找到 ${fees.length} 条未关联供应商的应付费用\n`)
  
  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  
  for (const fee of fees) {
    // 使用 bill_number 或关联的 bol_number
    const billNumber = fee.bol_number || fee.bill_number
    
    if (!billNumber) {
      skippedCount++
      continue
    }
    
    // 查找该提单的供应商映射
    const providers = billProviderMap.get(billNumber)
    if (!providers) {
      notFoundCount++
      continue
    }
    
    // 根据费用类型确定供应商字段
    const providerField = FEE_SUPPLIER_MAPPING[fee.fee_name]
    if (!providerField) {
      skippedCount++
      continue
    }
    
    const providerName = providers[providerField]
    if (!providerName) {
      skippedCount++
      continue
    }
    
    const providerId = providerMap.get(providerName)
    if (!providerId) {
      console.log(`   ⚠️ 供应商不存在: ${providerName}`)
      skippedCount++
      continue
    }
    
    // 更新费用记录
    await db.prepare(`
      UPDATE fees 
      SET supplier_id = $1, supplier_name = $2, updated_at = NOW()
      WHERE id = $3
    `).run(providerId, providerName, fee.id)
    
    updatedCount++
  }
  
  console.log('\n📊 更新完成！')
  console.log(`   ✅ 成功更新: ${updatedCount} 条`)
  console.log(`   ⏭️ 跳过: ${skippedCount} 条（无对应供应商字段或供应商为空）`)
  console.log(`   ❓ 未找到提单: ${notFoundCount} 条`)
  
  // 验证结果
  console.log('\n🔍 验证结果...')
  const stats = await db.prepare(`
    SELECT 
      fee_name,
      COUNT(*) as total,
      SUM(CASE WHEN supplier_id IS NOT NULL AND supplier_id != '' THEN 1 ELSE 0 END) as with_supplier
    FROM fees 
    WHERE fee_type = 'payable'
    GROUP BY fee_name
    ORDER BY total DESC
  `).all()
  
  console.log('费用名称 | 总数 | 已关联供应商')
  stats.forEach(s => {
    const percent = ((s.with_supplier / s.total) * 100).toFixed(1)
    console.log(`${s.fee_name} | ${s.total} | ${s.with_supplier} (${percent}%)`)
  })
}

async function createProvider(db, providerName) {
  // 生成唯一的供应商编码
  const code = 'SP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
  
  // 使用 RETURNING 获取自增ID
  const result = await db.prepare(`
    INSERT INTO service_providers (provider_code, provider_name, status, created_at)
    VALUES ($1, $2, 'active', NOW())
    RETURNING id
  `).get(code, providerName)
  
  return result.id
}

main().catch(console.error)

