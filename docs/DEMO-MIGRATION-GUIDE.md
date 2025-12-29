# 演示环境迁移到阿里云指南

## 📋 迁移清单

### 阿里云资源准备

| 序号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| 1 | 创建演示环境 OSS Bucket | ⬜ | `sysafari-logistics-demo` |
| 2 | 配置 OSS 静态网站托管 | ⬜ | 默认首页/404 设为 index.html |
| 3 | 配置演示环境 CDN | ⬜ | 加速域名 demo.xianfeng-eu.com |
| 4 | 申请 SSL 证书 | ⬜ | demo.xianfeng-eu.com |
| 5 | 配置 DNS 解析 | ⬜ | CNAME 指向 CDN |
| 6 | 创建演示数据库 | ⬜ | RDS: sysafari_demo |
| 7 | ECS 部署演示后端 | ⬜ | 端口 3002 |
| 8 | 部署演示前端 | ⬜ | OSS + CDN |

---

## 🚀 详细步骤

### 第一步：创建演示环境 OSS Bucket

1. 登录 [OSS 控制台](https://oss.console.aliyun.com/)
2. 点击「创建 Bucket」
3. 配置：
   - Bucket 名称：`sysafari-logistics-demo`
   - 地域：香港
   - 存储类型：标准存储
   - 读写权限：**公共读**
4. 创建完成后，进入 Bucket → 「基础设置」→「静态页面」
5. 配置静态网站托管：
   - 默认首页：`index.html`
   - 默认 404 页：`index.html`（SPA 路由支持）

---

### 第二步：配置演示环境 CDN

1. 进入 [CDN 控制台](https://cdn.console.aliyun.com/)
2. 点击「域名管理」→「添加域名」
3. 配置：
   - 加速域名：`demo.xianfeng-eu.com`
   - 业务类型：图片小文件
   - 源站类型：OSS 域名
   - 源站地址：`sysafari-logistics-demo.oss-cn-hongkong.aliyuncs.com`
   - 端口：443
4. 点击「确定」

---

### 第三步：申请 SSL 证书

1. 进入 [SSL 证书控制台](https://yundunnext.console.aliyun.com/?p=cas)
2. 点击「SSL 证书」→「免费证书」→「立即购买」
3. 购买 DV 单域名证书（免费）
4. 点击「创建证书」→「证书申请」
5. 填写：
   - 证书绑定域名：`demo.xianfeng-eu.com`
   - 域名验证方式：DNS 验证
6. 按提示添加 DNS 解析记录完成验证
7. 证书签发后，在 CDN 控制台绑定证书

---

### 第四步：配置 DNS 解析

1. 进入 [云解析 DNS 控制台](https://dns.console.aliyun.com/)
2. 选择域名 `xianfeng-eu.com`
3. 添加解析记录：

| 主机记录 | 记录类型 | 记录值 | TTL |
|---------|---------|--------|-----|
| demo | CNAME | CDN 提供的 CNAME 值 | 600 |

> CDN 的 CNAME 值在 CDN 控制台 → 域名管理 中查看

---

### 第五步：创建演示数据库

**在阿里云 RDS 控制台：**

1. 进入 RDS 实例详情
2. 点击「账号管理」确认数据库账号
3. 点击「数据库管理」→「创建数据库」
4. 配置：
   - 数据库名：`sysafari_demo`
   - 字符集：UTF-8
   - 授权账号：选择已有账号

**或者使用命令行：**

```bash
# 连接到 RDS
psql "postgresql://用户名:密码@RDS地址:5432/postgres"

# 创建演示数据库
CREATE DATABASE sysafari_demo WITH ENCODING 'UTF8';
```

**导入初始数据（可选）：**

```bash
# 从生产导出
pg_dump "生产数据库URL" > prod_backup.sql

# 导入到演示
psql "演示数据库URL" < prod_backup.sql
```

---

### 第六步：ECS 部署演示后端

**SSH 登录 ECS 服务器：**

```bash
ssh root@<ECS-IP>
```

**1. 创建演示环境目录：**

```bash
# 如果还没有演示目录，克隆代码
cd /var/www
git clone https://github.com/你的用户名/sysafari-logistics.git demo
```

**2. 安装依赖：**

```bash
cd /var/www/demo/server
npm install --production
```

**3. 配置环境变量：**

```bash
nano /var/www/demo/server/.env
```

添加以下内容：

```env
# 演示环境配置
NODE_ENV=production
PORT=3002

# 数据库连接 - 演示环境数据库
DATABASE_URL=postgresql://用户名:密码@RDS内网地址:5432/sysafari_demo

# JWT 密钥（使用不同于生产的密钥）
JWT_SECRET=your_demo_jwt_secret_different_from_prod
JWT_EXPIRES_IN=7d

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# CORS 配置
CORS_ORIGIN=https://demo.xianfeng-eu.com

# 演示环境标记
IS_DEMO=true

# 时区
TZ=Asia/Shanghai
```

**4. 启动演示环境后端：**

```bash
# 使用 PM2 启动
cd /var/www
pm2 start ecosystem.config.js --only sysafari-demo

# 保存进程列表
pm2 save

# 查看状态
pm2 status
```

**5. 更新 Nginx 配置（如果还没有配置）：**

```bash
# 检查 Nginx 配置
sudo nginx -t

# 如果配置已存在，重载
sudo systemctl reload nginx
```

---

### 第七步：部署演示前端

**在本地执行：**

```bash
cd /Users/fengzheng/sysafari-logistics

# 方式一：使用统一部署脚本
bash scripts/aliyun/deploy-oss.sh demo

# 方式二：使用专用脚本
bash scripts/aliyun/deploy-oss-demo.sh
```

---

## ✅ 验证部署

### 1. 后端健康检查

```bash
# 本地测试（通过 ECS 内网）
ssh root@<ECS-IP> "curl -s http://localhost:3002/api/health"

# 公网测试
curl https://demo.xianfeng-eu.com/api/health
```

预期返回：
```json
{"errCode":200,"msg":"OK","data":{"status":"healthy",...}}
```

### 2. 前端访问测试

1. 打开浏览器访问 https://demo.xianfeng-eu.com
2. 登录测试：admin / admin123
3. 检查各功能模块

### 3. 数据库连接测试

```bash
# SSH 登录 ECS
ssh root@<ECS-IP>

# 测试数据库连接
cd /var/www/demo/server
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => {
  console.log('数据库连接成功:', r.rows[0].now);
  pool.end();
}).catch(console.error);
"
```

---

## 📝 部署命令速查

```bash
# 本地 - 部署演示前端
bash scripts/aliyun/deploy-oss.sh demo

# ECS - 重启演示后端
pm2 restart sysafari-demo

# ECS - 查看演示环境日志
pm2 logs sysafari-demo

# ECS - 更新演示环境代码
cd /var/www/demo && git pull origin main
cd server && npm install --production
pm2 reload sysafari-demo
```

---

## 🔗 相关链接

- 阿里云控制台：https://console.aliyun.com
- OSS 控制台：https://oss.console.aliyun.com
- CDN 控制台：https://cdn.console.aliyun.com
- RDS 控制台：https://rdsnext.console.aliyun.com
- SSL 证书控制台：https://yundunnext.console.aliyun.com/?p=cas

---

## ⚠️ 注意事项

1. **数据隔离**：演示环境使用独立数据库 `sysafari_demo`，与生产数据完全隔离
2. **密钥不同**：JWT_SECRET 应与生产环境使用不同值
3. **定期重置**：演示环境数据可以定期重置，保持数据整洁
4. **成本控制**：演示环境可以使用较低规格配置


