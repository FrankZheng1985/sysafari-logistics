#!/bin/bash
# ============================================
# 阿里云 OSS SPA 路由配置脚本
# 配置静态网站托管，支持 React Router 等前端路由
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROD_BUCKET="sysafari-logistics"
DEMO_BUCKET="sysafari-logistics-demo"
OSS_ENDPOINT="oss-cn-shenzhen.aliyuncs.com"  # OSS Bucket 实际在深圳区域

echo "============================================"
echo "  阿里云 OSS SPA 路由配置"
echo "============================================"
echo ""

# 检查 aliyun CLI
if ! command -v aliyun &> /dev/null; then
    echo -e "${RED}错误: aliyun CLI 未安装${NC}"
    echo ""
    echo "请先安装阿里云 CLI:"
    echo "  macOS: brew install aliyun-cli"
    echo "  或访问: https://help.aliyun.com/document_detail/121541.html"
    echo ""
    echo "安装后配置:"
    echo "  aliyun configure"
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  手动配置方法（推荐）${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    echo "1. 登录阿里云 OSS 控制台:"
    echo "   https://oss.console.aliyun.com/"
    echo ""
    echo "2. 选择 Bucket: ${PROD_BUCKET}"
    echo ""
    echo "3. 进入: 数据管理 → 静态网站托管"
    echo ""
    echo "4. 配置:"
    echo "   - 默认首页: index.html"
    echo "   - 默认 404 页: index.html"
    echo "   - 子目录首页: 关闭"
    echo ""
    echo "5. 保存配置"
    echo ""
    echo "6. 对演示环境 Bucket (${DEMO_BUCKET}) 重复以上步骤"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ aliyun CLI 已安装${NC}"
echo ""

# 配置函数
configure_bucket() {
    local bucket=$1
    local env_name=$2
    
    echo -e "${BLUE}配置 ${env_name} 环境 (${bucket})...${NC}"
    
    # 使用 aliyun CLI 配置静态网站托管
    # 设置 index.html 为默认首页和 404 页面
    aliyun oss website put oss://${bucket} \
        --index-document index.html \
        --error-document index.html \
        --endpoint ${OSS_ENDPOINT}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${env_name} 环境配置成功${NC}"
    else
        echo -e "${RED}✗ ${env_name} 环境配置失败${NC}"
        return 1
    fi
    
    # 验证配置
    echo "验证配置..."
    aliyun oss website get oss://${bucket} --endpoint ${OSS_ENDPOINT}
    echo ""
}

# 配置生产环境
echo -e "${YELLOW}[1/2] 配置生产环境...${NC}"
configure_bucket "${PROD_BUCKET}" "生产"

# 配置演示环境
echo -e "${YELLOW}[2/2] 配置演示环境...${NC}"
configure_bucket "${DEMO_BUCKET}" "演示"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  配置完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "现在刷新页面应该不会再出现 404 错误了。"
echo ""
echo "测试方法:"
echo "  1. 访问 https://erp.xianfeng-eu.com/crm/customers"
echo "  2. 刷新页面，应该正常显示"
echo ""

