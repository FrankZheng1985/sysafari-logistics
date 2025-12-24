/**
 * 同步序列号表
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL_PROD
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('🔧 同步序列号表')
    console.log('========================================\n')

    // 获取当前最大序号
    const maxSeq = await client.query(`SELECT MAX(order_seq) as max_seq FROM bills_of_lading`)
    const currentMax = parseInt(maxSeq.rows[0].max_seq)
    
    // 获取当前序列号
    const seqStatus = await client.query(`SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'`)
    const currentSeq = parseInt(seqStatus.rows[0].current_seq)
    
    console.log(`当前序列号: ${currentSeq}`)
    console.log(`数据库最大: ${currentMax}`)

    if (currentSeq < currentMax) {
      // 更新序列号
      await client.query(`
        UPDATE order_sequences 
        SET current_seq = $1, updated_at = NOW() 
        WHERE business_type = 'BILL'
      `, [currentMax])
      
      console.log(`\n✅ 序列号已同步: ${currentSeq} → ${currentMax}`)
    } else {
      console.log('\n✅ 序列号已经是最新')
    }

    // 验证
    const verify = await client.query(`SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'`)
    console.log(`\n验证: current_seq = ${verify.rows[0].current_seq}`)

    console.log('\n========================================')
    console.log('🎉 完成')
    console.log('========================================\n')

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

