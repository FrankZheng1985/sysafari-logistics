#!/bin/bash

# ASL 前端代码部署脚本
# 使用方法: ./deploy.sh [目标目录]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 目标部署目录
TARGET_DIR=${1:-/var/www/sysafari-logistics}

echo -e "${GREEN}开始部署 ASL 前端代码...${NC}"

# 检查当前目录
if [ ! -f "umi.js" ]; then
    echo -e "${RED}错误: 未找到 umi.js 文件，请确保在正确的目录下运行此脚本${NC}"
    exit 1
fi

# 创建目标目录
echo -e "${YELLOW}创建目标目录: ${TARGET_DIR}${NC}"
sudo mkdir -p "$TARGET_DIR"

# 复制所有文件
echo -e "${YELLOW}复制文件到目标目录...${NC}"
sudo cp -r . "$TARGET_DIR/"

# 设置文件权限
echo -e "${YELLOW}设置文件权限...${NC}"
sudo chown -R www-data:www-data "$TARGET_DIR" 2>/dev/null || sudo chown -R nginx:nginx "$TARGET_DIR" 2>/dev/null || echo "警告: 无法设置文件所有者，请手动设置"

# 确保 index.html 存在
if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo -e "${YELLOW}创建 index.html...${NC}"
    cat > /tmp/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#000000" />
    <title>Sysafari Logistics - ASL</title>
    <link rel="stylesheet" href="/umi.css" />
    <script>
        window.routerBase = "/";
        window.publicPath = "/";
    </script>
</head>
<body>
    <div id="root"></div>
    <script src="/umi.js"></script>
</body>
</html>
EOF
    sudo mv /tmp/index.html "$TARGET_DIR/index.html"
fi

echo -e "${GREEN}部署完成！${NC}"
echo -e "${YELLOW}下一步:${NC}"
echo "1. 配置 Nginx（参考 nginx.conf.example）"
echo "2. 重启 Nginx: sudo systemctl restart nginx"
echo "3. 访问应用检查是否正常"

