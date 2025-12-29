#!/bin/bash
# ============================================
# 数据库备份与迁移脚本
# 阿里云 RDS PostgreSQL 数据库备份工具
# ============================================

set -e

echo "============================================"
echo "  阿里云 RDS 数据库备份脚本"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置变量（使用前请设置环境变量）
# export SOURCE_DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名?sslmode=require"
# export TARGET_DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名?sslmode=require"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rds_backup_${TIMESTAMP}.sql"

# 检查环境变量
if [ -z "$SOURCE_DATABASE_URL" ]; then
    echo -e "${RED}错误: 请设置 SOURCE_DATABASE_URL 环境变量（源数据库）${NC}"
    echo ""
    echo "阿里云 RDS 示例:"
    echo '  export SOURCE_DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名?sslmode=require"'
    exit 1
fi

if [ -z "$TARGET_DATABASE_URL" ]; then
    echo -e "${RED}错误: 请设置 TARGET_DATABASE_URL 环境变量（目标数据库）${NC}"
    echo ""
    echo "阿里云 RDS 示例:"
    echo '  export TARGET_DATABASE_URL="postgresql://用户名:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/数据库名?sslmode=require"'
    exit 1
fi

# 创建备份目录
mkdir -p ${BACKUP_DIR}

echo ""
echo -e "${YELLOW}[1/5] 测试源数据库连接...${NC}"
psql "$SOURCE_DATABASE_URL" -c "SELECT current_database(), NOW();" || {
    echo -e "${RED}源数据库连接失败${NC}"
    exit 1
}
echo -e "${GREEN}源数据库连接成功${NC}"

echo ""
echo -e "${YELLOW}[2/5] 测试目标数据库连接 (阿里云 RDS)...${NC}"
psql "$TARGET_DATABASE_URL" -c "SELECT current_database(), NOW();" || {
    echo -e "${RED}目标数据库连接失败${NC}"
    exit 1
}
echo -e "${GREEN}目标数据库连接成功${NC}"

echo ""
echo -e "${YELLOW}[3/5] 备份源数据库...${NC}"
echo "备份文件: ${BACKUP_FILE}"
pg_dump "$SOURCE_DATABASE_URL" \
    --no-owner \
    --no-acl \
    --no-comments \
    --format=plain \
    > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo -e "${GREEN}备份完成，文件大小: ${BACKUP_SIZE}${NC}"

echo ""
echo -e "${YELLOW}[4/5] 统计源数据库记录数...${NC}"
echo "主要数据表记录数:"
for table in users customers bills_of_lading invoices shipping_companies; do
    count=$(psql "$SOURCE_DATABASE_URL" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "N/A")
    echo "  ${table}: ${count}"
done

echo ""
echo -e "${YELLOW}[5/5] 准备导入到目标数据库...${NC}"
echo ""
echo -e "${RED}⚠️  警告: 即将向阿里云 RDS 导入数据！${NC}"
echo -e "${RED}   这将覆盖目标数据库中的现有数据！${NC}"
echo ""
read -p "确认继续导入？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    echo ""
    echo "备份文件已保存在: ${BACKUP_FILE}"
    echo "你可以稍后手动导入:"
    echo "  psql \"\$TARGET_DATABASE_URL\" < ${BACKUP_FILE}"
    exit 0
fi

echo ""
echo -e "${YELLOW}正在导入数据到阿里云 RDS...${NC}"
psql "$TARGET_DATABASE_URL" < "${BACKUP_FILE}"

echo ""
echo -e "${YELLOW}验证导入结果...${NC}"
echo "目标数据库记录数:"
for table in users customers bills_of_lading invoices shipping_companies; do
    count=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "N/A")
    echo "  ${table}: ${count}"
done

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  数据库迁移完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "备份文件: ${BACKUP_FILE}"
echo ""
echo "下一步操作:"
echo "1. 验证数据完整性"
echo "2. 更新后端 .env 文件中的 DATABASE_URL"
echo "3. 重启后端服务"
echo ""

