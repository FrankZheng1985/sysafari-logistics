/**
 * 修复共享税号与供应商关联
 * 1. 删除重复创建的供应商（tax_agent类型）
 * 2. 将共享税号关联到原有的供应商
 */

import { getDatabase } from '../config/database.js'

async function fixSharedTaxSuppliers() {
  const db = getDatabase()
  
  console.log('🔧 开始修复共享税号与供应商关联...\n')
  
  // 定义正确的映射关系：共享税号公司 -> 已存在的供应商编码
  const supplierMappings = {
    // 公司简称 -> 供应商编码
    'DBWIH': 'IA-DBWIH',
    'kurz DBWIH': 'IA-DBWIH',
    'DWGK': 'IA-DWGK',
    'Feldsberg': 'IA-FELDSBERG',
    'Feld': 'IA-FELDSBERG',
    'KIWI': 'IA-KIWISTAV',
    'Kiwistav': 'IA-KIWISTAV',
    'KIWISTAV': 'IA-KIWISTAV',
    'Kralovec AI': 'IA-KRALOVECAI',
  }
  
  // 1. 查找所有原有的 IA- 供应商（进口代理商类型）
  console.log('📋 查找已存在的供应商...')
  const existingSuppliers = await db.prepare(`
    SELECT id, supplier_code, supplier_name, short_name, supplier_type
    FROM suppliers 
    WHERE supplier_code LIKE 'IA-%' AND supplier_type != 'tax_agent'
    ORDER BY supplier_code
  `).all()
  
  console.log('\n已存在的供应商：')
  for (const s of existingSuppliers) {
    console.log(`  ${s.supplier_code}: ${s.supplier_name} (${s.supplier_type})`)
  }
  
  // 2. 删除重复创建的 tax_agent 类型供应商
  console.log('\n🗑️  删除重复创建的供应商...')
  const duplicateSuppliers = await db.prepare(`
    SELECT id, supplier_code, supplier_name
    FROM suppliers 
    WHERE supplier_type = 'tax_agent'
  `).all()
  
  for (const dup of duplicateSuppliers) {
    // 检查是否有原有供应商
    const originalCode = dup.supplier_code
    const hasOriginal = existingSuppliers.some(s => s.supplier_code === originalCode)
    
    if (hasOriginal) {
      console.log(`  删除重复: ${dup.supplier_code} (${dup.supplier_name})`)
      await db.prepare('DELETE FROM suppliers WHERE id = ?').run(dup.id)
    } else {
      console.log(`  保留新建: ${dup.supplier_code} (${dup.supplier_name})`)
    }
  }
  
  // 3. 更新共享税号关联到正确的供应商
  console.log('\n🔗 更新共享税号关联...')
  const taxNumbers = await db.prepare(`
    SELECT id, company_short_name, company_name, tax_number
    FROM shared_tax_numbers
  `).all()
  
  for (const tax of taxNumbers) {
    const shortName = tax.company_short_name || tax.company_name
    
    // 查找匹配的供应商
    let targetSupplierCode = supplierMappings[shortName]
    
    if (!targetSupplierCode) {
      // 尝试模糊匹配
      for (const [key, code] of Object.entries(supplierMappings)) {
        if (shortName?.toLowerCase().includes(key.toLowerCase()) || 
            key.toLowerCase().includes(shortName?.toLowerCase())) {
          targetSupplierCode = code
          break
        }
      }
    }
    
    if (!targetSupplierCode) {
      // 根据公司简称生成供应商编码
      targetSupplierCode = `IA-${shortName?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNKNOWN'}`
    }
    
    // 查找供应商
    const supplier = await db.prepare(`
      SELECT id, supplier_code FROM suppliers WHERE supplier_code = ?
    `).get(targetSupplierCode)
    
    if (supplier) {
      await db.prepare(`
        UPDATE shared_tax_numbers 
        SET supplier_id = ?, supplier_code = ?, updated_at = NOW()
        WHERE id = ?
      `).run(supplier.id, supplier.supplier_code, tax.id)
      console.log(`  ✅ ${tax.tax_number} -> ${supplier.supplier_code}`)
    } else {
      console.log(`  ⚠️  ${tax.tax_number}: 未找到供应商 ${targetSupplierCode}`)
    }
  }
  
  // 4. 显示最终结果
  console.log('\n📊 最终关联结果：')
  const result = await db.prepare(`
    SELECT 
      stn.company_short_name, stn.tax_type, stn.tax_number,
      stn.supplier_code, s.supplier_name
    FROM shared_tax_numbers stn
    LEFT JOIN suppliers s ON stn.supplier_id = s.id
    ORDER BY stn.supplier_code
  `).all()
  
  console.log('\n| 公司简称 | 税号类型 | 税号 | 供应商编码 | 供应商名称 |')
  console.log('|----------|----------|------|-----------|-----------|')
  for (const r of result) {
    console.log(`| ${r.company_short_name || '-'} | ${r.tax_type} | ${r.tax_number} | ${r.supplier_code || '-'} | ${r.supplier_name || '-'} |`)
  }
  
  console.log('\n✅ 修复完成！')
}

fixSharedTaxSuppliers().catch(console.error)
