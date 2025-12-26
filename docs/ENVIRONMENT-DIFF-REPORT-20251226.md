# 🔍 生产环境与开发环境详细差异报告

> 检查时间：2025-12-26 23:15
> 检查人：系统自动生成

---

## 📋 一、代码库差异

### 1.1 Git 状态

```
当前分支: main
本地比远程领先: 1 commit (未推送)
未提交的更改: 2 个文件
```

### 1.2 未推送的提交

| Commit | 说明 |
|--------|------|
| `fb21d8e` | docs: 添加生产环境与开发环境对比报告 |

### 1.3 未提交的代码更改

#### 文件 1: `server/modules/supplier/model.js`

| 更改位置 | 更改内容 | 影响 |
|----------|----------|------|
| 第 170 行 | 排序方式从 `created_at DESC` 改为 `supplier_code ASC` | 供应商列表按编码升序排列 |
| 第 508 行 | 新增 `feeCategory: row.fee_category` 字段映射 | 前端 FeeModal 兼容性 |

**建议**：⚠️ 需要提交并部署到生产环境

#### 文件 2: `server/scripts/auto-migrate.js`

| 更改内容 | 影响 |
|----------|------|
| 新增 `supplier_price_items` 表 6 个字段的迁移 | 供应商报价项功能增强 |

**新增字段**:
- `country` - 国家
- `city` - 城市
- `return_point` - 还柜点
- `transport_mode` - 运输方式
- `billing_type` - 计费方式 (默认 'fixed')
- `status` - 状态 (默认 'active')

**建议**：⚠️ 需要提交并部署到生产环境

---

## 🗄️ 二、数据库差异

### 2.1 表结构差异

#### 生产环境 `supplier_price_items` 表 (17 字段)

```
id, supplier_id, supplier_name, fee_name, fee_name_en, fee_category, 
unit, price, currency, effective_date, expiry_date, route_from, 
route_to, remark, import_batch_id, created_at, updated_at
```

#### 本地开发应有的字段 (23 字段)

```
... 上述 17 个字段 ...
+ country          ❌ 生产缺失
+ city             ❌ 生产缺失
+ return_point     ❌ 生产缺失
+ transport_mode   ❌ 生产缺失
+ billing_type     ❌ 生产缺失
+ status           ❌ 生产缺失
```

### 2.2 核心表字段数对比

| 表名 | 生产环境 | 说明 |
|------|----------|------|
| bills_of_lading | 99 | ✅ 一致 |
| customers | 40 | ✅ 一致 |
| fees | 33 | ✅ 一致 |
| invoices | 31 | ✅ 一致 |
| product_fee_items | 22 | ✅ 一致 |
| products | 11 | ✅ 一致 |
| **supplier_price_items** | **17** | ⚠️ **缺少 6 个字段** |
| suppliers | 33 | ✅ 一致 |
| users | 19 | ✅ 一致 |

### 2.3 数据量差异

| 表名 | 本地开发 | 生产环境 | 差异 | 说明 |
|------|----------|----------|------|------|
| bills_of_lading | 540 | 544 | +4 | 生产有更多数据 |
| fees | 492 | 492 | 0 | ✅ 一致 |
| customers | 9 | 9 | 0 | ✅ 一致 |
| users | 5 | 5 | 0 | ✅ 一致 |
| suppliers | 5 | 9 | +4 | 生产有更多数据 |
| products | 4 | 7 | +3 | 生产有更多产品 |
| product_fee_items | ~60 | 88 | +28 | 生产有更多费用项 |
| tariff_rates | - | 93,215 | - | 大量税率数据 |
| shipping_companies | 137 | 137 | 0 | ✅ 一致 |

---

## 🔌 三、API 接口差异

### 3.1 接口可用性对比

| API 路径 | 本地 | 生产 | 状态 |
|----------|------|------|------|
| /api/health | 200 | 200 | ✅ |
| /api/countries | 200 | 200 | ✅ |
| /api/shipping-companies | 200 | 200 | ✅ |
| /api/vat-rates | 200 | 200 | ✅ |
| /api/service-fee-categories | 200 | 200 | ✅ |
| /api/transport-methods | 200 | 200 | ✅ |
| /api/air-ports/countries | 200 | 200 | ✅ 今日修复 |

### 3.2 API 版本信息

| 环境 | 版本 | 架构 |
|------|------|------|
| 本地开发 | 2.0.0 | modular-esm |
| 生产环境 | 2.0.0 | modular-esm |

✅ **API 版本一致**

### 3.3 API 基础地址配置

