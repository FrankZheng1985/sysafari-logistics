/**
 * TARIC 数据解析器
 * 支持解析 Excel 和 XML 格式的 TARIC 数据
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// ==================== Excel 解析器 ====================

/**
 * 解析 TARIC Nomenclature Excel 文件（商品分类编码）
 * @param {Buffer|string} input - Excel 文件 Buffer 或路径
 * @returns {Array} 解析后的税率数据
 */
export function parseNomenclatureExcel(input) {
  const workbook = XLSX.read(input, { type: typeof input === 'string' ? 'file' : 'buffer' })
  const results = []
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    
    if (data.length < 2) continue
    
    // 检测列索引
    const headerRow = data[0].map(h => String(h).toLowerCase().trim())
    const columnMap = detectNomenclatureColumns(headerRow)
    
    if (columnMap.code === undefined) {
      console.warn(`Sheet "${sheetName}": 未找到编码列，跳过`)
      continue
    }
    
    console.log(`解析 Sheet "${sheetName}": 检测到列映射`, columnMap)
    
    // 解析数据行
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      // 处理 "0100000000 80" 这种格式，去除空格和非数字字符
      const rawCode = String(row[columnMap.code] || '').trim()
      const code = rawCode.replace(/\s+/g, '').replace(/[^\d]/g, '')
      
      if (!code || code.length < 4) continue
      
      // 只处理有效的商品编码（通常是8位或10位）
      const hsCode8 = code.substring(0, Math.min(8, code.length)).padEnd(8, '0')
      const hsCode10 = code.substring(0, Math.min(10, code.length)).padEnd(10, '0')
      
      const item = {
        hsCode: hsCode8,
        hsCode10: hsCode10,
        taricCode: hsCode10,
        goodsDescription: columnMap.description !== undefined ? String(row[columnMap.description] || '').trim() : '',
        goodsDescriptionCn: columnMap.descriptionCn !== undefined ? String(row[columnMap.descriptionCn] || '').trim() : null,
        chapter: hsCode8.substring(0, 2),
        heading: hsCode8.substring(0, 4),
        subheading: hsCode8.substring(0, 6)
      }
      
      // 解析附加信息
      if (columnMap.dutyRate !== undefined) {
        const dutyStr = String(row[columnMap.dutyRate] || '').trim()
        item.dutyRate = parseDutyRate(dutyStr)
      }
      if (columnMap.vatRate !== undefined) {
        const vatStr = String(row[columnMap.vatRate] || '').trim()
        item.vatRate = parseFloat(vatStr) || 19
      }
      if (columnMap.unit !== undefined) {
        item.unitName = String(row[columnMap.unit] || '').trim()
      }
      // 开始日期
      if (columnMap.startDate !== undefined) {
        const dateVal = row[columnMap.startDate]
        item.startDate = parseExcelDate(dateVal)
      }
      // 结束日期
      if (columnMap.endDate !== undefined) {
        const dateVal = row[columnMap.endDate]
        item.endDate = parseExcelDate(dateVal)
      }
      
      results.push(item)
    }
  }
  
  console.log(`Nomenclature 解析完成: ${results.length} 条记录`)
  return results
}

/**
 * 解析 TARIC Duties Excel 文件（关税税率）
 * @param {Buffer|string} input - Excel 文件 Buffer 或路径
 * @returns {Array} 解析后的关税数据
 */
export function parseDutiesExcel(input) {
  const workbook = XLSX.read(input, { type: typeof input === 'string' ? 'file' : 'buffer' })
  const results = []
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    
    if (data.length < 2) continue
    
    // 检测列索引
    const headerRow = data[0].map(h => String(h).toLowerCase().trim())
    const columnMap = detectDutiesColumns(headerRow)
    
    if (columnMap.code === undefined) {
      console.warn(`Sheet "${sheetName}": 未找到编码列，跳过`)
      continue
    }
    
    console.log(`解析 Duties Sheet "${sheetName}": 检测到列映射`, columnMap)
    
    // 解析数据行
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      // 处理编码格式
      const rawCode = String(row[columnMap.code] || '').trim()
      const code = rawCode.replace(/\s+/g, '').replace(/[^\d]/g, '')
      
      if (!code || code.length < 4) continue
      
      const hsCode8 = code.substring(0, Math.min(8, code.length)).padEnd(8, '0')
      const hsCode10 = code.substring(0, Math.min(10, code.length)).padEnd(10, '0')
      
      const item = {
        hsCode: hsCode8,
        hsCode10: hsCode10,
        taricCode: hsCode10
      }
      
      // 解析关税税率
      if (columnMap.thirdCountryDuty !== undefined) {
        const dutyStr = String(row[columnMap.thirdCountryDuty] || '').trim()
        item.thirdCountryDuty = parseDutyRate(dutyStr)
        item.dutyRate = item.thirdCountryDuty
      }
      if (columnMap.preferentialDuty !== undefined) {
        const prefStr = String(row[columnMap.preferentialDuty] || '').trim()
        item.preferentialRate = parseDutyRate(prefStr)
      }
      // 措施类型（文字描述）
      if (columnMap.measureType !== undefined) {
        item.measureType = String(row[columnMap.measureType] || '').trim()
      }
      // 措施类型代码
      if (columnMap.measureTypeCode !== undefined) {
        item.measureCode = String(row[columnMap.measureTypeCode] || '').trim()
      }
      // 原产地/地理区域（文字描述）
      if (columnMap.geographicalArea !== undefined) {
        item.originCountry = String(row[columnMap.geographicalArea] || '').trim()
      }
      // 原产地代码
      if (columnMap.originCode !== undefined) {
        item.originCountryCode = String(row[columnMap.originCode] || '').trim()
        item.geographicalArea = item.originCountryCode
      }
      if (columnMap.additionalCode !== undefined) {
        item.additionalCode = String(row[columnMap.additionalCode] || '').trim()
      }
      if (columnMap.startDate !== undefined) {
        const dateVal = row[columnMap.startDate]
        item.startDate = parseExcelDate(dateVal)
      }
      if (columnMap.endDate !== undefined) {
        const dateVal = row[columnMap.endDate]
        item.endDate = parseExcelDate(dateVal)
      }
      // 法律依据
      if (columnMap.legalBase !== undefined) {
        item.legalBase = String(row[columnMap.legalBase] || '').trim()
      }
      // 配额号
      if (columnMap.orderNumber !== undefined) {
        item.quotaOrderNumber = String(row[columnMap.orderNumber] || '').trim()
      }
      
      results.push(item)
    }
  }
  
  console.log(`Duties 解析完成: ${results.length} 条记录`)
  return results
}

/**
 * 合并 Nomenclature 和 Duties 数据
 * 优先使用 "Third country duty" 作为基础税率
 * 正确提取反倾销税和反补贴税
 * 
 * 措施代码说明：
 * - 103: Third country duty（第三国关税/MFN）
 * - 142: Tariff preference（优惠关税）
 * - 551: Provisional anti-dumping duty（临时反倾销税）
 * - 552: Definitive anti-dumping duty（最终反倾销税）
 * - 553: Provisional countervailing duty（临时反补贴税）
 * - 554: Definitive countervailing duty（最终反补贴税）
 * 
 * 注意：会保留 Duties 中所有有特定原产国的记录，即使对应的 HS 编码不在 Nomenclature 中
 */
export function mergeNomenclatureAndDuties(nomenclature, duties) {
  // 创建编码索引，按措施类型分类
  const dutiesMap = new Map() // HS编码 -> { thirdCountry, antiDumping, countervailing, preferential, other[] }
  
  for (const duty of duties) {
    const key = duty.hsCode
    if (!dutiesMap.has(key)) {
      dutiesMap.set(key, { 
        thirdCountry: null, 
        antiDumping: [],      // 反倾销税列表
        countervailing: [],   // 反补贴税列表
        preferential: [], 
        other: [] 
      })
    }
    
    const entry = dutiesMap.get(key)
    const measureType = (duty.measureType || '').toLowerCase()
    const measureCode = duty.measureCode || ''
    
    // 根据措施代码分类
    if (measureCode === '103' || measureType.includes('third country')) {
      // 第三国关税 - 这是基础税率
      if (!entry.thirdCountry || (duty.dutyRate != null && entry.thirdCountry.dutyRate == null)) {
        entry.thirdCountry = duty
      }
    } else if (measureCode === '551' || measureCode === '552' || measureType.includes('anti-dumping')) {
      // 反倾销税（临时或最终）
      entry.antiDumping.push(duty)
    } else if (measureCode === '553' || measureCode === '554' || measureType.includes('countervailing')) {
      // 反补贴税（临时或最终）
      entry.countervailing.push(duty)
    } else if (measureCode === '142' || measureCode === '143' || 
               measureType.includes('preferential') || measureType.includes('tariff preference')) {
      // 优惠税率
      entry.preferential.push(duty)
    } else {
      // 其他措施
      entry.other.push(duty)
    }
  }
  
  // 合并数据
  const merged = []
  const processedHsCodesForDuties = new Set() // 记录已处理的 HS 编码，避免重复添加 Duties 数据
  
  for (const nom of nomenclature) {
    const dutyData = dutiesMap.get(nom.hsCode)
    const isFirstForHsCode = !processedHsCodesForDuties.has(nom.hsCode)
    if (isFirstForHsCode) {
      processedHsCodesForDuties.add(nom.hsCode)
    }
    
    // 基础记录：使用 Third country duty 作为默认税率
    const thirdCountry = dutyData?.thirdCountry
    
    // 获取最高的反倾销税率（通常针对特定国家有不同税率）
    let maxAntiDumpingRate = null
    let antiDumpingMeasure = null
    if (dutyData?.antiDumping && dutyData.antiDumping.length > 0) {
      for (const ad of dutyData.antiDumping) {
        const rate = ad.dutyRate ?? ad.thirdCountryDuty
        if (rate != null && (maxAntiDumpingRate === null || rate > maxAntiDumpingRate)) {
          maxAntiDumpingRate = rate
          antiDumpingMeasure = ad
        }
      }
    }
    
    // 获取最高的反补贴税率
    let maxCountervailingRate = null
    let countervailingMeasure = null
    if (dutyData?.countervailing && dutyData.countervailing.length > 0) {
      for (const cv of dutyData.countervailing) {
        const rate = cv.dutyRate ?? cv.thirdCountryDuty
        if (rate != null && (maxCountervailingRate === null || rate > maxCountervailingRate)) {
          maxCountervailingRate = rate
          countervailingMeasure = cv
        }
      }
    }
    
    // 创建基础记录
    const baseRecord = {
      ...nom,
      dutyRate: thirdCountry?.dutyRate ?? nom.dutyRate ?? 0,
      thirdCountryDuty: thirdCountry?.thirdCountryDuty ?? thirdCountry?.dutyRate,
      antiDumpingRate: maxAntiDumpingRate,
      countervailingRate: maxCountervailingRate,
      measureType: thirdCountry?.measureType || 'Third country duty',
      measureCode: thirdCountry?.measureCode || '103',
      startDate: thirdCountry?.startDate,
      endDate: thirdCountry?.endDate,
      legalBase: thirdCountry?.legalBase,
      // 标记是否有反倾销/反补贴税
      hasAntiDumping: dutyData?.antiDumping?.length > 0,
      hasCountervailing: dutyData?.countervailing?.length > 0
    }
    
    merged.push(baseRecord)
    
    // 只在第一次处理该 HS 编码时添加国家特定的 Duties 记录
    // 避免因 Nomenclature 中同一 HS 编码有多条记录而重复添加
    if (isFirstForHsCode) {
      // 添加反倾销税记录（保留所有记录）
      if (dutyData?.antiDumping) {
        for (const ad of dutyData.antiDumping) {
          merged.push({
            ...nom,
            ...ad,
            goodsDescription: nom.goodsDescription,
            goodsDescriptionCn: nom.goodsDescriptionCn,
            antiDumpingRate: ad.dutyRate ?? ad.thirdCountryDuty,
            dutyRate: thirdCountry?.dutyRate ?? 0
          })
        }
      }
      
      // 添加反补贴税记录（保留所有记录）
      if (dutyData?.countervailing) {
        for (const cv of dutyData.countervailing) {
          merged.push({
            ...nom,
            ...cv,
            goodsDescription: nom.goodsDescription,
            goodsDescriptionCn: nom.goodsDescriptionCn,
            countervailingRate: cv.dutyRate ?? cv.thirdCountryDuty,
            dutyRate: thirdCountry?.dutyRate ?? 0
          })
        }
      }
      
      // 添加优惠税率记录（按原产国去重）
      if (dutyData?.preferential) {
        const seenOrigins = new Set()
        for (const pref of dutyData.preferential) {
          const originKey = pref.originCountryCode || pref.originCountry || 'unknown'
          if (!seenOrigins.has(originKey)) {
            seenOrigins.add(originKey)
            merged.push({
              ...nom,
              ...pref,
              goodsDescription: nom.goodsDescription,
              goodsDescriptionCn: nom.goodsDescriptionCn,
              preferentialRate: pref.dutyRate ?? pref.preferentialRate
            })
          }
        }
      }
      
      // 添加其他措施记录（进口管制、配额等）
      if (dutyData?.other) {
        const seenKeys = new Set()
        for (const other of dutyData.other) {
          const originCode = other.originCountryCode || ''
          // 跳过通用记录
          if (!originCode || originCode === '1011' || originCode === '1008' || 
              originCode.startsWith('10') || originCode.startsWith('20')) {
            continue
          }
          const uniqueKey = `${originCode}-${other.measureType || ''}`
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey)
            merged.push({
              ...nom,
              ...other,
              goodsDescription: nom.goodsDescription,
              goodsDescriptionCn: nom.goodsDescriptionCn,
              dutyRate: other.dutyRate ?? thirdCountry?.dutyRate ?? 0
            })
          }
        }
      }
    }
  }
  
  // ==================== 处理不在 Nomenclature 中的 Duties 记录 ====================
  // 确保所有国家特定的措施（如反倾销税、反补贴税）都被保留
  
  const processedHsCodes = new Set(nomenclature.map(n => n.hsCode))
  const additionalRecords = []
  
  for (const duty of duties) {
    // 跳过已处理的 HS 编码
    if (processedHsCodes.has(duty.hsCode)) continue
    
    const originCode = duty.originCountryCode || ''
    const measureCode = duty.measureCode || ''
    const measureType = (duty.measureType || '').toLowerCase()
    
    // 只保留有特定原产国且不是通用记录的数据
    if (!originCode || originCode === '1011' || originCode === '1008' || 
        originCode.startsWith('10') || originCode.startsWith('20')) {
      // 但是保留第三国关税（103）作为基础税率
      if (measureCode !== '103') continue
    }
    
    // 判断是反倾销税还是反补贴税
    const isAntiDumping = measureCode === '551' || measureCode === '552' || measureType.includes('anti-dumping')
    const isCountervailing = measureCode === '553' || measureCode === '554' || measureType.includes('countervailing')
    
    additionalRecords.push({
      hsCode: duty.hsCode,
      hsCode10: duty.hsCode10,
      taricCode: duty.taricCode,
      goodsDescription: duty.goodsDescription || `HS ${duty.hsCode}`,
      originCountry: duty.originCountry,
      originCountryCode: duty.originCountryCode,
      dutyRate: isAntiDumping || isCountervailing ? 0 : (duty.dutyRate ?? duty.thirdCountryDuty ?? 0),
      thirdCountryDuty: duty.thirdCountryDuty,
      antiDumpingRate: isAntiDumping ? (duty.dutyRate ?? duty.thirdCountryDuty) : null,
      countervailingRate: isCountervailing ? (duty.dutyRate ?? duty.thirdCountryDuty) : null,
      measureType: duty.measureType,
      measureCode: duty.measureCode,
      startDate: duty.startDate,
      endDate: duty.endDate,
      legalBase: duty.legalBase,
      quotaOrderNumber: duty.quotaOrderNumber,
      additionalCode: duty.additionalCode
    })
  }
  
  console.log(`[合并] 额外添加 ${additionalRecords.length} 条不在 Nomenclature 中的记录`)
  
  return [...merged, ...additionalRecords]
}

