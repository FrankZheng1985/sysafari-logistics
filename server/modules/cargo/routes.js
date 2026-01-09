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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB - 支持包含大量产品图片的Excel文件
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

// Multer 错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('[Multer Error]', err.message, err.code)
    
    // 根据错误类型提供更友好的中文提示
    let errorMsg = '文件上传失败'
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorMsg = '文件太大，请压缩后重试（最大支持100MB）'
    } else if (err.message) {
      errorMsg = err.message
    }
    
    return res.status(400).json({
      errCode: 400,
      msg: errorMsg,
      data: null
    })
  }
  next()
}

// 上传导入文件
router.post('/documents/imports', upload.single('file'), handleMulterError, controller.createImport)

// 预览导入文件
router.post('/documents/imports/preview', upload.single('file'), handleMulterError, controller.previewImport)

// 删除导入批次
router.delete('/documents/imports/:id', controller.deleteImport)

// 更新发货方和进口商信息
router.put('/documents/imports/:id/shipper-importer', controller.updateShipperAndImporter)

// 从提单同步发货方信息
router.post('/documents/imports/:id/sync-shipper', controller.syncShipperFromBL)

// ==================== HS匹配 ====================
// 执行批量匹配
router.post('/documents/matching/run', controller.runBatchMatch)

// 获取待审核列表（未匹配）
router.get('/documents/matching/review', controller.getReviewItems)

// 获取已匹配列表
router.get('/documents/matching/matched', controller.getMatchedItems)

// 获取匹配统计
router.get('/documents/matching/stats', controller.getMatchingStats)

// 批量审核
router.post('/documents/matching/batch', controller.batchReview)

// 批量更新整个提单的原产地
router.put('/documents/matching/batch-origin', controller.updateBatchOrigin)

// 更新单个商品的材质和用途
router.put('/documents/matching/item/:itemId/detail', controller.updateItemDetail)

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

// ==================== 贸易条件和完税价格 ====================
// 获取 Incoterms 贸易条款列表
router.get('/documents/incoterms', controller.getIncotermsList)

// 更新贸易条件和运费信息
router.put('/documents/tax-calc/:importId/trade-terms', controller.updateTradeTerms)

// 更新商品原产地
router.put('/documents/tax-calc/item/:itemId/origin', controller.updateItemOrigin)

// 重新计算完税价格和税费
router.post('/documents/tax-calc/:importId/recalculate', controller.recalculateTax)

// 根据原产地查询税率
router.get('/documents/tariff/by-origin', controller.getTariffByOrigin)

// ==================== 数据补充 ====================
// 获取待补充列表（支持智能分类）
router.get('/documents/supplement', controller.getSupplementList)

// 获取补充统计信息
router.get('/documents/supplement/stats', controller.getSupplementStats)

// 批量补充
router.post('/documents/supplement/batch', controller.batchSupplement)

// 自动批量补充（按规则自动填充单位）
router.post('/documents/supplement/auto', controller.autoSupplement)

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

// ==================== HS编码税率优化 ====================
// 分析HS编码税率风险
router.get('/hs-optimize/analyze/:hsCode', controller.analyzeHsTaxRisk)

// 获取低税率替代编码
router.get('/hs-optimize/alternatives/:hsCode', controller.findTaxAlternatives)

// 搜索同前缀HS编码
router.get('/hs-optimize/prefix/:prefix', controller.searchHsByPrefix)

// 获取反倾销税风险编码列表
router.get('/hs-optimize/anti-dumping-risks', controller.getAntiDumpingRisks)

// 批量分析导入批次税率风险
router.post('/hs-optimize/batch-analyze/:importId', controller.batchAnalyzeTaxRisk)

// ==================== 申报价值分析 ====================
// 记录申报价值
router.post('/declaration-value/record', controller.recordDeclaration)

// 更新申报结果
router.put('/declaration-value/record/:id/result', controller.updateDeclarationResultCtrl)

// 获取HS编码申报统计
router.get('/declaration-value/stats/:hsCode', controller.getDeclarationStatsCtrl)

