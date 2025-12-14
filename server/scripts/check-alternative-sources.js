/**
 * 检查替代数据源可用性脚本
 * 
 * 此脚本检查各种HS Code数据源的可用性和访问方式
 */

import https from 'https'
import http from 'http'

const dataSources = [
  {
    name: 'TARIC在线查询',
    url: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en',
    type: 'web',
    description: '欧盟官方TARIC在线查询页面',
  },
  {
    name: '欧盟数据门户',
    url: 'https://data.europa.eu/api/hub/search/search?q=TARIC',
    type: 'api',
    description: '欧盟官方数据门户，可能提供API',
  },
  {
    name: '荷兰统计局',
    url: 'https://www.cbs.nl/',
    type: 'web',
    description: '荷兰统计局网站',
  },
  {
    name: '德国联邦统计局',
    url: 'https://www.destatis.de/',
    type: 'web',
    description: '德国联邦统计局网站',
  },
  {
    name: 'UN Comtrade API',
    url: 'https://comtradeapi.un.org/',
    type: 'api',
    description: '联合国商品贸易统计API（需要注册）',
  },
]

function checkURL(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http
    
    const req = protocol.get(url, { timeout: 5000 }, (res) => {
      resolve({
        status: res.statusCode,
        accessible: res.statusCode >= 200 && res.statusCode < 400,
      })
    })

    req.on('error', () => {
      resolve({ status: 'error', accessible: false })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ status: 'timeout', accessible: false })
    })
  })
}

async function main() {
  console.log('🔍 检查HS Code数据源可用性\n')
  console.log('='.repeat(60))

  for (const source of dataSources) {
    console.log(`\n📡 检查: ${source.name}`)
    console.log(`   类型: ${source.type}`)
    console.log(`   描述: ${source.description}`)
    console.log(`   URL: ${source.url}`)

    const result = await checkURL(source.url)
    
    if (result.accessible) {
      console.log(`   ✅ 可访问 (状态码: ${result.status})`)
    } else {
      console.log(`   ❌ 不可访问 (${result.status})`)
    }

    // 等待一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 建议:')
  console.log('   1. 优先使用TARIC官方Excel文件（当前方案）')
  console.log('   2. 探索TARIC在线查询页面的自动化方案')
  console.log('   3. 研究各国统计局的API接口')
  console.log('   4. 考虑使用商业数据服务（如果需要）')
}

main().catch(console.error)

