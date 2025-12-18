/**
 * TARIC 模块 - 路由定义
 * 欧盟关税税率数据同步和管理
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'

const router = express.Router()

// 配置 multer 用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/xml',
      'text/xml'
    ]
    const allowedExts = ['.xls', '.xlsx', '.csv', '.xml']
    
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'))
    
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，请上传 Excel (.xlsx/.xls) 或 CSV 文件'))
    }
  }
})

// ==================== 同步状态和管理 ====================

// 获取 TARIC 同步状态（最新同步信息、文件状态等）
router.get('/taric/status', controller.getSyncStatus)

// 获取同步历史记录
router.get('/taric/history', controller.getSyncHistory)

// 手动触发同步（使用本地已有的数据文件）
router.post('/taric/sync', controller.triggerSync)

// 上传数据文件并同步
router.post('/taric/upload-sync', 
  upload.fields([
    { name: 'nomenclature', maxCount: 1 },
    { name: 'duties', maxCount: 1 }
  ]),
  controller.uploadAndSync
)

// ==================== 数据查询（本地数据库） ====================

// 查询特定 HS 编码的完整税率信息（从本地数据库）
router.get('/taric/lookup/:hsCode', controller.lookupHsCode)

// 获取贸易协定列表
router.get('/taric/agreements', controller.getTradeAgreements)

// ==================== 实时 API 查询（从欧盟 TARIC 系统） ====================

// 实时查询单个 HS 编码
// GET /api/taric/realtime/:hsCode?originCountry=CN&saveToDb=true
router.get('/taric/realtime/:hsCode', controller.lookupHsCodeRealtime)

// 批量实时查询 HS 编码
// POST /api/taric/realtime-batch
// body: { hsCodes: ['6109100010', '8471300000'], originCountry: 'CN' }
router.post('/taric/realtime-batch', controller.batchLookupRealtime)

// 获取 HS 编码的贸易措施详情
// GET /api/taric/measures/:hsCode?originCountry=CN
router.get('/taric/measures/:hsCode', controller.getMeasures)

// 获取国家/地区代码列表
router.get('/taric/countries', controller.getCountryCodes)

// 检查 TARIC API 健康状态
router.get('/taric/api-health', controller.checkApiHealth)

// 清除 API 缓存
router.post('/taric/clear-cache', controller.clearApiCache)

// ==================== 文件管理 ====================

// 获取本地数据文件状态
router.get('/taric/files', controller.getFileStatus)

// 获取数据文件模板/说明
router.get('/taric/template/:type', controller.downloadTemplate)

// ==================== 翻译功能 ====================

// 触发翻译任务（将商品描述翻译为中文）
// POST /api/taric/translate
router.post('/taric/translate', controller.triggerTranslation)

// 获取翻译任务状态
// GET /api/taric/translate-status
router.get('/taric/translate-status', controller.getTranslationStatus)

// 清除翻译缓存
// POST /api/taric/clear-translation-cache
router.post('/taric/clear-translation-cache', controller.clearTranslationCache)

export default router
