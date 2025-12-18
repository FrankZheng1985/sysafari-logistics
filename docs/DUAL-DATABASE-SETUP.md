# 双数据库架构配置指南

## 架构概览

```
生产环境 (erp.xianfeng-eu.com)
└── Render API → 新建 PostgreSQL (生产数据库)

本地开发 (localhost)
└── 本地后端 → 现有 PostgreSQL (测试数据库)
```

## 数据库信息

| 用途 | 数据库名称 | Render ID | 状态 |
|------|-----------|-----------|------|
| **生产** | logistics-production-db | dpg-d4vmk8pr0fns739omrrg-a | 已创建 |
| **测试** | PostgreSQL | dpg-d4t44e56ubrc73ectgq0-a | 已有 |

## 配置步骤

### 步骤 1: 获取数据库连接字符串

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 进入 **PostgreSQL** 数据库列表
3. 点击 **logistics-production-db** (新建)
4. 复制 **External Database URL**
5. 点击 **PostgreSQL** (现有/测试)
6. 复制 **External Database URL**

### 步骤 2: 运行初始化脚本

在终端执行：

```bash
cd /Users/fengzheng/sysafari-logistics

# 设置环境变量（替换为实际连接字符串）
export SOURCE_DATABASE_URL="现有测试数据库的 External URL"
export TARGET_DATABASE_URL="新生产数据库的 External URL"

# 运行初始化脚本
node server/scripts/init-production-db.js
```

脚本会自动：
- ✅ 创建所有数据库表
- ✅ 迁移基础数据（船公司、港口、国家等）
- ✅ 创建管理员账号 (admin / admin123)

### 步骤 3: 更新 Render API 环境变量

1. 打开 [Render Dashboard - API 服务](https://dashboard.render.com/web/srv-d4v9kg8gjchc73co09s0)
2. 点击 **Environment** 标签
3. 添加/更新以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `NODE_ENV` | `production` (已设置) |
| `DATABASE_URL_PROD` | 新生产数据库的 External URL |
| `DATABASE_URL_TEST` | 现有测试数据库的 External URL |

4. 保存后服务会自动重新部署

### 步骤 4: 更新本地开发配置

编辑 `server/.env` 文件，添加测试数据库连接：

```env
NODE_ENV=development
DATABASE_URL_TEST=现有测试数据库的 External URL
```

### 步骤 5: 验证配置

**生产环境验证：**
```bash
# 访问生产 API
curl https://sysafari-logistics-api.onrender.com/api/auth/me
```

**本地开发验证：**
```bash
cd /Users/fengzheng/sysafari-logistics
npm run dev
# 然后访问 http://localhost:5173
```

---

## 登录信息

| 环境 | URL | 账号 | 密码 |
|------|-----|------|------|
| 生产 | erp.xianfeng-eu.com | Auth0 登录 或 admin | admin123 |
| 本地 | localhost:5173 | admin | admin123 |

---

## 文件变更总结

已修改的文件：
- `server/config/database.js` - 支持双数据库切换
- `server/.env` - 本地开发环境变量

已创建的资源：
- Render PostgreSQL: `logistics-production-db`

---

## 故障排除

**问题：本地开发连接不上数据库**
- 检查 `server/.env` 中的 `DATABASE_URL_TEST` 是否正确
- 确保使用 External URL 而不是 Internal URL

**问题：生产环境连接不上数据库**
- 检查 Render 环境变量中的 `DATABASE_URL_PROD` 是否正确
- 确保新数据库的 IP 白名单包含 `0.0.0.0/0`






