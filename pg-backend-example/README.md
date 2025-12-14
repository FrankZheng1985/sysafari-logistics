# Node.js + Express + PostgreSQL 后端示例

一个简单的后端项目示例，使用 Node.js、Express 和 pg 库连接 PostgreSQL 数据库。

## 📁 项目结构

```
pg-backend-example/
├── config/
│   └── database.js      # 数据库配置和连接池
├── scripts/
│   └── init-db.sql      # 数据库初始化脚本
├── index.js             # 主入口文件
├── package.json         # 依赖管理
├── .env.example         # 环境变量示例
└── README.md            # 项目说明
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd pg-backend-example
npm install
```

### 2. 配置环境变量

复制环境变量示例文件并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你的 PostgreSQL 连接信息：

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. 初始化数据库

确保 PostgreSQL 已安装并运行，然后执行初始化脚本：

```bash
# 创建数据库（如果需要）
createdb test_db

# 执行初始化SQL
psql -h localhost -U postgres -d test_db -f scripts/init-db.sql
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问：http://localhost:3000

## 📚 API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/db-test` | 数据库连接测试 |
| GET | `/api/users` | 获取所有用户 |
| POST | `/api/users` | 创建用户 |
| GET | `/api/users/:id` | 获取单个用户 |
| PUT | `/api/users/:id` | 更新用户 |
| DELETE | `/api/users/:id` | 删除用户 |

### 示例请求

```bash
# 健康检查
curl http://localhost:3000/api/health

# 获取所有用户
curl http://localhost:3000/api/users

# 创建用户
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "测试用户", "email": "test@example.com"}'

# 获取单个用户
curl http://localhost:3000/api/users/1

# 更新用户
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "更新后的名字"}'

# 删除用户
curl -X DELETE http://localhost:3000/api/users/1
```

## 🛠 技术栈

- **Node.js** >= 18.0.0
- **Express** 4.x - Web 框架
- **pg** 8.x - PostgreSQL 客户端
- **dotenv** - 环境变量管理
- **cors** - 跨域支持

## 📝 注意事项

1. 确保 PostgreSQL 服务已启动
2. 数据库用户需要有创建表的权限
3. 生产环境请修改默认密码
4. 建议使用环境变量管理敏感配置

## 📄 许可证

ISC
