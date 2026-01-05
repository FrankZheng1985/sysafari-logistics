/**
 * TARIC 模板数据导入脚本
 * 将线下实际数据导入到 hs_match_records 和 tariff_rates 表
 * 
 * 使用方法: node scripts/import-taric-template.js
 */

import pg from 'pg';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 阿里云 RDS PostgreSQL 生产数据库
const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4.pg.rds.aliyuncs.com:5432/sysafari_logistics?sslmode=disable';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5,
});

// Excel 文件路径（ECS 服务器上的路径）
const EXCEL_PATH = '/tmp/TARIC_Import_Template.xlsx';

/**
 * 步骤1: 修改表结构，添加新字段
 */
async function alterTableStructure() {
  console.log('\n📋 步骤1: 检查并修改表结构...');
  
  const alterStatements = [
    // hs_match_records 表添加新字段
    `ALTER TABLE hs_match_records ADD COLUMN IF NOT EXISTS min_declaration_value_range TEXT`,
    `ALTER TABLE hs_match_records ADD COLUMN IF NOT EXISTS ref_weight_range TEXT`,
    `ALTER TABLE hs_match_records ADD COLUMN IF NOT EXISTS usage_scenario TEXT`,
    
    // tariff_rates 表确保有 material 和 usage_scenario 字段
    `ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS material TEXT`,
    `ALTER TABLE tariff_rates ADD COLUMN IF NOT EXISTS usage_scenario TEXT`,
  ];
  
  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
      console.log('  ✅', sql.substring(0, 60) + '...');
    } catch (err) {
      if (err.code === '42701') { // duplicate column
        console.log('  ⏭️ 字段已存在，跳过');
      } else {
        console.error('  ❌ 执行失败:', err.message);
      }
    }
  }
  
  console.log('✅ 表结构修改完成');
}

/**
 * 步骤2: 读取 Excel 数据
 */
function readExcelData() {
  console.log('\n📊 步骤2: 读取 Excel 数据...');
  
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`  读取到 ${data.length} 条记录`);
  
  // 数据清洗和转换
  const cleanedData = data.map(row => ({
    hsCode: String(row.hs_code || '').padStart(8, '0'),
    hsCode10: String(row.hs_code_10 || '').padStart(10, '0'),
    productNameEn: row.description || '',
    productName: row.description_cn || '',
    originCountryCode: row.origin_country_code || 'CN',
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19, // 默认德国增值税率
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    unitCode: row.unit_code || null,
    unitName: row.unit_name || null,
    material: row.material || null,
    usageScenario: row.usage_scenario || null,
    minDeclarationValueRange: row.min_declaration_value || null,
    refWeightRange: row['参考重量范围'] || null,
  }));
  
  console.log('✅ 数据读取完成');
  return cleanedData;
}

/**
 * 步骤3: 导入到 hs_match_records 表
 */
async function importToMatchRecords(data) {
  console.log('\n📥 步骤3: 导入到 hs_match_records 表...');
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const row of data) {
    try {
      // 检查是否已存在（根据 hs_code + product_name + material 组合）
      const existingQuery = `
        SELECT id FROM hs_match_records 
        WHERE hs_code = $1 
          AND (product_name = $2 OR product_name_en = $3)
          AND (material = $4 OR (material IS NULL AND $4 IS NULL))
        LIMIT 1
      `;
      const existing = await pool.query(existingQuery, [
        row.hsCode10, row.productName, row.productNameEn, row.material
      ]);
      
      if (existing.rows.length > 0) {
        // 更新现有记录
        const updateQuery = `
          UPDATE hs_match_records SET
            product_name = COALESCE($1, product_name),
            product_name_en = COALESCE($2, product_name_en),
            material = COALESCE($3, material),
            origin_country_code = COALESCE($4, origin_country_code),
            duty_rate = COALESCE($5, duty_rate),
            vat_rate = COALESCE($6, vat_rate),
            anti_dumping_rate = COALESCE($7, anti_dumping_rate),
            min_declaration_value_range = COALESCE($8, min_declaration_value_range),
            ref_weight_range = COALESCE($9, ref_weight_range),
            usage_scenario = COALESCE($10, usage_scenario),
            updated_at = NOW()
          WHERE id = $11
        `;
        await pool.query(updateQuery, [
          row.productName,
          row.productNameEn,
          row.material,
          row.originCountryCode,
          row.dutyRate,
          row.vatRate,
          row.antiDumpingRate,
          row.minDeclarationValueRange,
          row.refWeightRange,
          row.usageScenario,
          existing.rows[0].id
        ]);
        updated++;
      } else {
        // 插入新记录
        const insertQuery = `
          INSERT INTO hs_match_records (
            product_name, product_name_en, hs_code, material, material_en,
            origin_country_code, duty_rate, vat_rate, anti_dumping_rate,
            min_declaration_value_range, ref_weight_range, usage_scenario,
            match_count, is_verified, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            1, 1, 'active', NOW(), NOW()
          )
        `;
        await pool.query(insertQuery, [
          row.productName,
          row.productNameEn,
          row.hsCode10,
          row.material,
          row.material, // material_en 暂时用中文
          row.originCountryCode,
          row.dutyRate,
          row.vatRate,
          row.antiDumpingRate,
          row.minDeclarationValueRange,
          row.refWeightRange,
          row.usageScenario
        ]);
        inserted++;
      }
    } catch (err) {
      console.error(`  ❌ 导入失败 [${row.hsCode10}] ${row.productName}:`, err.message);
      errors++;
    }
  }
  
  console.log(`✅ hs_match_records 导入完成:`);
  console.log(`   新增: ${inserted} 条`);
  console.log(`   更新: ${updated} 条`);
  console.log(`   失败: ${errors} 条`);
  
  return { inserted, updated, errors };
}

