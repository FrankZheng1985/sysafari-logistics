/**
 * 运输单文档解析器
 * 
 * 根据不同运输方式解析OCR识别结果，提取关键字段
 */

// 海运提单(B/L)字段正则表达式
// 基于COSCO等主流船公司提单格式优化
const SEA_BL_PATTERNS = {
  // 提单号 - 支持 COSU/OOCL/MSC 等格式
  // COSCO格式: COSU6435174570 (4字母+10数字)
  billNumber: [
    /Bill\s*of\s*Lading\s*No\.?[:\s]*([A-Z]{4}\d{10})/i,
    /B\/L\s*No\.?[:\s]*([A-Z]{4}\d{10})/i,
    /([A-Z]{4}\d{10})/,  // 独立匹配 COSU6435174570 格式
    /B\/L\s*(?:NO|Number|#)?[:\s]*([A-Z0-9]{10,})/i,
    /提单号[:\s]*([A-Z0-9]{10,})/,
  ],
  // 集装箱号 - 4字母+7数字 (如 OOCU9301500)
  // 必须是11位字符，后面不能再跟数字（避免匹配提单号）
  containerNumber: [
    /([A-Z]{4}\d{7})(?!\d)/,  // 独立匹配，确保后面不是数字
  ],
  // 船名航次 - COSCO格式: "Ocean Vessel Voy. No.: EVER ACME 1375-011W"
  vessel: [
    /Ocean\s*Vessel\s*Voy\.?\s*No\.?[:\s]*(.+?)(?:\n|$)/i,
    /Vessel[\/\s]*Voyage[:\s]*(.+?)(?:\n|$)/i,
  ],
  // 起运港 - Place of Receipt 或 Port of Loading
  portOfLoading: [
    /Place\s*of\s*Receipt[:\s]*([A-Z][A-Za-z\s,]+?)(?=\s*(?:\n|\d\.|Port|$))/i,
    /Port\s*of\s*Loading[:\s]*([A-Z][A-Za-z\s]+?)(?=\s*(?:\n|\d\.|$))/i,
    /POL[:\s]*([A-Z][A-Za-z\s]+)/i,
    /起运港[:\s]*(.+?)(?:\s{2,}|\n|$)/,
    /装货港[:\s]*(.+?)(?:\s{2,}|\n|$)/,
  ],
  // 目的港 - Port of Discharge 或 Place of Delivery
  portOfDischarge: [
    /Port\s*of\s*Discharge[:\s]*([A-Z][A-Za-z\s]+?)(?=\s*(?:\n|Type|Place|\d\.|$))/i,
    /Place\s*of\s*Delivery[:\s]*([A-Z][A-Za-z\s,]+?)(?=\s*(?:\n|\d\.|$))/i,
    /POD[:\s]*([A-Z][A-Za-z\s]+)/i,
    // 常见欧洲港口直接匹配
    /\b(ROTTERDAM|HAMBURG|ANTWERP|AMSTERDAM|FELIXSTOWE|BREMERHAVEN)\b/i,
    /卸货港[:\s]*(.+?)(?:\s{2,}|\n|$)/,
    /目的港[:\s]*(.+?)(?:\s{2,}|\n|$)/,
  ],
  // 件数 - COSCO格式: "68 CARTONS"
  pieces: [
    /(?:Packages?|PKG|PKGS|件数)[:\s]*(\d+)/i,
    /(\d+)\s*(?:packages?|pkgs?|件)/i,
    /Quantity[:\s]*(\d+)/i,
    /No\.?\s*of\s*(?:Packages?|PKGS?)[:\s]*(\d+)/i,
    /Total\s*(?:Packages?|PKGS?|Pieces?)[:\s]*(\d+)/i,
    /(?:数量|总件数)[:\s：]*(\d+)/,
    /(\d+)\s*(?:CTNS?|Cartons?|箱)/i,
  ],
  // 毛重 - COSCO格式: "Gross Weight: 13740.000KGS"
  grossWeight: [
    /Gross\s*Weight[:\s]*([0-9.,]+)\s*KGS?/i,
    /([0-9.,]+)\s*KGS/i,
    /毛重[:\s]*([0-9.,]+)/,
  ],
  // 体积 - COSCO格式: "Measurement: 68.0000CBM"
  volume: [
    /Measurement[:\s]*([0-9.,]+)\s*CBM/i,
    /([0-9.,]+)\s*CBM/i,
    /体积[:\s]*([0-9.,]+)/,
  ],
  // 发货人 - COSCO格式: "1. Shipper: COMPANY NAME"
  shipper: [
    /(?:1\.\s*)?Shipper[:\s]*(.+?)(?=2\.\s*Consignee|Consignee|$)/is,
    /发货人[:\s]*(.+?)(?:\n|收货人)/s,
  ],
  // 收货人
  consignee: [
    /(?:2\.\s*)?Consignee[:\s]*(.+?)(?=3\.\s*Notify|Notify|$)/is,
    /收货人[:\s]*(.+?)(?:\n|通知)/s,
  ],
  // ETA预计到港时间
  eta: [
    /ETA[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
    /预计到港[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/,
    /Arrival[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
  ],
  // 封签号 - COSCO格式: /SYA4621205/ 格式
  sealNumber: [
    // 在 "/" 之间的封签号格式 (如 /SYA4621205/)
    /\/([A-Z]{2,3}\d{6,8})[\s\/]/i,
    // Seal No: 格式
    /Seal\s*(?:No\.?)?[:\s]*([A-Z0-9]+)/i,
    /封号[:\s]*([A-Z0-9]+)/,
  ],
  // 柜型 - 40HQ/20GP 等格式
  containerSize: [
    /\/(20GP|40GP|40HC|40HQ|45HC)\//i,
    /(\d{2}(?:GP|HC|HQ|OT|RF))/i,
    /柜型[:\s]*(\d{2}(?:GP|HC|HQ|OT|RF))/,
  ],
  // ETD - Date Laden on Board 格式
  etd: [
    /Date\s*Laden\s*on\s*Board[:\s]*(\d{1,2}\s*\w{3}\s*\d{4})/i,
    /On\s*Board[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{4})/i,
    /ETD[:\s]*(\d{4}[-\/]\d{2}[-\/]\d{2})/i,
    /预计离港[:\s]*(\d{4}[-\/]\d{2}[-\/]\d{2})/,
  ],
}

// 空运单(AWB)字段正则表达式
const AIR_AWB_PATTERNS = {
  // 主单号
  billNumber: [
    /(?:MAWB|AWB|Air\s*Waybill)[:\s#]*(\d{3}[-\s]?\d{8})/i,
    /主单号[:\s]*(\d{3}[-\s]?\d{8})/,
    /(\d{3}[-\s]?\d{4}[-\s]?\d{4})/,
  ],
  // 航班号
  flightNumber: [
    /Flight[:\s]*([A-Z]{2}\d{3,4})/i,
    /航班[:\s]*([A-Z]{2}\d{3,4})/,
    /([A-Z]{2}\d{3,4})/,
  ],
  // 起运机场
  portOfLoading: [
    /(?:Origin|Departure|起运)[:\s]*([A-Z]{3})/i,
    /Airport\s*of\s*Departure[:\s]*([A-Z]{3})/i,
  ],
  // 目的机场
  portOfDischarge: [
    /(?:Destination|Arrival|目的)[:\s]*([A-Z]{3})/i,
    /Airport\s*of\s*Destination[:\s]*([A-Z]{3})/i,
  ],
  // 件数
  pieces: [
    /(?:PCS|Pieces?|件数)[:\s]*(\d+)/i,
    /(\d+)\s*(?:PCS|Pieces?)/i,
  ],
  // 毛重
  grossWeight: [
    /(?:Gross\s*Weight|G\.?W\.?|毛重)[:\s]*([0-9.,]+)/i,
    /([0-9.,]+)\s*K(?:G|GS)/i,
  ],
  // 体积重
  volumeWeight: [
    /(?:Chargeable|Volume)\s*Weight[:\s]*([0-9.,]+)/i,
    /计费重[:\s]*([0-9.,]+)/,
  ],
  // 航空公司
  airline: [
    /(?:Carrier|Airline|承运人)[:\s]*([A-Z]{2})/i,
  ],
  // 发货人
  shipper: [
    /Shipper[:\s]*(.+?)(?:\n|Consignee)/is,
    /发货人[:\s]*(.+?)(?:\n|收货人)/s,
  ],
  // 收货人
  consignee: [
    /Consignee[:\s]*(.+?)(?:\n|$)/is,
    /收货人[:\s]*(.+?)(?:\n|$)/s,
  ],
}

// 铁路运单字段正则表达式
const RAIL_PATTERNS = {
  // 运单号
  billNumber: [
    /(?:运单号|Waybill\s*No)[:\s]*([A-Z0-9]{10,})/i,
    /(?:CIM|SMGS)[:\s#]*([A-Z0-9]{10,})/i,
  ],
  // 列车号
  trainNumber: [
    /(?:Train\s*No|列车号)[:\s]*([A-Z0-9]+)/i,
    /班列号[:\s]*([A-Z0-9]+)/,
  ],
  // 起运站
  portOfLoading: [
    /(?:Station\s*of\s*Departure|起运站)[:\s]*(.+?)(?:\n|$)/i,
    /发站[:\s]*(.+?)(?:\n|$)/,
  ],
  // 目的站
  portOfDischarge: [
    /(?:Station\s*of\s*Destination|目的站)[:\s]*(.+?)(?:\n|$)/i,
    /到站[:\s]*(.+?)(?:\n|$)/,
  ],
  // 集装箱号
  containerNumber: [
    /Container[:\s]*([A-Z]{4}\d{7})/i,
    /箱号[:\s]*([A-Z]{4}\d{7})/,
  ],
  // 件数
  pieces: [
    /(?:件数|Packages?)[:\s]*(\d+)/i,
  ],
  // 毛重
  grossWeight: [
    /(?:毛重|Gross\s*Weight)[:\s]*([0-9.,]+)/i,
  ],
  // 发货人
  shipper: [
    /(?:发货人|Consignor|Sender)[:\s]*(.+?)(?:\n|收货人)/is,
  ],
  // 收货人
  consignee: [
    /(?:收货人|Consignee)[:\s]*(.+?)(?:\n|$)/is,
  ],
}

// 卡航/卡车运单字段正则表达式
const TRUCK_PATTERNS = {
  // CMR单号
  billNumber: [
    /(?:CMR|运单)[:\s#]*([A-Z0-9]{6,})/i,
    /(?:Consignment\s*Note|托运单)[:\s]*([A-Z0-9]{6,})/i,
  ],
  // 车牌号
  vehicleNumber: [
    /(?:Vehicle|Truck|车牌)[:\s]*([A-Z0-9\-]+)/i,
    /车号[:\s]*([A-Z0-9\-]+)/,
  ],
  // 起运地
  portOfLoading: [
    /(?:Place\s*of\s*Taking|发货地)[:\s]*(.+?)(?:\n|$)/i,
    /起运地[:\s]*(.+?)(?:\n|$)/,
  ],
  // 目的地
  portOfDischarge: [
    /(?:Place\s*of\s*Delivery|收货地)[:\s]*(.+?)(?:\n|$)/i,
    /目的地[:\s]*(.+?)(?:\n|$)/,
  ],
  // 件数
  pieces: [
    /(?:件数|Packages?|Number\s*of\s*packages)[:\s]*(\d+)/i,
  ],
  // 毛重
  grossWeight: [
    /(?:毛重|Gross\s*Weight)[:\s]*([0-9.,]+)/i,
  ],
  // 发货人
  shipper: [
    /(?:Sender|发货人|Consignor)[:\s]*(.+?)(?:\n|Carrier|承运人)/is,
  ],
  // 收货人
  consignee: [
    /(?:Consignee|收货人)[:\s]*(.+?)(?:\n|$)/is,
  ],
  // 承运人
  carrier: [
    /(?:Carrier|承运人)[:\s]*(.+?)(?:\n|$)/is,
  ],
}

/**
 * 从文本中提取字段值
 * @param {string} text - OCR识别的文本
 * @param {Array<RegExp>} patterns - 正则表达式数组
 * @returns {string|null} 提取的值
 */
function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return null
}

// 港口名称黑名单 - 这些不是有效的港口名称
const INVALID_PORT_NAMES = [
  'type of movement', 'movement', 'type', 'place of delivery', 'place of receipt',
  'port of loading', 'port of discharge', 'shipper', 'consignee', 'notify party',
  'description', 'goods', 'container', 'marks', 'numbers', 'gross weight',
  'measurement', 'freight', 'prepaid', 'collect', 'bill of lading', 'original',
  'copy', 'negotiable', 'terms', 'conditions', 'carrier', 'agent', 'master',
  'date', 'signature', 'seal', 'stamp', 'page', 'total', 'number', 'quantity'
]

// 船名黑名单 - 这些不是有效的船名
const INVALID_VESSEL_NAMES = [
  'service contract', 'contract no', 'booking', 'reference', 'b/l no',
  'bill of lading', 'shipper', 'consignee', 'notify', 'port of',
  'place of', 'description', 'freight', 'measurement', 'gross weight',
  'number', 'date', 'carrier', 'agent', 'master', 'signature'
]

/**
 * 验证港口名称是否有效
 * @param {string} portName - 港口名称
 * @returns {boolean} 是否有效
 */
function isValidPortName(portName) {
  if (!portName) return false
  const lowerName = portName.toLowerCase().trim()
  // 检查是否在黑名单中
  if (INVALID_PORT_NAMES.some(invalid => lowerName === invalid || lowerName.includes(invalid))) {
    return false
  }
  // 检查是否太短（少于2个字符）
  if (lowerName.length < 2) return false
  // 检查是否只有数字
  if (/^\d+$/.test(lowerName)) return false
  return true
}

/**
 * 验证船名是否有效
 * @param {string} vesselName - 船名
 * @returns {boolean} 是否有效
 */
function isValidVesselName(vesselName) {
  if (!vesselName) return false
  const lowerName = vesselName.toLowerCase().trim()
  // 检查是否在黑名单中
  if (INVALID_VESSEL_NAMES.some(invalid => lowerName.includes(invalid))) {
    return false
  }
  // 检查是否太短（少于3个字符）
  if (lowerName.length < 3) return false
  // 船名应该至少包含一个字母
  if (!/[a-z]/i.test(lowerName)) return false
  return true
}

/**
 * 解析海运提单
 * @param {string} ocrText - OCR识别的文本
 * @returns {Object} 解析结果
 */
export function parseSeaBillOfLading(ocrText) {
  console.log('=== 海运提单解析开始 ===')
  console.log('OCR文本长度:', ocrText?.length || 0)
  
  // 先尝试从COSCO格式的Marks区域提取容器信息
  // 格式: OOCU9301500/SYA4621205/40HQ/13740.000/68.0000
  const coscoMarksMatch = ocrText.match(/([A-Z]{4}\d{7})\/([A-Z]{2,3}\d{6,10})\/(\d{2}(?:GP|HC|HQ|OT|RF))/i)
  let coscoContainer = null, coscoSeal = null, coscoSize = null
  if (coscoMarksMatch) {
    coscoContainer = coscoMarksMatch[1]
    coscoSeal = coscoMarksMatch[2]
    coscoSize = coscoMarksMatch[3]
    console.log('COSCO Marks格式解析成功:', { container: coscoContainer, seal: coscoSeal, size: coscoSize })
  }
  
  // 提取各字段
  let portOfLoading = extractField(ocrText, SEA_BL_PATTERNS.portOfLoading)
  let portOfDischarge = extractField(ocrText, SEA_BL_PATTERNS.portOfDischarge)
  let vessel = extractField(ocrText, SEA_BL_PATTERNS.vessel)
  let containerNumber = coscoContainer || extractField(ocrText, SEA_BL_PATTERNS.containerNumber)
  let sealNumber = coscoSeal || extractField(ocrText, SEA_BL_PATTERNS.sealNumber)
  let containerSize = coscoSize || extractField(ocrText, SEA_BL_PATTERNS.containerSize)
  
  // 验证并清理无效值
  if (!isValidPortName(portOfLoading)) {
    console.log('起运港无效，已清空:', portOfLoading)
    portOfLoading = null
  }
  if (!isValidPortName(portOfDischarge)) {
    console.log('目的港无效，已清空:', portOfDischarge)
    portOfDischarge = null
  }
  if (!isValidVesselName(vessel)) {
    console.log('船名无效，已清空:', vessel)
    vessel = null
  }
  
  const result = {
    transportType: 'sea',
    billNumber: extractField(ocrText, SEA_BL_PATTERNS.billNumber),
    containerNumber,
    vessel,
    portOfLoading,
    portOfDischarge,
    pieces: extractField(ocrText, SEA_BL_PATTERNS.pieces),
    grossWeight: extractField(ocrText, SEA_BL_PATTERNS.grossWeight),
    volume: extractField(ocrText, SEA_BL_PATTERNS.volume),
    shipper: extractField(ocrText, SEA_BL_PATTERNS.shipper),
    consignee: extractField(ocrText, SEA_BL_PATTERNS.consignee),
    eta: extractField(ocrText, SEA_BL_PATTERNS.eta),
    sealNumber,
    containerSize,
    etd: extractField(ocrText, SEA_BL_PATTERNS.etd),
  }
  
  // 清理数值字段
  if (result.pieces) result.pieces = parseInt(String(result.pieces).replace(/,/g, ''), 10) || null
  if (result.grossWeight) result.grossWeight = parseFloat(String(result.grossWeight).replace(/,/g, '')) || null
  if (result.volume) result.volume = parseFloat(String(result.volume).replace(/,/g, '')) || null
  
  // 清理文本字段 - 去除多余空白和换行
  if (result.shipper) result.shipper = result.shipper.replace(/\s+/g, ' ').trim()
  if (result.consignee) result.consignee = result.consignee.replace(/\s+/g, ' ').trim()
  if (result.portOfLoading) result.portOfLoading = result.portOfLoading.replace(/\s+/g, ' ').trim()
  if (result.portOfDischarge) result.portOfDischarge = result.portOfDischarge.replace(/\s+/g, ' ').trim()
  if (result.vessel) result.vessel = result.vessel.replace(/\s+/g, ' ').trim()
  
  // ETD日期格式标准化 (27 NOV 2025 -> 2025-11-27)
  if (result.etd) {
    result.etd = normalizeDate(result.etd)
  }
  
  console.log('=== 海运提单解析完成 ===')
  console.log('解析结果:', JSON.stringify(result, null, 2))
  
  return result
}

/**
 * 标准化日期格式
 * @param {string} dateStr - 日期字符串 (如 "27 NOV 2025" 或 "27-NOV-2025")
 * @returns {string} 标准化日期 (YYYY-MM-DD)
 */
function normalizeDate(dateStr) {
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  }
  
  // 匹配 "27 NOV 2025" 或 "27-NOV-2025" 格式
  const match = dateStr.match(/(\d{1,2})[-\s]?(\w{3})[-\s]?(\d{4})/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = months[match[2].toUpperCase()] || match[2]
    const year = match[3]
    return `${year}-${month}-${day}`
  }
  
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) {
    return dateStr.replace(/\//g, '-')
  }
  
  return dateStr
}

/**
 * 解析空运单
 * @param {string} ocrText - OCR识别的文本
 * @returns {Object} 解析结果
 */
export function parseAirWaybill(ocrText) {
  const result = {
    transportType: 'air',
    billNumber: extractField(ocrText, AIR_AWB_PATTERNS.billNumber),
    flightNumber: extractField(ocrText, AIR_AWB_PATTERNS.flightNumber),
    airline: extractField(ocrText, AIR_AWB_PATTERNS.airline),
    portOfLoading: extractField(ocrText, AIR_AWB_PATTERNS.portOfLoading),
    portOfDischarge: extractField(ocrText, AIR_AWB_PATTERNS.portOfDischarge),
    pieces: extractField(ocrText, AIR_AWB_PATTERNS.pieces),
    grossWeight: extractField(ocrText, AIR_AWB_PATTERNS.grossWeight),
    volumeWeight: extractField(ocrText, AIR_AWB_PATTERNS.volumeWeight),
    shipper: extractField(ocrText, AIR_AWB_PATTERNS.shipper),
    consignee: extractField(ocrText, AIR_AWB_PATTERNS.consignee),
  }
  
  // 清理数值字段
  if (result.pieces) result.pieces = parseInt(result.pieces.replace(/,/g, ''), 10) || null
  if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight.replace(/,/g, '')) || null
  if (result.volumeWeight) result.volumeWeight = parseFloat(result.volumeWeight.replace(/,/g, '')) || null
  
  return result
}

/**
 * 解析铁路运单
 * @param {string} ocrText - OCR识别的文本
 * @returns {Object} 解析结果
 */
export function parseRailWaybill(ocrText) {
  const result = {
    transportType: 'rail',
    billNumber: extractField(ocrText, RAIL_PATTERNS.billNumber),
    trainNumber: extractField(ocrText, RAIL_PATTERNS.trainNumber),
    containerNumber: extractField(ocrText, RAIL_PATTERNS.containerNumber),
    portOfLoading: extractField(ocrText, RAIL_PATTERNS.portOfLoading),
    portOfDischarge: extractField(ocrText, RAIL_PATTERNS.portOfDischarge),
    pieces: extractField(ocrText, RAIL_PATTERNS.pieces),
    grossWeight: extractField(ocrText, RAIL_PATTERNS.grossWeight),
    shipper: extractField(ocrText, RAIL_PATTERNS.shipper),
    consignee: extractField(ocrText, RAIL_PATTERNS.consignee),
  }
  
  // 清理数值字段
  if (result.pieces) result.pieces = parseInt(result.pieces.replace(/,/g, ''), 10) || null
  if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight.replace(/,/g, '')) || null
  
  return result
}

/**
 * 解析卡航/卡车运单
 * @param {string} ocrText - OCR识别的文本
 * @returns {Object} 解析结果
 */
export function parseTruckWaybill(ocrText) {
  const result = {
    transportType: 'truck',
    billNumber: extractField(ocrText, TRUCK_PATTERNS.billNumber),
    vehicleNumber: extractField(ocrText, TRUCK_PATTERNS.vehicleNumber),
    portOfLoading: extractField(ocrText, TRUCK_PATTERNS.portOfLoading),
    portOfDischarge: extractField(ocrText, TRUCK_PATTERNS.portOfDischarge),
    pieces: extractField(ocrText, TRUCK_PATTERNS.pieces),
    grossWeight: extractField(ocrText, TRUCK_PATTERNS.grossWeight),
    shipper: extractField(ocrText, TRUCK_PATTERNS.shipper),
    consignee: extractField(ocrText, TRUCK_PATTERNS.consignee),
    carrier: extractField(ocrText, TRUCK_PATTERNS.carrier),
  }
  
  // 清理数值字段
  if (result.pieces) result.pieces = parseInt(result.pieces.replace(/,/g, ''), 10) || null
  if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight.replace(/,/g, '')) || null
  
  return result
}

/**
 * 根据运输方式解析运输单
 * @param {string} ocrText - OCR识别的文本
 * @param {string} transportType - 运输方式 (sea/air/rail/truck)
 * @returns {Object} 解析结果
 */
export function parseTransportDocument(ocrText, transportType) {
  switch (transportType) {
    case 'sea':
      return parseSeaBillOfLading(ocrText)
    case 'air':
      return parseAirWaybill(ocrText)
    case 'rail':
      return parseRailWaybill(ocrText)
    case 'truck':
      return parseTruckWaybill(ocrText)
    default:
      // 默认尝试海运解析
      return parseSeaBillOfLading(ocrText)
  }
}

/**
 * 自动检测运输单类型
 * @param {string} ocrText - OCR识别的文本
 * @returns {string} 运输方式 (sea/air/rail/truck)
 */
export function detectTransportType(ocrText) {
  const text = ocrText.toUpperCase()
  
  // 空运关键词
  if (text.includes('AWB') || text.includes('AIR WAYBILL') || text.includes('MAWB') || text.includes('HAWB')) {
    return 'air'
  }
  
  // 铁路关键词
  if (text.includes('CIM') || text.includes('SMGS') || text.includes('中欧班列') || text.includes('铁路运单')) {
    return 'rail'
  }
  
  // 卡航/卡车关键词
  if (text.includes('CMR') || text.includes('TRUCK') || text.includes('卡车') || text.includes('公路运输')) {
    return 'truck'
  }
  
  // 海运关键词（默认）
  if (text.includes('B/L') || text.includes('BILL OF LADING') || text.includes('提单') || text.includes('CONTAINER')) {
    return 'sea'
  }
  
  // 无法确定，默认海运
  return 'sea'
}

export default {
  parseTransportDocument,
  parseSeaBillOfLading,
  parseAirWaybill,
  parseRailWaybill,
  parseTruckWaybill,
  detectTransportType
}
