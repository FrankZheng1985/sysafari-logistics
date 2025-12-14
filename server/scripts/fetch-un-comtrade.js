/**
 * UN Comtrade API数据获取脚本
 * 
 * 从联合国商品贸易统计数据库获取HS Code数据
 * 
 * 注意：
 * 1. 需要注册UN Comtrade账户获取API密钥
 * 2. 可能需要付费订阅完整数据
 * 3. 数据主要用于贸易统计，可能不包含完整的编码描述
 * 
 * 使用方法:
 *   node scripts/fetch-un-comtrade.js
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// UN Comtrade API配置
// 需要从 https://unstats.un.org/wiki/display/comtrade/ 获取API密钥
const UN_COMTRADE_API_KEY = process.env.UN_COMTRADE_API_KEY || ''
const UN_COMTRADE_BASE_URL = 'https://comtradeapi.un.org/data/v1/get'

/**
 * 从UN Comtrade获取HS编码列表
 * @param {string} reporterCode - 报告国代码（如：276=德国, 250=法国, 528=荷兰）
 * @param {number} year - 年份
 * @param {string} classification - 分类系统（如：HS）
 */
async function fetchUNComtradeData(reporterCode = '276', year = 2023, classification = 'HS') {
  if (!UN_COMTRADE_API_KEY) {
    console.error('❌ 请设置UN_COMTRADE_API_KEY环境变量')
    console.log('\n获取API密钥:')
    console.log('  1. 访问 https://unstats.un.org/wiki/display/comtrade/')
    console.log('  2. 注册账户并申请API密钥')
    console.log('  3. 设置环境变量: export UN_COMTRADE_API_KEY=your_api_key')
    return null
  }

  try {
    // UN Comtrade API示例
    // 注意：实际API端点和参数可能需要调整
    const url = `${UN_COMTRADE_BASE_URL}/C/A/${classification}?reporterCode=${reporterCode}&period=${year}&cmdCode=AG2`
    
    console.log(`📡 请求UN Comtrade API: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${UN_COMTRADE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('❌ 获取UN Comtrade数据失败:', error.message)
    return null
  }
}

/**
 * 处理UN Comtrade数据并保存到数据库
 */
async function processUNComtradeData(data) {
  if (!data || !data.data) {
    console.error('❌ 数据格式不正确')
    return
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO hs_codes (
      hs_code, cn_code, description_en,
      chapter, heading, subheading,
      notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `)

  let count = 0
  for (const item of data.data) {
    try {
      const hsCode = item.cmdCode || item.commodityCode || ''
      if (!hsCode || hsCode.length < 6) continue

      // 格式化编码为10位
      const formattedCode = hsCode.padEnd(10, '0').substring(0, 10)

      insertStmt.run(
        formattedCode,
        formattedCode,
        item.cmdDescE || item.commodity || null,
        parseInt(formattedCode.substring(0, 2)) || null,
        parseInt(formattedCode.substring(2, 4)) || null,
        parseInt(formattedCode.substring(4, 6)) || null,
        '从UN Comtrade API导入',
        'active'
      )

      count++
    } catch (err) {
      console.error('处理数据项失败:', err.message)
    }
  }

  console.log(`✅ 成功导入 ${count} 条数据`)
}

async function main() {
  console.log('🚀 开始从UN Comtrade获取数据...')
  console.log('⚠️  注意：需要有效的API密钥\n')

  // 查询多个欧盟国家
  const countries = [
    { code: '276', name: '德国' },
    { code: '250', name: '法国' },
    { code: '528', name: '荷兰' },
    { code: '380', name: '意大利' },
  ]

  for (const country of countries) {
    console.log(`\n📊 查询 ${country.name} (${country.code}) 数据...`)
    const data = await fetchUNComtradeData(country.code, 2023)
    
    if (data) {
      await processUNComtradeData(data)
    }

    // 控制请求频率
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  db.close()
  console.log('\n✅ 完成！')
}

main().catch(console.error)

