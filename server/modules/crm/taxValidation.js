/**
 * 税号验证服务
 * 支持欧盟VAT和EORI号码验证
 */

import https from 'https'
import http from 'http'

// VAT号码格式正则表达式（按国家）
const VAT_PATTERNS = {
  AT: /^ATU\d{8}$/,           // 奥地利
  BE: /^BE0?\d{9,10}$/,       // 比利时
  BG: /^BG\d{9,10}$/,         // 保加利亚
  CY: /^CY\d{8}[A-Z]$/,       // 塞浦路斯
  CZ: /^CZ\d{8,10}$/,         // 捷克
  DE: /^DE\d{9}$/,            // 德国
  DK: /^DK\d{8}$/,            // 丹麦
  EE: /^EE\d{9}$/,            // 爱沙尼亚
  EL: /^EL\d{9}$/,            // 希腊
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, // 西班牙
  FI: /^FI\d{8}$/,            // 芬兰
  FR: /^FR[A-Z0-9]{2}\d{9}$/, // 法国
  HR: /^HR\d{11}$/,           // 克罗地亚
  HU: /^HU\d{8}$/,            // 匈牙利
  IE: /^IE\d{7}[A-Z]{1,2}$|^IE\d[A-Z]\d{5}[A-Z]$/, // 爱尔兰
  IT: /^IT\d{11}$/,           // 意大利
  LT: /^LT(\d{9}|\d{12})$/,   // 立陶宛
  LU: /^LU\d{8}$/,            // 卢森堡
  LV: /^LV\d{11}$/,           // 拉脱维亚
  MT: /^MT\d{8}$/,            // 马耳他
  NL: /^NL\d{9}B\d{2}$/,      // 荷兰
  PL: /^PL\d{10}$/,           // 波兰
  PT: /^PT\d{9}$/,            // 葡萄牙
  RO: /^RO\d{2,10}$/,         // 罗马尼亚
  SE: /^SE\d{12}$/,           // 瑞典
  SI: /^SI\d{8}$/,            // 斯洛文尼亚
  SK: /^SK\d{10}$/,           // 斯洛伐克
  XI: /^XI\d{9}$|^XI\d{12}$|^XIGD\d{3}$/ // 北爱尔兰
}

// EORI号码格式正则表达式
const EORI_PATTERN = /^[A-Z]{2}[A-Z0-9]{1,15}$/

/**
 * 格式化VAT号码（移除空格和特殊字符）
 */
function formatVatNumber(vatNumber) {
  return vatNumber.replace(/[\s\-\.]/g, '').toUpperCase()
}

/**
 * 从VAT号码中提取国家代码
 */
function extractCountryCode(vatNumber) {
  const formatted = formatVatNumber(vatNumber)
  const countryCode = formatted.substring(0, 2)
  return countryCode
}

/**
 * 验证VAT号码格式
 */
function validateVatFormat(vatNumber, countryCode) {
  const formatted = formatVatNumber(vatNumber)
  const pattern = VAT_PATTERNS[countryCode]
  
  if (!pattern) {
    return { valid: false, error: `不支持的国家代码: ${countryCode}` }
  }
  
  if (!pattern.test(formatted)) {
    return { valid: false, error: `VAT号码格式不正确，${countryCode}的正确格式应符合: ${pattern}` }
  }
  
  return { valid: true }
}

/**
 * 调用欧盟VIES SOAP API验证VAT号码
 */
