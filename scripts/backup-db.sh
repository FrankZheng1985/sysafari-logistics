#!/bin/bash
# 数据库自动备份脚本
# 每小时执行一次，备份到 iCloud，保留7天

# 配置
DB_PATH="/Users/fengzheng/sysafari-logistics/server/data/orders.db"
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/sysafari-logistics-backups"
LOG_FILE="/Users/fengzheng/sysafari-logistics/logs/backup.log"
RETENTION_DAYS=7

# 确保目录存在
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# 生成备份文件名（包含日期时间）
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/orders_backup_$TIMESTAMP.db"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "========== 开始备份 =========="

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    log "❌ 错误: 数据库文件不存在: $DB_PATH"
    exit 1
fi

# 执行备份
if sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"; then
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    log "✅ 备份成功: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log "❌ 备份失败"
    exit 1
fi

# 验证备份完整性
if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
    log "✅ 完整性检查通过"
else
    log "⚠️ 完整性检查警告"
fi

# 清理旧备份（保留最近7天）
DELETED_COUNT=0
find "$BACKUP_DIR" -name "orders_backup_*.db" -type f -mtime +$RETENTION_DAYS | while read file; do
    rm "$file"
    log "🗑️ 删除旧备份: $(basename "$file")"
    ((DELETED_COUNT++))
done

# 统计当前备份数量
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/orders_backup_*.db 2>/dev/null | wc -l | tr -d ' ')
log "📊 当前备份数量: $BACKUP_COUNT 个"
log "========== 备份完成 ==========\n"

exit 0
