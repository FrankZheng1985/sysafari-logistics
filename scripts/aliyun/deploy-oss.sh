#!/bin/bash
# ============================================
# 阿里云 OSS 前端部署脚本
# Sysafari Logistics 前端 (支持生产/演示双环境)
# ============================================
# 用法:
#   ./deploy-oss.sh          # 部署生产环境
#   ./deploy-oss.sh prod     # 部署生产环境
#   ./deploy-oss.sh demo     # 部署演示环境
#   ./deploy-oss.sh all      # 部署全部环境
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 基础配置
PROJECT_DIR="/Users/fengzheng/sysafari-logistics"
OSS_ENDPOINT="oss-cn-shenzhen.aliyuncs.com"  # OSS Bucket 实际在深圳区域

# 环境配置 (兼容 bash 3.x)
# 生产环境
PROD_BUCKET="sysafari-logistics"
PROD_DOMAIN="erp.xianfeng-eu.com"
PROD_API="https://api.xianfeng-eu.com"
# 演示环境
DEMO_BUCKET="sysafari-logistics-demo"
DEMO_DOMAIN="demo.xianfeng-eu.com"
DEMO_API="https://demo-api.xianfeng-eu.com"

# 获取部署环境
ENV="${1:-prod}"

# 显示帮助
show_help() {
    echo "用法: $0 [环境]"
    echo ""
    echo "环境:"
    echo "  prod    部署生产环境 (默认)"
    echo "  demo    部署演示环境"
    echo "  all     部署全部环境"
    echo ""
    echo "示例:"
    echo "  $0           # 部署生产环境"
    echo "  $0 demo      # 部署演示环境"
    echo "  $0 all       # 部署全部环境"
}

# 部署函数
deploy_env() {
    local env=$1
    local bucket=""
    local domain=""
    local api=""
    
    # 根据环境设置变量
    if [ "$env" = "prod" ]; then
        bucket="$PROD_BUCKET"
        domain="$PROD_DOMAIN"
        api="$PROD_API"
    elif [ "$env" = "demo" ]; then
        bucket="$DEMO_BUCKET"
        domain="$DEMO_DOMAIN"
        api="$DEMO_API"
    fi
    
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  部署 ${env} 环境${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo "  Bucket: ${bucket}"
    echo "  域名: ${domain}"
    echo "  API: ${api}"
    echo ""
    
    cd ${PROJECT_DIR}
    
    echo -e "${YELLOW}[1/4] 设置环境变量...${NC}"
    export VITE_API_BASE_URL="${api}"
    echo -e "${GREEN}✓ API 地址: ${VITE_API_BASE_URL}${NC}"
    
    echo -e "${YELLOW}[2/4] 构建前端项目...${NC}"
    npm run build
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}错误: 构建失败，dist 目录不存在${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ 构建完成，dist 目录大小: $(du -sh dist | cut -f1)${NC}"
    
    echo -e "${YELLOW}[3/4] 上传到 OSS (${bucket})...${NC}"
    
    # 上传静态资源（长期缓存）
    ossutil cp -r dist/assets/ oss://${bucket}/assets/ \
        --update \
        --acl public-read \
        --meta "Cache-Control:public, max-age=31536000, immutable"
    
    # 上传其他文件
    for file in dist/*.js dist/*.css dist/*.ico dist/*.svg dist/*.png dist/*.jpg dist/*.jpeg dist/*.gif; do
        if [ -f "$file" ] 2>/dev/null; then
            filename=$(basename "$file")
            ossutil cp "$file" "oss://${bucket}/${filename}" \
                --acl public-read \
                --meta "Cache-Control:public, max-age=31536000, immutable" \
                2>/dev/null || true
        fi
    done
    
    # 单独处理 index.html（不缓存）
    ossutil cp dist/index.html oss://${bucket}/index.html \
        --acl public-read \
        --meta "Cache-Control:no-cache, no-store, must-revalidate"
    
    echo -e "${GREEN}✓ OSS 上传完成${NC}"
    
    echo -e "${YELLOW}[4/4] 刷新 CDN 缓存...${NC}"
    if command -v aliyun &> /dev/null; then
        aliyun cdn RefreshObjectCaches \
            --ObjectPath "https://${domain}/" \
            --ObjectType Directory \
            2>/dev/null && echo -e "${GREEN}✓ CDN 缓存已刷新${NC}" || echo -e "${YELLOW}⚠ CDN 刷新跳过${NC}"
    else
        echo -e "${YELLOW}⚠ 提示: 请在阿里云控制台手动刷新 CDN 缓存${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✓ ${env} 环境部署完成！${NC}"
    echo "  访问: https://${domain}"
}

# 主逻辑
echo "============================================"
echo "  阿里云 OSS 前端部署脚本"
echo "============================================"

# 检查 ossutil
echo -e "${YELLOW}检查 ossutil 工具...${NC}"
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

case "$ENV" in
    prod)
        deploy_env "prod"
        ;;
    demo)
        deploy_env "demo"
        ;;
    all)
        deploy_env "prod"
        deploy_env "demo"
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知环境 '${ENV}'${NC}"
        show_help
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "访问地址:"
if [ "$ENV" = "prod" ] || [ "$ENV" = "all" ]; then
    echo "  生产环境: https://erp.xianfeng-eu.com"
fi
if [ "$ENV" = "demo" ] || [ "$ENV" = "all" ]; then
    echo "  演示环境: https://demo.xianfeng-eu.com"
fi
echo ""
