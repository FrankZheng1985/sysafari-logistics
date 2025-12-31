/**
 * 数据导入模块 - 路由定义
 * 支持订单、费用、客户、服务商、HS记录的Excel导入
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = express.Router()

// 配置文件上传
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv'
    ]
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('只支持 Excel (.xlsx, .xls) 和 CSV 文件'))
    }
  }
})

// ==================== 模板下载（无需认证）====================
// 下载导入模板 - 公开接口，不需要登录
router.get('/templates/:type', controller.downloadTemplate)

// 以下路由需要认证
router.use(authenticate)

// ==================== 数据预览 ====================
// 上传并预览数据（不入库）
router.post('/preview/:type', upload.single('file'), controller.previewImport)

// ==================== 确认导入 ====================
// 确认导入数据到数据库
router.post('/confirm/:type', controller.confirmImport)

// ==================== 导入历史 ====================
// 获取导入历史
router.get('/history', controller.getImportHistory)

// 获取导入详情
router.get('/history/:id', controller.getImportDetail)

// ==================== 字段映射配置 ====================
// 获取字段映射配置
router.get('/field-mapping/:type', controller.getFieldMapping)

// 保存字段映射配置
router.post('/field-mapping/:type', controller.saveFieldMapping)

export default router
