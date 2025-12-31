/**
 * 帮助视频模块 - 路由
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'

const router = express.Router()

// 配置 multer 内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的视频格式'))
    }
  }
})

// 检查COS配置状态
router.get('/status', controller.checkCosStatus)

// 获取视频统计信息
router.get('/stats', controller.getVideoStats)

// 获取帮助视频列表
router.get('/', controller.getHelpVideos)

// 批量获取视频URL
router.post('/urls', controller.getVideoUrls)

// 根据帮助项ID获取视频
router.get('/:helpItemId', controller.getVideoByHelpItemId)

// 获取视频播放URL（带签名）
router.get('/:helpItemId/play', controller.getVideoPlayUrl)

// 上传帮助视频
router.post('/upload', upload.single('video'), controller.uploadHelpVideo)

// 删除帮助视频
router.delete('/:helpItemId', controller.deleteHelpVideo)

export default router

