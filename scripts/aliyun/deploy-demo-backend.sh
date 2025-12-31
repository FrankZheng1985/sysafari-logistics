#!/bin/bash
# ============================================
# 演示后端部署脚本
# 在 ECS 服务器上执行
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  演示后端部署脚本${NC}"
echo -e "${BLUE}============================================${NC}"

# ============================================
# 步骤 1: 创建目录
# ============================================
echo -e "${YELLOW}[1/7] 创建目录...${NC}"
mkdir -p /var/www/demo/server/uploads
mkdir -p /var/log/pm2
mkdir -p /etc/nginx/ssl/demo-api.xianfeng-eu.com
echo -e "${GREEN}✓ 目录创建完成${NC}"

# ============================================
# 步骤 2: 复制生产环境代码作为基础
# ============================================
echo -e "${YELLOW}[2/7] 复制后端代码...${NC}"
if [ -d "/var/www/sysafari-logistics/server" ]; then
    rsync -av --exclude 'node_modules' --exclude '.env' --exclude 'uploads/*' \
        /var/www/sysafari-logistics/server/ /var/www/demo/server/
    echo -e "${GREEN}✓ 代码复制完成${NC}"
else
    echo -e "${RED}错误: 未找到生产环境代码，请手动上传${NC}"
    exit 1
fi

# ============================================
# 步骤 3: 配置演示环境变量
# ============================================
echo -e "${YELLOW}[3/7] 配置环境变量...${NC}"

# 读取生产环境的数据库配置作为参考
if [ -f "/var/www/sysafari-logistics/server/.env" ]; then
    echo "参考生产环境配置..."
    PROD_DB=$(grep "DATABASE_URL" /var/www/sysafari-logistics/server/.env | head -1)
    echo "生产数据库: $PROD_DB"
fi

# 创建演示环境配置
cat > /var/www/demo/server/.env << 'EOF'
NODE_ENV=production
PORT=3002

# ⚠️ 请修改为演示数据库的连接信息
# 格式: postgresql://用户名:密码@RDS地址:5432/数据库名
DATABASE_URL=postgresql://demo_user:demo_password@localhost:5432/sysafari_demo

# JWT 密钥（演示环境专用）
JWT_SECRET=demo-jwt-secret-xianfeng-2025

# 上传目录
UPLOAD_DIR=/var/www/demo/server/uploads

# COS 配置（如果使用腾讯云对象存储）
# COS_SECRET_ID=your_secret_id
# COS_SECRET_KEY=your_secret_key
# COS_BUCKET=your_bucket
# COS_REGION=your_region
EOF

echo -e "${YELLOW}⚠️  请编辑 /var/www/demo/server/.env 配置演示数据库连接${NC}"
echo -e "${GREEN}✓ 环境配置文件已创建${NC}"

# ============================================
# 步骤 4: 安装依赖
# ============================================
echo -e "${YELLOW}[4/7] 安装依赖...${NC}"
cd /var/www/demo/server
npm install --production
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# ============================================
# 步骤 5: 配置 Nginx
# ============================================
echo -e "${YELLOW}[5/7] 配置 Nginx...${NC}"

# 检查是否已有演示 API 配置
if ! grep -q "demo-api.xianfeng-eu.com" /etc/nginx/conf.d/*.conf 2>/dev/null; then
    # 添加演示 API 配置
    cat >> /etc/nginx/conf.d/api.conf << 'NGINXEOF'

# ============================================
# 演示环境 API - demo-api.xianfeng-eu.com
# ============================================
server {
    listen 80;
    server_name demo-api.xianfeng-eu.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name demo-api.xianfeng-eu.com;

    ssl_certificate /etc/nginx/ssl/demo-api.xianfeng-eu.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/demo-api.xianfeng-eu.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    access_log /var/log/nginx/demo-api-access.log;
    error_log /var/log/nginx/demo-api-error.log;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 86400s;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/demo/server/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        autoindex off;
    }

    location /health {
        proxy_pass http://127.0.0.1:3002/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINXEOF
    echo -e "${GREEN}✓ Nginx 配置已添加${NC}"
else
    echo -e "${GREEN}✓ Nginx 配置已存在${NC}"
fi

# ============================================
# 步骤 6: 申请 SSL 证书
# ============================================
echo -e "${YELLOW}[6/7] 配置 SSL 证书...${NC}"

if [ ! -f "/etc/nginx/ssl/demo-api.xianfeng-eu.com/fullchain.pem" ]; then
    echo "尝试申请 Let's Encrypt 证书..."
    
    # 先用自签名证书启动（避免 Nginx 启动失败）
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/demo-api.xianfeng-eu.com/privkey.pem \
        -out /etc/nginx/ssl/demo-api.xianfeng-eu.com/fullchain.pem \
        -subj "/CN=demo-api.xianfeng-eu.com" 2>/dev/null
    
    echo -e "${YELLOW}⚠️  已创建临时自签名证书${NC}"
    echo -e "${YELLOW}   请稍后使用 certbot 申请正式证书:${NC}"
    echo -e "${YELLOW}   certbot certonly --nginx -d demo-api.xianfeng-eu.com${NC}"
else
    echo -e "${GREEN}✓ SSL 证书已存在${NC}"
fi

# 测试并重载 Nginx
nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx 已重载${NC}"

# ============================================
# 步骤 7: 启动演示后端服务
# ============================================
echo -e "${YELLOW}[7/7] 启动演示后端服务...${NC}"

cd /var/www/demo/server
pm2 delete sysafari-demo 2>/dev/null || true
pm2 start app.js --name sysafari-demo --max-memory-restart 400M
pm2 save

echo -e "${GREEN}✓ 演示后端服务已启动${NC}"

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  演示后端部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "后续步骤:"
echo "1. 在阿里云 DNS 添加解析: demo-api.xianfeng-eu.com -> 47.242.24.255"
echo "2. 编辑 /var/www/demo/server/.env 配置演示数据库"
echo "3. 重启服务: pm2 restart sysafari-demo"
echo "4. 申请正式 SSL 证书: certbot certonly --nginx -d demo-api.xianfeng-eu.com"
echo ""
echo "验证服务:"
echo "  pm2 status"
echo "  pm2 logs sysafari-demo"
echo "  curl http://localhost:3002/api/health"
echo ""

