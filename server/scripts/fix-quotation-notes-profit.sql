-- 修复报价单 notes 字段中的利润信息泄露问题
-- 日期: 2026-01-12
-- 问题: notes 字段中包含了"利润设置"信息，这是内部信息，不应该显示在给客户的报价单上

-- 先查看有哪些报价单包含利润信息
SELECT id, quote_number, notes 
FROM quotations 
WHERE notes LIKE '%利润设置%' OR notes LIKE '%利润率%';

-- 更新 notes 字段，移除利润设置信息
-- 使用 PostgreSQL 的正则替换功能
UPDATE quotations 
SET notes = regexp_replace(notes, '\s*\|\s*利润设置[：:][^\\n]*', '', 'g'),
    updated_at = CURRENT_TIMESTAMP
WHERE notes LIKE '%利润设置%';

-- 同时处理"利润率"的情况
UPDATE quotations 
SET notes = regexp_replace(notes, '\s*\|\s*利润率[：:][^\\n]*', '', 'g'),
    updated_at = CURRENT_TIMESTAMP
WHERE notes LIKE '%利润率%';

-- 验证修复结果
SELECT id, quote_number, notes 
FROM quotations 
WHERE notes LIKE '%利润%';
