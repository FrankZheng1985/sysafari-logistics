# 🔍 生产环境与开发环境差异报告

> 检查时间：2025-12-28 08:30
> 状态：已检查

---

## 📋 一、代码一致性

### 1.1 Git 状态

| 项目 | 状态 |
|------|------|
| 本地分支 | main |
| 远程分支 | origin/main |
| 同步状态 | ✅ **完全一致** |
| 最新提交 | `435486e` - chore: 添加2025-12-28生产环境数据库同步脚本 |

**结论：本地代码与 GitHub 完全同步 ✅**

---

## 🗄️ 二、数据库结构差异

### 2.1 表数量

| 环境 | 表数量 |
|------|--------|
| 本地开发 | 125 |
| 生产环境 | 126 |

### 2.2 表结构字段差异

| 表名 | 本地 | 生产 | 差异 | 缺失字段 |
|------|------|------|------|----------|
| bills_of_lading | 99 | 97 | -2 | `cmr_status`, `cmr_updated_at` |
| product_fee_items | 26 | 22 | -4 | `route_from`, `route_to`, `postal_code`, `return_point` |
| auth0_pending_users | 10 | 9 | -1 | 需确认 |
| cities | 15 | 14 | -1 | 需确认 |
| customer_follow_ups | 16 | 19 | +3 | 生产多字段 |
| customers | 41 | 需确认 | - | - |
| tracking_api_configs | 16 | 13 | -3 | 需确认 |

### 2.3 ⚠️ 需要同步的字段

#### bills_of_lading 表缺失字段：
```sql
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_status TEXT DEFAULT 'pending';
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_updated_at TIMESTAMP;
```

#### product_fee_items 表缺失字段：
```sql
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_from TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_to TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS return_point TEXT;
```

---

## 📊 三、数据量差异

| 表名 | 本地 | 生产 | 差异 | 说明 |
|------|------|------|------|------|
| bills_of_lading | 540 | 544 | +4 | 生产有更多订单 ✅ |
| fees | 3675 | 3669 | -6 | 本地多6条费用 |
| customers | 9 | 9 | 0 | ✅ 一致 |
| users | 4 | 11 | +7 | 生产有更多用户 ✅ |
| suppliers | 10 | 9 | -1 | 本地多1个供应商 |
| products | 6 | 7 | +1 | 生产多1个产品 |
| **product_fee_items** | **150** | **112** | **-38** | ⚠️ 本地多38条 |
| supplier_price_items | 77 | 77 | 0 | ✅ 一致 |
| invoices | 5 | 5 | 0 | ✅ 一致 |
| **service_fee_categories** | **72** | **11** | **-61** | ⚠️ 本地多61条 |

---

## 🔧 四、需要同步的数据

### 4.1 service_fee_categories（服务费类别）

生产环境只有11条，本地有72条。需要同步缺失的61条类别数据。

**生产现有类别：**
1. 出口报关服务
2. 仓储服务
3. 运输服务
4. 其他服务
5. 清关服务
6. 文件费
7. 换单费
8. 港杂费
9. 税务费
10. 进口商代理费
11. 管理费

**本地新增类别（示例）：**
- 卡车等待费
- 卸货等待费
- 卡车卸货压夜费
- 清关卡车等待费
- 提单管理费
- 关税
- 增值税
- 税务代理费
- ... 等61条

### 4.2 product_fee_items（产品费用项）

本地150条，生产112条，差38条。需确认是否同步。

---

## ✅ 五、同步建议

### 优先级 1：数据库结构同步（已准备脚本）
- [ ] 同步 `bills_of_lading` 缺失的2个字段
- [ ] 同步 `product_fee_items` 缺失的4个字段

### 优先级 2：基础数据同步
- [ ] 同步 `service_fee_categories` 缺失的61条类别数据
- [ ] 确认是否同步 `product_fee_items` 的38条差异数据

### 优先级 3：确认差异
- [ ] 确认 `tracking_api_configs` 字段差异
- [ ] 确认 `customer_follow_ups` 字段差异（生产多3个字段）

---

## 📝 执行记录

| 时间 | 操作 | 状态 |
|------|------|------|
| 2025-12-28 08:24 | 同步数据库结构（supplier_price_items 等） | ✅ 完成 |
| 2025-12-28 08:30 | 生成差异报告 | ✅ 完成 |
| 待执行 | 同步缺失字段和数据 | ⏳ 待确认 |

