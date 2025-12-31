# 阿里云 ECS 双环境部署指南

本指南帮助你在一台阿里云 ECS 服务器上部署 **生产环境** 和 **演示环境** 两套系统。

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    阿里云 ECS 服务器                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Nginx                              │   │
│  │  erp.xianfeng-eu.com → :3001 (生产)                  │   │
│  │  demo.xianfeng-eu.com → :3002 (演示)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                 │
│          ▼                               ▼                  │
│  ┌───────────────┐               ┌───────────────┐         │
│  │ sysafari-prod │               │ sysafari-demo │         │
│  │   PORT:3001   │               │   PORT:3002   │         │
│  └───────┬───────┘               └───────┬───────┘         │
│          │                               │                  │
└──────────│───────────────────────────────│──────────────────┘
           │                               │
           ▼                               ▼
    ┌─────────────────────────────────────────────┐
    │         阿里云 RDS PostgreSQL                │
    │  sysafari_prod     │     sysafari_demo      │
    └─────────────────────────────────────────────┘
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `init-ecs-dual.sh` | ECS 服务器初始化脚本 |
| `ecosystem.config.js` | PM2 进程管理配置 |
| `nginx-dual-env.conf` | Nginx 双环境配置 |
| `env.prod.example` | 生产环境变量模板 |
| `env.demo.example` | 演示环境变量模板 |

## 部署步骤

### 1. 购买阿里云资源

**ECS 服务器：**
- 推荐配置：2核4G（ecs.c6.large）
- 系统：Ubuntu 22.04 LTS
- 地域：根据目标用户选择（建议香港或新加坡）

**RDS PostgreSQL：**
- 推荐配置：1核2G 基础版
- 版本：PostgreSQL 14+
- 与 ECS 同地域

### 2. 配置安全组

在 ECS 安全组中开放以下端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH 远程登录 |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |

### 3. 配置 RDS

1. 创建两个数据库：
```sql
CREATE DATABASE sysafari_prod WITH ENCODING 'UTF8';
CREATE DATABASE sysafari_demo WITH ENCODING 'UTF8';
```

2. 配置白名单：添加 ECS 服务器的内网 IP

### 4. 初始化 ECS

SSH 登录服务器后执行：

```bash
# 下载初始化脚本
curl -O https://raw.githubusercontent.com/你的用户名/sysafari-logistics/main/scripts/aliyun/init-ecs-dual.sh

# 修改 GitHub 仓库地址
nano init-ecs-dual.sh

# 添加执行权限并运行
chmod +x init-ecs-dual.sh
./init-ecs-dual.sh
```

### 5. 配置环境变量

```bash
# 生产环境
cp /var/www/prod/scripts/aliyun/env.prod.example /var/www/prod/server/.env
nano /var/www/prod/server/.env

# 演示环境
cp /var/www/demo/scripts/aliyun/env.demo.example /var/www/demo/server/.env
nano /var/www/demo/server/.env
```

### 6. 申请 SSL 证书

```bash
# 确保域名已解析到服务器 IP
# 申请证书
sudo certbot certonly --webroot -w /var/www/certbot -d erp.xianfeng-eu.com
sudo certbot certonly --webroot -w /var/www/certbot -d demo.xianfeng-eu.com

# 复制证书
sudo mkdir -p /etc/nginx/ssl/erp.xianfeng-eu.com
sudo mkdir -p /etc/nginx/ssl/demo.xianfeng-eu.com

sudo cp /etc/letsencrypt/live/erp.xianfeng-eu.com/fullchain.pem /etc/nginx/ssl/erp.xianfeng-eu.com/
sudo cp /etc/letsencrypt/live/erp.xianfeng-eu.com/privkey.pem /etc/nginx/ssl/erp.xianfeng-eu.com/
sudo cp /etc/letsencrypt/live/demo.xianfeng-eu.com/fullchain.pem /etc/nginx/ssl/demo.xianfeng-eu.com/
sudo cp /etc/letsencrypt/live/demo.xianfeng-eu.com/privkey.pem /etc/nginx/ssl/demo.xianfeng-eu.com/
```

### 7. 构建前端

```bash
# 生产环境
cd /var/www/prod
npm run build

# 演示环境
cd /var/www/demo
npm run build
```

### 8. 启动服务

```bash
# 启动 PM2 进程
cd /var/www
pm2 start ecosystem.config.js

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### 9. 重载 Nginx

```bash
# 验证配置
sudo nginx -t

# 重载
sudo systemctl reload nginx
```

## 日常运维

### 查看服务状态
```bash
pm2 status
```

### 查看日志
```bash
# 所有日志
pm2 logs

# 生产环境日志
pm2 logs sysafari-prod

# 演示环境日志
pm2 logs sysafari-demo
```

### 重启服务
```bash
# 重启所有
pm2 restart all

# 零停机重载
pm2 reload all

# 重启单个
pm2 restart sysafari-prod
```

### 更新代码
```bash
# 生产环境
cd /var/www/prod
git pull origin main
npm run build
pm2 reload sysafari-prod

# 演示环境
cd /var/www/demo
git pull origin main
npm run build
pm2 reload sysafari-demo
```

### SSL 证书续期
```bash
# Let's Encrypt 证书自动续期
sudo certbot renew --dry-run  # 测试
sudo certbot renew            # 执行续期
```

## 成本预估

| 资源 | 规格 | 月费用 |
|------|------|--------|
| ECS | 2核4G | ¥200-300 |
| RDS PostgreSQL | 1核2G | ¥100-150 |
| OSS | 按量 | ¥10-30 |
| CDN | 按量 | ¥50-100 |
| **合计** | | **¥360-580** |

## 常见问题

### Q: 如何备份/迁移数据？
1. 从阿里云 RDS 导出数据：`pg_dump`
2. 导入到目标数据库：`psql`

### Q: 两个环境可以使用不同的代码分支吗？
可以。修改 `ecosystem.config.js` 中的 `deploy` 配置，指定不同的 `ref`。

### Q: 如何添加自动部署？
可以配置 GitHub Actions，在代码推送时自动触发部署。

