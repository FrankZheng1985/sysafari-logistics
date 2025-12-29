#!/bin/bash
# ============================================
# 阿里云 ECS 服务器初始化脚本（双环境版）
# Sysafari Logistics 生产 + 演示环境部署
# ============================================

set -e

echo "============================================"
echo "  阿里云 ECS 双环境初始化脚本"
echo "  Sysafari Logistics 生产 + 演示环境"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量（请根据实际情况修改）
GITHUB_REPO="https://github.com/你的用户名/sysafari-logistics.git"
NODE_VERSION="18"
DOMAIN_PROD="erp.xianfeng-eu.com"
DOMAIN_DEMO="demo.xianfeng-eu.com"

# 目录配置
PROD_DIR="/var/www/prod"
DEMO_DIR="/var/www/demo"
LOG_DIR="/var/log/pm2"
SSL_DIR="/etc/nginx/ssl"
CERTBOT_DIR="/var/www/certbot"

# ============================================
# 函数定义
# ============================================

print_step() {
    echo -e "\n${YELLOW}[$1/$2] $3${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

# ============================================
# 系统初始化
# ============================================

print_step 1 12 "更新系统包..."
sudo apt update && sudo apt upgrade -y
print_success "系统更新完成"

print_step 2 12 "安装 Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}NPM 版本: $(npm -v)${NC}"

print_step 3 12 "安装 PM2 进程管理器..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo -e "${GREEN}PM2 版本: $(pm2 -v)${NC}"

print_step 4 12 "安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
fi
sudo systemctl enable nginx
sudo systemctl start nginx
print_success "Nginx 安装完成"

print_step 5 12 "安装 Certbot (SSL 证书)..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y certbot python3-certbot-nginx
fi
print_success "Certbot 安装完成"

print_step 6 12 "安装其他必要工具..."
sudo apt-get install -y git curl wget htop unzip
print_success "工具安装完成"

# ============================================
# 目录结构创建
# ============================================

print_step 7 12 "创建目录结构..."

# 创建应用目录
sudo mkdir -p ${PROD_DIR}
sudo mkdir -p ${DEMO_DIR}

# 创建日志目录
sudo mkdir -p ${LOG_DIR}

# 创建 SSL 证书目录
sudo mkdir -p ${SSL_DIR}/${DOMAIN_PROD}
sudo mkdir -p ${SSL_DIR}/${DOMAIN_DEMO}

# 创建 Certbot 验证目录
sudo mkdir -p ${CERTBOT_DIR}

# 设置权限
sudo chown -R $USER:$USER ${PROD_DIR}
sudo chown -R $USER:$USER ${DEMO_DIR}
sudo chown -R $USER:$USER ${LOG_DIR}

print_success "目录结构创建完成"
echo "  生产环境: ${PROD_DIR}"
echo "  演示环境: ${DEMO_DIR}"
echo "  PM2 日志: ${LOG_DIR}"

# ============================================
# 克隆代码
# ============================================

print_step 8 12 "克隆代码仓库..."

# 生产环境
if [ -d "${PROD_DIR}/.git" ]; then
    print_info "生产环境代码已存在，执行 git pull..."
    cd ${PROD_DIR}
    git pull origin main
else
    print_info "克隆生产环境代码..."
    git clone ${GITHUB_REPO} ${PROD_DIR}
fi

# 演示环境
if [ -d "${DEMO_DIR}/.git" ]; then
    print_info "演示环境代码已存在，执行 git pull..."
    cd ${DEMO_DIR}
    git pull origin main
else
    print_info "克隆演示环境代码..."
    git clone ${GITHUB_REPO} ${DEMO_DIR}
fi

print_success "代码克隆完成"

# ============================================
# 安装依赖
# ============================================

print_step 9 12 "安装后端依赖..."

# 生产环境
print_info "安装生产环境依赖..."
cd ${PROD_DIR}/server
npm install --production

# 演示环境
print_info "安装演示环境依赖..."
cd ${DEMO_DIR}/server
npm install --production

print_success "依赖安装完成"

# ============================================
# 复制 PM2 配置
# ============================================

print_step 10 12 "配置 PM2..."

# 复制 PM2 配置到服务器根目录
cp ${PROD_DIR}/scripts/aliyun/ecosystem.config.js /var/www/ecosystem.config.js

print_success "PM2 配置完成"

# ============================================
# 配置 Nginx
# ============================================

print_step 11 12 "配置 Nginx..."

# 复制 Nginx 配置
sudo cp ${PROD_DIR}/scripts/aliyun/nginx-dual-env.conf /etc/nginx/sites-available/sysafari-dual

# 创建符号链接
if [ -L "/etc/nginx/sites-enabled/sysafari-dual" ]; then
    sudo rm /etc/nginx/sites-enabled/sysafari-dual
fi
sudo ln -s /etc/nginx/sites-available/sysafari-dual /etc/nginx/sites-enabled/

# 移除默认配置
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

print_success "Nginx 配置完成"

# ============================================
# 完成提示
# ============================================

print_step 12 12 "初始化完成！"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ECS 双环境初始化完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}接下来请按顺序执行以下步骤：${NC}"
echo ""
echo -e "${BLUE}【步骤 1】配置环境变量${NC}"
echo ""
echo "  生产环境:"
echo "    nano ${PROD_DIR}/server/.env"
echo ""
echo "  演示环境:"
echo "    nano ${DEMO_DIR}/server/.env"
echo ""
echo -e "${BLUE}【步骤 2】环境变量内容示例${NC}"
echo ""
cat << 'EOF'
  # 生产环境 .env
  NODE_ENV=production
  PORT=3001
  DATABASE_URL=postgresql://用户名:密码@RDS内网地址:5432/sysafari_prod
  JWT_SECRET=你的JWT密钥_生产
  
  # 演示环境 .env
  NODE_ENV=production
  PORT=3002
  DATABASE_URL=postgresql://用户名:密码@RDS内网地址:5432/sysafari_demo
  JWT_SECRET=你的JWT密钥_演示
