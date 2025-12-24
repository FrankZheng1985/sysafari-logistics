# 数据库备份系统配置指南

## 概述

Sysafari Logistics 系统提供完整的数据库备份功能，支持：
- 定时自动备份
- 手动触发备份
- 备份文件上传到腾讯云 COS
- 从备份恢复数据

## 环境变量配置

在 `server/.env` 文件中添加以下配置：

### 腾讯云 COS 配置

```env
# 腾讯云 API 密钥
# 在 https://console.cloud.tencent.com/cam/capi 创建
TENCENT_COS_SECRET_ID=your_secret_id
TENCENT_COS_SECRET_KEY=your_secret_key

# 存储桶名称（格式：bucketname-appid）
# 例如：sysafari-backup-1234567890
TENCENT_COS_BUCKET=your_bucket_name

# 存储桶所在地域
# 常用地域：ap-guangzhou, ap-shanghai, ap-beijing, ap-hongkong
TENCENT_COS_REGION=ap-guangzhou

# 备份文件在 COS 中的存储路径前缀
TENCENT_COS_BACKUP_PATH=backups/database/
```

### 备份相关配置

```env
# 本地备份目录
BACKUP_DIR=./backups

# 备份保留天数
BACKUP_RETENTION_DAYS=30

# 最大备份份数
BACKUP_MAX_COUNT=30
```

## 腾讯云 COS 配置步骤

### 1. 创建存储桶

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/cos)
2. 点击「创建存储桶」
3. 填写存储桶名称（如：`sysafari-backup`）
4. 选择地域（建议选择离服务器近的地域）
5. 访问权限选择「私有读写」
6. 点击「确定」创建

### 2. 获取 API 密钥

1. 访问 [API密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 点击「新建密钥」或使用现有密钥
3. 复制 `SecretId` 和 `SecretKey`

### 3. 配置存储桶权限

确保 API 密钥对应的账号有以下权限：
- `cos:PutObject` - 上传文件
- `cos:GetObject` - 下载文件
- `cos:DeleteObject` - 删除文件
- `cos:GetBucket` - 列出文件

## 使用方式

### 命令行备份

```bash
# 执行完整备份
node server/scripts/backup-database.js

# 执行增量备份
node server/scripts/backup-database.js --type incremental

# 列出所有备份
node server/scripts/backup-database.js --list

# 清理过期备份
node server/scripts/backup-database.js --cleanup

# 备份但不上传到 COS
node server/scripts/backup-database.js --no-upload
```

### 命令行恢复

```bash
# 列出可恢复的备份
node server/scripts/restore-database.js --list

# 从备份记录恢复
node server/scripts/restore-database.js --id <backup_id>

# 从本地文件恢复
node server/scripts/restore-database.js --file ./backups/backup_xxx.sql.gz

# 恢复前不创建当前数据库备份
node server/scripts/restore-database.js --id <backup_id> --no-backup

# 跳过确认直接恢复（危险）
node server/scripts/restore-database.js --id <backup_id> --force
```

### Web 界面

1. 登录系统管理员账号
2. 进入「系统管理」→「安全管理中心」
3. 点击「数据备份」标签页
4. 可进行以下操作：
   - 查看备份列表
   - 配置自动备份设置
   - 手动触发备份
   - 下载备份文件
   - 恢复数据

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/security/backups` | GET | 获取备份列表 |
| `/api/security/backups` | POST | 触发备份 |
| `/api/security/backups/:id` | DELETE | 删除备份 |
| `/api/security/backups/:id/download` | GET | 获取下载链接 |
| `/api/security/backups/:id/restore` | POST | 恢复数据 |
| `/api/security/backup-settings` | GET | 获取备份设置 |
| `/api/security/backup-settings` | PUT | 更新备份设置 |
| `/api/security/restore-records` | GET | 获取恢复记录 |

## 安全注意事项

1. **API 密钥安全**
   - 不要将密钥提交到代码仓库
   - 定期轮换密钥
   - 使用子账号而非主账号密钥

2. **备份加密**
   - COS 支持服务端加密，建议开启
   - 可考虑在上传前对备份文件加密

3. **恢复操作**
   - 恢复会覆盖现有数据
   - 恢复前系统会自动创建当前数据备份
   - 建议在测试环境验证后再在生产环境操作

4. **访问控制**
   - 只有管理员可以访问备份功能
   - 所有操作都会记录审计日志

## 故障排除

### COS 上传失败

1. 检查 API 密钥是否正确
2. 确认存储桶名称格式正确（包含 APPID）
3. 检查网络连接
4. 查看服务器日志获取详细错误信息

### 备份文件过大

1. 考虑使用增量备份
2. 调整备份保留策略
3. 清理无用数据后再备份

### 恢复失败

1. 确认备份文件完整
2. 检查数据库连接配置
3. 确认有足够的磁盘空间
4. 查看恢复日志获取详细错误

## 数据库表结构

备份系统使用以下数据库表：

### backup_records - 备份记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| backup_name | TEXT | 备份名称 |
| backup_type | TEXT | 备份类型 (full/incremental) |
| backup_size | BIGINT | 文件大小（字节）|
| backup_path | TEXT | 本地路径 |
| backup_status | TEXT | 状态 (running/completed/failed) |
| cos_key | TEXT | COS 存储路径 |
| is_cloud_synced | INTEGER | 是否已同步到云端 |
| file_name | TEXT | 文件名 |
| description | TEXT | 描述 |
| restored_at | TIMESTAMP | 最后恢复时间 |
| restore_count | INTEGER | 恢复次数 |
| started_at | TIMESTAMP | 开始时间 |
| completed_at | TIMESTAMP | 完成时间 |
| error_message | TEXT | 错误信息 |
| created_by | TEXT | 创建者 |
| created_at | TIMESTAMP | 创建时间 |

### restore_records - 恢复记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| backup_id | INTEGER | 备份记录ID |
| backup_name | TEXT | 备份名称 |
| restore_type | TEXT | 恢复类型 |
| restore_status | TEXT | 状态 |
| started_at | TIMESTAMP | 开始时间 |
| completed_at | TIMESTAMP | 完成时间 |
| error_message | TEXT | 错误信息 |
| restored_by | TEXT | 操作者 |
| ip_address | TEXT | IP地址 |
| created_at | TIMESTAMP | 创建时间 |

