/**
 * OCR模块路由
 */

import { Router } from 'express'
import multer from 'multer'
import { getOcrStatus, parseTransportDoc, batchParseTransportDocs } from './controller.js'

const router = Router()

// 配置文件上传（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 最大10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型'), false)
    }
  }
})

// 检查OCR配置状态
router.get('/status', getOcrStatus)

// 解析运输单文件（单个）
router.post('/parse-transport', upload.single('file'), parseTransportDoc)

// 批量解析运输单（Excel）
router.post('/batch-parse', upload.single('file'), batchParseTransportDocs)

export default router
