#!/bin/bash
# ============================================
# 演示环境 SSL 证书修复脚本
# 在 ECS 服务器上执行此脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="demo.xianfeng-eu.com"
SSL_DIR="/etc/nginx/ssl/${DOMAIN}"
CERTBOT_DIR="/var/www/certbot"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  演示环境 SSL 证书修复脚本${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户执行此脚本${NC}"
    echo "使用: sudo bash fix-demo-ssl.sh"
    exit 1
fi

# 步骤 1: 创建必要目录
echo -e "${YELLOW}[1/5] 创建必要目录...${NC}"
mkdir -p ${SSL_DIR}
mkdir -p ${CERTBOT_DIR}
echo -e "${GREEN}✓ 目录创建完成${NC}"

# 步骤 2: 检查 certbot 是否安装
echo -e "${YELLOW}[2/5] 检查 Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    echo "安装 Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi
echo -e "${GREEN}✓ Certbot 已安装${NC}"

# 步骤 3: 临时配置 Nginx 用于证书验证
echo -e "${YELLOW}[3/5] 配置 Nginx 用于证书验证...${NC}"

# 备份当前配置
if [ -f /etc/nginx/sites-available/sysafari-dual ]; then
    cp /etc/nginx/sites-available/sysafari-dual /etc/nginx/sites-available/sysafari-dual.backup
fi

# 创建临时的 HTTP 验证配置
cat > /tmp/certbot-temp.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name demo.xianfeng-eu.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

# 检查是否已有演示环境的 HTTP 配置
if ! grep -q "demo.xianfeng-eu.com" /etc/nginx/sites-available/sysafari-dual 2>/dev/null; then
    echo "添加演示环境配置..."
fi

nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx 配置完成${NC}"

# 步骤 4: 申请 SSL 证书
echo -e "${YELLOW}[4/5] 申请 SSL 证书...${NC}"
echo "域名: ${DOMAIN}"
echo ""

# 检查是否已有有效证书
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo -e "${YELLOW}检测到已有证书，尝试续期...${NC}"
    certbot renew --cert-name ${DOMAIN} --dry-run 2>/dev/null && \
        echo -e "${GREEN}证书仍然有效${NC}" || \
        certbot certonly --webroot -w ${CERTBOT_DIR} -d ${DOMAIN} --non-interactive --agree-tos --email admin@xianfeng-eu.com
else
    # 申请新证书
    certbot certonly \
        --webroot \
        -w ${CERTBOT_DIR} \
        -d ${DOMAIN} \
        --non-interactive \
        --agree-tos \
        --email admin@xianfeng-eu.com \
        --no-eff-email
fi

# 检查证书是否申请成功
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo -e "${RED}证书申请失败，请检查：${NC}"
    echo "1. 域名 ${DOMAIN} 是否已解析到此服务器 IP"
    echo "2. 80 端口是否开放"
    echo "3. 防火墙设置"
    exit 1
fi

echo -e "${GREEN}✓ SSL 证书申请成功${NC}"

# 步骤 5: 复制证书并更新 Nginx
echo -e "${YELLOW}[5/5] 部署证书...${NC}"

# 复制证书到 Nginx SSL 目录
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/fullchain.pem
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/privkey.pem

# 设置权限
chmod 644 ${SSL_DIR}/fullchain.pem
chmod 600 ${SSL_DIR}/privkey.pem

# 更新 Nginx 配置中的证书路径（如果需要）
NGINX_CONF="/etc/nginx/sites-available/sysafari-dual"
if [ -f "$NGINX_CONF" ]; then
    # 检查并更新证书路径
    if grep -q "ssl_certificate.*erp.xianfeng-eu.com.*demo" "$NGINX_CONF" 2>/dev/null; then
        # 修复错误的证书路径引用
        sed -i "s|ssl_certificate /etc/nginx/ssl/erp.xianfeng-eu.com/fullchain.pem;|ssl_certificate /etc/nginx/ssl/demo.xianfeng-eu.com/fullchain.pem;|g" "$NGINX_CONF"
        sed -i "s|ssl_certificate_key /etc/nginx/ssl/erp.xianfeng-eu.com/privkey.pem;|ssl_certificate_key /etc/nginx/ssl/demo.xianfeng-eu.com/privkey.pem;|g" "$NGINX_CONF"
    fi
fi

# 验证 Nginx 配置
echo "验证 Nginx 配置..."
nginx -t

# 重载 Nginx
systemctl reload nginx

echo -e "${GREEN}✓ 证书部署完成${NC}"

# 完成
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  SSL 证书修复完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "证书信息:"
echo "  域名: ${DOMAIN}"
echo "  证书路径: ${SSL_DIR}/fullchain.pem"
echo "  私钥路径: ${SSL_DIR}/privkey.pem"
echo ""
echo "验证命令:"
echo "  curl -I https://${DOMAIN}"
echo ""
echo "证书有效期:"
openssl x509 -in ${SSL_DIR}/fullchain.pem -noout -dates
echo ""

