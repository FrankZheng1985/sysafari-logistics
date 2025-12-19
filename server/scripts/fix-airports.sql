-- 修复机场数据的transport_type
-- 将所有名称包含"机场"或port_code以"-A"结尾的数据的transport_type改为'air'

UPDATE ports_of_loading
SET transport_type = 'air',
    updated_at = NOW()
WHERE transport_type != 'air'
  AND (
    port_name_cn LIKE '%机场%' 
    OR port_name_en LIKE '%Airport%'
    OR port_name_en LIKE '%Air%'
    OR port_code LIKE '%-A'
    OR port_code LIKE '%-A-%'
  );
