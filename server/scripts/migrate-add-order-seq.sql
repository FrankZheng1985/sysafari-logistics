-- 迁移脚本：为历史订单补充 order_seq 序号
-- 执行时间：2025-12-21
-- 说明：历史数据没有 order_seq 字段值，导致订单号无法正确显示
-- 此脚本为历史数据按创建时间顺序分配序号

-- 步骤1：为历史数据补充 order_seq（按创建时间排序分配序号）
DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- 检查有多少记录需要更新
    SELECT COUNT(*) INTO affected_rows 
    FROM bills_of_lading 
    WHERE order_seq IS NULL OR order_seq = 0;
    
    RAISE NOTICE '需要更新的记录数: %', affected_rows;
    
    IF affected_rows > 0 THEN
        -- 为历史数据分配序号
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as seq
            FROM bills_of_lading
            WHERE order_seq IS NULL OR order_seq = 0
        )
        UPDATE bills_of_lading b
        SET order_seq = n.seq
        FROM numbered n
        WHERE b.id = n.id;
        
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        RAISE NOTICE '已更新 % 条记录的 order_seq', affected_rows;
    END IF;
END $$;

-- 步骤2：更新序列计数器到最大值
DO $$
DECLARE
    max_seq INTEGER;
    current_seq_value INTEGER;
BEGIN
    -- 获取当前最大序号
    SELECT COALESCE(MAX(order_seq), 0) INTO max_seq FROM bills_of_lading;
    
    -- 获取当前序列计数器值
    SELECT current_seq INTO current_seq_value 
    FROM order_sequences 
    WHERE business_type = 'BILL';
    
    RAISE NOTICE '当前最大 order_seq: %, 当前序列计数器: %', max_seq, current_seq_value;
    
    -- 如果需要，更新序列计数器
    IF max_seq > COALESCE(current_seq_value, 0) THEN
        UPDATE order_sequences 
        SET current_seq = max_seq, updated_at = NOW()
        WHERE business_type = 'BILL';
        
        RAISE NOTICE '序列计数器已更新为: %', max_seq;
    ELSE
        RAISE NOTICE '序列计数器无需更新';
    END IF;
END $$;

-- 步骤3：验证结果
SELECT 
    COUNT(*) as total_records,
    COUNT(order_seq) as records_with_seq,
    COUNT(*) FILTER (WHERE order_seq IS NULL OR order_seq = 0) as records_without_seq,
    MAX(order_seq) as max_order_seq
FROM bills_of_lading;

-- 显示序列计数器当前状态
SELECT * FROM order_sequences WHERE business_type = 'BILL';
