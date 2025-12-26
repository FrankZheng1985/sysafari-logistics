# 🔍 生产环境与开发环境对比报告

> 生成时间：2025-12-26
> 系统：Sysafari Logistics ERP

---

## 📊 总体架构对比

### 环境一览表

| 环境 | 前端 | 后端 API | 数据库 | 区域 |
|------|------|----------|--------|------|
| **本地开发** | localhost:5173 | localhost:3001 | 本地 PostgreSQL | 本地 |
| **生产环境** | erp.xianfeng-eu.com | sysafari-logistics-api-sg.onrender.com | 新加坡 PostgreSQL | 新加坡 |
| **演示环境** | demo.xianfeng-eu.com | sysafari-logistics-demo-api.onrender.com | Virginia PostgreSQL | 美国东部 |

---

## 🖥️ 一、前端部署对比

### 本地开发环境
```
├── 框架：Vite + React + TypeScript
├── 端口：5173
├── API 代理：http://localhost:3001/api
└── 热重载：启用
```

### 生产环境 (Vercel)
```
├── 平台：Vercel
├── 域名：erp.xianfeng-eu.com
├── 构建命令：npm run build
├── 输出目录：dist
├── Node 版本：24.x
├── API 转发：https://sysafari-logistics-api-sg.onrender.com/api/*
└── 自动部署：GitHub main 分支推送触发
```

### 配置差异

| 配置项 | 本地开发 | 生产环境 |
|--------|----------|----------|
| API Base URL | `''` (相对路径) | `https://sysafari-logistics-api-sg.onrender.com` |
| API 请求方式 | Vite Proxy 代理 | Vercel Rewrites 转发 |
| 缓存策略 | 无 | 静态资源 1 年缓存 |
| 安全头 | 无 | X-Frame-Options, CSP 等 |

### API 路由映射 (src/utils/api.ts)

```typescript
// 本地开发: 相对路径，由 Vite 代理
hostname === 'localhost' → API_BASE_URL = ''

// 演示环境
hostname === 'demo.xianfeng-eu.com' 
  → API_BASE_URL = 'https://sysafari-logistics-demo-api.onrender.com'

// 生产环境
hostname === 'erp.xianfeng-eu.com'
  → API_BASE_URL = 'https://sysafari-logistics-api-sg.onrender.com'
```

---

## 🔧 二、后端服务对比

### 本地开发环境
```
├── 运行命令：cd server && npm run dev
├── 端口：3001
├── 数据库：本地 PostgreSQL
├── 日志：控制台输出
└── 热重载：nodemon 监控
```

### 生产环境 (Render)

| 服务名称 | 区域 | 计划 | 用途 |
|----------|------|------|------|
| sysafari-logistics-api-sg | 新加坡 | Starter | 生产 API |
| sysafari-logistics-demo-api-sg | 新加坡 | Starter | 演示 API |
| sysafari-logistics-api | Virginia | Starter | 备用 API |
| sysafari-logistics-demo-api | Virginia | Starter | 备用演示 |

### 服务配置详情

| 配置项 | 本地开发 | 生产环境 (Render) |
|--------|----------|-------------------|
| 构建命令 | - | `cd server && npm install` |
| 启动命令 | `npm run dev` | `node app.js` |
| 端口 | 3001 | 10000 (自动分配) |
| 实例数 | 1 | 1 |
| 自动部署 | 否 | 是 (GitHub commit 触发) |
| 预览部署 | 否 | 否 |
| 维护模式 | 否 | 否 |

### 数据库连接池配置 (server/config/database.js)

```javascript
// 当前生产配置 (已优化)
pgPool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // 生产环境需要 SSL
  max: 20,                              // 最大连接数
  min: 2,                               // 最小连接数 ✅ 新增
  idleTimeoutMillis: 60000,             // 空闲超时 60s ✅ 从30s增加
  connectionTimeoutMillis: 10000,       // 连接超时 10s ✅ 从5s增加
  allowExitOnIdle: false,               // 防止空闲退出 ✅ 新增
})

// 心跳检查：每 5 分钟 ✅ 新增
setInterval(() => pgPool.query('SELECT 1'), 5 * 60 * 1000)
```

---

## 🗄️ 三、数据库对比

### 数据库实例

| 数据库名称 | 区域 | 版本 | 计划 | 存储 | 用途 |
|------------|------|------|------|------|------|
| 生产环境数据库-新加坡 | 新加坡 | 16.11 | basic_256mb | 15GB | **主生产库** |
| 演示环境数据库-新加坡 | 新加坡 | 18 | basic_256mb | 15GB | 演示环境 |
| 测试环境数据库 | Virginia | 18 | basic_256mb | 15GB | 测试/开发 |
| 生产环境数据库 | Virginia | 16 | basic_256mb | 15GB | 备用生产 |

### 数据库表统计

| 统计项 | 新加坡生产库 |
|--------|-------------|
| 总表数 | 124 |
| 总索引数 | ~200+ |

### 核心表数据量对比

| 表名 | 字段数 | 新加坡生产库数据量 |
|------|--------|-------------------|
| tariff_rates | 48 | 93,215 |
| fees | 33 | 3,672 |
| bills_of_lading | 99 | 544 |
| customers | 40 | 9 |
| invoices | 31 | 5 |
| users | 19 | 11 |
| products | 11 | 7 |
| suppliers | 33 | 14 |

### 数据库连接字符串格式

