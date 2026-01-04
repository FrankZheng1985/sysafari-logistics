-- ==================== 添加企查查工商信息API ====================
-- 日期：2026-01-03
-- 说明：向api_integrations表添加企查查工商信息API配置
-- 注意：使用 ON CONFLICT 确保不会重复插入

-- 添加企查查工商信息API
INSERT INTO api_integrations (
    api_code, 
    api_name, 
    provider, 
    category, 
    api_url, 
    health_check_url, 
    pricing_model, 
    recharge_url, 
    description, 
    icon, 
    sort_order,
    status,
    health_status
)
VALUES (
    'qichacha', 
    '企查查工商信息', 
    '企查查', 
    'business_info', 
    'https://api.qichacha.com', 
    'https://api.qichacha.com', 
    'per_call', 
    'https://openapi.qichacha.com', 
    '企业工商信息查询服务，支持企业名称搜索和详情查询', 
    'Building2', 
    9,
    'active',
    'unknown'
)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    category = EXCLUDED.category,
    api_url = EXCLUDED.api_url,
    health_check_url = EXCLUDED.health_check_url,
    pricing_model = EXCLUDED.pricing_model,
    recharge_url = EXCLUDED.recharge_url,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

-- 更新其他API的排序顺序（企查查排在验证服务之后，基础设施之前）
UPDATE api_integrations SET sort_order = 10 WHERE api_code = 'aliyun_ecs';
UPDATE api_integrations SET sort_order = 11 WHERE api_code = 'aliyun_oss';
UPDATE api_integrations SET sort_order = 12 WHERE api_code = 'aliyun_rds';

-- ==================== 完成 ====================
DO $$
BEGIN
    RAISE NOTICE '✅ 企查查工商信息API配置添加完成！';
END $$;

