/**
 * 帮助视频模块 - 控制器
 * 处理视频上传、管理等业务逻辑
 */

import { uploadDocument, deleteDocument, getSignedUrl, checkCosConfig, getCosConfig } from '../../utils/cosService.js'
import * as model from './model.js'
import crypto from 'crypto'
import path from 'path'

// 视频文件MIME类型映射
const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v'
}

// 支持的视频格式
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.webm', '.mov', '.m4v']

// 最大文件大小 (500MB)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024

/**
 * 生成唯一视频文件名
 */
function generateVideoFileName(originalName, helpItemId) {
  const ext = path.extname(originalName).toLowerCase()
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  return `${helpItemId}_${timestamp}_${random}${ext}`
}

/**
 * 构建视频存储路径
 */
function buildVideoKey(module, fileName) {
  return `help-videos/${module}/${fileName}`
}

/**
 * 检查视频格式是否支持
 */
function isValidVideoFormat(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  return SUPPORTED_VIDEO_FORMATS.includes(ext)
}

/**
 * 获取视频MIME类型
 */
function getVideoMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  return VIDEO_MIME_TYPES[ext] || 'video/mp4'
}

/**
 * 上传帮助视频
 */
export async function uploadHelpVideo(req, res) {
  try {
    // 检查COS配置
    const cosStatus = checkCosConfig()
    if (!cosStatus.configured) {
      return res.status(500).json({
        success: false,
        error: '腾讯云COS未配置，请检查环境变量'
      })
    }
    
    // 检查是否有文件
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的视频文件'
      })
    }
    
    const { helpItemId, title, module, description } = req.body
    
    // 验证必填字段
    if (!helpItemId || !title || !module) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数：helpItemId, title, module'
      })
    }
    
    // 验证视频格式
    if (!isValidVideoFormat(req.file.originalname)) {
      return res.status(400).json({
        success: false,
        error: `不支持的视频格式，支持的格式: ${SUPPORTED_VIDEO_FORMATS.join(', ')}`
      })
    }
    
    // 验证文件大小
    if (req.file.size > MAX_VIDEO_SIZE) {
      return res.status(400).json({
        success: false,
        error: `视频文件过大，最大支持 ${MAX_VIDEO_SIZE / 1024 / 1024}MB`
      })
    }
    
    // 生成文件名和存储路径
    const fileName = generateVideoFileName(req.file.originalname, helpItemId)
    const videoKey = buildVideoKey(module, fileName)
    
    // 上传到COS
    const uploadResult = await uploadDocument({
      body: req.file.buffer,
      fileName: fileName,
      customKey: videoKey,
      contentType: getVideoMimeType(req.file.originalname)
    })
    
    // 保存到数据库
    const videoRecord = await model.upsertHelpVideo({
      helpItemId,
      title,
      module,
      videoKey: uploadResult.key,
      videoUrl: uploadResult.url,
      fileSize: req.file.size,
      description,
      createdBy: req.user?.username || 'system'
    })
    
    res.json({
      success: true,
      data: {
        id: videoRecord.id,
        helpItemId: videoRecord.help_item_id,
        title: videoRecord.title,
        videoUrl: videoRecord.video_url,
        videoKey: videoRecord.video_key,
        fileSize: videoRecord.file_size
      },
      message: '视频上传成功'
    })
    
  } catch (error) {
    console.error('上传帮助视频失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '上传视频失败'
    })
  }
}

/**
 * 获取帮助视频列表
 */