// ==================== 列检测函数 ====================

/**
 * 检测 Nomenclature 文件的列索引
 */
function detectNomenclatureColumns(headers) {
  const map = {}
  
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    
    // 编码列 - 支持 "Goods code" 格式
    if (map.code === undefined && /^(goods\s*code|cn8|cn.?code|code|taric|hs.?code|nomenclature)$/i.test(h)) {
      map.code = i
    }
    // 英文描述列
    if (map.description === undefined && /^(description|desc|text|name|goods.?desc)$/i.test(h)) {
      map.description = i
    }
    // 中文描述列
    if (map.descriptionCn === undefined && /^(description.?cn|desc.?cn|中文|chinese)$/i.test(h)) {
      map.descriptionCn = i
    }
    // 关税率
    if (map.dutyRate === undefined && /^(duty|duty.?rate|tariff|关税)$/i.test(h)) {
      map.dutyRate = i
    }
    // 增值税率
    if (map.vatRate === undefined && /^(vat|vat.?rate|增值税)$/i.test(h)) {
      map.vatRate = i
    }
    // 计量单位
    if (map.unit === undefined && /^(unit|uom|计量单位)$/i.test(h)) {
      map.unit = i
    }
    // 开始日期
    if (map.startDate === undefined && /^(start\s*date|valid\s*from|effective)$/i.test(h)) {
      map.startDate = i
    }
    // 结束日期
    if (map.endDate === undefined && /^(end\s*date|valid\s*to|expiry)$/i.test(h)) {
      map.endDate = i
    }
  }
  
  return map
}

