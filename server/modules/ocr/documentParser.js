/**
 * 运输单文档解析器
 * 
 * 根据不同运输方式解析OCR识别结果，提取关键字段
 */

// 海运提单(B/L)字段正则表达式
const SEA_BL_PATTERNS = {
  // 提单号
  billNumber: [
    /B\/L\s*(?:NO|Number|#)?[:\s]*([A-Z0-9]{10,})/i,
    /Bill\s*of\s*Lading\s*(?:No|Number)?[:\s]*([A-Z0-9]{10,})/i,
    /提单号[:\s]*([A-Z0-9]{10,})/,
    /(?:MAWB|HAWB|B\/L)[:\s#]*([A-Z0-9]{10,})/i,
  ],
  // 集装箱号
  containerNumber: [
    /Container\s*(?:No|Number)?[:\s]*([A-Z]{4}\d{7})/i,
    /集装箱号[:\s]*([A-Z]{4}\d{7})/,
    /CNTR\s*(?:No)?[:\s]*([A-Z]{4}\d{7})/i,
    /([A-Z]{4}\d{7})/,
  ],
  // 船名航次
  vessel: [
    /Vessel[:\s]*([A-Z0-9\s]+?)(?:V\.|Voyage|VOY)[:\s]*([A-Z0-9]+)/i,
    /船名航次[:\s]*(.+?)(?:\s|$)/,
    /(?:Vessel|SHIP)[:\s]*(.+?)(?:\n|$)/i,
  ],
  // 起运港
  portOfLoading: [
    /Port\s*of\s*Loading[:\s]*([A-Z\s]+)/i,
    /POL[:\s]*([A-Z\s]+)/i,
    /起运港[:\s]*(.+?)(?:\s|$)/,
    /装货港[:\s]*(.+?)(?:\s|$)/,
  ],
  // 目的港
  portOfDischarge: [
    /Port\s*of\s*Discharge[:\s]*([A-Z\s]+)/i,
    /POD[:\s]*([A-Z\s]+)/i,
    /卸货港[:\s]*(.+?)(?:\s|$)/,
    /目的港[:\s]*(.+?)(?:\s|$)/,
  ],
  // 件数
  pieces: [
    /(?:Packages?|PKG|PKGS|件数)[:\s]*(\d+)/i,
    /(\d+)\s*(?:packages?|pkgs?|件)/i,
    /Quantity[:\s]*(\d+)/i,
    /No\.?\s*of\s*(?:Packages?|PKGS?)[:\s]*(\d+)/i,
    /Total\s*(?:Packages?|PKGS?|Pieces?)[:\s]*(\d+)/i,
    /(?:数量|总件数)[:\s：]*(\d+)/,
    /(\d+)\s*(?:CTNS?|Cartons?|箱)/i,
  ],
  // 毛重
  grossWeight: [
    /Gross\s*Weight[:\s]*([0-9.,]+)\s*(?:KG|KGS)?/i,
    /毛重[:\s]*([0-9.,]+)/,
    /G\.?W\.?[:\s]*([0-9.,]+)/i,
    /([0-9.,]+)\s*KGS?/i,
  ],
  // 体积
  volume: [
    /(?:Volume|CBM|体积)[:\s]*([0-9.,]+)/i,
    /Measurement[:\s]*([0-9.,]+)/i,
    /([0-9.,]+)\s*CBM/i,
  ],
  // 发货人
  shipper: [
    /Shipper[:\s]*(.+?)(?:\n|Consignee)/is,
    /发货人[:\s]*(.+?)(?:\n|收货人)/s,
  ],
  // 收货人
  consignee: [
    /Consignee[:\s]*(.+?)(?:\n|Notify)/is,
    /收货人[:\s]*(.+?)(?:\n|通知)/s,
  ],
  // ETA预计到港时间
  eta: [
    /ETA[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
    /预计到港[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/,
    /Arrival[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i,
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

/**
 * 解析海运提单
 * @param {string} ocrText - OCR识别的文本
 * @returns {Object} 解析结果
 */
export function parseSeaBillOfLading(ocrText) {
  const result = {
    transportType: 'sea',
    billNumber: extractField(ocrText, SEA_BL_PATTERNS.billNumber),
    containerNumber: extractField(ocrText, SEA_BL_PATTERNS.containerNumber),
    vessel: extractField(ocrText, SEA_BL_PATTERNS.vessel),
    portOfLoading: extractField(ocrText, SEA_BL_PATTERNS.portOfLoading),
    portOfDischarge: extractField(ocrText, SEA_BL_PATTERNS.portOfDischarge),
    pieces: extractField(ocrText, SEA_BL_PATTERNS.pieces),
    grossWeight: extractField(ocrText, SEA_BL_PATTERNS.grossWeight),
    volume: extractField(ocrText, SEA_BL_PATTERNS.volume),
    shipper: extractField(ocrText, SEA_BL_PATTERNS.shipper),
    consignee: extractField(ocrText, SEA_BL_PATTERNS.consignee),
    eta: extractField(ocrText, SEA_BL_PATTERNS.eta),
  }
  
  // 清理数值字段
  if (result.pieces) result.pieces = parseInt(result.pieces.replace(/,/g, ''), 10) || null
  if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight.replace(/,/g, '')) || null
  if (result.volume) result.volume = parseFloat(result.volume.replace(/,/g, '')) || null
  
  return result
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
