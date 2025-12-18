-- 换单代理供应商测试数据
-- 用于在换单操作时选择代理商

-- 插入换单代理供应商
INSERT INTO suppliers (
  id, supplier_code, supplier_name, short_name, supplier_type,
  contact_person, contact_phone, contact_email,
  country, city, address,
  status, level, currency, remark,
  created_at, updated_at
) VALUES 
  -- 荷兰换单代理
  ('dsa001', 'DSA001', 'Rotterdam Port Services B.V.', 'Rotterdam PS', 'doc_swap_agent',
   'Jan van der Berg', '+31-10-123-4567', 'jan@rotterdam-ps.nl',
   '荷兰', 'Rotterdam', 'Europaweg 100, 3199 LD Rotterdam',
   'active', 'a', 'EUR', '鹿特丹港口换单代理，服务快速',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
   
  ('dsa002', 'DSA002', 'Amsterdam Shipping Agency', 'ASA', 'doc_swap_agent',
   'Peter de Vries', '+31-20-456-7890', 'peter@asa-agency.nl',
   '荷兰', 'Amsterdam', 'Havenstraat 50, 1019 BA Amsterdam',
   'active', 'b', 'EUR', '阿姆斯特丹港口换单代理',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
   
  -- 德国换单代理
  ('dsa003', 'DSA003', 'Hamburg Dokumenten Service GmbH', 'HDS', 'doc_swap_agent',
   'Hans Mueller', '+49-40-789-0123', 'hans@hds-hamburg.de',
   '德国', 'Hamburg', 'Hafenstraße 88, 20457 Hamburg',
   'active', 'a', 'EUR', '汉堡港口换单代理，德国最大换单服务商',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
   
  ('dsa004', 'DSA004', 'Bremen Shipping Docs', 'BSD', 'doc_swap_agent',
   'Klaus Schmidt', '+49-421-234-5678', 'klaus@bremen-docs.de',
   '德国', 'Bremen', 'Überseestraße 12, 28217 Bremen',
   'active', 'b', 'EUR', '不来梅港口换单代理',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
   
  -- 比利时换单代理
  ('dsa005', 'DSA005', 'Antwerp Document Exchange NV', 'ADE', 'doc_swap_agent',
   'Marc Janssen', '+32-3-456-7890', 'marc@ade-antwerp.be',
   '比利时', 'Antwerp', 'Noorderlaan 147, 2030 Antwerpen',
   'active', 'a', 'EUR', '安特卫普港口换单代理，欧洲主要换单点',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

ON CONFLICT (supplier_code) DO UPDATE SET
  supplier_name = EXCLUDED.supplier_name,
  short_name = EXCLUDED.short_name,
  supplier_type = EXCLUDED.supplier_type,
  contact_person = EXCLUDED.contact_person,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email,
  country = EXCLUDED.country,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  status = EXCLUDED.status,
  level = EXCLUDED.level,
  currency = EXCLUDED.currency,
  remark = EXCLUDED.remark,
  updated_at = CURRENT_TIMESTAMP;
