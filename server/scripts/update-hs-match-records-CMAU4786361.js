/**
 * HS匹配记录更新脚本 - 柜号: CMAU4786361
 * 创建日期: 2024-12-30
 * 说明: 根据Excel人工匹配和系统匹配结果对比，更新正确的HS码和税率到匹配记录库
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

// 数据库配置 - 使用 .env 中的配置
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_LOCAL
const pool = new Pool({
  connectionString: DATABASE_URL
})

// 正确的HS码匹配数据
const correctHSCodes = [
  {
    productName: '置物架',
    productNameEn: 'Sideboard',
    hsCode: '9403609000',
    material: '密度板;金属',
    materialEn: 'density board; metal',
    dutyRate: 0,
    vatRate: 19,
    source: 'Excel人工匹配',
    reason: '密度板材质的置物架属于木制家具类(94章)'
  },
  {
    productName: '木制玩具',
    productNameEn: 'Puzzle entertainment tools',
    hsCode: '9503006110',
    material: '木',
    materialEn: 'Wood',
    dutyRate: 0,
    vatRate: 19,
    source: 'Excel人工匹配',
    reason: '玩具类产品应归入95章玩具类，而非44章木制品'
  },
  {
    productName: '电钻',
    productNameEn: 'Power Tools',
    hsCode: '8467219900',
    material: '塑料',
    materialEn: 'Plastic',
    dutyRate: 0,
    vatRate: 19,
    source: '系统匹配',
    reason: '电钻应优先归入8467.21电钻专用编码'
  },
  {
    productName: '抛光机',
    productNameEn: 'Power Tools',
    hsCode: '8467295100',
    material: '塑料',
    materialEn: 'Plastic',
    dutyRate: 2.7,
    vatRate: 19,
    source: 'Excel人工匹配',
    reason: '抛光机应归入8467.29.51角磨机/抛光机编码'
  },
  {
    productName: '摄影柔光箱',
    productNameEn: 'Professional studio lighting equipment',
    hsCode: '9006990000',
    material: 'ABS',
    materialEn: 'ABS',
    dutyRate: 3.2,
    vatRate: 19,
    source: '两者一致',
    reason: '摄影器材归入90章光学设备类'
  },
  {
    productName: '耗材干燥盒',
    productNameEn: '3D printing filament drying equipment',
    hsCode: '8419390000',
    material: '丙烯腈-丁二烯-苯乙烯',
    materialEn: 'ABS',
    dutyRate: 1.7,
    vatRate: 19,
    source: '系统匹配',
    reason: '独立干燥设备应归入84.19干燥设备类，而非打印机零件'
  },
  {
    productName: '耗材干燥盒',
    productNameEn: '3D printing filament drying equipment',
    hsCode: '8419390000',
    material: '加热丝',
    materialEn: 'Heating wire',
    dutyRate: 1.7,
    vatRate: 19,
    source: '系统匹配',
    reason: '独立干燥设备应归入84.19干燥设备类'
  },
  {
    productName: '3D打印机',
    productNameEn: '3D model creation and printing equipment',
    hsCode: '8485200000',
    material: '金属',
    materialEn: 'Metal',
    dutyRate: 1.7,
    vatRate: 19,
    source: '系统匹配',
    reason: '8485.20更适合完整的3D打印机/增材制造机器'
  },
  {
    productName: '蒸汽清洗机',
    productNameEn: 'High pressure steam cleaning kitchen equipment',
    hsCode: '8424300800',
    material: 'ABS',
    materialEn: 'ABS',
    dutyRate: 1.7,
    vatRate: 19,
    source: 'Excel人工匹配',
    reason: '高压蒸汽清洗机是机械式喷射设备，应归入84.24章'
  },
  {
    productName: '电焊机',
    productNameEn: 'Multifunctional welding tool',
    hsCode: '8515310000',
    material: '金属',
    materialEn: 'Metal',
    dutyRate: 2.7,
    vatRate: 19,
    source: 'Excel人工匹配',
    reason: '电弧焊接工具应归入85.15章电焊设备类'
  }
]

async function updateHSMatchRecords() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 开始更新HS匹配记录库...\n')
    console.log('=' .repeat(60))
    
    await client.query('BEGIN')
    
    let successCount = 0
    let updateCount = 0
    let insertCount = 0
    
    for (const item of correctHSCodes) {
      console.log(`\n📦 处理: ${item.productName} (${item.material || '无材质'})`)
      console.log(`   HS码: ${item.hsCode}, 关税率: ${item.dutyRate}%`)
      console.log(`   来源: ${item.source}`)
      console.log(`   原因: ${item.reason}`)
      
      // 检查是否存在相同品名+材质的记录
      const existingResult = await client.query(`
        SELECT id, hs_code, duty_rate, match_count 
        FROM hs_match_records 
        WHERE product_name = $1 AND COALESCE(material, '') = COALESCE($2, '')
        AND status = 'active'
      `, [item.productName, item.material || ''])
      
      if (existingResult.rows.length > 0) {
        // 更新现有记录
        const existing = existingResult.rows[0]
        console.log(`   📝 找到现有记录 (ID: ${existing.id}), 原HS码: ${existing.hs_code}, 原税率: ${existing.duty_rate}%`)
        
        await client.query(`
          UPDATE hs_match_records SET
            hs_code = $1,
            product_name_en = $2,
            material_en = $3,
            duty_rate = $4,
            vat_rate = $5,
            is_verified = 1,
            verified_at = NOW(),
            match_count = match_count + 1,
            last_match_time = NOW(),
            updated_at = NOW()
          WHERE id = $6
        `, [
          item.hsCode,
          item.productNameEn,
          item.materialEn,
          item.dutyRate,
          item.vatRate,
          existing.id
        ])
        
        console.log(`   ✅ 已更新记录 (ID: ${existing.id})`)
        updateCount++
      } else {
        // 插入新记录
        const insertResult = await client.query(`
          INSERT INTO hs_match_records (
            product_name, product_name_en, hs_code, material, material_en,
            origin_country, origin_country_code, duty_rate, vat_rate,
            is_verified, verified_at, match_count, first_match_time, last_match_time,
            status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'CN', 'CN', $6, $7, 1, NOW(), 1, NOW(), NOW(), 'active', NOW(), NOW())
          RETURNING id
        `, [
          item.productName,
          item.productNameEn,
          item.hsCode,
          item.material,
          item.materialEn,
          item.dutyRate,
          item.vatRate
        ])
        
        console.log(`   ✅ 已插入新记录 (ID: ${insertResult.rows[0].id})`)
        insertCount++
      }
      
      // 同时更新 hs_match_history 表
      const historyResult = await client.query(`
        UPDATE hs_match_history 
        SET matched_hs_code = $1, last_matched_at = NOW()
        WHERE product_name = $2
      `, [item.hsCode, item.productName])
      
      if (historyResult.rowCount > 0) {
        console.log(`   📜 同时更新了 ${historyResult.rowCount} 条历史记录`)
      }
      
      successCount++
    }
    
    await client.query('COMMIT')
    
    console.log('\n' + '=' .repeat(60))
    console.log('✅ HS匹配记录更新完成!')
    console.log(`   - 处理总数: ${correctHSCodes.length}`)
    console.log(`   - 成功: ${successCount}`)
    console.log(`   - 更新现有记录: ${updateCount}`)
    console.log(`   - 插入新记录: ${insertCount}`)
    
    // 显示更新后的结果
    console.log('\n📋 更新后的匹配记录:')
    console.log('-'.repeat(100))
    
    const result = await client.query(`
      SELECT 
        product_name as "商品名称",
        hs_code as "HS编码",
        material as "材质",
        duty_rate as "关税率(%)",
        vat_rate as "增值税率(%)",
        CASE WHEN is_verified = 1 THEN '是' ELSE '否' END as "已核实",
        match_count as "匹配次数"
      FROM hs_match_records 
      WHERE product_name IN ('置物架', '木制玩具', '电钻', '抛光机', '摄影柔光箱', '耗材干燥盒', '3D打印机', '蒸汽清洗机', '电焊机')
      AND status = 'active'
      ORDER BY product_name
    `)
    
    console.table(result.rows)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 更新失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行脚本
updateHSMatchRecords().catch(console.error)

