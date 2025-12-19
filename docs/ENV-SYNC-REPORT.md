# 环境同步检查报告

## 检查时间
2024-12-XX

## 📊 检查结果总结

### 1. 代码差异
✅ **代码已同步** - 所有环境的代码库保持一致

### 2. 数据库差异

#### 发现的新表（需要同步）
以下4个新表在**开发环境**中存在，但**生产环境**和**演示环境**中缺失：

| 表名 | 说明 | 开发环境 | 生产环境 | 演示环境 |
|------|------|---------|---------|---------|
| `api_integrations` | API对接管理表 | ✅ | ❌ | ❌ |
| `api_usage_records` | API用量记录表 | ✅ | ❌ | ❌ |
| `api_recharge_records` | API充值记录表 | ✅ | ❌ | ❌ |
| `tracking_api_configs` | 船公司跟踪API配置表 | ✅ | ❌ | ❌ |

#### 订单相关表（不更新）
以下订单相关表**不会**被同步，保持各环境独立：

- `bills_of_lading` (提单)
- `packages` (包裹)
- `declarations` (报关)
- `labels` (标签)
- `last_mile_orders` (最后一公里订单)
- `fees` (费用)
- `invoices` (发票)
- `payments` (付款)
- `clearance_documents` (清关单据)
- `clearance_document_items` (清关单据明细)
- `void_applications` (作废申请)
- `operation_logs` (操作日志)
- `bill_files` (提单文件)

---

## ✅ 已完成的操作

1. **更新主Schema文件**
   - ✅ 已将新表添加到 `server/scripts/pg-init-schema.sql`
   - ✅ 表数量从59个更新到63个

2. **创建检查工具**
   - ✅ `server/scripts/check-env-differences.js` - 环境差异检查工具

3. **创建同步工具**
   - ✅ `server/scripts/sync-new-tables.js` - 新表同步工具

---

## 📝 需要执行的同步操作

### 步骤 1: 配置环境变量

在本地终端设置数据库连接字符串：

```bash
# 开发环境（已有）
export DATABASE_URL="postgresql://localhost:5432/sysafari_logistics"

# 生产环境（需要从Render Dashboard获取）
export PROD_DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# 演示环境（需要从Render Dashboard获取）
export DEMO_DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
```

**获取连接字符串的方法：**
1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 进入对应的 PostgreSQL 数据库
3. 点击 **Connections** 标签
4. 复制 **External Database URL**

### 步骤 2: 检查差异（可选）

运行检查脚本查看详细差异：

```bash
cd /Users/fengzheng/sysafari-logistics
node server/scripts/check-env-differences.js
```

### 步骤 3: 执行同步

运行同步脚本将新表同步到各环境：

```bash
cd /Users/fengzheng/sysafari-logistics

# 设置环境变量后运行
node server/scripts/sync-new-tables.js
```

**同步脚本会：**
- ✅ 从开发环境读取新表结构
- ✅ 同步到生产环境和演示环境
- ✅ 创建表、索引、外键约束
- ✅ 同步 `api_integrations` 的初始数据（如果目标表为空）
- ❌ **不会**更新任何订单相关表

### 步骤 4: 验证同步结果

重新运行检查脚本验证：

```bash
node server/scripts/check-env-differences.js
```

应该看到所有环境都有这4个新表。

---

## 🔒 安全提醒

1. **数据库连接字符串**属于敏感信息，仅在本地环境变量中设置，**不要**提交到代码仓库
2. **生产环境操作**需要谨慎，建议先在演示环境测试
3. **订单数据**不会被同步，各环境的订单数据保持独立
4. 同步前建议**备份数据库**（特别是生产环境）

---

## 📋 同步后的验证清单

### 开发环境
- [x] 已有4个新表
- [x] 表结构正确
- [x] 初始数据已存在

### 生产环境
- [ ] 4个新表已创建
- [ ] 表结构正确
- [ ] `api_integrations` 有初始数据（10个API服务配置）

### 演示环境
- [ ] 4个新表已创建
- [ ] 表结构正确
- [ ] `api_integrations` 有初始数据（10个API服务配置）

---

## 🆘 故障排除

### 问题1: 连接失败
**错误**: `❌ 连接失败: ...`

**解决**:
- 检查环境变量是否正确设置
- 确认数据库服务正在运行
- 检查网络连接（云端数据库需要外部访问权限）

### 问题2: 表已存在错误
**错误**: `relation "xxx" already exists`

**解决**:
- 这是正常的，脚本使用 `CREATE TABLE IF NOT EXISTS`
- 如果表结构不同，需要手动删除后重新创建

### 问题3: 外键约束错误
**错误**: `foreign key constraint fails`

**解决**:
- 确保依赖的表已存在
- 检查外键引用的表名和列名是否正确

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. 数据库连接字符串格式是否正确
2. 数据库用户是否有创建表的权限
3. 网络连接是否正常（云端数据库）

---

## 📚 相关文档

- [三环境架构配置指南](./THREE-ENV-SETUP.md)
- [数据库使用说明](../数据库使用说明.md)
- [API对接管理模块](../server/modules/system/apiIntegrations.js)
