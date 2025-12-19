# 环境同步操作指南

## 📋 步骤 1: 获取数据库连接字符串

### 生产环境数据库

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 进入 **PostgreSQL** → **logistics-production-db** (生产数据库)
3. 点击 **Connections** 标签
4. 复制 **External Database URL**（外部数据库URL）
5. 格式示例：`postgresql://user:password@oregon-postgres.render.com/logistics_db?sslmode=require`

### 演示环境数据库

1. 在 Render Dashboard 中进入 **PostgreSQL** → **PostgreSQL** (演示数据库)
2. 点击 **Connections** 标签
3. 复制 **External Database URL**（外部数据库URL）
4. 格式示例：`postgresql://user:password@oregon-postgres.render.com/demo_db?sslmode=require`

---

## 📋 步骤 2: 设置环境变量

在终端中执行（替换为实际的连接字符串）：

```bash
# 开发环境（本地，已有）
export DATABASE_URL="postgresql://localhost:5432/sysafari_logistics"

# 生产环境（使用 External Database URL）
export PROD_DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# 演示环境（使用 External Database URL）
export DEMO_DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

**⚠️ 重要：**
- 必须使用 **External Database URL**，不是 Internal Database URL
- 连接字符串包含密码，不要提交到代码仓库
- 这些环境变量只在当前终端会话有效

---

## 📋 步骤 3: 运行同步脚本

```bash
cd /Users/fengzheng/sysafari-logistics
node server/scripts/sync-new-tables.js
```

脚本会自动：
- ✅ 从开发环境读取新表结构
- ✅ 同步到生产环境和演示环境
- ✅ 创建表、索引、外键约束
- ✅ 同步初始数据（如果目标表为空）
- ❌ **不会**更新任何订单相关表

---

## 📋 步骤 4: 验证同步结果

```bash
node server/scripts/check-env-differences.js
```

应该看到所有环境都有这4个新表：
- ✅ api_integrations
- ✅ api_usage_records
- ✅ api_recharge_records
- ✅ tracking_api_configs

---

## 🔒 安全提醒

1. **使用 External Database URL** - 脚本在本地运行，需要外部访问权限
2. **不要使用 Internal Database URL** - 只能在 Render 服务内部使用
3. **保护连接字符串** - 包含密码，不要分享或提交到代码仓库
4. **备份数据库** - 同步前建议备份（特别是生产环境）

---

## ❓ 常见问题

### Q: 为什么必须用 External Database URL？
A: 因为同步脚本在您的本地 Mac 上运行，需要通过公网访问 Render 的数据库。Internal Database URL 只能在 Render 服务内部使用。

### Q: 如何确认使用的是 External Database URL？
A: External Database URL 通常包含 `render.com` 域名和 `?sslmode=require` 参数。

### Q: 连接失败怎么办？
A: 
- 检查是否使用了 External Database URL
- 确认数据库服务正在运行（不是暂停状态）
- 检查网络连接
- 确认连接字符串格式正确
