/**
 * Google 翻译工具函数
 * 使用免费的 Google Translate API
 */

/**
 * 使用 Google 翻译 API 翻译文本
 * @param {string} text - 要翻译的文本
 * @param {string} from - 源语言 (默认: 'zh-CN')
 * @param {string} to - 目标语言 (默认: 'en')
 * @returns {Promise<string>} - 翻译后的文本
 */
export async function translateText(text, from = 'zh-CN', to = 'en') {
  if (!text || !text.trim()) {
    return ''
  }

  try {
    // 使用免费的 Google Translate API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`翻译请求失败: ${response.status}`)
    }

    const data = await response.json()
    
    // 解析返回的数据结构
    // 返回格式: [[["translated text","original text",null,null,10]],null,"zh-CN",...]
    if (data && data[0] && Array.isArray(data[0])) {
      const translatedParts = data[0]
        .filter(part => part && part[0])
        .map(part => part[0])
      return translatedParts.join('')
    }

    return text // 翻译失败时返回原文
  } catch (error) {
    console.error('[翻译错误]', error.message)
    return text // 出错时返回原文
  }
}

/**
 * 批量翻译文本数组
 * @param {string[]} texts - 要翻译的文本数组
 * @param {string} from - 源语言 (默认: 'zh-CN')
 * @param {string} to - 目标语言 (默认: 'en')
 * @returns {Promise<string[]>} - 翻译后的文本数组
 */
export async function translateBatch(texts, from = 'zh-CN', to = 'en') {
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return []
  }

  const results = []
  for (const text of texts) {
    const translated = await translateText(text, from, to)
    results.push(translated)
    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  return results
}

/**
 * 常用费用名称的预设翻译映射（作为后备）
 */
export const FEE_NAME_TRANSLATIONS = {
  // 运输相关
  '海运费': 'Ocean Freight',
  '空运费': 'Air Freight',
  '陆运费': 'Land Freight',
  '铁路运费': 'Rail Freight',
  '拖车费': 'Trucking Fee',
  '派送费': 'Delivery Fee',
  '派送费-标准': 'Standard Delivery Fee',
  '派送费-偏远': 'Remote Delivery Fee',
  '卡车停靠费': 'Truck Parking Fee',
  '卡车等待费': 'Truck Waiting Fee',
  '压夜费': 'Overnight Fee',
  
  // 港口相关
  '港口费': 'Port Charges',
  '码头费': 'Terminal Handling Charge',
  '堆场费': 'Terminal Handling Charge',
  '装卸费': 'Loading/Unloading Fee',
  '仓储费': 'Warehousing Fee',
  '滞港费': 'Demurrage',
  '滞箱费': 'Detention',
  
  // 报关相关
  '报关费': 'Customs Declaration Fee',
  '清关费': 'Customs Clearance Fee',
  '查验费': 'Inspection Fee',
  '熏蒸费': 'Fumigation Fee',
  
  // 文件相关
  '文件费': 'Documentation Fee',
  '提单费': 'Bill of Lading Fee',
  '提单管理费': 'B/L Management Fee',
  'T1转关费': 'T1 Transit Fee',
  
  // 船公司相关
  '船公司运费': 'Carrier Freight',
  '订舱费': 'Booking Fee',
  '改单费': 'Amendment Fee',
  
  // 保险相关
  '保险费': 'Insurance Fee',
  '货物保险': 'Cargo Insurance',
  
  // 其他
  '手续费': 'Handling Fee',
  '代理费': 'Agency Fee',
  '服务费': 'Service Charge',
  '管理费': 'Management Fee',
  '订单取消费': 'Cancellation Fee',
  '杂费': 'Miscellaneous Fee',
  '其他费用': 'Other Charges'
}

/**
 * 获取费用名称的英文翻译（优先使用预设映射，否则调用API翻译）
 * @param {string} chineseName - 中文费用名称
 * @returns {Promise<string>} - 英文费用名称
 */
export async function translateFeeName(chineseName) {
  if (!chineseName) return ''
  
  // 先查找预设映射
  const preset = FEE_NAME_TRANSLATIONS[chineseName]
  if (preset) {
    return preset
  }
  
  // 否则调用 API 翻译
  return await translateText(chineseName, 'zh-CN', 'en')
}

export default {
  translateText,
  translateBatch,
  translateFeeName,
  FEE_NAME_TRANSLATIONS
}
