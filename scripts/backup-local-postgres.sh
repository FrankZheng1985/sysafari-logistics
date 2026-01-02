#!/bin/bash
# ===========================================
# 本地 PostgreSQL 自动备份脚本
# 用于开发环境数据库备份
# ===========================================

# 配置
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/sysafari-logistics-backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="sysafari_dev"

# PostgreSQL 工具路径
PG_DUMP="/opt/homebrew/opt/postgresql@16/bin/pg_dump"
PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"

# 从环境变量获取数据库连接（或使用默认值）
DB_URL="${DATABASE_URL_TEST:-postgresql://localhost:5432/${DB_NAME}}"

# 日志文件
LOG_FILE="$BACKUP_DIR/local_backup.log"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 记录开始
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 开始备份（本地 PostgreSQL） ==========" >> "$LOG_FILE"

# 检查 PostgreSQL 连接
if ! $PSQL "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 错误: 无法连接到数据库 $DB_URL" >> "$LOG_FILE"
  exit 1
fi

# 执行备份
BACKUP_FILE="$BACKUP_DIR/local_backup_${DATE}.sql.gz"

$PG_DUMP "$DB_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --verbose \
  2>> "$LOG_FILE" \
  | gzip > "$BACKUP_FILE"

# 检查备份是否成功
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份成功: $(basename $BACKUP_FILE) ($BACKUP_SIZE)" >> "$LOG_FILE"
  
  # 验证备份完整性
  if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 完整性检查通过" >> "$LOG_FILE"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 警告: 完整性检查失败" >> "$LOG_FILE"
  fi
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 备份失败" >> "$LOG_FILE"
  exit 1
fi

# 清理旧备份（保留最近 30 天）
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "local_backup_*.sql.gz" -mtime +30 2>/dev/null)
if [ -n "$OLD_BACKUPS" ]; then
  echo "$OLD_BACKUPS" | xargs rm -f
  DELETED_COUNT=$(echo "$OLD_BACKUPS" | wc -l | tr -d ' ')
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗑️  清理 $DELETED_COUNT 个旧备份文件" >> "$LOG_FILE"
fi

# 统计当前备份数量
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "local_backup_*.sql.gz" 2>/dev/null | wc -l | tr -d ' ')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 当前备份数量: $BACKUP_COUNT 个" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 备份完成 ==========\n" >> "$LOG_FILE"

exit 0

