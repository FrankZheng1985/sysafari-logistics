-- 添加API密钥字段到api_integrations表
-- 执行时间: 2026-01-09
-- 功能: 允许在界面中管理API密钥

-- 添加 api_key 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_integrations' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE api_integrations ADD COLUMN api_key TEXT;
    COMMENT ON COLUMN api_integrations.api_key IS 'API密钥（敏感信息）';
  END IF;
END $$;

-- 添加 api_secret 字段（某些API需要两个密钥）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_integrations' AND column_name = 'api_secret'
  ) THEN
    ALTER TABLE api_integrations ADD COLUMN api_secret TEXT;
    COMMENT ON COLUMN api_integrations.api_secret IS 'API密钥Secret（敏感信息）';
  END IF;
END $$;

-- 添加 env_key_name 字段（记录对应的环境变量名）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_integrations' AND column_name = 'env_key_name'
  ) THEN
    ALTER TABLE api_integrations ADD COLUMN env_key_name TEXT;
    COMMENT ON COLUMN api_integrations.env_key_name IS '对应的环境变量名称';
  END IF;
END $$;

-- 更新现有API的环境变量名称映射
UPDATE api_integrations SET env_key_name = 'TENCENT_SECRET_ID' WHERE api_code = 'tencent_ocr';
UPDATE api_integrations SET env_key_name = 'TENCENT_SECRET_ID' WHERE api_code = 'tencent_cos';
UPDATE api_integrations SET env_key_name = 'DASHSCOPE_API_KEY' WHERE api_code = 'aliyun_qwen_vl';
UPDATE api_integrations SET env_key_name = 'QICHACHA_KEY' WHERE api_code = 'qichacha';
UPDATE api_integrations SET env_key_name = 'HERE_API_KEY' WHERE api_code = 'here_geocoding';

SELECT '添加API密钥字段完成' as message;
