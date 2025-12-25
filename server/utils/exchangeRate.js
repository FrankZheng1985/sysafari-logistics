/**
 * 汇率获取服务
 * 获取中国银行外汇牌价
 */

// 缓存汇率数据（每小时更新一次）
let rateCache = {
  hourKey: null,  // 格式: YYYY-MM-DD-HH
  rates: {}
}

/**
 * 获取当前小时的缓存键
 * @returns {string} 格式: YYYY-MM-DD-HH
 */
function getCurrentHourKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  return `${year}-${month}-${day}-${hour}`
}

/**
 * 获取中行汇率
 * @param {string} fromCurrency - 源货币（如 EUR, USD）
 * @param {string} toCurrency - 目标货币（默认 CNY）
 * @returns {Promise<number>} 汇率
 */
export async function getBOCExchangeRate(fromCurrency = 'EUR', toCurrency = 'CNY') {
  const currentHourKey = getCurrentHourKey()
  
  // 检查缓存是否有效（同一小时内）
  if (rateCache.hourKey === currentHourKey && rateCache.rates[fromCurrency]) {
    console.log(`[汇率] 使用缓存(${currentHourKey}): ${fromCurrency} -> ${toCurrency} = ${rateCache.rates[fromCurrency]}`)
    return rateCache.rates[fromCurrency]
  }

  // 小时变更，清空旧缓存
  if (rateCache.hourKey !== currentHourKey) {
    rateCache = { hourKey: currentHourKey, rates: {} }
    console.log(`[汇率] 缓存已过期，开始获取新汇率 (${currentHourKey})`)
  }

  try {
    // 方案1: 使用免费的汇率API（exchangerate-api.com 免费版）
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`)
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }

    const data = await response.json()
    
    if (data && data.rates && data.rates[toCurrency]) {
      const rate = data.rates[toCurrency]
      
      // 更新缓存
      rateCache.hourKey = currentHourKey
      rateCache.rates[fromCurrency] = rate
      
      console.log(`[汇率] 获取成功(${currentHourKey}): ${fromCurrency} -> ${toCurrency} = ${rate}`)
      return rate
    }

    throw new Error('汇率数据格式错误')
  } catch (error) {
    console.error('[汇率] 获取失败:', error.message)
    
    // 返回备用汇率（近期参考值）
    const fallbackRates = {
      'EUR': 7.65,  // 欧元兑人民币
      'USD': 7.10,  // 美元兑人民币
      'GBP': 8.90,  // 英镑兑人民币
      'JPY': 0.047, // 日元兑人民币
      'HKD': 0.91   // 港币兑人民币
    }
    
    const fallback = fallbackRates[fromCurrency] || 1
    console.log(`[汇率] 使用备用汇率: ${fromCurrency} -> ${toCurrency} = ${fallback}`)
    return fallback
  }
}

/**
 * 获取多种货币的汇率
 * @param {string[]} currencies - 货币列表
 * @returns {Promise<Object>} 汇率映射
 */
export async function getMultipleRates(currencies = ['EUR', 'USD', 'GBP']) {
  const rates = {}
  
  for (const currency of currencies) {
    try {
      rates[currency] = await getBOCExchangeRate(currency, 'CNY')
    } catch (error) {
      console.error(`获取 ${currency} 汇率失败:`, error.message)
      rates[currency] = 1
    }
  }
  
  return rates
}

/**
 * 清除汇率缓存
 */
export function clearRateCache() {
  rateCache = { hourKey: null, rates: {} }
  console.log('[汇率] 缓存已清除')
}

export default {
  getBOCExchangeRate,
  getMultipleRates,
  clearRateCache
}