export async function getHelpVideos(req, res) {
  try {
    const { module } = req.query
    const videos = await model.getHelpVideos({ module })
    
    res.json({
      success: true,
      data: videos.map(v => ({
        id: v.id,
        helpItemId: v.help_item_id,
        title: v.title,
        module: v.module,
        videoUrl: v.video_url,
        videoKey: v.video_key,
        thumbnailUrl: v.thumbnail_url,
        duration: v.duration,
        fileSize: v.file_size,
        description: v.description,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    })
  } catch (error) {
    console.error('获取帮助视频列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取视频列表失败'
    })
  }
}

/**
 * 根据帮助项ID获取视频
 */
export async function getVideoByHelpItemId(req, res) {
  try {
    const { helpItemId } = req.params
    const video = await model.getVideoByHelpItemId(helpItemId)
    
    if (!video) {
      return res.json({
        success: true,
        data: null
      })
    }
    
    res.json({
      success: true,
      data: {
        id: video.id,
        helpItemId: video.help_item_id,
        title: video.title,
        module: video.module,
        videoUrl: video.video_url,
        videoKey: video.video_key,
        thumbnailUrl: video.thumbnail_url,
        duration: video.duration,
        fileSize: video.file_size,
        description: video.description
      }
    })
  } catch (error) {
    console.error('获取帮助视频失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取视频失败'
    })
  }
}

/**
 * 批量获取视频URL（用于帮助中心）
 */
export async function getVideoUrls(req, res) {
  try {
    const { helpItemIds } = req.body
    
    if (!helpItemIds || !Array.isArray(helpItemIds)) {
      return res.status(400).json({
        success: false,
        error: '请提供帮助项ID数组'
      })
    }
    
    const videos = await model.getVideosByHelpItemIds(helpItemIds)
    
    // 转换为 helpItemId -> videoUrl 的映射
    const videoMap = {}
    videos.forEach(v => {
      videoMap[v.help_item_id] = v.video_url
    })
    
    res.json({
      success: true,
      data: videoMap
    })
  } catch (error) {
    console.error('批量获取视频URL失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取视频URL失败'
    })
  }
}

/**
 * 获取视频播放URL（带签名，用于私有bucket）
 */
export async function getVideoPlayUrl(req, res) {
  try {
    const { helpItemId } = req.params
    const video = await model.getVideoByHelpItemId(helpItemId)
    
    if (!video || !video.video_key) {
      return res.status(404).json({
        success: false,
        error: '视频不存在'
      })
    }
    
    // 生成签名URL（有效期1小时）
    const signedUrl = await getSignedUrl(video.video_key, 3600)
    
    res.json({
      success: true,
      data: {
        playUrl: signedUrl,
        title: video.title,
        duration: video.duration
      }
    })
  } catch (error) {
    console.error('获取视频播放URL失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取播放URL失败'
    })
  }
}

/**
 * 删除帮助视频
 */
export async function deleteHelpVideo(req, res) {
  try {
    const { helpItemId } = req.params
    
    // 获取视频信息
    const video = await model.getVideoByHelpItemId(helpItemId)
    if (!video) {
      return res.status(404).json({
        success: false,
        error: '视频不存在'
      })
    }
    
    // 从COS删除文件
    if (video.video_key) {
      try {
        await deleteDocument(video.video_key)
      } catch (err) {
        console.warn('删除COS视频文件失败:', err.message)
      }
    }
    
    // 删除缩略图
    if (video.thumbnail_key) {
      try {
        await deleteDocument(video.thumbnail_key)
      } catch (err) {
        console.warn('删除COS缩略图失败:', err.message)
      }
    }
    
    // 软删除数据库记录
    await model.deleteHelpVideo(helpItemId)
    
    res.json({
      success: true,
      message: '视频删除成功'
    })
  } catch (error) {
    console.error('删除帮助视频失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除视频失败'
    })
  }
}

/**
 * 获取视频统计信息
 */
export async function getVideoStats(req, res) {
  try {
    const stats = await model.getVideoStats()
    const cosConfig = getCosConfig()
    
    res.json({
      success: true,
      data: {
        stats,
        cosConfig: {
          bucket: cosConfig.bucket,
          region: cosConfig.region
        },
        supportedFormats: SUPPORTED_VIDEO_FORMATS,
        maxFileSize: MAX_VIDEO_SIZE
      }
    })
  } catch (error) {
    console.error('获取视频统计失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    })
  }
}

/**
 * 检查COS配置状态
 */
export async function checkCosStatus(req, res) {
  try {
    const status = checkCosConfig()
    const config = getCosConfig()
    
    res.json({
      success: true,
      data: {
        configured: status.configured,
        bucket: config.bucket,
        region: config.region,
        supportedFormats: SUPPORTED_VIDEO_FORMATS,
        maxFileSize: MAX_VIDEO_SIZE,
        maxFileSizeMB: MAX_VIDEO_SIZE / 1024 / 1024
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export default {
  uploadHelpVideo,
  getHelpVideos,
  getVideoByHelpItemId,
  getVideoUrls,
  getVideoPlayUrl,
  deleteHelpVideo,
  getVideoStats,
  checkCosStatus
}

