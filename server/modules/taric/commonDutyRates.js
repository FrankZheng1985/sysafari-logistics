/**
 * 欧盟常用商品关税税率数据库
 * 数据来源：EU TARIC 官方数据
 * 最后更新：2024-12
 * 
 * 注意：此数据仅供参考，实际税率以欧盟 TARIC 官方查询为准
 * 官方查询地址：https://ec.europa.eu/taxation_customs/dds2/taric/
 */

// HS 章节说明
const CHAPTERS = {
  '01-05': '动物及动物产品',
  '06-14': '植物产品',
  '15': '动植物油脂',
  '16-24': '食品、饮料、烟草',
  '25-27': '矿产品',
  '28-38': '化工产品',
  '39-40': '塑料及橡胶制品',
  '41-43': '皮革及制品',
  '44-46': '木及木制品',
  '47-49': '纸浆、纸及制品',
  '50-63': '纺织原料及制品',
  '64-67': '鞋帽伞等',
  '68-70': '石料、陶瓷、玻璃',
  '71': '珠宝首饰',
  '72-83': '金属及制品',
  '84-85': '机电设备',
  '86-89': '运输设备',
  '90-92': '光学、医疗、钟表、乐器',
  '93': '武器弹药',
  '94-96': '杂项制品',
  '97': '艺术品、收藏品'
}

// 常用商品第三国关税税率 (MFN - Most Favoured Nation)
// 格式: HS编码前4-8位 -> { rate: 税率%, description: 描述, descriptionCn: 中文描述 }
export const COMMON_DUTY_RATES = {
  // ==================== 第85章：电气设备 ====================
  '8507': {
    rate: 2.7,
    description: 'Electric accumulators',
    descriptionCn: '蓄电池',
    subCodes: {
      '85076000': { rate: 2.7, description: 'Lithium-ion accumulators', descriptionCn: '锂离子蓄电池' },
      '85078000': { rate: 2.7, description: 'Other accumulators', descriptionCn: '其他蓄电池' }
    }
  },
  '8517': {
    rate: 0,
    description: 'Telephone sets; other apparatus for transmission/reception',
    descriptionCn: '电话机及其他通信设备',
    subCodes: {
      '85171200': { rate: 0, description: 'Telephones for cellular networks (smartphones)', descriptionCn: '蜂窝网络电话（智能手机）' },
      '85171800': { rate: 0, description: 'Other telephones', descriptionCn: '其他电话机' },
      '85176200': { rate: 0, description: 'Reception apparatus for radio/TV broadcasting', descriptionCn: '无线电广播接收设备' }
    }
  },
  '8471': {
    rate: 0,
    description: 'Automatic data-processing machines (computers)',
    descriptionCn: '自动数据处理设备（电脑）',
    subCodes: {
      '84713000': { rate: 0, description: 'Portable automatic data processing machines (laptops)', descriptionCn: '便携式自动数据处理设备（笔记本电脑）' },
      '84714900': { rate: 0, description: 'Other digital automatic data processing machines', descriptionCn: '其他数字自动数据处理设备' }
    }
  },
  '8473': {
    rate: 0,
    description: 'Parts and accessories for computers',
    descriptionCn: '电脑零配件',
    subCodes: {
      '84733000': { rate: 0, description: 'Parts and accessories for computers', descriptionCn: '电脑零配件' }
    }
  },
  '8528': {
    rate: 14,
    description: 'Monitors and projectors; TV receivers',
    descriptionCn: '监视器、投影仪和电视接收器',
    subCodes: {
      '85285100': { rate: 0, description: 'Monitors for use with computers', descriptionCn: '电脑显示器' },
      '85287100': { rate: 14, description: 'TV receivers not incorporating video apparatus', descriptionCn: '电视接收器' }
    }
  },
  '8544': {
    rate: 3.3,
    description: 'Insulated wire, cable',
    descriptionCn: '绝缘电线电缆',
    subCodes: {
      '85444200': { rate: 3.3, description: 'Cables fitted with connectors', descriptionCn: '带连接器的电缆' }
    }
  },
  '8504': {
    rate: 1.7,
    description: 'Electrical transformers, static converters',
    descriptionCn: '变压器、静态变流器',
    subCodes: {
      '85044090': { rate: 1.7, description: 'Other static converters (power adapters)', descriptionCn: '其他静态变流器（电源适配器）' }
    }
  },
  '8523': {
    rate: 0,
    description: 'Recording media',
    descriptionCn: '录音录像介质',
    subCodes: {
      '85235100': { rate: 0, description: 'Semiconductor media (USB drives, memory cards)', descriptionCn: '半导体介质（U盘、存储卡）' }
    }
  },
  '8518': {
    rate: 2,
    description: 'Microphones, loudspeakers, headphones',
    descriptionCn: '麦克风、扬声器、耳机',
    subCodes: {
      '85183000': { rate: 2, description: 'Headphones and earphones', descriptionCn: '耳机' }
    }
  },

  // ==================== 第84章：机械设备 ====================
  '8414': {
    rate: 2.2,
    description: 'Air or vacuum pumps, compressors',
    descriptionCn: '空气泵、真空泵、压缩机',
    subCodes: {
      '84145100': { rate: 2.2, description: 'Table, floor, wall fans', descriptionCn: '台扇、落地扇、壁扇' }
    }
  },
  '8415': {
    rate: 2.5,
    description: 'Air conditioning machines',
    descriptionCn: '空调设备',
    subCodes: {
      '84151000': { rate: 2.5, description: 'Window or wall air conditioning machines', descriptionCn: '窗式或壁挂式空调' }
    }
  },
  '8418': {
    rate: 2.5,
    description: 'Refrigerators, freezers',
    descriptionCn: '冰箱、冷冻箱',
    subCodes: {
      '84182100': { rate: 2.5, description: 'Household refrigerators', descriptionCn: '家用冰箱' }
    }
  },
  '8450': {
    rate: 2.7,
    description: 'Washing machines',
    descriptionCn: '洗衣机',
    subCodes: {
      '84501100': { rate: 2.7, description: 'Fully-automatic washing machines', descriptionCn: '全自动洗衣机' }
    }
  },
  '8516': {
    rate: 2.7,
    description: 'Electric heating apparatus',
    descriptionCn: '电热器具',
    subCodes: {
      '85165000': { rate: 2.7, description: 'Microwave ovens', descriptionCn: '微波炉' },
      '85166000': { rate: 2.7, description: 'Other ovens, cookers, hobs', descriptionCn: '其他烤箱、炉灶' }
    }
  },

  // ==================== 第61章：针织服装 ====================
  '6109': {
    rate: 12,
    description: 'T-shirts, singlets and other vests, knitted',
    descriptionCn: '针织T恤衫、背心',
    subCodes: {
      '61091000': { rate: 12, description: 'Of cotton', descriptionCn: '棉制' },
      '61099000': { rate: 12, description: 'Of other textile materials', descriptionCn: '其他纺织材料制' }
    }
  },
  '6110': {
    rate: 12,
    description: 'Sweaters, pullovers, cardigans, knitted',
    descriptionCn: '针织毛衣、套头衫、开襟衫',
    subCodes: {
      '61101000': { rate: 12, description: 'Of wool or fine animal hair', descriptionCn: '羊毛或精细动物毛制' },
      '61102000': { rate: 12, description: 'Of cotton', descriptionCn: '棉制' },
      '61103000': { rate: 12, description: 'Of man-made fibres', descriptionCn: '化纤制' }
    }
  },
  '6104': {
    rate: 12,
    description: "Women's suits, dresses, skirts, knitted",
    descriptionCn: '针织女式套装、连衣裙、裙子',
    subCodes: {
      '61044300': { rate: 12, description: 'Of synthetic fibres', descriptionCn: '合成纤维制' }
    }
  },
  '6203': {
    rate: 12,
    description: "Men's suits, trousers, shorts",
    descriptionCn: '男式套装、裤子、短裤',
    subCodes: {
      '62034200': { rate: 12, description: 'Trousers of cotton', descriptionCn: '棉制裤子' },
      '62034300': { rate: 12, description: 'Trousers of synthetic fibres', descriptionCn: '合成纤维制裤子' }
    }
  },

  // ==================== 第64章：鞋类 ====================
  '6402': {
    rate: 16.9,
    description: 'Other footwear with outer soles of rubber/plastics',
    descriptionCn: '其他橡胶/塑料外底鞋',
    subCodes: {
      '64029900': { rate: 16.9, description: 'Other', descriptionCn: '其他' }
    }
  },
  '6403': {
    rate: 8,
    description: 'Footwear with outer soles of rubber/plastics, uppers of leather',
    descriptionCn: '橡胶/塑料外底皮革面鞋',
    subCodes: {
      '64039900': { rate: 8, description: 'Other', descriptionCn: '其他' }
    }
  },
  '6404': {
    rate: 16.9,
    description: 'Footwear with outer soles of rubber/plastics, uppers of textile',
    descriptionCn: '橡胶/塑料外底纺织面鞋',
    subCodes: {
      '64041100': { rate: 16.9, description: 'Sports footwear', descriptionCn: '运动鞋' },
      '64041900': { rate: 16.9, description: 'Other', descriptionCn: '其他' }
    }
  },

  // ==================== 第42章：皮革制品 ====================
  '4202': {
    rate: 3,
    description: 'Trunks, suitcases, handbags',
    descriptionCn: '箱包',
    subCodes: {
      '42021200': { rate: 3, description: 'Trunks and suitcases', descriptionCn: '衣箱和手提箱' },
      '42022100': { rate: 3, description: 'Handbags of leather', descriptionCn: '皮革手提包' },
      '42022200': { rate: 3, description: 'Handbags of plastic/textile', descriptionCn: '塑料/纺织手提包' },
      '42029200': { rate: 3, description: 'Shopping bags, cases', descriptionCn: '购物袋、盒子' }
    }
  },

  // ==================== 第94章：家具 ====================
  '9401': {
    rate: 0,
    description: 'Seats',
    descriptionCn: '座椅',
    subCodes: {
      '94013000': { rate: 0, description: 'Swivel seats with adjustable height', descriptionCn: '可调高度旋转座椅' },
      '94016100': { rate: 0, description: 'Upholstered seats with wooden frames', descriptionCn: '木框软垫座椅' }
    }
  },
  '9403': {
    rate: 0,
    description: 'Other furniture',
    descriptionCn: '其他家具',
    subCodes: {
      '94033000': { rate: 0, description: 'Wooden furniture for offices', descriptionCn: '办公室用木家具' },
      '94036000': { rate: 0, description: 'Other wooden furniture', descriptionCn: '其他木家具' }
    }
  },
  '9405': {
    rate: 2.7,
    description: 'Lamps and lighting fittings',
    descriptionCn: '灯具',
    subCodes: {
      '94051000': { rate: 2.7, description: 'Chandeliers and other ceiling fittings', descriptionCn: '吊灯及其他天花板灯具' },
      '94052000': { rate: 2.7, description: 'Electric table, desk, bedside lamps', descriptionCn: '电台灯、床头灯' }
    }
  },

  // ==================== 第95章：玩具、游戏 ====================
  '9503': {
    rate: 0,
    description: 'Toys',
    descriptionCn: '玩具',
    subCodes: {
      '95030000': { rate: 0, description: 'Toys', descriptionCn: '玩具' }
    }
  },
  '9504': {
    rate: 0,
    description: 'Video game consoles, articles for funfair games',
    descriptionCn: '游戏机',
    subCodes: {
      '95045000': { rate: 0, description: 'Video game consoles', descriptionCn: '视频游戏机' }
    }
  },

  // ==================== 第39章：塑料及其制品 ====================
  '3901': {
    rate: 6.5,
    description: 'Polymers of ethylene, in primary forms',
    descriptionCn: '初级形状的乙烯聚合物',
    subCodes: {
      '39011000': { rate: 6.5, description: 'Polyethylene with specific gravity < 0.94', descriptionCn: '比重<0.94的聚乙烯' },
      '39012000': { rate: 6.5, description: 'Polyethylene with specific gravity >= 0.94', descriptionCn: '比重>=0.94的聚乙烯' },
      '39013000': { rate: 6.5, description: 'Ethylene-vinyl acetate copolymers', descriptionCn: '乙烯-醋酸乙烯酯共聚物' }
    }
  },
  '3902': {
    rate: 6.5,
    description: 'Polymers of propylene or olefins, in primary forms',
    descriptionCn: '初级形状的丙烯或烯烃聚合物',
    subCodes: {
      '39021000': { rate: 6.5, description: 'Polypropylene', descriptionCn: '聚丙烯' },
      '39022000': { rate: 6.5, description: 'Polyisobutylene', descriptionCn: '聚异丁烯' }
    }
  },
  '3903': {
    rate: 6.5,
    description: 'Polymers of styrene, in primary forms',
    descriptionCn: '初级形状的苯乙烯聚合物',
    subCodes: {
      '39031100': { rate: 6.5, description: 'Expandable polystyrene', descriptionCn: '可发性聚苯乙烯' },
      '39031900': { rate: 6.5, description: 'Other polystyrene', descriptionCn: '其他聚苯乙烯' }
    }
  },
  '3904': {
    rate: 6.5,
    description: 'Polymers of vinyl chloride, in primary forms',
    descriptionCn: '初级形状的氯乙烯聚合物',
    subCodes: {
      '39041000': { rate: 6.5, description: 'Polyvinyl chloride (PVC)', descriptionCn: '聚氯乙烯' },
      '39042100': { rate: 6.5, description: 'Non-plasticised PVC', descriptionCn: '未增塑聚氯乙烯' },
      '39042200': { rate: 6.5, description: 'Plasticised PVC', descriptionCn: '增塑聚氯乙烯' }
    }
  },
  '3907': {
    rate: 6.5,
    description: 'Polyacetals, polyethers, polyesters, in primary forms',
    descriptionCn: '初级形状的聚缩醛、聚醚、聚酯',
    subCodes: {
      '39072100': { rate: 6.5, description: 'Methylpolysiloxanes', descriptionCn: '甲基聚硅氧烷' },
      '39076100': { rate: 6.5, description: 'Poly(ethylene terephthalate) PET', descriptionCn: '聚对苯二甲酸乙二醇酯(PET)' },
      '39076900': { rate: 6.5, description: 'Other polyesters', descriptionCn: '其他聚酯' }
    }
  },
  '3920': {
    rate: 6.5,
    description: 'Other plates, sheets, film, foil of plastics, non-cellular',
    descriptionCn: '非泡沫塑料板、片、膜、箔',
    subCodes: {
      '39201000': { rate: 6.5, description: 'Of polymers of ethylene', descriptionCn: '乙烯聚合物制' },
      '39201010': { rate: 6.5, description: 'Of polymers of ethylene, thickness <= 0.125mm', descriptionCn: '乙烯聚合物制，厚度<=0.125mm' },
      '39201020': { rate: 6.5, description: 'Of polymers of ethylene, thickness > 0.125mm', descriptionCn: '乙烯聚合物制，厚度>0.125mm' },
      '39201080': { rate: 6.5, description: 'Other of polymers of ethylene', descriptionCn: '其他乙烯聚合物制' },
      '39201089': { rate: 6.5, description: 'Other of polymers of ethylene (not laminated)', descriptionCn: '其他乙烯聚合物制（非层压）' },
      '39201090': { rate: 6.5, description: 'Other of polymers of ethylene', descriptionCn: '其他乙烯聚合物制' },
      '39202000': { rate: 6.5, description: 'Of polymers of propylene', descriptionCn: '丙烯聚合物制' },
      '39202010': { rate: 6.5, description: 'Of polymers of propylene, biaxially oriented', descriptionCn: '丙烯聚合物制，双向拉伸' },
      '39202090': { rate: 6.5, description: 'Other of polymers of propylene', descriptionCn: '其他丙烯聚合物制' },
      '39203000': { rate: 6.5, description: 'Of polymers of styrene', descriptionCn: '苯乙烯聚合物制' },
      '39204300': { rate: 6.5, description: 'Of PVC, plasticised, >= 6% plasticiser', descriptionCn: '聚氯乙烯制，增塑剂>=6%' },
      '39204900': { rate: 6.5, description: 'Of PVC, other', descriptionCn: '其他聚氯乙烯制' },
      '39205100': { rate: 6.5, description: 'Of PMMA', descriptionCn: '聚甲基丙烯酸甲酯制' },
      '39205900': { rate: 6.5, description: 'Of other acrylic polymers', descriptionCn: '其他丙烯酸聚合物制' },
      '39206100': { rate: 6.5, description: 'Of polycarbonates', descriptionCn: '聚碳酸酯制' },
      '39206200': { rate: 6.5, description: 'Of PET', descriptionCn: '聚对苯二甲酸乙二醇酯制' },
      '39206300': { rate: 6.5, description: 'Of unsaturated polyesters', descriptionCn: '不饱和聚酯制' },
      '39206900': { rate: 6.5, description: 'Of other polyesters', descriptionCn: '其他聚酯制' },
      '39207100': { rate: 6.5, description: 'Of regenerated cellulose', descriptionCn: '再生纤维素制' },
      '39207300': { rate: 6.5, description: 'Of cellulose acetate', descriptionCn: '醋酸纤维素制' },
      '39207900': { rate: 6.5, description: 'Of other cellulose derivatives', descriptionCn: '其他纤维素衍生物制' },
      '39209100': { rate: 6.5, description: 'Of polyvinyl butyral', descriptionCn: '聚乙烯醇缩丁醛制' },
      '39209200': { rate: 6.5, description: 'Of polyamides', descriptionCn: '聚酰胺制' },
      '39209300': { rate: 6.5, description: 'Of amino-resins', descriptionCn: '氨基树脂制' },
      '39209400': { rate: 6.5, description: 'Of phenolic resins', descriptionCn: '酚醛树脂制' },
      '39209900': { rate: 6.5, description: 'Of other plastics', descriptionCn: '其他塑料制' }
    }
  },
  '3921': {
    rate: 6.5,
    description: 'Other plates, sheets, film, foil of plastics',
    descriptionCn: '其他塑料板、片、膜、箔',
    subCodes: {
      '39211100': { rate: 6.5, description: 'Of polymers of styrene, cellular', descriptionCn: '泡沫苯乙烯聚合物制' },
      '39211200': { rate: 6.5, description: 'Of PVC, cellular', descriptionCn: '泡沫聚氯乙烯制' },
      '39211300': { rate: 6.5, description: 'Of polyurethanes, cellular', descriptionCn: '泡沫聚氨酯制' },
      '39211900': { rate: 6.5, description: 'Of other plastics, cellular', descriptionCn: '其他泡沫塑料制' },
      '39219000': { rate: 6.5, description: 'Other', descriptionCn: '其他' }
    }
  },
  '3923': {
    rate: 6.5,
    description: 'Articles for conveyance or packing of goods, of plastics',
    descriptionCn: '塑料制包装容器',
    subCodes: {
      '39231000': { rate: 6.5, description: 'Boxes, cases, crates', descriptionCn: '盒子、箱子' },
      '39232100': { rate: 6.5, description: 'Sacks and bags of ethylene polymers', descriptionCn: '乙烯聚合物制袋子' },
      '39232900': { rate: 6.5, description: 'Sacks and bags of other plastics', descriptionCn: '其他塑料制袋子' },
      '39233000': { rate: 6.5, description: 'Carboys, bottles, flasks', descriptionCn: '坛、瓶、烧瓶' },
      '39234000': { rate: 6.5, description: 'Spools, cops, bobbins', descriptionCn: '卷轴、卷筒' },
      '39235000': { rate: 6.5, description: 'Stoppers, lids, caps', descriptionCn: '塞子、盖子' },
      '39239000': { rate: 6.5, description: 'Other', descriptionCn: '其他' }
    }
  },
  '3924': {
    rate: 6.5,
    description: 'Tableware, kitchenware, toilet articles of plastics',
    descriptionCn: '塑料餐具、厨房用品、卫生用品',
    subCodes: {
      '39241000': { rate: 6.5, description: 'Tableware and kitchenware', descriptionCn: '餐具和厨房用品' },
      '39249000': { rate: 6.5, description: 'Other', descriptionCn: '其他' }
    }
  },
  '3926': {
    rate: 6.5,
    description: 'Other articles of plastics',
    descriptionCn: '其他塑料制品',
    subCodes: {
      '39261000': { rate: 6.5, description: 'Office or school supplies', descriptionCn: '办公用品或学校用品' },
      '39262000': { rate: 6.5, description: 'Articles of apparel and accessories', descriptionCn: '服装及附件' },
      '39263000': { rate: 6.5, description: 'Fittings for furniture, coachwork', descriptionCn: '家具或车身用附件' },
      '39264000': { rate: 6.5, description: 'Statuettes and ornamental articles', descriptionCn: '塑像及装饰品' },
      '39269000': { rate: 6.5, description: 'Other articles of plastics', descriptionCn: '其他塑料制品' },
      '39269097': { rate: 6.5, description: 'Other articles of plastics (nes)', descriptionCn: '其他塑料制品（未列名）' }
    }
  },

  // ==================== 第73章：钢铁制品 ====================
  '7318': {
    rate: 3.7,
    description: 'Screws, bolts, nuts, washers',
    descriptionCn: '螺钉、螺栓、螺母、垫圈',
    subCodes: {
      '73181500': { rate: 3.7, description: 'Other screws and bolts', descriptionCn: '其他螺钉和螺栓' }
    }
  },
  '7326': {
    rate: 2.7,
    description: 'Other articles of iron or steel',
    descriptionCn: '其他钢铁制品',
    subCodes: {
      '73269098': { rate: 2.7, description: 'Other articles of iron or steel', descriptionCn: '其他钢铁制品' }
    }
  },

  // ==================== 第90章：光学、医疗设备 ====================
  '9018': {
    rate: 0,
    description: 'Medical instruments',
    descriptionCn: '医疗器械',
    subCodes: {
      '90189000': { rate: 0, description: 'Other medical instruments', descriptionCn: '其他医疗器械' }
    }
  },
  '9027': {
    rate: 0,
    description: 'Instruments for physical/chemical analysis',
    descriptionCn: '理化分析仪器',
    subCodes: {
      '90278000': { rate: 0, description: 'Other instruments', descriptionCn: '其他仪器' }
    }
  },

  // ==================== 第87章：车辆 ====================
  '8703': {
    rate: 10,
    description: 'Motor cars',
    descriptionCn: '小汽车',
    subCodes: {
      '87032100': { rate: 10, description: 'With spark-ignition engine <= 1000cc', descriptionCn: '汽油发动机 <=1000cc' },
      '87032290': { rate: 10, description: 'With spark-ignition engine > 1000cc <= 1500cc', descriptionCn: '汽油发动机 1000-1500cc' },
      '87032310': { rate: 10, description: 'With spark-ignition engine > 1500cc <= 3000cc', descriptionCn: '汽油发动机 1500-3000cc' },
      '87038010': { rate: 10, description: 'Electric vehicles', descriptionCn: '电动汽车' }
    }
  },
  '8711': {
    rate: 6,
    description: 'Motorcycles',
    descriptionCn: '摩托车',
    subCodes: {
      '87116000': { rate: 6, description: 'Electric motorcycles', descriptionCn: '电动摩托车' }
    }
  },
  '8712': {
    rate: 14,
    description: 'Bicycles',
    descriptionCn: '自行车',
    subCodes: {
      '87120030': { rate: 14, description: 'Other bicycles', descriptionCn: '其他自行车' }
    }
  }
}

/**
 * 查找 HS 编码的关税税率
 * @param {string} hsCode - HS 编码（4-10位）
 * @returns {Object|null} 税率信息
 */
export function findDutyRate(hsCode) {
  const code = hsCode.replace(/\D/g, '')
  
  // 尝试精确匹配 8 位编码
  if (code.length >= 8) {
    const code8 = code.substring(0, 8)
    const code4 = code.substring(0, 4)
    
    const chapter = COMMON_DUTY_RATES[code4]
    if (chapter && chapter.subCodes) {
      const subCode = chapter.subCodes[code8]
      if (subCode) {
        return {
          hsCode: code8,
          hsCode10: code.padEnd(10, '0').substring(0, 10),
          dutyRate: subCode.rate,
          thirdCountryDuty: subCode.rate,
          description: subCode.description,
          descriptionCn: subCode.descriptionCn,
          dataSource: 'local_database',
          note: '数据来源：本地常用税率数据库，仅供参考'
        }
      }
    }
  }
  
  // 尝试匹配 4 位章节
  const code4 = code.substring(0, 4)
  const chapter = COMMON_DUTY_RATES[code4]
  if (chapter) {
    return {
      hsCode: code4,
      hsCode10: code.padEnd(10, '0').substring(0, 10),
      dutyRate: chapter.rate,
      thirdCountryDuty: chapter.rate,
      description: chapter.description,
      descriptionCn: chapter.descriptionCn,
      dataSource: 'local_database',
      note: '数据来源：本地常用税率数据库（章节级别），具体子编码税率可能不同'
    }
  }
  
  return null
}

/**
 * 获取所有常用税率数据
 */
export function getAllCommonRates() {
  return COMMON_DUTY_RATES
}

/**
 * 获取章节说明
 */
export function getChapterDescription(chapterCode) {
  return CHAPTERS[chapterCode] || null
}

export default {
  COMMON_DUTY_RATES,
  CHAPTERS,
  findDutyRate,
  getAllCommonRates,
  getChapterDescription
}
