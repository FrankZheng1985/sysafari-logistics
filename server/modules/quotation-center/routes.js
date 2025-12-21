/**
 * 统一报价中心 - 路由配置
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'

const router = express.Router()

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/pdf'
    ]
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，仅支持 xlsx/xls/csv/pdf'))
    }
  }
})

// ==================== 导入模板管理 ====================

// 获取导入模板列表
router.get('/import-templates', controller.getImportTemplates)

// 获取导入模板详情
router.get('/import-templates/:id', controller.getImportTemplateById)

// 创建导入模板
router.post('/import-templates', controller.createImportTemplate)

// 更新导入模板
router.put('/import-templates/:id', controller.updateImportTemplate)

// 删除导入模板
router.delete('/import-templates/:id', controller.deleteImportTemplate)

// ==================== 导入记录管理 ====================

// 获取导入记录列表
router.get('/import-logs', controller.getImportLogs)

// 获取导入记录详情
router.get('/import-logs/:id', controller.getImportLogById)

// 确认导入
router.post('/import-logs/:id/confirm', controller.confirmImport)

// ==================== 文件上传解析 ====================

// 解析上传的文件
router.post('/parse-file', upload.single('file'), controller.parseUploadedFile)

// 预览导入数据
router.post('/preview-import', upload.single('file'), controller.previewImportData)

// 检查OCR服务状态
router.get('/ocr-status', controller.checkOCRStatus)

// ==================== 费率查询 ====================

// 获取有效费率卡
router.get('/active-rate-card', controller.getActiveRateCard)

// 查询费率
router.get('/query-rate', controller.queryRate)

// ==================== 利润分析 ====================

// 获取费率卡利润汇总
router.get('/rate-cards/:rateCardId/profit-summary', controller.getRateCardProfitSummary)

// 获取承运商利润统计
router.get('/carrier-profit-stats', controller.getCarrierProfitStats)

// 利润对比分析
router.get('/profit-comparison', controller.getProfitComparison)

export default router
