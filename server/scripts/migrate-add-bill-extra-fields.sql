-- 为 bills_of_lading 表添加附加属性字段
-- 执行时间: 2025-12-21
-- 说明: 添加订单导入所需的附加属性字段
-- 使用 IF NOT EXISTS 确保安全，不会重复添加

DO $$
BEGIN
    -- container_type 箱型
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'container_type') THEN
        ALTER TABLE bills_of_lading ADD COLUMN container_type TEXT;
        RAISE NOTICE '已添加字段: container_type';
    END IF;
    
    -- bill_type 提单类型
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'bill_type') THEN
        ALTER TABLE bills_of_lading ADD COLUMN bill_type TEXT;
        RAISE NOTICE '已添加字段: bill_type';
    END IF;
    
    -- transport_arrangement 运输安排
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'transport_arrangement') THEN
        ALTER TABLE bills_of_lading ADD COLUMN transport_arrangement TEXT;
        RAISE NOTICE '已添加字段: transport_arrangement';
    END IF;
    
    -- consignee_type 收货人类型
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'consignee_type') THEN
        ALTER TABLE bills_of_lading ADD COLUMN consignee_type TEXT;
        RAISE NOTICE '已添加字段: consignee_type';
    END IF;
    
    -- container_return 还柜
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'container_return') THEN
        ALTER TABLE bills_of_lading ADD COLUMN container_return TEXT;
        RAISE NOTICE '已添加字段: container_return';
    END IF;
    
    -- full_container_transport 整柜运输
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'full_container_transport') THEN
        ALTER TABLE bills_of_lading ADD COLUMN full_container_transport TEXT;
        RAISE NOTICE '已添加字段: full_container_transport';
    END IF;
    
    -- last_mile_transport 尾程运输
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'last_mile_transport') THEN
        ALTER TABLE bills_of_lading ADD COLUMN last_mile_transport TEXT;
        RAISE NOTICE '已添加字段: last_mile_transport';
    END IF;
    
    -- devanning 拆箱
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'devanning') THEN
        ALTER TABLE bills_of_lading ADD COLUMN devanning TEXT;
        RAISE NOTICE '已添加字段: devanning';
    END IF;
    
    -- t1_declaration T1申报
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 't1_declaration') THEN
        ALTER TABLE bills_of_lading ADD COLUMN t1_declaration TEXT;
        RAISE NOTICE '已添加字段: t1_declaration';
    END IF;
END $$;

-- 验证字段是否添加成功
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bills_of_lading' 
AND column_name IN ('container_type', 'bill_type', 'transport_arrangement', 'consignee_type', 'container_return', 'full_container_transport', 'last_mile_transport', 'devanning', 't1_declaration')
ORDER BY column_name;
