/**
 * 贸易措施翻译映射
 * 常用的措施类型和地理区域的英中翻译
 */

// 措施类型翻译映射
export const MEASURE_TYPE_TRANSLATIONS = {
  // 关税类型
  'Third country duty': '第三国关税',
  'Tariff preference': '关税优惠',
  'Preferential tariff': '优惠关税',
  'Autonomous tariff suspension': '自主关税暂停',
  'Autonomous end use': '自主最终用途',
  'End use': '最终用途',
  'Airworthiness tariff suspension': '适航性关税暂停',
  'Erga omnes duty': '普遍适用关税',
  'Outward processing tariff relief': '外发加工关税减免',
  'Inward processing tariff relief': '内向加工关税减免',
  'Processing under customs control': '海关监管下加工',
  
  // 反倾销/反补贴
  'Anti-dumping duty': '反倾销税',
  'Provisional anti-dumping duty': '临时反倾销税',
  'Definitive anti-dumping duty': '最终反倾销税',
  'Countervailing duty': '反补贴税',
  'Provisional countervailing duty': '临时反补贴税',
  'Definitive countervailing duty': '最终反补贴税',
  
  // VAT/增值税
  'VAT': '增值税',
  'Standard rate of VAT': '标准增值税率',
  'Reduced rate of VAT': '减免增值税率',
  'Third country standard duty': '第三国标准关税',
  
  // 许可证要求
  'Import licence': '进口许可证',
  'Export licence': '出口许可证',
  'Licence required': '需要许可证',
  'Certificate required': '需要证书',
  
  // 配额
  'Tariff quota': '关税配额',
  'Quota': '配额',
  'Ceiling': '上限',
  'Tariff rate quota': '关税率配额',
  
  // 禁止
  'Import prohibition': '进口禁令',
  'Export prohibition': '出口禁令',
  'Prohibition': '禁止',
  
  // SPS/技术壁垒
  'SPS': '卫生与植物检疫',
  'Sanitary and phytosanitary': '卫生与植物检疫',
  'Technical barriers': '技术壁垒',
  'Health certificate': '健康证书',
  'Phytosanitary certificate': '植物检疫证书',
  
  // 监控
  'Import surveillance': '进口监控',
  'Export surveillance': '出口监控',
  'Statistical surveillance': '统计监控',
  
  // 其他
  'Duty': '关税',
  'Tax': '税',
  'Excise': '消费税',
  'Additional duty': '附加关税',
  'Supplementary duty': '补充关税',
  'Unknown': '未知措施',
  'Measure': '措施'
}

