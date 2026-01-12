/**
 * 供应商管理模块 - 路由定义
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'

const router = express.Router()

// 文件上传配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ]
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|pdf|jpg|jpeg|png)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式'))
    }
  }
})

// ==================== 翻译 API ====================

// 翻译文本
router.post('/translate', controller.translate)

// 翻译费用名称（带预设映射）
router.post('/translate/fee', controller.translateFee)

// ==================== 运输报价匹配 ====================

// 匹配运输报价（根据起点终点查询供应商报价）
router.get('/prices/match', controller.matchTransportPrices)

// ==================== 供应商价格比对分析 ====================

// 获取运输报价供应商比对分析（对比供应商报价与市场参考价）
router.post('/prices/compare', controller.compareTransportPrices)

// 获取供应商运输报价概览（按路线分组）
router.get('/prices/transport-overview', controller.getTransportPriceOverview)

// ==================== 供应商管理路由 ====================

// 获取供应商统计
router.get('/suppliers/stats', controller.getSupplierStats)

// 获取启用的供应商列表（下拉选择用）
router.get('/suppliers/active', controller.getActiveSuppliers)

// 生成供应商编码
router.get('/suppliers/generate-code', controller.generateSupplierCode)

// 获取供应商列表
router.get('/suppliers', controller.getSupplierList)

// 获取单个供应商
router.get('/suppliers/:id', controller.getSupplierById)

// 创建供应商
router.post('/suppliers', controller.createSupplier)

// 批量删除供应商
router.post('/suppliers/batch-delete', controller.batchDeleteSuppliers)

// 更新供应商
router.put('/suppliers/:id', controller.updateSupplier)

// 更新供应商状态
router.patch('/suppliers/:id/status', controller.updateSupplierStatus)

// 删除供应商
router.delete('/suppliers/:id', controller.deleteSupplier)

// ==================== 供应商采购价管理 ====================

// 获取供应商采购价列表
router.get('/suppliers/:id/prices', controller.getSupplierPrices)

// 创建采购价
router.post('/suppliers/:id/prices', controller.createSupplierPrice)

// 更新采购价
router.put('/suppliers/:id/prices/:priceId', controller.updateSupplierPrice)

// 删除采购价
router.delete('/suppliers/:id/prices/:priceId', controller.deleteSupplierPrice)

// ==================== 供应商报价智能导入 ====================

// 解析上传的文件（预览阶段）
router.post('/suppliers/import/parse', upload.single('file'), controller.parseImportFile)

// 确认导入数据
router.post('/suppliers/:id/import/confirm', controller.confirmImport)

// 获取导入历史记录
router.get('/suppliers/:id/import-records', controller.getImportRecords)

export default router
