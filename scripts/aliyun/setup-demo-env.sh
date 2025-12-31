#!/bin/bash
# ============================================
# 演示环境部署脚本
# 在阿里云 ECS 上执行，设置独立的演示环境
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Sysafari Logistics 演示环境部署${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 权限运行此脚本${NC}"
    exit 1
fi

# ============================================
# 步骤 1: 创建目录结构
# ============================================
echo -e "${YELLOW}[1/6] 创建目录结构...${NC}"
mkdir -p /var/www/demo/server
mkdir -p /var/www/demo/dist
mkdir -p /var/log/pm2
echo -e "${GREEN}✓ 目录创建完成${NC}"

# ============================================
# 步骤 2: 部署演示后端代码
# ============================================
echo -e "${YELLOW}[2/6] 部署演示后端代码...${NC}"
echo "请确保已将 server 目录代码复制到 /var/www/demo/server"
echo ""
echo "可以使用以下命令同步代码："
echo "  rsync -avz --exclude 'node_modules' server/ root@ECS_IP:/var/www/demo/server/"
echo ""

# ============================================
# 步骤 3: 配置演示环境变量
# ============================================
echo -e "${YELLOW}[3/6] 创建演示环境配置...${NC}"

if [ ! -f /var/www/demo/server/.env ]; then
    cat > /var/www/demo/server/.env << 'EOF'
# ============================================
# 演示环境配置
# ============================================
NODE_ENV=production
PORT=3002

# 演示数据库连接（请修改为实际的演示数据库信息）
DATABASE_URL=postgresql://demo_user:demo_password@localhost:5432/sysafari_demo

# JWT 密钥（建议与生产环境不同）
JWT_SECRET=demo-jwt-secret-change-me

# 其他配置
UPLOAD_DIR=/var/www/demo/server/uploads
EOF
    echo -e "${GREEN}✓ 演示环境配置文件已创建${NC}"
    echo -e "${YELLOW}⚠ 请编辑 /var/www/demo/server/.env 配置正确的数据库连接${NC}"
else
    echo -e "${GREEN}✓ 演示环境配置文件已存在${NC}"
fi

# ============================================
# 步骤 4: 安装依赖
# ============================================
echo -e "${YELLOW}[4/6] 安装依赖...${NC}"
cd /var/www/demo/server
if [ -f package.json ]; then
    npm install --production
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 package.json，请先复制后端代码${NC}"
fi

# ============================================
# 步骤 5: 配置 PM2
# ============================================
echo -e "${YELLOW}[5/6] 配置 PM2 进程管理...${NC}"

# 检查 PM2 是否已安装
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 启动演示环境服务
if [ -f /var/www/demo/server/app.js ]; then
    pm2 delete sysafari-demo 2>/dev/null || true
    cd /var/www/demo/server
    pm2 start app.js --name sysafari-demo \
        --max-memory-restart 400M \
        --log /var/log/pm2/sysafari-demo.log \
        --time
    pm2 save
    echo -e "${GREEN}✓ PM2 进程已启动${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 app.js，请先复制后端代码${NC}"
fi

# ============================================
# 步骤 6: 配置 SSL 证书
# ============================================
echo -e "${YELLOW}[6/6] SSL 证书配置提示...${NC}"
echo ""
echo "请在阿里云控制台申请 SSL 证书并配置："
echo ""
echo "1. 申请 SSL 证书（免费证书）："
echo "   域名: demo-api.xianfeng-eu.com"
echo ""
echo "2. 下载证书（Nginx 格式）并放置到："
echo "   /etc/nginx/ssl/demo-api.xianfeng-eu.com/fullchain.pem"
echo "   /etc/nginx/ssl/demo-api.xianfeng-eu.com/privkey.pem"
echo ""
echo "3. 或使用 Let's Encrypt 自动申请："
echo "   certbot certonly --nginx -d demo-api.xianfeng-eu.com"
echo ""

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  演示环境部署脚本执行完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "后续步骤："
echo "1. 配置演示数据库（PostgreSQL）"
echo "2. 编辑 /var/www/demo/server/.env 设置数据库连接"
echo "3. 配置 SSL 证书"
echo "4. 更新 Nginx 配置并重载"
echo "5. 在阿里云 DNS 添加 demo-api.xianfeng-eu.com 解析"
echo ""
echo "验证服务状态："
echo "  pm2 status"
echo "  pm2 logs sysafari-demo"
echo ""