/**
 * 检测 Duties 文件的列索引
 */
function detectDutiesColumns(headers) {
  const map = {}
  
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    
    // 编码列 - 支持 "Goods code" 格式
    if (map.code === undefined && /^(goods\s*code|cn8|cn.?code|code|taric|hs.?code|nomenclature)$/i.test(h)) {
      map.code = i
    }
    // 关税率 - 支持 "Duty" 格式
    if (map.thirdCountryDuty === undefined && /^(duty|third.?country|erga.?omnes|mfn|duty.?rate)$/i.test(h)) {
      map.thirdCountryDuty = i
    }
    // 优惠税率
    if (map.preferentialDuty === undefined && /^(preferential|pref|gsp|fta)$/i.test(h)) {
      map.preferentialDuty = i
    }
    // 措施类型 - 支持 "Measure type" 格式
    if (map.measureType === undefined && /^(measure\s*type|meas\.?\s*type|type)$/i.test(h)) {
      map.measureType = i
    }
    // 措施类型代码
    if (map.measureTypeCode === undefined && /^(meas\.?\s*type\s*code|measure\s*type\s*code)$/i.test(h)) {
      map.measureTypeCode = i
    }
    // 原产地/地理区域 - 支持 "Origin" 格式
    if (map.geographicalArea === undefined && /^(origin(?!\s*code)|geo|geographical|country|area)$/i.test(h)) {
      map.geographicalArea = i
    }
    // 原产地代码 - 支持 "Origin code" 格式
    if (map.originCode === undefined && /^(origin\s*code|country\s*code|geo\s*code)$/i.test(h)) {
      map.originCode = i
    }
    // 附加码 - 支持 "Add code" 格式
    if (map.additionalCode === undefined && /^(add\.?\s*code|additional.?code)$/i.test(h)) {
      map.additionalCode = i
    }
    // 开始日期
    if (map.startDate === undefined && /^(start\s*date|valid.?from|effective)$/i.test(h)) {
      map.startDate = i
    }
    // 结束日期
    if (map.endDate === undefined && /^(end\s*date|valid.?to|expiry)$/i.test(h)) {
      map.endDate = i
    }
    // 法律依据
    if (map.legalBase === undefined && /^(legal\s*base|regulation|法律依据)$/i.test(h)) {
      map.legalBase = i
    }
    // 配额号
    if (map.orderNumber === undefined && /^(order\s*no\.?|quota|order\s*number)$/i.test(h)) {
      map.orderNumber = i
    }
  }
  
  return map
}