async function callViesApi(countryCode, vatNumber) {
  // VIES SOAP请求XML
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:checkVat>
         <urn:countryCode>${countryCode}</urn:countryCode>
         <urn:vatNumber>${vatNumber}</urn:vatNumber>
      </urn:checkVat>
   </soapenv:Body>
</soapenv:Envelope>`

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ec.europa.eu',
      port: 443,
      path: '/taxation_customs/vies/services/checkVatService',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'Content-Length': Buffer.byteLength(soapRequest),
        'SOAPAction': ''
      },
      timeout: 30000
    }

    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          console.log('[VIES响应]', data.substring(0, 500)) // 记录响应便于调试
          
          // 解析SOAP响应 - 支持带命名空间前缀的标签
          const validMatch = data.match(/<(?:\w+:)?valid>(\w+)<\/(?:\w+:)?valid>/i)
          const nameMatch = data.match(/<(?:\w+:)?name>([^<]*)<\/(?:\w+:)?name>/i)
          const addressMatch = data.match(/<(?:\w+:)?address>([^<]*)<\/(?:\w+:)?address>/i)
          const faultMatch = data.match(/<(?:\w+:)?faultstring>([^<]*)<\/(?:\w+:)?faultstring>/i)
          
          if (faultMatch) {
            resolve({
              valid: false,
              error: faultMatch[1],
              rawResponse: data
            })
            return
          }
          
          // 确保返回布尔值而不是null
          const isValid = validMatch ? validMatch[1].toLowerCase() === 'true' : false
          
          resolve({
            valid: isValid,
            companyName: nameMatch ? decodeXmlEntities(nameMatch[1].trim()) : '',
            companyAddress: addressMatch ? decodeXmlEntities(addressMatch[1].trim()) : '',
            countryCode,
            vatNumber,
            requestDate: new Date().toISOString(),
            rawResponse: data
          })
        } catch (error) {
          reject(new Error(`解析VIES响应失败: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`VIES API请求失败: ${error.message}`))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('VIES API请求超时'))
    })

    req.write(soapRequest)
    req.end()
  })
}

/**
 * 解码XML实体
 */
function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
}

/**
 * 验证VAT税号
 * @param {string} vatNumber - VAT税号（可包含或不包含国家代码前缀）
 * @param {string} countryCode - 国家代码（可选，如果vatNumber已包含则会自动提取）
 * @returns {Promise<object>} 验证结果
 */
export async function validateVAT(vatNumber, countryCode = null) {
  try {
    const formatted = formatVatNumber(vatNumber)
    
    // 如果没有提供国家代码，从VAT号码中提取
    if (!countryCode) {
      countryCode = extractCountryCode(formatted)
    }
    countryCode = countryCode.toUpperCase()
    
    // 移除VAT号码中的国家代码前缀（如果有）
    let vatNumberWithoutCountry = formatted
    if (formatted.startsWith(countryCode)) {
      vatNumberWithoutCountry = formatted.substring(countryCode.length)
    }
    
    // 格式验证
    const formatResult = validateVatFormat(formatted, countryCode)
    if (!formatResult.valid) {
      return {
        valid: false,
        error: formatResult.error,
        vatNumber: formatted,
        countryCode
      }
    }
    
    // 调用VIES API
    const result = await callViesApi(countryCode, vatNumberWithoutCountry)
    
    return {
      valid: result.valid,
      vatNumber: formatted,
      countryCode,
      companyName: result.companyName || '',
      companyAddress: result.companyAddress || '',
      verifiedAt: new Date().toISOString(),
      error: result.error || null,
      verificationData: JSON.stringify({
        source: 'VIES',
        requestDate: result.requestDate,
        valid: result.valid,
        companyName: result.companyName,
        companyAddress: result.companyAddress
      })
    }
  } catch (error) {
    console.error('VAT验证失败:', error)
    return {
      valid: false,
      vatNumber: formatVatNumber(vatNumber),
      countryCode,
      error: error.message,
      verifiedAt: new Date().toISOString()
    }
  }
}

/**
 * 调用欧盟EORI验证API
 */
