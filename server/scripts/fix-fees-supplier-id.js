/**
 * 修复 fees 表中旧格式的 supplierId（数字）为新格式（UUID）
 * 执行方法: node server/scripts/fix-fees-supplier-id.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

// 使用本地开发数据库
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_LOCAL;
const pool = new Pool({
  connectionString: DATABASE_URL
});

async function fixSupplierIds() {
  const client = await pool.connect();
  try {
    console.log('🔄 开始修复 fees 表中的 supplierId...\n');

    // 1. 先创建"客户自主VAT"供应商（如果不存在）
    const checkResult = await client.query(
      "SELECT id FROM suppliers WHERE supplier_name = '客户自主VAT'"
    );
    
    let vatSupplierId;
    if (checkResult.rows.length === 0) {
      // 创建新供应商
      const insertResult = await client.query(`
        INSERT INTO suppliers (
          id, supplier_code, supplier_name, short_name, supplier_type, status, currency
        ) VALUES (
          gen_random_uuid(), 'OT-KHZZVAT', '客户自主VAT', '客户自主VAT', 'other', 'active', 'EUR'
        ) RETURNING id
      `);
      vatSupplierId = insertResult.rows[0].id;
      console.log('✅ 创建供应商"客户自主VAT"成功, ID:', vatSupplierId);
    } else {
      vatSupplierId = checkResult.rows[0].id;
      console.log('ℹ️ 供应商"客户自主VAT"已存在, ID:', vatSupplierId);
    }

    // 2. 定义映射关系：旧数字 ID -> 新 UUID
    const mappings = [
      { oldId: '11', name: '傲翼', newId: 'b6df2455-3281-4404-8b1b-c8e72d18af68' },
      { oldId: '12', name: 'ASL', newId: 'cf58ee15-fb0e-4409-8923-0fb5ad820a00' },
      { oldId: '14', name: '安百', newId: '205b8444-c9fa-4069-99cd-13b11462228b' },
      { oldId: '15', name: 'Feldsberg-澳门', newId: '3f4bac51-66b0-4979-90f3-2a363f43a1d6' },
      { oldId: '16', name: 'VIT Logistics', newId: 'c6361b4f-9097-43eb-86c2-ccafc087e2ea' },
      { oldId: '17', name: 'DWGK-澳门', newId: '2b56b985-c2fc-492b-a10f-098c2f9182c3' },
      { oldId: '18', name: 'Kiwistav-澳门', newId: 'c6f0351c-1210-4ebc-a562-3b10efed9606' },
      { oldId: '19', name: '客户自主VAT', newId: vatSupplierId },
      { oldId: '20', name: 'DBWIH-澳门', newId: '4925262d-bc0b-4c93-95cd-a18c876b3cb6' },
    ];

    // 3. 执行更新
    console.log('\n📝 执行 supplierId 更新:');
    let totalUpdated = 0;
    for (const map of mappings) {
      const result = await client.query(
        'UPDATE fees SET supplier_id = $1 WHERE supplier_id = $2',
        [map.newId, map.oldId]
      );
      if (result.rowCount > 0) {
        console.log(`  ✅ ${map.name} (${map.oldId} -> ${map.newId}): ${result.rowCount} 条记录`);
        totalUpdated += result.rowCount;
      }
    }

    if (totalUpdated === 0) {
      console.log('  ℹ️ 没有需要更新的记录（可能已经更新过）');
    }

    // 4. 验证结果
    const verifyResult = await client.query(`
      SELECT supplier_id, supplier_name, COUNT(*) as count 
      FROM fees 
      WHERE supplier_id IS NOT NULL AND supplier_id != ''
      GROUP BY supplier_id, supplier_name
      ORDER BY count DESC
      LIMIT 15
    `);
    
    console.log('\n📊 更新后的 supplierId 分布:');
    for (const row of verifyResult.rows) {
      const isUuid = row.supplier_id && row.supplier_id.includes('-');
      const status = isUuid ? '✅' : '⚠️';
      console.log(`  ${status} ${row.supplier_name || '(无名称)'}: ${row.supplier_id} (${row.count}条)`);
    }

    console.log('\n✅ 迁移完成! 共更新', totalUpdated, '条记录');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSupplierIds();

