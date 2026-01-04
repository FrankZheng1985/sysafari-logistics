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
router.get('/status', controller.getSyncStatus)

// 获取同步历史记录
router.get('/history', controller.getSyncHistory)

// 手动触发同步（使用本地已有的数据文件）
router.post('/sync', controller.triggerSync)

// 上传数据文件并同步
router.post('/upload-sync', 
  upload.fields([
    { name: 'nomenclature', maxCount: 1 },
    { name: 'duties', maxCount: 1 }
  ]),
  controller.uploadAndSync
)

// ==================== 数据查询（本地数据库） ====================

// 查询特定 HS 编码的完整税率信息（从本地数据库）
router.get('/lookup/:hsCode', controller.lookupHsCode)

// 获取贸易协定列表
router.get('/agreements', controller.getTradeAgreements)

// ==================== 实时 API 查询（从欧盟 TARIC 系统） ====================

// 实时查询单个 HS 编码
// GET /api/taric/realtime/:hsCode?originCountry=CN&saveToDb=true
router.get('/realtime/:hsCode', controller.lookupHsCodeRealtime)

// 批量实时查询 HS 编码
// POST /api/taric/realtime-batch
// body: { hsCodes: ['6109100010', '8471300000'], originCountry: 'CN' }
router.post('/realtime-batch', controller.batchLookupRealtime)

// 获取 HS 编码的贸易措施详情
// GET /api/taric/measures/:hsCode?originCountry=CN
router.get('/measures/:hsCode', controller.getMeasures)

// 获取国家/地区代码列表
router.get('/countries', controller.getCountryCodes)

// 检查 TARIC API 健康状态
router.get('/api-health', controller.checkApiHealth)

// 清除 API 缓存
router.post('/clear-cache', controller.clearApiCache)

// ==================== 文件管理 ====================

// 获取本地数据文件状态
router.get('/files', controller.getFileStatus)

// 获取数据文件模板/说明
router.get('/template/:type', controller.downloadTemplate)

// ==================== 翻译功能 ====================

// 触发翻译任务（将商品描述翻译为中文）
// POST /api/taric/translate
router.post('/translate', controller.triggerTranslation)

// 获取翻译任务状态
// GET /api/taric/translate-status
router.get('/translate-status', controller.getTranslationStatus)

// 清除翻译缓存
// POST /api/taric/clear-translation-cache
router.post('/clear-translation-cache', controller.clearTranslationCache)

// ==================== 中国反倾销税查询 ====================

// 获取中国反倾销税摘要（按产品类别分组统计）
// GET /api/taric/china-anti-dumping/summary
router.get('/china-anti-dumping/summary', controller.getChinaAntiDumpingSummary)

// 获取所有中国反倾销税 HS 编码列表
// GET /api/taric/china-anti-dumping/codes
router.get('/china-anti-dumping/codes', controller.getChinaAntiDumpingCodes)

// 查询单个 HS 编码的中国反倾销税
// GET /api/taric/china-anti-dumping/:hsCode
router.get('/china-anti-dumping/:hsCode', controller.lookupChinaAntiDumping)

// ==================== UK Trade Tariff API 查询 ====================

// 实时查询单个 HS 编码（从 UK Trade Tariff API）
// GET /api/taric/uk/realtime/:hsCode?originCountry=CN&region=uk&saveToDb=true
// region: 'uk' (英国) 或 'xi' (北爱尔兰，适用EU规则)
router.get('/uk/realtime/:hsCode', controller.lookupHsCodeUk)

// 批量实时查询 UK HS 编码
// POST /api/taric/uk/realtime-batch
// body: { hsCodes: ['6109100010', '8471300000'], originCountry: 'CN', region: 'uk' }
router.post('/uk/realtime-batch', controller.batchLookupUk)

// 搜索 UK 商品
// GET /api/taric/uk/search?q=keyword&region=uk
router.get('/uk/search', controller.searchUkCommodities)

// 获取 UK 章节列表
// GET /api/taric/uk/chapters?region=uk
router.get('/uk/chapters', controller.getUkChapters)

// 检查 UK Trade Tariff API 健康状态
router.get('/uk/api-health', controller.checkUkApiHealth)

// 清除 UK API 缓存
router.post('/uk/clear-cache', controller.clearUkApiCache)

// ==================== 统一查询接口 ====================

// 统一实时查询接口（支持 EU 和 UK）
// GET /api/taric/unified/:hsCode?originCountry=CN&source=eu&region=uk&saveToDb=true
// source: 'eu' (欧盟 TARIC) 或 'uk' (英国 Trade Tariff)
// region: 仅当 source=uk 时有效，'uk' 或 'xi'
router.get('/unified/:hsCode', controller.lookupHsCodeUnified)

// 检查所有 API 健康状态
// GET /api/taric/all-api-health
router.get('/all-api-health', controller.checkAllApiHealth)

export default router