async function callEoriApi(eoriNumber) {
  return new Promise((resolve, reject) => {
    // 使用欧盟官方EORI验证服务
    const url = `https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation?eori=${encodeURIComponent(eoriNumber)}`
    
    const options = {
      hostname: 'ec.europa.eu',
      port: 443,
      path: `/taxation_customs/dds2/eos/validation/services/validation?eori=${encodeURIComponent(eoriNumber)}`,
      method: 'GET',
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    }

    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          console.log('[EORI响应]', data.substring(0, 500)) // 记录响应便于调试
          
          // 解析响应 - EORI验证返回XML，支持带命名空间前缀
          const statusMatch = data.match(/<(?:\w+:)?status(?:Code)?>(\d+)<\/(?:\w+:)?status(?:Code)?>/i)
          const resultMatch = data.match(/<(?:\w+:)?result>(\w+)<\/(?:\w+:)?result>/i)
          const nameMatch = data.match(/<(?:\w+:)?name>([^<]*)<\/(?:\w+:)?name>/i)
          const addressMatch = data.match(/<(?:\w+:)?address>([^<]*)<\/(?:\w+:)?address>/i)
          
          // 状态码 0 = 有效, 1 = 无效；确保返回布尔值
          const isValid = statusMatch ? statusMatch[1] === '0' : false
          
          resolve({
            valid: isValid,
            eoriNumber,
            companyName: nameMatch ? decodeXmlEntities(nameMatch[1].trim()) : '',
            companyAddress: addressMatch ? decodeXmlEntities(addressMatch[1].trim()) : '',
            requestDate: new Date().toISOString(),
            rawResponse: data
          })
        } catch (error) {
          // 如果解析失败，尝试简单判断
          const isValid = data.includes('<status>0</status>') || data.toLowerCase().includes('valid')
          resolve({
            valid: isValid,
            eoriNumber,
            companyName: '',
            companyAddress: '',
            requestDate: new Date().toISOString(),
            rawResponse: data,
            error: `响应解析不完整: ${error.message}`
          })
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`EORI API请求失败: ${error.message}`))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('EORI API请求超时'))
    })

    req.end()
  })
}

/**
 * 验证EORI号码格式
 */
function validateEoriFormat(eoriNumber) {
  const formatted = eoriNumber.replace(/[\s\-\.]/g, '').toUpperCase()
  
  if (!EORI_PATTERN.test(formatted)) {
    return { 
      valid: false, 
      error: 'EORI号码格式不正确，应为2位国家代码+最多15位字母数字' 
    }
  }
  
  return { valid: true }
}

/**
 * 验证EORI号码
 * @param {string} eoriNumber - EORI号码
 * @returns {Promise<object>} 验证结果
 */
export async function validateEORI(eoriNumber) {
  try {
    const formatted = eoriNumber.replace(/[\s\-\.]/g, '').toUpperCase()
    
    // 格式验证
    const formatResult = validateEoriFormat(formatted)
    if (!formatResult.valid) {
      return {
        valid: false,
        error: formatResult.error,
        eoriNumber: formatted
      }
    }
    
    // 调用EORI验证API
    const result = await callEoriApi(formatted)
    
    return {
      valid: result.valid,
      eoriNumber: formatted,
      countryCode: formatted.substring(0, 2),
      companyName: result.companyName || '',
      companyAddress: result.companyAddress || '',
      verifiedAt: new Date().toISOString(),
      error: result.error || null,
      verificationData: JSON.stringify({
        source: 'EU_EORI',
        requestDate: result.requestDate,
        valid: result.valid,
        companyName: result.companyName,
        companyAddress: result.companyAddress
      })
    }
  } catch (error) {
    console.error('EORI验证失败:', error)
    return {
      valid: false,
      eoriNumber: eoriNumber.replace(/[\s\-\.]/g, '').toUpperCase(),
      error: error.message,
      verifiedAt: new Date().toISOString()
    }
  }
}

/**
 * 获取支持的VAT国家列表
 */
export function getSupportedVatCountries() {
  return Object.keys(VAT_PATTERNS).map(code => ({
    code,
    pattern: VAT_PATTERNS[code].toString()
  }))
}

export default {
  validateVAT,
  validateEORI,
  getSupportedVatCountries,
  formatVatNumber,
  extractCountryCode
}
