/**
 * 修复重复客户问题
 * 正确客户：傲翼-自主VAT（编码：CUSMJFKVCBZTRH）
 * 重复客户：傲以-自主VAT（编码：CUSMJJPLO66WE4）
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const CORRECT_CUSTOMER_CODE = 'CUSMJFKVCBZTRH'
const CORRECT_CUSTOMER_NAME = '傲翼-自主VAT'
const DUPLICATE_CUSTOMER_CODE = 'CUSMJJPLO66WE4'

// 需要更新的订单提单号
const ORDER_BILL_NUMBERS = ['010501331342', '010501321495', '010501318460', '149509272452']

async function main() {
  // 连接数据库
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
  if (!DATABASE_URL) {
    console.error('❌ 未配置数据库连接')
    process.exit(1)
  }

  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('🔧 开始修复重复客户问题')
    console.log('========================================\n')

    // 步骤1：查询两个客户的信息
    console.log('📋 步骤1：查询客户信息')
    const customers = await client.query(`
      SELECT id, customer_code, customer_name, company_name, customer_type, status, created_at
      FROM customers 
      WHERE customer_code IN ($1, $2)
    `, [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_CODE])
    
    console.log('客户列表:')
    customers.rows.forEach(c => {
      console.log(`  - ${c.customer_code}: ${c.customer_name} (${c.status})`)
    })

    if (customers.rows.length === 0) {
      console.log('⚠️ 未找到任何客户，请检查客户编码是否正确')
      return
    }

    // 步骤2：查询需要更新的订单
    console.log('\n📋 步骤2：查询订单当前状态')
    const orders = await client.query(`
      SELECT id, bill_number, container_number, customer_id, customer_name, shipper, order_seq
      FROM bills_of_lading
      WHERE bill_number = ANY($1)
    `, [ORDER_BILL_NUMBERS])
    
    console.log('订单列表:')
    orders.rows.forEach(o => {
      const orderNum = o.order_seq ? `BP${new Date().getFullYear().toString().slice(-2)}${String(o.order_seq).padStart(5, '0')}` : '未知'
      console.log(`  - ${orderNum} (${o.bill_number}): 客户=${o.customer_name}, customer_id=${o.customer_id}`)
    })

    // 步骤3：开始事务更新
    console.log('\n🔄 步骤3：更新订单客户信息')
    await client.query('BEGIN')

    const updateResult = await client.query(`
      UPDATE bills_of_lading
      SET customer_id = $1,
          customer_name = $2,
          shipper = $2,
          updated_at = NOW()
      WHERE bill_number = ANY($3)
        AND customer_id = $4
    `, [CORRECT_CUSTOMER_CODE, CORRECT_CUSTOMER_NAME, ORDER_BILL_NUMBERS, DUPLICATE_CUSTOMER_CODE])

    console.log(`✅ 更新了 ${updateResult.rowCount} 条订单`)

    // 步骤4：验证更新结果
    console.log('\n📋 步骤4：验证更新结果')
    const updatedOrders = await client.query(`
      SELECT id, bill_number, container_number, customer_id, customer_name, shipper
      FROM bills_of_lading
      WHERE bill_number = ANY($1)
    `, [ORDER_BILL_NUMBERS])
    
    updatedOrders.rows.forEach(o => {
      const status = o.customer_id === CORRECT_CUSTOMER_CODE ? '✅' : '❌'
      console.log(`  ${status} ${o.bill_number}: 客户=${o.customer_name}`)
    })

    // 步骤5：检查重复客户是否还有其他订单
    console.log('\n📋 步骤5：检查重复客户的其他关联订单')
    const remainingOrders = await client.query(`
      SELECT COUNT(*) as count
      FROM bills_of_lading
      WHERE customer_id = $1
    `, [DUPLICATE_CUSTOMER_CODE])
    
    const orderCount = parseInt(remainingOrders.rows[0].count)
    console.log(`  重复客户还有 ${orderCount} 条关联订单`)

    // 步骤6：检查关联数据
    console.log('\n📋 步骤6：检查关联数据')
    const relatedData = await client.query(`
      SELECT 'customer_contacts' as table_name, COUNT(*) as count FROM customer_contacts WHERE customer_id = $1
      UNION ALL
      SELECT 'customer_follow_ups' as table_name, COUNT(*) as count FROM customer_follow_ups WHERE customer_id = $1
      UNION ALL
      SELECT 'customer_addresses' as table_name, COUNT(*) as count FROM customer_addresses WHERE customer_id = $1
      UNION ALL
      SELECT 'customer_tax_numbers' as table_name, COUNT(*) as count FROM customer_tax_numbers WHERE customer_id = $1
    `, [DUPLICATE_CUSTOMER_CODE])
    
    let hasRelatedData = false
    relatedData.rows.forEach(r => {
      const count = parseInt(r.count)
      if (count > 0) {
        console.log(`  ⚠️ ${r.table_name}: ${count} 条`)
        hasRelatedData = true
      } else {
        console.log(`  ✅ ${r.table_name}: 0 条`)
      }
    })

    // 步骤7：删除重复客户
    if (orderCount === 0 && !hasRelatedData) {
      console.log('\n🗑️ 步骤7：删除重复客户')
      const deleteResult = await client.query(`
        DELETE FROM customers
        WHERE customer_code = $1
      `, [DUPLICATE_CUSTOMER_CODE])
      console.log(`✅ 删除了 ${deleteResult.rowCount} 个重复客户`)
    } else {
      console.log('\n⚠️ 步骤7：无法删除重复客户')
      console.log(`  原因：还有 ${orderCount} 条订单或其他关联数据`)
      
      // 如果还有关联数据，也一并迁移
      if (hasRelatedData) {
        console.log('  正在迁移关联数据...')
        
        // 迁移联系人
        await client.query(`UPDATE customer_contacts SET customer_id = $1 WHERE customer_id = $2`, 
          [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_CODE])
        
        // 迁移跟进记录
        await client.query(`UPDATE customer_follow_ups SET customer_id = $1, customer_name = $2 WHERE customer_id = $3`, 
          [CORRECT_CUSTOMER_CODE, CORRECT_CUSTOMER_NAME, DUPLICATE_CUSTOMER_CODE])
        
        // 迁移地址
        await client.query(`UPDATE customer_addresses SET customer_id = $1 WHERE customer_id = $2`, 
          [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_CODE])
        
        // 迁移税号
        await client.query(`UPDATE customer_tax_numbers SET customer_id = $1 WHERE customer_id = $2`, 
          [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_CODE])
        
        console.log('  ✅ 关联数据迁移完成')
      }

      // 如果还有剩余订单，也更新它们
      if (orderCount > 0) {
        console.log('  正在更新剩余订单...')
        const updateRemainingResult = await client.query(`
          UPDATE bills_of_lading
          SET customer_id = $1,
              customer_name = $2,
              shipper = $2,
              updated_at = NOW()
          WHERE customer_id = $3
        `, [CORRECT_CUSTOMER_CODE, CORRECT_CUSTOMER_NAME, DUPLICATE_CUSTOMER_CODE])
        console.log(`  ✅ 更新了 ${updateRemainingResult.rowCount} 条剩余订单`)
      }

      // 现在可以删除重复客户了
      const deleteResult = await client.query(`
        DELETE FROM customers
        WHERE customer_code = $1
      `, [DUPLICATE_CUSTOMER_CODE])
      console.log(`✅ 删除了 ${deleteResult.rowCount} 个重复客户`)
    }

    // 提交事务
    await client.query('COMMIT')
    console.log('\n✅ 事务已提交')

    // 步骤8：最终确认
    console.log('\n📋 步骤8：最终确认')
    const finalCheck = await client.query(`
      SELECT id, customer_code, customer_name, status
      FROM customers 
      WHERE customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%'
    `)
    
    console.log('剩余客户:')
    finalCheck.rows.forEach(c => {
      console.log(`  - ${c.customer_code}: ${c.customer_name}`)
    })

    console.log('\n========================================')
    console.log('🎉 修复完成！')
    console.log('========================================\n')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ 发生错误，已回滚:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

