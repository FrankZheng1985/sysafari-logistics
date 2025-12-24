/**
 * 帮助视频模块 - 数据库模型
 * 管理系统帮助视频的存储和检索
 */

import { getDatabase } from '../../config/database.js'

/**
 * 初始化帮助视频表
 */
export async function initHelpVideoTable() {
  const db = getDatabase()
  try {
    // 使用 exec 执行 DDL 语句
    await db.exec(`
      CREATE TABLE IF NOT EXISTS help_videos (
        id SERIAL PRIMARY KEY,
        help_item_id VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        module VARCHAR(50) NOT NULL,
        video_key VARCHAR(500),
        video_url VARCHAR(1000),
        thumbnail_key VARCHAR(500),
        thumbnail_url VARCHAR(1000),
        duration INTEGER,
        file_size BIGINT,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 创建索引
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_help_videos_module ON help_videos(module)
    `)
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_help_videos_help_item_id ON help_videos(help_item_id)
    `)
    
    console.log('✅ help_videos 表初始化成功')
  } catch (error) {
    console.error('❌ 初始化 help_videos 表失败:', error)
    throw error
  }
}

/**
 * 创建或更新帮助视频记录
 */
export async function upsertHelpVideo(data) {
  const {
    helpItemId,
    title,
    module,
    videoKey,
    videoUrl,
    thumbnailKey,
    thumbnailUrl,
    duration,
    fileSize,
    description,
    createdBy
  } = data
  
  const db = getDatabase()
  
  // 先尝试查找现有记录
  const existing = await db.prepare(
    `SELECT * FROM help_videos WHERE help_item_id = ?`
  ).get(helpItemId)
  
  if (existing) {
    // 更新现有记录
    await db.prepare(`
      UPDATE help_videos SET
        title = ?,
        video_key = ?,
        video_url = ?,
        thumbnail_key = ?,
        thumbnail_url = ?,
        duration = ?,
        file_size = ?,
        description = ?,
        updated_at = NOW()
      WHERE help_item_id = ?
    `).run(title, videoKey, videoUrl, thumbnailKey, thumbnailUrl, duration, fileSize, description, helpItemId)
    
    return await db.prepare(`SELECT * FROM help_videos WHERE help_item_id = ?`).get(helpItemId)
  } else {
    // 插入新记录
    await db.prepare(`
      INSERT INTO help_videos (
        help_item_id, title, module, video_key, video_url, 
        thumbnail_key, thumbnail_url, duration, file_size, 
        description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(helpItemId, title, module, videoKey, videoUrl, thumbnailKey, thumbnailUrl, duration, fileSize, description, createdBy)
    
    return await db.prepare(`SELECT * FROM help_videos WHERE help_item_id = ?`).get(helpItemId)
  }
}

/**
 * 获取帮助视频列表
 */
export async function getHelpVideos(filters = {}) {
  const { module, status = 'active' } = filters
  
  const db = getDatabase()
  
  if (module) {
    return await db.prepare(
      `SELECT * FROM help_videos WHERE status = ? AND module = ? ORDER BY module, title`
    ).all(status, module)
  }
  
  return await db.prepare(
    `SELECT * FROM help_videos WHERE status = ? ORDER BY module, title`
  ).all(status)
}

/**
 * 根据帮助项ID获取视频
 */
export async function getVideoByHelpItemId(helpItemId) {
  const db = getDatabase()
  return await db.prepare(
    `SELECT * FROM help_videos WHERE help_item_id = ? AND status = 'active'`
  ).get(helpItemId)
}

/**
 * 批量获取视频（用于帮助中心页面）
 */
export async function getVideosByHelpItemIds(helpItemIds) {
  if (!helpItemIds || helpItemIds.length === 0) return []
  
  const db = getDatabase()
  const placeholders = helpItemIds.map(() => '?').join(',')
  return await db.prepare(
    `SELECT * FROM help_videos WHERE help_item_id IN (${placeholders}) AND status = 'active'`
  ).all(...helpItemIds)
}

/**
 * 删除帮助视频
 */
export async function deleteHelpVideo(helpItemId) {
  const db = getDatabase()
  // 软删除
  await db.prepare(
    `UPDATE help_videos SET status = 'deleted', updated_at = NOW() WHERE help_item_id = ?`
  ).run(helpItemId)
  
  return await db.prepare(
    `SELECT * FROM help_videos WHERE help_item_id = ?`
  ).get(helpItemId)
}

/**
 * 获取视频统计信息
 */
export async function getVideoStats() {
  const db = getDatabase()
  return await db.prepare(`
    SELECT 
      module,
      COUNT(*) as video_count,
      COALESCE(SUM(file_size), 0) as total_size
    FROM help_videos 
    WHERE status = 'active'
    GROUP BY module
    ORDER BY module
  `).all()
}

export default {
  initHelpVideoTable,
  upsertHelpVideo,
  getHelpVideos,
  getVideoByHelpItemId,
  getVideosByHelpItemIds,
  deleteHelpVideo,
  getVideoStats
}
