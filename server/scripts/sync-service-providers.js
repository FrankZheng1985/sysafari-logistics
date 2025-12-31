/**
 * 同步 service_providers 数据到生产环境
 * 
 * 使用方法:
 * DATABASE_URL="生产环境连接字符串" node server/scripts/sync-service-providers.js
 */

import pg from 'pg'

const { Pool } = pg

// 演示环境的 service_providers 数据
const serviceProviders = [
  {
    id: 1,
    provider_code: 'SP001',
    provider_name: '德邦物流',
    service_type: 'delivery',
    contact_person: '张经理',
    contact_phone: '13800138001',
    status: 'active'
  },
  {
    id: 2,
    provider_code: 'SP002',
    provider_name: '顺丰速运',
    service_type: 'delivery',
    contact_person: '李经理',
    contact_phone: '13800138002',
    status: 'active'
  },
  {
    id: 3,
    provider_code: 'SP003',
    provider_name: '中通快递',
    service_type: 'delivery',
    contact_person: '王经理',
    contact_phone: '13800138003',
    status: 'active'
  },
  {
    id: 4,
    provider_code: 'SP004',
    provider_name: '京东物流',
    service_type: 'delivery',
    contact_person: '陈总',
    contact_phone: '950616',
    contact_email: 'service@jd.com',
    address: '北京市大兴区',
    description: '智能供应链解决方案',
    status: 'active'
  },
  {
    id: 5,
    provider_code: 'SP005',
    provider_name: '马士基航运',
    service_type: 'shipping',
    contact_person: '刘经理',
    contact_phone: '010-65052266',
    contact_email: 'china@maersk.com',
    address: '上海市浦东新区',
    description: '全球领先的集装箱航运公司',
    status: 'active'
  },
  {
    id: 6,
    provider_code: 'SP006',
    provider_name: '中远海运',
    service_type: 'shipping',
    contact_person: '赵主管',
    contact_phone: '021-65966666',
    contact_email: 'service@cosco.com',
    address: '上海市浦东新区',
    description: '中国最大的航运集团',
    status: 'active'
  },
  {
    id: 7,
    provider_code: 'SP007',
    provider_name: '长荣海运',
    service_type: 'shipping',
    contact_person: '周经理',
    contact_phone: '021-63539999',
    contact_email: 'service@evergreen.com',
    address: '上海市虹口区',
    description: '台湾领先的集装箱运输公司',
    status: 'active'
  },
  {
    id: 8,
    provider_code: 'SP008',
    provider_name: '中外运报关',
    service_type: 'customs',
    contact_person: '孙经理',
    contact_phone: '010-84005566',
    contact_email: 'customs@sinotrans.com',
    address: '北京市朝阳区',
    description: '专业报关报检服务',
    status: 'active'
  },
  {
    id: 9,
    provider_code: 'SP009',
    provider_name: '华贸报关行',
    service_type: 'customs',
    contact_person: '钱主管',
    contact_phone: '021-68880000',
    contact_email: 'service@huamao.com',
    address: '上海市外高桥',
    description: '保税区进出口报关专家',
    status: 'active'
  },
  {
    id: 10,
    provider_code: 'SP010',
    provider_name: '港中旅仓储',
    service_type: 'warehouse',
    contact_person: '吴经理',
    contact_phone: '0755-26001234',
    contact_email: 'warehouse@hkctstravel.com',
    address: '深圳市盐田港',
    description: '保税仓储及配送服务',
    status: 'active'
  }
]

async function syncServiceProviders() {
  const DATABASE_URL = process.env.DATABASE_URL
  
  if (!DATABASE_URL) {
    console.error('❌ 请设置 DATABASE_URL 环境变量')
    console.error('   示例: DATABASE_URL="postgresql://..." node server/scripts/sync-service-providers.js')
    process.exit(1)
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    console.log('🔄 开始同步 service_providers 数据...')
    
    // 检查当前数据量
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM service_providers')
    console.log(`   同步前数量: ${beforeCount.rows[0].count}`)
    
    // 插入数据
    for (const provider of serviceProviders) {
      await pool.query(`
        INSERT INTO service_providers (
          id, provider_code, provider_name, service_type, 
          contact_person, contact_phone, contact_email, address, description, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          provider_code = EXCLUDED.provider_code,
          provider_name = EXCLUDED.provider_name,
          service_type = EXCLUDED.service_type,
          contact_person = EXCLUDED.contact_person,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [
        provider.id,
        provider.provider_code,
        provider.provider_name,
        provider.service_type,
        provider.contact_person,
        provider.contact_phone,
        provider.contact_email || null,
        provider.address || null,
        provider.description || null,
        provider.status
      ])
      console.log(`   ✅ ${provider.provider_name}`)
    }
    
    // 更新序列
    await pool.query(`SELECT setval('service_providers_id_seq', (SELECT MAX(id) FROM service_providers))`)
    
    // 检查同步后数据量
    const afterCount = await pool.query('SELECT COUNT(*) as count FROM service_providers')
    console.log(`   同步后数量: ${afterCount.rows[0].count}`)
    
    console.log('✅ service_providers 数据同步完成！')
    
  } catch (error) {
    console.error('❌ 同步失败:', error.message)
  } finally {
    await pool.end()
  }
}

syncServiceProviders()
