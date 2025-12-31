/**
 * 执行修复重复客户（生产数据库）
 * 已获得用户授权
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const CORRECT_CUSTOMER_CODE = 'CUSMJFKVCBZTRH'
const CORRECT_CUSTOMER_NAME = '傲翼-自主VAT'
const DUPLICATE_CUSTOMER_ID = '46fdd706-ea60-46c0-89a3-84ef46e57f0a'
const DUPLICATE_CUSTOMER_CODE = 'CUSMJJPLO66WE4'

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL_PROD
  if (!DATABASE_URL) {
    console.error('❌ 未配置生产数据库连接')
    process.exit(1)
  }

  console.log('🔗 连接到生产数据库...')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('🔧 执行修复重复客户问题')
    console.log('========================================\n')

    // 开始事务
    await client.query('BEGIN')
    console.log('📦 事务已开始')

    // 步骤1：更新订单客户信息
    console.log('\n🔄 步骤1：更新订单客户信息...')
    const updateResult = await client.query(`
      UPDATE bills_of_lading
      SET customer_id = $1,
          customer_name = $2,
          shipper = $2,
          updated_at = NOW()
      WHERE customer_id = $3
    `, [CORRECT_CUSTOMER_CODE, CORRECT_CUSTOMER_NAME, DUPLICATE_CUSTOMER_ID])

    console.log(`✅ 更新了 ${updateResult.rowCount} 条订单`)

    // 步骤2：检查是否有关联的联系人、跟进记录等
    console.log('\n🔍 步骤2：检查并迁移关联数据...')
    
    // 迁移联系人
    const contactsResult = await client.query(`
      UPDATE customer_contacts SET customer_id = $1 WHERE customer_id = $2
    `, [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_ID])
    if (contactsResult.rowCount > 0) {
      console.log(`  - 迁移了 ${contactsResult.rowCount} 条联系人`)
    }

    // 迁移跟进记录
    const followUpsResult = await client.query(`
      UPDATE customer_follow_ups SET customer_id = $1, customer_name = $2 WHERE customer_id = $3
    `, [CORRECT_CUSTOMER_CODE, CORRECT_CUSTOMER_NAME, DUPLICATE_CUSTOMER_ID])
    if (followUpsResult.rowCount > 0) {
      console.log(`  - 迁移了 ${followUpsResult.rowCount} 条跟进记录`)
    }

    // 迁移地址
    const addressResult = await client.query(`
      UPDATE customer_addresses SET customer_id = $1 WHERE customer_id = $2
    `, [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_ID])
    if (addressResult.rowCount > 0) {
      console.log(`  - 迁移了 ${addressResult.rowCount} 条地址`)
    }

    // 迁移税号
    const taxResult = await client.query(`
      UPDATE customer_tax_numbers SET customer_id = $1 WHERE customer_id = $2
    `, [CORRECT_CUSTOMER_CODE, DUPLICATE_CUSTOMER_ID])
    if (taxResult.rowCount > 0) {
      console.log(`  - 迁移了 ${taxResult.rowCount} 条税号`)
    }

    // 步骤3：删除重复客户
    console.log('\n🗑️ 步骤3：删除重复客户...')
    const deleteResult = await client.query(`
      DELETE FROM customers WHERE customer_code = $1
    `, [DUPLICATE_CUSTOMER_CODE])
    
    console.log(`✅ 删除了 ${deleteResult.rowCount} 个重复客户`)

    // 提交事务
    await client.query('COMMIT')
    console.log('\n✅ 事务已提交')

    // 验证结果
    console.log('\n📋 验证结果:')
    
    // 检查订单
    const verifyOrders = await client.query(`
      SELECT bill_number, customer_name, customer_id
      FROM bills_of_lading
      WHERE bill_number IN ('010501331342', '010501321495', '010501318460', '149509272452')
    `)
    
    console.log('\n更新后的订单:')
    verifyOrders.rows.forEach(o => {
      const status = o.customer_id === CORRECT_CUSTOMER_CODE ? '✅' : '❌'
      console.log(`  ${status} ${o.bill_number}: ${o.customer_name}`)
    })

    // 检查客户
    const verifyCustomers = await client.query(`
      SELECT customer_code, customer_name
      FROM customers 
      WHERE customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%'
    `)
    
    console.log('\n剩余客户:')
    verifyCustomers.rows.forEach(c => {
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