// 检查申报价值风险
router.post('/declaration-value/check-risk', controller.checkDeclarationRiskCtrl)

// 批量检查导入批次申报风险
router.post('/declaration-value/batch-check/:importId', controller.batchCheckDeclarationRiskCtrl)

// 从导入批次创建申报记录
router.post('/declaration-value/create-from-import/:importId', controller.createDeclarationFromImport)

// 获取申报历史
router.get('/declaration-value/history', controller.getDeclarationHistoryCtrl)

// ==================== 查验风险管理 ====================
// 记录查验信息
router.post('/inspection/record', controller.recordInspectionCtrl)

// 更新查验结果
router.put('/inspection/record/:id', controller.updateInspectionCtrl)

// 获取HS编码查验率统计
router.get('/inspection/stats/:hsCode', controller.getInspectionStatsCtrl)

// 获取高查验率编码列表
router.get('/inspection/high-risk-codes', controller.getHighRiskCodesCtrl)

// 分析导入批次查验风险
router.post('/inspection/analyze-risk/:importId', controller.analyzeInspectionRiskCtrl)

// 从导入批次创建查验记录
router.post('/inspection/create-from-import/:importId', controller.createInspectionFromImport)

// 获取查验历史
router.get('/inspection/history', controller.getInspectionHistoryCtrl)

// 获取查验类型统计
router.get('/inspection/type-summary', controller.getInspectionTypeSummaryCtrl)

// ==================== 综合风险分析 ====================
// 分析导入批次的综合风险（税率+申报价值+查验）
router.post('/risk-analysis/full/:importId', controller.analyzeFullRisk)

// ==================== 敏感产品库管理 ====================
// 获取敏感产品列表
router.get('/sensitive-products', controller.getSensitiveProductsCtrl)

// 获取敏感产品分类列表
router.get('/sensitive-products/categories', controller.getSensitiveProductCategoriesCtrl)

// 检查HS编码是否为敏感产品
router.get('/sensitive-products/check', controller.checkSensitiveProductCtrl)

// 创建敏感产品
router.post('/sensitive-products', controller.createSensitiveProductCtrl)

// 更新敏感产品
router.put('/sensitive-products/:id', controller.updateSensitiveProductCtrl)

// 删除敏感产品
router.delete('/sensitive-products/:id', controller.deleteSensitiveProductCtrl)

// ==================== 查验产品库管理 ====================
// 获取查验产品列表
router.get('/inspection-products', controller.getInspectionProductsCtrl)

// 检查HS编码是否为查验产品
router.get('/inspection-products/check', controller.checkInspectionProductCtrl)

// 创建查验产品
router.post('/inspection-products', controller.createInspectionProductCtrl)

// 更新查验产品
router.put('/inspection-products/:id', controller.updateInspectionProductCtrl)

// 删除查验产品
router.delete('/inspection-products/:id', controller.deleteInspectionProductCtrl)

// ==================== 综合产品风险检测 ====================
// 综合检测产品风险
router.get('/product-risk/check', controller.checkProductRiskCtrl)

// 批量检测导入批次的产品风险
router.post('/product-risk/batch/:importId', controller.batchCheckImportRiskCtrl)

// 获取产品库统计信息
router.get('/product-risk/stats', controller.getProductLibraryStatsCtrl)

// ==================== AI图片分析 ====================
// AI分析产品图片
router.post('/ai/analyze-image', controller.analyzeProductImageCtrl)

// 检查AI服务状态
router.get('/ai/status', controller.checkAiServiceStatusCtrl)

// 获取AI使用统计
router.get('/ai/usage-stats', controller.getAiUsageStatsCtrl)

// 获取AI调用记录
router.get('/ai/usage-logs', controller.getAiUsageLogsCtrl)

// ==================== 图片处理 ====================
// 批量重新处理图片（增强清晰度）
router.post('/images/reprocess-all', controller.reprocessAllImagesCtrl)

// 重新处理单张图片
router.post('/images/reprocess', controller.reprocessSingleImageCtrl)

export default router
