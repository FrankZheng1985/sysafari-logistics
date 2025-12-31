#!/bin/bash
# ============================================
# 阿里云 ECS 服务器初始化脚本
# Sysafari Logistics 后端部署
# ============================================

set -e

echo "============================================"
echo "  阿里云 ECS 服务器初始化脚本"
echo "  Sysafari Logistics 后端部署"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量（请根据实际情况修改）
APP_DIR="/var/www/sysafari-logistics"
GITHUB_REPO="https://github.com/你的用户名/sysafari-logistics.git"
NODE_VERSION="18"

echo -e "${YELLOW}[1/8] 更新系统包...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${YELLOW}[2/8] 安装 Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs
echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}NPM 版本: $(npm -v)${NC}"

echo -e "${YELLOW}[3/8] 安装 PM2 进程管理器...${NC}"
sudo npm install -g pm2
echo -e "${GREEN}PM2 版本: $(pm2 -v)${NC}"

echo -e "${YELLOW}[4/8] 安装 Nginx...${NC}"
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

echo -e "${YELLOW}[5/8] 安装 Git 和其他工具...${NC}"
sudo apt-get install -y git curl wget htop

echo -e "${YELLOW}[6/8] 创建应用目录...${NC}"
sudo mkdir -p ${APP_DIR}
sudo chown -R $USER:$USER ${APP_DIR}

echo -e "${YELLOW}[7/8] 克隆代码仓库...${NC}"
if [ -d "${APP_DIR}/.git" ]; then
    echo "代码已存在，执行 git pull..."
    cd ${APP_DIR}
    git pull origin main
else
    echo "克隆代码仓库..."
    git clone ${GITHUB_REPO} ${APP_DIR}
fi

echo -e "${YELLOW}[8/8] 安装后端依赖...${NC}"
cd ${APP_DIR}/server
npm install --production

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ECS 初始化完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "接下来请执行以下步骤："
echo ""
echo "1. 配置环境变量:"
echo "   cd ${APP_DIR}/server"
echo "   nano .env"
echo ""
echo "2. 添加以下内容到 .env 文件:"
echo "   NODE_ENV=production"
echo "   PORT=3001"
echo "   DATABASE_URL=postgresql://用户名:密码@RDS地址:5432/数据库名"
echo "   JWT_SECRET=你的JWT密钥"
echo ""
echo "3. 启动应用:"
echo "   pm2 start app.js --name sysafari-api"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "4. 配置 Nginx:"
echo "   sudo cp ${APP_DIR}/scripts/aliyun/nginx-api.conf /etc/nginx/sites-available/sysafari-api"
echo "   sudo ln -s /etc/nginx/sites-available/sysafari-api /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""

