import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync } from 'fs'
import XLSX from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 从命令行参数获取文件路径
const filePath = process.argv[2]

if (!filePath) {
  console.error('❌ 请提供Excel文件路径')
  console.log('\n使用方法:')
  console.log('  node scripts/import-taric-excel.js <文件路径>')
  console.log('\n示例:')
  console.log('  node scripts/import-taric-excel.js /path/to/Nomenclature EN.xlsx')
  console.log('\n📌 TARIC数据文件下载地址:')
  console.log('  https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa')
  process.exit(1)
}

if (!existsSync(filePath)) {
  console.error(`❌ 文件不存在: ${filePath}`)
  process.exit(1)
}

console.log('📦 开始导入TARIC Excel文件...')
console.log(`📁 文件路径: ${filePath}`)

try {
  // 读取Excel文件
  console.log('\n📖 正在读取Excel文件...')
  const workbook = XLSX.readFile(filePath)
  
  // 获取第一个工作表（通常TARIC数据在第一个工作表）
  const sheetName = workbook.SheetNames[0]
  console.log(`📄 工作表名称: ${sheetName}`)
  
  const worksheet = workbook.Sheets[sheetName]
  
  // 转换为JSON格式
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    defval: null, // 空单元格返回null
    raw: false,   // 不解析公式，返回原始值
  })
  
  console.log(`✅ 读取到 ${data.length} 行数据`)
  
  if (data.length === 0) {
    console.error('❌ Excel文件中没有数据')
    process.exit(1)
  }
  
  // 显示前几行数据，帮助理解结构
  console.log('\n📋 前3行数据示例:')
  console.log(JSON.stringify(data.slice(0, 3), null, 2))
  
  // 识别列名（TARIC Excel文件的列名可能是英文）
  // 常见的列名：
  // - CN8/CN Code: 8位CN编码
  // - Description: 描述
  // - Chapter: 章节
  // - Heading: 标题
  // - Subheading: 子标题
  const firstRow = data[0]
  const columns = Object.keys(firstRow)
  console.log('\n📊 检测到的列名:')
  columns.forEach((col, idx) => {
    console.log(`   ${idx + 1}. ${col}`)
  })
  
  // 尝试自动识别列
  const findColumn = (keywords) => {
    for (const col of columns) {
      const lowerCol = col.toLowerCase()
      for (const keyword of keywords) {
        if (lowerCol.includes(keyword.toLowerCase())) {
          return col
        }
      }
    }
    return null
  }
  
  const codeColumn = findColumn(['cn8', 'cn code', 'code', 'taric', 'hs'])
  const descEnColumn = findColumn(['description', 'desc', 'text', 'name'])
  const chapterColumn = findColumn(['chapter', 'ch'])
  const headingColumn = findColumn(['heading', 'head'])
  const subheadingColumn = findColumn(['subheading', 'sub'])
  
  console.log('\n🔍 自动识别的列映射:')
  console.log(`   HS/CN编码: ${codeColumn || '未找到'}`)
  console.log(`   英文描述: ${descEnColumn || '未找到'}`)
  console.log(`   章节: ${chapterColumn || '未找到'}`)
  console.log(`   标题: ${headingColumn || '未找到'}`)
  console.log(`   子标题: ${subheadingColumn || '未找到'}`)
  
  if (!codeColumn) {
    console.error('\n❌ 无法识别编码列，请检查Excel文件格式')
    console.log('\n提示: TARIC Excel文件应包含以下列之一:')
    console.log('  - CN8, CN Code, Code, TARIC, HS')
    process.exit(1)
  }
  
  // 准备插入语句
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO hs_codes (
      hs_code, cn_code, description_en, description_cn,
      chapter, heading, subheading,
      tariff_rate, import_tariff_rate, export_tariff_rate, inspection_rate,
      unit_of_measure, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `)
  
  // 开始事务
  const transaction = db.transaction((rows) => {
    let insertedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    for (const row of rows) {
      try {
        // 提取编码（去除空格和特殊字符）
        let code = String(row[codeColumn] || '').trim().replace(/[^0-9.]/g, '')
        
        if (!code || code.length < 6) {
          skippedCount++
          continue
        }
        
        // 确保编码是10位（TARIC标准）
        // 如果不足10位，补0
        if (code.length < 10) {
          code = code.padEnd(10, '0')
        }
        // 如果超过10位，截取前10位
        if (code.length > 10) {
          code = code.substring(0, 10)
        }
        
        // 提取描述
        const descriptionEn = descEnColumn ? String(row[descEnColumn] || '').trim() : null
        
        // 提取章节信息
        let chapter = null
        let heading = null
        let subheading = null
        
        if (chapterColumn && row[chapterColumn]) {
          chapter = parseInt(row[chapterColumn]) || null
        } else if (code.length >= 2) {
          // 从编码中提取章节（前2位）
          chapter = parseInt(code.substring(0, 2)) || null
        }
        
        if (headingColumn && row[headingColumn]) {
          heading = parseInt(row[headingColumn]) || null
        } else if (code.length >= 4) {
          // 从编码中提取标题（第3-4位）
          heading = parseInt(code.substring(2, 4)) || null
        }
        
        if (subheadingColumn && row[subheadingColumn]) {
          subheading = parseInt(row[subheadingColumn]) || null
        } else if (code.length >= 6) {
          // 从编码中提取子标题（第5-6位）
          subheading = parseInt(code.substring(4, 6)) || null
        }
        
        // 插入数据
        insertStmt.run(
          code,
          code, // CN编码通常与HS编码相同
          descriptionEn,
          null, // 中文描述需要单独翻译
          chapter,
          heading,
          subheading,
          null, // 关税信息通常在单独的Duties文件中
          null,
          null,
          null, // 查验率需要从其他数据源获取
          null,
          '从TARIC Excel文件导入',
          'active'
        )
        
        insertedCount++
        
        if (insertedCount % 1000 === 0) {
          console.log(`   ✅ 已处理 ${insertedCount} 条...`)
        }
      } catch (err) {
        errorCount++
        if (errorCount <= 10) {
          console.error(`   ⚠️  处理行数据失败:`, err.message)
        }
      }
    }
    
    return { insertedCount, skippedCount, errorCount }
  })
  
  // 执行导入
  console.log('\n📝 开始导入数据到数据库...')
  const result = transaction(data)
  
  console.log('\n✅ 导入完成!')
  console.log(`   ✅ 成功导入: ${result.insertedCount} 条`)
  console.log(`   ⏭️  跳过: ${result.skippedCount} 条`)
  console.log(`   ❌ 错误: ${result.errorCount} 条`)
  
  // 统计信息
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT chapter) as chapters,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active
    FROM hs_codes
  `).get()
  
  console.log('\n📊 数据库统计:')
  console.log(`   总数: ${stats.total}`)
  console.log(`   章节数: ${stats.chapters}`)
  console.log(`   启用: ${stats.active}`)
  
  console.log('\n✅ 导入完成!')
  
} catch (error) {
  console.error('❌ 导入失败:', error)
  console.error(error.stack)
  process.exit(1)
} finally {
  db.close()
}

