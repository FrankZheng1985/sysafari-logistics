-- 为 bills_of_lading 表添加订单导入所需的新字段
-- 执行时间: 2025-12-24
-- 说明: 添加服务产品、货柜金额、资料发送日期、CMR发送日期字段
-- 使用 IF NOT EXISTS 确保安全，不会重复添加

DO $$
BEGIN
    -- service_type 服务/销售产品
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'service_type') THEN
        ALTER TABLE bills_of_lading ADD COLUMN service_type TEXT;
        RAISE NOTICE '已添加字段: service_type (服务产品)';
    END IF;
    
    -- cargo_value 货柜金额
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'cargo_value') THEN
        ALTER TABLE bills_of_lading ADD COLUMN cargo_value NUMERIC;
        RAISE NOTICE '已添加字段: cargo_value (货柜金额)';
    END IF;
    
    -- documents_sent_date 资料发送日期
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'documents_sent_date') THEN
        ALTER TABLE bills_of_lading ADD COLUMN documents_sent_date TEXT;
        RAISE NOTICE '已添加字段: documents_sent_date (资料发送日期)';
    END IF;
    
    -- cmr_sent_date CMR发送日期
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'cmr_sent_date') THEN
        ALTER TABLE bills_of_lading ADD COLUMN cmr_sent_date TEXT;
        RAISE NOTICE '已添加字段: cmr_sent_date (CMR发送日期)';
    END IF;
END $$;

-- 验证字段是否添加成功
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bills_of_lading' 
AND column_name IN ('service_type', 'cargo_value', 'documents_sent_date', 'cmr_sent_date')
ORDER BY column_name;

-- 添加字段注释
COMMENT ON COLUMN bills_of_lading.service_type IS '服务/销售产品';
COMMENT ON COLUMN bills_of_lading.cargo_value IS '货柜金额';
COMMENT ON COLUMN bills_of_lading.documents_sent_date IS '资料发送日期';
COMMENT ON COLUMN bills_of_lading.cmr_sent_date IS 'CMR发送日期';

