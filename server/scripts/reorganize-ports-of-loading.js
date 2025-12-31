/**
 * 重新整理起运地数据脚本
 * 
 * 分类规则：
 * 1. 第一级：运输方式（海运、空运、铁运、卡车运输）
 * 2. 第二级：5大洲（亚洲、欧洲、非洲、美洲、大洋洲）
 * 
 * 具体数据要求：
 * - 海运：主要集装箱码头，带码头名（如南沙港、盐田港）
 * - 空运：货运机场名和城市名
 * - 铁路：有中欧班列的中国城市名
 * - 卡航：有发欧洲卡航的中国城市名
 */

import { getDatabase, isUsingPostgres } from '../config/database.js'

async function reorganizePortsOfLoading() {
  const db = getDatabase()
  const USE_POSTGRES = isUsingPostgres()
  
  console.log('开始重新整理起运地数据...')
  
  try {
    // 确保 continent 字段存在
    if (USE_POSTGRES) {
      try {
        await db.exec(`ALTER TABLE ports_of_loading ADD COLUMN IF NOT EXISTS continent TEXT`)
      } catch (err) {
        // 字段可能已存在，忽略
      }
    } else {
      try {
        db.exec(`ALTER TABLE ports_of_loading ADD COLUMN continent TEXT`)
      } catch (err) {
        // 字段可能已存在，忽略
      }
    }
    
    // 先清空现有数据（可选，根据实际情况决定）
    // await db.prepare('DELETE FROM ports_of_loading').run()
    
    // 准备插入/更新语句
    const checkStmt = db.prepare('SELECT id FROM ports_of_loading WHERE port_code = ?')
    const insertStmt = db.prepare(`
      INSERT INTO ports_of_loading (
        port_code, port_name_cn, port_name_en, country, country_code, city,
        transport_type, port_type, parent_port_code, continent, sort_order, status, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const updateStmt = db.prepare(`
      UPDATE ports_of_loading SET
        port_name_cn = ?,
        port_name_en = ?,
        country = ?,
        country_code = ?,
        city = ?,
        transport_type = ?,
        port_type = ?,
        parent_port_code = ?,
        continent = ?,
        sort_order = ?,
        status = ?,
        description = ?,
        updated_at = NOW()
      WHERE port_code = ?
    `)
    
    // 统一的插入/更新函数
    const upsertPort = async (portData) => {
      const existing = await checkStmt.get(portData.code)
      if (existing) {
        // 更新现有记录
        await updateStmt.run(
          portData.nameCn,
          portData.nameEn,
          portData.country,
          portData.countryCode,
          portData.city,
          portData.transportType,
          portData.portType,
          portData.parent,
          portData.continent,
          portData.sortOrder,
          portData.status,
          portData.description,
          portData.code
        )
      } else {
        // 插入新记录
        await insertStmt.run(
          portData.code,
          portData.nameCn,
          portData.nameEn,
          portData.country,
          portData.countryCode,
          portData.city,
          portData.transportType,
          portData.portType,
          portData.parent,
          portData.continent,
          portData.sortOrder,
          portData.status,
          portData.description
        )
      }
    }
    
    let sortOrder = 1
    
    // ==================== 海运 - 亚洲 ====================
    console.log('插入海运-亚洲数据...')
    
    // 中国主要集装箱码头
    const seaPortsAsia = [
      // 上海港及码头
      { code: 'CNSHA', nameCn: '上海港', nameEn: 'Shanghai Port', city: '上海', parent: null },
      { code: 'CNSHA-WGQ', nameCn: '外高桥码头', nameEn: 'Waigaoqiao Terminal', city: '上海', parent: 'CNSHA' },
      { code: 'CNSHA-YG', nameCn: '洋山港', nameEn: 'Yangshan Port', city: '上海', parent: 'CNSHA' },
      
      // 深圳港及码头
      { code: 'CNSZX', nameCn: '深圳港', nameEn: 'Shenzhen Port', city: '深圳', parent: null },
      { code: 'CNYTN', nameCn: '盐田港', nameEn: 'Yantian Port', city: '深圳', parent: 'CNSZX' },
      { code: 'CNSHE', nameCn: '蛇口港', nameEn: 'Shekou Port', city: '深圳', parent: 'CNSZX' },
      { code: 'CNCHI', nameCn: '赤湾港', nameEn: 'Chiwan Port', city: '深圳', parent: 'CNSZX' },
      { code: 'CNMCT', nameCn: '妈湾港', nameEn: 'Mawan Port', city: '深圳', parent: 'CNSZX' },
      
      // 广州港及码头
      { code: 'CNGZN', nameCn: '广州港', nameEn: 'Guangzhou Port', city: '广州', parent: null },
      { code: 'CNNSA', nameCn: '南沙港', nameEn: 'Nansha Port', city: '广州', parent: 'CNGZN' },
      { code: 'CNHUM', nameCn: '黄埔港', nameEn: 'Huangpu Port', city: '广州', parent: 'CNGZN' },
      
      // 宁波港及码头
      { code: 'CNNGB', nameCn: '宁波港', nameEn: 'Ningbo Port', city: '宁波', parent: null },
      { code: 'CNNGB-BZ', nameCn: '北仑港', nameEn: 'Beilun Port', city: '宁波', parent: 'CNNGB' },
      { code: 'CNNGB-ZH', nameCn: '镇海港', nameEn: 'Zhenhai Port', city: '宁波', parent: 'CNNGB' },
      
      // 青岛港及码头
      { code: 'CNQIN', nameCn: '青岛港', nameEn: 'Qingdao Port', city: '青岛', parent: null },
      { code: 'CNQIN-QD', nameCn: '前湾港', nameEn: 'Qianwan Port', city: '青岛', parent: 'CNQIN' },
      
      // 天津港及码头
      { code: 'CNTXG', nameCn: '天津港', nameEn: 'Tianjin Port', city: '天津', parent: null },
      { code: 'CNTXG-DG', nameCn: '东疆港', nameEn: 'Dongjiang Port', city: '天津', parent: 'CNTXG' },
      
      // 其他中国港口
      { code: 'CNXMN', nameCn: '厦门港', nameEn: 'Xiamen Port', city: '厦门', parent: null },
      { code: 'CNDLC', nameCn: '大连港', nameEn: 'Dalian Port', city: '大连', parent: null },
      { code: 'CNLYG', nameCn: '连云港', nameEn: 'Lianyungang Port', city: '连云港', parent: null },
      { code: 'CNFOC', nameCn: '福州港', nameEn: 'Fuzhou Port', city: '福州', parent: null },
      { code: 'CNZUH', nameCn: '珠海港', nameEn: 'Zhuhai Port', city: '珠海', parent: null },
      { code: 'CNHAK', nameCn: '海口港', nameEn: 'Haikou Port', city: '海口', parent: null },
      
      // 其他亚洲国家港口
      { code: 'SGSIN', nameCn: '新加坡港', nameEn: 'Singapore Port', country: '新加坡', countryCode: 'SG', city: '新加坡', parent: null },
      { code: 'KRINC', nameCn: '仁川港', nameEn: 'Incheon Port', country: '韩国', countryCode: 'KR', city: '仁川', parent: null },
      { code: 'KRBUS', nameCn: '釜山港', nameEn: 'Busan Port', country: '韩国', countryCode: 'KR', city: '釜山', parent: null },
      { code: 'JPTYO', nameCn: '东京港', nameEn: 'Tokyo Port', country: '日本', countryCode: 'JP', city: '东京', parent: null },
      { code: 'JPOSA', nameCn: '大阪港', nameEn: 'Osaka Port', country: '日本', countryCode: 'JP', city: '大阪', parent: null },
      { code: 'JPYOK', nameCn: '横滨港', nameEn: 'Yokohama Port', country: '日本', countryCode: 'JP', city: '横滨', parent: null },
      { code: 'THBKK', nameCn: '曼谷港', nameEn: 'Bangkok Port', country: '泰国', countryCode: 'TH', city: '曼谷', parent: null },
      { code: 'MYPNG', nameCn: '巴生港', nameEn: 'Port Klang', country: '马来西亚', countryCode: 'MY', city: '巴生', parent: null },
      { code: 'IDJKT', nameCn: '雅加达港', nameEn: 'Jakarta Port', country: '印度尼西亚', countryCode: 'ID', city: '雅加达', parent: null },
      { code: 'IDTPP', nameCn: '丹戎不碌港', nameEn: 'Tanjung Priok Port', country: '印度尼西亚', countryCode: 'ID', city: '雅加达', parent: null },
      { code: 'VNHPH', nameCn: '海防港', nameEn: 'Haiphong Port', country: '越南', countryCode: 'VN', city: '海防', parent: null },
      { code: 'VNHCM', nameCn: '胡志明港', nameEn: 'Ho Chi Minh Port', country: '越南', countryCode: 'VN', city: '胡志明市', parent: null },
      { code: 'PHMNL', nameCn: '马尼拉港', nameEn: 'Manila Port', country: '菲律宾', countryCode: 'PH', city: '马尼拉', parent: null },
      { code: 'INMUM', nameCn: '孟买港', nameEn: 'Mumbai Port', country: '印度', countryCode: 'IN', city: '孟买', parent: null },
      { code: 'INCHN', nameCn: '金奈港', nameEn: 'Chennai Port', country: '印度', countryCode: 'IN', city: '金奈', parent: null },
      { code: 'AEJEB', nameCn: '杰贝阿里港', nameEn: 'Jebel Ali Port', country: '阿联酋', countryCode: 'AE', city: '迪拜', parent: null },
      { code: 'AEDXB', nameCn: '迪拜港', nameEn: 'Dubai Port', country: '阿联酋', countryCode: 'AE', city: '迪拜', parent: null },
    ]
    
    for (const port of seaPortsAsia) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country || '中国',
        countryCode: port.countryCode || 'CN',
        city: port.city,
        transportType: 'sea',
        portType: port.parent ? 'terminal' : 'main',
        parent: port.parent,
        continent: '亚洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: port.parent ? `隶属于${port.parent}` : null
      })
    }
    
    // ==================== 海运 - 欧洲 ====================
    console.log('插入海运-欧洲数据...')
    
    const seaPortsEurope = [
      { code: 'NLRTM', nameCn: '鹿特丹港', nameEn: 'Rotterdam Port', country: '荷兰', countryCode: 'NL', city: '鹿特丹', parent: null },
      { code: 'BEANR', nameCn: '安特卫普港', nameEn: 'Antwerp Port', country: '比利时', countryCode: 'BE', city: '安特卫普', parent: null },
      { code: 'DEHAM', nameCn: '汉堡港', nameEn: 'Hamburg Port', country: '德国', countryCode: 'DE', city: '汉堡', parent: null },
      { code: 'DEBRE', nameCn: '不来梅港', nameEn: 'Bremerhaven Port', country: '德国', countryCode: 'DE', city: '不来梅', parent: null },
      { code: 'GBFEL', nameCn: '费利克斯托港', nameEn: 'Felixstowe Port', country: '英国', countryCode: 'GB', city: '费利克斯托', parent: null },
      { code: 'GBLON', nameCn: '伦敦港', nameEn: 'London Port', country: '英国', countryCode: 'GB', city: '伦敦', parent: null },
      { code: 'FRLEH', nameCn: '勒阿弗尔港', nameEn: 'Le Havre Port', country: '法国', countryCode: 'FR', city: '勒阿弗尔', parent: null },
      { code: 'ESVAL', nameCn: '瓦伦西亚港', nameEn: 'Valencia Port', country: '西班牙', countryCode: 'ES', city: '瓦伦西亚', parent: null },
      { code: 'ESBCN', nameCn: '巴塞罗那港', nameEn: 'Barcelona Port', country: '西班牙', countryCode: 'ES', city: '巴塞罗那', parent: null },
      { code: 'ITGOA', nameCn: '热那亚港', nameEn: 'Genoa Port', country: '意大利', countryCode: 'IT', city: '热那亚', parent: null },
      { code: 'ITNAP', nameCn: '那不勒斯港', nameEn: 'Naples Port', country: '意大利', countryCode: 'IT', city: '那不勒斯', parent: null },
      { code: 'GRPIR', nameCn: '比雷埃夫斯港', nameEn: 'Piraeus Port', country: '希腊', countryCode: 'GR', city: '比雷埃夫斯', parent: null },
      { code: 'PLGDN', nameCn: '格但斯克港', nameEn: 'Gdansk Port', country: '波兰', countryCode: 'PL', city: '格但斯克', parent: null },
    ]
    
    for (const port of seaPortsEurope) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'sea',
        portType: 'main',
        parent: null,
        continent: '欧洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 海运 - 美洲 ====================
    console.log('插入海运-美洲数据...')
    
    const seaPortsAmericas = [
      { code: 'USLAX', nameCn: '洛杉矶港', nameEn: 'Los Angeles Port', country: '美国', countryCode: 'US', city: '洛杉矶', parent: null },
      { code: 'USLGB', nameCn: '长滩港', nameEn: 'Long Beach Port', country: '美国', countryCode: 'US', city: '长滩', parent: null },
      { code: 'USNYC', nameCn: '纽约港', nameEn: 'New York Port', country: '美国', countryCode: 'US', city: '纽约', parent: null },
      { code: 'USSAV', nameCn: '萨凡纳港', nameEn: 'Savannah Port', country: '美国', countryCode: 'US', city: '萨凡纳', parent: null },
      { code: 'USCHS', nameCn: '查尔斯顿港', nameEn: 'Charleston Port', country: '美国', countryCode: 'US', city: '查尔斯顿', parent: null },
      { code: 'USMIA', nameCn: '迈阿密港', nameEn: 'Miami Port', country: '美国', countryCode: 'US', city: '迈阿密', parent: null },
      { code: 'CAVAN', nameCn: '温哥华港', nameEn: 'Vancouver Port', country: '加拿大', countryCode: 'CA', city: '温哥华', parent: null },
      { code: 'CAMTR', nameCn: '蒙特利尔港', nameEn: 'Montreal Port', country: '加拿大', countryCode: 'CA', city: '蒙特利尔', parent: null },
      { code: 'MXVER', nameCn: '韦拉克鲁斯港', nameEn: 'Veracruz Port', country: '墨西哥', countryCode: 'MX', city: '韦拉克鲁斯', parent: null },
      { code: 'BRSPA', nameCn: '圣保罗港', nameEn: 'Sao Paulo Port', country: '巴西', countryCode: 'BR', city: '圣保罗', parent: null },
      { code: 'BRRIO', nameCn: '里约热内卢港', nameEn: 'Rio de Janeiro Port', country: '巴西', countryCode: 'BR', city: '里约热内卢', parent: null },
      { code: 'ARSAB', nameCn: '布宜诺斯艾利斯港', nameEn: 'Buenos Aires Port', country: '阿根廷', countryCode: 'AR', city: '布宜诺斯艾利斯', parent: null },
    ]
    
    for (const port of seaPortsAmericas) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'sea',
        portType: 'main',
        parent: null,
        continent: '美洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 海运 - 非洲 ====================
    console.log('插入海运-非洲数据...')
    
    const seaPortsAfrica = [
      { code: 'ZADUR', nameCn: '德班港', nameEn: 'Durban Port', country: '南非', countryCode: 'ZA', city: '德班', parent: null },
      { code: 'ZACPT', nameCn: '开普敦港', nameEn: 'Cape Town Port', country: '南非', countryCode: 'ZA', city: '开普敦', parent: null },
      { code: 'EGALY', nameCn: '亚历山大港', nameEn: 'Alexandria Port', country: '埃及', countryCode: 'EG', city: '亚历山大', parent: null },
      { code: 'EGPSD', nameCn: '塞得港', nameEn: 'Port Said', country: '埃及', countryCode: 'EG', city: '塞得港', parent: null },
      { code: 'KENBO', nameCn: '蒙巴萨港', nameEn: 'Mombasa Port', country: '肯尼亚', countryCode: 'KE', city: '蒙巴萨', parent: null },
      { code: 'NGAPP', nameCn: '拉各斯港', nameEn: 'Lagos Port', country: '尼日利亚', countryCode: 'NG', city: '拉各斯', parent: null },
    ]
    
    for (const port of seaPortsAfrica) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'sea',
        portType: 'main',
        parent: null,
        continent: '非洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 海运 - 大洋洲 ====================
    console.log('插入海运-大洋洲数据...')
    
    const seaPortsOceania = [
      { code: 'AUSYD', nameCn: '悉尼港', nameEn: 'Sydney Port', country: '澳大利亚', countryCode: 'AU', city: '悉尼', parent: null },
      { code: 'AUMEL', nameCn: '墨尔本港', nameEn: 'Melbourne Port', country: '澳大利亚', countryCode: 'AU', city: '墨尔本', parent: null },
      { code: 'AUBRI', nameCn: '布里斯班港', nameEn: 'Brisbane Port', country: '澳大利亚', countryCode: 'AU', city: '布里斯班', parent: null },
      { code: 'NZAKL', nameCn: '奥克兰港', nameEn: 'Auckland Port', country: '新西兰', countryCode: 'NZ', city: '奥克兰', parent: null },
    ]
    
    for (const port of seaPortsOceania) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'sea',
        portType: 'main',
        parent: null,
        continent: '大洋洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 空运 - 亚洲 ====================
    console.log('插入空运-亚洲数据...')
    
    const airPortsAsia = [
      // 中国主要货运机场
      { code: 'CNPVG', nameCn: '上海浦东国际机场', nameEn: 'Shanghai Pudong International Airport', city: '上海', parent: null },
      { code: 'CNSHA', nameCn: '上海虹桥机场', nameEn: 'Shanghai Hongqiao Airport', city: '上海', parent: null },
      { code: 'CNPEK', nameCn: '北京首都国际机场', nameEn: 'Beijing Capital International Airport', city: '北京', parent: null },
      { code: 'CNPKX', nameCn: '北京大兴国际机场', nameEn: 'Beijing Daxing International Airport', city: '北京', parent: null },
      { code: 'CNCAN', nameCn: '广州白云国际机场', nameEn: 'Guangzhou Baiyun International Airport', city: '广州', parent: null },
      { code: 'CNSZX', nameCn: '深圳宝安国际机场', nameEn: 'Shenzhen Baoan International Airport', city: '深圳', parent: null },
      { code: 'CNCTU', nameCn: '成都双流国际机场', nameEn: 'Chengdu Shuangliu International Airport', city: '成都', parent: null },
      { code: 'CNTFU', nameCn: '成都天府国际机场', nameEn: 'Chengdu Tianfu International Airport', city: '成都', parent: null },
      { code: 'CNCKG', nameCn: '重庆江北国际机场', nameEn: 'Chongqing Jiangbei International Airport', city: '重庆', parent: null },
      { code: 'CNHGH', nameCn: '杭州萧山国际机场', nameEn: 'Hangzhou Xiaoshan International Airport', city: '杭州', parent: null },
      { code: 'CNXMN', nameCn: '厦门高崎国际机场', nameEn: 'Xiamen Gaoqi International Airport', city: '厦门', parent: null },
      { code: 'CNQIN', nameCn: '青岛流亭国际机场', nameEn: 'Qingdao Liuting International Airport', city: '青岛', parent: null },
      { code: 'CNXIY', nameCn: '西安咸阳国际机场', nameEn: 'Xi\'an Xianyang International Airport', city: '西安', parent: null },
      { code: 'CNWUH', nameCn: '武汉天河国际机场', nameEn: 'Wuhan Tianhe International Airport', city: '武汉', parent: null },
      { code: 'CNNKG', nameCn: '南京禄口国际机场', nameEn: 'Nanjing Lukou International Airport', city: '南京', parent: null },
      { code: 'CNTSN', nameCn: '天津滨海国际机场', nameEn: 'Tianjin Binhai International Airport', city: '天津', parent: null },
      { code: 'CNSHE', nameCn: '沈阳桃仙国际机场', nameEn: 'Shenyang Taoxian International Airport', city: '沈阳', parent: null },
      { code: 'CNHRB', nameCn: '哈尔滨太平国际机场', nameEn: 'Harbin Taiping International Airport', city: '哈尔滨', parent: null },
      { code: 'CNURC', nameCn: '乌鲁木齐地窝堡国际机场', nameEn: 'Urumqi Diwopu International Airport', city: '乌鲁木齐', parent: null },
      { code: 'CNKMG', nameCn: '昆明长水国际机场', nameEn: 'Kunming Changshui International Airport', city: '昆明', parent: null },
      
      // 其他亚洲国家机场
      { code: 'SGSIN', nameCn: '新加坡樟宜机场', nameEn: 'Singapore Changi Airport', country: '新加坡', countryCode: 'SG', city: '新加坡', parent: null },
      { code: 'KRINC', nameCn: '仁川国际机场', nameEn: 'Incheon International Airport', country: '韩国', countryCode: 'KR', city: '仁川', parent: null },
      { code: 'JPNDR', nameCn: '成田国际机场', nameEn: 'Narita International Airport', country: '日本', countryCode: 'JP', city: '东京', parent: null },
      { code: 'JPHND', nameCn: '羽田机场', nameEn: 'Haneda Airport', country: '日本', countryCode: 'JP', city: '东京', parent: null },
      { code: 'THBKK', nameCn: '素万那普国际机场', nameEn: 'Suvarnabhumi Airport', country: '泰国', countryCode: 'TH', city: '曼谷', parent: null },
      { code: 'MYPNG', nameCn: '吉隆坡国际机场', nameEn: 'Kuala Lumpur International Airport', country: '马来西亚', countryCode: 'MY', city: '吉隆坡', parent: null },
      { code: 'IDJKT', nameCn: '苏加诺-哈达国际机场', nameEn: 'Soekarno-Hatta International Airport', country: '印度尼西亚', countryCode: 'ID', city: '雅加达', parent: null },
      { code: 'VNHCM', nameCn: '新山一国际机场', nameEn: 'Tan Son Nhat International Airport', country: '越南', countryCode: 'VN', city: '胡志明市', parent: null },
      { code: 'PHMNL', nameCn: '尼诺·阿基诺国际机场', nameEn: 'Ninoy Aquino International Airport', country: '菲律宾', countryCode: 'PH', city: '马尼拉', parent: null },
      { code: 'INMUM', nameCn: '贾特拉帕蒂·希瓦吉国际机场', nameEn: 'Chhatrapati Shivaji International Airport', country: '印度', countryCode: 'IN', city: '孟买', parent: null },
      { code: 'INDEL', nameCn: '英迪拉·甘地国际机场', nameEn: 'Indira Gandhi International Airport', country: '印度', countryCode: 'IN', city: '新德里', parent: null },
      { code: 'AEDXB', nameCn: '迪拜国际机场', nameEn: 'Dubai International Airport', country: '阿联酋', countryCode: 'AE', city: '迪拜', parent: null },
      { code: 'AEDWC', nameCn: '阿勒马克图姆国际机场', nameEn: 'Al Maktoum International Airport', country: '阿联酋', countryCode: 'AE', city: '迪拜', parent: null },
    ]
    
    for (const port of airPortsAsia) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country || '中国',
        countryCode: port.countryCode || 'CN',
        city: port.city,
        transportType: 'air',
        portType: 'main',
        parent: null,
        continent: '亚洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 空运 - 欧洲 ====================
    console.log('插入空运-欧洲数据...')
    
    const airPortsEurope = [
      { code: 'NLAMS', nameCn: '阿姆斯特丹史基浦机场', nameEn: 'Amsterdam Schiphol Airport', country: '荷兰', countryCode: 'NL', city: '阿姆斯特丹', parent: null },
      { code: 'DEFRA', nameCn: '法兰克福机场', nameEn: 'Frankfurt Airport', country: '德国', countryCode: 'DE', city: '法兰克福', parent: null },
      { code: 'GBLHR', nameCn: '伦敦希思罗机场', nameEn: 'London Heathrow Airport', country: '英国', countryCode: 'GB', city: '伦敦', parent: null },
      { code: 'GBLGW', nameCn: '伦敦盖特威克机场', nameEn: 'London Gatwick Airport', country: '英国', countryCode: 'GB', city: '伦敦', parent: null },
      { code: 'FRCDG', nameCn: '巴黎戴高乐机场', nameEn: 'Paris Charles de Gaulle Airport', country: '法国', countryCode: 'FR', city: '巴黎', parent: null },
      { code: 'ESMAD', nameCn: '马德里巴拉哈斯机场', nameEn: 'Madrid Barajas Airport', country: '西班牙', countryCode: 'ES', city: '马德里', parent: null },
      { code: 'ITFCO', nameCn: '米兰马尔彭萨机场', nameEn: 'Milan Malpensa Airport', country: '意大利', countryCode: 'IT', city: '米兰', parent: null },
      { code: 'GRATH', nameCn: '雅典国际机场', nameEn: 'Athens International Airport', country: '希腊', countryCode: 'GR', city: '雅典', parent: null },
      { code: 'PLWAW', nameCn: '华沙肖邦机场', nameEn: 'Warsaw Chopin Airport', country: '波兰', countryCode: 'PL', city: '华沙', parent: null },
      { code: 'RUMSK', nameCn: '莫斯科谢列梅捷沃机场', nameEn: 'Moscow Sheremetyevo Airport', country: '俄罗斯', countryCode: 'RU', city: '莫斯科', parent: null },
    ]
    
    for (const port of airPortsEurope) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'air',
        portType: 'main',
        parent: null,
        continent: '欧洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 空运 - 美洲 ====================
    console.log('插入空运-美洲数据...')
    
    const airPortsAmericas = [
      { code: 'USLAX', nameCn: '洛杉矶国际机场', nameEn: 'Los Angeles International Airport', country: '美国', countryCode: 'US', city: '洛杉矶', parent: null },
      { code: 'USJFK', nameCn: '纽约肯尼迪国际机场', nameEn: 'New York JFK International Airport', country: '美国', countryCode: 'US', city: '纽约', parent: null },
      { code: 'USMIA', nameCn: '迈阿密国际机场', nameEn: 'Miami International Airport', country: '美国', countryCode: 'US', city: '迈阿密', parent: null },
      { code: 'USCHI', nameCn: '芝加哥奥黑尔国际机场', nameEn: 'Chicago O\'Hare International Airport', country: '美国', countryCode: 'US', city: '芝加哥', parent: null },
      { code: 'USATL', nameCn: '亚特兰大哈茨菲尔德-杰克逊国际机场', nameEn: 'Atlanta Hartsfield-Jackson International Airport', country: '美国', countryCode: 'US', city: '亚特兰大', parent: null },
      { code: 'CAYYZ', nameCn: '多伦多皮尔逊国际机场', nameEn: 'Toronto Pearson International Airport', country: '加拿大', countryCode: 'CA', city: '多伦多', parent: null },
      { code: 'BRGRU', nameCn: '圣保罗瓜鲁柳斯国际机场', nameEn: 'Sao Paulo Guarulhos International Airport', country: '巴西', countryCode: 'BR', city: '圣保罗', parent: null },
    ]
    
    for (const port of airPortsAmericas) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: port.country,
        countryCode: port.countryCode,
        city: port.city,
        transportType: 'air',
        portType: 'main',
        parent: null,
        continent: '美洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: null
      })
    }
    
    // ==================== 铁路 - 中欧班列（中国城市） ====================
    console.log('插入铁路-中欧班列数据...')
    
    const railPortsChina = [
      { code: 'CNXIA', nameCn: '西安国际港', nameEn: 'Xi\'an International Port', city: '西安', parent: null },
      { code: 'CNCGO', nameCn: '郑州圃田站', nameEn: 'Zhengzhou Putian Station', city: '郑州', parent: null },
      { code: 'CNCHG', nameCn: '重庆团结村站', nameEn: 'Chongqing Tuanjiecun Station', city: '重庆', parent: null },
      { code: 'CNCDG', nameCn: '成都城厢站', nameEn: 'Chengdu Chengxiang Station', city: '成都', parent: null },
      { code: 'CNURS', nameCn: '乌鲁木齐站', nameEn: 'Urumqi Station', city: '乌鲁木齐', parent: null },
      { code: 'CNYIW', nameCn: '义乌西站', nameEn: 'Yiwu West Station', city: '义乌', parent: null },
      { code: 'CNWUH', nameCn: '武汉吴家山站', nameEn: 'Wuhan Wujiashan Station', city: '武汉', parent: null },
      { code: 'CNSUZ', nameCn: '苏州西站', nameEn: 'Suzhou West Station', city: '苏州', parent: null },
      { code: 'CNHFE', nameCn: '合肥北站', nameEn: 'Hefei North Station', city: '合肥', parent: null },
      { code: 'CNLYG', nameCn: '连云港中哈物流基地', nameEn: 'Lianyungang China-Kazakhstan Logistics Base', city: '连云港', parent: null },
      { code: 'CNHGH', nameCn: '杭州白鹿塘站', nameEn: 'Hangzhou Bailutang Station', city: '杭州', parent: null },
      { code: 'CNJIN', nameCn: '金华站', nameEn: 'Jinhua Station', city: '金华', parent: null },
      { code: 'CNXMN', nameCn: '厦门前场站', nameEn: 'Xiamen Qianchang Station', city: '厦门', parent: null },
      { code: 'CNFOC', nameCn: '福州江阴港站', nameEn: 'Fuzhou Jiangyin Port Station', city: '福州', parent: null },
      { code: 'CNQIN', nameCn: '青岛胶州站', nameEn: 'Qingdao Jiaozhou Station', city: '青岛', parent: null },
      { code: 'CNTXG', nameCn: '天津新港站', nameEn: 'Tianjin New Port Station', city: '天津', parent: null },
      { code: 'CNHAR', nameCn: '哈尔滨站', nameEn: 'Harbin Station', city: '哈尔滨', parent: null },
      { code: 'CNCHC', nameCn: '长春站', nameEn: 'Changchun Station', city: '长春', parent: null },
      { code: 'CNSHE', nameCn: '沈阳站', nameEn: 'Shenyang Station', city: '沈阳', parent: null },
      { code: 'CNKMG', nameCn: '昆明王家营西站', nameEn: 'Kunming Wangjiaying West Station', city: '昆明', parent: null },
    ]
    
    for (const port of railPortsChina) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: '中国',
        countryCode: 'CN',
        city: port.city,
        transportType: 'rail',
        portType: 'main',
        parent: null,
        continent: '亚洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: '中欧班列站点'
      })
    }
    
    // ==================== 卡航 - 中国城市（有发欧洲卡航的） ====================
    console.log('插入卡航数据...')
    
    const truckPortsChina = [
      { code: 'CNXIA', nameCn: '西安', nameEn: 'Xi\'an', city: '西安', parent: null },
      { code: 'CNCGO', nameCn: '郑州', nameEn: 'Zhengzhou', city: '郑州', parent: null },
      { code: 'CNCHG', nameCn: '重庆', nameEn: 'Chongqing', city: '重庆', parent: null },
      { code: 'CNCDG', nameCn: '成都', nameEn: 'Chengdu', city: '成都', parent: null },
      { code: 'CNURS', nameCn: '乌鲁木齐', nameEn: 'Urumqi', city: '乌鲁木齐', parent: null },
      { code: 'CNYIW', nameCn: '义乌', nameEn: 'Yiwu', city: '义乌', parent: null },
      { code: 'CNWUH', nameCn: '武汉', nameEn: 'Wuhan', city: '武汉', parent: null },
      { code: 'CNSUZ', nameCn: '苏州', nameEn: 'Suzhou', city: '苏州', parent: null },
      { code: 'CNHFE', nameCn: '合肥', nameEn: 'Hefei', city: '合肥', parent: null },
      { code: 'CNHGH', nameCn: '杭州', nameEn: 'Hangzhou', city: '杭州', parent: null },
      { code: 'CNJIN', nameCn: '金华', nameEn: 'Jinhua', city: '金华', parent: null },
      { code: 'CNXMN', nameCn: '厦门', nameEn: 'Xiamen', city: '厦门', parent: null },
      { code: 'CNFOC', nameCn: '福州', nameEn: 'Fuzhou', city: '福州', parent: null },
      { code: 'CNQIN', nameCn: '青岛', nameEn: 'Qingdao', city: '青岛', parent: null },
      { code: 'CNTXG', nameCn: '天津', nameEn: 'Tianjin', city: '天津', parent: null },
      { code: 'CNSHA', nameCn: '上海', nameEn: 'Shanghai', city: '上海', parent: null },
      { code: 'CNGZN', nameCn: '广州', nameEn: 'Guangzhou', city: '广州', parent: null },
      { code: 'CNSZX', nameCn: '深圳', nameEn: 'Shenzhen', city: '深圳', parent: null },
      { code: 'CNNKG', nameCn: '南京', nameEn: 'Nanjing', city: '南京', parent: null },
      { code: 'CNHAR', nameCn: '哈尔滨', nameEn: 'Harbin', city: '哈尔滨', parent: null },
    ]
    
    for (const port of truckPortsChina) {
      await upsertPort({
        code: port.code,
        nameCn: port.nameCn,
        nameEn: port.nameEn,
        country: '中国',
        countryCode: 'CN',
        city: port.city,
        transportType: 'truck',
        portType: 'main',
        parent: null,
        continent: '亚洲',
        sortOrder: sortOrder++,
        status: 'active',
        description: '有发欧洲卡航业务'
      })
    }
    
    console.log(`✅ 起运地数据整理完成！共插入/更新 ${sortOrder - 1} 条记录`)
    
  } catch (error) {
    console.error('❌ 整理起运地数据失败:', error)
    throw error
  }
}

// 如果直接运行此脚本
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                      import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))

if (isMainModule || process.argv[1]?.includes('reorganize-ports-of-loading')) {
  reorganizePortsOfLoading()
    .then(() => {
      console.log('脚本执行完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('脚本执行失败:', error)
      process.exit(1)
    })
}

export { reorganizePortsOfLoading }