// 地理区域翻译映射
export const GEOGRAPHICAL_AREA_TRANSLATIONS = {
  // 主要经济体/国家
  'ERGA OMNES': '所有国家（普遍适用）',
  'European Union': '欧盟',
  'European Economic Area': '欧洲经济区',
  'European Union - intra EU': '欧盟内部',
  'China': '中国',
  'United States': '美国',
  'Japan': '日本',
  'South Korea': '韩国',
  'Taiwan': '台湾',
  'Hong Kong': '香港',
  'Macao': '澳门',
  'Russia': '俄罗斯',
  'India': '印度',
  'Brazil': '巴西',
  'Mexico': '墨西哥',
  'Canada': '加拿大',
  'Australia': '澳大利亚',
  'New Zealand': '新西兰',
  'United Kingdom': '英国',
  'Switzerland': '瑞士',
  'Norway': '挪威',
  
  // 贸易协定/区域组织
  'GSP': '普惠制',
  'GSP+': '普惠制增强',
  'GSP - General arrangement': '普惠制 - 一般安排',
  'GSP - Special incentive arrangement': '普惠制 - 特殊激励安排',
  'GSP - Everything But Arms': '普惠制 - 除武器外一切',
  'Everything But Arms': '除武器外一切（最不发达国家）',
  'EBA': '除武器外一切',
  'GSP-EBA': '普惠制 - 除武器外一切',
  'GSP-EBA (Special arrangement for the least-developed countries - Everything But Arms)': '普惠制 - 除武器外一切（最不发达国家特别安排）',
  'SADC': '南部非洲发展共同体',
  'SADC EPA': '南部非洲发展共同体经济伙伴协定',
  'EPA': '经济伙伴协定',
  'EFTA': '欧洲自由贸易联盟',
  'ASEAN': '东盟',
  'MERCOSUR': '南方共同市场',
  'Andean Community': '安第斯共同体',
  'CARIFORUM': '加勒比论坛',
  'ACP': '非加太国家',
  'OCT': '海外国家和领土',
  'CETA': '加欧全面经济贸易协定',
  
  // 非洲地区
  'African countries': '非洲国家',
  'Eastern and Southern Africa': '东非和南部非洲',
  'Eastern and Southern Africa States': '东非和南部非洲国家',
  'West Africa': '西非',
  'Central Africa': '中非',
  'East African Community': '东非共同体',
  'South Africa': '南非',
  'Egypt': '埃及',
  'Morocco': '摩洛哥',
  'Tunisia': '突尼斯',
  'Algeria': '阿尔及利亚',
  
  // 中东/亚洲地区
  'Turkey': '土耳其',
  'Israel': '以色列',
  'Jordan': '约旦',
  'Lebanon': '黎巴嫩',
  'Palestine': '巴勒斯坦',
  'Singapore': '新加坡',
  'Vietnam': '越南',
  'Malaysia': '马来西亚',
  'Thailand': '泰国',
  'Indonesia': '印度尼西亚',
  'Philippines': '菲律宾',
  'Pakistan': '巴基斯坦',
  'Bangladesh': '孟加拉国',
  'Sri Lanka': '斯里兰卡',
  
  // 拉丁美洲
  'Chile': '智利',
  'Peru': '秘鲁',
  'Colombia': '哥伦比亚',
  'Ecuador': '厄瓜多尔',
  'Central America': '中美洲',
  'Caribbean': '加勒比地区',
  
  // 特殊地区
  'Developing countries': '发展中国家',
  'Least developed countries': '最不发达国家',
  'LDC': '最不发达国家',
  'Third countries': '第三国',
  'All countries': '所有国家',
  
  // 其他
  'San Marino': '圣马力诺',
  'Andorra': '安道尔',
  'Monaco': '摩纳哥',
  'Vatican': '梵蒂冈'
}

/**
 * 获取措施类型的中文翻译
 * @param {string} type - 英文措施类型
 * @returns {string} 中文翻译
 */
export function translateMeasureType(type) {
  if (!type) return null
  
  // 先尝试精确匹配
  if (MEASURE_TYPE_TRANSLATIONS[type]) {
    return MEASURE_TYPE_TRANSLATIONS[type]
  }
  
  // 尝试模糊匹配
  const lowerType = type.toLowerCase()
  for (const [key, value] of Object.entries(MEASURE_TYPE_TRANSLATIONS)) {
    if (lowerType.includes(key.toLowerCase())) {
      return value
    }
  }
  
  return null
}

/**
 * 获取地理区域的中文翻译
 * @param {string} area - 英文地理区域
 * @returns {string} 中文翻译
 */
export function translateGeographicalArea(area) {
  if (!area) return null
  
  // 先尝试精确匹配
  if (GEOGRAPHICAL_AREA_TRANSLATIONS[area]) {
    return GEOGRAPHICAL_AREA_TRANSLATIONS[area]
  }
  
  // 尝试模糊匹配
  const lowerArea = area.toLowerCase()
  for (const [key, value] of Object.entries(GEOGRAPHICAL_AREA_TRANSLATIONS)) {
    if (lowerArea.includes(key.toLowerCase())) {
      return value
    }
  }
  
  return null
}

export default {
  MEASURE_TYPE_TRANSLATIONS,
  GEOGRAPHICAL_AREA_TRANSLATIONS,
  translateMeasureType,
  translateGeographicalArea
}

