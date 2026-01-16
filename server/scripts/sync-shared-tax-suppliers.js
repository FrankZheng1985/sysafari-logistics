/**
 * 同步共享税号与供应商关联
 * 为已存在的共享税号创建对应的供应商
 */

import { getDatabase, generateId } from '../config/database.js'

async function syncSharedTaxSuppliers() {
  const db = getDatabase()
  
  console.log('🔄 开始同步共享税号与供应商关联...\n')
  
  // 1. 获取所有没有供应商关联的共享税号
  const taxNumbers = await db.prepare(`
    SELECT * FROM shared_tax_numbers WHERE supplier_id IS NULL
  `).all()
  
  console.log(`📋 找到 ${taxNumbers.length} 个没有供应商关联的共享税号\n`)
  
  for (const tax of taxNumbers) {
    const companyShortName = tax.company_short_name || tax.company_name
    if (!companyShortName) {
      console.log(`⚠️  跳过税号 ${tax.tax_number}：无公司名称`)
      continue
    }
    
    // 生成供应商编码
    const supplierCode = `IA-${companyShortName.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
    
    // 检查供应商是否已存在
    let supplier = await db.prepare(`
      SELECT id, supplier_code FROM suppliers WHERE supplier_code = ?
    `).get(supplierCode)
    
    let supplierId
    if (supplier) {
      supplierId = supplier.id
      console.log(`✅ 供应商已存在: ${supplierCode} (${supplierId})`)
    } else {
      // 创建新供应商
      supplierId = generateId()
      await db.prepare(`
        INSERT INTO suppliers (
          id, supplier_code, supplier_name, short_name, supplier_type,
          country, address, tax_number, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'tax_agent', ?, ?, ?, 'active', NOW(), NOW())
      `).run(
        supplierId,
        supplierCode,
        tax.company_name || companyShortName,
        companyShortName,
        tax.country || null,
        tax.company_address || null,
        tax.tax_number
      )
      console.log(`✨ 创建新供应商: ${supplierCode} (${supplierId})`)
    }
    
    // 更新共享税号的供应商关联
    await db.prepare(`
      UPDATE shared_tax_numbers 
      SET supplier_id = ?, supplier_code = ?, updated_at = NOW()
      WHERE id = ?
    `).run(supplierId, supplierCode, tax.id)
    
    console.log(`   关联到共享税号: ${tax.tax_number} -> ${supplierCode}\n`)
  }
  
  // 2. 显示同步后的结果
  console.log('\n📊 同步完成，当前共享税号与供应商关联：')
  const result = await db.prepare(`
    SELECT 
      stn.id, stn.company_short_name, stn.tax_number, stn.tax_type,
      stn.supplier_id, stn.supplier_code
    FROM shared_tax_numbers stn
    ORDER BY stn.company_name
  `).all()
  
  console.log('\n| 公司简称 | 税号类型 | 税号 | 供应商编码 |')
  console.log('|----------|----------|------|-----------|')
  for (const r of result) {
    console.log(`| ${r.company_short_name || '-'} | ${r.tax_type} | ${r.tax_number} | ${r.supplier_code || '-'} |`)
  }
  
  // 3. 检查费用中是否有匹配的供应商
  console.log('\n\n🔍 检查费用表中的供应商匹配情况...')
  const feeSuppliers = await db.prepare(`
    SELECT DISTINCT f.supplier_id, f.supplier_name, COUNT(*) as fee_count
    FROM fees f
    WHERE f.fee_type = 'payable' AND f.supplier_id IS NOT NULL
    GROUP BY f.supplier_id, f.supplier_name
    ORDER BY fee_count DESC
    LIMIT 20
  `).all()
  
  console.log('\n费用表中的供应商（应付）：')
  console.log('| 供应商ID | 供应商名称 | 费用数量 |')
  console.log('|----------|-----------|---------|')
  for (const f of feeSuppliers) {
    console.log(`| ${f.supplier_id?.substring(0, 8)}... | ${f.supplier_name || '-'} | ${f.fee_count} |`)
  }
  
  console.log('\n✅ 同步完成！')
}

syncSharedTaxSuppliers().catch(console.error)
