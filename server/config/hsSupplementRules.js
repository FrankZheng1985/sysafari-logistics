/**
 * HS编码智能补充规则配置
 * 
 * 根据HS编码前缀自动判断：
 * 1. 是否需要补充材质 (needMaterial)
 * 2. 默认单位 (defaultUnit)
 * 3. 默认单位代码 (defaultUnitCode)
 * 
 * HS编码章节参考：
 * 01-05章：动物及动物产品
 * 06-14章：植物产品
 * 15章：动植物油脂
 * 16-24章：食品、饮料、烟草
 * 25-27章：矿产品
 * 28-38章：化工产品
 * 39-40章：塑料、橡胶
 * 41-43章：皮革、毛皮
 * 44-46章：木及木制品
 * 47-49章：纸浆、纸及制品
 * 50-63章：纺织品
 * 64-67章：鞋帽伞等
 * 68-70章：石料、陶瓷、玻璃
 * 71章：珠宝
 * 72-83章：贱金属及制品
 * 84-85章：机电产品
 * 86-89章：车辆、船舶、航空器
 * 90-92章：光学、医疗、钟表、乐器
 * 93章：武器弹药
 * 94-96章：家具、玩具、杂项
 * 97章：艺术品
 */

// 不需要材质的HS编码前缀（章节）
// 这些是天然产品、食品、化学品等，材质概念不适用
const NO_MATERIAL_CHAPTERS = [
  '01', // 活动物
  '02', // 肉及食用杂碎
  '03', // 鱼、甲壳动物
  '04', // 乳品、蛋品、蜂蜜
  '05', // 其他动物产品
  '06', // 活植物
  '07', // 食用蔬菜
  '08', // 食用水果
  '09', // 咖啡、茶
  '10', // 谷物
  '11', // 制粉工业产品
  '12', // 油籽、药用植物
  '13', // 树脂及植物液汁
  '14', // 编结用植物材料
  '15', // 动植物油脂
  '16', // 肉、鱼制品
  '17', // 糖及糖食
  '18', // 可可及制品
  '19', // 谷物、粮食制品
  '20', // 蔬菜、水果制品
  '21', // 杂项食品
  '22', // 饮料、酒
  '23', // 食品工业残渣
  '24', // 烟草及制品
  '25', // 盐、硫�ite、土石
  '26', // 矿�ite、�ite渣
  '27', // 矿物燃料、油类
  '28', // 无机化学品
  '29', // 有机化学品
  '30', // 药品
  '31', // 肥料
  '32', // 染料、颜料
  '33', // 精油、化妆品
  '34', // 肥皂、蜡
  '35', // 蛋白类物质、胶
  '36', // 炸药、火柴
  '37', // 照相、电影用品
  '38', // 杂项化学产品
]

// 默认单位规则（按HS编码前缀）
const DEFAULT_UNITS = {
  // 01章：活动物
  '0101': { unit: '匹', unitCode: 'NAR', description: '马、驴' },
  '0102': { unit: '头', unitCode: 'NAR', description: '牛' },
  '0103': { unit: '头', unitCode: 'NAR', description: '猪' },
  '0104': { unit: '只', unitCode: 'NAR', description: '绵羊、山羊' },
  '0105': { unit: '只', unitCode: 'NAR', description: '家禽' },
  '0106': { unit: '只', unitCode: 'NAR', description: '其他活动物' },
  '01': { unit: '只', unitCode: 'NAR', description: '活动物（默认）' },
  
  // 02章：肉类 - 按重量
  '02': { unit: '千克', unitCode: 'KGM', description: '肉类' },
  
  // 03章：鱼类 - 按重量
  '03': { unit: '千克', unitCode: 'KGM', description: '鱼类、甲壳动物' },
  
  // 04章：乳品蛋品
  '0407': { unit: '个', unitCode: 'NAR', description: '鸡蛋（带壳）' },
  '04': { unit: '千克', unitCode: 'KGM', description: '乳品（默认）' },
  
  // 05-24章：农产品、食品 - 大部分按重量
  '05': { unit: '千克', unitCode: 'KGM', description: '动物产品' },
  '06': { unit: '株', unitCode: 'NAR', description: '活植物' },
  '07': { unit: '千克', unitCode: 'KGM', description: '蔬菜' },
  '08': { unit: '千克', unitCode: 'KGM', description: '水果' },
  '09': { unit: '千克', unitCode: 'KGM', description: '咖啡茶' },
  '10': { unit: '千克', unitCode: 'KGM', description: '谷物' },
  '11': { unit: '千克', unitCode: 'KGM', description: '面粉' },
  '12': { unit: '千克', unitCode: 'KGM', description: '油籽' },
  '13': { unit: '千克', unitCode: 'KGM', description: '树脂' },
  '14': { unit: '千克', unitCode: 'KGM', description: '编结材料' },
  '15': { unit: '千克', unitCode: 'KGM', description: '油脂' },
  '16': { unit: '千克', unitCode: 'KGM', description: '肉鱼制品' },
  '17': { unit: '千克', unitCode: 'KGM', description: '糖' },
  '18': { unit: '千克', unitCode: 'KGM', description: '可可' },
  '19': { unit: '千克', unitCode: 'KGM', description: '谷物制品' },
  '20': { unit: '千克', unitCode: 'KGM', description: '蔬果制品' },
  '21': { unit: '千克', unitCode: 'KGM', description: '食品' },
  '22': { unit: '升', unitCode: 'LTR', description: '饮料' },
  '23': { unit: '千克', unitCode: 'KGM', description: '饲料' },
  '24': { unit: '千克', unitCode: 'KGM', description: '烟草' },
  
  // 25-27章：矿产品
  '25': { unit: '千克', unitCode: 'KGM', description: '矿产品' },
  '26': { unit: '千克', unitCode: 'KGM', description: '矿砂' },
  '27': { unit: '千克', unitCode: 'KGM', description: '燃料油' },
  
  // 28-38章：化工产品
  '28': { unit: '千克', unitCode: 'KGM', description: '无机化学品' },
  '29': { unit: '千克', unitCode: 'KGM', description: '有机化学品' },
  '30': { unit: '千克', unitCode: 'KGM', description: '药品' },
  '31': { unit: '千克', unitCode: 'KGM', description: '肥料' },
  '32': { unit: '千克', unitCode: 'KGM', description: '染料' },
  '33': { unit: '千克', unitCode: 'KGM', description: '化妆品' },
  '34': { unit: '千克', unitCode: 'KGM', description: '肥皂' },
  '35': { unit: '千克', unitCode: 'KGM', description: '胶类' },
  '36': { unit: '千克', unitCode: 'KGM', description: '炸药' },
  '37': { unit: '千克', unitCode: 'KGM', description: '照相用品' },
  '38': { unit: '千克', unitCode: 'KGM', description: '化学品' },
  
  // 需要材质的章节 - 按件/个计数
  '39': { unit: '千克', unitCode: 'KGM', description: '塑料制品' },
  '40': { unit: '千克', unitCode: 'KGM', description: '橡胶制品' },
  '41': { unit: '张', unitCode: 'NAR', description: '皮革' },
  '42': { unit: '个', unitCode: 'NAR', description: '皮革制品' },
  '43': { unit: '件', unitCode: 'NAR', description: '毛皮' },
  '44': { unit: '立方米', unitCode: 'MTQ', description: '木材' },
  '45': { unit: '千克', unitCode: 'KGM', description: '软木' },
  '46': { unit: '件', unitCode: 'NAR', description: '编结品' },
  '47': { unit: '千克', unitCode: 'KGM', description: '纸浆' },
  '48': { unit: '千克', unitCode: 'KGM', description: '纸' },
  '49': { unit: '件', unitCode: 'NAR', description: '书籍印刷品' },
  
  // 50-63章：纺织品
  '50': { unit: '千克', unitCode: 'KGM', description: '丝' },
  '51': { unit: '千克', unitCode: 'KGM', description: '羊毛' },
  '52': { unit: '千克', unitCode: 'KGM', description: '棉' },
  '53': { unit: '千克', unitCode: 'KGM', description: '麻' },
  '54': { unit: '千克', unitCode: 'KGM', description: '人造纤维' },
  '55': { unit: '千克', unitCode: 'KGM', description: '人造短纤' },
  '56': { unit: '千克', unitCode: 'KGM', description: '絮胎' },
  '57': { unit: '平方米', unitCode: 'MTK', description: '地毯' },
  '58': { unit: '米', unitCode: 'MTR', description: '特种织物' },
  '59': { unit: '米', unitCode: 'MTR', description: '涂层织物' },
  '60': { unit: '千克', unitCode: 'KGM', description: '针织物' },
  '61': { unit: '件', unitCode: 'NAR', description: '针织服装' },
  '62': { unit: '件', unitCode: 'NAR', description: '梭织服装' },
  '63': { unit: '件', unitCode: 'NAR', description: '纺织制成品' },
  
  // 64-67章：鞋帽等
  '64': { unit: '双', unitCode: 'PR', description: '鞋靴' },
  '65': { unit: '个', unitCode: 'NAR', description: '帽类' },
  '66': { unit: '把', unitCode: 'NAR', description: '雨伞拐杖' },
  '67': { unit: '件', unitCode: 'NAR', description: '羽毛制品' },
  
  // 68-70章：石料、陶瓷、玻璃
  '68': { unit: '千克', unitCode: 'KGM', description: '石料制品' },
  '69': { unit: '件', unitCode: 'NAR', description: '陶瓷' },
  '70': { unit: '千克', unitCode: 'KGM', description: '玻璃' },
  
  // 71章：珠宝
  '71': { unit: '克', unitCode: 'GRM', description: '珠宝' },
  
  // 72-83章：金属制品
  '72': { unit: '千克', unitCode: 'KGM', description: '钢铁' },
  '73': { unit: '千克', unitCode: 'KGM', description: '钢铁制品' },
  '74': { unit: '千克', unitCode: 'KGM', description: '铜' },
  '75': { unit: '千克', unitCode: 'KGM', description: '镍' },
  '76': { unit: '千克', unitCode: 'KGM', description: '铝' },
  '78': { unit: '千克', unitCode: 'KGM', description: '铅' },
  '79': { unit: '千克', unitCode: 'KGM', description: '锌' },
  '80': { unit: '千克', unitCode: 'KGM', description: '锡' },
  '81': { unit: '千克', unitCode: 'KGM', description: '其他金属' },
  '82': { unit: '件', unitCode: 'NAR', description: '工具' },
  '83': { unit: '件', unitCode: 'NAR', description: '金属杂品' },
  
  // 84-85章：机电产品
  '84': { unit: '台', unitCode: 'NAR', description: '机械设备' },
  '85': { unit: '个', unitCode: 'NAR', description: '电气设备' },
  
  // 86-89章：交通运输
  '86': { unit: '辆', unitCode: 'NAR', description: '铁道车辆' },
  '87': { unit: '辆', unitCode: 'NAR', description: '车辆' },
  '88': { unit: '架', unitCode: 'NAR', description: '航空器' },
  '89': { unit: '艘', unitCode: 'NAR', description: '船舶' },
  
  // 90-92章：精密仪器
  '90': { unit: '个', unitCode: 'NAR', description: '光学仪器' },
  '91': { unit: '个', unitCode: 'NAR', description: '钟表' },
  '92': { unit: '件', unitCode: 'NAR', description: '乐器' },
  
  // 93章：武器
  '93': { unit: '支', unitCode: 'NAR', description: '武器' },
  
  // 94-96章：杂项
  '94': { unit: '件', unitCode: 'NAR', description: '家具' },
  '95': { unit: '个', unitCode: 'NAR', description: '玩具' },
  '96': { unit: '件', unitCode: 'NAR', description: '杂项制品' },
  
  // 97章：艺术品
  '97': { unit: '件', unitCode: 'NAR', description: '艺术品' },
}

// 需要材质的章节（工业制品等）
const NEED_MATERIAL_CHAPTERS = [
  '39', // 塑料及制品 - 需要：塑料/PVC/PP/PE等
  '40', // 橡胶及制品 - 需要：天然橡胶/合成橡胶等
  '41', // 皮革 - 需要：牛皮/羊皮等
  '42', // 皮革制品 - 需要：真皮/人造革等
  '43', // 毛皮 - 需要：狐皮/貂皮等
  '44', // 木及制品 - 需要：松木/橡木等
  '45', // 软木 - 软木
  '46', // 编结品 - 需要：藤/竹等
  '47', // 纸浆 - 木浆/竹浆等
  '48', // 纸 - 需要：纸浆类型
  '50', // 丝 - 蚕丝
  '51', // 羊毛 - 羊毛/羊绒
  '52', // 棉 - 棉
  '53', // 麻 - 亚麻/苎麻
  '54', // 人造纤维长丝 - 涤纶/锦纶等
  '55', // 人造纤维短纤 - 涤纶/锦纶等
  '56', // 絮胎 - 材质
  '57', // 地毯 - 羊毛/化纤等
  '58', // 特种织物 - 材质
  '59', // 涂层织物 - 材质
  '60', // 针织物 - 棉/涤纶等
  '61', // 针织服装 - 棉/涤纶等
  '62', // 梭织服装 - 棉/涤纶等
  '63', // 纺织制成品 - 材质
  '64', // 鞋靴 - 皮革/布/塑料等
  '65', // 帽类 - 材质
  '66', // 雨伞 - 材质
  '67', // 羽毛制品 - 羽毛/人造
  '68', // 石料制品 - 大理石/花岗岩等
  '69', // 陶瓷 - 陶/瓷
  '70', // 玻璃 - 玻璃类型
  '71', // 珠宝 - 金/银/铂等
  '72', // 钢铁 - 碳钢/不锈钢等
  '73', // 钢铁制品 - 碳钢/不锈钢等
  '74', // 铜 - 铜/黄铜等
  '75', // 镍 - 镍
  '76', // 铝 - 铝/铝合金
  '78', // 铅 - 铅
  '79', // 锌 - 锌
  '80', // 锡 - 锡
  '81', // 其他贱金属 - 具体金属
  '82', // 工具 - 钢/合金等
  '83', // 金属杂品 - 材质
  '84', // 机械设备 - 金属/塑料等
  '85', // 电气设备 - 材质
  '86', // 铁道车辆 - 金属
  '87', // 车辆 - 金属
  '88', // 航空器 - 金属/复合材料
  '89', // 船舶 - 金属/玻璃钢
  '90', // 光学仪器 - 玻璃/金属等
  '91', // 钟表 - 金属/塑料等
  '92', // 乐器 - 木/金属等
  '93', // 武器 - 金属
  '94', // 家具 - 木/金属/塑料等
  '95', // 玩具 - 塑料/布等
  '96', // 杂项 - 材质
  '97', // 艺术品 - 材质
]

/**
 * 获取HS编码的补充规则
 * @param {string} hsCode - HS编码
 * @returns {Object} 规则对象
 */
export function getSupplementRule(hsCode) {
  if (!hsCode || hsCode.length < 2) {
    return { needMaterial: true, defaultUnit: null, defaultUnitCode: null }
  }
  
  const chapter = hsCode.substring(0, 2)
  const prefix4 = hsCode.substring(0, 4)
  
  // 判断是否需要材质
  const needMaterial = !NO_MATERIAL_CHAPTERS.includes(chapter)
  
  // 获取默认单位（优先匹配4位前缀，再匹配2位章节）
  let unitInfo = DEFAULT_UNITS[prefix4] || DEFAULT_UNITS[chapter]
  
  return {
    needMaterial,
    defaultUnit: unitInfo?.unit || null,
    defaultUnitCode: unitInfo?.unitCode || null,
    description: unitInfo?.description || null,
    chapter,
    chapterName: getChapterName(chapter)
  }
}

/**
 * 获取章节名称
 */
function getChapterName(chapter) {
  const names = {
    '01': '活动物',
    '02': '肉及食用杂碎',
    '03': '鱼、甲壳动物',
    '04': '乳品、蛋品',
    '05': '其他动物产品',
    '06': '活植物',
    '07': '食用蔬菜',
    '08': '食用水果',
    '09': '咖啡、茶',
    '10': '谷物',
    '11': '制粉产品',
    '12': '油籽',
    '13': '树脂',
    '14': '编结材料',
    '15': '动植物油脂',
    '16': '肉鱼制品',
    '17': '糖及糖食',
    '18': '可可及制品',
    '19': '谷物制品',
    '20': '蔬果制品',
    '21': '杂项食品',
    '22': '饮料酒',
    '23': '食品残渣',
    '24': '烟草',
    '25': '盐、�ite、土石',
    '26': '矿砂',
    '27': '矿物燃料',
    '28': '无机化学品',
    '29': '有机化学品',
    '30': '药品',
    '31': '肥料',
    '32': '染料颜料',
    '33': '精油化妆品',
    '34': '肥皂蜡',
    '35': '蛋白胶',
    '36': '炸药',
    '37': '照相用品',
    '38': '化学品',
    '39': '塑料及制品',
    '40': '橡胶及制品',
    '41': '皮革',
    '42': '皮革制品',
    '43': '毛皮',
    '44': '木及制品',
    '45': '软木',
    '46': '编结品',
    '47': '纸浆',
    '48': '纸及纸板',
    '49': '书籍印刷品',
    '50': '蚕丝',
    '51': '羊毛',
    '52': '棉花',
    '53': '麻类纤维',
    '54': '人造纤维长丝',
    '55': '人造纤维短纤',
    '56': '絮胎毡呢',
    '57': '地毯',
    '58': '特种织物',
    '59': '涂层织物',
    '60': '针织物',
    '61': '针织服装',
    '62': '非针织服装',
    '63': '纺织制成品',
    '64': '鞋靴',
    '65': '帽类',
    '66': '雨伞拐杖',
    '67': '羽毛制品',
    '68': '石料制品',
    '69': '陶瓷',
    '70': '玻璃',
    '71': '珠宝',
    '72': '钢铁',
    '73': '钢铁制品',
    '74': '铜及制品',
    '75': '镍及制品',
    '76': '铝及制品',
    '78': '铅及制品',
    '79': '锌及制品',
    '80': '锡及制品',
    '81': '其他贱金属',
    '82': '工具',
    '83': '金属杂品',
    '84': '机械设备',
    '85': '电气设备',
    '86': '铁道车辆',
    '87': '车辆及零件',
    '88': '航空器',
    '89': '船舶',
    '90': '光学医疗仪器',
    '91': '钟表',
    '92': '乐器',
    '93': '武器弹药',
    '94': '家具寝具',
    '95': '玩具游戏品',
    '96': '杂项制品',
    '97': '艺术品收藏品',
  }
  return names[chapter] || `第${chapter}章`
}

/**
 * 批量应用智能补充规则
 * @param {Array} items - 待补充的数据项
 * @returns {Object} 分类结果
 */
export function categorizeSupplementItems(items) {
  const result = {
    // 可以自动补充的（不需要材质，有默认单位）
    autoFillable: [],
    // 只需要补充材质的（单位可自动填充）
    needMaterialOnly: [],
    // 只需要补充单位的（不需要材质）
    needUnitOnly: [],
    // 需要完全手动补充的
    needManual: [],
  }
  
  for (const item of items) {
    const rule = getSupplementRule(item.hsCode)
    const hasMaterial = item.material && item.material.trim()
    const hasUnit = item.unitName && item.unitName.trim()
    
    if (!rule.needMaterial && rule.defaultUnit) {
      // 不需要材质，且有默认单位 -> 可以自动填充
      if (!hasUnit) {
        result.autoFillable.push({
          ...item,
          suggestedUnit: rule.defaultUnit,
          suggestedUnitCode: rule.defaultUnitCode,
          rule
        })
      }
    } else if (!rule.needMaterial && !hasUnit) {
      // 不需要材质，但没有默认单位
      result.needUnitOnly.push({ ...item, rule })
    } else if (rule.needMaterial && !hasMaterial && hasUnit) {
      // 需要材质但没有，单位已有
      result.needMaterialOnly.push({ ...item, rule })
    } else if (rule.needMaterial && !hasMaterial && !hasUnit) {
      // 需要材质，且没有单位
      if (rule.defaultUnit) {
        result.needMaterialOnly.push({
          ...item,
          suggestedUnit: rule.defaultUnit,
          suggestedUnitCode: rule.defaultUnitCode,
          rule
        })
      } else {
        result.needManual.push({ ...item, rule })
      }
    } else {
      result.needManual.push({ ...item, rule })
    }
  }
  
  return result
}

export default {
  getSupplementRule,
  categorizeSupplementItems,
  NO_MATERIAL_CHAPTERS,
  NEED_MATERIAL_CHAPTERS,
  DEFAULT_UNITS
}

