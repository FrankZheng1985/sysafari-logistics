/**
 * 中国原产地 HS Code 完整同步脚本
 * 从本地税率数据库 + 欧盟常用 HS Code 批量导入
 * 
 * 用法: node scripts/sync-china-hscode.js
 */

import pg from 'pg'

// 阿里云 RDS 连接
const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})

// ==================== 中国原产地完整 HS Code 数据 ====================
// 数据来源：欧盟 TARIC 常用编码 + 反倾销税数据库

const CHINA_HS_CODES = [
  // ==================== 第61章：针织服装 ====================
  { hs: '6109100010', desc_cn: '棉制针织男式T恤衫', desc_en: 'Cotton knitted T-shirts for men', duty: 12, ad: 0 },
  { hs: '6109100090', desc_cn: '棉制针织女式T恤衫', desc_en: 'Cotton knitted T-shirts for women', duty: 12, ad: 0 },
  { hs: '6109901000', desc_cn: '化纤针织T恤衫', desc_en: 'Man-made fibre knitted T-shirts', duty: 12, ad: 0 },
  { hs: '6109909000', desc_cn: '其他纺织材料针织T恤', desc_en: 'Other textile T-shirts knitted', duty: 12, ad: 0 },
  { hs: '6110110000', desc_cn: '羊毛针织套头衫', desc_en: 'Wool knitted pullovers', duty: 12, ad: 0 },
  { hs: '6110120000', desc_cn: '克什米尔山羊绒针织套头衫', desc_en: 'Cashmere knitted pullovers', duty: 12, ad: 0 },
  { hs: '6110200000', desc_cn: '棉制针织套头衫', desc_en: 'Cotton knitted pullovers', duty: 12, ad: 0 },
  { hs: '6110300000', desc_cn: '化纤针织套头衫', desc_en: 'Man-made fibre knitted pullovers', duty: 12, ad: 0 },
  { hs: '6104430000', desc_cn: '合成纤维针织女式连衣裙', desc_en: 'Synthetic fibre knitted dresses for women', duty: 12, ad: 0 },
  { hs: '6104440000', desc_cn: '人造纤维针织女式连衣裙', desc_en: 'Artificial fibre knitted dresses for women', duty: 12, ad: 0 },
  { hs: '6103420000', desc_cn: '棉制针织男裤', desc_en: 'Cotton knitted trousers for men', duty: 12, ad: 0 },
  { hs: '6103430000', desc_cn: '合成纤维针织男裤', desc_en: 'Synthetic fibre knitted trousers for men', duty: 12, ad: 0 },
  { hs: '6104620000', desc_cn: '棉制针织女裤', desc_en: 'Cotton knitted trousers for women', duty: 12, ad: 0 },
  { hs: '6104630000', desc_cn: '合成纤维针织女裤', desc_en: 'Synthetic fibre knitted trousers for women', duty: 12, ad: 0 },
  { hs: '6115100000', desc_cn: '弹力袜类', desc_en: 'Graduated compression hosiery', duty: 12, ad: 0 },
  { hs: '6115210000', desc_cn: '合成纤维连裤袜', desc_en: 'Pantyhose of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6115220000', desc_cn: '合成纤维女袜', desc_en: 'Women stockings of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6115960000', desc_cn: '合成纤维袜子', desc_en: 'Hosiery of synthetic fibres', duty: 12, ad: 0 },
  
  // ==================== 第62章：非针织服装 ====================
  { hs: '6201110000', desc_cn: '羊毛男式大衣', desc_en: 'Men overcoats of wool', duty: 12, ad: 0 },
  { hs: '6201120000', desc_cn: '棉制男式大衣', desc_en: 'Men overcoats of cotton', duty: 12, ad: 0 },
  { hs: '6201130000', desc_cn: '化纤男式大衣', desc_en: 'Men overcoats of man-made fibres', duty: 12, ad: 0 },
  { hs: '6202110000', desc_cn: '羊毛女式大衣', desc_en: 'Women overcoats of wool', duty: 12, ad: 0 },
  { hs: '6202120000', desc_cn: '棉制女式大衣', desc_en: 'Women overcoats of cotton', duty: 12, ad: 0 },
  { hs: '6202130000', desc_cn: '化纤女式大衣', desc_en: 'Women overcoats of man-made fibres', duty: 12, ad: 0 },
  { hs: '6203110000', desc_cn: '羊毛男式套装', desc_en: 'Men suits of wool', duty: 12, ad: 0 },
  { hs: '6203120000', desc_cn: '合成纤维男式套装', desc_en: 'Men suits of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6203420000', desc_cn: '棉制男裤', desc_en: 'Men trousers of cotton', duty: 12, ad: 0 },
  { hs: '6203430000', desc_cn: '合成纤维男裤', desc_en: 'Men trousers of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6204110000', desc_cn: '羊毛女式套装', desc_en: 'Women suits of wool', duty: 12, ad: 0 },
  { hs: '6204120000', desc_cn: '棉制女式套装', desc_en: 'Women suits of cotton', duty: 12, ad: 0 },
  { hs: '6204420000', desc_cn: '棉制女式连衣裙', desc_en: 'Women dresses of cotton', duty: 12, ad: 0 },
  { hs: '6204430000', desc_cn: '合成纤维女式连衣裙', desc_en: 'Women dresses of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6204620000', desc_cn: '棉制女裤', desc_en: 'Women trousers of cotton', duty: 12, ad: 0 },
  { hs: '6204630000', desc_cn: '合成纤维女裤', desc_en: 'Women trousers of synthetic fibres', duty: 12, ad: 0 },
  { hs: '6205200000', desc_cn: '棉制男式衬衫', desc_en: 'Men shirts of cotton', duty: 12, ad: 0 },
  { hs: '6205300000', desc_cn: '化纤男式衬衫', desc_en: 'Men shirts of man-made fibres', duty: 12, ad: 0 },
  { hs: '6206300000', desc_cn: '棉制女式衬衫', desc_en: 'Women blouses of cotton', duty: 12, ad: 0 },
  { hs: '6206400000', desc_cn: '化纤女式衬衫', desc_en: 'Women blouses of man-made fibres', duty: 12, ad: 0 },
  
  // ==================== 第64章：鞋类（含反倾销税）====================
  { hs: '6401100000', desc_cn: '带金属护头的防水鞋', desc_en: 'Waterproof footwear with metal toe-cap', duty: 17, ad: 16.5 },
  { hs: '6401920000', desc_cn: '其他橡胶防水短靴', desc_en: 'Other rubber waterproof boots', duty: 17, ad: 16.5 },
  { hs: '6401990000', desc_cn: '其他橡胶防水鞋', desc_en: 'Other rubber waterproof footwear', duty: 17, ad: 16.5 },
  { hs: '6402120000', desc_cn: '塑料滑雪靴', desc_en: 'Ski-boots of plastics', duty: 17, ad: 16.5 },
  { hs: '6402190000', desc_cn: '其他塑料运动鞋', desc_en: 'Other sports footwear of plastics', duty: 17, ad: 16.5 },
  { hs: '6402200000', desc_cn: '橡塑鞋面固定带鞋', desc_en: 'Footwear with upper straps', duty: 17, ad: 16.5 },
  { hs: '6402910000', desc_cn: '橡塑短靴', desc_en: 'Other rubber/plastic ankle boots', duty: 17, ad: 16.5 },
  { hs: '6402990000', desc_cn: '其他橡塑鞋', desc_en: 'Other rubber/plastic footwear', duty: 16.9, ad: 16.5 },
  { hs: '6403120000', desc_cn: '皮面滑雪靴', desc_en: 'Ski-boots with leather upper', duty: 8, ad: 16.5 },
  { hs: '6403190000', desc_cn: '其他皮面运动鞋', desc_en: 'Other sports footwear with leather upper', duty: 8, ad: 16.5 },
  { hs: '6403400000', desc_cn: '带金属护头的皮面鞋', desc_en: 'Leather footwear with metal toe-cap', duty: 8, ad: 16.5 },
  { hs: '6403510000', desc_cn: '皮面短靴', desc_en: 'Leather ankle boots', duty: 8, ad: 16.5 },
  { hs: '6403590000', desc_cn: '其他皮面鞋', desc_en: 'Other leather footwear', duty: 8, ad: 16.5 },
  { hs: '6403910000', desc_cn: '皮底皮面短靴', desc_en: 'Leather upper and sole ankle boots', duty: 8, ad: 16.5 },
  { hs: '6403990000', desc_cn: '其他皮底皮面鞋', desc_en: 'Other leather upper and sole footwear', duty: 8, ad: 16.5 },
  { hs: '6404110000', desc_cn: '纺织面运动鞋', desc_en: 'Sports footwear with textile upper', duty: 16.9, ad: 16.5 },
  { hs: '6404190000', desc_cn: '其他纺织面鞋', desc_en: 'Other footwear with textile upper', duty: 16.9, ad: 16.5 },
  { hs: '6404200000', desc_cn: '纺织面皮底鞋', desc_en: 'Footwear with textile upper leather sole', duty: 8, ad: 16.5 },
  { hs: '6405100000', desc_cn: '其他皮面鞋', desc_en: 'Other footwear with leather upper', duty: 8, ad: 0 },
  { hs: '6405200000', desc_cn: '其他纺织面鞋', desc_en: 'Other footwear with textile upper', duty: 17, ad: 0 },
  { hs: '6405900000', desc_cn: '其他鞋', desc_en: 'Other footwear', duty: 17, ad: 0 },
  { hs: '6406100000', desc_cn: '鞋面及零件', desc_en: 'Uppers and parts', duty: 3, ad: 0 },
  { hs: '6406200000', desc_cn: '鞋外底及鞋跟', desc_en: 'Outer soles and heels', duty: 8, ad: 0 },
  { hs: '6406900000', desc_cn: '其他鞋零件', desc_en: 'Other parts of footwear', duty: 3, ad: 0 },
  
  // ==================== 第69章：陶瓷（含反倾销税）====================
  { hs: '6911100000', desc_cn: '瓷制餐具厨房用具', desc_en: 'Porcelain tableware kitchenware', duty: 12, ad: 36.1 },
  { hs: '6911900000', desc_cn: '其他瓷制家庭用品', desc_en: 'Other porcelain household articles', duty: 12, ad: 36.1 },
  { hs: '6912000000', desc_cn: '陶制餐具及其他家用制品', desc_en: 'Ceramic tableware other household', duty: 12, ad: 17.6 },
  { hs: '6913100000', desc_cn: '瓷塑像及装饰品', desc_en: 'Porcelain statuettes ornaments', duty: 0, ad: 0 },
  { hs: '6913900000', desc_cn: '其他陶塑像及装饰品', desc_en: 'Other ceramic statuettes ornaments', duty: 0, ad: 0 },
  { hs: '6914100000', desc_cn: '其他瓷制品', desc_en: 'Other articles of porcelain', duty: 0, ad: 0 },
  { hs: '6914900000', desc_cn: '其他陶制品', desc_en: 'Other articles of ceramics', duty: 0, ad: 0 },
  
  // ==================== 第70章：玻璃（含反倾销税）====================
  { hs: '7010100000', desc_cn: '玻璃安瓿', desc_en: 'Glass ampoules', duty: 0, ad: 0 },
  { hs: '7010200000', desc_cn: '玻璃塞盖等封口器具', desc_en: 'Stoppers lids caps of glass', duty: 0, ad: 0 },
  { hs: '7010901000', desc_cn: '装运货物用玻璃容器', desc_en: 'Glass containers for conveyance', duty: 0, ad: 0 },
  { hs: '7010909000', desc_cn: '其他玻璃容器', desc_en: 'Other glass containers', duty: 0, ad: 0 },
  { hs: '7013100000', desc_cn: '玻璃陶瓷玻璃器皿', desc_en: 'Glass-ceramics glassware', duty: 11, ad: 0 },
  { hs: '7013220000', desc_cn: '铅晶质玻璃杯', desc_en: 'Drinking glasses of lead crystal', duty: 11, ad: 0 },
  { hs: '7013280000', desc_cn: '其他玻璃杯', desc_en: 'Other drinking glasses', duty: 11, ad: 0 },
  { hs: '7013330000', desc_cn: '铅晶质玻璃餐具', desc_en: 'Lead crystal tableware', duty: 11, ad: 0 },
  { hs: '7013370000', desc_cn: '其他玻璃餐具', desc_en: 'Other glass tableware', duty: 11, ad: 0 },
  { hs: '7013410000', desc_cn: '铅晶质玻璃装饰品', desc_en: 'Lead crystal ornaments', duty: 11, ad: 0 },
  { hs: '7013420000', desc_cn: '低膨胀玻璃制品', desc_en: 'Low expansion glass articles', duty: 11, ad: 0 },
  { hs: '7013490000', desc_cn: '其他玻璃装饰品', desc_en: 'Other glass ornaments', duty: 11, ad: 0 },
  { hs: '7013910000', desc_cn: '铅晶质其他玻璃器皿', desc_en: 'Other lead crystal glassware', duty: 11, ad: 0 },
  { hs: '7013990000', desc_cn: '其他玻璃器皿', desc_en: 'Other glassware', duty: 11, ad: 0 },
  { hs: '7019110000', desc_cn: '切短玻璃纤维', desc_en: 'Chopped glass strands', duty: 0, ad: 99.7 },
  { hs: '7019120000', desc_cn: '玻璃纤维粗纱', desc_en: 'Glass fibre rovings', duty: 0, ad: 99.7 },
  { hs: '7019190000', desc_cn: '其他玻璃纤维条股', desc_en: 'Other glass fibre strands', duty: 0, ad: 99.7 },
  { hs: '7019310000', desc_cn: '玻璃纤维薄垫', desc_en: 'Glass fibre mats', duty: 0, ad: 99.7 },
  { hs: '7019320000', desc_cn: '玻璃纤维薄片', desc_en: 'Glass fibre veils', duty: 3.5, ad: 99.7 },
  { hs: '7019390000', desc_cn: '其他玻璃纤维网垫', desc_en: 'Other glass fibre webs mats', duty: 3.5, ad: 99.7 },
  { hs: '7019400000', desc_cn: '玻璃纤维机织物', desc_en: 'Woven glass fibre fabrics', duty: 3.5, ad: 99.7 },
  { hs: '7019510000', desc_cn: '宽度<=30cm玻纤织物', desc_en: 'Glass fibre fabrics <=30cm', duty: 3.5, ad: 0 },
  { hs: '7019520000', desc_cn: '宽度>30cm玻纤平织物', desc_en: 'Glass fibre plain weave >30cm', duty: 3.5, ad: 0 },
  { hs: '7019590000', desc_cn: '其他玻璃纤维织物', desc_en: 'Other glass fibre fabrics', duty: 3.5, ad: 0 },
  { hs: '7019900000', desc_cn: '其他玻璃纤维制品', desc_en: 'Other glass fibre articles', duty: 3.5, ad: 0 },
  
  // ==================== 第72-73章：钢铁（含反倾销税）====================
  { hs: '7208100000', desc_cn: '热轧花纹钢卷', desc_en: 'Hot-rolled steel coils with patterns', duty: 0, ad: 35.9 },
  { hs: '7208250000', desc_cn: '热轧酸洗钢卷>=4.75mm', desc_en: 'Hot-rolled pickled steel >=4.75mm', duty: 0, ad: 35.9 },
  { hs: '7208260000', desc_cn: '热轧酸洗钢卷3-4.75mm', desc_en: 'Hot-rolled pickled steel 3-4.75mm', duty: 0, ad: 35.9 },
  { hs: '7208270000', desc_cn: '热轧酸洗钢卷<3mm', desc_en: 'Hot-rolled pickled steel <3mm', duty: 0, ad: 35.9 },
  { hs: '7210410000', desc_cn: '波纹镀锌钢板', desc_en: 'Corrugated galvanized steel', duty: 0, ad: 44.7 },
  { hs: '7210490000', desc_cn: '其他镀锌钢板', desc_en: 'Other galvanized steel', duty: 0, ad: 44.7 },
  { hs: '7210610000', desc_cn: '铝锌合金镀层钢板', desc_en: 'Aluminium-zinc coated steel', duty: 0, ad: 44.7 },
  { hs: '7210700000', desc_cn: '涂漆或塑料涂层钢板', desc_en: 'Painted or plastic-coated steel', duty: 0, ad: 44.7 },
  { hs: '7219110000', desc_cn: '热轧不锈钢卷>10mm', desc_en: 'Hot-rolled stainless steel >10mm', duty: 0, ad: 24.4 },
  { hs: '7219120000', desc_cn: '热轧不锈钢卷4.75-10mm', desc_en: 'Hot-rolled stainless steel 4.75-10mm', duty: 0, ad: 24.4 },
  { hs: '7219130000', desc_cn: '热轧不锈钢卷3-4.75mm', desc_en: 'Hot-rolled stainless steel 3-4.75mm', duty: 0, ad: 24.4 },
  { hs: '7219140000', desc_cn: '热轧不锈钢卷<3mm', desc_en: 'Hot-rolled stainless steel <3mm', duty: 0, ad: 24.4 },
  { hs: '7219310000', desc_cn: '冷轧不锈钢>=4.75mm', desc_en: 'Cold-rolled stainless steel >=4.75mm', duty: 0, ad: 25.2 },
  { hs: '7219320000', desc_cn: '冷轧不锈钢3-4.75mm', desc_en: 'Cold-rolled stainless steel 3-4.75mm', duty: 0, ad: 25.2 },
  { hs: '7219330000', desc_cn: '冷轧不锈钢1-3mm', desc_en: 'Cold-rolled stainless steel 1-3mm', duty: 0, ad: 25.2 },
  { hs: '7219340000', desc_cn: '冷轧不锈钢0.5-1mm', desc_en: 'Cold-rolled stainless steel 0.5-1mm', duty: 0, ad: 25.2 },
  { hs: '7219350000', desc_cn: '冷轧不锈钢<0.5mm', desc_en: 'Cold-rolled stainless steel <0.5mm', duty: 0, ad: 25.2 },
  { hs: '7220110000', desc_cn: '热轧不锈钢带>=4.75mm', desc_en: 'Hot-rolled stainless steel strips >=4.75mm', duty: 0, ad: 24.4 },
  { hs: '7220120000', desc_cn: '热轧不锈钢带<4.75mm', desc_en: 'Hot-rolled stainless steel strips <4.75mm', duty: 0, ad: 24.4 },
  { hs: '7220200000', desc_cn: '冷轧不锈钢带', desc_en: 'Cold-rolled stainless steel strips', duty: 0, ad: 25.2 },
  { hs: '7318120000', desc_cn: '木螺钉', desc_en: 'Wood screws', duty: 3.7, ad: 85.0 },
  { hs: '7318140000', desc_cn: '自攻螺钉', desc_en: 'Self-tapping screws', duty: 3.7, ad: 85.0 },
  { hs: '7318150000', desc_cn: '其他螺钉螺栓', desc_en: 'Other screws and bolts', duty: 3.7, ad: 85.0 },
  { hs: '7318160000', desc_cn: '螺母', desc_en: 'Nuts', duty: 3.7, ad: 85.0 },
  { hs: '7318190000', desc_cn: '其他螺纹制品', desc_en: 'Other threaded articles', duty: 3.7, ad: 0 },
  { hs: '7318210000', desc_cn: '弹簧垫圈', desc_en: 'Spring washers', duty: 3.7, ad: 0 },
  { hs: '7318220000', desc_cn: '其他垫圈', desc_en: 'Other washers', duty: 3.7, ad: 0 },
  { hs: '7318230000', desc_cn: '铆钉', desc_en: 'Rivets', duty: 3.7, ad: 0 },
  { hs: '7318240000', desc_cn: '销及开尾销', desc_en: 'Cotters and cotter-pins', duty: 3.7, ad: 0 },
  { hs: '7318290000', desc_cn: '其他非螺纹紧固件', desc_en: 'Other non-threaded fasteners', duty: 3.7, ad: 0 },
  { hs: '7326110000', desc_cn: '钢铁制研磨球', desc_en: 'Grinding balls of iron or steel', duty: 2.7, ad: 0 },
  { hs: '7326190000', desc_cn: '其他锻造钢铁制品', desc_en: 'Other forged iron or steel articles', duty: 2.7, ad: 0 },
  { hs: '7326200000', desc_cn: '钢铁丝制品', desc_en: 'Articles of iron or steel wire', duty: 2.7, ad: 0 },
  { hs: '7326900000', desc_cn: '其他钢铁制品', desc_en: 'Other articles of iron or steel', duty: 2.7, ad: 0 },
  
  // ==================== 第76章：铝（含反倾销税）====================
  { hs: '7604100000', desc_cn: '铝条杆实心', desc_en: 'Aluminium bars rods solid', duty: 7.5, ad: 0 },
  { hs: '7604210000', desc_cn: '铝空心型材', desc_en: 'Hollow aluminium profiles', duty: 7.5, ad: 30.4 },
  { hs: '7604290000', desc_cn: '其他铝型材', desc_en: 'Other aluminium profiles', duty: 7.5, ad: 30.4 },
  { hs: '7606110000', desc_cn: '矩形铝板>=0.2mm', desc_en: 'Rectangular aluminium plates >=0.2mm', duty: 7.5, ad: 30.4 },
  { hs: '7606120000', desc_cn: '矩形铝合金板>=0.2mm', desc_en: 'Rectangular aluminium alloy plates >=0.2mm', duty: 7.5, ad: 30.4 },
  { hs: '7606910000', desc_cn: '非矩形铝板', desc_en: 'Non-rectangular aluminium plates', duty: 7.5, ad: 0 },
  { hs: '7606920000', desc_cn: '非矩形铝合金板', desc_en: 'Non-rectangular aluminium alloy plates', duty: 7.5, ad: 0 },
  { hs: '7607111000', desc_cn: '轧制铝箔无衬背<=0.01mm', desc_en: 'Rolled aluminium foil <=0.01mm', duty: 7.5, ad: 17.6 },
  { hs: '7607119000', desc_cn: '轧制铝箔无衬背>0.01mm', desc_en: 'Rolled aluminium foil >0.01mm', duty: 7.5, ad: 17.6 },
  { hs: '7607190000', desc_cn: '其他无衬背铝箔', desc_en: 'Other aluminium foil not backed', duty: 7.5, ad: 17.6 },
  { hs: '7607200000', desc_cn: '有衬背铝箔', desc_en: 'Aluminium foil backed', duty: 7.5, ad: 17.6 },
  { hs: '7608100000', desc_cn: '铝管', desc_en: 'Aluminium tubes and pipes', duty: 7.5, ad: 30.4 },
  { hs: '7608200000', desc_cn: '铝合金管', desc_en: 'Aluminium alloy tubes and pipes', duty: 7.5, ad: 30.4 },
  { hs: '7610100000', desc_cn: '铝制门窗及框架', desc_en: 'Aluminium doors windows frames', duty: 6, ad: 0 },
  { hs: '7610900000', desc_cn: '其他铝制结构体', desc_en: 'Other aluminium structures', duty: 6, ad: 0 },
  { hs: '7612100000', desc_cn: '铝制软管容器', desc_en: 'Aluminium collapsible containers', duty: 6, ad: 0 },
  { hs: '7612901000', desc_cn: '铝制桶罐盒等容器>=50L', desc_en: 'Aluminium containers >=50L', duty: 6, ad: 0 },
  { hs: '7612909000', desc_cn: '铝制桶罐盒等容器<50L', desc_en: 'Aluminium containers <50L', duty: 6, ad: 0 },
  { hs: '7615100000', desc_cn: '铝制餐桌厨房用具', desc_en: 'Aluminium table kitchen articles', duty: 6, ad: 0 },
  { hs: '7615200000', desc_cn: '铝制卫生器具', desc_en: 'Aluminium sanitary ware', duty: 6, ad: 0 },
  { hs: '7616100000', desc_cn: '铝钉钉书钉螺钉等', desc_en: 'Aluminium nails staples screws', duty: 6, ad: 0 },
  { hs: '7616910000', desc_cn: '铝丝布网格栅', desc_en: 'Aluminium wire cloth grill netting', duty: 6, ad: 0 },
  { hs: '7616990000', desc_cn: '其他铝制品', desc_en: 'Other aluminium articles', duty: 6, ad: 0 },
  
  // ==================== 第84章：机械设备 ====================
  { hs: '8414510000', desc_cn: '台扇落地扇壁扇<=125W', desc_en: 'Table floor wall fans <=125W', duty: 2.7, ad: 0 },
  { hs: '8414590000', desc_cn: '其他风扇', desc_en: 'Other fans', duty: 2.7, ad: 0 },
  { hs: '8414800000', desc_cn: '其他空气泵压缩机', desc_en: 'Other air pumps compressors', duty: 2.7, ad: 0 },
  { hs: '8415101000', desc_cn: '独立式空调<=4KW', desc_en: 'Self-contained air conditioners <=4KW', duty: 2.5, ad: 0 },
  { hs: '8415102000', desc_cn: '独立式空调>4KW', desc_en: 'Self-contained air conditioners >4KW', duty: 2.5, ad: 0 },
  { hs: '8415810000', desc_cn: '带制冷装置的空调', desc_en: 'Air conditioning with refrigeration', duty: 2.5, ad: 0 },
  { hs: '8415820000', desc_cn: '其他带制冷装置空调', desc_en: 'Other air conditioning with refrigeration', duty: 2.5, ad: 0 },
  { hs: '8415830000', desc_cn: '不带制冷装置空调', desc_en: 'Air conditioning without refrigeration', duty: 2.5, ad: 0 },
  { hs: '8418101000', desc_cn: '容积>500L冷藏冷冻组合机', desc_en: 'Combined refrigerator-freezers >500L', duty: 2.5, ad: 0 },
  { hs: '8418102000', desc_cn: '容积200-500L冷藏冷冻组合机', desc_en: 'Combined refrigerator-freezers 200-500L', duty: 2.5, ad: 0 },
  { hs: '8418103000', desc_cn: '容积<200L冷藏冷冻组合机', desc_en: 'Combined refrigerator-freezers <200L', duty: 2.5, ad: 0 },
  { hs: '8418210000', desc_cn: '压缩式家用冰箱', desc_en: 'Compression type household refrigerators', duty: 2.5, ad: 0 },
  { hs: '8418290000', desc_cn: '其他家用冰箱', desc_en: 'Other household refrigerators', duty: 2.5, ad: 0 },
  { hs: '8418300000', desc_cn: '冷柜', desc_en: 'Freezers', duty: 2.5, ad: 0 },
  { hs: '8418400000', desc_cn: '立式冷柜', desc_en: 'Upright freezers', duty: 2.5, ad: 0 },
  { hs: '8443321000', desc_cn: '打印机', desc_en: 'Printers', duty: 0, ad: 0 },
  { hs: '8443322000', desc_cn: '传真机', desc_en: 'Facsimile machines', duty: 0, ad: 0 },
  { hs: '8443329000', desc_cn: '其他打印复印传真一体机', desc_en: 'Other printing copying faxing machines', duty: 0, ad: 0 },
  { hs: '8450110000', desc_cn: '全自动洗衣机<=10kg', desc_en: 'Fully-automatic washing machines <=10kg', duty: 2.7, ad: 0 },
  { hs: '8450120000', desc_cn: '带离心机洗衣机', desc_en: 'Washing machines with centrifuge', duty: 2.7, ad: 0 },
  { hs: '8450190000', desc_cn: '其他洗衣机', desc_en: 'Other washing machines', duty: 2.7, ad: 0 },
  { hs: '8450200000', desc_cn: '容量>10kg洗衣机', desc_en: 'Washing machines >10kg', duty: 2.7, ad: 0 },
  { hs: '8467210000', desc_cn: '电动手钻', desc_en: 'Electric drills', duty: 2.7, ad: 0 },
  { hs: '8467220000', desc_cn: '电动锯', desc_en: 'Electric saws', duty: 2.7, ad: 0 },
  { hs: '8467290000', desc_cn: '其他电动工具', desc_en: 'Other electric tools', duty: 2.7, ad: 0 },
  { hs: '8471300000', desc_cn: '便携式电脑<=10kg', desc_en: 'Portable computers <=10kg', duty: 0, ad: 0 },
  { hs: '8471410000', desc_cn: '其他数字自动数据处理设备', desc_en: 'Other digital automatic data processing', duty: 0, ad: 0 },
  { hs: '8471490000', desc_cn: '其他自动数据处理设备', desc_en: 'Other automatic data processing', duty: 0, ad: 0 },
  { hs: '8471500000', desc_cn: '数字处理部件', desc_en: 'Digital processing units', duty: 0, ad: 0 },
  { hs: '8471600000', desc_cn: '输入输出部件', desc_en: 'Input or output units', duty: 0, ad: 0 },
  { hs: '8471700000', desc_cn: '存储部件', desc_en: 'Storage units', duty: 0, ad: 0 },
  { hs: '8471800000', desc_cn: '其他自动数据处理设备部件', desc_en: 'Other data processing units', duty: 0, ad: 0 },
  { hs: '8473300000', desc_cn: '电脑零部件', desc_en: 'Parts of computers', duty: 0, ad: 0 },
  { hs: '8481100000', desc_cn: '减压阀', desc_en: 'Pressure-reducing valves', duty: 2.7, ad: 0 },
  { hs: '8481200000', desc_cn: '油压气压传动阀', desc_en: 'Valves for oleohydraulic pneumatic', duty: 2.7, ad: 0 },
  { hs: '8481300000', desc_cn: '止回阀', desc_en: 'Check valves', duty: 2.7, ad: 0 },
  { hs: '8481400000', desc_cn: '安全阀溢流阀', desc_en: 'Safety or relief valves', duty: 2.7, ad: 0 },
  { hs: '8481800000', desc_cn: '其他龙头旋塞阀门', desc_en: 'Other taps cocks valves', duty: 2.7, ad: 0 },
  { hs: '8481900000', desc_cn: '龙头阀门零件', desc_en: 'Parts of taps cocks valves', duty: 2.7, ad: 0 },
  
  // ==================== 第85章：电气设备 ====================
  { hs: '8501100000', desc_cn: '玩具用电动机', desc_en: 'Motors for toys', duty: 2.7, ad: 30.0 },
  { hs: '8501200000', desc_cn: '交直流两用电动机', desc_en: 'Universal AC/DC motors', duty: 2.7, ad: 0 },
  { hs: '8501310000', desc_cn: '直流电动机<=750W', desc_en: 'DC motors <=750W', duty: 2.7, ad: 0 },
  { hs: '8501320000', desc_cn: '直流电动机750W-75KW', desc_en: 'DC motors 750W-75KW', duty: 2.7, ad: 0 },
  { hs: '8501330000', desc_cn: '直流电动机75-375KW', desc_en: 'DC motors 75-375KW', duty: 2.7, ad: 0 },
  { hs: '8501340000', desc_cn: '直流电动机>375KW', desc_en: 'DC motors >375KW', duty: 2.7, ad: 0 },
  { hs: '8501400000', desc_cn: '单相交流电动机', desc_en: 'Single-phase AC motors', duty: 2.7, ad: 0 },
  { hs: '8501510000', desc_cn: '多相交流电动机<=750W', desc_en: 'Multi-phase AC motors <=750W', duty: 2.7, ad: 0 },
  { hs: '8501520000', desc_cn: '多相交流电动机750W-75KW', desc_en: 'Multi-phase AC motors 750W-75KW', duty: 2.7, ad: 0 },
  { hs: '8504310000', desc_cn: '变压器<=1KVA', desc_en: 'Transformers <=1KVA', duty: 2.7, ad: 0 },
  { hs: '8504320000', desc_cn: '变压器1-16KVA', desc_en: 'Transformers 1-16KVA', duty: 2.7, ad: 0 },
  { hs: '8504330000', desc_cn: '变压器16-500KVA', desc_en: 'Transformers 16-500KVA', duty: 2.7, ad: 0 },
  { hs: '8504340000', desc_cn: '变压器>500KVA', desc_en: 'Transformers >500KVA', duty: 2.7, ad: 0 },
  { hs: '8504400000', desc_cn: '静止变流器', desc_en: 'Static converters', duty: 2.7, ad: 0 },
  { hs: '8506100000', desc_cn: '二氧化锰电池', desc_en: 'Manganese dioxide batteries', duty: 4.7, ad: 0 },
  { hs: '8506500000', desc_cn: '锂电池', desc_en: 'Lithium batteries', duty: 4.7, ad: 0 },
  { hs: '8506600000', desc_cn: '空气锌电池', desc_en: 'Air-zinc batteries', duty: 4.7, ad: 0 },
  { hs: '8506800000', desc_cn: '其他原电池', desc_en: 'Other primary cells', duty: 4.7, ad: 0 },
  { hs: '8507100000', desc_cn: '铅酸蓄电池', desc_en: 'Lead-acid accumulators', duty: 3.7, ad: 0 },
  { hs: '8507200000', desc_cn: '其他铅酸蓄电池', desc_en: 'Other lead-acid accumulators', duty: 3.7, ad: 0 },
  { hs: '8507300000', desc_cn: '镍镉蓄电池', desc_en: 'Nickel-cadmium accumulators', duty: 2.7, ad: 0 },
  { hs: '8507400000', desc_cn: '镍铁蓄电池', desc_en: 'Nickel-iron accumulators', duty: 2.7, ad: 0 },
  { hs: '8507500000', desc_cn: '镍氢蓄电池', desc_en: 'Nickel-metal hydride accumulators', duty: 2.7, ad: 0 },
  { hs: '8507600000', desc_cn: '锂离子蓄电池', desc_en: 'Lithium-ion accumulators', duty: 2.7, ad: 0 },
  { hs: '8507800000', desc_cn: '其他蓄电池', desc_en: 'Other accumulators', duty: 2.7, ad: 0 },
  { hs: '8516100000', desc_cn: '电热水器', desc_en: 'Electric water heaters', duty: 2.7, ad: 0 },
  { hs: '8516210000', desc_cn: '电暖气', desc_en: 'Electric space heaters', duty: 2.7, ad: 0 },
  { hs: '8516290000', desc_cn: '其他电气空间加热器', desc_en: 'Other electric space heaters', duty: 2.7, ad: 0 },
  { hs: '8516310000', desc_cn: '电吹风', desc_en: 'Hairdryers', duty: 2.7, ad: 0 },
  { hs: '8516320000', desc_cn: '其他电气美发器具', desc_en: 'Other hairdressing apparatus', duty: 2.7, ad: 0 },
  { hs: '8516400000', desc_cn: '电熨斗', desc_en: 'Electric irons', duty: 2.7, ad: 0 },
  { hs: '8516500000', desc_cn: '微波炉', desc_en: 'Microwave ovens', duty: 5.0, ad: 0 },
  { hs: '8516600000', desc_cn: '电烤箱电灶', desc_en: 'Electric ovens cookers', duty: 2.7, ad: 0 },
  { hs: '8516710000', desc_cn: '咖啡机茶机', desc_en: 'Coffee or tea makers', duty: 2.7, ad: 0 },
  { hs: '8516720000', desc_cn: '面包机', desc_en: 'Toasters', duty: 2.7, ad: 0 },
  { hs: '8516790000', desc_cn: '其他电热器具', desc_en: 'Other electro-thermic appliances', duty: 2.7, ad: 0 },
  { hs: '8516800000', desc_cn: '电热电阻器', desc_en: 'Electric heating resistors', duty: 2.7, ad: 0 },
  { hs: '8517110000', desc_cn: '无绳电话', desc_en: 'Cordless telephones', duty: 0, ad: 0 },
  { hs: '8517120000', desc_cn: '手机', desc_en: 'Telephones for cellular networks', duty: 0, ad: 0 },
  { hs: '8517180000', desc_cn: '其他电话机', desc_en: 'Other telephones', duty: 0, ad: 0 },
  { hs: '8517610000', desc_cn: '基站', desc_en: 'Base stations', duty: 0, ad: 0 },
  { hs: '8517620000', desc_cn: '接收发射设备', desc_en: 'Reception transmission apparatus', duty: 0, ad: 0 },
  { hs: '8517690000', desc_cn: '其他通信设备', desc_en: 'Other communication apparatus', duty: 0, ad: 0 },
  { hs: '8518100000', desc_cn: '麦克风', desc_en: 'Microphones', duty: 2.5, ad: 0 },
  { hs: '8518210000', desc_cn: '单喇叭音箱', desc_en: 'Single loudspeakers', duty: 2.5, ad: 0 },
  { hs: '8518220000', desc_cn: '多喇叭音箱', desc_en: 'Multiple loudspeakers', duty: 2.5, ad: 0 },
  { hs: '8518290000', desc_cn: '其他扬声器', desc_en: 'Other loudspeakers', duty: 2.5, ad: 0 },
  { hs: '8518300000', desc_cn: '耳机', desc_en: 'Headphones earphones', duty: 2.5, ad: 0 },
  { hs: '8518400000', desc_cn: '音频放大器', desc_en: 'Audio-frequency amplifiers', duty: 2.5, ad: 0 },
  { hs: '8518500000', desc_cn: '扩音机组', desc_en: 'Electric sound amplifier sets', duty: 2.5, ad: 0 },
  { hs: '8523210000', desc_cn: '磁卡', desc_en: 'Magnetic cards', duty: 0, ad: 0 },
  { hs: '8523290000', desc_cn: '其他磁性介质', desc_en: 'Other magnetic media', duty: 0, ad: 0 },
  { hs: '8523410000', desc_cn: '光学介质', desc_en: 'Optical media', duty: 0, ad: 0 },
  { hs: '8523490000', desc_cn: '其他光学介质', desc_en: 'Other optical media', duty: 0, ad: 0 },
  { hs: '8523510000', desc_cn: '闪存', desc_en: 'Solid-state non-volatile storage', duty: 0, ad: 0 },
  { hs: '8523520000', desc_cn: '智能卡', desc_en: 'Smart cards', duty: 0, ad: 0 },
  { hs: '8523590000', desc_cn: '其他半导体介质', desc_en: 'Other semiconductor media', duty: 0, ad: 0 },
  { hs: '8523800000', desc_cn: '其他录制媒体', desc_en: 'Other recording media', duty: 0, ad: 0 },
  { hs: '8528420000', desc_cn: '直接连接电脑的显示器', desc_en: 'Monitors for computers', duty: 0, ad: 0 },
  { hs: '8528520000', desc_cn: '其他电脑显示器', desc_en: 'Other monitors for computers', duty: 0, ad: 0 },
  { hs: '8528620000', desc_cn: '投影仪', desc_en: 'Projectors', duty: 0, ad: 0 },
  { hs: '8528720000', desc_cn: '彩色电视机', desc_en: 'Colour television receivers', duty: 14, ad: 0 },
  { hs: '8528730000', desc_cn: '黑白电视机', desc_en: 'Black and white television receivers', duty: 14, ad: 0 },
  { hs: '8541100000', desc_cn: '二极管', desc_en: 'Diodes', duty: 0, ad: 0 },
  { hs: '8541210000', desc_cn: '晶体管<1W', desc_en: 'Transistors <1W', duty: 0, ad: 0 },
  { hs: '8541290000', desc_cn: '晶体管>=1W', desc_en: 'Transistors >=1W', duty: 0, ad: 0 },
  { hs: '8541300000', desc_cn: '晶闸管', desc_en: 'Thyristors', duty: 0, ad: 0 },
  { hs: '8541401000', desc_cn: '发光二极管', desc_en: 'Light-emitting diodes', duty: 0, ad: 0 },
  { hs: '8541402000', desc_cn: '太阳能电池', desc_en: 'Solar cells', duty: 0, ad: 0 },
  { hs: '8541409000', desc_cn: '其他光敏器件', desc_en: 'Other photosensitive devices', duty: 0, ad: 0 },
  { hs: '8541500000', desc_cn: '其他半导体器件', desc_en: 'Other semiconductor devices', duty: 0, ad: 0 },
  { hs: '8541600000', desc_cn: '压电晶体', desc_en: 'Piezoelectric crystals', duty: 0, ad: 0 },
  { hs: '8542310000', desc_cn: '处理器', desc_en: 'Processors', duty: 0, ad: 0 },
  { hs: '8542320000', desc_cn: '存储器', desc_en: 'Memories', duty: 0, ad: 0 },
  { hs: '8542330000', desc_cn: '放大器', desc_en: 'Amplifiers', duty: 0, ad: 0 },
  { hs: '8542390000', desc_cn: '其他集成电路', desc_en: 'Other integrated circuits', duty: 0, ad: 0 },
  { hs: '8544110000', desc_cn: '铜漆包线', desc_en: 'Copper winding wire', duty: 3.7, ad: 0 },
  { hs: '8544190000', desc_cn: '其他漆包线', desc_en: 'Other winding wire', duty: 3.7, ad: 0 },
  { hs: '8544200000', desc_cn: '同轴电缆', desc_en: 'Coaxial cable', duty: 3.7, ad: 0 },
  { hs: '8544300000', desc_cn: '点火线组', desc_en: 'Ignition wiring sets', duty: 3.7, ad: 0 },
  { hs: '8544421000', desc_cn: '带接头电线<=80V', desc_en: 'Electric conductors with connectors <=80V', duty: 3.7, ad: 0 },
  { hs: '8544429000', desc_cn: '带接头电线80-1000V', desc_en: 'Electric conductors with connectors 80-1000V', duty: 3.7, ad: 0 },
  { hs: '8544491000', desc_cn: '不带接头电线<=80V', desc_en: 'Electric conductors without connectors <=80V', duty: 3.7, ad: 0 },
  { hs: '8544499000', desc_cn: '不带接头电线80-1000V', desc_en: 'Electric conductors without connectors 80-1000V', duty: 3.7, ad: 0 },
  { hs: '8544600000', desc_cn: '电线电缆>1000V', desc_en: 'Electric conductors >1000V', duty: 3.7, ad: 0 },
  { hs: '8544700000', desc_cn: '光缆', desc_en: 'Optical fibre cables', duty: 3.7, ad: 0 },

  // ==================== 第87章：车辆（含反倾销税）====================
  { hs: '8711601000', desc_cn: '电动自行车助力车', desc_en: 'Electric bicycles with pedal assistance', duty: 6, ad: 79.3 },
  { hs: '8711609000', desc_cn: '其他电动自行车', desc_en: 'Other electric bicycles', duty: 6, ad: 79.3 },
  { hs: '8712003000', desc_cn: '自行车', desc_en: 'Bicycles', duty: 14, ad: 48.5 },
  { hs: '8713100000', desc_cn: '非机械驱动的轮椅车', desc_en: 'Wheelchairs not mechanically propelled', duty: 0, ad: 0 },
  { hs: '8713900000', desc_cn: '其他轮椅车', desc_en: 'Other wheelchairs', duty: 0, ad: 0 },
  { hs: '8714100000', desc_cn: '摩托车零件', desc_en: 'Parts of motorcycles', duty: 3.7, ad: 0 },
  { hs: '8714910000', desc_cn: '自行车车架车叉', desc_en: 'Frames forks for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714920000', desc_cn: '自行车车轮及零件', desc_en: 'Wheels and parts for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714930000', desc_cn: '自行车花毂', desc_en: 'Hubs for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714940000', desc_cn: '自行车刹车', desc_en: 'Brakes for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714950000', desc_cn: '自行车鞍座', desc_en: 'Saddles for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714960000', desc_cn: '自行车脚蹬', desc_en: 'Pedals for bicycles', duty: 4.7, ad: 0 },
  { hs: '8714990000', desc_cn: '自行车其他零件', desc_en: 'Other parts for bicycles', duty: 4.7, ad: 0 },
  { hs: '8708100000', desc_cn: '车辆保险杠', desc_en: 'Bumpers for vehicles', duty: 3.5, ad: 0 },
  { hs: '8708210000', desc_cn: '安全带', desc_en: 'Safety seat belts', duty: 3.5, ad: 0 },
  { hs: '8708290000', desc_cn: '其他车身零件', desc_en: 'Other body parts', duty: 3.5, ad: 0 },
  { hs: '8708300000', desc_cn: '制动器及零件', desc_en: 'Brakes and parts', duty: 3.5, ad: 0 },
  { hs: '8708400000', desc_cn: '变速箱及零件', desc_en: 'Gear boxes and parts', duty: 3.5, ad: 0 },
  { hs: '8708500000', desc_cn: '驱动桥及零件', desc_en: 'Drive-axles and parts', duty: 3.5, ad: 0 },
  { hs: '8708700000', desc_cn: '车轮及零件', desc_en: 'Wheels and parts', duty: 3.5, ad: 0 },
  { hs: '8708800000', desc_cn: '悬挂系统及零件', desc_en: 'Suspension and parts', duty: 3.5, ad: 0 },
  { hs: '8708910000', desc_cn: '散热器及零件', desc_en: 'Radiators and parts', duty: 3.5, ad: 0 },
  { hs: '8708920000', desc_cn: '消音器排气管', desc_en: 'Silencers and exhaust pipes', duty: 3.5, ad: 0 },
  { hs: '8708930000', desc_cn: '离合器及零件', desc_en: 'Clutches and parts', duty: 3.5, ad: 0 },
  { hs: '8708940000', desc_cn: '方向盘及零件', desc_en: 'Steering wheels and parts', duty: 3.5, ad: 0 },
  { hs: '8708950000', desc_cn: '安全气囊及零件', desc_en: 'Safety airbags and parts', duty: 3.5, ad: 0 },
  { hs: '8708990000', desc_cn: '其他车辆零件', desc_en: 'Other vehicle parts', duty: 3.5, ad: 0 },
  
  // ==================== 第40章：橡胶（含反倾销税）====================
  { hs: '4011100000', desc_cn: '小汽车轮胎', desc_en: 'Tyres for motor cars', duty: 4.5, ad: 48.5 },
  { hs: '4011200000', desc_cn: '公共汽车货车轮胎', desc_en: 'Tyres for buses lorries', duty: 4.5, ad: 48.5 },
  { hs: '4011300000', desc_cn: '飞机用轮胎', desc_en: 'Tyres for aircraft', duty: 4.5, ad: 0 },
  { hs: '4011400000', desc_cn: '摩托车轮胎', desc_en: 'Tyres for motorcycles', duty: 4.5, ad: 0 },
  { hs: '4011500000', desc_cn: '自行车轮胎', desc_en: 'Tyres for bicycles', duty: 4.5, ad: 0 },
  { hs: '4011700000', desc_cn: '农业机械轮胎', desc_en: 'Tyres for agricultural machines', duty: 4.5, ad: 0 },
  { hs: '4011800000', desc_cn: '工程机械轮胎', desc_en: 'Tyres for construction machines', duty: 4.5, ad: 0 },
  { hs: '4011900000', desc_cn: '其他新充气轮胎', desc_en: 'Other new pneumatic tyres', duty: 4.5, ad: 0 },
  { hs: '4012110000', desc_cn: '翻新轮胎小汽车', desc_en: 'Retreaded tyres for cars', duty: 4.5, ad: 0 },
  { hs: '4012120000', desc_cn: '翻新轮胎公共汽车货车', desc_en: 'Retreaded tyres for buses lorries', duty: 4.5, ad: 0 },
  { hs: '4012130000', desc_cn: '翻新轮胎飞机', desc_en: 'Retreaded tyres for aircraft', duty: 4.5, ad: 0 },
  { hs: '4012190000', desc_cn: '其他翻新轮胎', desc_en: 'Other retreaded tyres', duty: 4.5, ad: 0 },
  { hs: '4012200000', desc_cn: '旧充气轮胎', desc_en: 'Used pneumatic tyres', duty: 4.5, ad: 0 },
  { hs: '4013100000', desc_cn: '小汽车内胎', desc_en: 'Inner tubes for cars', duty: 4.5, ad: 0 },
  { hs: '4013200000', desc_cn: '自行车内胎', desc_en: 'Inner tubes for bicycles', duty: 4.5, ad: 0 },
  { hs: '4013900000', desc_cn: '其他内胎', desc_en: 'Other inner tubes', duty: 4.5, ad: 0 },
  
  // ==================== 第94章：家具 ====================
  { hs: '9401300000', desc_cn: '可调高度转椅', desc_en: 'Swivel seats with variable height', duty: 0, ad: 0 },
  { hs: '9401400000', desc_cn: '沙发床', desc_en: 'Seats convertible into beds', duty: 0, ad: 0 },
  { hs: '9401520000', desc_cn: '竹制座椅', desc_en: 'Seats of bamboo', duty: 0, ad: 0 },
  { hs: '9401530000', desc_cn: '藤制座椅', desc_en: 'Seats of rattan', duty: 0, ad: 0 },
  { hs: '9401610000', desc_cn: '木架软垫座椅', desc_en: 'Upholstered seats with wooden frame', duty: 0, ad: 0 },
  { hs: '9401690000', desc_cn: '其他木座椅', desc_en: 'Other wooden seats', duty: 0, ad: 0 },
  { hs: '9401710000', desc_cn: '金属架软垫座椅', desc_en: 'Upholstered seats with metal frame', duty: 0, ad: 0 },
  { hs: '9401790000', desc_cn: '其他金属座椅', desc_en: 'Other metal seats', duty: 0, ad: 0 },
  { hs: '9401800000', desc_cn: '其他座椅', desc_en: 'Other seats', duty: 0, ad: 0 },
  { hs: '9401900000', desc_cn: '座椅零件', desc_en: 'Parts of seats', duty: 0, ad: 0 },
  { hs: '9403100000', desc_cn: '金属办公家具', desc_en: 'Metal office furniture', duty: 0, ad: 0 },
  { hs: '9403200000', desc_cn: '其他金属家具', desc_en: 'Other metal furniture', duty: 0, ad: 0 },
  { hs: '9403300000', desc_cn: '木办公家具', desc_en: 'Wooden office furniture', duty: 0, ad: 0 },
  { hs: '9403400000', desc_cn: '木厨房家具', desc_en: 'Wooden kitchen furniture', duty: 0, ad: 0 },
  { hs: '9403500000', desc_cn: '木卧室家具', desc_en: 'Wooden bedroom furniture', duty: 0, ad: 0 },
  { hs: '9403600000', desc_cn: '其他木家具', desc_en: 'Other wooden furniture', duty: 0, ad: 0 },
  { hs: '9403700000', desc_cn: '塑料家具', desc_en: 'Plastics furniture', duty: 0, ad: 0 },
  { hs: '9403820000', desc_cn: '竹制家具', desc_en: 'Bamboo furniture', duty: 0, ad: 0 },
  { hs: '9403830000', desc_cn: '藤制家具', desc_en: 'Rattan furniture', duty: 0, ad: 0 },
  { hs: '9403890000', desc_cn: '其他材料家具', desc_en: 'Other material furniture', duty: 0, ad: 0 },
  { hs: '9403900000', desc_cn: '家具零件', desc_en: 'Parts of furniture', duty: 0, ad: 0 },
  { hs: '9404100000', desc_cn: '弹簧床垫', desc_en: 'Mattress supports', duty: 3.7, ad: 0 },
  { hs: '9404210000', desc_cn: '泡沫床垫', desc_en: 'Cellular rubber mattresses', duty: 3.7, ad: 0 },
  { hs: '9404290000', desc_cn: '其他材料床垫', desc_en: 'Other mattresses', duty: 3.7, ad: 0 },
  { hs: '9404300000', desc_cn: '睡袋', desc_en: 'Sleeping bags', duty: 12, ad: 0 },
  { hs: '9404900000', desc_cn: '其他床上用品', desc_en: 'Other bedding', duty: 3.7, ad: 0 },
  { hs: '9405100000', desc_cn: '枝形吊灯', desc_en: 'Chandeliers', duty: 3.7, ad: 0 },
  { hs: '9405200000', desc_cn: '电气台灯床头灯', desc_en: 'Electric table desk lamps', duty: 3.7, ad: 0 },
  { hs: '9405300000', desc_cn: '圣诞灯串', desc_en: 'Lighting strings', duty: 3.7, ad: 0 },
  { hs: '9405400000', desc_cn: '其他电气灯具', desc_en: 'Other electric lamps', duty: 3.7, ad: 0 },
  { hs: '9405420000', desc_cn: 'LED灯具', desc_en: 'LED lamps', duty: 3.7, ad: 0 },
  { hs: '9405500000', desc_cn: '非电气灯具', desc_en: 'Non-electrical lamps', duty: 3.7, ad: 0 },
  { hs: '9405600000', desc_cn: '发光标志', desc_en: 'Illuminated signs', duty: 3.7, ad: 0 },
  { hs: '9405910000', desc_cn: '玻璃制灯具零件', desc_en: 'Glass parts of lamps', duty: 3.7, ad: 0 },
  { hs: '9405920000', desc_cn: '塑料制灯具零件', desc_en: 'Plastic parts of lamps', duty: 3.7, ad: 0 },
  { hs: '9405990000', desc_cn: '其他灯具零件', desc_en: 'Other parts of lamps', duty: 3.7, ad: 0 },
  
  // ==================== 第95章：玩具游戏 ====================
  { hs: '9503001000', desc_cn: '三轮车滑板车踏板车', desc_en: 'Tricycles scooters pedal cars', duty: 4.7, ad: 0 },
  { hs: '9503002100', desc_cn: '人形玩偶', desc_en: 'Dolls representing human beings', duty: 4.7, ad: 0 },
  { hs: '9503002900', desc_cn: '其他玩偶', desc_en: 'Other dolls', duty: 4.7, ad: 0 },
  { hs: '9503003000', desc_cn: '电动火车铁路模型', desc_en: 'Electric trains model railways', duty: 4.7, ad: 0 },
  { hs: '9503004100', desc_cn: '缩小比例模型组件', desc_en: 'Reduced-size model assemblies', duty: 4.7, ad: 0 },
  { hs: '9503004900', desc_cn: '其他组装玩具', desc_en: 'Other construction toys', duty: 4.7, ad: 0 },
  { hs: '9503005500', desc_cn: '动物形玩具', desc_en: 'Toys representing animals', duty: 4.7, ad: 0 },
  { hs: '9503006100', desc_cn: '木制玩具', desc_en: 'Wooden toys', duty: 4.7, ad: 0 },
  { hs: '9503006900', desc_cn: '其他玩具', desc_en: 'Other toys', duty: 4.7, ad: 0 },
  { hs: '9503007000', desc_cn: '成套玩具', desc_en: 'Toys in sets', duty: 4.7, ad: 0 },
  { hs: '9503008000', desc_cn: '其他玩具及减缩模型', desc_en: 'Other toys and scale models', duty: 4.7, ad: 0 },
  { hs: '9503009000', desc_cn: '玩具零件', desc_en: 'Parts of toys', duty: 4.7, ad: 0 },
  { hs: '9504200000', desc_cn: '台球用品', desc_en: 'Billiards articles', duty: 0, ad: 0 },
  { hs: '9504300000', desc_cn: '投币游戏机', desc_en: 'Coin-operated games', duty: 0, ad: 0 },
  { hs: '9504400000', desc_cn: '扑克牌', desc_en: 'Playing cards', duty: 0, ad: 0 },
  { hs: '9504500000', desc_cn: '视频游戏机', desc_en: 'Video game consoles', duty: 0, ad: 0 },
  { hs: '9504900000', desc_cn: '其他游戏用品', desc_en: 'Other games articles', duty: 0, ad: 0 },
  { hs: '9506110000', desc_cn: '滑雪板', desc_en: 'Skis', duty: 2.7, ad: 0 },
  { hs: '9506120000', desc_cn: '滑雪板固定器', desc_en: 'Ski-fastenings', duty: 2.7, ad: 0 },
  { hs: '9506190000', desc_cn: '其他滑雪用具', desc_en: 'Other snow-ski equipment', duty: 2.7, ad: 0 },
  { hs: '9506210000', desc_cn: '帆板', desc_en: 'Sailboards', duty: 2.7, ad: 0 },
  { hs: '9506290000', desc_cn: '其他水上运动用具', desc_en: 'Other water-sport equipment', duty: 2.7, ad: 0 },
  { hs: '9506310000', desc_cn: '高尔夫球杆整套', desc_en: 'Golf clubs complete', duty: 2.7, ad: 0 },
  { hs: '9506320000', desc_cn: '高尔夫球', desc_en: 'Golf balls', duty: 2.7, ad: 0 },
  { hs: '9506390000', desc_cn: '其他高尔夫用具', desc_en: 'Other golf equipment', duty: 2.7, ad: 0 },
  { hs: '9506400000', desc_cn: '乒乓球用品', desc_en: 'Table-tennis equipment', duty: 2.7, ad: 0 },
  { hs: '9506510000', desc_cn: '网球拍', desc_en: 'Lawn-tennis rackets', duty: 2.7, ad: 0 },
  { hs: '9506590000', desc_cn: '其他球拍', desc_en: 'Other rackets', duty: 2.7, ad: 0 },
  { hs: '9506610000', desc_cn: '网球', desc_en: 'Lawn-tennis balls', duty: 2.7, ad: 0 },
  { hs: '9506620000', desc_cn: '充气球', desc_en: 'Inflatable balls', duty: 2.7, ad: 0 },
  { hs: '9506690000', desc_cn: '其他球', desc_en: 'Other balls', duty: 2.7, ad: 0 },
  { hs: '9506700000', desc_cn: '冰鞋滑冰鞋', desc_en: 'Ice skates roller skates', duty: 2.7, ad: 0 },
  { hs: '9506910000', desc_cn: '健身器材', desc_en: 'Fitness equipment', duty: 2.7, ad: 0 },
  { hs: '9506990000', desc_cn: '其他体育用品', desc_en: 'Other sports equipment', duty: 2.7, ad: 0 },
  { hs: '9507100000', desc_cn: '钓鱼竿', desc_en: 'Fishing rods', duty: 2.7, ad: 0 },
  { hs: '9507200000', desc_cn: '鱼钩', desc_en: 'Fish-hooks', duty: 2.7, ad: 0 },
  { hs: '9507300000', desc_cn: '钓线轮', desc_en: 'Fishing reels', duty: 2.7, ad: 0 },
  { hs: '9507900000', desc_cn: '其他钓鱼用品', desc_en: 'Other fishing equipment', duty: 2.7, ad: 0 },
  
  // ==================== 第42章：皮革制品 ====================
  { hs: '4202110000', desc_cn: '皮革面衣箱', desc_en: 'Trunks with leather surface', duty: 3, ad: 0 },
  { hs: '4202120000', desc_cn: '塑料或纺织面衣箱', desc_en: 'Trunks with plastic or textile surface', duty: 3, ad: 0 },
  { hs: '4202190000', desc_cn: '其他衣箱', desc_en: 'Other trunks', duty: 3, ad: 0 },
  { hs: '4202210000', desc_cn: '皮革面手提包', desc_en: 'Handbags with leather surface', duty: 3, ad: 0 },
  { hs: '4202220000', desc_cn: '塑料或纺织面手提包', desc_en: 'Handbags with plastic or textile surface', duty: 3, ad: 0 },
  { hs: '4202290000', desc_cn: '其他手提包', desc_en: 'Other handbags', duty: 3, ad: 0 },
  { hs: '4202310000', desc_cn: '皮革面钱包', desc_en: 'Wallets with leather surface', duty: 3, ad: 0 },
  { hs: '4202320000', desc_cn: '塑料或纺织面钱包', desc_en: 'Wallets with plastic or textile surface', duty: 3, ad: 0 },
  { hs: '4202390000', desc_cn: '其他钱包', desc_en: 'Other wallets', duty: 3, ad: 0 },
  { hs: '4202910000', desc_cn: '皮革面其他容器', desc_en: 'Other containers with leather surface', duty: 3, ad: 0 },
  { hs: '4202920000', desc_cn: '塑料或纺织面其他容器', desc_en: 'Other containers with plastic or textile surface', duty: 3, ad: 0 },
  { hs: '4202990000', desc_cn: '其他容器', desc_en: 'Other containers', duty: 3, ad: 0 },
  
  // ==================== 第39章：塑料制品 ====================
  { hs: '3923100000', desc_cn: '塑料盒箱板条箱', desc_en: 'Plastic boxes cases crates', duty: 6.5, ad: 0 },
  { hs: '3923210000', desc_cn: '乙烯聚合物袋', desc_en: 'Sacks of ethylene polymers', duty: 6.5, ad: 0 },
  { hs: '3923290000', desc_cn: '其他塑料袋', desc_en: 'Other plastic sacks', duty: 6.5, ad: 0 },
  { hs: '3923300000', desc_cn: '塑料瓶罐', desc_en: 'Plastic carboys bottles', duty: 6.5, ad: 0 },
  { hs: '3923400000', desc_cn: '塑料线轴卷轴', desc_en: 'Plastic spools bobbins', duty: 6.5, ad: 0 },
  { hs: '3923500000', desc_cn: '塑料塞盖帽', desc_en: 'Plastic stoppers lids caps', duty: 6.5, ad: 0 },
  { hs: '3923900000', desc_cn: '其他塑料包装容器', desc_en: 'Other plastic packaging articles', duty: 6.5, ad: 0 },
  { hs: '3924100000', desc_cn: '塑料餐具厨房用具', desc_en: 'Plastic tableware kitchenware', duty: 6.5, ad: 0 },
  { hs: '3924900000', desc_cn: '其他塑料家用品', desc_en: 'Other plastic household articles', duty: 6.5, ad: 0 },
  { hs: '3925100000', desc_cn: '塑料储藏罐桶', desc_en: 'Plastic reservoirs tanks', duty: 6.5, ad: 0 },
  { hs: '3925200000', desc_cn: '塑料门窗框架', desc_en: 'Plastic doors windows frames', duty: 6.5, ad: 0 },
  { hs: '3925300000', desc_cn: '塑料百叶窗', desc_en: 'Plastic shutters blinds', duty: 6.5, ad: 0 },
  { hs: '3925900000', desc_cn: '其他塑料建筑用品', desc_en: 'Other plastic building articles', duty: 6.5, ad: 0 },
  { hs: '3926100000', desc_cn: '塑料办公学校用品', desc_en: 'Plastic office school supplies', duty: 6.5, ad: 0 },
  { hs: '3926200000', desc_cn: '塑料衣着用品', desc_en: 'Plastic articles of apparel', duty: 6.5, ad: 0 },
  { hs: '3926300000', desc_cn: '塑料家具配件', desc_en: 'Plastic furniture fittings', duty: 6.5, ad: 0 },
  { hs: '3926400000', desc_cn: '塑料小雕像装饰品', desc_en: 'Plastic statuettes ornaments', duty: 6.5, ad: 0 },
  { hs: '3926909000', desc_cn: '其他塑料制品', desc_en: 'Other plastic articles', duty: 6.5, ad: 0 }
]

