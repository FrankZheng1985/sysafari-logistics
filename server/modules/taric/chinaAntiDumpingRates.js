/**
 * 欧盟对中国原产商品的反倾销税/反补贴税数据库
 * 数据来源：EU Trade Defence Database
 * 最后更新：2024-12
 * 
 * 注意：
 * 1. 税率可能因具体产品、出口商而异，此处为一般税率
 * 2. 实际税率以欧盟 TARIC 官方查询为准
 * 3. 部分措施可能有到期日期，需要定期更新
 * 
 * 官方查询地址：
 * - TARIC: https://ec.europa.eu/taxation_customs/dds2/taric/
 * - 反倾销数据库: https://tron.trade.ec.europa.eu/investigations
 */

// ==================== 中国原产商品反倾销税数据 ====================

export const CHINA_ANTI_DUMPING_RATES = {
  // ==================== 第69章：陶瓷制品 ====================
  '6911': {
    description: 'Ceramic tableware, kitchenware',
    descriptionCn: '陶瓷餐具、厨房用具',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '69111000',
        description: 'Porcelain or china tableware',
        descriptionCn: '瓷制餐具',
        dutyRate: 12.0,
        antiDumpingRate: 36.1,  // 一般税率
        antiDumpingRateRange: '17.9% - 69.7%',  // 具体取决于出口商
        regulationId: 'R(EU) 2019/1198',
        validFrom: '2019-07-18',
        note: '配合合作出口商可能有较低税率'
      },
      {
        hsCode8: '69119000',
        description: 'Other ceramic tableware',
        descriptionCn: '其他陶瓷餐具',
        dutyRate: 12.0,
        antiDumpingRate: 36.1,
        antiDumpingRateRange: '17.9% - 69.7%',
        regulationId: 'R(EU) 2019/1198',
        validFrom: '2019-07-18'
      }
    ]
  },
  '6912': {
    description: 'Ceramic household articles',
    descriptionCn: '陶瓷制家用器皿',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '69120010',
        description: 'Ceramic tableware of common pottery',
        descriptionCn: '普通陶制餐具',
        dutyRate: 12.0,
        antiDumpingRate: 36.1,
        antiDumpingRateRange: '17.9% - 69.7%',
        regulationId: 'R(EU) 2019/1198',
        validFrom: '2019-07-18'
      },
      {
        hsCode8: '69120090',
        description: 'Other ceramic household articles',
        descriptionCn: '其他陶瓷家用制品',
        dutyRate: 12.0,
        antiDumpingRate: 17.6,
        regulationId: 'R(EU) 2019/1198',
        validFrom: '2019-07-18'
      }
    ]
  },

  // ==================== 第64章：鞋类 ====================
  '6402': {
    description: 'Footwear with rubber/plastic outer soles',
    descriptionCn: '橡胶/塑料外底鞋类',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '64021200',
        description: 'Ski-boots, cross-country ski footwear',
        descriptionCn: '滑雪靴',
        dutyRate: 17.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07',
        note: '部分鞋类反倾销措施'
      },
      {
        hsCode8: '64021900',
        description: 'Other sports footwear',
        descriptionCn: '其他运动鞋',
        dutyRate: 17.0,
        antiDumpingRate: 16.5,
        antiDumpingRateRange: '9.7% - 16.5%',
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64029100',
        description: 'Footwear covering the ankle',
        descriptionCn: '其他短统靴',
        dutyRate: 17.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64029900',
        description: 'Other footwear',
        descriptionCn: '其他鞋类',
        dutyRate: 16.9,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      }
    ]
  },
  '6403': {
    description: 'Footwear with leather uppers',
    descriptionCn: '皮革面鞋类',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '64031200',
        description: 'Ski-boots with leather uppers',
        descriptionCn: '皮面滑雪靴',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64031900',
        description: 'Other sports footwear with leather uppers',
        descriptionCn: '其他皮面运动鞋',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        antiDumpingRateRange: '9.7% - 16.5%',
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64035100',
        description: 'Footwear with leather uppers covering ankle',
        descriptionCn: '皮面短统靴',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64035900',
        description: 'Other footwear with leather uppers',
        descriptionCn: '其他皮面鞋',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64039100',
        description: 'Footwear covering the ankle',
        descriptionCn: '其他皮面踝靴',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64039900',
        description: 'Other footwear',
        descriptionCn: '其他皮面鞋类',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      }
    ]
  },
  '6404': {
    description: 'Footwear with textile uppers',
    descriptionCn: '纺织面鞋类',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '64041100',
        description: 'Sports footwear with textile uppers',
        descriptionCn: '纺织面运动鞋',
        dutyRate: 16.9,
        antiDumpingRate: 16.5,
        antiDumpingRateRange: '9.7% - 16.5%',
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64041900',
        description: 'Other footwear with textile uppers',
        descriptionCn: '其他纺织面鞋',
        dutyRate: 16.9,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      },
      {
        hsCode8: '64042000',
        description: 'Footwear with textile uppers, leather soles',
        descriptionCn: '纺织面皮底鞋',
        dutyRate: 8.0,
        antiDumpingRate: 16.5,
        regulationId: 'R(EU) 2006/1472',
        validFrom: '2006-10-07'
      }
    ]
  },

  // ==================== 第61-62章：纺织服装 ====================
  '6115': {
    description: 'Hosiery',
    descriptionCn: '袜类',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '61151000',
        description: 'Graduated compression hosiery',
        descriptionCn: '压力袜',
        dutyRate: 12.0,
        antiDumpingRate: 0,  // 目前无反倾销
        note: '部分纺织品曾有配额限制'
      },
      {
        hsCode8: '61152100',
        description: 'Pantyhose and tights of synthetic fibres',
        descriptionCn: '合成纤维连裤袜',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6201': {
    description: "Men's overcoats, jackets",
    descriptionCn: '男式大衣、夹克',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '62011100',
        description: "Men's overcoats of wool",
        descriptionCn: '羊毛男式大衣',
        dutyRate: 12.0,
        antiDumpingRate: 0,
        note: '纺织品配额限制已取消，但仍需关注特殊措施'
      },
      {
        hsCode8: '62011200',
        description: "Men's overcoats of cotton",
        descriptionCn: '棉制男式大衣',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '62011300',
        description: "Men's overcoats of man-made fibres",
        descriptionCn: '化纤男式大衣',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6203': {
    description: "Men's suits, trousers",
    descriptionCn: '男式套装、裤子',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '62034200',
        description: "Men's trousers of cotton",
        descriptionCn: '棉制男裤',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '62034300',
        description: "Men's trousers of synthetic fibres",
        descriptionCn: '合成纤维男裤',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6204': {
    description: "Women's suits, dresses, skirts",
    descriptionCn: '女式套装、连衣裙、裙子',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '62044200',
        description: "Women's dresses of cotton",
        descriptionCn: '棉制女式连衣裙',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '62044300',
        description: "Women's dresses of synthetic fibres",
        descriptionCn: '合成纤维女式连衣裙',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '62046200',
        description: "Women's trousers of cotton",
        descriptionCn: '棉制女裤',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第72-73章：钢铁制品 ====================
  '7219': {
    description: 'Flat-rolled stainless steel',
    descriptionCn: '不锈钢平板轧材',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '72191100',
        description: 'Hot-rolled stainless steel coils > 10mm',
        descriptionCn: '热轧不锈钢卷材 >10mm',
        dutyRate: 0,
        antiDumpingRate: 24.4,
        antiDumpingRateRange: '4.0% - 25.2%',
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72191200',
        description: 'Hot-rolled stainless steel coils 4.75-10mm',
        descriptionCn: '热轧不锈钢卷材 4.75-10mm',
        dutyRate: 0,
        antiDumpingRate: 24.4,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72193100',
        description: 'Cold-rolled stainless steel >= 4.75mm',
        descriptionCn: '冷轧不锈钢 >=4.75mm',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        antiDumpingRateRange: '4.0% - 25.2%',
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72193200',
        description: 'Cold-rolled stainless steel 3-4.75mm',
        descriptionCn: '冷轧不锈钢 3-4.75mm',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72193300',
        description: 'Cold-rolled stainless steel 1-3mm',
        descriptionCn: '冷轧不锈钢 1-3mm',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72193400',
        description: 'Cold-rolled stainless steel 0.5-1mm',
        descriptionCn: '冷轧不锈钢 0.5-1mm',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72193500',
        description: 'Cold-rolled stainless steel < 0.5mm',
        descriptionCn: '冷轧不锈钢 <0.5mm',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      }
    ]
  },
  '7220': {
    description: 'Flat-rolled stainless steel < 600mm',
    descriptionCn: '宽度<600mm不锈钢平板轧材',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '72201100',
        description: 'Hot-rolled stainless steel strips',
        descriptionCn: '热轧不锈钢带材',
        dutyRate: 0,
        antiDumpingRate: 24.4,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72201200',
        description: 'Hot-rolled stainless steel strips < 4.75mm',
        descriptionCn: '热轧不锈钢带材 <4.75mm',
        dutyRate: 0,
        antiDumpingRate: 24.4,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      },
      {
        hsCode8: '72202000',
        description: 'Cold-rolled stainless steel strips',
        descriptionCn: '冷轧不锈钢带材',
        dutyRate: 0,
        antiDumpingRate: 25.2,
        regulationId: 'R(EU) 2015/1429',
        validFrom: '2015-08-26'
      }
    ]
  },
  '7208': {
    description: 'Hot-rolled steel products',
    descriptionCn: '热轧钢铁产品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '72081000',
        description: 'Hot-rolled steel coils with patterns',
        descriptionCn: '热轧花纹钢卷',
        dutyRate: 0,
        antiDumpingRate: 35.9,
        antiDumpingRateRange: '17.1% - 35.9%',
        regulationId: 'R(EU) 2017/969',
        validFrom: '2017-06-09'
      },
      {
        hsCode8: '72082500',
        description: 'Hot-rolled steel coils >= 4.75mm, pickled',
        descriptionCn: '热轧酸洗钢卷 >=4.75mm',
        dutyRate: 0,
        antiDumpingRate: 35.9,
        regulationId: 'R(EU) 2017/969',
        validFrom: '2017-06-09'
      },
      {
        hsCode8: '72082600',
        description: 'Hot-rolled steel coils 3-4.75mm, pickled',
        descriptionCn: '热轧酸洗钢卷 3-4.75mm',
        dutyRate: 0,
        antiDumpingRate: 35.9,
        regulationId: 'R(EU) 2017/969',
        validFrom: '2017-06-09'
      },
      {
        hsCode8: '72082700',
        description: 'Hot-rolled steel coils < 3mm, pickled',
        descriptionCn: '热轧酸洗钢卷 <3mm',
        dutyRate: 0,
        antiDumpingRate: 35.9,
        regulationId: 'R(EU) 2017/969',
        validFrom: '2017-06-09'
      }
    ]
  },
  '7210': {
    description: 'Coated flat-rolled steel',
    descriptionCn: '镀层钢铁平板轧材',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '72104100',
        description: 'Corrugated galvanized steel',
        descriptionCn: '波纹镀锌钢板',
        dutyRate: 0,
        antiDumpingRate: 44.7,
        antiDumpingRateRange: '4.5% - 44.7%',
        regulationId: 'R(EU) 2017/1444',
        validFrom: '2017-08-10'
      },
      {
        hsCode8: '72104900',
        description: 'Other galvanized steel',
        descriptionCn: '其他镀锌钢板',
        dutyRate: 0,
        antiDumpingRate: 44.7,
        regulationId: 'R(EU) 2017/1444',
        validFrom: '2017-08-10'
      },
      {
        hsCode8: '72106100',
        description: 'Aluminium-zinc coated steel',
        descriptionCn: '铝锌合金镀层钢板',
        dutyRate: 0,
        antiDumpingRate: 44.7,
        regulationId: 'R(EU) 2017/1444',
        validFrom: '2017-08-10'
      },
      {
        hsCode8: '72107000',
        description: 'Painted or plastic-coated steel',
        descriptionCn: '涂漆或塑料涂层钢板',
        dutyRate: 0,
        antiDumpingRate: 44.7,
        regulationId: 'R(EU) 2017/1444',
        validFrom: '2017-08-10'
      }
    ]
  },
  '7318': {
    description: 'Iron or steel fasteners',
    descriptionCn: '钢铁紧固件',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '73181200',
        description: 'Other wood screws',
        descriptionCn: '其他木螺钉',
        dutyRate: 3.7,
        antiDumpingRate: 85.0,
        antiDumpingRateRange: '22.1% - 85.0%',
        regulationId: 'R(EU) 2009/91',
        validFrom: '2009-01-31'
      },
      {
        hsCode8: '73181400',
        description: 'Self-tapping screws',
        descriptionCn: '自攻螺钉',
        dutyRate: 3.7,
        antiDumpingRate: 85.0,
        regulationId: 'R(EU) 2009/91',
        validFrom: '2009-01-31'
      },
      {
        hsCode8: '73181500',
        description: 'Other screws and bolts',
        descriptionCn: '其他螺钉和螺栓',
        dutyRate: 3.7,
        antiDumpingRate: 85.0,
        regulationId: 'R(EU) 2009/91',
        validFrom: '2009-01-31'
      },
      {
        hsCode8: '73181600',
        description: 'Nuts',
        descriptionCn: '螺母',
        dutyRate: 3.7,
        antiDumpingRate: 85.0,
        regulationId: 'R(EU) 2009/91',
        validFrom: '2009-01-31'
      }
    ]
  },

  // ==================== 第76章：铝及其制品 ====================
  '7604': {
    description: 'Aluminium bars, rods and profiles',
    descriptionCn: '铝条、杆及型材',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '76042100',
        description: 'Hollow aluminium profiles',
        descriptionCn: '铝制空心型材',
        dutyRate: 7.5,
        antiDumpingRate: 30.4,
        antiDumpingRateRange: '21.2% - 32.1%',
        regulationId: 'R(EU) 2021/546',
        validFrom: '2021-04-01'
      },
      {
        hsCode8: '76042900',
        description: 'Other aluminium profiles',
        descriptionCn: '其他铝型材',
        dutyRate: 7.5,
        antiDumpingRate: 30.4,
        regulationId: 'R(EU) 2021/546',
        validFrom: '2021-04-01'
      }
    ]
  },
  '7606': {
    description: 'Aluminium plates, sheets, strips',
    descriptionCn: '铝板、片、带',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '76061100',
        description: 'Aluminium plates > 0.2mm, rectangular',
        descriptionCn: '矩形铝板 >0.2mm',
        dutyRate: 7.5,
        antiDumpingRate: 30.4,
        regulationId: 'R(EU) 2021/546',
        validFrom: '2021-04-01'
      }
    ]
  },
  '7607': {
    description: 'Aluminium foil',
    descriptionCn: '铝箔',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '76071100',
        description: 'Aluminium foil, rolled, not backed, <= 0.2mm',
        descriptionCn: '轧制铝箔，无衬背 <=0.2mm',
        dutyRate: 7.5,
        antiDumpingRate: 17.6,
        antiDumpingRateRange: '6.4% - 17.6%',
        regulationId: 'R(EU) 2015/2384',
        validFrom: '2015-12-18'
      },
      {
        hsCode8: '76071900',
        description: 'Other aluminium foil, not backed',
        descriptionCn: '其他无衬背铝箔',
        dutyRate: 7.5,
        antiDumpingRate: 17.6,
        regulationId: 'R(EU) 2015/2384',
        validFrom: '2015-12-18'
      },
      {
        hsCode8: '76072000',
        description: 'Aluminium foil, backed',
        descriptionCn: '有衬背铝箔',
        dutyRate: 7.5,
        antiDumpingRate: 17.6,
        regulationId: 'R(EU) 2015/2384',
        validFrom: '2015-12-18'
      }
    ]
  },
  '7608': {
    description: 'Aluminium tubes and pipes',
    descriptionCn: '铝管',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '76081000',
        description: 'Aluminium tubes and pipes',
        descriptionCn: '铝管',
        dutyRate: 7.5,
        antiDumpingRate: 30.4,
        regulationId: 'R(EU) 2021/546',
        validFrom: '2021-04-01'
      }
    ]
  },

  // ==================== 第70章：玻璃及制品 ====================
  '7019': {
    description: 'Glass fibres',
    descriptionCn: '玻璃纤维',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '70191100',
        description: 'Chopped glass strands',
        descriptionCn: '切短玻璃纤维',
        dutyRate: 0,
        antiDumpingRate: 99.7,
        antiDumpingRateRange: '69.4% - 99.7%',
        regulationId: 'R(EU) 2020/492',
        validFrom: '2020-04-01'
      },
      {
        hsCode8: '70191200',
        description: 'Glass fibre rovings',
        descriptionCn: '玻璃纤维粗纱',
        dutyRate: 0,
        antiDumpingRate: 99.7,
        regulationId: 'R(EU) 2020/492',
        validFrom: '2020-04-01'
      },
      {
        hsCode8: '70191900',
        description: 'Other glass fibre strands',
        descriptionCn: '其他玻璃纤维条股',
        dutyRate: 0,
        antiDumpingRate: 99.7,
        regulationId: 'R(EU) 2020/492',
        validFrom: '2020-04-01'
      },
      {
        hsCode8: '70193100',
        description: 'Glass fibre mats',
        descriptionCn: '玻璃纤维薄垫',
        dutyRate: 0,
        antiDumpingRate: 99.7,
        regulationId: 'R(EU) 2020/492',
        validFrom: '2020-04-01'
      },
      {
        hsCode8: '70193900',
        description: 'Other glass fibre webs and mats',
        descriptionCn: '其他玻璃纤维网及垫',
        dutyRate: 3.5,
        antiDumpingRate: 99.7,
        regulationId: 'R(EU) 2020/492',
        validFrom: '2020-04-01'
      },
      {
        hsCode8: '70194000',
        description: 'Woven glass fibre fabrics',
        descriptionCn: '玻璃纤维机织物',
        dutyRate: 3.5,
        antiDumpingRate: 99.7,
        regulationId: 'R(EU) 2014/1371',
        validFrom: '2014-12-19'
      }
    ]
  },

  // ==================== 第87章：车辆 ====================
  '8711': {
    description: 'Motorcycles and cycles with auxiliary motor',
    descriptionCn: '摩托车及装有辅助发动机的自行车',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '87116010',
        description: 'Electric bicycles with pedal assistance',
        descriptionCn: '电动助力自行车',
        dutyRate: 6.0,
        antiDumpingRate: 79.3,
        antiDumpingRateRange: '18.8% - 79.3%',
        regulationId: 'R(EU) 2019/73',
        validFrom: '2019-01-18',
        note: '电动自行车反倾销税，配合出口商税率较低'
      },
      {
        hsCode8: '87116090',
        description: 'Other electric cycles',
        descriptionCn: '其他电动自行车',
        dutyRate: 6.0,
        antiDumpingRate: 79.3,
        regulationId: 'R(EU) 2019/73',
        validFrom: '2019-01-18'
      }
    ]
  },
  '8712': {
    description: 'Bicycles',
    descriptionCn: '自行车',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '87120030',
        description: 'Other bicycles',
        descriptionCn: '其他自行车',
        dutyRate: 14.0,
        antiDumpingRate: 48.5,
        antiDumpingRateRange: '19.2% - 48.5%',
        regulationId: 'R(EU) 2019/1379',
        validFrom: '2019-08-20'
      }
    ]
  },

  // ==================== 第40章：橡胶及制品 ====================
  '4011': {
    description: 'New pneumatic tyres',
    descriptionCn: '新的充气轮胎',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '40111000',
        description: 'Tyres for motor cars',
        descriptionCn: '小客车轮胎',
        dutyRate: 4.5,
        antiDumpingRate: 17.6,
        antiDumpingRateRange: '10.1% - 17.6%',
        regulationId: 'R(EU) 2018/1690',
        validFrom: '2018-11-08'
      },
      {
        hsCode8: '40112000',
        description: 'Tyres for buses or lorries',
        descriptionCn: '公共汽车/货车轮胎',
        dutyRate: 4.5,
        antiDumpingRate: 17.6,
        regulationId: 'R(EU) 2018/1690',
        validFrom: '2018-11-08'
      }
    ]
  },

  // ==================== 第85章：电气设备 ====================
  '8501': {
    description: 'Electric motors and generators',
    descriptionCn: '电动机和发电机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85011000',
        description: 'Motors for toys',
        descriptionCn: '玩具用电动机',
        dutyRate: 2.7,
        antiDumpingRate: 30.0,
        regulationId: 'R(EU) 2012/990',
        validFrom: '2012-10-25'
      }
    ]
  },

  // ==================== 第48章：纸及纸制品 ====================
  '4802': {
    description: 'Uncoated paper',
    descriptionCn: '未涂布纸',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '48025500',
        description: 'Other uncoated paper >= 40g/m2',
        descriptionCn: '其他未涂布纸 >=40g/m2',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '目前无反倾销措施'
      }
    ]
  },

  // ==================== 第28章：无机化学品 ====================
  '2818': {
    description: 'Artificial corundum (aluminium oxide)',
    descriptionCn: '人造刚玉（氧化铝）',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '28181010',
        description: 'Artificial corundum, white',
        descriptionCn: '白色人造刚玉',
        dutyRate: 5.5,
        antiDumpingRate: 0,
        note: 'MFN税率，无反倾销'
      },
      {
        hsCode8: '28181090',
        description: 'Other artificial corundum',
        descriptionCn: '其他人造刚玉',
        dutyRate: 5.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2833': {
    description: 'Sulphates',
    descriptionCn: '硫酸盐',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '28332100',
        description: 'Magnesium sulphate',
        descriptionCn: '硫酸镁',
        dutyRate: 5.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '28332500',
        description: 'Copper sulphate',
        descriptionCn: '硫酸铜',
        dutyRate: 5.5,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第29章：有机化学品 ====================
  '2903': {
    description: 'Halogenated derivatives of hydrocarbons',
    descriptionCn: '烃的卤化衍生物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29031500',
        description: 'Ethylene dichloride',
        descriptionCn: '二氯乙烷',
        dutyRate: 5.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29032100',
        description: 'Vinyl chloride',
        descriptionCn: '氯乙烯',
        dutyRate: 5.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2905': {
    description: 'Acyclic alcohols',
    descriptionCn: '无环醇',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29051100',
        description: 'Methanol',
        descriptionCn: '甲醇',
        dutyRate: 5.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29051200',
        description: 'Propan-1-ol and propan-2-ol',
        descriptionCn: '丙醇',
        dutyRate: 5.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29051700',
        description: 'Dodecan-1-ol, hexadecan-1-ol, octadecan-1-ol',
        descriptionCn: '月桂醇、鲸蜡醇、硬脂醇',
        dutyRate: 5.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2915': {
    description: 'Saturated acyclic monocarboxylic acids',
    descriptionCn: '饱和无环一元羧酸',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29152100',
        description: 'Acetic acid',
        descriptionCn: '乙酸（醋酸）',
        dutyRate: 5.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29153100',
        description: 'Ethyl acetate',
        descriptionCn: '乙酸乙酯',
        dutyRate: 5.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2917': {
    description: 'Polycarboxylic acids',
    descriptionCn: '多元羧酸',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29171100',
        description: 'Oxalic acid',
        descriptionCn: '草酸',
        dutyRate: 6.5,
        antiDumpingRate: 14.6,
        antiDumpingRateRange: '14.6% - 52.2%',
        regulationId: 'R(EU) 2020/1160',
        validFrom: '2020-08-05',
        note: '草酸反倾销措施'
      },
      {
        hsCode8: '29171200',
        description: 'Adipic acid',
        descriptionCn: '己二酸',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29171400',
        description: 'Maleic anhydride',
        descriptionCn: '马来酸酐',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2918': {
    description: 'Carboxylic acids with additional oxygen function',
    descriptionCn: '含其他含氧基羧酸',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29181100',
        description: 'Lactic acid',
        descriptionCn: '乳酸',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29181400',
        description: 'Citric acid',
        descriptionCn: '柠檬酸',
        dutyRate: 6.5,
        antiDumpingRate: 42.7,
        antiDumpingRateRange: '15.3% - 42.7%',
        regulationId: 'R(EU) 2008/1193',
        validFrom: '2008-12-01',
        note: '柠檬酸反倾销税'
      },
      {
        hsCode8: '29181500',
        description: 'Citric acid salts and esters',
        descriptionCn: '柠檬酸盐及酯',
        dutyRate: 6.5,
        antiDumpingRate: 42.7,
        regulationId: 'R(EU) 2008/1193',
        validFrom: '2008-12-01'
      }
    ]
  },
  '2921': {
    description: 'Amine-function compounds',
    descriptionCn: '胺基化合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29211100',
        description: 'Methylamine, di- or trimethylamine',
        descriptionCn: '甲胺',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29214200',
        description: 'Aniline derivatives',
        descriptionCn: '苯胺衍生物',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2930': {
    description: 'Organo-sulphur compounds',
    descriptionCn: '有机硫化合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29309016',
        description: 'Cysteine and cystine',
        descriptionCn: '半胱氨酸和胱氨酸',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29309070',
        description: 'Methionine',
        descriptionCn: '蛋氨酸',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '2933': {
    description: 'Heterocyclic compounds with nitrogen hetero-atom(s)',
    descriptionCn: '仅含氮杂原子的杂环化合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29336100',
        description: 'Melamine',
        descriptionCn: '三聚氰胺',
        dutyRate: 6.5,
        antiDumpingRate: 44.0,
        antiDumpingRateRange: '44.0%',
        regulationId: 'R(EU) 2011/457',
        validFrom: '2011-05-11',
        note: '三聚氰胺反倾销税'
      }
    ]
  },
  '2941': {
    description: 'Antibiotics',
    descriptionCn: '抗生素',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '29411000',
        description: 'Penicillins',
        descriptionCn: '青霉素类',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '药品原料免关税'
      },
      {
        hsCode8: '29412000',
        description: 'Streptomycins',
        descriptionCn: '链霉素类',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '29413000',
        description: 'Tetracyclines',
        descriptionCn: '四环素类',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第30章：药品 ====================
  '3004': {
    description: 'Medicaments for therapeutic or prophylactic uses',
    descriptionCn: '治疗或预防用药品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '30041000',
        description: 'Medicaments containing penicillins',
        descriptionCn: '含青霉素类药品',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '药品免关税'
      },
      {
        hsCode8: '30042000',
        description: 'Medicaments containing antibiotics',
        descriptionCn: '含其他抗生素药品',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第31章：肥料 ====================
  '3102': {
    description: 'Mineral or chemical nitrogenous fertilizers',
    descriptionCn: '矿物或化学氮肥',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '31021000',
        description: 'Urea',
        descriptionCn: '尿素',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '31023000',
        description: 'Ammonium nitrate',
        descriptionCn: '硝酸铵',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3105': {
    description: 'Mineral or chemical fertilizers with NPK',
    descriptionCn: '含氮磷钾的矿物或化学肥料',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '31052000',
        description: 'Mineral or chemical fertilizers with NPK',
        descriptionCn: '含氮磷钾三元素肥料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第32章：颜料染料 ====================
  '3204': {
    description: 'Synthetic organic colouring matter',
    descriptionCn: '合成有机着色剂',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '32041100',
        description: 'Disperse dyes',
        descriptionCn: '分散染料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '32041200',
        description: 'Acid dyes',
        descriptionCn: '酸性染料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '32041400',
        description: 'Direct dyes',
        descriptionCn: '直接染料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '32041500',
        description: 'Vat dyes',
        descriptionCn: '还原染料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '32041700',
        description: 'Pigments',
        descriptionCn: '颜料',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3206': {
    description: 'Inorganic colouring matter',
    descriptionCn: '无机着色剂',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '32061100',
        description: 'Titanium dioxide pigments',
        descriptionCn: '二氧化钛颜料',
        dutyRate: 5.5,
        antiDumpingRate: 0,
        note: '钛白粉，重要工业原料'
      }
    ]
  },

  // ==================== 第38章：杂项化学品 ====================
  '3808': {
    description: 'Insecticides, herbicides, disinfectants',
    descriptionCn: '杀虫剂、除草剂、消毒剂',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '38089110',
        description: 'Insecticides',
        descriptionCn: '杀虫剂',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '38089200',
        description: 'Fungicides',
        descriptionCn: '杀菌剂',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '38089300',
        description: 'Herbicides',
        descriptionCn: '除草剂',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3815': {
    description: 'Reaction initiators, accelerators, catalytic preparations',
    descriptionCn: '反应引发剂、促进剂、催化剂',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '38151100',
        description: 'Supported catalysts with nickel',
        descriptionCn: '以镍为活性物的载体催化剂',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '38151200',
        description: 'Supported catalysts with precious metal',
        descriptionCn: '以贵金属为活性物的载体催化剂',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3824': {
    description: 'Chemical products and preparations',
    descriptionCn: '化学产品和配制品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '38249971',
        description: 'Chemical preparations for electronics industry',
        descriptionCn: '电子工业用化学制品',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第39章：塑料及制品 ====================
  '3901': {
    description: 'Polymers of ethylene',
    descriptionCn: '乙烯聚合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39011000',
        description: 'Polyethylene, density < 0.94',
        descriptionCn: '低密度聚乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39012000',
        description: 'Polyethylene, density >= 0.94',
        descriptionCn: '高密度聚乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3902': {
    description: 'Polymers of propylene',
    descriptionCn: '丙烯聚合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39021000',
        description: 'Polypropylene',
        descriptionCn: '聚丙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3903': {
    description: 'Polymers of styrene',
    descriptionCn: '苯乙烯聚合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39031100',
        description: 'Expansible polystyrene',
        descriptionCn: '可发性聚苯乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39031900',
        description: 'Other polystyrene',
        descriptionCn: '其他聚苯乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3904': {
    description: 'Polymers of vinyl chloride',
    descriptionCn: '氯乙烯聚合物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39041000',
        description: 'Poly(vinyl chloride), not mixed',
        descriptionCn: '纯聚氯乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39042100',
        description: 'Non-plasticised PVC',
        descriptionCn: '未增塑聚氯乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39042200',
        description: 'Plasticised PVC',
        descriptionCn: '增塑聚氯乙烯',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3907': {
    description: 'Polyacetals, polyethers, epoxide resins',
    descriptionCn: '聚缩醛、聚醚、环氧树脂',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39072011',
        description: 'Polyethylene glycol',
        descriptionCn: '聚乙二醇',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39076100',
        description: 'Poly(ethylene terephthalate) (PET)',
        descriptionCn: '聚对苯二甲酸乙二醇酯(PET)',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3917': {
    description: 'Tubes, pipes, hoses of plastics',
    descriptionCn: '塑料管子',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39172100',
        description: 'Tubes of ethylene polymers',
        descriptionCn: '乙烯聚合物制管',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39172300',
        description: 'Tubes of vinyl chloride polymers',
        descriptionCn: '氯乙烯聚合物制管',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3920': {
    description: 'Plates, sheets, film of plastics',
    descriptionCn: '塑料板、片、膜',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39201000',
        description: 'Plates of ethylene polymers',
        descriptionCn: '乙烯聚合物板片',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39202000',
        description: 'Plates of propylene polymers',
        descriptionCn: '丙烯聚合物板片',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39206200',
        description: 'Plates of poly(ethylene terephthalate)',
        descriptionCn: 'PET板片',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3923': {
    description: 'Articles for conveyance or packing of goods',
    descriptionCn: '塑料包装容器',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39231000',
        description: 'Boxes, cases, crates',
        descriptionCn: '塑料盒、箱、板条箱',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39232100',
        description: 'Sacks and bags of ethylene polymers',
        descriptionCn: '乙烯聚合物制袋',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39232900',
        description: 'Sacks and bags of other plastics',
        descriptionCn: '其他塑料制袋',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39233000',
        description: 'Carboys, bottles, flasks',
        descriptionCn: '塑料瓶罐',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },
  '3926': {
    description: 'Other articles of plastics',
    descriptionCn: '其他塑料制品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '39261000',
        description: 'Office or school supplies',
        descriptionCn: '办公或学校用塑料制品',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39262000',
        description: 'Articles of apparel',
        descriptionCn: '塑料制衣着用品',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39264000',
        description: 'Statuettes and ornaments',
        descriptionCn: '塑料小雕像及装饰品',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '39269000',
        description: 'Other articles of plastics',
        descriptionCn: '其他塑料制品',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第44章：木材及制品 ====================
  '4407': {
    description: 'Wood sawn or chipped lengthwise',
    descriptionCn: '纵锯或纵切木材',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44071100',
        description: 'Coniferous wood, pine',
        descriptionCn: '松木板材',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44071200',
        description: 'Coniferous wood, fir',
        descriptionCn: '冷杉木板材',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '4408': {
    description: 'Sheets for veneering, plywood',
    descriptionCn: '饰面用薄板、胶合板用薄板',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44081000',
        description: 'Coniferous sheets',
        descriptionCn: '针叶木薄板',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44083100',
        description: 'Tropical wood sheets, dark red meranti',
        descriptionCn: '热带木薄板-深红柳安',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '4410': {
    description: 'Particle board',
    descriptionCn: '刨花板',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44101100',
        description: 'Particle board of wood',
        descriptionCn: '木质刨花板',
        dutyRate: 7.0,
        antiDumpingRate: 0
      }
    ]
  },
  '4411': {
    description: 'Fibreboard',
    descriptionCn: '纤维板',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44111200',
        description: 'Medium density fibreboard (MDF) <= 5mm',
        descriptionCn: '中密度纤维板 <=5mm',
        dutyRate: 7.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44111300',
        description: 'Medium density fibreboard (MDF) 5-9mm',
        descriptionCn: '中密度纤维板 5-9mm',
        dutyRate: 7.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44111400',
        description: 'Medium density fibreboard (MDF) > 9mm',
        descriptionCn: '中密度纤维板 >9mm',
        dutyRate: 7.0,
        antiDumpingRate: 0
      }
    ]
  },
  '4412': {
    description: 'Plywood, veneered panels',
    descriptionCn: '胶合板',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44121000',
        description: 'Plywood of bamboo',
        descriptionCn: '竹制胶合板',
        dutyRate: 7.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44123100',
        description: 'Plywood with tropical wood surface',
        descriptionCn: '热带木面胶合板',
        dutyRate: 7.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44123300',
        description: 'Other plywood with hardwood surface',
        descriptionCn: '其他硬木面胶合板',
        dutyRate: 7.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44129400',
        description: 'Blockboard, laminboard',
        descriptionCn: '细木工板',
        dutyRate: 7.0,
        antiDumpingRate: 9.9,
        antiDumpingRateRange: '6.5% - 9.9%',
        regulationId: 'R(EU) 2021/1038',
        validFrom: '2021-06-25',
        note: '桦木胶合板反倾销措施'
      }
    ]
  },
  '4418': {
    description: 'Builders joinery and carpentry of wood',
    descriptionCn: '木制建筑用细木工制品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '44182000',
        description: 'Doors and their frames',
        descriptionCn: '木门及其框架',
        dutyRate: 3.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44184000',
        description: 'Shuttering for concrete constructional work',
        descriptionCn: '混凝土建筑用模板',
        dutyRate: 3.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '44187500',
        description: 'Assembled flooring panels',
        descriptionCn: '多层木地板',
        dutyRate: 3.0,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第50-55章：更多纺织品 ====================
  '5007': {
    description: 'Woven fabrics of silk',
    descriptionCn: '丝织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '50071000',
        description: 'Fabrics of noil silk',
        descriptionCn: '绢丝织物',
        dutyRate: 7.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '50072000',
        description: 'Other fabrics >= 85% silk',
        descriptionCn: '其他丝含量>=85%织物',
        dutyRate: 7.5,
        antiDumpingRate: 0
      }
    ]
  },
  '5208': {
    description: 'Woven cotton fabrics',
    descriptionCn: '棉机织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '52081100',
        description: 'Plain weave cotton <= 100g/m2',
        descriptionCn: '平纹棉布 <=100g/m2',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '52081200',
        description: 'Plain weave cotton > 100g/m2',
        descriptionCn: '平纹棉布 >100g/m2',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '52082100',
        description: 'Plain weave cotton, bleached',
        descriptionCn: '漂白平纹棉布',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '52083100',
        description: 'Plain weave cotton, dyed',
        descriptionCn: '染色平纹棉布',
        dutyRate: 8.0,
        antiDumpingRate: 0
      }
    ]
  },
  '5407': {
    description: 'Woven fabrics of synthetic filament yarn',
    descriptionCn: '合成纤维长丝织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '54071000',
        description: 'Woven fabrics of high tenacity yarn',
        descriptionCn: '高强力纱织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '54072000',
        description: 'Woven fabrics from strip or the like',
        descriptionCn: '扁条等织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '54074100',
        description: 'Woven fabrics of nylon, unbleached or bleached',
        descriptionCn: '尼龙织物-未漂或漂白',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '54075100',
        description: 'Woven fabrics of polyester staple fibres',
        descriptionCn: '涤纶短纤织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      }
    ]
  },
  '5503': {
    description: 'Synthetic staple fibres, not carded or combed',
    descriptionCn: '合成纤维短纤（未梳理）',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '55032000',
        description: 'Polyester staple fibres',
        descriptionCn: '聚酯短纤',
        dutyRate: 4.0,
        antiDumpingRate: 4.9,
        antiDumpingRateRange: '4.9% - 19.7%',
        regulationId: 'R(EU) 2005/428',
        validFrom: '2005-03-12',
        note: '聚酯短纤反倾销税'
      },
      {
        hsCode8: '55033000',
        description: 'Acrylic staple fibres',
        descriptionCn: '腈纶短纤',
        dutyRate: 4.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '55034000',
        description: 'Polypropylene staple fibres',
        descriptionCn: '聚丙烯短纤',
        dutyRate: 4.0,
        antiDumpingRate: 0
      }
    ]
  },
  '5509': {
    description: 'Yarn of synthetic staple fibres',
    descriptionCn: '合成短纤纱线',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '55091100',
        description: 'Single yarn of nylon >= 85%',
        descriptionCn: '尼龙单纱 >=85%',
        dutyRate: 4.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '55092100',
        description: 'Single yarn of polyester >= 85%',
        descriptionCn: '涤纶单纱 >=85%',
        dutyRate: 4.0,
        antiDumpingRate: 0
      }
    ]
  },
  '5516': {
    description: 'Woven fabrics of artificial staple fibres',
    descriptionCn: '人造纤维短纤织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '55161100',
        description: 'Fabrics of artificial staple fibres, unbleached',
        descriptionCn: '人造短纤织物-未漂白',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '55161200',
        description: 'Fabrics of artificial staple fibres, bleached',
        descriptionCn: '人造短纤织物-漂白',
        dutyRate: 8.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6001': {
    description: 'Pile fabrics, knitted or crocheted',
    descriptionCn: '针织绒头织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '60011000',
        description: 'Long pile fabrics',
        descriptionCn: '长毛绒针织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '60012100',
        description: 'Looped pile fabrics of cotton',
        descriptionCn: '棉制毛圈针织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6006': {
    description: 'Other knitted or crocheted fabrics',
    descriptionCn: '其他针织或钩编织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '60062100',
        description: 'Other knitted fabrics of cotton, unbleached',
        descriptionCn: '棉针织物-未漂白',
        dutyRate: 8.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '60063100',
        description: 'Other knitted fabrics of synthetic fibres',
        descriptionCn: '合成纤维针织物',
        dutyRate: 8.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6302': {
    description: 'Bed linen, table linen, toilet linen',
    descriptionCn: '床上用织物、餐桌用织物、盥洗用织物',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '63021000',
        description: 'Bed linen, knitted or crocheted',
        descriptionCn: '针织床上用织物',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63022100',
        description: 'Bed linen of cotton, printed',
        descriptionCn: '棉制印花床上用品',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63023100',
        description: 'Bed linen of cotton, other',
        descriptionCn: '其他棉制床上用品',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63025100',
        description: 'Table linen of cotton',
        descriptionCn: '棉制餐桌用织物',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63026000',
        description: 'Toilet linen and kitchen linen of terry',
        descriptionCn: '毛圈织物制盥洗和厨房用织物',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },
  '6307': {
    description: 'Other made up textile articles',
    descriptionCn: '其他纺织制成品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '63071000',
        description: 'Floor-cloths, dish-cloths, dusters',
        descriptionCn: '擦地布、洗碗布、抹布',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63072000',
        description: 'Life-jackets and life-belts',
        descriptionCn: '救生衣和救生带',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '63079000',
        description: 'Other made up articles',
        descriptionCn: '其他纺织制成品',
        dutyRate: 12.0,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第84章：机械设备 ====================
  '8414': {
    description: 'Air or vacuum pumps, compressors, fans',
    descriptionCn: '空气泵、真空泵、压缩机、风机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84145100',
        description: 'Table, floor, wall fans <= 125W',
        descriptionCn: '台扇、落地扇、壁扇 <=125W',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84145900',
        description: 'Other fans',
        descriptionCn: '其他风扇',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84148000',
        description: 'Other air pumps, compressors',
        descriptionCn: '其他空气泵、压缩机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8415': {
    description: 'Air conditioning machines',
    descriptionCn: '空调器',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84151010',
        description: 'Window or wall air conditioning units, self-contained',
        descriptionCn: '窗式或壁挂式整体空调',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84151090',
        description: 'Other window or wall air conditioning units',
        descriptionCn: '其他窗式或壁挂式空调',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84158100',
        description: 'Air conditioning with refrigeration unit',
        descriptionCn: '带制冷装置的空调',
        dutyRate: 2.5,
        antiDumpingRate: 0
      }
    ]
  },
  '8418': {
    description: 'Refrigerators, freezers, heat pumps',
    descriptionCn: '冰箱、冷柜、热泵',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84181010',
        description: 'Combined refrigerator-freezers',
        descriptionCn: '冰箱冷柜组合机',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84182100',
        description: 'Compression-type household refrigerators',
        descriptionCn: '压缩式家用冰箱',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84183000',
        description: 'Chest freezers',
        descriptionCn: '卧式冷柜',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84184000',
        description: 'Upright freezers',
        descriptionCn: '立式冷柜',
        dutyRate: 2.5,
        antiDumpingRate: 0
      }
    ]
  },
  '8421': {
    description: 'Centrifuges, filtering machinery',
    descriptionCn: '离心机、过滤机械',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84212100',
        description: 'Machinery for filtering water',
        descriptionCn: '水过滤设备',
        dutyRate: 1.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84212300',
        description: 'Oil or petrol-filters for internal combustion engines',
        descriptionCn: '内燃机用油过滤器',
        dutyRate: 1.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8443': {
    description: 'Printing machinery, printers, copiers',
    descriptionCn: '印刷机械、打印机、复印机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84433100',
        description: 'Machines performing printing function',
        descriptionCn: '具有打印功能的机器',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '84433200',
        description: 'Printers, copiers, facsimile machines',
        descriptionCn: '打印机、复印机、传真机',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '8450': {
    description: 'Household or laundry-type washing machines',
    descriptionCn: '家用或洗衣店用洗衣机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84501100',
        description: 'Fully-automatic household washing machines',
        descriptionCn: '全自动家用洗衣机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84501200',
        description: 'Other household washing machines with built-in centrifuge',
        descriptionCn: '带内置离心机的其他家用洗衣机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84501900',
        description: 'Other household washing machines',
        descriptionCn: '其他家用洗衣机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8467': {
    description: 'Tools for working in the hand, pneumatic or motor',
    descriptionCn: '手提式气动或电动工具',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84672100',
        description: 'Electro-mechanical drills',
        descriptionCn: '电动手钻',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84672200',
        description: 'Electro-mechanical saws',
        descriptionCn: '电动手锯',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84672900',
        description: 'Other electro-mechanical tools',
        descriptionCn: '其他电动手工具',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8471': {
    description: 'Automatic data processing machines (computers)',
    descriptionCn: '自动数据处理设备（计算机）',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84713000',
        description: 'Portable digital computers <= 10kg',
        descriptionCn: '便携式电脑 <=10kg',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '84714900',
        description: 'Other digital processing units',
        descriptionCn: '其他数字处理单元',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84715000',
        description: 'Digital processing units other than those of 8471.41 or 8471.49',
        descriptionCn: '其他数字处理设备',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '8473': {
    description: 'Parts for machines of 84.69 to 84.72',
    descriptionCn: '84.69至84.72机器零件',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84733000',
        description: 'Parts of machines of heading 84.71',
        descriptionCn: '84.71计算机零件',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      }
    ]
  },
  '8481': {
    description: 'Taps, cocks, valves and similar appliances',
    descriptionCn: '龙头、旋塞、阀门及类似装置',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84811000',
        description: 'Pressure-reducing valves',
        descriptionCn: '减压阀',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84812000',
        description: 'Valves for oleohydraulic or pneumatic transmissions',
        descriptionCn: '油压或气压传动阀门',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84813000',
        description: 'Check valves',
        descriptionCn: '止回阀',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84814000',
        description: 'Safety or relief valves',
        descriptionCn: '安全阀或溢流阀',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84818000',
        description: 'Other appliances',
        descriptionCn: '其他龙头、阀门',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8483': {
    description: 'Transmission shafts, bearings, gears',
    descriptionCn: '传动轴、轴承、齿轮',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '84831000',
        description: 'Transmission shafts and cranks',
        descriptionCn: '传动轴和曲柄',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84832000',
        description: 'Bearing housings with ball bearings',
        descriptionCn: '带滚珠轴承的轴承座',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84833000',
        description: 'Bearing housings without ball bearings',
        descriptionCn: '不带滚珠轴承的轴承座',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '84834000',
        description: 'Gears, ball screws, gearboxes',
        descriptionCn: '齿轮、滚珠丝杠、齿轮箱',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第85章：电气设备（扩展） ====================
  '8504': {
    description: 'Electrical transformers, static converters',
    descriptionCn: '变压器、静止变流器',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85043100',
        description: 'Transformers <= 1 kVA',
        descriptionCn: '变压器 <=1kVA',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85043200',
        description: 'Transformers > 1 kVA to 16 kVA',
        descriptionCn: '变压器 1-16kVA',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85044000',
        description: 'Static converters',
        descriptionCn: '静止变流器',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8506': {
    description: 'Primary cells and primary batteries',
    descriptionCn: '原电池',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85061000',
        description: 'Manganese dioxide batteries',
        descriptionCn: '二氧化锰电池',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85065000',
        description: 'Lithium batteries',
        descriptionCn: '锂电池',
        dutyRate: 4.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8507': {
    description: 'Electric accumulators',
    descriptionCn: '蓄电池',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85071000',
        description: 'Lead-acid accumulators for starting piston engines',
        descriptionCn: '起动用铅酸蓄电池',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85072000',
        description: 'Other lead-acid accumulators',
        descriptionCn: '其他铅酸蓄电池',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85076000',
        description: 'Lithium-ion accumulators',
        descriptionCn: '锂离子蓄电池',
        dutyRate: 2.7,
        antiDumpingRate: 0,
        note: '电动汽车电池重要品类'
      }
    ]
  },
  '8516': {
    description: 'Electric instantaneous water heaters, space heating',
    descriptionCn: '电热水器、电暖器',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85161000',
        description: 'Electric instantaneous water heaters',
        descriptionCn: '电热水器',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85162100',
        description: 'Electric storage heating radiators',
        descriptionCn: '电暖气',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85163200',
        description: 'Hairdressing apparatus',
        descriptionCn: '电吹风',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85164000',
        description: 'Electric smoothing irons',
        descriptionCn: '电熨斗',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85165000',
        description: 'Microwave ovens',
        descriptionCn: '微波炉',
        dutyRate: 5.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85166000',
        description: 'Electric ovens and cookers',
        descriptionCn: '电烤箱和电灶',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85167100',
        description: 'Coffee or tea makers',
        descriptionCn: '咖啡机或茶机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85167200',
        description: 'Toasters',
        descriptionCn: '面包机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85167900',
        description: 'Other electro-thermic appliances',
        descriptionCn: '其他电热器具',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8517': {
    description: 'Telephone sets, communication apparatus',
    descriptionCn: '电话机、通信设备',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85171100',
        description: 'Line telephone sets with cordless handsets',
        descriptionCn: '无绳电话',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '85171200',
        description: 'Telephones for cellular networks',
        descriptionCn: '手机',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85176100',
        description: 'Base stations',
        descriptionCn: '基站',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85176200',
        description: 'Machines for reception, conversion, transmission',
        descriptionCn: '接收、转换、发射设备',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '8518': {
    description: 'Microphones, loudspeakers, headphones',
    descriptionCn: '麦克风、扬声器、耳机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85181000',
        description: 'Microphones',
        descriptionCn: '麦克风',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85182100',
        description: 'Single loudspeakers, mounted in enclosures',
        descriptionCn: '单喇叭音箱',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85182200',
        description: 'Multiple loudspeakers, mounted in enclosures',
        descriptionCn: '多喇叭音箱',
        dutyRate: 2.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85183000',
        description: 'Headphones and earphones',
        descriptionCn: '耳机',
        dutyRate: 2.5,
        antiDumpingRate: 0
      }
    ]
  },
  '8519': {
    description: 'Sound recording or reproducing apparatus',
    descriptionCn: '声音录制或重放设备',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85198100',
        description: 'Apparatus using magnetic media',
        descriptionCn: '使用磁性媒体的设备',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85198900',
        description: 'Other sound reproducing apparatus',
        descriptionCn: '其他声音重放设备',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '8528': {
    description: 'Monitors, projectors, TV receivers',
    descriptionCn: '显示器、投影仪、电视机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85284100',
        description: 'Computer monitors, CRT',
        descriptionCn: 'CRT电脑显示器',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '85285100',
        description: 'Computer monitors, other',
        descriptionCn: '其他电脑显示器',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85286200',
        description: 'Projectors',
        descriptionCn: '投影仪',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85287200',
        description: 'Television receivers, colour',
        descriptionCn: '彩色电视机',
        dutyRate: 14.0,
        antiDumpingRate: 0
      }
    ]
  },
  '8529': {
    description: 'Parts for TV, radio, communication apparatus',
    descriptionCn: '电视、无线电、通信设备零件',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85291000',
        description: 'Aerials and aerial reflectors',
        descriptionCn: '天线',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85299000',
        description: 'Other parts',
        descriptionCn: '其他零件',
        dutyRate: 3.7,
        antiDumpingRate: 0
      }
    ]
  },
  '8541': {
    description: 'Diodes, transistors, semiconductor devices',
    descriptionCn: '二极管、晶体管、半导体器件',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85411000',
        description: 'Diodes, other than photosensitive',
        descriptionCn: '二极管（光敏除外）',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '85412100',
        description: 'Transistors, with dissipation rate < 1W',
        descriptionCn: '功率<1W的晶体管',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85414000',
        description: 'Photosensitive semiconductor devices',
        descriptionCn: '光敏半导体器件',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85414020',
        description: 'Solar cells (photovoltaic cells)',
        descriptionCn: '太阳能电池（光伏电池）',
        dutyRate: 0,
        antiDumpingRate: 0,
        countervailingRate: 0,
        note: '光伏产品反倾销/反补贴措施已于2018年到期取消'
      }
    ]
  },
  '8542': {
    description: 'Electronic integrated circuits',
    descriptionCn: '集成电路',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85423100',
        description: 'Electronic integrated circuits - processors',
        descriptionCn: '处理器集成电路',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术产品免关税'
      },
      {
        hsCode8: '85423200',
        description: 'Electronic integrated circuits - memories',
        descriptionCn: '存储器集成电路',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85423300',
        description: 'Electronic integrated circuits - amplifiers',
        descriptionCn: '放大器集成电路',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85423900',
        description: 'Other electronic integrated circuits',
        descriptionCn: '其他集成电路',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '8544': {
    description: 'Insulated wire, cable, optical fibre cables',
    descriptionCn: '绝缘电线电缆、光缆',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '85441100',
        description: 'Copper winding wire',
        descriptionCn: '铜漆包线',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85442000',
        description: 'Coaxial cable',
        descriptionCn: '同轴电缆',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85444200',
        description: 'Electric conductors for <= 1000V, with connectors',
        descriptionCn: '带接头电线 <=1000V',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85446000',
        description: 'Electric conductors for > 1000V',
        descriptionCn: '电线电缆 >1000V',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '85447000',
        description: 'Optical fibre cables',
        descriptionCn: '光缆',
        dutyRate: 3.7,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第94章：家具 ====================
  '9401': {
    description: 'Seats (other than those of heading 94.02)',
    descriptionCn: '座具（94.02除外）',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '94013000',
        description: 'Swivel seats with variable height adjustment',
        descriptionCn: '可调节高度转椅',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94014000',
        description: 'Seats convertible into beds',
        descriptionCn: '沙发床',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94015200',
        description: 'Seats of bamboo',
        descriptionCn: '竹制座具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94016100',
        description: 'Upholstered seats with wooden frames',
        descriptionCn: '木架软垫座椅',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94017100',
        description: 'Upholstered seats with metal frames',
        descriptionCn: '金属架软垫座椅',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94018000',
        description: 'Other seats',
        descriptionCn: '其他座具',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '9403': {
    description: 'Other furniture',
    descriptionCn: '其他家具',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '94031000',
        description: 'Metal furniture for offices',
        descriptionCn: '金属办公家具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94032000',
        description: 'Other metal furniture',
        descriptionCn: '其他金属家具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94033000',
        description: 'Wooden furniture for offices',
        descriptionCn: '木制办公家具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94034000',
        description: 'Wooden furniture for kitchens',
        descriptionCn: '木制厨房家具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94035000',
        description: 'Wooden furniture for bedrooms',
        descriptionCn: '木制卧室家具',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94036000',
        description: 'Other wooden furniture',
        descriptionCn: '其他木制家具',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '9404': {
    description: 'Mattress supports, mattresses, bedding',
    descriptionCn: '弹簧床垫、床上用品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '94042100',
        description: 'Mattresses of cellular rubber or plastics',
        descriptionCn: '泡沫橡胶或塑料床垫',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94042900',
        description: 'Mattresses of other materials',
        descriptionCn: '其他材料床垫',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94043000',
        description: 'Sleeping bags',
        descriptionCn: '睡袋',
        dutyRate: 12.0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94049000',
        description: 'Other bedding (quilts, pillows)',
        descriptionCn: '其他床上用品（被褥、枕头）',
        dutyRate: 3.7,
        antiDumpingRate: 0
      }
    ]
  },
  '9405': {
    description: 'Lamps, lighting fittings, illuminated signs',
    descriptionCn: '灯具、照明设备、发光标志',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '94051000',
        description: 'Chandeliers and ceiling or wall fittings',
        descriptionCn: '枝形吊灯及天花板或墙壁灯具',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94052000',
        description: 'Electric table, desk, bedside lamps',
        descriptionCn: '电气台灯、床头灯',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94053000',
        description: 'Lighting strings (Christmas lights)',
        descriptionCn: '灯串（圣诞灯）',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94054000',
        description: 'Other electric lamps and lighting fittings',
        descriptionCn: '其他电气灯具',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '94054200',
        description: 'LED lamps and lighting fittings',
        descriptionCn: 'LED灯具',
        dutyRate: 3.7,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第95章：玩具游戏 ====================
  '9503': {
    description: 'Tricycles, scooters, pedal cars, toys, scale models',
    descriptionCn: '三轮车、滑板车、踏板车、玩具、模型',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '95030010',
        description: 'Tricycles, scooters, pedal cars',
        descriptionCn: '三轮车、滑板车、踏板车',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030021',
        description: 'Dolls representing only human beings',
        descriptionCn: '人形玩偶',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030030',
        description: 'Electric trains, model railways',
        descriptionCn: '电动火车、铁路模型',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030041',
        description: 'Reduced-size scale model assemblies',
        descriptionCn: '缩小比例模型组件',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030049',
        description: 'Other construction sets and toys',
        descriptionCn: '其他组装玩具',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030055',
        description: 'Toys representing animals or creatures',
        descriptionCn: '动物/生物形玩具',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030061',
        description: 'Wooden toys',
        descriptionCn: '木制玩具',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030070',
        description: 'Toys put up in sets or outfits',
        descriptionCn: '成套或成组玩具',
        dutyRate: 4.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95030079',
        description: 'Other toys',
        descriptionCn: '其他玩具',
        dutyRate: 4.7,
        antiDumpingRate: 0
      }
    ]
  },
  '9504': {
    description: 'Articles for funfair, table or parlour games',
    descriptionCn: '游乐场、桌面或室内游戏用品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '95043000',
        description: 'Other games operated by coins',
        descriptionCn: '投币式游戏机',
        dutyRate: 0,
        antiDumpingRate: 0,
        note: '信息技术协议产品'
      },
      {
        hsCode8: '95044000',
        description: 'Playing cards',
        descriptionCn: '扑克牌',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95045000',
        description: 'Video game consoles and machines',
        descriptionCn: '视频游戏机',
        dutyRate: 0,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95049000',
        description: 'Other table or parlour games',
        descriptionCn: '其他桌面/室内游戏',
        dutyRate: 0,
        antiDumpingRate: 0
      }
    ]
  },
  '9506': {
    description: 'Articles for general physical exercise, gymnastics',
    descriptionCn: '体育锻炼、体操用品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '95061100',
        description: 'Skis',
        descriptionCn: '滑雪板',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95062100',
        description: 'Sailboards',
        descriptionCn: '帆板',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95063100',
        description: 'Golf clubs, complete',
        descriptionCn: '高尔夫球杆整套',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95064000',
        description: 'Articles for table-tennis',
        descriptionCn: '乒乓球用品',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95065100',
        description: 'Lawn-tennis rackets',
        descriptionCn: '网球拍',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95066100',
        description: 'Lawn-tennis balls',
        descriptionCn: '网球',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95066200',
        description: 'Inflatable balls',
        descriptionCn: '充气球',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95067000',
        description: 'Ice skates and roller skates',
        descriptionCn: '冰鞋和滑冰鞋',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '95069100',
        description: 'Articles for general physical exercise',
        descriptionCn: '健身器材',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },

  // ==================== 第96章：杂项制品 ====================
  '9608': {
    description: 'Ball point pens, felt tipped pens, markers',
    descriptionCn: '圆珠笔、毡尖笔、记号笔',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '96081000',
        description: 'Ball point pens',
        descriptionCn: '圆珠笔',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '96082000',
        description: 'Felt tipped and other porous-tipped pens',
        descriptionCn: '毡尖笔和其他多孔尖笔',
        dutyRate: 3.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '96083100',
        description: 'Indian ink drawing pens',
        descriptionCn: '墨水绘图笔',
        dutyRate: 3.7,
        antiDumpingRate: 0
      }
    ]
  },
  '9613': {
    description: 'Cigarette lighters and other lighters',
    descriptionCn: '打火机',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '96131000',
        description: 'Pocket lighters, gas fuelled, non-refillable',
        descriptionCn: '一次性气体打火机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      },
      {
        hsCode8: '96132000',
        description: 'Pocket lighters, gas fuelled, refillable',
        descriptionCn: '可充气打火机',
        dutyRate: 2.7,
        antiDumpingRate: 0
      }
    ]
  },
  '9619': {
    description: 'Sanitary towels, napkins, nappies and similar articles',
    descriptionCn: '卫生巾、尿布及类似物品',
    originCountryCode: 'CN',
    measures: [
      {
        hsCode8: '96190010',
        description: 'Sanitary towels and tampons',
        descriptionCn: '卫生巾和卫生棉条',
        dutyRate: 6.5,
        antiDumpingRate: 0
      },
      {
        hsCode8: '96190020',
        description: 'Napkins for babies',
        descriptionCn: '婴儿纸尿裤',
        dutyRate: 6.5,
        antiDumpingRate: 0
      }
    ]
  }
}