/**
 * 步骤4: 更新 tariff_rates 表的材质信息
 */
async function updateTariffRates(data) {
  console.log('\n📝 步骤4: 更新 tariff_rates 表材质信息...');
  
  // 按 HS 编码分组，获取唯一的材质信息
  const materialMap = new Map();
  data.forEach(row => {
    if (row.material && !materialMap.has(row.hsCode10)) {
      materialMap.set(row.hsCode10, {
        material: row.material,
        usageScenario: row.usageScenario
      });
    }
  });
  
  console.log(`  找到 ${materialMap.size} 个唯一 HS 编码的材质信息`);
  
  let updated = 0;
  let notFound = 0;
  
  for (const [hsCode, info] of materialMap) {
    try {
      const result = await pool.query(`
        UPDATE tariff_rates 
        SET material = COALESCE(material, $1),
            usage_scenario = COALESCE(usage_scenario, $2),
            updated_at = NOW()
        WHERE hs_code_10 = $3 AND material IS NULL
      `, [info.material, info.usageScenario, hsCode]);
      
      if (result.rowCount > 0) {
        updated += result.rowCount;
      } else {
        notFound++;
      }
    } catch (err) {
      console.error(`  ❌ 更新失败 [${hsCode}]:`, err.message);
    }
  }
  
  console.log(`✅ tariff_rates 更新完成:`);
  console.log(`   更新: ${updated} 条记录`);
  console.log(`   未匹配: ${notFound} 个 HS 编码`);
  
  return { updated, notFound };
}

/**
 * 步骤5: 验证导入结果
 */
async function verifyImport() {
  console.log('\n🔍 步骤5: 验证导入结果...');
  
  // 统计 hs_match_records
  const matchStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN min_declaration_value_range IS NOT NULL THEN 1 END) as with_price_range,
      COUNT(CASE WHEN ref_weight_range IS NOT NULL THEN 1 END) as with_weight_range,
      COUNT(CASE WHEN material IS NOT NULL THEN 1 END) as with_material
    FROM hs_match_records
  `);
  
  console.log('\n  📊 hs_match_records 统计:');
  console.log(`     总记录数: ${matchStats.rows[0].total}`);
  console.log(`     有价格区间: ${matchStats.rows[0].with_price_range}`);
  console.log(`     有重量区间: ${matchStats.rows[0].with_weight_range}`);
  console.log(`     有材质信息: ${matchStats.rows[0].with_material}`);
  
  // 统计 tariff_rates
  const tariffStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN material IS NOT NULL THEN 1 END) as with_material
    FROM tariff_rates
  `);
  
  console.log('\n  📊 tariff_rates 统计:');
  console.log(`     总记录数: ${tariffStats.rows[0].total}`);
  console.log(`     有材质信息: ${tariffStats.rows[0].with_material}`);
  
  // 显示几条样本数据
  const samples = await pool.query(`
    SELECT product_name, product_name_en, hs_code, material, min_declaration_value_range, ref_weight_range
    FROM hs_match_records 
    WHERE min_declaration_value_range IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('\n  📋 最新导入的样本数据:');
  samples.rows.forEach((r, i) => {
    console.log(`     ${i+1}. ${r.product_name} (${r.product_name_en})`);
    console.log(`        HS: ${r.hs_code}, 材质: ${r.material}, 价格: ${r.min_declaration_value_range}, 重量: ${r.ref_weight_range}`);
  });
  
  console.log('\n✅ 验证完成');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始导入 TARIC 模板数据到生产数据库...');
  console.log('=' .repeat(60));
  
  try {
    // 测试数据库连接
    const testResult = await pool.query('SELECT current_database() as db');
    console.log(`📡 连接到数据库: ${testResult.rows[0].db}`);
    
    // 步骤1: 修改表结构
    await alterTableStructure();
    
    // 步骤2: 读取 Excel 数据
    const data = readExcelData();
    
    // 步骤3: 导入到 hs_match_records
    await importToMatchRecords(data);
    
    // 步骤4: 更新 tariff_rates
    await updateTariffRates(data);
    
    // 步骤5: 验证结果
    await verifyImport();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 导入任务完成!');
    
  } catch (error) {
    console.error('\n❌ 导入过程发生错误:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();

