-- 共享税号使用统计表
-- 执行时间: 2026-01-16
-- 说明: 记录共享税号与提单的关联，用于按月统计使用次数
-- 空运按公斤统计，集装箱按柜数统计

-- ==================== 1. 创建共享税号使用记录表 ====================
CREATE TABLE IF NOT EXISTS shared_tax_usage (
    id SERIAL PRIMARY KEY,
    shared_tax_id INTEGER NOT NULL,               -- 关联的共享税号ID
    bill_id TEXT NOT NULL,                        -- 关联的提单ID
    bill_number TEXT,                             -- 提单号（冗余存储，便于查询）
    container_number TEXT,                        -- 集装箱号
    usage_month TEXT NOT NULL,                    -- 使用月份，格式：YYYY-MM
    transport_type TEXT NOT NULL DEFAULT 'sea',   -- 运输类型：sea/air/rail/truck
    quantity NUMERIC DEFAULT 1,                   -- 数量：空运为公斤，海运/铁路/卡航为柜数
    unit TEXT DEFAULT 'container',                -- 单位：container(柜)/kg(公斤)
    customer_id TEXT,                             -- 客户ID（冗余存储）
    customer_name TEXT,                           -- 客户名称（冗余存储）
    remark TEXT,                                  -- 备注
    created_by TEXT,                              -- 创建人
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shared_tax FOREIGN KEY (shared_tax_id) REFERENCES shared_tax_numbers(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shared_tax_usage_tax_id ON shared_tax_usage(shared_tax_id);
CREATE INDEX IF NOT EXISTS idx_shared_tax_usage_bill_id ON shared_tax_usage(bill_id);
CREATE INDEX IF NOT EXISTS idx_shared_tax_usage_month ON shared_tax_usage(usage_month);
CREATE INDEX IF NOT EXISTS idx_shared_tax_usage_transport ON shared_tax_usage(transport_type);
CREATE INDEX IF NOT EXISTS idx_shared_tax_usage_customer ON shared_tax_usage(customer_id);

-- 添加唯一约束：同一提单只能关联一个共享税号
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_tax_usage_unique ON shared_tax_usage(bill_id);

-- 添加注释
COMMENT ON TABLE shared_tax_usage IS '共享税号使用记录表';
COMMENT ON COLUMN shared_tax_usage.shared_tax_id IS '关联的共享税号ID';
COMMENT ON COLUMN shared_tax_usage.bill_id IS '关联的提单ID';
COMMENT ON COLUMN shared_tax_usage.usage_month IS '使用月份，格式YYYY-MM';
COMMENT ON COLUMN shared_tax_usage.transport_type IS '运输类型：sea-海运, air-空运, rail-铁路, truck-卡航';
COMMENT ON COLUMN shared_tax_usage.quantity IS '数量：空运为公斤数，其他为柜数';
COMMENT ON COLUMN shared_tax_usage.unit IS '单位：container-柜, kg-公斤';

-- ==================== 2. 为提单表添加共享税号关联字段 ====================
DO $$
BEGIN
    -- shared_tax_id 共享税号ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'shared_tax_id') THEN
        ALTER TABLE bills_of_lading ADD COLUMN shared_tax_id INTEGER;
        RAISE NOTICE '已添加字段: shared_tax_id (共享税号ID)';
    END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN bills_of_lading.shared_tax_id IS '关联的共享税号ID';

-- ==================== 3. 创建月度统计视图 ====================
CREATE OR REPLACE VIEW v_shared_tax_monthly_stats AS
SELECT 
    stn.id AS shared_tax_id,
    stn.company_name,
    stn.company_short_name,
    stn.tax_number,
    stn.tax_type,
    stu.usage_month,
    stu.transport_type,
    COUNT(*) AS usage_count,
    SUM(CASE WHEN stu.transport_type = 'air' THEN stu.quantity ELSE 0 END) AS air_kg,
    SUM(CASE WHEN stu.transport_type != 'air' THEN stu.quantity ELSE 0 END) AS container_count
FROM shared_tax_numbers stn
LEFT JOIN shared_tax_usage stu ON stn.id = stu.shared_tax_id
GROUP BY stn.id, stn.company_name, stn.company_short_name, stn.tax_number, stn.tax_type, stu.usage_month, stu.transport_type;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 共享税号使用统计表创建完成！';
END $$;
