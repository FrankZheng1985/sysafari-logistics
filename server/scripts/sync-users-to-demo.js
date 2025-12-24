/**
 * 同步生产环境的用户和角色权限到演示环境
 * 
 * 功能：
 * 1. 同步 roles 表（角色定义）
 * 2. 同步 role_permissions 表（角色权限）
 * 3. 同步 users 表（用户数据）
 * 
 * 使用方法：
 * export PROD_DATABASE_URL="生产数据库URL"
 * export DEMO_DATABASE_URL="演示数据库URL"
 * node server/scripts/sync-users-to-demo.js
 * 
 * 或者直接使用硬编码的URL运行（已配置默认值）
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接配置（优先使用环境变量，否则使用默认值）
const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL_PROD || 
  'postgresql://logistics_production_db_iv4r_user:0DcEcyjLIABWFuGNroV2mfFvLCyXP5NB@dpg-d4vmk8pr0fns739omrrg-a.virginia-postgres.render.com/logistics_production_db_iv4r?sslmode=require'
const DEMO_URL = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL_TEST ||
  'postgresql://logistics_quotation_db_user:KEE4NdbTz4xrDKNjEnO8oOHhnkSKAeym@dpg-d4t44e56ubrc73ectgq0-a.virginia-postgres.render.com/logistics_quotation_db?sslmode=require'

// 检查数据库连接配置
if (!PROD_URL) {
  console.error('❌ 错误: 未配置生产数据库连接')
  console.error('   请设置 PROD_DATABASE_URL 或 DATABASE_URL_PROD 环境变量')
  process.exit(1)
}

if (!DEMO_URL) {
  console.error('❌ 错误: 未配置演示数据库连接')
  console.error('   请设置 DEMO_DATABASE_URL 或 DATABASE_URL_TEST 环境变量')
  console.error('')
  console.error('   提示: 可以从 Render Dashboard 获取演示数据库的 External URL')
  console.error('   https://dashboard.render.com/d/dpg-d4t44e56ubrc73ectgq0-a')
  process.exit(1)
}

// 创建连接池
function createPool(connectionString) {
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  return new pg.Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 5
  })
}

// 获取表数据
async function getTableData(pool, sql) {
  const result = await pool.query(sql)
  return result.rows
}

// 主函数
async function main() {
  console.log('🚀 开始同步生产环境用户和权限到演示环境...\n')
  
  const prodPool = createPool(PROD_URL)
  const demoPool = createPool(DEMO_URL)
  
  try {
    // 测试连接
    console.log('📡 测试数据库连接...')
    const prodTest = await prodPool.query('SELECT current_database() as db')
    console.log(`   ✅ 生产数据库: ${prodTest.rows[0].db}`)
    
    const demoTest = await demoPool.query('SELECT current_database() as db')
    console.log(`   ✅ 演示数据库: ${demoTest.rows[0].db}`)
    console.log('')
    
    // ==================== 1. 同步角色表 ====================
    console.log('📋 同步角色表 (roles)...')
    
    // 获取生产环境角色
    const prodRoles = await getTableData(prodPool, 'SELECT * FROM roles ORDER BY id')
    console.log(`   生产环境角色数: ${prodRoles.length}`)
    
    // 清空演示环境角色（需要先清理依赖）
    console.log('   清空演示环境角色权限关联...')
    await demoPool.query('DELETE FROM role_permissions')
    
    // 获取演示环境现有角色用于判断是更新还是插入
    const demoRoles = await getTableData(demoPool, 'SELECT role_code FROM roles')
    const demoRoleCodes = new Set(demoRoles.map(r => r.role_code))
    
    let insertedRoles = 0
    let updatedRoles = 0
    
    for (const role of prodRoles) {
      if (demoRoleCodes.has(role.role_code)) {
        // 更新现有角色
        await demoPool.query(`
          UPDATE roles SET 
            role_name = $1,
            description = $2,
            is_system = $3,
            status = $4,
            color_code = $5,
            role_level = $6,
            can_manage_team = $7,
            can_approve = $8,
            updated_at = NOW()
          WHERE role_code = $9
        `, [
          role.role_name,
          role.description,
          role.is_system,
          role.status,
          role.color_code,
          role.role_level,
          role.can_manage_team,
          role.can_approve,
          role.role_code
        ])
        updatedRoles++
      } else {
        // 插入新角色
        await demoPool.query(`
          INSERT INTO roles (role_code, role_name, description, is_system, status, color_code, role_level, can_manage_team, can_approve, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
          role.role_code,
          role.role_name,
          role.description,
          role.is_system,
          role.status,
          role.color_code,
          role.role_level,
          role.can_manage_team,
          role.can_approve
        ])
        insertedRoles++
      }
    }
    
    console.log(`   ✅ 角色同步完成: 新增 ${insertedRoles} 个, 更新 ${updatedRoles} 个`)
    console.log('')
    
    // ==================== 2. 同步权限表 ====================
    console.log('📋 同步权限表 (permissions)...')
    
    // 获取生产环境权限
    const prodPermissions = await getTableData(prodPool, 'SELECT * FROM permissions ORDER BY id')
    console.log(`   生产环境权限数: ${prodPermissions.length}`)
    
    // 清空并重新插入
    await demoPool.query('DELETE FROM permissions')
    
    let insertedPermissions = 0
    for (const perm of prodPermissions) {
      try {
        await demoPool.query(`
          INSERT INTO permissions (permission_code, permission_name, module, description, sort_order, category, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          perm.permission_code,
          perm.permission_name,
          perm.module,
          perm.description,
          perm.sort_order || 0,
          perm.category || ''
        ])
        insertedPermissions++
      } catch (err) {
        // 如果列不存在，使用简单版本
        if (err.message.includes('category')) {
          await demoPool.query(`
            INSERT INTO permissions (permission_code, permission_name, module, description, sort_order, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            perm.permission_code,
            perm.permission_name,
            perm.module,
            perm.description,
            perm.sort_order || 0
          ])
          insertedPermissions++
        } else {
          console.log(`   ⚠️ 插入权限失败: ${perm.permission_code} - ${err.message}`)
        }
      }
    }
    
    console.log(`   ✅ 权限同步完成: ${insertedPermissions} 条`)
    console.log('')
    
    // ==================== 3. 同步角色权限关联表 ====================
    console.log('📋 同步角色权限关联表 (role_permissions)...')
    
    // 获取生产环境角色权限
    const prodRolePerms = await getTableData(prodPool, 'SELECT * FROM role_permissions ORDER BY id')
    console.log(`   生产环境角色权限数: ${prodRolePerms.length}`)
    
    let insertedRolePerms = 0
    for (const rp of prodRolePerms) {
      try {
        await demoPool.query(`
          INSERT INTO role_permissions (role_code, permission_code, created_at)
          VALUES ($1, $2, NOW())
        `, [rp.role_code, rp.permission_code])
        insertedRolePerms++
      } catch (err) {
        if (!err.message.includes('duplicate')) {
          console.log(`   ⚠️ 插入角色权限失败: ${rp.role_code}/${rp.permission_code}`)
        }
      }
    }
    
    console.log(`   ✅ 角色权限同步完成: ${insertedRolePerms} 条`)
    console.log('')
    
    // ==================== 4. 同步用户表 ====================
    console.log('📋 同步用户表 (users)...')
    
    // 获取生产环境用户
    const prodUsers = await getTableData(prodPool, 'SELECT * FROM users ORDER BY id')
    console.log(`   生产环境用户数: ${prodUsers.length}`)
    
    // 获取演示环境现有用户
    const demoUsers = await getTableData(demoPool, 'SELECT username FROM users')
    const demoUsernames = new Set(demoUsers.map(u => u.username))
    
    let insertedUsers = 0
    let updatedUsers = 0
    
    for (const user of prodUsers) {
      if (demoUsernames.has(user.username)) {
        // 更新现有用户
        await demoPool.query(`
          UPDATE users SET 
            name = $1,
            email = $2,
            phone = $3,
            avatar = $4,
            role = $5,
            status = $6,
            department = $7,
            position = $8,
            supervisor_id = $9,
            updated_at = NOW()
          WHERE username = $10
        `, [
          user.name,
          user.email,
          user.phone,
          user.avatar,
          user.role,
          user.status,
          user.department || '',
          user.position || '',
          user.supervisor_id,
          user.username
        ])
        updatedUsers++
      } else {
        // 插入新用户
        try {
          await demoPool.query(`
            INSERT INTO users (username, password_hash, name, email, phone, avatar, role, status, department, position, supervisor_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
            user.username,
            user.password_hash,
            user.name,
            user.email,
            user.phone,
            user.avatar,
            user.role,
            user.status,
            user.department || '',
            user.position || '',
            user.supervisor_id
          ])
          insertedUsers++
        } catch (err) {
          console.log(`   ⚠️ 插入用户失败: ${user.username} - ${err.message.substring(0, 50)}`)
        }
      }
    }
    
    console.log(`   ✅ 用户同步完成: 新增 ${insertedUsers} 个, 更新 ${updatedUsers} 个`)
    console.log('')
    
    // ==================== 5. 重置序列 ====================
    console.log('🔄 重置自增序列...')
    
    const tables = ['roles', 'permissions', 'role_permissions', 'users']
    for (const table of tables) {
      try {
        await demoPool.query(`
          SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1))
        `)
        console.log(`   ✅ ${table}_id_seq`)
      } catch (err) {
        // 忽略序列不存在的错误
      }
    }
    
    // ==================== 完成 ====================
    console.log('\n' + '='.repeat(50))
    console.log('✅ 同步完成！')
    console.log('='.repeat(50))
    console.log('\n📊 同步结果汇总:')
    console.log(`   - 角色: 新增 ${insertedRoles}, 更新 ${updatedRoles}`)
    console.log(`   - 权限: ${insertedPermissions} 条`)
    console.log(`   - 角色权限: ${insertedRolePerms} 条`)
    console.log(`   - 用户: 新增 ${insertedUsers}, 更新 ${updatedUsers}`)
    
  } catch (err) {
    console.error('\n❌ 同步失败:', err.message)
    console.error(err.stack)
    throw err
  } finally {
    await prodPool.end()
    await demoPool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

