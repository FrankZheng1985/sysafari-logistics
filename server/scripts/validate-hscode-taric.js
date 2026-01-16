/**
 * HS Code TARIC 有效性验证脚本
 * 验证数据库中的 HS Code 是否在欧盟 TARIC 系统中真实有效
 * 
 * 用法: node scripts/validate-hscode-taric.js [--limit=100] [--save]
 * 
 * 参数:
 *   --limit=N    限制验证数量（默认验证所有）
 *   --save       保存验证结果到数据库
 *   --country=CN 仅验证特定原产国的编码
 *   --chapter=84 仅验证特定章节的编码
 */

import pg from 'pg'
import https from 'https'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 阿里云 RDS 生产数据库连接信息
const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

// UK Trade Tariff API (XI - 北爱尔兰，使用 EU TARIC 规则)
const XI_API_BASE = 'https://www.trade-tariff.service.gov.uk/xi/api/v2'

// 解析命令行参数
const args = process.argv.slice(2)
const options = {
  limit: null,
  save: false,
  country: null,
  chapter: null
}

for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1])
  } else if (arg === '--save') {
    options.save = true
  } else if (arg.startsWith('--country=')) {
    options.country = arg.split('=')[1]
  } else if (arg.startsWith('--chapter=')) {
    options.chapter = arg.split('=')[1]
  }
}

console.log('🔗 连接到阿里云 RDS PostgreSQL...')

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})

// 请求延迟，避免 API 限流
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// HTTP GET 请求
function httpGetJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timeout'))
    }, timeout)
    
    https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sysafari-Logistics-Validator/1.0'
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        clearTimeout(timer)
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error('Invalid JSON response'))
          }
        } else if (res.statusCode === 404) {
          resolve(null) // 编码不存在
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      })
    }).on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/**
 * 验证单个 HS Code
 */
async function validateHsCode(hsCode) {
  const normalizedCode = hsCode.replace(/\D/g, '')
  const codeLength = normalizedCode.length
  
  const result = {
    hsCode: hsCode,
    normalizedCode,
    isValid: false,
    isDeclarable: false,
    isParentCode: false,  // 是否是父级编码（存在但不可申报）
    level: null,
    description: null,
    childCodes: [],       // 如果是父级编码，列出可申报的子编码
    error: null
  }
  
  if (codeLength < 4) {
    result.error = '编码长度不足'
    return result
  }
  
  try {
    // 首先尝试直接查询 commodity
    const searchCode = normalizedCode.padEnd(10, '0')
    let url = `${XI_API_BASE}/commodities/${searchCode}`
    result.level = codeLength <= 6 ? 'subheading' : (codeLength <= 8 ? 'cn' : 'taric')
    
    let data = await httpGetJson(url)
    
    if (data && data.data) {
      result.isValid = true
      result.description = data.data.attributes?.description || 
                          data.data.attributes?.formatted_description ||
                          data.data.attributes?.goods_nomenclature_item_id
      
      // 检查是否可申报
      if (data.data.attributes?.declarable !== undefined) {
        result.isDeclarable = data.data.attributes.declarable
        if (!result.isDeclarable) {
          result.isParentCode = true
        }
      }
    } else {
      // 如果直接查询失败，尝试查询 heading 级别，看编码是否存在于子编码中
      const headingCode = normalizedCode.substring(0, 4)
      url = `${XI_API_BASE}/headings/${headingCode}`
      data = await httpGetJson(url)
      
      if (data && data.included) {
        // 在 heading 的子编码中查找
        const commodities = data.included.filter(i => i.type === 'commodity')
        const targetCode = normalizedCode.padEnd(10, '0')
        
        // 精确匹配
        const exactMatch = commodities.find(c => 
          c.attributes?.goods_nomenclature_item_id === targetCode
        )
        
        if (exactMatch) {
          result.isValid = true
          result.description = exactMatch.attributes?.description
          result.isDeclarable = exactMatch.attributes?.declarable === true
          if (!result.isDeclarable) {
            result.isParentCode = true
            // 找出此父级编码下的可申报子编码
            const childCodes = commodities.filter(c => {
              const codeId = c.attributes?.goods_nomenclature_item_id || ''
              return codeId.startsWith(normalizedCode) && 
                     codeId !== targetCode && 
                     c.attributes?.declarable === true
            })
            result.childCodes = childCodes.slice(0, 5).map(c => ({
              code: c.attributes?.goods_nomenclature_item_id,
              description: c.attributes?.description
            }))
          }
        } else {
          // 检查是否有以此编码开头的子编码
          const prefixMatches = commodities.filter(c => 
            c.attributes?.goods_nomenclature_item_id?.startsWith(normalizedCode.substring(0, 8))
          )
          
          if (prefixMatches.length > 0) {
            result.isValid = true
            result.isParentCode = true
            result.isDeclarable = false
            result.description = '父级编码，存在可申报的子编码'
            result.childCodes = prefixMatches
              .filter(c => c.attributes?.declarable === true)
              .slice(0, 5)
              .map(c => ({
                code: c.attributes?.goods_nomenclature_item_id,
                description: c.attributes?.description
              }))
          } else {
            result.error = 'TARIC 系统中未找到此编码'
          }
        }
      } else {
        result.error = 'TARIC 系统中未找到此编码'
      }
    }
  } catch (err) {
    result.error = err.message
  }
  
  return result
}

