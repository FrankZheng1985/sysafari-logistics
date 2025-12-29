/**
 * 中国原产地 HS Code 完整同步脚本 - 第二批
 * 补充更多行业和产品类别
 */

import pg from 'pg'

const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})

// 第二批：补充更多常用中国原产地 HS Code
const CHINA_HS_CODES_BATCH2 = [
  // ==================== 第44章：木制品 ====================
  { hs: '4407110000', desc_cn: '针叶木锯材', desc_en: 'Coniferous wood sawn', duty: 0, ad: 0 },
  { hs: '4407210000', desc_cn: '深红柳安木锯材', desc_en: 'Dark red meranti sawn', duty: 0, ad: 0 },
  { hs: '4407220000', desc_cn: '浅红柳安木锯材', desc_en: 'Light red meranti sawn', duty: 0, ad: 0 },
  { hs: '4407290000', desc_cn: '其他热带木锯材', desc_en: 'Other tropical wood sawn', duty: 0, ad: 0 },
  { hs: '4407990000', desc_cn: '其他木锯材', desc_en: 'Other wood sawn', duty: 0, ad: 0 },
  { hs: '4408100000', desc_cn: '针叶木饰面板', desc_en: 'Coniferous veneer sheets', duty: 0, ad: 0 },
  { hs: '4408310000', desc_cn: '深红柳安木饰面板', desc_en: 'Dark red meranti veneer', duty: 0, ad: 0 },
  { hs: '4408390000', desc_cn: '其他热带木饰面板', desc_en: 'Other tropical veneer', duty: 0, ad: 0 },
  { hs: '4408900000', desc_cn: '其他木饰面板', desc_en: 'Other veneer sheets', duty: 0, ad: 0 },
  { hs: '4409210000', desc_cn: '竹制成型木', desc_en: 'Bamboo mouldings', duty: 0, ad: 0 },
  { hs: '4409220000', desc_cn: '热带木成型木', desc_en: 'Tropical wood mouldings', duty: 0, ad: 0 },
  { hs: '4409290000', desc_cn: '其他非针叶木成型木', desc_en: 'Other non-coniferous mouldings', duty: 0, ad: 0 },
  { hs: '4410110000', desc_cn: '木碎料板', desc_en: 'Particle board of wood', duty: 7, ad: 0 },
  { hs: '4410120000', desc_cn: '定向刨花板', desc_en: 'Oriented strand board', duty: 7, ad: 0 },
  { hs: '4410190000', desc_cn: '其他木碎料板', desc_en: 'Other particle board', duty: 7, ad: 0 },
  { hs: '4411120000', desc_cn: '中密度纤维板', desc_en: 'Medium density fibreboard', duty: 7, ad: 0 },
  { hs: '4411130000', desc_cn: '高密度纤维板', desc_en: 'High density fibreboard', duty: 7, ad: 0 },
  { hs: '4411140000', desc_cn: '其他纤维板', desc_en: 'Other fibreboard', duty: 7, ad: 0 },
  { hs: '4412100000', desc_cn: '竹胶合板', desc_en: 'Bamboo plywood', duty: 7, ad: 10.9 },
  { hs: '4412310000', desc_cn: '含至少一层热带木胶合板', desc_en: 'Plywood with tropical wood', duty: 7, ad: 10.9 },
  { hs: '4412330000', desc_cn: '其他胶合板', desc_en: 'Other plywood', duty: 7, ad: 10.9 },
  { hs: '4412340000', desc_cn: '热带木面胶合板', desc_en: 'Plywood faced with tropical wood', duty: 7, ad: 10.9 },
  { hs: '4412390000', desc_cn: '其他面板胶合板', desc_en: 'Other plywood panels', duty: 7, ad: 10.9 },
  { hs: '4412940000', desc_cn: '细木工板', desc_en: 'Blockboard', duty: 7, ad: 10.9 },
  { hs: '4412990000', desc_cn: '其他胶合板', desc_en: 'Other plywood', duty: 7, ad: 10.9 },
  { hs: '4418100000', desc_cn: '木窗及窗框', desc_en: 'Wood windows and frames', duty: 3, ad: 0 },
  { hs: '4418200000', desc_cn: '木门及门框', desc_en: 'Wood doors and frames', duty: 3, ad: 0 },
  { hs: '4418400000', desc_cn: '木模板混凝土用', desc_en: 'Wood formwork for concrete', duty: 3, ad: 0 },
  { hs: '4418500000', desc_cn: '木瓦木屋面板', desc_en: 'Wood shingles and shakes', duty: 3, ad: 0 },
  { hs: '4418600000', desc_cn: '柱梁', desc_en: 'Posts and beams', duty: 3, ad: 0 },
  { hs: '4418740000', desc_cn: '拼花木地板', desc_en: 'Parquet flooring panels', duty: 3, ad: 0 },
  { hs: '4418750000', desc_cn: '多层木地板', desc_en: 'Multilayer wood flooring', duty: 3, ad: 0 },
  { hs: '4418790000', desc_cn: '其他组合地板', desc_en: 'Other assembled flooring', duty: 3, ad: 0 },
  { hs: '4418910000', desc_cn: '竹制建筑用品', desc_en: 'Bamboo builders joinery', duty: 3, ad: 0 },
  { hs: '4418990000', desc_cn: '其他木建筑用品', desc_en: 'Other wood builders joinery', duty: 3, ad: 0 },
  { hs: '4419110000', desc_cn: '竹制切菜板', desc_en: 'Bamboo cutting boards', duty: 0, ad: 0 },
  { hs: '4419120000', desc_cn: '竹制筷子', desc_en: 'Bamboo chopsticks', duty: 0, ad: 0 },
  { hs: '4419190000', desc_cn: '其他竹餐具厨房用具', desc_en: 'Other bamboo tableware', duty: 0, ad: 0 },
  { hs: '4419900000', desc_cn: '其他木餐具厨房用具', desc_en: 'Other wood tableware', duty: 0, ad: 0 },
  { hs: '4420110000', desc_cn: '热带木小雕像', desc_en: 'Tropical wood statuettes', duty: 0, ad: 0 },
  { hs: '4420190000', desc_cn: '其他木小雕像装饰品', desc_en: 'Other wood ornaments', duty: 0, ad: 0 },
  { hs: '4420900000', desc_cn: '木镶嵌家具', desc_en: 'Wood inlaid furniture', duty: 0, ad: 0 },
  { hs: '4421100000', desc_cn: '木衣架', desc_en: 'Wood clothes hangers', duty: 0, ad: 0 },
  { hs: '4421910000', desc_cn: '竹制其他物品', desc_en: 'Other articles of bamboo', duty: 0, ad: 0 },
  { hs: '4421990000', desc_cn: '其他木制品', desc_en: 'Other articles of wood', duty: 0, ad: 0 },
  
  // ==================== 第63章：纺织制成品 ====================
  { hs: '6301100000', desc_cn: '电热毯', desc_en: 'Electric blankets', duty: 12, ad: 0 },
  { hs: '6301200000', desc_cn: '羊毛毛毯', desc_en: 'Wool blankets', duty: 12, ad: 0 },
  { hs: '6301300000', desc_cn: '棉制毛毯', desc_en: 'Cotton blankets', duty: 12, ad: 0 },
  { hs: '6301400000', desc_cn: '合成纤维毛毯', desc_en: 'Synthetic fibre blankets', duty: 12, ad: 0 },
  { hs: '6301900000', desc_cn: '其他毛毯', desc_en: 'Other blankets', duty: 12, ad: 0 },
  { hs: '6302100000', desc_cn: '针织床上用品', desc_en: 'Knitted bed linen', duty: 12, ad: 0 },
  { hs: '6302210000', desc_cn: '棉印花床单', desc_en: 'Cotton printed bed linen', duty: 12, ad: 0 },
  { hs: '6302220000', desc_cn: '化纤印花床单', desc_en: 'Man-made fibre printed bed linen', duty: 12, ad: 0 },
  { hs: '6302290000', desc_cn: '其他印花床单', desc_en: 'Other printed bed linen', duty: 12, ad: 0 },
  { hs: '6302310000', desc_cn: '棉制其他床单', desc_en: 'Other cotton bed linen', duty: 12, ad: 0 },
  { hs: '6302320000', desc_cn: '化纤制其他床单', desc_en: 'Other man-made fibre bed linen', duty: 12, ad: 0 },
  { hs: '6302390000', desc_cn: '其他材质床单', desc_en: 'Other material bed linen', duty: 12, ad: 0 },
  { hs: '6302400000', desc_cn: '针织餐桌用品', desc_en: 'Knitted table linen', duty: 12, ad: 0 },
  { hs: '6302510000', desc_cn: '棉制餐桌用品', desc_en: 'Cotton table linen', duty: 12, ad: 0 },
  { hs: '6302530000', desc_cn: '化纤餐桌用品', desc_en: 'Man-made fibre table linen', duty: 12, ad: 0 },
  { hs: '6302590000', desc_cn: '其他餐桌用品', desc_en: 'Other table linen', duty: 12, ad: 0 },
  { hs: '6302600000', desc_cn: '棉制盥洗厨房织物', desc_en: 'Cotton toilet kitchen linen', duty: 12, ad: 0 },
  { hs: '6302910000', desc_cn: '棉制其他盥洗用品', desc_en: 'Other cotton toilet articles', duty: 12, ad: 0 },
  { hs: '6302930000', desc_cn: '化纤盥洗用品', desc_en: 'Man-made fibre toilet articles', duty: 12, ad: 0 },
  { hs: '6302990000', desc_cn: '其他盥洗用品', desc_en: 'Other toilet articles', duty: 12, ad: 0 },
  { hs: '6303120000', desc_cn: '合成纤维针织窗帘', desc_en: 'Knitted curtains of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6303190000', desc_cn: '其他针织窗帘', desc_en: 'Other knitted curtains', duty: 12, ad: 0 },
  { hs: '6303910000', desc_cn: '棉制非针织窗帘', desc_en: 'Cotton woven curtains', duty: 12, ad: 0 },
  { hs: '6303920000', desc_cn: '合成纤维非针织窗帘', desc_en: 'Synthetic fibre woven curtains', duty: 12, ad: 0 },
  { hs: '6303990000', desc_cn: '其他非针织窗帘', desc_en: 'Other woven curtains', duty: 12, ad: 0 },
  { hs: '6304110000', desc_cn: '针织床罩', desc_en: 'Knitted bedspreads', duty: 12, ad: 0 },
  { hs: '6304190000', desc_cn: '非针织床罩', desc_en: 'Woven bedspreads', duty: 12, ad: 0 },
  { hs: '6304910000', desc_cn: '针织装饰品', desc_en: 'Knitted furnishing articles', duty: 12, ad: 0 },
  { hs: '6304920000', desc_cn: '非针织棉装饰品', desc_en: 'Woven cotton furnishing articles', duty: 12, ad: 0 },
  { hs: '6304930000', desc_cn: '非针织合成纤维装饰品', desc_en: 'Woven synthetic furnishing articles', duty: 12, ad: 0 },
  { hs: '6304990000', desc_cn: '其他装饰品', desc_en: 'Other furnishing articles', duty: 12, ad: 0 },
  { hs: '6305100000', desc_cn: '黄麻包装袋', desc_en: 'Jute sacks and bags', duty: 3, ad: 0 },
  { hs: '6305200000', desc_cn: '棉包装袋', desc_en: 'Cotton sacks and bags', duty: 3, ad: 0 },
  { hs: '6305320000', desc_cn: '聚丙烯软袋', desc_en: 'Polypropylene flexible containers', duty: 3, ad: 0 },
  { hs: '6305330000', desc_cn: '其他聚乙烯包装袋', desc_en: 'Other polyethylene sacks and bags', duty: 3, ad: 0 },
  { hs: '6305390000', desc_cn: '其他化纤包装袋', desc_en: 'Other man-made fibre sacks', duty: 3, ad: 0 },
  { hs: '6305900000', desc_cn: '其他包装袋', desc_en: 'Other sacks and bags', duty: 3, ad: 0 },
  { hs: '6306120000', desc_cn: '合成纤维篷布', desc_en: 'Synthetic fibre tarpaulins', duty: 12, ad: 0 },
  { hs: '6306190000', desc_cn: '其他篷布', desc_en: 'Other tarpaulins', duty: 12, ad: 0 },
  { hs: '6306220000', desc_cn: '合成纤维帐篷', desc_en: 'Synthetic fibre tents', duty: 12, ad: 0 },
  { hs: '6306290000', desc_cn: '其他帐篷', desc_en: 'Other tents', duty: 12, ad: 0 },
  { hs: '6306300000', desc_cn: '帆', desc_en: 'Sails', duty: 12, ad: 0 },
  { hs: '6306400000', desc_cn: '充气垫', desc_en: 'Pneumatic mattresses', duty: 12, ad: 0 },
  { hs: '6306900000', desc_cn: '其他野营用品', desc_en: 'Other camping goods', duty: 12, ad: 0 },
  { hs: '6307100000', desc_cn: '地板布抹布', desc_en: 'Floor-cloths dish-cloths', duty: 12, ad: 0 },
  { hs: '6307200000', desc_cn: '救生衣及安全带', desc_en: 'Life-jackets and safety belts', duty: 12, ad: 0 },
  { hs: '6307900000', desc_cn: '其他纺织制成品', desc_en: 'Other made up textile articles', duty: 12, ad: 0 },
  { hs: '6308000000', desc_cn: '成套针织品', desc_en: 'Sets of woven fabric', duty: 12, ad: 0 },
  { hs: '6309000000', desc_cn: '旧衣服', desc_en: 'Worn clothing', duty: 5.3, ad: 0 },
  { hs: '6310100000', desc_cn: '分选纺织废料', desc_en: 'Sorted textile rags', duty: 0, ad: 0 },
  { hs: '6310900000', desc_cn: '其他纺织废料', desc_en: 'Other textile rags', duty: 0, ad: 0 },
  
  // ==================== 第65章：帽类 ====================
  { hs: '6501000000', desc_cn: '毛毡帽胎', desc_en: 'Hat-forms of felt', duty: 1.7, ad: 0 },
  { hs: '6502000000', desc_cn: '编结帽胎', desc_en: 'Hat-shapes plaited', duty: 1.7, ad: 0 },
  { hs: '6504000000', desc_cn: '编结帽', desc_en: 'Hats plaited', duty: 1.7, ad: 0 },
  { hs: '6505001000', desc_cn: '针织帽', desc_en: 'Knitted hats', duty: 4.7, ad: 0 },
  { hs: '6505009000', desc_cn: '其他帽', desc_en: 'Other hats', duty: 4.7, ad: 0 },
  { hs: '6506100000', desc_cn: '安全帽', desc_en: 'Safety headgear', duty: 3.7, ad: 0 },
  { hs: '6506910000', desc_cn: '橡胶或塑料帽', desc_en: 'Rubber or plastic headgear', duty: 3.7, ad: 0 },
  { hs: '6506990000', desc_cn: '其他材料帽', desc_en: 'Other material headgear', duty: 3.7, ad: 0 },
  { hs: '6507000000', desc_cn: '帽衬及帽零件', desc_en: 'Head-bands and linings', duty: 1.7, ad: 0 },
  
  // ==================== 第66章：伞杖鞭 ====================
  { hs: '6601100000', desc_cn: '露台伞', desc_en: 'Garden or terrace umbrellas', duty: 4.7, ad: 0 },
  { hs: '6601910000', desc_cn: '可折叠伞', desc_en: 'Telescopic shaft umbrellas', duty: 4.7, ad: 0 },
  { hs: '6601990000', desc_cn: '其他伞', desc_en: 'Other umbrellas', duty: 4.7, ad: 0 },
  { hs: '6602000000', desc_cn: '手杖', desc_en: 'Walking-sticks', duty: 2.7, ad: 0 },
  { hs: '6603100000', desc_cn: '伞柄伞骨', desc_en: 'Umbrella handles and knobs', duty: 2.7, ad: 0 },
  { hs: '6603200000', desc_cn: '伞架及伞骨架', desc_en: 'Umbrella frames', duty: 2.7, ad: 0 },
  { hs: '6603900000', desc_cn: '其他伞零件', desc_en: 'Other umbrella parts', duty: 2.7, ad: 0 },
  
  // ==================== 第68章：石料水泥制品 ====================
  { hs: '6801000000', desc_cn: '石路缘石', desc_en: 'Setts curbstones flagstones', duty: 0, ad: 0 },
  { hs: '6802100000', desc_cn: '碑石', desc_en: 'Tiles cubes monumental stone', duty: 0, ad: 0 },
  { hs: '6802210000', desc_cn: '大理石', desc_en: 'Marble', duty: 0, ad: 0 },
  { hs: '6802230000', desc_cn: '花岗岩', desc_en: 'Granite', duty: 0, ad: 0 },
  { hs: '6802290000', desc_cn: '其他石材', desc_en: 'Other stone', duty: 0, ad: 0 },
  { hs: '6802910000', desc_cn: '大理石及雪花石膏制品', desc_en: 'Marble and travertine articles', duty: 0, ad: 0 },
  { hs: '6802930000', desc_cn: '花岗岩制品', desc_en: 'Granite articles', duty: 0, ad: 0 },
  { hs: '6802990000', desc_cn: '其他石制品', desc_en: 'Other stone articles', duty: 0, ad: 0 },
  { hs: '6803000000', desc_cn: '已加工板岩', desc_en: 'Worked slate', duty: 0, ad: 0 },
  { hs: '6804100000', desc_cn: '磨石砂轮', desc_en: 'Millstones grindstones', duty: 1.7, ad: 0 },
  { hs: '6804210000', desc_cn: '粘结合成或天然金刚石制磨轮', desc_en: 'Diamond millstones', duty: 1.7, ad: 0 },
  { hs: '6804220000', desc_cn: '粘结磨料制磨轮', desc_en: 'Bonded abrasive millstones', duty: 1.7, ad: 0 },
  { hs: '6804230000', desc_cn: '天然石制磨轮', desc_en: 'Natural stone millstones', duty: 1.7, ad: 0 },
  { hs: '6804300000', desc_cn: '手用磨石', desc_en: 'Hand sharpening stones', duty: 1.7, ad: 0 },
  { hs: '6805100000', desc_cn: '布或纸基砂纸', desc_en: 'Abrasive cloth or paper', duty: 0, ad: 0 },
  { hs: '6805200000', desc_cn: '粉状或颗粒状天然磨料', desc_en: 'Natural abrasives powder', duty: 0, ad: 0 },
  { hs: '6805300000', desc_cn: '不以布或纸为底的天然磨料', desc_en: 'Other natural abrasives', duty: 0, ad: 0 },
  { hs: '6806100000', desc_cn: '矿渣棉岩石棉', desc_en: 'Slag wool rock wool', duty: 0, ad: 0 },
  { hs: '6806200000', desc_cn: '膨胀粘土', desc_en: 'Expanded clay', duty: 0, ad: 0 },
  { hs: '6806900000', desc_cn: '其他保温材料', desc_en: 'Other heat-insulating materials', duty: 0, ad: 0 },
  { hs: '6807100000', desc_cn: '沥青卷材', desc_en: 'Asphalt rolls', duty: 0, ad: 0 },
  { hs: '6807900000', desc_cn: '其他沥青制品', desc_en: 'Other asphalt articles', duty: 0, ad: 0 },
  { hs: '6808000000', desc_cn: '植物纤维板', desc_en: 'Panels of vegetable fibre', duty: 3.7, ad: 0 },
  { hs: '6809110000', desc_cn: '纸面石膏板', desc_en: 'Plasterboards faced with paper', duty: 0, ad: 0 },
  { hs: '6809190000', desc_cn: '其他石膏板', desc_en: 'Other plasterboards', duty: 0, ad: 0 },
  { hs: '6809900000', desc_cn: '其他石膏制品', desc_en: 'Other plaster articles', duty: 0, ad: 0 },
  { hs: '6810110000', desc_cn: '混凝土建筑块砖', desc_en: 'Concrete building blocks', duty: 0, ad: 0 },
  { hs: '6810190000', desc_cn: '其他混凝土建材', desc_en: 'Other concrete tiles', duty: 0, ad: 0 },
  { hs: '6810910000', desc_cn: '预制构件', desc_en: 'Prefabricated structural components', duty: 0, ad: 0 },
  { hs: '6810990000', desc_cn: '其他水泥制品', desc_en: 'Other cement articles', duty: 0, ad: 0 },
  { hs: '6811400000', desc_cn: '含石棉水泥制品', desc_en: 'Asbestos-cement articles', duty: 4, ad: 0 },
  { hs: '6811810000', desc_cn: '波纹板', desc_en: 'Corrugated sheets', duty: 4, ad: 0 },
  { hs: '6811820000', desc_cn: '其他板', desc_en: 'Other sheets panels', duty: 4, ad: 0 },
  { hs: '6811890000', desc_cn: '其他石棉水泥制品', desc_en: 'Other articles', duty: 4, ad: 0 },
  { hs: '6815100000', desc_cn: '石墨制品', desc_en: 'Graphite articles', duty: 0, ad: 0 },
  { hs: '6815200000', desc_cn: '泥煤制品', desc_en: 'Peat articles', duty: 0, ad: 0 },
  { hs: '6815910000', desc_cn: '含镁菱石或白云石制品', desc_en: 'Magnesite dolomite articles', duty: 0, ad: 0 },
  { hs: '6815990000', desc_cn: '其他矿物制品', desc_en: 'Other mineral articles', duty: 0, ad: 0 },
  
  // ==================== 第48章：纸制品 ====================
  { hs: '4801000000', desc_cn: '新闻纸', desc_en: 'Newsprint', duty: 0, ad: 0 },
  { hs: '4802100000', desc_cn: '手工纸', desc_en: 'Hand-made paper', duty: 0, ad: 0 },
  { hs: '4802200000', desc_cn: '照相纸原纸', desc_en: 'Paper for photographic use', duty: 0, ad: 0 },
  { hs: '4802400000', desc_cn: '壁纸原纸', desc_en: 'Wallpaper base', duty: 0, ad: 0 },
  { hs: '4802540000', desc_cn: '书写纸<40g', desc_en: 'Writing paper <40g', duty: 0, ad: 0 },
  { hs: '4802550000', desc_cn: '书写纸40-150g', desc_en: 'Writing paper 40-150g', duty: 0, ad: 0 },
  { hs: '4802560000', desc_cn: '书写纸>150g', desc_en: 'Writing paper >150g', duty: 0, ad: 0 },
  { hs: '4802580000', desc_cn: '其他书写印刷纸', desc_en: 'Other writing printing paper', duty: 0, ad: 0 },
  { hs: '4802610000', desc_cn: '卷筒纸>10cm', desc_en: 'Paper in rolls >10cm', duty: 0, ad: 0 },
  { hs: '4802620000', desc_cn: '单张纸', desc_en: 'Paper in sheets', duty: 0, ad: 0 },
  { hs: '4802690000', desc_cn: '其他纸板', desc_en: 'Other paperboard', duty: 0, ad: 0 },
  { hs: '4803000000', desc_cn: '卫生纸巾纸', desc_en: 'Toilet paper tissue paper', duty: 0, ad: 0 },
  { hs: '4804110000', desc_cn: '牛皮纸未漂白', desc_en: 'Unbleached kraftliner', duty: 0, ad: 0 },
  { hs: '4804190000', desc_cn: '其他牛皮纸', desc_en: 'Other kraftliner', duty: 0, ad: 0 },
  { hs: '4804210000', desc_cn: '未漂白牛皮袋纸', desc_en: 'Unbleached sack kraft paper', duty: 0, ad: 0 },
  { hs: '4804290000', desc_cn: '其他牛皮袋纸', desc_en: 'Other sack kraft paper', duty: 0, ad: 0 },
  { hs: '4804310000', desc_cn: '未漂白牛皮纸<150g', desc_en: 'Unbleached kraft paper <150g', duty: 0, ad: 0 },
  { hs: '4804390000', desc_cn: '其他牛皮纸<150g', desc_en: 'Other kraft paper <150g', duty: 0, ad: 0 },
  { hs: '4804410000', desc_cn: '未漂白牛皮纸>=150g', desc_en: 'Unbleached kraft paper >=150g', duty: 0, ad: 0 },
  { hs: '4804420000', desc_cn: '漂白均匀牛皮纸>=150g', desc_en: 'Bleached kraft paper >=150g', duty: 0, ad: 0 },
  { hs: '4804490000', desc_cn: '其他牛皮纸>=150g', desc_en: 'Other kraft paper >=150g', duty: 0, ad: 0 },
  { hs: '4804520000', desc_cn: '漂白均匀牛皮纸板', desc_en: 'Bleached kraftpaperboard', duty: 0, ad: 0 },
  { hs: '4804590000', desc_cn: '其他牛皮纸板', desc_en: 'Other kraft paperboard', duty: 0, ad: 0 },
  { hs: '4805110000', desc_cn: '半化学瓦楞原纸', desc_en: 'Semi-chemical fluting', duty: 0, ad: 0 },
  { hs: '4805120000', desc_cn: '稻草浆瓦楞原纸', desc_en: 'Straw fluting', duty: 0, ad: 0 },
  { hs: '4805190000', desc_cn: '其他瓦楞原纸', desc_en: 'Other fluting', duty: 0, ad: 0 },
  { hs: '4805240000', desc_cn: '挂面纸<150g', desc_en: 'Testliner <150g', duty: 0, ad: 0 },
  { hs: '4805250000', desc_cn: '挂面纸>=150g', desc_en: 'Testliner >=150g', duty: 0, ad: 0 },
  { hs: '4805300000', desc_cn: '亚硫酸盐包装纸', desc_en: 'Sulphite wrapping paper', duty: 0, ad: 0 },
  { hs: '4805400000', desc_cn: '滤纸及纸板', desc_en: 'Filter paper and paperboard', duty: 0, ad: 0 },
  { hs: '4805500000', desc_cn: '毛毡纸及纸板', desc_en: 'Felt paper and paperboard', duty: 0, ad: 0 },
  { hs: '4805910000', desc_cn: '其他纸<=150g', desc_en: 'Other paper <=150g', duty: 0, ad: 0 },
  { hs: '4805920000', desc_cn: '其他纸150-225g', desc_en: 'Other paper 150-225g', duty: 0, ad: 0 },
  { hs: '4805930000', desc_cn: '其他纸>=225g', desc_en: 'Other paper >=225g', duty: 0, ad: 0 },
  { hs: '4806100000', desc_cn: '植物羊皮纸', desc_en: 'Vegetable parchment', duty: 0, ad: 0 },
  { hs: '4806200000', desc_cn: '防油纸', desc_en: 'Greaseproof papers', duty: 0, ad: 0 },
  { hs: '4806300000', desc_cn: '描图纸', desc_en: 'Tracing papers', duty: 0, ad: 0 },
  { hs: '4806400000', desc_cn: '单面光纸', desc_en: 'Glassine and other glazed papers', duty: 0, ad: 0 },
  { hs: '4807000000', desc_cn: '复合纸及纸板', desc_en: 'Composite paper and paperboard', duty: 0, ad: 0 },
  { hs: '4808100000', desc_cn: '瓦楞纸板', desc_en: 'Corrugated paper and paperboard', duty: 0, ad: 0 },
  { hs: '4808400000', desc_cn: '皱纹牛皮纸', desc_en: 'Kraft paper creped or crinkled', duty: 0, ad: 0 },
  { hs: '4808900000', desc_cn: '其他皱纹纸', desc_en: 'Other paper creped or crinkled', duty: 0, ad: 0 },
  { hs: '4809200000', desc_cn: '自印纸', desc_en: 'Self-copy paper', duty: 0, ad: 0 },
  { hs: '4809900000', desc_cn: '其他复写纸', desc_en: 'Other carbon paper', duty: 0, ad: 0 },
  { hs: '4810130000', desc_cn: '涂布书写印刷用纸', desc_en: 'Coated writing printing paper', duty: 0, ad: 9.4 },
  { hs: '4810140000', desc_cn: '卷筒涂布纸', desc_en: 'Coated paper in rolls', duty: 0, ad: 9.4 },
  { hs: '4810190000', desc_cn: '其他涂布纸', desc_en: 'Other coated paper', duty: 0, ad: 9.4 },
  { hs: '4810220000', desc_cn: '涂布轻量纸', desc_en: 'Lightweight coated paper', duty: 0, ad: 0 },
  { hs: '4810290000', desc_cn: '其他涂布纸', desc_en: 'Other coated paper', duty: 0, ad: 0 },
  { hs: '4810310000', desc_cn: '涂布牛皮纸<=150g', desc_en: 'Coated kraft paper <=150g', duty: 0, ad: 0 },
  { hs: '4810320000', desc_cn: '涂布牛皮纸>150g', desc_en: 'Coated kraft paper >150g', duty: 0, ad: 0 },
  { hs: '4810390000', desc_cn: '其他涂布牛皮纸', desc_en: 'Other coated kraft paper', duty: 0, ad: 0 },
  { hs: '4810920000', desc_cn: '涂布多层纸', desc_en: 'Coated multi-ply paper', duty: 0, ad: 0 },
  { hs: '4810990000', desc_cn: '其他涂布纸', desc_en: 'Other coated paper', duty: 0, ad: 0 },
  { hs: '4811100000', desc_cn: '涂柏油沥青纸', desc_en: 'Tarred asphalted paper', duty: 0, ad: 0 },
  { hs: '4811410000', desc_cn: '自粘纸', desc_en: 'Self-adhesive paper', duty: 0, ad: 0 },
  { hs: '4811490000', desc_cn: '其他涂胶纸', desc_en: 'Other gummed paper', duty: 0, ad: 0 },
  { hs: '4811510000', desc_cn: '漂白涂塑纸>150g', desc_en: 'Bleached coated paper >150g', duty: 0, ad: 0 },
  { hs: '4811590000', desc_cn: '其他涂塑纸', desc_en: 'Other coated paper', duty: 0, ad: 0 },
  { hs: '4811600000', desc_cn: '涂蜡纸', desc_en: 'Paper coated with wax', duty: 0, ad: 0 },
  { hs: '4811900000', desc_cn: '其他涂布纸', desc_en: 'Other coated paper', duty: 0, ad: 0 },
  { hs: '4812000000', desc_cn: '纸浆滤块', desc_en: 'Filter blocks of paper pulp', duty: 0, ad: 0 },
  { hs: '4813100000', desc_cn: '卷烟纸小本', desc_en: 'Cigarette paper in booklets', duty: 0, ad: 0 },
  { hs: '4813200000', desc_cn: '卷烟纸卷筒<5cm', desc_en: 'Cigarette paper in rolls <5cm', duty: 0, ad: 0 },
  { hs: '4813900000', desc_cn: '其他卷烟纸', desc_en: 'Other cigarette paper', duty: 0, ad: 0 },
  { hs: '4814200000', desc_cn: '涂塑壁纸', desc_en: 'Wallpaper coated with plastics', duty: 0, ad: 0 },
  { hs: '4814900000', desc_cn: '其他壁纸', desc_en: 'Other wallpaper', duty: 0, ad: 0 },
  { hs: '4816200000', desc_cn: '自印纸卷筒或单张', desc_en: 'Self-copy paper in rolls or sheets', duty: 0, ad: 0 },
  { hs: '4816900000', desc_cn: '其他复写纸', desc_en: 'Other carbon paper', duty: 0, ad: 0 },
  { hs: '4817100000', desc_cn: '纸信封', desc_en: 'Paper envelopes', duty: 0, ad: 0 },
  { hs: '4817200000', desc_cn: '信笺信卡', desc_en: 'Letter cards', duty: 0, ad: 0 },
  { hs: '4817300000', desc_cn: '成套信封信笺', desc_en: 'Sets of envelopes and paper', duty: 0, ad: 0 },
  { hs: '4818100000', desc_cn: '卫生纸', desc_en: 'Toilet paper', duty: 0, ad: 0 },
  { hs: '4818200000', desc_cn: '纸手帕及面巾', desc_en: 'Paper handkerchiefs tissues', duty: 0, ad: 0 },
  { hs: '4818300000', desc_cn: '纸桌布及餐巾', desc_en: 'Paper tablecloths napkins', duty: 0, ad: 0 },
  { hs: '4818500000', desc_cn: '纸衣服及附件', desc_en: 'Paper articles of apparel', duty: 0, ad: 0 },
  { hs: '4818900000', desc_cn: '其他纸卫生用品', desc_en: 'Other paper hygiene articles', duty: 0, ad: 0 },
  { hs: '4819100000', desc_cn: '纸板箱', desc_en: 'Cartons boxes cases of paper', duty: 0, ad: 0 },
  { hs: '4819200000', desc_cn: '可折叠纸板箱', desc_en: 'Folding cartons', duty: 0, ad: 0 },
  { hs: '4819300000', desc_cn: '纸袋>=40cm', desc_en: 'Paper sacks and bags >=40cm', duty: 0, ad: 0 },
  { hs: '4819400000', desc_cn: '其他纸袋', desc_en: 'Other paper sacks and bags', duty: 0, ad: 0 },
  { hs: '4819500000', desc_cn: '其他纸包装容器', desc_en: 'Other paper packing containers', duty: 0, ad: 0 },
  { hs: '4819600000', desc_cn: '纸档案盒', desc_en: 'Paper box files letter trays', duty: 0, ad: 0 },
  { hs: '4820100000', desc_cn: '登记册账册笔记本', desc_en: 'Registers account books notebooks', duty: 0, ad: 0 },
  { hs: '4820200000', desc_cn: '练习本', desc_en: 'Exercise books', duty: 0, ad: 0 },
  { hs: '4820300000', desc_cn: '纸文件夹封面', desc_en: 'Paper binders folders covers', duty: 0, ad: 0 },
  { hs: '4820400000', desc_cn: '多联商业表格', desc_en: 'Manifold business forms', duty: 0, ad: 0 },
  { hs: '4820500000', desc_cn: '纸相册', desc_en: 'Paper albums', duty: 0, ad: 0 },
  { hs: '4820900000', desc_cn: '其他纸文具', desc_en: 'Other paper stationery', duty: 0, ad: 0 },
  { hs: '4821100000', desc_cn: '纸标签', desc_en: 'Paper labels', duty: 0, ad: 0 },
  { hs: '4821900000', desc_cn: '其他纸标签', desc_en: 'Other paper labels', duty: 0, ad: 0 },
  { hs: '4822100000', desc_cn: '纺织纱用纸筒', desc_en: 'Paper bobbins for textiles', duty: 0, ad: 0 },
  { hs: '4822900000', desc_cn: '其他纸筒', desc_en: 'Other paper bobbins', duty: 0, ad: 0 },
  { hs: '4823200000', desc_cn: '滤纸及滤纸板', desc_en: 'Filter paper and paperboard', duty: 0, ad: 0 },
  { hs: '4823400000', desc_cn: '诊断或实验室用纸', desc_en: 'Diagnostic or lab paper', duty: 0, ad: 0 },
  { hs: '4823610000', desc_cn: '竹制托盘盘碟', desc_en: 'Bamboo trays dishes', duty: 0, ad: 0 },
  { hs: '4823690000', desc_cn: '其他纸托盘盘碟', desc_en: 'Other paper trays dishes', duty: 0, ad: 0 },
  { hs: '4823700000', desc_cn: '纸模塑品', desc_en: 'Moulded paper pulp articles', duty: 0, ad: 0 },
  { hs: '4823900000', desc_cn: '其他纸制品', desc_en: 'Other paper articles', duty: 0, ad: 0 },
  
  // ==================== 第83章：贱金属杂项制品 ====================
  { hs: '8301100000', desc_cn: '挂锁', desc_en: 'Padlocks', duty: 2.7, ad: 0 },
  { hs: '8301200000', desc_cn: '机动车用锁', desc_en: 'Locks for motor vehicles', duty: 2.7, ad: 0 },
  { hs: '8301300000', desc_cn: '家具用锁', desc_en: 'Locks for furniture', duty: 2.7, ad: 0 },
  { hs: '8301400000', desc_cn: '其他锁', desc_en: 'Other locks', duty: 2.7, ad: 0 },
  { hs: '8301500000', desc_cn: '锁扣及框架', desc_en: 'Clasps frames with clasps', duty: 2.7, ad: 0 },
  { hs: '8301600000', desc_cn: '锁零件', desc_en: 'Parts of locks', duty: 2.7, ad: 0 },
  { hs: '8301700000', desc_cn: '钥匙', desc_en: 'Keys', duty: 2.7, ad: 0 },
  { hs: '8302100000', desc_cn: '铰链', desc_en: 'Hinges', duty: 2.7, ad: 0 },
  { hs: '8302200000', desc_cn: '家具脚轮', desc_en: 'Castors', duty: 2.7, ad: 0 },
  { hs: '8302300000', desc_cn: '机动车用附件', desc_en: 'Mountings for motor vehicles', duty: 2.7, ad: 0 },
  { hs: '8302410000', desc_cn: '建筑用附件', desc_en: 'Building mountings', duty: 2.7, ad: 0 },
  { hs: '8302420000', desc_cn: '家具用附件', desc_en: 'Furniture mountings', duty: 2.7, ad: 0 },
  { hs: '8302490000', desc_cn: '其他附件', desc_en: 'Other mountings', duty: 2.7, ad: 0 },
  { hs: '8302500000', desc_cn: '帽钩托架等', desc_en: 'Hat-racks brackets', duty: 2.7, ad: 0 },
  { hs: '8302600000', desc_cn: '自动关门器', desc_en: 'Automatic door closers', duty: 2.7, ad: 0 },
  { hs: '8303000000', desc_cn: '保险柜保险箱', desc_en: 'Safes strong-boxes', duty: 2.7, ad: 0 },
  { hs: '8304000000', desc_cn: '档案柜及卡片盒', desc_en: 'Filing cabinets card-index', duty: 2.7, ad: 0 },
  { hs: '8305100000', desc_cn: '活页夹或文件夹', desc_en: 'Loose-leaf binders', duty: 2.7, ad: 0 },
  { hs: '8305200000', desc_cn: '书钉', desc_en: 'Staples in strips', duty: 2.7, ad: 0 },
  { hs: '8305900000', desc_cn: '其他办公文具', desc_en: 'Other office supplies', duty: 2.7, ad: 0 },
  { hs: '8306100000', desc_cn: '钟', desc_en: 'Bells gongs', duty: 2.7, ad: 0 },
  { hs: '8306210000', desc_cn: '镀贵金属小雕像', desc_en: 'Statuettes plated with precious metal', duty: 2.7, ad: 0 },
  { hs: '8306290000', desc_cn: '其他小雕像', desc_en: 'Other statuettes', duty: 2.7, ad: 0 },
  { hs: '8306300000', desc_cn: '相框镜框', desc_en: 'Photograph picture frames', duty: 2.7, ad: 0 },
  { hs: '8307100000', desc_cn: '钢铁软管', desc_en: 'Flexible iron steel tubing', duty: 2.7, ad: 0 },
  { hs: '8307900000', desc_cn: '其他金属软管', desc_en: 'Other base metal flexible tubing', duty: 2.7, ad: 0 },
  { hs: '8308100000', desc_cn: '钩眼及搭扣', desc_en: 'Hooks and eyes', duty: 2.7, ad: 0 },
  { hs: '8308200000', desc_cn: '管状铆钉', desc_en: 'Tubular rivets', duty: 2.7, ad: 0 },
  { hs: '8308900000', desc_cn: '其他扣钩', desc_en: 'Other clasps buckles', duty: 2.7, ad: 0 },
  { hs: '8309100000', desc_cn: '皇冠塞及塞帽', desc_en: 'Crown corks', duty: 2.7, ad: 0 },
  { hs: '8309900000', desc_cn: '其他瓶塞盖', desc_en: 'Other stoppers caps', duty: 2.7, ad: 0 },
  { hs: '8310000000', desc_cn: '标志牌号码牌', desc_en: 'Sign-plates number-plates', duty: 2.7, ad: 0 },
  { hs: '8311100000', desc_cn: '涂药焊条', desc_en: 'Coated electrodes', duty: 0, ad: 0 },
  { hs: '8311200000', desc_cn: '焊丝', desc_en: 'Cored wire', duty: 0, ad: 0 },
  { hs: '8311300000', desc_cn: '焊条焊丝', desc_en: 'Coated rods cored wire', duty: 0, ad: 0 },
  { hs: '8311900000', desc_cn: '其他焊料', desc_en: 'Other soldering materials', duty: 0, ad: 0 }
]

// 同步函数
async function syncChinaHsCodesBatch2() {
  console.log('=' .repeat(60))
  console.log('🔄 中国原产地 HS Code 完整同步 - 第二批')
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
    console.log(`📦 准备导入: ${CHINA_HS_CODES_BATCH2.length} 条新数据`)
    console.log('')
    
    await client.query('BEGIN')
    
    let inserted = 0
    let updated = 0
    
    for (const item of CHINA_HS_CODES_BATCH2) {
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
        process.stdout.write(`\r  处理进度: ${total}/${CHINA_HS_CODES_BATCH2.length}`)
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

syncChinaHsCodesBatch2()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })

