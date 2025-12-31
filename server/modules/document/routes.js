/**
 * 文档管理模块 - 路由定义
 * 支持腾讯云COS存储、订单关联、权限控制
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'

const router = express.Router()

// ==================== Multer 配置 ====================

// 配置 multer 用于文件上传（存储到内存，然后上传到COS）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
    files: 10 // 最多同时上传10个文件
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedMimes = [
      // 文档
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // 图片
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // 文本
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'text/xml',
      // 压缩文件
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // 通用
      'application/octet-stream'
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false)
    }
  }
})

// ==================== 配置和工具路由 ====================

// 获取文档类型列表
router.get('/document-types', controller.getDocumentTypes)

// 检查COS配置状态
router.get('/cos-status', controller.checkCosStatus)

// ==================== 文档管理路由 ====================

// 获取文档统计
router.get('/stats', controller.getDocumentStats)

// 获取文档列表
router.get('/', controller.getDocuments)

// 获取文档详情
router.get('/:id', controller.getDocumentById)

// 上传单个文档
router.post('/upload', upload.single('file'), controller.uploadDocument)

// 批量上传文档
router.post('/upload/batch', upload.array('files', 10), controller.uploadDocuments)

// 更新文档信息
router.put('/:id', controller.updateDocument)

// 删除文档
router.delete('/:id', controller.deleteDocument)

// 批量删除文档
router.post('/delete-batch', controller.deleteDocuments)

// ==================== 文档访问路由 ====================

// 获取文档预览URL
router.get('/:id/preview-url', controller.getPreviewUrl)

// 获取文档下载URL
router.get('/:id/download-url', controller.getDownloadUrl)

// ==================== 订单文档关联路由 ====================

// 获取订单关联的文档
router.get('/order/:billId', controller.getOrderDocuments)

// 关联文档到订单
router.put('/:id/link-order', controller.linkToOrder)

// 解除文档与订单的关联
router.put('/:id/unlink-order', controller.unlinkFromOrder)

// ==================== 版本管理路由 ====================

// 获取文档版本历史
router.get('/:id/versions', controller.getDocumentVersions)

// 上传新版本
router.post('/:id/versions', upload.single('file'), controller.uploadNewVersion)

// ==================== 错误处理中间件 ====================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        errCode: 400,
        msg: '文件大小超过限制（最大50MB）'
      })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        errCode: 400,
        msg: '上传文件数量超过限制（最多10个）'
      })
    }
    return res.status(400).json({
      errCode: 400,
      msg: `上传错误: ${err.message}`
    })
  }
  
  if (err.message && err.message.includes('不支持的文件类型')) {
    return res.status(400).json({
      errCode: 400,
      msg: err.message
    })
  }
  
  next(err)
})

export default router