// ==================== 工具函数 ====================

/**
 * 查找 HS 编码针对中国的反倾销/反补贴税率
 * @param {string} hsCode - HS 编码（4-10位）
 * @returns {Object|null} 税率信息
 */
export function findChinaAntiDumpingRate(hsCode) {
  const code = hsCode.replace(/\D/g, '')
  const code4 = code.substring(0, 4)
  const code8 = code.length >= 8 ? code.substring(0, 8) : null
  
  const chapter = CHINA_ANTI_DUMPING_RATES[code4]
  if (!chapter) {
    return null
  }
  
  // 尝试精确匹配 8 位编码
  if (code8 && chapter.measures) {
    const measure = chapter.measures.find(m => m.hsCode8 === code8)
    if (measure) {
      return {
        hsCode: code8,
        hsCode10: code.padEnd(10, '0').substring(0, 10),
        originCountryCode: 'CN',
        originCountry: 'China',
        description: measure.description,
        descriptionCn: measure.descriptionCn,
        dutyRate: measure.dutyRate,
        antiDumpingRate: measure.antiDumpingRate,
        antiDumpingRateRange: measure.antiDumpingRateRange || null,
        countervailingRate: measure.countervailingRate || 0,
        regulationId: measure.regulationId || null,
        validFrom: measure.validFrom || null,
        note: measure.note || null,
        dataSource: 'china_anti_dumping_database',
        totalDutyRate: measure.dutyRate + measure.antiDumpingRate + (measure.countervailingRate || 0)
      }
    }
  }
  
  // 返回章节级别的信息（取第一个措施作为参考）
  if (chapter.measures && chapter.measures.length > 0) {
    const firstMeasure = chapter.measures[0]
    return {
      hsCode: code4,
      hsCode10: code.padEnd(10, '0').substring(0, 10),
      originCountryCode: 'CN',
      originCountry: 'China',
      description: chapter.description,
      descriptionCn: chapter.descriptionCn,
      dutyRate: firstMeasure.dutyRate,
      antiDumpingRate: firstMeasure.antiDumpingRate,
      antiDumpingRateRange: firstMeasure.antiDumpingRateRange || null,
      countervailingRate: firstMeasure.countervailingRate || 0,
      regulationId: firstMeasure.regulationId || null,
      validFrom: firstMeasure.validFrom || null,
      note: '章节级别数据，具体子编码税率可能不同',
      dataSource: 'china_anti_dumping_database',
      totalDutyRate: firstMeasure.dutyRate + firstMeasure.antiDumpingRate + (firstMeasure.countervailingRate || 0)
    }
  }
  
  return null
}

/**
 * 获取所有中国反倾销税率数据
 */
export function getAllChinaAntiDumpingRates() {
  return CHINA_ANTI_DUMPING_RATES
}

/**
 * 获取所有具有反倾销税的 HS 编码列表
 */
export function getAntiDumpingHsCodes() {
  const codes = []
  
  for (const [code4, chapter] of Object.entries(CHINA_ANTI_DUMPING_RATES)) {
    if (chapter.measures) {
      for (const measure of chapter.measures) {
        if (measure.antiDumpingRate > 0) {
          codes.push({
            hsCode4: code4,
            hsCode8: measure.hsCode8,
            description: measure.description,
            descriptionCn: measure.descriptionCn,
            antiDumpingRate: measure.antiDumpingRate,
            antiDumpingRateRange: measure.antiDumpingRateRange
          })
        }
      }
    }
  }
  
  return codes
}

/**
 * 检查 HS 编码是否需要反倾销税（针对中国原产）
 * @param {string} hsCode - HS 编码
 * @returns {boolean}
 */
export function hasAntiDumpingDuty(hsCode) {
  const result = findChinaAntiDumpingRate(hsCode)
  return result ? result.antiDumpingRate > 0 : false
}

/**
 * 获取按产品类别分组的反倾销税数据摘要
 */
export function getAntiDumpingSummary() {
  const summary = {
    totalCategories: 0,
    totalMeasures: 0,
    categories: []
  }
  
  const categoryNames = {
    '28': '无机化学品',
    '29': '有机化学品',
    '30': '药品',
    '31': '肥料',
    '32': '颜料染料',
    '38': '杂项化学品',
    '39': '塑料及制品',
    '40': '橡胶制品',
    '44': '木材及制品',
    '48': '纸制品',
    '50': '丝绸',
    '52': '棉织品',
    '54': '人造纤维长丝',
    '55': '人造纤维短纤',
    '60': '针织物',
    '61': '针织服装',
    '62': '非针织服装',
    '63': '其他纺织品',
    '64': '鞋类',
    '69': '陶瓷制品',
    '70': '玻璃及制品',
    '72': '钢铁制品',
    '73': '钢铁制品',
    '76': '铝及制品',
    '84': '机械设备',
    '85': '电气设备',
    '87': '车辆',
    '94': '家具',
    '95': '玩具游戏',
    '96': '杂项制品'
  }
  
  for (const [code4, chapter] of Object.entries(CHINA_ANTI_DUMPING_RATES)) {
    const chapter2 = code4.substring(0, 2)
    const categoryName = categoryNames[chapter2] || '其他'
    
    let category = summary.categories.find(c => c.chapter === chapter2)
    if (!category) {
      category = {
        chapter: chapter2,
        name: categoryName,
        products: [],
        measureCount: 0
      }
      summary.categories.push(category)
      summary.totalCategories++
    }
    
    if (chapter.measures) {
      for (const measure of chapter.measures) {
        if (measure.antiDumpingRate > 0) {
          category.products.push({
            hsCode: measure.hsCode8,
            description: measure.descriptionCn,
            antiDumpingRate: measure.antiDumpingRate
          })
          category.measureCount++
          summary.totalMeasures++
        }
      }
    }
  }
  
  return summary
}

export default {
  CHINA_ANTI_DUMPING_RATES,
  findChinaAntiDumpingRate,
  getAllChinaAntiDumpingRates,
  getAntiDumpingHsCodes,
  hasAntiDumpingDuty,
  getAntiDumpingSummary
}