```
# 本地开发
postgresql://user:password@localhost:5432/logistics_dev

# 生产环境 (新加坡)
postgresql://user:password@dpg-xxx.singapore-postgres.render.com/dbname?sslmode=require
```

---

## 🔐 四、环境变量对比

### 关键环境变量

| 变量名 | 本地开发 | 生产环境 |
|--------|----------|----------|
| `NODE_ENV` | development | production |
| `DATABASE_URL` | localhost | Render 内部连接 |
| `PORT` | 3001 | 10000 |
| `SSL` | false | true |

### 环境变量配置位置

- **本地开发**: `server/.env` 文件
- **生产环境**: Render Dashboard → Environment Variables

---

## 🚀 五、部署流程对比

### 本地开发流程
```bash
# 1. 启动后端
cd server && npm run dev

# 2. 启动前端
npm run dev

# 3. 访问
http://localhost:5173
```

### 生产部署流程 (自动)
```
1. 开发者推送代码到 GitHub main 分支
   ↓
2. Vercel 自动检测并构建前端
   - 运行 npm run build
   - 部署到 CDN
   ↓
3. Render 自动检测并部署后端
   - 运行 cd server && npm install
   - 启动 node app.js
   - 运行数据库迁移
   ↓
4. 服务上线
```

### 部署时间

| 环节 | 耗时 |
|------|------|
| Vercel 前端构建 | ~30-60 秒 |
| Render 后端部署 | ~90-120 秒 |
| 数据库迁移 | ~5-10 秒 |

---

## 📡 六、网络架构对比

### 本地开发
```
浏览器 (5173)
    ↓
Vite Dev Server
    ↓ (proxy)
Express Server (3001)
    ↓
Local PostgreSQL
```

### 生产环境
```
用户浏览器
    ↓
Cloudflare CDN (erp.xianfeng-eu.com)
    ↓
Vercel Edge Network
    ↓ (API rewrite)
Render Web Service (新加坡)
    ↓
Render PostgreSQL (新加坡)
```

### 延迟对比

| 环节 | 本地开发 | 生产环境 |
|------|----------|----------|
| 静态资源 | <1ms | 10-50ms (CDN 缓存) |
| API 请求 | 1-5ms | 50-200ms |
| 数据库查询 | 1-10ms | 5-50ms |

---

## 🔄 七、CORS 配置对比

### 允许的来源 (server/app.js)

```javascript
origin: [
  // 本地开发
  'http://localhost:5173', 
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://127.0.0.1:5173',
  'http://localhost:5174',  // 客户门户本地
  'http://localhost:5175',
  
  // 生产环境
  'https://erp.xianfeng-eu.com',
  'https://www.erp.xianfeng-eu.com',
  
  // 客户门户
  'https://portal.xianfeng-eu.com',
  'https://customer.xianfeng-eu.com',
  
  // 演示环境
  'https://demo.xianfeng-eu.com',
  'https://sysafari-logistics.vercel.app',
  
  // Vercel 预览域名
  /\.vercel\.app$/
]
```

---

## ⚙️ 八、安全配置对比

| 安全特性 | 本地开发 | 生产环境 |
|----------|----------|----------|
| HTTPS | ❌ 否 | ✅ 是 |
| 安全响应头 | ❌ 否 | ✅ 是 |
| 速率限制 | ⚠️ 100/分钟 | ✅ 100/分钟 |
| 登录限制 | ⚠️ 有 | ✅ 有 |
| XSS 防护 | ⚠️ 有 | ✅ 有 |
| SQL 注入防护 | ✅ 有 | ✅ 有 |
| SSL/TLS | ❌ 否 | ✅ 是 |

---

## 📋 九、定时任务配置

| 任务 | 本地开发 | 生产环境 |
|------|----------|----------|
| 预警检查 | 24 小时 | 24 小时 |
| 数据库备份 | ❌ 禁用 | ✅ 启用 |
| 税号验证 | ✅ 启用 | ✅ 启用 |
| TARIC 同步 | ✅ 启用 | ✅ 启用 |
| 数据库心跳 | ❌ 禁用 | ✅ 5分钟 |

---

## 🎯 十、总结与建议

### ✅ 已优化项

1. **数据库连接池** - 添加最小连接数和心跳检查
2. **区域一致性** - 生产 API 和数据库都在新加坡
3. **自动迁移** - 服务启动时自动检查并更新数据库结构

### ⚠️ 注意事项

1. **环境变量同步** - 本地 `.env` 更新后，需要同步到 Render 环境变量
2. **数据库迁移** - 新建表/字段需要在自动迁移脚本中添加
3. **API 路由** - 新增 API 需要确保在 CORS 白名单中

### 📝 常用操作命令

```bash
# 本地启动全套环境
npm run dev:all

# 仅启动前端
npm run dev

# 仅启动后端
npm run server:dev

# 构建生产版本
npm run build

# 查看生产日志 (Render)
# 访问 Render Dashboard → Services → Logs
```

---

## 🔗 相关链接

| 资源 | 链接 |
|------|------|
| 生产环境 | https://erp.xianfeng-eu.com |
| 演示环境 | https://demo.xianfeng-eu.com |
| Vercel Dashboard | https://vercel.com/frankzhengs-projects-18712415/sysafari-logistics |
| Render Dashboard | https://dashboard.render.com |
| GitHub 仓库 | https://github.com/FrankZheng1985/sysafari-logistics |