| 域名 | API 地址 |
|------|----------|
| localhost:5173 | http://localhost:3001 (Vite 代理) |
| erp.xianfeng-eu.com | https://sysafari-logistics-api-sg.onrender.com |
| demo.xianfeng-eu.com | https://sysafari-logistics-demo-api.onrender.com |

---

## 📊 四、产品数据差异

### 4.1 产品对比

| 产品代码 | 产品名称 | 本地 | 生产 | 费用项数量(本地/生产) |
|----------|----------|------|------|----------------------|
| PRD0004 | 欧洲自税清关服务 | ✅ | ✅ | 5 / 5 |
| PRD0003 | 欧洲运输 | ✅ | ✅ | 54 / 56 ⚠️ |
| PRD0001 | 清提派-超大件-一口价 | ✅ | ✅ | 1 / 5 ⚠️ |
| CUSTOMS | 清关服务 | ✅ | ✅ | 7 / 7 |
| TRUCKING | 陆运配送服务 | ✅ | ✅ | 6 / 6 |
| AIR-FREIGHT | 空运服务 | ✅ | ✅ | - |
| 其他产品 | - | ❌ | ✅ | 生产多 3 个产品 |

### 4.2 产品分类差异

| 产品 | 本地分类 | 生产分类 | 说明 |
|------|----------|----------|------|
| CUSTOMS (清关服务) | 清关服务 | customs | ⚠️ 分类名称不一致 |
| TRUCKING (陆运配送) | 运输服务 | trucking | ⚠️ 分类名称不一致 |

---

## ⚙️ 五、配置差异

### 5.1 数据库连接池配置

| 配置项 | 生产环境 | 说明 |
|--------|----------|------|
| max | 20 | 最大连接数 |
| min | 2 | ✅ 今日新增 |
| idleTimeoutMillis | 60000 | ✅ 今日优化 (从30s) |
| connectionTimeoutMillis | 10000 | ✅ 今日优化 (从5s) |
| allowExitOnIdle | false | ✅ 今日新增 |
| 心跳检查 | 5分钟 | ✅ 今日新增 |

### 5.2 环境变量差异

| 变量 | 本地 | 生产 |
|------|------|------|
| NODE_ENV | development | production |
| DATABASE_URL | localhost | Render 内部 |
| SSL | false | true |

---

## 🚨 六、需要同步的项目

### 6.1 代码同步 (本地 → 生产)

| 优先级 | 文件 | 说明 |
|--------|------|------|
| 🔴 高 | server/modules/supplier/model.js | 供应商排序和字段映射 |
| 🔴 高 | server/scripts/auto-migrate.js | 新增表字段迁移 |
| 🟡 中 | docs/ENVIRONMENT-COMPARISON-REPORT.md | 文档 (已提交未推送) |

### 6.2 数据库迁移 (需要执行)

```sql
-- 生产环境需要执行的迁移 SQL
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS return_point TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS transport_mode TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'fixed';
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
```

### 6.3 数据同步 (不需要)

业务数据差异是正常的（生产环境有实际业务数据），不需要同步。

---

## ✅ 七、总结

### 一致性状态

| 项目 | 状态 | 说明 |
|------|------|------|
| API 接口 | ✅ 一致 | 所有接口正常可用 |
| API 版本 | ✅ 一致 | 均为 2.0.0 |
| 核心表结构 | ⚠️ 基本一致 | supplier_price_items 缺 6 字段 |
| 业务数据 | ✅ 正常差异 | 生产数据更多是正常的 |
| 代码库 | ⚠️ 有差异 | 2 个文件未提交 |

### 建议操作

1. **立即执行**：
   ```bash
   # 提交未提交的更改
   cd /Users/fengzheng/sysafari-logistics
   git add server/modules/supplier/model.js server/scripts/auto-migrate.js
   git commit -m "fix: 供应商排序优化及字段映射兼容性"
   
   # 推送到 GitHub (触发自动部署)
   git push origin main
   ```

2. **验证部署**：
   - 等待 Render 自动部署完成 (~2分钟)
   - 检查 supplier_price_items 表字段是否自动添加

3. **无需操作**：
   - 业务数据差异是正常的
   - 产品分类名称差异暂不影响功能

---

## 📎 附录

### A. 检查命令参考

```bash
# 检查生产数据库表结构
PGPASSWORD=xxx psql -h host -U user -d db -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'xxx';"

# 检查 API 健康状态
curl -s "https://sysafari-logistics-api-sg.onrender.com/api/health"

# 检查 Git 状态
git status && git log --oneline -5
```

### B. 相关文档

- [环境对比报告](./ENVIRONMENT-COMPARISON-REPORT.md)
- [数据库迁移脚本](../server/scripts/auto-migrate.js)

