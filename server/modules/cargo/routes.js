/**
 * 货物单证管理路由
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import * as controller from './controller.js'

const router = express.Router()

// 配置文件上传
const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'cargo-imports')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 CSV 和 Excel 文件'))
    }
  }
})

// ==================== 统计接口 ====================
router.get('/documents/stats', controller.getStats)

// ==================== 导入管理 ====================
// 获取导入批次列表
router.get('/documents/imports', controller.getImports)

// 获取导入批次详情
router.get('/documents/imports/:id', controller.getImportById)

// 获取货物明细
router.get('/documents/imports/:id/items', controller.getImportItems)

// 上传导入文件
router.post('/documents/imports', upload.single('file'), controller.createImport)

// 预览导入文件
router.post('/documents/imports/preview', upload.single('file'), controller.previewImport)

// 删除导入批次
router.delete('/documents/imports/:id', controller.deleteImport)

// 更新发货方和进口商信息
router.put('/documents/imports/:id/shipper-importer', controller.updateShipperAndImporter)

// ==================== HS匹配 ====================
// 执行批量匹配
router.post('/documents/matching/run', controller.runBatchMatch)

// 获取待审核列表
router.get('/documents/matching/review', controller.getReviewItems)

// 批量审核
router.post('/documents/matching/batch', controller.batchReview)

// 获取HS推荐
router.post('/documents/matching/recommend', controller.getRecommendations)

// 搜索税率库
router.get('/documents/matching/search-tariff', controller.searchTariff)

// ==================== 税费计算 ====================
// 计算税费
router.post('/documents/tax-calc/:importId', controller.calculateTax)

// 获取税费详情
router.get('/documents/tax-calc/:importId', controller.getTaxDetails)

// 生成税费确认单PDF
router.get('/documents/tax-calc/:importId/pdf', controller.generateTaxPdf)

// 下载税费确认单PDF
router.get('/documents/tax-calc/:importId/pdf/download', controller.downloadTaxPdf)

// 标记客户已确认
router.post('/documents/tax-calc/:importId/confirm', controller.markConfirmed)

// 更新清关类型 (40-普通清关, 42-递延清关)
router.put('/documents/tax-calc/:importId/clearance-type', controller.updateClearanceType)

// 更新单个商品税费
router.put('/documents/tax-calc/item/:itemId', controller.updateItemTax)

// ==================== 数据补充 ====================
// 获取待补充列表
router.get('/documents/supplement', controller.getSupplementList)

// 批量补充
router.post('/documents/supplement/batch', controller.batchSupplement)

// ==================== HS匹配记录管理 ====================
// 获取匹配记录列表
router.get('/documents/match-records', controller.getMatchRecordsList)

// 搜索匹配记录（用于快速匹配建议）
router.get('/documents/match-records/search', controller.searchMatchRecords)

// 获取匹配记录详情
router.get('/documents/match-records/:id', controller.getMatchRecordDetail)

// 更新匹配记录
router.put('/documents/match-records/:id', controller.updateMatchRecord)

// 验证匹配记录
router.post('/documents/match-records/:id/verify', controller.verifyMatchRecord)

// 删除匹配记录
router.delete('/documents/match-records/:id', controller.deleteMatchRecord)

// 保存税费计算结果到匹配记录
router.post('/documents/tax-calc/:importId/save-records', controller.saveToMatchRecords)

// ==================== 价格异常检测 ====================
// 检测导入批次的价格异常
router.get('/documents/imports/:importId/price-check', controller.checkPriceAnomaly)

// 检测单个商品价格异常
router.post('/documents/price-check', controller.checkSinglePriceAnomaly)

export default router
