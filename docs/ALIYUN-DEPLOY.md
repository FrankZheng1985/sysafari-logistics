# 阿里云香港区域部署指南

## 目录
- [架构概览](#架构概览)
- [服务清单](#服务清单)
- [第一步：注册阿里云](#第一步注册阿里云)
- [第二步：购买服务](#第二步购买服务)
- [第三步：数据库迁移](#第三步数据库迁移)
- [第四步：后端部署](#第四步后端部署)
- [第五步：前端部署](#第五步前端部署)
- [第六步：域名与SSL](#第六步域名与ssl)
- [验证清单](#验证清单)
- [常见问题](#常见问题)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        阿里云香港区域部署架构                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   用户访问                                                               │
│      ↓                                                                  │
│   ┌─────────────────┐                                                   │
│   │  CDN 全球加速    │  ←── erp.xianfeng-eu.com                          │
│   └────────┬────────┘                                                   │
│            │                                                            │
│   ┌────────┴────────┐      ┌─────────────────┐                          │
│   │   OSS 对象存储   │      │   ECS 云服务器   │ ←── api.xianfeng-eu.com   │
│   │   (前端静态)     │      │   (后端 API)     │                          │
│   └─────────────────┘      └────────┬────────┘                          │
│                                     │                                   │
│                            ┌────────┴────────┐                          │
│                            │  RDS PostgreSQL │                          │
│                            │    (数据库)      │                          │
│                            └─────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 服务清单

| 服务 | 规格 | 地域 | 用途 |
|------|------|------|------|
| RDS PostgreSQL | 2核4G, 50GB SSD | 香港 | 数据库 |
| ECS 云服务器 | 2核4G, 40GB SSD | 香港 | 后端 API |
| OSS 对象存储 | 标准存储 | 香港 | 前端静态文件 |
| CDN | 全球加速 | 全球 | 前端加速 |
| SSL 证书 | 免费 DV | - | HTTPS |
| 云解析 DNS | 免费版 | - | 域名解析 |

---

## 第一步：注册阿里云

1. 访问 https://www.aliyun.com
2. 点击"免费注册"
3. 使用手机号或邮箱注册
4. 完成实名认证（需身份证或营业执照）
5. 绑定支付宝或银行卡

---

## 第二步：购买服务

### 2.1 创建 VPC 网络

1. 进入 [专有网络 VPC 控制台](https://vpc.console.aliyun.com/)
2. 点击"创建专有网络"
3. 配置：
   - 地域：香港
   - 名称：sysafari-vpc
   - IPv4 网段：172.16.0.0/16
4. 创建交换机：
   - 可用区：香港可用区 B
   - 网段：172.16.0.0/24

### 2.2 购买 RDS PostgreSQL

1. 进入 [RDS 控制台](https://rdsnext.console.aliyun.com/)
2. 点击"创建实例"
3. 配置：
   - 地域：香港
   - 数据库类型：PostgreSQL
   - 版本：16.0
   - 系列：高可用版（推荐）或基础版
   - 规格：通用型 2核4GB
   - 存储：50GB SSD（可扩展）
   - 网络：选择刚创建的 VPC
4. 购买时长：3年（最大优惠）
5. 创建后设置：
   - 设置数据库账号密码
   - 添加白名单（0.0.0.0/0 临时用于迁移）
   - 开启公网访问

### 2.3 购买 ECS 云服务器

1. 进入 [ECS 控制台](https://ecs.console.aliyun.com/)
2. 点击"创建实例"
3. 配置：
   - 地域：香港
   - 可用区：香港可用区 B（与 RDS 同区）
   - 实例规格：ecs.c6.large（2核4GB）
   - 镜像：Ubuntu 22.04 64位
   - 系统盘：40GB 高效云盘
   - 网络：选择刚创建的 VPC
   - 公网 IP：分配（按流量计费）
   - 带宽：5Mbps
4. 安全组配置：
   - 开放端口：22, 80, 443, 3001

### 2.4 创建 OSS Bucket

1. 进入 [OSS 控制台](https://oss.console.aliyun.com/)
2. 点击"创建 Bucket"
3. 配置：
   - Bucket 名称：sysafari-logistics-web
   - 地域：香港
   - 存储类型：标准存储
   - 读写权限：公共读
4. 开启静态网站托管：
   - 默认首页：index.html
   - 默认 404 页：index.html

### 2.5 配置 CDN

1. 进入 [CDN 控制台](https://cdn.console.aliyun.com/)
2. 添加域名：
   - 加速域名：erp.xianfeng-eu.com
   - 业务类型：图片小文件
   - 源站类型：OSS 域名
   - 源站地址：sysafari-logistics-web.oss-cn-hongkong.aliyuncs.com
3. 配置 HTTPS（需先申请 SSL 证书）

---

## 第三步：数据库管理

### 3.1 数据库备份

```bash
# 设置阿里云 RDS 连接
export DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名"

# 执行备份
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3.2 数据库恢复

```bash
# 设置阿里云 RDS 连接
export DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名"

# 执行恢复
psql "$DATABASE_URL" < backup_XXXXXX.sql
```

### 3.3 验证数据

```bash
# 检查数据表记录数
psql "$TARGET_DATABASE_URL" -c "
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'bills_of_lading', COUNT(*) FROM bills_of_lading
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices;
"
```

### 3.4 使用迁移脚本（推荐）

```bash
cd /Users/fengzheng/sysafari-logistics

# 设置环境变量
export SOURCE_DATABASE_URL="postgresql://..."
export TARGET_DATABASE_URL="postgresql://..."

# 执行迁移脚本
bash scripts/aliyun/backup-and-migrate-db.sh
```

---

## 第四步：后端部署

### 4.1 SSH 连接 ECS

```bash
ssh root@<ECS公网IP>
```

### 4.2 执行初始化脚本

```bash
# 下载初始化脚本
curl -O https://raw.githubusercontent.com/你的用户名/sysafari-logistics/main/scripts/aliyun/init-ecs.sh

# 执行脚本
chmod +x init-ecs.sh
./init-ecs.sh
```

### 4.3 配置环境变量

```bash
cd /var/www/sysafari-logistics/server
nano .env
```

添加以下内容：

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名
JWT_SECRET=你的JWT密钥（建议使用随机字符串）
```

### 4.4 启动应用

```bash
# 使用 PM2 启动
pm2 start app.js --name sysafari-api

# 设置开机自启
pm2 save
pm2 startup
```

### 4.5 配置 Nginx

```bash
# 复制配置文件
sudo cp /var/www/sysafari-logistics/scripts/aliyun/nginx-api.conf \
  /etc/nginx/sites-available/sysafari-api

# 创建软链接
sudo ln -s /etc/nginx/sites-available/sysafari-api \
  /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl reload nginx
```

### 4.6 配置 SSL 证书

```bash
# 创建证书目录
sudo mkdir -p /etc/nginx/ssl

# 上传阿里云下载的证书文件
# fullchain.pem 和 privkey.pem
sudo nano /etc/nginx/ssl/fullchain.pem
sudo nano /etc/nginx/ssl/privkey.pem

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 第五步：前端部署

### 5.1 安装 ossutil

macOS:
```bash
brew install aliyun-cli
```

或手动下载：https://help.aliyun.com/document_detail/120075.html

### 5.2 配置 ossutil

```bash
ossutil config \
  -e oss-cn-hongkong.aliyuncs.com \
  -i <AccessKeyID> \
  -k <AccessKeySecret>
```

### 5.3 构建并部署

```bash
cd /Users/fengzheng/sysafari-logistics

# 设置生产环境变量
export VITE_API_BASE_URL=https://api.xianfeng-eu.com

# 构建
npm run build

# 部署到 OSS
ossutil cp -r dist/ oss://sysafari-logistics-web/ \
  --update \
  --acl public-read
```

### 5.4 使用部署脚本（推荐）

```bash
bash scripts/aliyun/deploy-oss.sh
```

---

## 第六步：域名与SSL

### 6.1 申请 SSL 证书

1. 进入 [SSL 证书控制台](https://yundunnext.console.aliyun.com/?p=cas)
2. 点击"免费证书" → "购买证书"
3. 选择"免费版 DV SSL"
4. 申请证书：
   - 域名：erp.xianfeng-eu.com
   - 验证方式：DNS 验证
5. 重复申请 api.xianfeng-eu.com

### 6.2 配置 DNS 解析

1. 进入 [云解析 DNS 控制台](https://dns.console.aliyun.com/)
2. 添加域名（如未添加）
3. 添加解析记录：

| 主机记录 | 记录类型 | 记录值 | 说明 |
|---------|---------|--------|------|
| erp | CNAME | CDN 提供的 CNAME | 前端 |
| api | A | ECS 公网 IP | 后端 |

### 6.3 CDN 配置 HTTPS

1. 进入 CDN 控制台 → 域名管理
2. 选择 erp.xianfeng-eu.com
3. HTTPS 配置 → 修改配置
4. 选择刚申请的 SSL 证书
5. 开启 HTTP/2

---

## 验证清单

### 后端验证

```bash
# 健康检查
curl https://api.xianfeng-eu.com/api/health

# 预期返回
# {"errCode":200,"msg":"OK","data":{"status":"healthy",...}}
```

### 前端验证

1. 访问 https://erp.xianfeng-eu.com
2. 登录测试：admin / admin123
3. 检查各功能模块

### 数据库验证

```bash
# 登录 ECS 测试数据库连接
cd /var/www/sysafari-logistics/server
node -e "
import('./config/database.js').then(db => {
  db.testConnection().then(console.log)
})
"
```

---

## 常见问题

### Q1: 数据库连接失败

**检查项：**
1. RDS 白名单是否添加 ECS 内网 IP
2. 连接字符串是否正确
3. SSL 参数是否配置正确

### Q2: CDN 访问 404

**解决：**
1. 检查 OSS 静态网站托管是否开启
2. 404 页面是否设置为 index.html
3. CDN 缓存是否刷新

### Q3: CORS 错误

**解决：**
1. 检查 server/app.js 中 CORS 配置
2. 确认域名是否在白名单中
3. 重启后端服务

### Q4: SSL 证书错误

**解决：**
1. 检查证书文件路径是否正确
2. 证书是否过期
3. Nginx 配置是否正确

---

## 迁移后维护

### 代码更新

```bash
# 后端更新
ssh root@<ECS-IP>
cd /var/www/sysafari-logistics
git pull origin main
cd server && npm install --production
pm2 restart sysafari-api

# 前端更新
cd /Users/fengzheng/sysafari-logistics
git pull origin main
npm install
bash scripts/aliyun/deploy-oss.sh
```

### 数据库备份

建议在阿里云 RDS 控制台开启自动备份：
- 备份周期：每天
- 保留天数：7天

### 监控告警

建议配置云监控：
- ECS CPU/内存告警
- RDS 连接数/存储告警
- CDN 带宽告警

---

## 联系方式

如有问题，请联系系统管理员。

