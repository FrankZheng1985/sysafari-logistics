#!/bin/bash
# ============================================
# 阿里云 OSS 演示环境前端部署脚本
# Sysafari Logistics 演示环境
# ============================================

set -e

echo "============================================"
echo "  阿里云 OSS 演示环境前端部署脚本"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量（演示环境）
PROJECT_DIR="/Users/fengzheng/sysafari-logistics"
OSS_BUCKET="sysafari-logistics-demo"
OSS_ENDPOINT="oss-cn-hongkong.aliyuncs.com"
CDN_DOMAIN="demo.xianfeng-eu.com"
API_URL="https://demo-api.xianfeng-eu.com"

cd ${PROJECT_DIR}

echo -e "${BLUE}环境信息:${NC}"
echo "  Bucket: ${OSS_BUCKET}"
echo "  域名: ${CDN_DOMAIN}"
echo "  API: ${API_URL}"
echo ""

echo -e "${YELLOW}[1/5] 检查 ossutil 工具...${NC}"
if ! command -v ossutil &> /dev/null; then
    echo -e "${RED}错误: ossutil 未安装${NC}"
    echo ""
    echo "请先安装 ossutil:"
    echo "  macOS: brew install aliyun-cli"
    echo "  或下载: https://help.aliyun.com/document_detail/120075.html"
    echo ""
    echo "安装后配置:"
    echo "  ossutil config -e ${OSS_ENDPOINT} -i <AccessKeyID> -k <AccessKeySecret>"
    exit 1
fi
echo -e "${GREEN}✓ ossutil 已安装${NC}"

echo -e "${YELLOW}[2/5] 设置演示环境 API 地址...${NC}"
export VITE_API_BASE_URL="${API_URL}"
echo -e "${GREEN}✓ API 地址: ${VITE_API_BASE_URL}${NC}"

echo -e "${YELLOW}[3/5] 构建前端项目...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}错误: 构建失败，dist 目录不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建完成，dist 目录大小: $(du -sh dist | cut -f1)${NC}"

echo -e "${YELLOW}[4/5] 上传到 OSS (${OSS_BUCKET})...${NC}"

# 上传静态资源（长期缓存）
echo "  上传 assets 目录..."
ossutil cp -r dist/assets/ oss://${OSS_BUCKET}/assets/ \
    --update \
    --acl public-read \
    --meta "Cache-Control:public, max-age=31536000, immutable"

# 上传其他静态文件
echo "  上传其他静态文件..."
shopt -s nullglob 2>/dev/null || true
for file in dist/*.js dist/*.css dist/*.ico dist/*.svg dist/*.png dist/*.jpg dist/*.jpeg dist/*.gif dist/*.woff dist/*.woff2 dist/*.ttf dist/*.eot; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        ossutil cp "$file" oss://${OSS_BUCKET}/${filename} \
            --acl public-read \
            --meta "Cache-Control:public, max-age=31536000, immutable" \
            2>/dev/null || true
    fi
done
shopt -u nullglob 2>/dev/null || true

# 单独处理 index.html（不缓存）
echo "  上传 index.html（无缓存）..."
ossutil cp dist/index.html oss://${OSS_BUCKET}/index.html \
    --acl public-read \
    --meta "Cache-Control:no-cache, no-store, must-revalidate"

echo -e "${GREEN}✓ OSS 上传完成${NC}"

echo -e "${YELLOW}[5/5] 刷新 CDN 缓存...${NC}"
# 如果已安装 aliyun CLI，可以刷新 CDN 缓存
if command -v aliyun &> /dev/null; then
    echo "  刷新 CDN 目录缓存..."
    aliyun cdn RefreshObjectCaches \
        --ObjectPath "https://${CDN_DOMAIN}/" \
        --ObjectType Directory \
        2>/dev/null && echo -e "${GREEN}✓ CDN 缓存已刷新${NC}" || echo -e "${YELLOW}⚠ CDN 刷新跳过（请手动刷新）${NC}"
else
    echo -e "${YELLOW}⚠ 提示: 请在阿里云控制台手动刷新 CDN 缓存${NC}"
    echo "  路径: CDN 控制台 → 刷新预热 → URL 刷新"
    echo "  URL:  https://${CDN_DOMAIN}/"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  演示环境前端部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "访问地址:"
echo "  OSS 直连: https://${OSS_BUCKET}.${OSS_ENDPOINT}"
echo "  CDN 加速: https://${CDN_DOMAIN}"
echo ""
echo "验证命令:"
echo "  curl -I https://${CDN_DOMAIN}"
echo ""

