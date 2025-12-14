/**
 * TARIC在线查询爬虫脚本
 * 
 * 此脚本尝试从TARIC在线查询页面自动获取HS Code数据
 * 注意：需要遵守网站使用条款，建议先联系欧盟委员会确认
 * 
 * 使用方法:
 *   npm install puppeteer
 *   node scripts/fetch-taric-online.js
 */

import puppeteer from 'puppeteer'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// TARIC在线查询URL
const TARIC_QUERY_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en'

// 生成6位HS编码列表（示例：只查询前几章）
function generateHSCodes() {
  const codes = []
  // 生成第1-10章的所有6位编码（示例）
  for (let chapter = 1; chapter <= 10; chapter++) {
    for (let heading = 1; heading <= 99; heading++) {
      const code = `${String(chapter).padStart(2, '0')}${String(heading).padStart(2, '0')}00`
      codes.push(code)
    }
  }
  return codes
}

async function queryTARIC(page, hsCode) {
  try {
    console.log(`查询HS编码: ${hsCode}`)
    
    // 访问TARIC查询页面
    await page.goto(TARIC_QUERY_URL, { waitUntil: 'networkidle2' })
    
    // 等待页面加载
    await page.waitForTimeout(2000)
    
    // 查找输入框并输入HS编码
    // 注意：需要根据实际页面结构调整选择器
    const inputSelector = 'input[name="goodsCode"], input[id="goodsCode"], #goodsCode'
    await page.waitForSelector(inputSelector, { timeout: 5000 })
    await page.type(inputSelector, hsCode)
    
    // 点击查询按钮
    const buttonSelector = 'input[type="submit"], button[type="submit"], #retrieveButton'
    await page.click(buttonSelector)
    
    // 等待结果加载
    await page.waitForTimeout(3000)
    
    // 提取数据（需要根据实际页面结构调整）
    const data = await page.evaluate(() => {
      // 这里需要根据实际页面结构提取数据
      // 示例代码，需要根据实际情况调整
      const description = document.querySelector('.description')?.textContent || ''
      const tariffRate = document.querySelector('.tariff-rate')?.textContent || ''
      
      return {
        description,
        tariffRate,
      }
    })
    
    return {
      hsCode,
      ...data,
    }
  } catch (error) {
    console.error(`查询 ${hsCode} 失败:`, error.message)
    return null
  }
}

async function main() {
  console.log('🚀 开始从TARIC在线查询获取数据...')
  console.log('⚠️  注意：此脚本需要遵守网站使用条款')
  console.log('⚠️  建议先联系欧盟委员会确认自动化访问政策\n')
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  
  const page = await browser.newPage()
  
  // 设置用户代理，模拟真实浏览器
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
  
  try {
    // 生成要查询的HS编码列表
    const hsCodes = generateHSCodes().slice(0, 10) // 示例：只查询前10个
    console.log(`准备查询 ${hsCodes.length} 个HS编码\n`)
    
    const results = []
    
    for (const hsCode of hsCodes) {
      const data = await queryTARIC(page, hsCode)
      if (data) {
        results.push(data)
        
        // 保存到数据库
        try {
          db.prepare(`
            INSERT OR REPLACE INTO hs_codes (
              hs_code, cn_code, description_en,
              chapter, heading, subheading,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, 'active')
          `).run(
            hsCode.padEnd(10, '0'),
            hsCode.padEnd(10, '0'),
            data.description || null,
            parseInt(hsCode.substring(0, 2)) || null,
            parseInt(hsCode.substring(2, 4)) || null,
            parseInt(hsCode.substring(4, 6)) || null
          )
        } catch (dbError) {
          console.error(`保存 ${hsCode} 到数据库失败:`, dbError.message)
        }
      }
      
      // 控制请求频率，避免被封IP
      await page.waitForTimeout(2000) // 等待2秒
    }
    
    console.log(`\n✅ 完成！成功获取 ${results.length} 条数据`)
    
  } catch (error) {
    console.error('❌ 执行失败:', error)
  } finally {
    await browser.close()
    db.close()
  }
}

// 检查是否安装了puppeteer
try {
  await main()
} catch (error) {
  if (error.message.includes('Cannot find module')) {
    console.error('❌ 请先安装puppeteer:')
    console.error('   npm install puppeteer')
  } else {
    console.error('❌ 错误:', error.message)
  }
  process.exit(1)
}