EOF
echo ""
echo -e "${BLUE}【步骤 3】申请 SSL 证书${NC}"
echo ""
echo "  # 先确保域名已解析到此服务器 IP"
echo "  # 然后执行以下命令申请证书"
echo ""
echo "  sudo certbot certonly --webroot -w ${CERTBOT_DIR} -d ${DOMAIN_PROD}"
echo "  sudo certbot certonly --webroot -w ${CERTBOT_DIR} -d ${DOMAIN_DEMO}"
echo ""
echo "  # 复制证书到 Nginx 目录"
echo "  sudo cp /etc/letsencrypt/live/${DOMAIN_PROD}/fullchain.pem ${SSL_DIR}/${DOMAIN_PROD}/"
echo "  sudo cp /etc/letsencrypt/live/${DOMAIN_PROD}/privkey.pem ${SSL_DIR}/${DOMAIN_PROD}/"
echo "  sudo cp /etc/letsencrypt/live/${DOMAIN_DEMO}/fullchain.pem ${SSL_DIR}/${DOMAIN_DEMO}/"
echo "  sudo cp /etc/letsencrypt/live/${DOMAIN_DEMO}/privkey.pem ${SSL_DIR}/${DOMAIN_DEMO}/"
echo ""
echo -e "${BLUE}【步骤 4】启动应用${NC}"
echo ""
echo "  cd /var/www"
echo "  pm2 start ecosystem.config.js"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo -e "${BLUE}【步骤 5】验证 Nginx 并重载${NC}"
echo ""
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"
echo ""
echo -e "${BLUE}【步骤 6】验证服务${NC}"
echo ""
echo "  # 检查 PM2 进程"
echo "  pm2 status"
echo ""
echo "  # 检查日志"
echo "  pm2 logs"
echo ""
echo "  # 测试 API"
echo "  curl http://localhost:3001/api/health"
echo "  curl http://localhost:3002/api/health"
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  祝部署顺利！${NC}"
echo -e "${GREEN}============================================${NC}"

