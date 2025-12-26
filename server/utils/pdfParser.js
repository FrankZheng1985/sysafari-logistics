/**
 * PDF 文件解析工具
 * 支持文字 PDF 的文本提取
 */

// 导入 pdf-parse 核心模块，避免测试文件依赖问题
import pdf from 'pdf-parse/lib/pdf-parse.js'

/**
 * 解析 PDF 文件，提取文本内容
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @returns {Object} 解析结果
 */
export async function parsePdf(fileBuffer) {
  try {
    const data = await pdf(fileBuffer)
    
    return {
      success: true,
      text: data.text,
      pageCount: data.numpages,
      info: data.info
    }
  } catch (error) {
    console.error('PDF 解析失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 从 PDF 文本中提取表格数据
 * 尝试识别表格结构
 * @param {string} text - PDF 文本内容
 * @returns {Array} 提取的数据行
 */
export function extractTableFromText(text) {
  // 按行分割
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  // 尝试识别表格行（包含多个数字或制表符分隔的内容）
  const tableRows = []
  
  lines.forEach(line => {
    // 检测是否像表格行（包含价格数字）
    const pricePattern = /[\d,]+\.?\d*\s*[€$¥]|[€$¥]\s*[\d,]+\.?\d*/
    const tabSeparated = line.includes('\t')
    const multipleSpaces = line.includes('  ')
    
    if (pricePattern.test(line) || tabSeparated || multipleSpaces) {
      // 尝试分割成列
      let columns
      if (tabSeparated) {
        columns = line.split('\t').map(c => c.trim())
      } else if (multipleSpaces) {
        columns = line.split(/\s{2,}/).map(c => c.trim())
      } else {
        columns = [line]
      }
      
      tableRows.push(columns)
    }
  })
  
  return tableRows
}

/**
 * 价格向上取整到50的倍数（用于客户报价，供应商报价不使用）
 * 例如: 901-949 → 950, 951-999 → 1000, 932 → 950
 * @param {number} price - 原始价格
 * @returns {number} 取整后的价格
 */
function roundPriceTo50(price) {
  if (!price || price <= 0) return price
  return Math.ceil(price / 50) * 50
}

/**
 * 根据费用名称自动识别费用类别
 * @param {string} feeName - 费用名称
 * @returns {string} 费用类别
 */
function detectFeeCategory(feeName) {
  if (!feeName) return '其他服务'
  
  const name = feeName.toLowerCase()
  
  // 运输服务
  if (/运输|送仓|提柜|送货|配送|运费|卡车|拖车|派送|集装箱|柜|transport|delivery|truck|haulage|drayage/i.test(name)) {
    return '运输服务'
  }
  
  // 港口服务
  if (/港口|码头|堆场|吊装|装卸|港杂|thc|port|terminal|handling/i.test(name)) {
    return '港口服务'
  }
  
  // 报关服务
  if (/报关|清关|关税|进口|出口|海关|customs|clearance|duty|import|export/i.test(name)) {
    return '报关服务'
  }
  
  // 仓储服务
  if (/仓储|仓库|存储|堆存|storage|warehouse/i.test(name)) {
    return '仓储服务'
  }
  
  // 文件费
  if (/文件|单证|提单|doc|document|bill.*lading|b\/l/i.test(name)) {
    return '文件费'
  }
  
  // 管理费
  if (/管理|手续|服务费|admin|handling.*fee|service.*charge/i.test(name)) {
    return '管理费'
  }
  
  return '其他服务'
}

/**
 * 从PDF内容智能识别费用类型
 * @param {string} text - PDF文本内容
 * @returns {string} 识别出的费用类型
 */
function detectFeeTypeFromContent(text) {
  const firstLines = text.split('\n').slice(0, 10).join(' ').toLowerCase()
  
  // 特殊组合模式检测（优先级最高）
  // "还空点"/"还柜" + "送仓" = 提柜送仓费
  if ((firstLines.includes('还空') || firstLines.includes('还柜')) && 
      (firstLines.includes('送仓') || firstLines.includes('运费'))) {
    return '提柜送仓费'
  }
  
  // 费用类型关键词映射表（按优先级排序）
  const feeTypeMapping = [
    // 组合服务
    { keywords: ['提柜送仓', '码头送仓'], type: '提柜送仓费' },
    
    // 运输相关
    { keywords: ['送仓'], type: '送仓费' },
    { keywords: ['提柜', '提箱', 'pickup', 'container pickup'], type: '提柜费' },
    { keywords: ['拖车', 'trucking', 'drayage'], type: '拖车费' },
    { keywords: ['卡车', 'truck'], type: '卡车运输费' },
    { keywords: ['铁路', '卡铁', 'rail', 'train'], type: '铁路运输费' },
    { keywords: ['运费', '运输', 'delivery', 'transport', 'freight'], type: '运输费' },
    
    // 港口/码头相关
    { keywords: ['码头', 'terminal'], type: '码头费' },
    { keywords: ['港杂', 'thc', 'terminal handling'], type: '港杂费' },
    { keywords: ['堆存', 'storage', 'demurrage'], type: '堆存费' },
    { keywords: ['港口', 'port'], type: '港口费' },
    
    // 清关相关
    { keywords: ['清关', 'customs', 'clearance'], type: '清关费' },
    { keywords: ['报关', 'declaration'], type: '报关费' },
    { keywords: ['查验', 'inspection'], type: '查验费' },
    
    // 文件相关
    { keywords: ['文件', 'document', 'doc fee'], type: '文件费' },
    { keywords: ['换单', 'bl', 'bill of lading'], type: '换单费' },
    
    // 仓储相关
    { keywords: ['仓储', 'warehouse', 'warehousing'], type: '仓储费' },
    { keywords: ['装卸', 'loading', 'unloading'], type: '装卸费' },
    
    // 其他
    { keywords: ['保险', 'insurance'], type: '保险费' },
    { keywords: ['代理', 'agency'], type: '代理费' }
  ]
  
  // 按顺序检查，返回第一个匹配的类型
  for (const mapping of feeTypeMapping) {
    for (const keyword of mapping.keywords) {
      if (firstLines.includes(keyword)) {
        return mapping.type
      }
    }
  }
  
  // 默认返回通用名称
  return '运输服务费'
}

/**
 * 智能解析 PDF 报价表
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @returns {Object} 解析结果
 */
export async function parseQuotationPdf(fileBuffer) {
  const parseResult = await parsePdf(fileBuffer)
  
  if (!parseResult.success) {
    return parseResult
  }
  
  const tableData = extractTableFromText(parseResult.text)
  
  // 尝试识别表头和数据
  const result = {
    success: true,
    text: parseResult.text,
    pageCount: parseResult.pageCount,
    extractedRows: tableData,
    recognizedItems: []
  }
  
  const lines = parseResult.text.split('\n')
  const seenFees = new Set() // 避免重复
  
  // 智能识别费用类型（从表头或文件内容分析）
  const detectedFeeType = detectFeeTypeFromContent(parseResult.text)
  
  lines.forEach(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.length < 3) return
    
    // 跳过明显的标题行或页眉页脚
    if (/^(页|page|第|报价|quotation|日期|date|公司|company|地址|address|电话|tel|传真|fax)/i.test(trimmedLine)) {
      return
    }
    
    // 跳过地址行（包含街道名称关键词）
    // 例如: "Mintarder Weg 53" 不是报价
    if (/\b(weg|str|straße|strasse|street|road|avenue|lane|platz|allee|ring|damm|ufer|gasse|plein|laan|straat)\b/i.test(trimmedLine)) {
      return
    }
    
    // 多种费用项识别模式
    const patterns = [
      // 格式1: 费用名称 金额€ 或 费用名称 €金额
      /^(.{2,30}?)\s+([\d,]+\.?\d*)\s*[€$¥]$/,
      /^(.{2,30}?)\s+[€$¥]\s*([\d,]+\.?\d*)$/,
      // 格式2: 费用名称 金额 EUR/USD/CNY
      /^(.{2,30}?)\s+([\d,]+\.?\d*)\s*(EUR|USD|CNY|RMB)$/i,
      // 格式3: 费用名称：金额 或 费用名称:金额
      /^(.{2,30}?)[：:]\s*[€$¥]?\s*([\d,]+\.?\d*)$/,
      // 格式4: 中文费用项 + 金额（支持逗号分隔的数字）
      /^([\u4e00-\u9fa5]{2,15}.*?)\s+([\d,]+\.?\d*)\s*[€$¥元]?$/,
      // 格式5: 英文费用项 + 金额
      /^([A-Za-z\s]{3,30})\s+([\d,]+\.?\d*)\s*[€$¥]?$/,
      // 格式6: 费用名称 单位 金额 (如: 港杂费 票 150)
      /^(.{2,20}?)\s+(票|件|柜|箱|吨|公斤|kg|pcs|unit)\s+([\d,]+\.?\d*)$/i,
      // 格式7: 表格行 - 多列数据
      /^(.{2,25}?)\s{2,}([\d,]+\.?\d*)\s*[€$¥]?$/,
      // 格式8: 物流运输报价 - 目的港+送仓地址+还空点+运费
      // 例: 鹿特丹DE-41751, DE-41199，DE-40221鹿特丹932
      // 例: 鹿特丹CZ-25261布拉格(卡铁）1665
      /^([\u4e00-\u9fa5]+)([A-Z]{2}-[\d\s,，A-Za-z\-]+?)([\u4e00-\u9fa5]+[\u4e00-\u9fa5（）\(\)A-Za-z]*?)\s*(\d{3,5})$/,
      // 格式9: 简单的 行内容+数字结尾
      /^(.+?)(\d{3,5})$/
    ]
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i]
      const match = trimmedLine.match(pattern)
      if (match) {
        let feeName, priceStr, routeFrom, routeTo, returnPoint, unit
        
        // 格式8: 物流运输报价格式 - 目的港+送仓地址+还空点+运费 (索引8)
        // PDF表头: 目的港 | 送仓地址 | 还空点 | 运费
        // 映射: 目的港→起运地, 送仓地址→目的地, 还空点→还柜点
        // 多个邮编需要拆分为多行
        if (i === 8 && match.length === 5) {
          routeFrom = match[1].trim()      // 目的港 → 起运地
          const destinations = match[2].trim()  // 送仓地址（可能包含多个邮编）
          returnPoint = match[3].trim()    // 还空点 → 还柜点
          priceStr = match[4]              // 运费
          feeName = detectedFeeType        // 使用智能识别的费用类型
          
          const price = parseFloat(String(priceStr).replace(/,/g, ''))
          // 供应商报价保持原价，不做取整（取整规则用于客户报价）
          const currency = detectCurrencyFromLine(trimmedLine)
          
          // 拆分多个邮编（支持中英文逗号分隔）
          // 例如: "DE-41751, DE-41199，DE-40221" → ["DE-41751", "DE-41199", "DE-40221"]
          const postalCodes = destinations.split(/[,，]\s*/).map(s => s.trim()).filter(s => s)
          
          // 为每个邮编创建一行记录
          for (const postalCode of postalCodes) {
            const uniqueKey = `${routeFrom}-${postalCode}`
            
            if (!seenFees.has(uniqueKey) && price > 0) {
              seenFees.add(uniqueKey)
              result.recognizedItems.push({
                feeName: feeName,
                feeCategory: detectFeeCategory(feeName),  // 自动识别费用类别
                price: price,
                unit: '票',
                currency: currency,
                routeFrom: routeFrom,       // 起运地
                routeTo: postalCode,        // 单个目的地邮编
                returnPoint: returnPoint,   // 还柜点
                originalLine: trimmedLine
              })
            }
          }
          break // 已处理完，跳出循环
        }
        // 格式9: 简单行+数字结尾 (索引9)
        else if (i === 9 && match.length === 3) {
          feeName = match[1].trim()
          priceStr = match[2]
        }
        // 其他格式
        else {
          feeName = match[1].trim()
          // 对于格式6，费用名称在第1组，金额在第3组
          priceStr = match[3] || match[2]
          unit = match[3] && !isNaN(parseFloat(match[3])) ? '' : (match[2] || '')
        }
        
        const price = parseFloat(String(priceStr).replace(/,/g, ''))
        
        // 对于物流运输格式，使用 routeTo (目的地邮编) 作为唯一标识
        const uniqueKey = routeTo ? `${routeFrom}-${routeTo}` : feeName.toLowerCase()
        
        // 验证数据有效性
        if (feeName && 
            feeName.length >= 2 && 
            feeName.length <= 80 && 
            !isNaN(price) && 
            price > 0 &&
            !seenFees.has(uniqueKey)) {
          
          seenFees.add(uniqueKey)
          const item = {
            feeName: feeName,
            feeCategory: detectFeeCategory(feeName),  // 自动识别费用类别
            price: price,
            unit: unit || '票',
            currency: detectCurrencyFromLine(trimmedLine),
            originalLine: trimmedLine
          }
          
          // 如果是物流运输格式，添加路由信息
          if (routeFrom) item.routeFrom = routeFrom     // 起运地
          if (routeTo) item.routeTo = routeTo           // 目的地
          if (returnPoint) item.returnPoint = returnPoint // 还柜点
          
          result.recognizedItems.push(item)
          break // 匹配到一个模式就停止
        }
      }
    }
  })
  
  return result
}

/**
 * 从行文本中检测货币类型
 */
function detectCurrencyFromLine(line) {
  if (/€|EUR/i.test(line)) return 'EUR'
  if (/\$|USD/i.test(line)) return 'USD'
  if (/¥|CNY|RMB|元/i.test(line)) return 'CNY'
  return 'EUR' // 默认欧元
}

export default {
  parsePdf,
  extractTableFromText,
  parseQuotationPdf
}
