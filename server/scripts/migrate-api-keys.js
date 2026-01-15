/**
 * 迁移脚本：创建 api_keys 表
 * 运行方式: NODE_ENV=production node scripts/migrate-api-keys.js
 */

import { getDatabase, closeDatabase } from '../config/database.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function migrate() {
  const db = getDatabase()
  
  try {
    console.log('📦 开始执行 api_keys 表迁移...')
    
    // 创建 api_keys 表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          key_value VARCHAR(200),
          key_hash VARCHAR(64) NOT NULL UNIQUE,
          client_id VARCHAR(100),
          user_id INTEGER,
          permissions JSONB DEFAULT '["read"]',
          rate_limit INTEGER DEFAULT 1000,
          expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          revoked_at TIMESTAMP,
          last_used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('✅ api_keys 表创建成功')
    
    // 创建索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active)`)
    console.log('✅ 索引创建成功')
    
    // 创建 api_call_logs 表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS api_call_logs (
          id SERIAL PRIMARY KEY,
          api_key_id INTEGER REFERENCES api_keys(id),
          endpoint VARCHAR(200),
          method VARCHAR(10),
          ip_address VARCHAR(50),
          user_agent TEXT,
          request_body JSONB,
          response_code INTEGER,
          response_time_ms INTEGER,
          called_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('✅ api_call_logs 表创建成功')
    
    // 创建索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_call_logs_key_id ON api_call_logs(api_key_id)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_call_logs_called_at ON api_call_logs(called_at)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_call_logs_endpoint ON api_call_logs(endpoint)`)
    console.log('✅ 日志表索引创建成功')
    
    console.log('\n🎉 迁移完成！')
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    closeDatabase()
  }
}

migrate().then(() => {
  process.exit(0)
}).catch(err => {
  console.error('执行失败:', err)
  process.exit(1)
})
