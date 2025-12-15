/**
 * 生产环境添加用户脚本
 * 
 * 使用方法：
 * 1. 设置环境变量 DATABASE_URL 为生产数据库连接字符串
 * 2. 运行: node server/scripts/add-production-users.js
 */

import pg from 'pg'
import crypto from 'crypto'

// 生成密码哈希（与系统保持一致）
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
}

// 要添加的用户
const USERS = [
  {
    username: 'manager',
    name: '业务经理',
    email: 'manager@xianfenghk.com',
    phone: '13800138001',
    role: 'manager',
    password: 'manager123'
  },
  {
    username: 'operator1',
    name: '操作员1',
    email: 'op1@xianfenghk.com',
    phone: '13800138002',
    role: 'operator',
    password: 'operator123'
  },
  {
    username: 'operator2',
    name: '操作员2',
    email: 'op2@xianfenghk.com',
    phone: '13800138003',
    role: 'operator',
    password: 'operator123'
  },
  {
    username: 'viewer1',
    name: '查看者',
    email: 'viewer@xianfenghk.com',
    phone: '13800138004',
    role: 'viewer',
    password: 'viewer123'
  }
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('❌ 请设置 DATABASE_URL 环境变量')
    console.log('')
    console.log('示例:')
    console.log('  export DATABASE_URL="postgresql://用户名:密码@主机/数据库名"')
    process.exit(1)
  }
  
  console.log('═══════════════════════════════════════════════════════')
  console.log('           生产环境添加用户脚本                          ')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('📊 数据库:', databaseUrl.replace(/:[^:@]+@/, ':***@'))
  console.log('')
  
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    // 测试连接
    await pool.query('SELECT 1')
    console.log('✅ 数据库连接成功')
    console.log('')
    
    // 添加用户
    console.log('👤 开始添加用户...')
    console.log('')
    
    for (const user of USERS) {
      try {
        // 检查用户是否已存在
        const existing = await pool.query(
          'SELECT id FROM users WHERE username = $1',
          [user.username]
        )
        
        if (existing.rows.length > 0) {
          console.log(`   ⏭️  ${user.username} (${user.name}) - 已存在，跳过`)
          continue
        }
        
        // 插入新用户
        const passwordHash = hashPassword(user.password)
        const result = await pool.query(`
          INSERT INTO users (username, name, email, phone, role, password_hash, status, user_type, login_count, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'active', 'normal', 0, NOW(), NOW())
          RETURNING id
        `, [user.username, user.name, user.email, user.phone, user.role, passwordHash])
        
        console.log(`   ✅ ${user.username} (${user.name}) - 添加成功，ID: ${result.rows[0].id}`)
      } catch (err) {
        console.error(`   ❌ ${user.username} 添加失败:`, err.message)
      }
    }
    
    console.log('')
    
    // 显示当前所有用户
    console.log('📋 当前所有用户:')
    const allUsers = await pool.query(`
      SELECT id, username, name, role, status 
      FROM users 
      ORDER BY id
    `)
    
    console.log('')
    console.log('   ID    | 用户名      | 姓名       | 角色     | 状态')
    console.log('   ------|-------------|------------|----------|------')
    for (const u of allUsers.rows) {
      console.log(`   ${String(u.id).padEnd(5)} | ${u.username.padEnd(11)} | ${u.name.padEnd(10)} | ${u.role.padEnd(8)} | ${u.status}`)
    }
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════')
    console.log('✅ 完成！')
    console.log('')
    console.log('📋 账号密码:')
    console.log('   manager / manager123 (业务经理)')
    console.log('   operator1 / operator123 (操作员)')
    console.log('   operator2 / operator123 (操作员)')
    console.log('   viewer1 / viewer123 (查看者)')
    console.log('═══════════════════════════════════════════════════════')
    
  } catch (err) {
    console.error('❌ 执行失败:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()

