-- 测试数据：税率表记录
-- 用于单证管理模块的HS匹配功能测试

-- 先检查是否有tariff_rates表
-- INSERT OR REPLACE 语法适用于 PostgreSQL 使用 ON CONFLICT

-- 纺织服装类
INSERT INTO tariff_rates (hs_code, product_name, product_name_en, material_cn, duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, unit_code, unit_name, created_at, updated_at)
VALUES 
('61091000', '棉制针织或钩编男式T恤衫', 'Cotton knitted T-shirts for men', '100%棉', 12.0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('62044300', '合成纤维制女式连衣裙', 'Synthetic fiber dresses for women', '合成纤维/丝绸', 12.0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('64041900', '其他塑料或橡胶外底运动鞋', 'Sports footwear with plastic/rubber outer soles', '合成革+橡胶', 8.0, 19.0, 0, 0, 'PR', '双', NOW(), NOW()),
('63026000', '棉制盥洗及厨房用棉质毛巾', 'Cotton terry towels for toilet or kitchen', '100%棉', 8.0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW())
ON CONFLICT (hs_code) DO UPDATE SET 
  product_name = EXCLUDED.product_name,
  product_name_en = EXCLUDED.product_name_en,
  material_cn = EXCLUDED.material_cn,
  duty_rate = EXCLUDED.duty_rate,
  vat_rate = EXCLUDED.vat_rate,
  updated_at = NOW();

-- 厨具餐具类
INSERT INTO tariff_rates (hs_code, product_name, product_name_en, material_cn, duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, unit_code, unit_name, created_at, updated_at)
VALUES 
('73239300', '不锈钢制餐桌厨房等家用器具', 'Stainless steel household kitchen articles', '不锈钢', 6.5, 19.0, 0, 0, 'SET', '套', NOW(), NOW()),
('69111000', '瓷制餐桌及厨房用器具', 'Porcelain or china tableware and kitchenware', '陶瓷', 12.0, 19.0, 0, 0, 'SET', '套', NOW(), NOW()),
('70139900', '其他玻璃器皿', 'Other glassware', '玻璃', 5.0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW())
ON CONFLICT (hs_code) DO UPDATE SET 
  product_name = EXCLUDED.product_name,
  product_name_en = EXCLUDED.product_name_en,
  material_cn = EXCLUDED.material_cn,
  duty_rate = EXCLUDED.duty_rate,
  vat_rate = EXCLUDED.vat_rate,
  updated_at = NOW();

-- 电子产品类
INSERT INTO tariff_rates (hs_code, product_name, product_name_en, material_cn, duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, unit_code, unit_name, created_at, updated_at)
VALUES 
('94052100', 'LED照明灯具', 'LED lamps and lighting fittings', '塑料+金属', 4.7, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('85183000', '耳机及头戴式受话器', 'Headphones and earphones', '塑料+电子元件', 0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('91021200', '其他电子显示手表', 'Other wrist-watches with digital display', '金属+塑料', 4.5, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('85444290', '其他电导体', 'Other electric conductors', '铜+PVC', 3.3, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('85076000', '锂离子蓄电池', 'Lithium-ion accumulators', '锂电池', 2.7, 19.0, 0, 0, 'PCS', '件', NOW(), NOW())
ON CONFLICT (hs_code) DO UPDATE SET 
  product_name = EXCLUDED.product_name,
  product_name_en = EXCLUDED.product_name_en,
  material_cn = EXCLUDED.material_cn,
  duty_rate = EXCLUDED.duty_rate,
  vat_rate = EXCLUDED.vat_rate,
  updated_at = NOW();

-- 塑料及木制品类
INSERT INTO tariff_rates (hs_code, product_name, product_name_en, material_cn, duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, unit_code, unit_name, created_at, updated_at)
VALUES 
('39269099', '其他塑料制品', 'Other articles of plastics', '塑料/硅胶', 6.5, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('39241000', '塑料制餐具及厨房用具', 'Plastic tableware and kitchenware', 'PP塑料', 6.5, 19.0, 0, 0, 'PCS', '件', NOW(), NOW()),
('44140090', '其他木框架', 'Other wooden frames', '木材', 3.0, 19.0, 0, 0, 'PCS', '件', NOW(), NOW())
ON CONFLICT (hs_code) DO UPDATE SET 
  product_name = EXCLUDED.product_name,
  product_name_en = EXCLUDED.product_name_en,
  material_cn = EXCLUDED.material_cn,
  duty_rate = EXCLUDED.duty_rate,
  vat_rate = EXCLUDED.vat_rate,
  updated_at = NOW();

-- 添加一些反倾销税的测试数据
INSERT INTO tariff_rates (hs_code, product_name, product_name_en, material_cn, duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, unit_code, unit_name, created_at, updated_at)
VALUES 
('69120090', '其他陶制餐具', 'Other ceramic tableware', '陶瓷', 12.0, 19.0, 17.6, 0, 'PCS', '件', NOW(), NOW()),
('85011000', '玩具用电动机', 'Electric motors for toys', '电子元件', 2.7, 19.0, 30.0, 0, 'PCS', '件', NOW(), NOW())
ON CONFLICT (hs_code) DO UPDATE SET 
  product_name = EXCLUDED.product_name,
  product_name_en = EXCLUDED.product_name_en,
  material_cn = EXCLUDED.material_cn,
  duty_rate = EXCLUDED.duty_rate,
  vat_rate = EXCLUDED.vat_rate,
  anti_dumping_rate = EXCLUDED.anti_dumping_rate,
  updated_at = NOW();

SELECT '测试税率数据插入完成' as message;
