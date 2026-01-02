#!/bin/bash
# ===========================================
# 临时文件自动清理脚本
# 清理 uploads/ 目录下的临时文件
# ===========================================

# 配置
UPLOADS_DIR="/Users/fengzheng/sysafari-logistics/server/uploads"
ARCHIVE_DIR="$UPLOADS_DIR/archived"
LOG_FILE="$UPLOADS_DIR/cleanup.log"

# 清理超过 30 天的归档文件
DAYS_TO_KEEP=30

# 记录开始
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 开始清理临时文件 ==========" >> "$LOG_FILE"

# 创建归档目录
mkdir -p "$ARCHIVE_DIR"

# 1. 移动孤立的临时文件（file-* 格式）到归档目录
TEMP_FILES=$(find "$UPLOADS_DIR" -maxdepth 1 -name "file-*" -type f 2>/dev/null)
if [ -n "$TEMP_FILES" ]; then
  TEMP_COUNT=$(echo "$TEMP_FILES" | wc -l | tr -d ' ')
  mv $TEMP_FILES "$ARCHIVE_DIR/" 2>/dev/null
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 移动 $TEMP_COUNT 个临时文件到归档目录" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 没有发现临时文件" >> "$LOG_FILE"
fi

# 2. 删除归档目录中超过 30 天的文件
OLD_FILES=$(find "$ARCHIVE_DIR" -type f -mtime +$DAYS_TO_KEEP 2>/dev/null)
if [ -n "$OLD_FILES" ]; then
  OLD_COUNT=$(echo "$OLD_FILES" | wc -l | tr -d ' ')
  echo "$OLD_FILES" | xargs rm -f
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗑️  删除 $OLD_COUNT 个超过 ${DAYS_TO_KEEP} 天的文件" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 没有需要删除的旧文件" >> "$LOG_FILE"
fi

# 3. 统计当前文件数量和大小
ARCHIVED_COUNT=$(find "$ARCHIVE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
ARCHIVED_SIZE=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 归档目录状态: $ARCHIVED_COUNT 个文件, $ARCHIVED_SIZE" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 清理完成 ==========\n" >> "$LOG_FILE"

exit 0