// ==================== 主同步函数 ====================

async function syncChinaHsCodes() {
  console.log('=' .repeat(60))
  console.log('🔄 中国原产地 HS Code 完整同步')
  console.log('=' .repeat(60))
  console.log('')
  console.log('🔗 连接数据库...')
  
  const client = await pool.connect()
  
  try {
    // 统计现有数据
    const beforeStats = await client.query(`
      SELECT COUNT(*) as count FROM tariff_rates 
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND is_active = 1
    `)
    console.log(`📊 同步前中国原产地记录: ${beforeStats.rows[0].count} 条`)
    console.log(`📦 准备导入: ${CHINA_HS_CODES.length} 条新数据`)
    console.log('')
    
    await client.query('BEGIN')
    
    let inserted = 0
    let updated = 0
    let skipped = 0
    
    for (const item of CHINA_HS_CODES) {
      // 检查是否已存在
      const existing = await client.query(`
        SELECT id FROM tariff_rates 
        WHERE hs_code = $1 AND origin_country_code = 'CN' AND is_active = 1
      `, [item.hs])
      
      if (existing.rows.length > 0) {
        // 更新现有记录
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
        // 插入新记录
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
      
      // 进度显示
      const total = inserted + updated + skipped
      if (total % 100 === 0) {
        process.stdout.write(`\r  处理进度: ${total}/${CHINA_HS_CODES.length}`)
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
    console.log(`  跳过记录: ${skipped} 条`)
    
    // 统计同步后数据
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
    console.error('')
    console.error('❌ 同步失败，事务已回滚')
    console.error('错误信息:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行同步
syncChinaHsCodes()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })

