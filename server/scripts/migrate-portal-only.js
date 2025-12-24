/**
 * 客户门户系统表单独迁移脚本
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function migratePortalTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🔄 开始客户门户表迁移...')
    
    // 1. 客户门户账户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(50),
        avatar_url TEXT,
        status VARCHAR(20) DEFAULT 'active',
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        last_login_ip VARCHAR(50),
        password_changed_at TIMESTAMP,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer ON customer_accounts(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_username ON customer_accounts(username)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(status)`)
    console.log('  ✅ customer_accounts 表就绪')

    // 2. API 密钥表
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_api_keys (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
        key_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        api_secret_hash VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '["order:read"]',
        ip_whitelist TEXT[],
        rate_limit INT DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        last_used_ip VARCHAR(50),
        usage_count BIGINT DEFAULT 0,
        expires_at TIMESTAMP,
        webhook_url TEXT,
        webhook_secret VARCHAR(64),
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON customer_api_keys(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON customer_api_keys(api_key)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_active ON customer_api_keys(is_active)`)
    console.log('  ✅ customer_api_keys 表就绪')

    // 3. API 调用日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_call_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
        customer_id VARCHAR(50),
        api_key VARCHAR(64),
        endpoint VARCHAR(200) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request_ip VARCHAR(50),
        request_headers JSONB,
        request_body JSONB,
        response_status INT,
        response_body JSONB,
        error_message TEXT,
        duration_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_call_logs(api_key_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_customer ON api_call_logs(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_call_logs(created_at DESC)`)
    console.log('  ✅ api_call_logs 表就绪')

    // 4. Webhook 发送记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
        customer_id VARCHAR(50),
        webhook_url TEXT NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        response_status INT,
        response_body TEXT,
        retry_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_customer ON webhook_logs(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status)`)
    console.log('  ✅ webhook_logs 表就绪')

    // 5. 为 bills_of_lading 添加外部订单号和来源渠道字段
    const billExtraColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'bills_of_lading' AND column_name IN ('external_order_no', 'source_channel')
    `)
    const existingBillExtraCols = billExtraColumns.rows.map(r => r.column_name)
    
    if (!existingBillExtraCols.includes('external_order_no')) {
      await client.query(`ALTER TABLE bills_of_lading ADD COLUMN external_order_no VARCHAR(100)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_external_order ON bills_of_lading(external_order_no)`)
      console.log('  ✅ bills_of_lading.external_order_no 字段已添加')
    }
    if (!existingBillExtraCols.includes('source_channel')) {
      await client.query(`ALTER TABLE bills_of_lading ADD COLUMN source_channel VARCHAR(50) DEFAULT \'manual\'`)
      console.log('  ✅ bills_of_lading.source_channel 字段已添加')
    }

    console.log('✅ 客户门户表迁移完成！')
    return true
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migratePortalTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