// ==================== 辅助函数 ====================

/**
 * 解析关税率字符串
 * @param {string} str - 关税率字符串，如 "12%", "12.5", "FREE"
 * @returns {number|null}
 */
function parseDutyRate(str) {
  if (!str) return null
  
  const s = String(str).trim().toUpperCase()
  
  // 免税
  if (s === 'FREE' || s === '0' || s === '-') {
    return 0
  }
  
  // 百分比格式
  const percentMatch = s.match(/^([\d.]+)\s*%?$/)
  if (percentMatch) {
    return parseFloat(percentMatch[1]) || 0
  }
  
  // 复合税率（如 "12% + 45 EUR/100 kg"）- 暂时只取从价税部分
  const complexMatch = s.match(/^([\d.]+)\s*%/)
  if (complexMatch) {
    return parseFloat(complexMatch[1]) || 0
  }
  
  return null
}

/**
 * 解析 Excel 日期
 */
function parseExcelDate(value) {
  if (!value) return null
  
  // Excel 序列号日期
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
      }
    } catch (e) {
      // 如果解析失败，尝试其他方式
    }
  }
  
  // 字符串日期
  if (typeof value === 'string') {
    const str = value.trim()
    
    // ISO 格式 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10)
    }
    
    // DD-MM-YYYY 或 DD/MM/YYYY 格式
    const dmyMatch = str.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/)
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
    }
    
    // YYYY/MM/DD 格式
    const ymdMatch = str.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/)
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`
    }
  }
  
  return null
}

// ==================== 贸易协定解析 ====================

/**
 * 从税率数据中提取贸易协定信息
 */
export function extractTradeAgreements(tariffData) {
  const agreements = new Map()
  
  // 常见贸易协定映射
  const agreementTypes = {
    'GSP': { name: 'Generalised Scheme of Preferences', nameCn: '普惠制' },
    'GSP+': { name: 'GSP+ (Special Incentive)', nameCn: '普惠制增强版' },
    'EBA': { name: 'Everything But Arms', nameCn: '除武器外一切（最不发达国家）' },
    'EPA': { name: 'Economic Partnership Agreement', nameCn: '经济伙伴协定' },
    'FTA': { name: 'Free Trade Agreement', nameCn: '自由贸易协定' },
    'CU': { name: 'Customs Union', nameCn: '关税同盟' }
  }
  
  for (const item of tariffData) {
    if (!item.geographicalArea || item.geographicalArea === '1011') continue // 1011 = Erga Omnes (所有国家)
    
    const key = `${item.geographicalArea}`
    if (!agreements.has(key)) {
      // 根据地理区域代码判断协定类型
      let agreementType = 'OTHER'
      let agreementName = `Preferential Rate - ${item.geographicalArea}`
      let agreementNameCn = `优惠税率 - ${item.geographicalArea}`
      
      // 匹配已知协定
      for (const [code, info] of Object.entries(agreementTypes)) {
        if (item.geographicalArea.includes(code) || item.measureType?.includes(code)) {
          agreementType = code
          agreementName = info.name
          agreementNameCn = info.nameCn
          break
        }
      }
      
      agreements.set(key, {
        agreementCode: item.geographicalArea,
        agreementName,
        agreementNameCn,
        agreementType,
        countryCode: item.originCountryCode,
        countryName: item.originCountry,
        geographicalArea: item.geographicalArea,
        preferentialRate: item.preferentialRate || item.dutyRate,
        validFrom: item.startDate,
        validTo: item.endDate
      })
    }
  }
  
  return Array.from(agreements.values())
}

export default {
  parseNomenclatureExcel,
  parseDutiesExcel,
  mergeNomenclatureAndDuties,
  extractTradeAgreements
}
