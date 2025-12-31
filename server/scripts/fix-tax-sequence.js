/**
 * 修复 customer_tax_numbers 表的序列值
 */
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function fixSequence() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🔄 开始修复 customer_tax_numbers 序列...')
    
    // 查看当前最大 id
    const maxIdResult = await client.query('SELECT MAX(id) as max_id FROM customer_tax_numbers')
    console.log('  当前最大 ID:', maxIdResult.rows[0].max_id)
    
    // 查看当前序列值
    const currSeqResult = await client.query("SELECT currval('customer_tax_numbers_id_seq') as curr_val")
    console.log('  当前序列值:', currSeqResult.rows[0].curr_val)
  } catch (e) {
    console.log('  当前序列未被使用过')
  }
  
  try {
    // 重置序列到正确的值
    const result = await client.query(`
      SELECT setval('customer_tax_numbers_id_seq', 
        COALESCE((SELECT MAX(id) FROM customer_tax_numbers), 0) + 1, 
        false
      ) as new_val
    `)
    console.log('✅ 序列已重置为:', result.rows[0].new_val)
  } finally {
    client.release()
    await pool.end()
  }
}

fixSequence().catch(err => {
  console.error('❌ 修复失败:', err.message)
  process.exit(1)
})