async function main() {
  console.log('=' .repeat(70))
  console.log('🔍 HS Code TARIC 有效性验证')
  console.log('=' .repeat(70))
  console.log('')
  
  try {
    // 构建查询条件
    let whereClause = 'WHERE is_active = 1'
    const params = []
    let paramIndex = 1
    
    if (options.country) {
      whereClause += ` AND (origin_country_code = $${paramIndex} OR origin_country ILIKE $${paramIndex + 1})`
      params.push(options.country, `%${options.country}%`)
      paramIndex += 2
    }
    
    if (options.chapter) {
      whereClause += ` AND hs_code LIKE $${paramIndex}`
      params.push(`${options.chapter}%`)
      paramIndex++
    }
    
    // 获取唯一的 HS Code
    let query = `
      SELECT DISTINCT 
        COALESCE(hs_code_10, hs_code) as code,
        hs_code,
        hs_code_10,
        SUBSTRING(goods_description, 1, 50) as description,
        origin_country_code
      FROM tariff_rates
      ${whereClause}
      ORDER BY code
    `
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`
    }
    
    console.log('📊 查询参数:')
    console.log(`   原产国: ${options.country || '全部'}`)
    console.log(`   章节: ${options.chapter || '全部'}`)
    console.log(`   限制数量: ${options.limit || '无限制'}`)
    console.log('')
    
    const result = await pool.query(query, params)
    const hsCodes = result.rows
    
    console.log(`📌 找到 ${hsCodes.length} 个唯一 HS Code 待验证`)
    console.log('')
    console.log('-'.repeat(70))
    
    // 统计结果
    const stats = {
      total: hsCodes.length,
      valid: 0,
      invalid: 0,
      declarable: 0,
      parentCodes: 0,  // 父级编码（存在但不可申报）
      errors: 0,
      invalidCodes: [],
      parentCodesList: [],
      errorCodes: []
    }
    
    // 批量验证
    let processed = 0
    for (const row of hsCodes) {
      processed++
      const codeToValidate = row.code
      
      // 显示进度
      if (processed % 50 === 0 || processed === hsCodes.length) {
        process.stdout.write(`\r🔄 验证进度: ${processed}/${hsCodes.length} (${(processed/hsCodes.length*100).toFixed(1)}%)`)
      }
      
      const validation = await validateHsCode(codeToValidate)
      
      if (validation.error && !validation.error.includes('未找到')) {
        stats.errors++
        stats.errorCodes.push({
          code: codeToValidate,
          hsCode: row.hs_code,
          hsCode10: row.hs_code_10,
          description: row.description,
          country: row.origin_country_code,
          error: validation.error
        })
      } else if (validation.isValid) {
        stats.valid++
        if (validation.isDeclarable) {
          stats.declarable++
        } else if (validation.isParentCode) {
          stats.parentCodes++
          stats.parentCodesList.push({
            code: codeToValidate,
            hsCode: row.hs_code,
            hsCode10: row.hs_code_10,
            description: row.description,
            country: row.origin_country_code,
            childCodes: validation.childCodes
          })
        }
      } else {
        stats.invalid++
        stats.invalidCodes.push({
          code: codeToValidate,
          hsCode: row.hs_code,
          hsCode10: row.hs_code_10,
          description: row.description,
          country: row.origin_country_code,
          error: validation.error
        })
      }
      
      // API 限流保护
      await delay(200)
    }
    
    console.log('\n')
    console.log('=' .repeat(70))
    console.log('📊 验证结果汇总')
    console.log('=' .repeat(70))
    console.log('')
    console.log(`   总数: ${stats.total}`)
    console.log(`   ✅ 有效: ${stats.valid} (${(stats.valid/stats.total*100).toFixed(1)}%)`)
    console.log(`      - 可申报: ${stats.declarable}`)
    console.log(`      - 父级编码(需细分): ${stats.parentCodes}`)
    console.log(`   ❌ 无效(未找到): ${stats.invalid} (${(stats.invalid/stats.total*100).toFixed(1)}%)`)
    console.log(`   ⚠️ 查询错误: ${stats.errors}`)
    console.log('')
    
    // 显示父级编码（需要细分的编码）
    if (stats.parentCodesList.length > 0) {
      console.log('=' .repeat(70))
      console.log('📦 父级编码列表（存在但需要选择更精确的子编码）')
      console.log('=' .repeat(70))
      console.log('')
      console.log('   HS编码        10位编码       原产国   可申报子编码示例')
      console.log('   ' + '-'.repeat(65))
      
      for (const item of stats.parentCodesList.slice(0, 30)) {
        const hs = (item.hsCode || '').padEnd(12)
        const hs10 = (item.hsCode10 || '-').padEnd(12)
        const country = (item.country || '-').padEnd(6)
        const children = item.childCodes?.slice(0, 2).map(c => c.code).join(', ') || '-'
        console.log(`   ${hs}  ${hs10}  ${country}  ${children}`)
      }
      
      if (stats.parentCodesList.length > 30) {
        console.log(`   ... 还有 ${stats.parentCodesList.length - 30} 条未显示`)
      }
      console.log('')
    }
    
    // 显示无效编码详情
    if (stats.invalidCodes.length > 0) {
      console.log('=' .repeat(70))
      console.log('❌ 无效 HS Code 列表（在 TARIC 系统中完全不存在）')
      console.log('=' .repeat(70))
      console.log('')
      console.log('   HS编码        10位编码       原产国   描述')
      console.log('   ' + '-'.repeat(65))
      
      for (const item of stats.invalidCodes.slice(0, 50)) {
        const hs = (item.hsCode || '').padEnd(12)
        const hs10 = (item.hsCode10 || '-').padEnd(12)
        const country = (item.country || '-').padEnd(6)
        const desc = (item.description || '').substring(0, 30)
        console.log(`   ${hs}  ${hs10}  ${country}  ${desc}`)
      }
      
      if (stats.invalidCodes.length > 50) {
        console.log(`   ... 还有 ${stats.invalidCodes.length - 50} 条未显示`)
      }
      console.log('')
    }
    
    // 显示查询错误
    if (stats.errorCodes.length > 0) {
      console.log('=' .repeat(70))
      console.log('⚠️ 查询错误列表')
      console.log('=' .repeat(70))
      console.log('')
      
      for (const item of stats.errorCodes.slice(0, 20)) {
        console.log(`   ${item.code}: ${item.error}`)
      }
      
      if (stats.errorCodes.length > 20) {
        console.log(`   ... 还有 ${stats.errorCodes.length - 20} 条未显示`)
      }
      console.log('')
    }
    
    // 保存结果到文件
    const reportPath = path.join(__dirname, '../exports/hscode-validation-report.json')
    const fs = await import('fs')
    
    const report = {
      generatedAt: new Date().toISOString(),
      options,
      summary: {
        total: stats.total,
        valid: stats.valid,
        declarable: stats.declarable,
        parentCodes: stats.parentCodes,
        invalid: stats.invalid,
        errors: stats.errors,
        validRate: (stats.valid/stats.total*100).toFixed(2) + '%',
        declarableRate: (stats.declarable/stats.total*100).toFixed(2) + '%'
      },
      parentCodesList: stats.parentCodesList,
      invalidCodes: stats.invalidCodes,
      errorCodes: stats.errorCodes
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 验证报告已保存到: ${reportPath}`)
    
    // 输出结论
    console.log('')
    console.log('=' .repeat(70))
    console.log('💡 结论与建议')
    console.log('=' .repeat(70))
    
    if (stats.invalid === 0 && stats.errors === 0 && stats.parentCodes === 0) {
      console.log('\n✅ 所有 HS Code 在 TARIC 系统中都是有效且可申报的！')
    } else {
      console.log(`
📋 验证结果分析:

1. ✅ 可申报编码: ${stats.declarable} 个
   这些编码在 TARIC 系统中有效，可以直接用于报关申报。

2. 📦 父级编码: ${stats.parentCodes} 个
   这些编码在 TARIC 系统中存在，但属于"父级分类"，不能直接申报。
   实际报关时需要选择更精确的子编码。
   - 例如: 0101290000 (其他马) 需要选择 0101291000 (屠宰用) 或 0101299000 (其他)

3. ❌ 无效编码: ${stats.invalid} 个
   这些编码在 TARIC 系统中完全不存在，可能是:
   - 中国海关特有编码（非欧盟 TARIC 编码）
   - 已过期/废止的旧版编码
   - 数据录入错误

4. ⚠️ 查询错误: ${stats.errors} 个
   API 查询失败，可能是网络问题或限流，建议稍后重试。

建议操作:
- 对于父级编码：在报关时需要根据具体商品选择可申报的子编码
- 对于无效编码：核实后更新或标记为非欧盟编码
- 对于查询错误：稍后重试验证
`)
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// 执行
main()
  .then(() => {
    console.log('\n✅ 验证完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })
