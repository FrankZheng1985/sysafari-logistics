/**
 * 中国原产地 HS Code 完整同步脚本 - 第三批
 * 补充化学品、医疗器械、光学仪器等行业
 */

import pg from 'pg'

const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})

const CHINA_HS_CODES_BATCH3 = [
  // ==================== 第29章：有机化学品 ====================
  { hs: '2901100000', desc_cn: '饱和无环烃', desc_en: 'Saturated acyclic hydrocarbons', duty: 0, ad: 0 },
  { hs: '2901210000', desc_cn: '乙烯', desc_en: 'Ethylene', duty: 0, ad: 0 },
  { hs: '2901220000', desc_cn: '丙烯', desc_en: 'Propene', duty: 0, ad: 0 },
  { hs: '2901230000', desc_cn: '丁烯', desc_en: 'Butene', duty: 0, ad: 0 },
  { hs: '2901240000', desc_cn: '丁二烯', desc_en: 'Butadiene', duty: 0, ad: 0 },
  { hs: '2901290000', desc_cn: '其他不饱和烃', desc_en: 'Other unsaturated hydrocarbons', duty: 0, ad: 0 },
  { hs: '2902110000', desc_cn: '环己烷', desc_en: 'Cyclohexane', duty: 0, ad: 0 },
  { hs: '2902200000', desc_cn: '苯', desc_en: 'Benzene', duty: 0, ad: 0 },
  { hs: '2902300000', desc_cn: '甲苯', desc_en: 'Toluene', duty: 0, ad: 0 },
  { hs: '2902410000', desc_cn: '邻二甲苯', desc_en: 'o-Xylene', duty: 0, ad: 0 },
  { hs: '2902420000', desc_cn: '间二甲苯', desc_en: 'm-Xylene', duty: 0, ad: 0 },
  { hs: '2902430000', desc_cn: '对二甲苯', desc_en: 'p-Xylene', duty: 0, ad: 0 },
  { hs: '2902440000', desc_cn: '混合二甲苯异构体', desc_en: 'Mixed xylene isomers', duty: 0, ad: 0 },
  { hs: '2902500000', desc_cn: '苯乙烯', desc_en: 'Styrene', duty: 0, ad: 0 },
  { hs: '2902600000', desc_cn: '乙苯', desc_en: 'Ethylbenzene', duty: 0, ad: 0 },
  { hs: '2902700000', desc_cn: '异丙苯', desc_en: 'Cumene', duty: 0, ad: 0 },
  { hs: '2902900000', desc_cn: '其他环烃', desc_en: 'Other cyclic hydrocarbons', duty: 0, ad: 0 },
  { hs: '2905110000', desc_cn: '甲醇', desc_en: 'Methanol', duty: 5.5, ad: 0 },
  { hs: '2905120000', desc_cn: '丙醇', desc_en: 'Propan-1-ol propan-2-ol', duty: 5.5, ad: 0 },
  { hs: '2905130000', desc_cn: '正丁醇', desc_en: 'Butan-1-ol', duty: 5.5, ad: 0 },
  { hs: '2905140000', desc_cn: '其他丁醇', desc_en: 'Other butanols', duty: 5.5, ad: 0 },
  { hs: '2905160000', desc_cn: '辛醇', desc_en: 'Octanol and isomers', duty: 5.5, ad: 0 },
  { hs: '2905170000', desc_cn: '十二烷醇等', desc_en: 'Dodecan-1-ol and others', duty: 5.5, ad: 0 },
  { hs: '2905190000', desc_cn: '其他饱和一元醇', desc_en: 'Other saturated monohydric alcohols', duty: 5.5, ad: 0 },
  { hs: '2905220000', desc_cn: '香茅醇等萜品醇', desc_en: 'Acyclic terpene alcohols', duty: 5.5, ad: 0 },
  { hs: '2905290000', desc_cn: '其他不饱和一元醇', desc_en: 'Other unsaturated monohydric alcohols', duty: 5.5, ad: 0 },
  { hs: '2905310000', desc_cn: '乙二醇', desc_en: 'Ethylene glycol', duty: 5.5, ad: 0 },
  { hs: '2905320000', desc_cn: '丙二醇', desc_en: 'Propylene glycol', duty: 5.5, ad: 0 },
  { hs: '2905390000', desc_cn: '其他二元醇', desc_en: 'Other diols', duty: 5.5, ad: 0 },
  { hs: '2905410000', desc_cn: '三羟甲基丙烷', desc_en: '2-Ethyl-2-hydroxymethyl-propane-1,3-diol', duty: 5.5, ad: 0 },
  { hs: '2905420000', desc_cn: '季戊四醇', desc_en: 'Pentaerythritol', duty: 5.5, ad: 0 },
  { hs: '2905430000', desc_cn: '甘露醇', desc_en: 'Mannitol', duty: 5.5, ad: 0 },
  { hs: '2905440000', desc_cn: 'D-山梨醇', desc_en: 'D-glucitol sorbitol', duty: 5.5, ad: 0 },
  { hs: '2905450000', desc_cn: '甘油', desc_en: 'Glycerol', duty: 5.5, ad: 0 },
  { hs: '2905490000', desc_cn: '其他多元醇', desc_en: 'Other polyhydric alcohols', duty: 5.5, ad: 0 },
  { hs: '2905510000', desc_cn: '乙炔醇', desc_en: 'Ethchlorvynol', duty: 5.5, ad: 0 },
  { hs: '2905590000', desc_cn: '其他醇的卤化衍生物', desc_en: 'Other halogenated derivatives', duty: 5.5, ad: 0 },
  
  // ==================== 第38章：杂项化学品 ====================
  { hs: '3801100000', desc_cn: '人造石墨', desc_en: 'Artificial graphite', duty: 5.3, ad: 0 },
  { hs: '3801200000', desc_cn: '胶态石墨', desc_en: 'Colloidal graphite', duty: 5.3, ad: 0 },
  { hs: '3801300000', desc_cn: '碳电极糊', desc_en: 'Carbonaceous pastes for electrodes', duty: 5.3, ad: 0 },
  { hs: '3801900000', desc_cn: '其他石墨产品', desc_en: 'Other graphite products', duty: 5.3, ad: 0 },
  { hs: '3802100000', desc_cn: '活性炭', desc_en: 'Activated carbon', duty: 5.3, ad: 0 },
  { hs: '3802900000', desc_cn: '其他活性天然矿物产品', desc_en: 'Other activated natural mineral products', duty: 5.3, ad: 0 },
  { hs: '3806100000', desc_cn: '松香', desc_en: 'Rosin', duty: 4.4, ad: 0 },
  { hs: '3806200000', desc_cn: '松香盐', desc_en: 'Salts of rosin', duty: 4.4, ad: 0 },
  { hs: '3806300000', desc_cn: '酯胶', desc_en: 'Ester gums', duty: 4.4, ad: 0 },
  { hs: '3806900000', desc_cn: '其他松香衍生物', desc_en: 'Other rosin derivatives', duty: 4.4, ad: 0 },
  { hs: '3808911000', desc_cn: '杀虫剂', desc_en: 'Insecticides', duty: 6.5, ad: 0 },
  { hs: '3808919000', desc_cn: '其他杀虫剂', desc_en: 'Other insecticides', duty: 6.5, ad: 0 },
  { hs: '3808921000', desc_cn: '杀菌剂', desc_en: 'Fungicides', duty: 6.5, ad: 0 },
  { hs: '3808929000', desc_cn: '其他杀菌剂', desc_en: 'Other fungicides', duty: 6.5, ad: 0 },
  { hs: '3808931000', desc_cn: '除草剂', desc_en: 'Herbicides', duty: 6.5, ad: 0 },
  { hs: '3808939000', desc_cn: '其他除草剂', desc_en: 'Other herbicides', duty: 6.5, ad: 0 },
  { hs: '3808941000', desc_cn: '消毒剂', desc_en: 'Disinfectants', duty: 6.5, ad: 0 },
  { hs: '3808949000', desc_cn: '其他消毒剂', desc_en: 'Other disinfectants', duty: 6.5, ad: 0 },
  { hs: '3808990000', desc_cn: '其他植物保护制品', desc_en: 'Other plant-protection products', duty: 6.5, ad: 0 },
  { hs: '3809100000', desc_cn: '纺织整理剂', desc_en: 'Finishing agents for textiles', duty: 6.5, ad: 0 },
  { hs: '3809910000', desc_cn: '纺织工业用其他产品', desc_en: 'Other products for textile industry', duty: 6.5, ad: 0 },
  { hs: '3809920000', desc_cn: '造纸工业用其他产品', desc_en: 'Other products for paper industry', duty: 6.5, ad: 0 },
  { hs: '3809930000', desc_cn: '皮革工业用其他产品', desc_en: 'Other products for leather industry', duty: 6.5, ad: 0 },
  { hs: '3810100000', desc_cn: '金属表面酸洗剂', desc_en: 'Pickling preparations for metals', duty: 6.5, ad: 0 },
  { hs: '3810900000', desc_cn: '其他助熔剂等', desc_en: 'Other fluxes and preparations', duty: 6.5, ad: 0 },
  { hs: '3811110000', desc_cn: '抗震剂', desc_en: 'Anti-knock preparations', duty: 6.5, ad: 0 },
  { hs: '3811190000', desc_cn: '其他抗震剂', desc_en: 'Other anti-knock preparations', duty: 6.5, ad: 0 },
  { hs: '3811210000', desc_cn: '含石油的添加剂', desc_en: 'Additives containing petroleum', duty: 6.5, ad: 0 },
  { hs: '3811290000', desc_cn: '其他润滑油添加剂', desc_en: 'Other lubricating oil additives', duty: 6.5, ad: 0 },
  { hs: '3811900000', desc_cn: '其他燃料添加剂', desc_en: 'Other fuel additives', duty: 6.5, ad: 0 },
  { hs: '3812100000', desc_cn: '橡胶硫化促进剂', desc_en: 'Rubber accelerators', duty: 6.5, ad: 0 },
  { hs: '3812200000', desc_cn: '橡胶塑料复合稳定剂', desc_en: 'Compound plasticizers for rubber plastic', duty: 6.5, ad: 0 },
  { hs: '3812310000', desc_cn: '含溴的混合物', desc_en: 'Mixtures containing brominated derivatives', duty: 6.5, ad: 0 },
  { hs: '3812390000', desc_cn: '其他阻燃剂', desc_en: 'Other fire retardants', duty: 6.5, ad: 0 },
  { hs: '3813000000', desc_cn: '灭火器配制品', desc_en: 'Preparations for fire-extinguishers', duty: 6.5, ad: 0 },
  { hs: '3814000000', desc_cn: '有机复合溶剂', desc_en: 'Organic composite solvents', duty: 6.5, ad: 0 },
  { hs: '3815110000', desc_cn: '镍为活性物的催化剂', desc_en: 'Catalysts with nickel', duty: 6.5, ad: 0 },
  { hs: '3815120000', desc_cn: '贵金属为活性物的催化剂', desc_en: 'Catalysts with precious metal', duty: 6.5, ad: 0 },
  { hs: '3815190000', desc_cn: '其他载体催化剂', desc_en: 'Other supported catalysts', duty: 6.5, ad: 0 },
  { hs: '3815900000', desc_cn: '其他反应引发剂催化剂', desc_en: 'Other reaction initiators catalysts', duty: 6.5, ad: 0 },
  { hs: '3816000000', desc_cn: '耐火水泥', desc_en: 'Refractory cements', duty: 4, ad: 0 },
  { hs: '3817000000', desc_cn: '混合烷基苯', desc_en: 'Mixed alkylbenzenes', duty: 6.5, ad: 0 },
  { hs: '3818000000', desc_cn: '电子工业用化学品', desc_en: 'Chemical elements for electronics', duty: 0, ad: 0 },
  { hs: '3819000000', desc_cn: '液压制动液', desc_en: 'Hydraulic brake fluids', duty: 6.5, ad: 0 },
  { hs: '3820000000', desc_cn: '防冻剂', desc_en: 'Anti-freezing preparations', duty: 6.5, ad: 0 },
  { hs: '3821000000', desc_cn: '培养基', desc_en: 'Prepared culture media', duty: 0, ad: 0 },
  { hs: '3822000000', desc_cn: '诊断试剂', desc_en: 'Diagnostic reagents', duty: 0, ad: 0 },
  { hs: '3823110000', desc_cn: '硬脂酸', desc_en: 'Stearic acid', duty: 6.5, ad: 0 },
  { hs: '3823120000', desc_cn: '油酸', desc_en: 'Oleic acid', duty: 6.5, ad: 0 },
  { hs: '3823130000', desc_cn: '妥尔油脂肪酸', desc_en: 'Tall oil fatty acids', duty: 6.5, ad: 0 },
  { hs: '3823190000', desc_cn: '其他工业脂肪酸', desc_en: 'Other industrial fatty acids', duty: 6.5, ad: 0 },
  { hs: '3823700000', desc_cn: '工业脂肪醇', desc_en: 'Industrial fatty alcohols', duty: 6.5, ad: 0 },
  { hs: '3824100000', desc_cn: '铸模及型芯用粘合剂', desc_en: 'Foundry core binders', duty: 6.5, ad: 0 },
  { hs: '3824400000', desc_cn: '水泥砂浆混凝土添加剂', desc_en: 'Additives for cements mortars', duty: 6.5, ad: 0 },
  { hs: '3824500000', desc_cn: '非耐火灰泥', desc_en: 'Non-refractory mortars', duty: 6.5, ad: 0 },
  { hs: '3824600000', desc_cn: '山梨醇', desc_en: 'Sorbitol', duty: 6.5, ad: 0 },
  { hs: '3824810000', desc_cn: '含氧代反式苯丙烯酸衍生物', desc_en: 'Containing oxirane', duty: 6.5, ad: 0 },
  { hs: '3824820000', desc_cn: '含多氯联苯', desc_en: 'Containing polychlorinated biphenyls', duty: 6.5, ad: 0 },
  { hs: '3824830000', desc_cn: '含三(2,3-二溴丙基)磷酸酯', desc_en: 'Containing tris-phosphate', duty: 6.5, ad: 0 },
  { hs: '3824990000', desc_cn: '其他化学制品', desc_en: 'Other chemical products', duty: 6.5, ad: 0 },
  
  // ==================== 第90章：光学仪器及医疗器械 ====================
  { hs: '9001100000', desc_cn: '光导纤维', desc_en: 'Optical fibres', duty: 0, ad: 0 },
  { hs: '9001200000', desc_cn: '偏振材料制品', desc_en: 'Polarising material', duty: 0, ad: 0 },
  { hs: '9001300000', desc_cn: '隐形眼镜', desc_en: 'Contact lenses', duty: 2.9, ad: 0 },
  { hs: '9001400000', desc_cn: '玻璃制眼镜片', desc_en: 'Spectacle lenses of glass', duty: 2.9, ad: 0 },
  { hs: '9001500000', desc_cn: '其他材料眼镜片', desc_en: 'Spectacle lenses of other materials', duty: 2.9, ad: 0 },
  { hs: '9001900000', desc_cn: '未装配光学元件', desc_en: 'Unmounted optical elements', duty: 0, ad: 0 },
  { hs: '9002110000', desc_cn: '照相机镜头', desc_en: 'Objective lenses for cameras', duty: 0, ad: 0 },
  { hs: '9002190000', desc_cn: '其他物镜', desc_en: 'Other objective lenses', duty: 0, ad: 0 },
  { hs: '9002200000', desc_cn: '滤色镜', desc_en: 'Filters', duty: 0, ad: 0 },
  { hs: '9002900000', desc_cn: '其他已装配光学元件', desc_en: 'Other mounted optical elements', duty: 0, ad: 0 },
  { hs: '9003110000', desc_cn: '塑料制眼镜架', desc_en: 'Plastic spectacle frames', duty: 2.2, ad: 0 },
  { hs: '9003190000', desc_cn: '其他材料眼镜架', desc_en: 'Other material spectacle frames', duty: 2.2, ad: 0 },
  { hs: '9003900000', desc_cn: '眼镜零件', desc_en: 'Parts of spectacle frames', duty: 2.2, ad: 0 },
  { hs: '9004100000', desc_cn: '太阳眼镜', desc_en: 'Sunglasses', duty: 2.9, ad: 0 },
  { hs: '9004900000', desc_cn: '其他眼镜', desc_en: 'Other spectacles', duty: 2.9, ad: 0 },
  { hs: '9005100000', desc_cn: '双筒望远镜', desc_en: 'Binoculars', duty: 4.2, ad: 0 },
  { hs: '9005800000', desc_cn: '其他望远镜', desc_en: 'Other telescopes', duty: 4.2, ad: 0 },
  { hs: '9005900000', desc_cn: '望远镜零件', desc_en: 'Parts of telescopes', duty: 4.2, ad: 0 },
  { hs: '9006100000', desc_cn: '制版照相机', desc_en: 'Process cameras', duty: 4.2, ad: 0 },
  { hs: '9006300000', desc_cn: '水下及航空照相机', desc_en: 'Underwater aerial cameras', duty: 4.2, ad: 0 },
  { hs: '9006400000', desc_cn: '即显照相机', desc_en: 'Instant print cameras', duty: 4.2, ad: 0 },
  { hs: '9006510000', desc_cn: '单镜头反光照相机', desc_en: 'Single-lens reflex cameras', duty: 4.2, ad: 0 },
  { hs: '9006520000', desc_cn: '胶卷宽度<35mm照相机', desc_en: 'Cameras film <35mm', duty: 4.2, ad: 0 },
  { hs: '9006530000', desc_cn: '35mm胶卷照相机', desc_en: 'Cameras for 35mm film', duty: 4.2, ad: 0 },
  { hs: '9006590000', desc_cn: '其他照相机', desc_en: 'Other cameras', duty: 4.2, ad: 0 },
  { hs: '9006610000', desc_cn: '闪光器', desc_en: 'Discharge lamp flashlight apparatus', duty: 0, ad: 0 },
  { hs: '9006690000', desc_cn: '其他闪光设备', desc_en: 'Other flashlight apparatus', duty: 0, ad: 0 },
  { hs: '9006910000', desc_cn: '照相机零件', desc_en: 'Parts of cameras', duty: 0, ad: 0 },
  { hs: '9007100000', desc_cn: '电影摄影机', desc_en: 'Cinematographic cameras', duty: 0, ad: 0 },
  { hs: '9007200000', desc_cn: '电影放映机', desc_en: 'Cinematographic projectors', duty: 0, ad: 0 },
  { hs: '9007910000', desc_cn: '电影摄影机零件', desc_en: 'Parts of cinematographic cameras', duty: 0, ad: 0 },
  { hs: '9007920000', desc_cn: '电影放映机零件', desc_en: 'Parts of cinematographic projectors', duty: 0, ad: 0 },
  { hs: '9008500000', desc_cn: '投影器', desc_en: 'Image projectors', duty: 0, ad: 0 },
  { hs: '9008900000', desc_cn: '投影器零件', desc_en: 'Parts of projectors', duty: 0, ad: 0 },
  { hs: '9010100000', desc_cn: '胶卷自动冲洗设备', desc_en: 'Film developing equipment', duty: 0, ad: 0 },
  { hs: '9010500000', desc_cn: '其他冲洗设备', desc_en: 'Other developing equipment', duty: 0, ad: 0 },
  { hs: '9010600000', desc_cn: '银幕', desc_en: 'Projection screens', duty: 0, ad: 0 },
  { hs: '9010900000', desc_cn: '零件附件', desc_en: 'Parts and accessories', duty: 0, ad: 0 },
  { hs: '9011100000', desc_cn: '立体显微镜', desc_en: 'Stereoscopic microscopes', duty: 0, ad: 0 },
  { hs: '9011200000', desc_cn: '其他显微镜', desc_en: 'Other microscopes', duty: 0, ad: 0 },
  { hs: '9011800000', desc_cn: '其他显微镜', desc_en: 'Other microscopes', duty: 0, ad: 0 },
  { hs: '9011900000', desc_cn: '显微镜零件', desc_en: 'Parts of microscopes', duty: 0, ad: 0 },
  { hs: '9012100000', desc_cn: '非光学显微镜', desc_en: 'Microscopes non-optical', duty: 0, ad: 0 },
  { hs: '9012900000', desc_cn: '非光学显微镜零件', desc_en: 'Parts of non-optical microscopes', duty: 0, ad: 0 },
  { hs: '9013100000', desc_cn: '瞄准具', desc_en: 'Telescopic sights', duty: 0, ad: 0 },
  { hs: '9013200000', desc_cn: '激光器', desc_en: 'Lasers', duty: 0, ad: 0 },
  { hs: '9013800000', desc_cn: '其他光学设备', desc_en: 'Other optical devices', duty: 0, ad: 0 },
  { hs: '9013900000', desc_cn: '光学设备零件', desc_en: 'Parts of optical devices', duty: 0, ad: 0 },
  { hs: '9014100000', desc_cn: '罗盘', desc_en: 'Direction finding compasses', duty: 3.7, ad: 0 },
  { hs: '9014200000', desc_cn: '航空航海仪器', desc_en: 'Instruments for aeronautical navigation', duty: 0, ad: 0 },
  { hs: '9014800000', desc_cn: '其他导航仪器', desc_en: 'Other navigational instruments', duty: 0, ad: 0 },
  { hs: '9014900000', desc_cn: '导航仪器零件', desc_en: 'Parts of navigation instruments', duty: 0, ad: 0 },
  { hs: '9015100000', desc_cn: '测距仪', desc_en: 'Rangefinders', duty: 0, ad: 0 },
  { hs: '9015200000', desc_cn: '经纬仪及视距仪', desc_en: 'Theodolites tacheometers', duty: 0, ad: 0 },
  { hs: '9015300000', desc_cn: '水平仪', desc_en: 'Levels', duty: 0, ad: 0 },
  { hs: '9015400000', desc_cn: '摄影测量仪器', desc_en: 'Photogrammetrical instruments', duty: 0, ad: 0 },
  { hs: '9015800000', desc_cn: '其他测量仪器', desc_en: 'Other surveying instruments', duty: 0, ad: 0 },
  { hs: '9015900000', desc_cn: '测量仪器零件', desc_en: 'Parts of surveying instruments', duty: 0, ad: 0 },
  { hs: '9016000000', desc_cn: '天平', desc_en: 'Balances', duty: 0, ad: 0 },
  { hs: '9017100000', desc_cn: '绘图台及机器', desc_en: 'Drafting tables and machines', duty: 0, ad: 0 },
  { hs: '9017200000', desc_cn: '其他绘图仪器', desc_en: 'Other drawing instruments', duty: 0, ad: 0 },
  { hs: '9017300000', desc_cn: '千分尺及卡尺', desc_en: 'Micrometers and callipers', duty: 0, ad: 0 },
  { hs: '9017800000', desc_cn: '其他手用测量仪器', desc_en: 'Other hand measuring instruments', duty: 0, ad: 0 },
  { hs: '9017900000', desc_cn: '绘图测量仪器零件', desc_en: 'Parts of drawing measuring instruments', duty: 0, ad: 0 },
  { hs: '9018110000', desc_cn: '心电图记录仪', desc_en: 'Electro-cardiographs', duty: 0, ad: 0 },
  { hs: '9018120000', desc_cn: '超声波扫描装置', desc_en: 'Ultrasonic scanning apparatus', duty: 0, ad: 0 },
  { hs: '9018130000', desc_cn: '核磁共振成像装置', desc_en: 'Magnetic resonance imaging apparatus', duty: 0, ad: 0 },
  { hs: '9018140000', desc_cn: '闪烁摄影装置', desc_en: 'Scintigraphic apparatus', duty: 0, ad: 0 },
  { hs: '9018190000', desc_cn: '其他电气诊断装置', desc_en: 'Other electro-diagnostic apparatus', duty: 0, ad: 0 },
  { hs: '9018200000', desc_cn: '紫外线红外线装置', desc_en: 'Ultra-violet infra-red apparatus', duty: 0, ad: 0 },
  { hs: '9018310000', desc_cn: '注射器', desc_en: 'Syringes', duty: 0, ad: 0 },
  { hs: '9018320000', desc_cn: '管状金属针头', desc_en: 'Tubular metal needles', duty: 0, ad: 0 },
  { hs: '9018390000', desc_cn: '其他针头导管', desc_en: 'Other needles catheters', duty: 0, ad: 0 },
  { hs: '9018410000', desc_cn: '牙钻机', desc_en: 'Dental drill engines', duty: 0, ad: 0 },
  { hs: '9018490000', desc_cn: '其他牙科设备', desc_en: 'Other dental equipment', duty: 0, ad: 0 },
  { hs: '9018500000', desc_cn: '眼科设备', desc_en: 'Ophthalmic instruments', duty: 0, ad: 0 },
  { hs: '9018900000', desc_cn: '其他医疗仪器', desc_en: 'Other medical instruments', duty: 0, ad: 0 },
  { hs: '9019100000', desc_cn: '机械疗法器具', desc_en: 'Mechano-therapy appliances', duty: 0, ad: 0 },
  { hs: '9019200000', desc_cn: '臭氧疗法氧气疗法器具', desc_en: 'Ozone oxygen therapy apparatus', duty: 0, ad: 0 },
  { hs: '9020000000', desc_cn: '呼吸器具及防毒面具', desc_en: 'Breathing appliances gas masks', duty: 1.7, ad: 0 },
  { hs: '9021100000', desc_cn: '矫形器具', desc_en: 'Orthopaedic appliances', duty: 0, ad: 0 },
  { hs: '9021210000', desc_cn: '假牙', desc_en: 'Artificial teeth', duty: 0, ad: 0 },
  { hs: '9021290000', desc_cn: '其他牙齿附件', desc_en: 'Other dental fittings', duty: 0, ad: 0 },
  { hs: '9021310000', desc_cn: '人造关节', desc_en: 'Artificial joints', duty: 0, ad: 0 },
  { hs: '9021390000', desc_cn: '其他人造身体部分', desc_en: 'Other artificial body parts', duty: 0, ad: 0 },
  { hs: '9021400000', desc_cn: '助听器', desc_en: 'Hearing aids', duty: 0, ad: 0 },
  { hs: '9021500000', desc_cn: '心脏起搏器', desc_en: 'Pacemakers', duty: 0, ad: 0 },
  { hs: '9021900000', desc_cn: '其他矫形器具', desc_en: 'Other orthopaedic appliances', duty: 0, ad: 0 },
  { hs: '9022120000', desc_cn: 'X射线断层检查仪', desc_en: 'Computed tomography apparatus', duty: 0, ad: 0 },
  { hs: '9022130000', desc_cn: '牙科用X射线设备', desc_en: 'X-ray apparatus for dental use', duty: 0, ad: 0 },
  { hs: '9022140000', desc_cn: '医疗用X射线设备', desc_en: 'X-ray apparatus for medical use', duty: 0, ad: 0 },
  { hs: '9022190000', desc_cn: '其他X射线设备', desc_en: 'Other X-ray apparatus', duty: 0, ad: 0 },
  { hs: '9022210000', desc_cn: '医疗用α射线设备', desc_en: 'Alpha ray apparatus for medical use', duty: 0, ad: 0 },
  { hs: '9022290000', desc_cn: '其他射线设备', desc_en: 'Other ray apparatus', duty: 0, ad: 0 },
  { hs: '9022300000', desc_cn: 'X射线管', desc_en: 'X-ray tubes', duty: 0, ad: 0 },
  { hs: '9022900000', desc_cn: '射线设备零件', desc_en: 'Parts of ray apparatus', duty: 0, ad: 0 },
  { hs: '9023000000', desc_cn: '专供示范用仪器', desc_en: 'Instruments for demonstrating', duty: 0, ad: 0 },
  { hs: '9024100000', desc_cn: '金属材料试验机', desc_en: 'Machines for testing metals', duty: 0, ad: 0 },
  { hs: '9024800000', desc_cn: '其他材料试验机', desc_en: 'Other testing machines', duty: 0, ad: 0 },
  { hs: '9024900000', desc_cn: '试验机零件', desc_en: 'Parts of testing machines', duty: 0, ad: 0 },
  { hs: '9025110000', desc_cn: '液体温度计', desc_en: 'Liquid-filled thermometers', duty: 0, ad: 0 },
  { hs: '9025190000', desc_cn: '其他温度计', desc_en: 'Other thermometers', duty: 0, ad: 0 },
  { hs: '9025800000', desc_cn: '其他温湿度计', desc_en: 'Other hygrometers', duty: 0, ad: 0 },
  { hs: '9025900000', desc_cn: '温度计零件', desc_en: 'Parts of thermometers', duty: 0, ad: 0 },
  { hs: '9026100000', desc_cn: '流量或液位仪表', desc_en: 'Flow or level measuring instruments', duty: 0, ad: 0 },
  { hs: '9026200000', desc_cn: '压力测量仪表', desc_en: 'Pressure measuring instruments', duty: 0, ad: 0 },
  { hs: '9026800000', desc_cn: '其他液体气体测量仪', desc_en: 'Other liquid gas measuring instruments', duty: 0, ad: 0 },
  { hs: '9026900000', desc_cn: '流量液位压力计零件', desc_en: 'Parts of measuring instruments', duty: 0, ad: 0 },
  { hs: '9027100000', desc_cn: '气体液体分析仪', desc_en: 'Gas liquid analysis instruments', duty: 0, ad: 0 },
  { hs: '9027200000', desc_cn: '色谱仪及电泳仪', desc_en: 'Chromatographs electrophoresis', duty: 0, ad: 0 },
  { hs: '9027300000', desc_cn: '分光仪分光光度计', desc_en: 'Spectrometers spectrophotometers', duty: 0, ad: 0 },
  { hs: '9027500000', desc_cn: '其他使用光学射线仪器', desc_en: 'Other optical radiation instruments', duty: 0, ad: 0 },
  { hs: '9027800000', desc_cn: '其他理化分析仪器', desc_en: 'Other physical chemical analysis', duty: 0, ad: 0 },
  { hs: '9027900000', desc_cn: '理化分析仪器零件', desc_en: 'Parts of analysis instruments', duty: 0, ad: 0 },
  { hs: '9028100000', desc_cn: '煤气表', desc_en: 'Gas meters', duty: 0, ad: 0 },
  { hs: '9028200000', desc_cn: '液体流量计', desc_en: 'Liquid meters', duty: 0, ad: 0 },
  { hs: '9028300000', desc_cn: '电度表', desc_en: 'Electricity meters', duty: 0, ad: 0 },
  { hs: '9028900000', desc_cn: '仪表零件', desc_en: 'Parts of meters', duty: 0, ad: 0 },
  { hs: '9029100000', desc_cn: '转数计', desc_en: 'Revolution counters', duty: 0, ad: 0 },
  { hs: '9029200000', desc_cn: '速度计及转速表', desc_en: 'Speed indicators and tachometers', duty: 0, ad: 0 },
  { hs: '9029900000', desc_cn: '计数器零件', desc_en: 'Parts of counters', duty: 0, ad: 0 },
  { hs: '9030100000', desc_cn: '电离辐射测量仪', desc_en: 'Ionising radiation measuring instruments', duty: 0, ad: 0 },
  { hs: '9030200000', desc_cn: '示波器', desc_en: 'Oscilloscopes', duty: 0, ad: 0 },
  { hs: '9030310000', desc_cn: '万用表', desc_en: 'Multimeters', duty: 0, ad: 0 },
  { hs: '9030320000', desc_cn: '万用表带记录装置', desc_en: 'Multimeters with recording device', duty: 0, ad: 0 },
  { hs: '9030330000', desc_cn: '其他不带记录装置电表', desc_en: 'Other instruments without recording', duty: 0, ad: 0 },
  { hs: '9030390000', desc_cn: '其他带记录装置电表', desc_en: 'Other instruments with recording', duty: 0, ad: 0 },
  { hs: '9030400000', desc_cn: '电信测量仪', desc_en: 'Telecommunications measuring instruments', duty: 0, ad: 0 },
  { hs: '9030820000', desc_cn: '半导体测量仪', desc_en: 'Semiconductor measuring instruments', duty: 0, ad: 0 },
  { hs: '9030840000', desc_cn: '其他带记录装置测量仪', desc_en: 'Other instruments with recording', duty: 0, ad: 0 },
  { hs: '9030890000', desc_cn: '其他不带记录装置测量仪', desc_en: 'Other instruments without recording', duty: 0, ad: 0 },
  { hs: '9030900000', desc_cn: '电量测量仪零件', desc_en: 'Parts of measuring instruments', duty: 0, ad: 0 },
  { hs: '9031100000', desc_cn: '平衡机', desc_en: 'Machines for balancing', duty: 0, ad: 0 },
  { hs: '9031200000', desc_cn: '试验台', desc_en: 'Test benches', duty: 0, ad: 0 },
  { hs: '9031410000', desc_cn: '晶片或器件检测仪', desc_en: 'Instruments for inspecting wafers', duty: 0, ad: 0 },
  { hs: '9031490000', desc_cn: '其他光学测量仪器', desc_en: 'Other optical measuring instruments', duty: 0, ad: 0 },
  { hs: '9031800000', desc_cn: '其他测量检验仪器', desc_en: 'Other measuring checking instruments', duty: 0, ad: 0 },
  { hs: '9031900000', desc_cn: '测量仪器零件', desc_en: 'Parts of measuring instruments', duty: 0, ad: 0 },
  { hs: '9032100000', desc_cn: '恒温器', desc_en: 'Thermostats', duty: 0, ad: 0 },
  { hs: '9032200000', desc_cn: '恒压器', desc_en: 'Manostats', duty: 0, ad: 0 },
  { hs: '9032810000', desc_cn: '液压气动自动调节仪器', desc_en: 'Hydraulic pneumatic automatic regulating', duty: 0, ad: 0 },
  { hs: '9032890000', desc_cn: '其他自动调节仪器', desc_en: 'Other automatic regulating instruments', duty: 0, ad: 0 },
  { hs: '9032900000', desc_cn: '自动调节仪器零件', desc_en: 'Parts of automatic regulating', duty: 0, ad: 0 },
  { hs: '9033000000', desc_cn: '仪器仪表零件', desc_en: 'Parts and accessories for machines', duty: 0, ad: 0 },
  
  // ==================== 第91章：钟表 ====================
  { hs: '9101110000', desc_cn: '机械指针表贵金属壳', desc_en: 'Mechanical wrist-watches precious metal', duty: 4.5, ad: 0 },
  { hs: '9101190000', desc_cn: '其他贵金属壳手表', desc_en: 'Other precious metal wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9101210000', desc_cn: '自动上弦贵金属壳手表', desc_en: 'Self-winding precious metal watches', duty: 4.5, ad: 0 },
  { hs: '9101290000', desc_cn: '其他贵金属壳手表', desc_en: 'Other precious metal wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9101910000', desc_cn: '电子贵金属壳怀表', desc_en: 'Electronic pocket-watches', duty: 4.5, ad: 0 },
  { hs: '9101990000', desc_cn: '其他贵金属壳怀表', desc_en: 'Other pocket-watches', duty: 4.5, ad: 0 },
  { hs: '9102110000', desc_cn: '电子数字显示手表', desc_en: 'Electronic digital wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9102120000', desc_cn: '电子指针显示手表', desc_en: 'Electronic analogue wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9102190000', desc_cn: '其他电子手表', desc_en: 'Other electronic wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9102210000', desc_cn: '自动上弦机械手表', desc_en: 'Mechanical self-winding watches', duty: 4.5, ad: 0 },
  { hs: '9102290000', desc_cn: '其他机械手表', desc_en: 'Other mechanical wrist-watches', duty: 4.5, ad: 0 },
  { hs: '9102910000', desc_cn: '电子怀表', desc_en: 'Electronic pocket-watches', duty: 4.5, ad: 0 },
  { hs: '9102990000', desc_cn: '其他怀表', desc_en: 'Other pocket-watches', duty: 4.5, ad: 0 },
  { hs: '9103100000', desc_cn: '电子闹钟', desc_en: 'Electronic alarm clocks', duty: 3.2, ad: 0 },
  { hs: '9103900000', desc_cn: '其他闹钟', desc_en: 'Other alarm clocks', duty: 3.2, ad: 0 },
  { hs: '9104000000', desc_cn: '仪表板钟', desc_en: 'Instrument panel clocks', duty: 3.2, ad: 0 },
  { hs: '9105110000', desc_cn: '电子闹钟', desc_en: 'Electronic alarm clocks', duty: 3.2, ad: 0 },
  { hs: '9105190000', desc_cn: '其他闹钟', desc_en: 'Other alarm clocks', duty: 3.2, ad: 0 },
  { hs: '9105210000', desc_cn: '电子挂钟', desc_en: 'Electronic wall clocks', duty: 3.2, ad: 0 },
  { hs: '9105290000', desc_cn: '其他挂钟', desc_en: 'Other wall clocks', duty: 3.2, ad: 0 },
  { hs: '9105910000', desc_cn: '其他电子钟', desc_en: 'Other electronic clocks', duty: 3.2, ad: 0 },
  { hs: '9105990000', desc_cn: '其他钟', desc_en: 'Other clocks', duty: 3.2, ad: 0 },
  { hs: '9106100000', desc_cn: '打卡钟', desc_en: 'Time-registers', duty: 0, ad: 0 },
  { hs: '9106900000', desc_cn: '其他时间记录器', desc_en: 'Other time recording apparatus', duty: 0, ad: 0 },
  { hs: '9107000000', desc_cn: '定时开关', desc_en: 'Time switches', duty: 2.6, ad: 0 },
  { hs: '9108110000', desc_cn: '完整手表机芯', desc_en: 'Complete watch movements', duty: 5.3, ad: 0 },
  { hs: '9108120000', desc_cn: '不完整手表机芯', desc_en: 'Incomplete watch movements', duty: 5.3, ad: 0 },
  { hs: '9108190000', desc_cn: '其他手表机芯', desc_en: 'Other watch movements', duty: 5.3, ad: 0 },
  { hs: '9108200000', desc_cn: '自动上弦机芯', desc_en: 'Self-winding movements', duty: 5.3, ad: 0 },
  { hs: '9108900000', desc_cn: '其他机芯', desc_en: 'Other movements', duty: 5.3, ad: 0 },
  { hs: '9109110000', desc_cn: '闹钟机芯', desc_en: 'Alarm clock movements', duty: 3.7, ad: 0 },
  { hs: '9109190000', desc_cn: '其他电子钟机芯', desc_en: 'Other electronic clock movements', duty: 3.7, ad: 0 },
  { hs: '9109900000', desc_cn: '其他钟机芯', desc_en: 'Other clock movements', duty: 3.7, ad: 0 },
  { hs: '9110110000', desc_cn: '完整未组装表机芯', desc_en: 'Complete unassembled movements', duty: 0, ad: 0 },
  { hs: '9110120000', desc_cn: '不完整未组装表机芯', desc_en: 'Incomplete unassembled movements', duty: 0, ad: 0 },
  { hs: '9110190000', desc_cn: '其他未组装表机芯', desc_en: 'Other unassembled movements', duty: 0, ad: 0 },
  { hs: '9110900000', desc_cn: '钟未组装机芯', desc_en: 'Clock movements unassembled', duty: 0, ad: 0 },
  { hs: '9111100000', desc_cn: '贵金属表壳', desc_en: 'Watch cases of precious metal', duty: 2.5, ad: 0 },
  { hs: '9111200000', desc_cn: '贱金属表壳', desc_en: 'Watch cases of base metal', duty: 2.5, ad: 0 },
  { hs: '9111800000', desc_cn: '其他表壳', desc_en: 'Other watch cases', duty: 2.5, ad: 0 },
  { hs: '9111900000', desc_cn: '表壳零件', desc_en: 'Parts of watch cases', duty: 2.5, ad: 0 },
  { hs: '9112200000', desc_cn: '钟壳', desc_en: 'Clock cases', duty: 2.5, ad: 0 },
  { hs: '9112900000', desc_cn: '钟壳零件', desc_en: 'Parts of clock cases', duty: 2.5, ad: 0 },
  { hs: '9113100000', desc_cn: '贵金属制表带', desc_en: 'Watch straps of precious metal', duty: 4.2, ad: 0 },
  { hs: '9113200000', desc_cn: '贱金属表带', desc_en: 'Watch straps of base metal', duty: 4.2, ad: 0 },
  { hs: '9113900000', desc_cn: '其他表带', desc_en: 'Other watch straps', duty: 4.2, ad: 0 },
  { hs: '9114100000', desc_cn: '表用弹簧', desc_en: 'Watch springs', duty: 0, ad: 0 },
  { hs: '9114300000', desc_cn: '钟表机面', desc_en: 'Dials for clocks and watches', duty: 0, ad: 0 },
  { hs: '9114400000', desc_cn: '表用夹板和过桥', desc_en: 'Plates and bridges', duty: 0, ad: 0 },
  { hs: '9114900000', desc_cn: '其他钟表零件', desc_en: 'Other clock watch parts', duty: 0, ad: 0 }
]

// 同步函数
async function syncChinaHsCodesBatch3() {
  console.log('=' .repeat(60))
  console.log('🔄 中国原产地 HS Code 完整同步 - 第三批')
  console.log('=' .repeat(60))
  console.log('')
  console.log('🔗 连接数据库...')
  
  const client = await pool.connect()
  
  try {
    const beforeStats = await client.query(`
      SELECT COUNT(*) as count FROM tariff_rates 
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND is_active = 1
    `)
    console.log(`📊 同步前中国原产地记录: ${beforeStats.rows[0].count} 条`)
    console.log(`📦 准备导入: ${CHINA_HS_CODES_BATCH3.length} 条新数据`)
    console.log('')
    
    await client.query('BEGIN')
    
    let inserted = 0
    let updated = 0
    
    for (const item of CHINA_HS_CODES_BATCH3) {
      const existing = await client.query(`
        SELECT id FROM tariff_rates 
        WHERE hs_code = $1 AND origin_country_code = 'CN' AND is_active = 1
      `, [item.hs])
      
      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE tariff_rates SET
            hs_code_10 = $1,
            goods_description = $2,
            goods_description_cn = $3,
            duty_rate = $4,
            anti_dumping_rate = $5,
            updated_at = NOW()
          WHERE id = $6
        `, [item.hs, item.desc_en, item.desc_cn, item.duty, item.ad, existing.rows[0].id])
        updated++
      } else {
        await client.query(`
          INSERT INTO tariff_rates (
            hs_code, hs_code_10, goods_description, goods_description_cn,
            origin_country, origin_country_code,
            duty_rate, duty_rate_type, vat_rate,
            anti_dumping_rate, countervailing_rate,
            is_active, data_source, created_at, updated_at
          ) VALUES (
            $1, $1, $2, $3,
            '中国', 'CN',
            $4, 'percentage', 19,
            $5, 0,
            1, 'taric_sync', NOW(), NOW()
          )
        `, [item.hs, item.desc_en, item.desc_cn, item.duty, item.ad])
        inserted++
      }
      
      const total = inserted + updated
      if (total % 50 === 0) {
        process.stdout.write(`\r  处理进度: ${total}/${CHINA_HS_CODES_BATCH3.length}`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log('')
    console.log('')
    console.log('=' .repeat(60))
    console.log('✅ 同步完成！')
    console.log('=' .repeat(60))
    console.log(`  新增记录: ${inserted} 条`)
    console.log(`  更新记录: ${updated} 条`)
    
    const afterStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN anti_dumping_rate > 0 THEN 1 END) as with_ad,
        COUNT(DISTINCT SUBSTRING(hs_code, 1, 2)) as chapters
      FROM tariff_rates 
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND is_active = 1
    `)
    
    const stats = afterStats.rows[0]
    console.log('')
    console.log('📊 同步后统计:')
    console.log(`  中国原产地总记录: ${stats.total} 条`)
    console.log(`  含反倾销税记录: ${stats.with_ad} 条`)
    console.log(`  覆盖章节数: ${stats.chapters} 个`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 同步失败，事务已回滚')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

syncChinaHsCodesBatch3()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })

