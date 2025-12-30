/**
 * HS匹配记录部署脚本 - 部署到阿里云RDS
 * 
 * 用法:
 *   # 部署到生产环境
 *   DATABASE_URL="postgresql://..." node scripts/deploy-hs-match-to-cloud.js prod
 *   
 *   # 部署到演示环境
 *   DATABASE_URL="postgresql://..." node scripts/deploy-hs-match-to-cloud.js demo
 *   
 *   # 或者使用环境变量文件
 *   source ~/.aliyun-prod.env && node scripts/deploy-hs-match-to-cloud.js prod
 */

import pg from 'pg'

const { Pool } = pg

// 检查参数
const env = process.argv[2]
if (!env || !['prod', 'demo'].includes(env)) {
  console.log('❌ 请指定环境: prod 或 demo')
  console.log('用法: DATABASE_URL="postgresql://..." node scripts/deploy-hs-match-to-cloud.js [prod|demo]')
  process.exit(1)
}

// 检查数据库连接
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.log('❌ 请设置 DATABASE_URL 环境变量')
  console.log('示例: DATABASE_URL="postgresql://user:pass@host:5432/db" node scripts/deploy-hs-match-to-cloud.js ' + env)
  process.exit(1)
}

// 数据库连接 - 阿里云RDS不需要SSL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
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
    reason: '玩具类产品应归入95章玩具类'
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
    reason: '独立干燥设备应归入84.19干燥设备类'
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

async function deployToCloud() {
  const client = await pool.connect()
  const envName = env === 'prod' ? '🔴 生产环境' : '🟡 演示环境'
  
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🚀 开始部署HS匹配记录到 ${envName}`)
    console.log(`${'='.repeat(60)}\n`)
    
    // 测试连接
    const dbInfo = await client.query('SELECT current_database() as db, current_user as user')
    console.log(`✅ 数据库连接成功: ${dbInfo.rows[0].db} (用户: ${dbInfo.rows[0].user})`)
    
    await client.query('BEGIN')
    
    let successCount = 0
    let updateCount = 0
    let insertCount = 0
    
    for (const item of correctHSCodes) {
      console.log(`\n📦 处理: ${item.productName} (${item.material || '无材质'})`)
      console.log(`   HS码: ${item.hsCode}, 关税率: ${item.dutyRate}%`)
      
      // 检查是否存在相同品名+材质的记录
      const existingResult = await client.query(`
        SELECT id, hs_code, duty_rate, match_count 
        FROM hs_match_records 
        WHERE product_name = $1 AND COALESCE(material, '') = COALESCE($2, '')
        AND status = 'active'
      `, [item.productName, item.material || ''])
      
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0]
        console.log(`   📝 找到现有记录 (ID: ${existing.id}), 原HS码: ${existing.hs_code}`)
        
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
        
        console.log(`   ✅ 已更新`)
        updateCount++
      } else {
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
      await client.query(`
        UPDATE hs_match_history 
        SET matched_hs_code = $1, last_matched_at = NOW()
        WHERE product_name = $2
      `, [item.hsCode, item.productName])
      
      successCount++
    }
    
    await client.query('COMMIT')
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ 部署完成! ${envName}`)
    console.log(`   - 处理总数: ${correctHSCodes.length}`)
    console.log(`   - 更新记录: ${updateCount}`)
    console.log(`   - 新增记录: ${insertCount}`)
    console.log(`${'='.repeat(60)}\n`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`\n❌ 部署失败 (${envName}):`, error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行
deployToCloud().catch(err => {
  console.error('部署错误:', err.message)
  process.exit(1)
})

