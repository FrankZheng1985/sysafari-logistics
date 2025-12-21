# 基础数据同步到生产环境操作指南

## 概述

本指南帮助您将本地开发环境的基础数据同步到 Render 生产环境的 PostgreSQL 数据库。

**导出文件位置**: `server/exports/`

**总数据量**: 124,338 条记录

---

## 方法一：通过 Render PSQL Shell（推荐小量数据）

### 步骤 1: 登录 Render Dashboard

1. 打开 https://dashboard.render.com/
2. 进入您的 PostgreSQL 数据库服务
3. 点击 "Shell" 或 "Connect" 标签

### 步骤 2: 获取连接信息

在 Render Dashboard 的 PostgreSQL 页面，找到：
- **Internal Database URL**: 用于同一 Render 服务内部连接
- **External Database URL**: 用于外部连接（格式如下）

```
postgresql://user:password@host:port/database
```

### 步骤 3: 执行基础数据 SQL

**建议执行顺序**（按依赖关系）：

```bash
# 1. 国家数据
psql $DATABASE_URL -f countries_data.sql

# 2. 城市数据
psql $DATABASE_URL -f cities_data.sql

# 3. 港口数据
psql $DATABASE_URL -f ports_of_loading_data.sql
psql $DATABASE_URL -f destination_ports_data.sql
psql $DATABASE_URL -f air_ports_data.sql

# 4. 船公司数据
psql $DATABASE_URL -f shipping_companies_data.sql

# 5. VAT税率
psql $DATABASE_URL -f vat_rates_data.sql

# 6. 产品数据
psql $DATABASE_URL -f products_data.sql
psql $DATABASE_URL -f product_fee_items_data.sql
```

---

## 方法二：使用本地 psql 连接（推荐大量数据）

### 步骤 1: 获取 Render External URL

在 Render Dashboard 中复制 External Database URL。

### 步骤 2: 从本地执行

在本地终端进入导出目录：

```bash
cd /path/to/sysafari-logistics/server/exports

# 设置连接URL（替换为您的实际URL）
export PROD_DB="postgresql://user:password@host:port/database"

# 执行基础数据（约 1,000 条，几秒钟完成）
psql $PROD_DB -f countries_data.sql
psql $PROD_DB -f cities_data.sql
psql $PROD_DB -f ports_of_loading_data.sql
psql $PROD_DB -f destination_ports_data.sql
psql $PROD_DB -f air_ports_data.sql
psql $PROD_DB -f shipping_companies_data.sql
psql $PROD_DB -f vat_rates_data.sql
psql $PROD_DB -f products_data.sql
psql $PROD_DB -f product_fee_items_data.sql

# 执行HS税率数据（123,312 条，需要几分钟）
for i in {1..25}; do
  echo "导入 tariff_rates_data_$i.sql ..."
  psql $PROD_DB -f tariff_rates_data_$i.sql
done
```

---

## 方法三：通过 Node.js 脚本（自动化）

使用提供的同步脚本：

```bash
cd /path/to/sysafari-logistics/server

# 设置生产数据库URL
export PRODUCTION_DATABASE_URL="postgresql://user:password@host:port/database"

# 执行同步
node scripts/sync-to-production.js
```

---

## HS税率数据注意事项

由于 HS 税率数据量大（123,312 条），分成了 25 个文件：

| 文件 | 记录数 |
|------|--------|
| tariff_rates_data_1.sql | 5,000 |
| tariff_rates_data_2.sql | 5,000 |
| ... | ... |
| tariff_rates_data_25.sql | 3,312 |

**预计时间**:
- 基础数据：1-2 分钟
- HS 税率数据：5-10 分钟（取决于网络）

---

## 验证同步结果

同步完成后，在 Render PSQL Shell 中执行：

```sql
-- 检查各表数据量
SELECT 'countries' as table_name, COUNT(*) as count FROM countries
UNION ALL SELECT 'cities', COUNT(*) FROM cities
UNION ALL SELECT 'ports_of_loading', COUNT(*) FROM ports_of_loading
UNION ALL SELECT 'destination_ports', COUNT(*) FROM destination_ports
UNION ALL SELECT 'shipping_companies', COUNT(*) FROM shipping_companies
UNION ALL SELECT 'vat_rates', COUNT(*) FROM vat_rates
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'tariff_rates', COUNT(*) FROM tariff_rates;
```

预期结果：
```
     table_name     | count
--------------------+--------
 countries          |     66
 cities             |    124
 ports_of_loading   |    276
 destination_ports  |    252
 shipping_companies |    137
 vat_rates          |     46
 products           |      5
 tariff_rates       | 123312
```

---

## 常见问题

### Q: 执行时出现 "duplicate key" 错误？
A: SQL 文件使用了 `ON CONFLICT DO UPDATE`，会自动更新已存在的记录，不会报错。

### Q: 连接超时？
A: 确保：
1. Render 数据库的 External Access 已开启
2. 您的 IP 未被防火墙阻止
3. 使用正确的 External URL

### Q: 数据量太大导入失败？
A: 使用分批文件，一个一个执行 tariff_rates_data_*.sql

---

## 安全提醒

- **不要**在代码中硬编码生产数据库密码
- **不要**将包含密码的 URL 提交到 Git
- 执行前建议先在 Render 控制台备份数据库
