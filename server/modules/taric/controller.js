/**
 * TARIC 模块 - 控制器
 * 处理 TARIC 数据同步相关的 API 请求
 */

import { success, successWithPagination, badRequest, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as downloader from './downloader.js'
import * as scheduler from './scheduler.js'
import * as apiClient from './apiClient.js'
import * as ukApiClient from './ukTaricApiClient.js'
import * as translator from './translator.js'

// ==================== 同步状态 ====================

/**
 * 获取 TARIC 同步状态
 */
export async function getSyncStatus(req, res) {
  try {
    const status = await model.getLatestSyncStatus()
    const fileStatus = downloader.checkLocalFiles()
    const currentSync = scheduler.getCurrentSyncStatus()
    
    return success(res, {
      ...status,
      currentSync,
      files: fileStatus,
      taricVersion: downloader.getTaricVersion()
    })
  } catch (error) {
    console.error('获取同步状态失败:', error)
    return serverError(res, '获取同步状态失败')
  }
}

/**
 * 获取同步历史记录
 */
export async function getSyncHistory(req, res) {
  try {
    const { status, syncType, page, pageSize } = req.query
    
    const result = await model.getSyncLogs({
      status,
      syncType,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取同步历史失败:', error)
    return serverError(res, '获取同步历史失败')
  }
}

// ==================== 数据同步 ====================

/**
 * 手动触发同步（使用本地文件）
 */
export async function triggerSync(req, res) {
  try {
    const { syncType = 'full', enableTranslation = true } = req.body
    const createdBy = req.user?.id
    
    // 检查本地文件
    const fileStatus = downloader.checkLocalFiles()
    if (!fileStatus.nomenclature?.exists && !fileStatus.duties?.exists) {
      return badRequest(res, '未找到本地 TARIC 数据文件，请先上传数据文件')
    }
    
    // 异步执行同步（不等待完成）
    scheduler.runSync({
      syncType,
      dataSource: 'excel',
      createdBy,
      enableTranslation: enableTranslation === true || enableTranslation === 'true'
    }).catch(err => {
      console.error('同步任务执行失败:', err)
    })
    
    return success(res, {
      message: enableTranslation ? '同步任务已启动（含翻译）' : '同步任务已启动（跳过翻译）',
      status: 'running'
    })
  } catch (error) {
    if (error.message.includes('正在运行')) {
      return badRequest(res, error.message)
    }
    console.error('触发同步失败:', error)
    return serverError(res, '触发同步失败: ' + error.message)
  }
}

/**
 * 上传并同步 TARIC 数据文件
 */
export async function uploadAndSync(req, res) {
  try {
    const files = req.files || {}
    const { syncType = 'full' } = req.body
    const createdBy = req.user?.id
    
    let nomenclatureBuffer = null
    let dutiesBuffer = null
    
    // 处理上传的文件
    if (files.nomenclature && files.nomenclature[0]) {
      nomenclatureBuffer = files.nomenclature[0].buffer
      // 保存到本地
      await downloader.saveUploadedFile('nomenclature', nomenclatureBuffer, files.nomenclature[0].originalname)
    }
    
    if (files.duties && files.duties[0]) {
      dutiesBuffer = files.duties[0].buffer
      // 保存到本地
      await downloader.saveUploadedFile('duties', dutiesBuffer, files.duties[0].originalname)
    }
    
    if (!nomenclatureBuffer && !dutiesBuffer) {
      return badRequest(res, '请上传至少一个 TARIC 数据文件（Nomenclature 或 Duties）')
    }
    
    // 异步执行同步
    scheduler.runSync({
      syncType,
      dataSource: 'upload',
      nomenclatureBuffer,
      dutiesBuffer,
      createdBy
    }).catch(err => {
      console.error('同步任务执行失败:', err)
    })
    
    return success(res, {
      message: '文件已上传，同步任务已启动',
      status: 'running',
      files: {
        nomenclature: nomenclatureBuffer ? true : false,
        duties: dutiesBuffer ? true : false
      }
    })
  } catch (error) {
    if (error.message.includes('正在运行')) {
      return badRequest(res, error.message)
    }
    console.error('上传同步失败:', error)
    return serverError(res, '上传同步失败: ' + error.message)
  }
}

// ==================== 数据查询 ====================

/**
 * 查询特定 HS 编码的完整税率信息
 */
export async function lookupHsCode(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry } = req.query
    
    if (!hsCode || hsCode.length < 6) {
      return badRequest(res, '请提供有效的 HS 编码（至少6位）')
    }
    
    // 从 masterdata 模块查询（复用现有接口）
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    let query = `
      SELECT * FROM tariff_rates 
      WHERE (hs_code LIKE ? OR hs_code_10 LIKE ? OR taric_code LIKE ?)
      AND is_active = 1
    `
    const params = [`${hsCode}%`, `${hsCode}%`, `${hsCode}%`]
    
    if (originCountry) {
      query += ' AND (origin_country_code = ? OR geographical_area = ?)'
      params.push(originCountry, originCountry)
    }
    
    query += ' ORDER BY hs_code ASC LIMIT 50'
    
    const rates = await db.prepare(query).all(...params)
    
    // 查询相关贸易协定
    const agreements = await model.getTradeAgreements({
      search: hsCode.substring(0, 4),
      pageSize: 20
    })
    
    return success(res, {
      hsCode,
      rates: rates.map(r => ({
        id: r.id,
        hsCode: r.hs_code,
        hsCode10: r.hs_code_10,
        taricCode: r.taric_code,
        goodsDescription: r.goods_description,
        goodsDescriptionCn: r.goods_description_cn,
        originCountry: r.origin_country,
        originCountryCode: r.origin_country_code,
        geographicalArea: r.geographical_area,
        dutyRate: r.duty_rate,
        thirdCountryDuty: r.third_country_duty,
        vatRate: r.vat_rate,
        preferentialRate: r.preferential_rate,
        antiDumpingRate: r.anti_dumping_rate,
        measureType: r.measure_type,
        startDate: r.start_date,
        endDate: r.end_date,
        dataSource: r.data_source,
        taricVersion: r.taric_version
      })),
      relatedAgreements: agreements.list
    })
  } catch (error) {
    console.error('查询 HS 编码失败:', error)
    return serverError(res, '查询失败')
  }
}

/**
 * 获取贸易协定列表
 */
export async function getTradeAgreements(req, res) {
  try {
    const { countryCode, agreementType, search, page, pageSize } = req.query
    
    const result = await model.getTradeAgreements({
      countryCode,
      agreementType,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取贸易协定失败:', error)
    return serverError(res, '获取贸易协定失败')
  }
}

// ==================== 实时 API 查询 ====================

/**
 * 实时查询单个 HS 编码（从欧盟 TARIC 系统）
 */
export async function lookupHsCodeRealtime(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry, saveToDb } = req.query
    
    if (!hsCode || hsCode.length < 6) {
      return badRequest(res, '请提供有效的 HS 编码（至少6位）')
    }
    
    // 调用 TARIC API
    const result = await apiClient.lookupTaricCode(hsCode, originCountry || '')
    
    // 如果请求保存到数据库
    if (saveToDb === 'true' && result) {
      try {
        const { getDatabase } = await import('../../config/database.js')
        const db = getDatabase()
        
        // 使用10位HS编码进行查询和存储（与数据库保持一致）
        const hsCodeForDb = result.hsCode10 || result.hsCode
        
        // 检查是否已存在（同时匹配8位和10位）
        const existing = await db.prepare(`
          SELECT id FROM tariff_rates 
          WHERE (hs_code = ? OR hs_code = ?) AND COALESCE(origin_country_code, '') = ?
        `).get(hsCodeForDb, result.hsCode, result.originCountryCode || '')
        
        if (existing) {
          // 更新
          await db.prepare(`
            UPDATE tariff_rates SET
              hs_code_10 = COALESCE(?, hs_code_10),
              goods_description = COALESCE(?, goods_description),
              goods_description_cn = COALESCE(?, goods_description_cn),
              third_country_duty = COALESCE(?, third_country_duty),
              duty_rate = COALESCE(?, duty_rate),
              anti_dumping_rate = COALESCE(?, anti_dumping_rate),
              countervailing_rate = COALESCE(?, countervailing_rate),
              has_quota = ?,
              requires_license = ?,
              requires_sps = ?,
              api_source = 'taric_api',
              last_api_sync = NOW(),
              updated_at = NOW()
            WHERE id = ?
          `).run(
            result.hsCode10 || null,
            result.goodsDescription || result.formattedDescription || null,
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.antiDumpingRate ?? null,
            result.countervailingRate ?? null,
            result.hasQuota ? 1 : 0,
            result.requiresLicense ? 1 : 0,
            result.requiresSPS ? 1 : 0,
            existing.id
          )
          result.savedToDb = 'updated'
        } else {
          // 插入新记录（使用10位HS编码）
          await db.prepare(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, origin_country_code,
              goods_description, goods_description_cn,
              third_country_duty, duty_rate, vat_rate,
              anti_dumping_rate, countervailing_rate,
              has_quota, requires_license, requires_sps,
              api_source, last_api_sync, data_source, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 19, ?, ?, ?, ?, ?, 'taric_api', NOW(), 'taric', 1)
          `).run(
            hsCodeForDb,  // 使用10位HS编码
            result.hsCode10 || null,
            result.originCountryCode || null,
            result.goodsDescription || result.formattedDescription || 'No description',
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.antiDumpingRate ?? null,
            result.countervailingRate ?? null,
            result.hasQuota ? 1 : 0,
            result.requiresLicense ? 1 : 0,
            result.requiresSPS ? 1 : 0
          )
          result.savedToDb = 'inserted'
        }
      } catch (dbError) {
        console.error('保存到数据库失败:', dbError)
        result.savedToDb = 'failed'
        result.dbError = dbError.message
      }
    }
    
    return success(res, result)
  } catch (error) {
    console.error('实时查询失败:', error)
    return serverError(res, '实时查询失败: ' + error.message)
  }
}

/**
 * 批量实时查询 HS 编码
 */
export async function batchLookupRealtime(req, res) {
  try {
    const { hsCodes, originCountry, concurrency = 3 } = req.body
    
    if (!hsCodes || !Array.isArray(hsCodes) || hsCodes.length === 0) {
      return badRequest(res, '请提供 HS 编码数组')
    }
    
    if (hsCodes.length > 50) {
      return badRequest(res, '批量查询最多支持 50 个 HS 编码')
    }
    
    const result = await apiClient.batchLookup(hsCodes, originCountry || '', { concurrency })
    
    return success(res, result)
  } catch (error) {
    console.error('批量实时查询失败:', error)
    return serverError(res, '批量查询失败: ' + error.message)
  }
}

/**
 * 获取 HS 编码的贸易措施详情
 */
export async function getMeasures(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry } = req.query
    
    if (!hsCode || hsCode.length < 6) {
      return badRequest(res, '请提供有效的 HS 编码（至少6位）')
    }
    
    const result = await apiClient.getMeasureDetails(hsCode, originCountry || '')
    
    return success(res, result)
  } catch (error) {
    console.error('获取贸易措施失败:', error)
    return serverError(res, '获取贸易措施失败: ' + error.message)
  }
}

/**
 * 获取国家/地区代码列表
 */
export async function getCountryCodes(req, res) {
  try {
    const result = await apiClient.getCountryCodes()
    return success(res, result)
  } catch (error) {
    console.error('获取国家代码失败:', error)
    return serverError(res, '获取国家代码失败: ' + error.message)
  }
}

/**
 * 检查 TARIC API 健康状态
 */
export async function checkApiHealth(req, res) {
  try {
    const result = await apiClient.checkApiHealth()
    return success(res, result)
  } catch (error) {
    console.error('API 健康检查失败:', error)
    return serverError(res, 'API 健康检查失败: ' + error.message)
  }
}

/**
 * 清除 API 缓存
 */
export async function clearApiCache(req, res) {
  try {
    apiClient.clearCache()
    return success(res, { message: '缓存已清除' })
  } catch (error) {
    console.error('清除缓存失败:', error)
    return serverError(res, '清除缓存失败')
  }
}

// ==================== 文件管理 ====================

/**
 * 获取本地数据文件状态
 */
export async function getFileStatus(req, res) {
  try {
    const status = downloader.checkLocalFiles()
    return success(res, status)
  } catch (error) {
    console.error('获取文件状态失败:', error)
    return serverError(res, '获取文件状态失败')
  }
}

/**
 * 下载数据文件模板
 */
export async function downloadTemplate(req, res) {
  try {
    const { type } = req.params
    
    // 返回模板说明和下载链接
    const templates = {
      nomenclature: {
        name: 'TARIC Nomenclature Template',
        description: '商品分类编码模板（包含 CN8 编码和商品描述）',
        columns: ['CN8', 'Description', 'Description_CN'],
        sampleData: [
          ['61091000', 'T-shirts, singlets and other vests, of cotton, knitted', '棉制针织T恤衫'],
          ['84713000', 'Portable automatic data-processing machines', '便携式自动数据处理设备']
        ],
        officialDownloadUrl: 'https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa'
      },
      duties: {
        name: 'TARIC Duties Template',
        description: '关税税率模板（包含关税率、优惠税率等）',
        columns: ['CN8', 'ThirdCountryDuty', 'PreferentialDuty', 'MeasureType', 'GeographicalArea', 'StartDate', 'EndDate'],
        sampleData: [
          ['61091000', '12', '0', '103', 'GSP', '2024-01-01', '2024-12-31'],
          ['84713000', '0', '0', '103', '1011', '2024-01-01', '']
        ],
        officialDownloadUrl: 'https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa'
      }
    }
    
    if (!templates[type]) {
      return badRequest(res, '未知的模板类型')
    }
    
    return success(res, templates[type])
  } catch (error) {
    console.error('获取模板失败:', error)
    return serverError(res, '获取模板失败')
  }
}

// ==================== 翻译功能 ====================

/**
 * 触发翻译任务（异步）
 * 将数据库中所有没有中文描述的记录进行翻译
 */
export async function triggerTranslation(req, res) {
  try {
    const status = translator.getTranslateStatus()
    
    if (status.running) {
      return badRequest(res, '翻译任务正在运行中，请等待完成')
    }
    
    // 异步执行翻译任务
    runTranslationTask().catch(error => {
      console.error('[翻译API] 翻译任务失败:', error.message)
    })
    
    return success(res, {
      message: '翻译任务已启动',
      status: 'started'
    })
  } catch (error) {
    console.error('启动翻译任务失败:', error)
    return serverError(res, '启动翻译任务失败')
  }
}

/**
 * 执行翻译任务的具体实现
 */
async function runTranslationTask() {
  const { getDatabase } = await import('../../config/database.js')
  const db = getDatabase()
  
  console.log('[翻译任务] 开始执行...')
  
  // 获取所有没有中文描述的记录
  const records = await db.prepare(`
    SELECT id, hs_code, goods_description 
    FROM tariff_rates 
    WHERE goods_description IS NOT NULL 
      AND goods_description != ''
      AND (goods_description_cn IS NULL OR goods_description_cn = '')
    ORDER BY id
  `).all()
  
  console.log(`[翻译任务] 找到 ${records.length} 条需要翻译的记录`)
  
  if (records.length === 0) {
    console.log('[翻译任务] 没有需要翻译的记录')
    return
  }
  
  // 提取唯一的描述
  const uniqueDescriptions = [...new Set(records.map(r => r.goods_description).filter(d => d))]
  console.log(`[翻译任务] 共 ${uniqueDescriptions.length} 个不重复的描述`)
  
  // 执行翻译
  const translationMap = new Map()
  const batchSize = 5
  const delayMs = 1000
  let completed = 0
  let failed = 0
  
  for (let i = 0; i < uniqueDescriptions.length; i += batchSize) {
    const batch = uniqueDescriptions.slice(i, i + batchSize)
    
    const translations = await Promise.all(
      batch.map(desc => translator.translateText(desc, 'en', 'zh-CN'))
    )
    
    batch.forEach((desc, idx) => {
      if (translations[idx]) {
        translationMap.set(desc, translations[idx])
        completed++
      } else {
        failed++
      }
    })
    
    // 进度日志
    if ((i + batchSize) % 50 === 0 || i + batchSize >= uniqueDescriptions.length) {
      console.log(`[翻译任务] 进度: ${Math.min(i + batchSize, uniqueDescriptions.length)}/${uniqueDescriptions.length}`)
    }
    
    // 每 100 条更新一次数据库
    if ((i + batchSize) % 100 === 0 || i + batchSize >= uniqueDescriptions.length) {
      // 批量更新数据库
      for (const [desc, cnDesc] of translationMap) {
        if (cnDesc) {
          try {
            await db.prepare(`
              UPDATE tariff_rates 
              SET goods_description_cn = $1, updated_at = NOW()
              WHERE goods_description = $2 
                AND (goods_description_cn IS NULL OR goods_description_cn = '')
            `).run(cnDesc, desc)
          } catch (dbError) {
            console.warn(`[翻译任务] 更新数据库失败: ${desc}`, dbError.message)
          }
        }
      }
      translationMap.clear() // 清除已更新的
    }
    
    // 延迟
    if (i + batchSize < uniqueDescriptions.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  console.log(`[翻译任务] 完成! 成功: ${completed}, 失败: ${failed}`)
}

/**
 * 获取翻译任务状态
 */
export async function getTranslationStatus(req, res) {
  try {
    const status = translator.getTranslateStatus()
    
    // 同时获取数据库中的统计
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN goods_description_cn IS NOT NULL AND goods_description_cn != '' THEN 1 END) as translated,
        COUNT(CASE WHEN goods_description_cn IS NULL OR goods_description_cn = '' THEN 1 END) as untranslated
      FROM tariff_rates
      WHERE goods_description IS NOT NULL AND goods_description != ''
    `).get()
    
    return success(res, {
      taskStatus: status,
      dbStats: {
        total: parseInt(stats.total) || 0,
        translated: parseInt(stats.translated) || 0,
        untranslated: parseInt(stats.untranslated) || 0,
        percentage: stats.total > 0 ? ((stats.translated / stats.total) * 100).toFixed(1) : '0'
      }
    })
  } catch (error) {
    console.error('获取翻译状态失败:', error)
    return serverError(res, '获取翻译状态失败')
  }
}

/**
 * 清除翻译缓存
 */
export async function clearTranslationCache(req, res) {
  try {
    translator.clearTranslationCache()
    return success(res, { message: '翻译缓存已清除' })
  } catch (error) {
    console.error('清除翻译缓存失败:', error)
    return serverError(res, '清除翻译缓存失败')
  }
}

// ==================== 中国反倾销税查询 ====================

/**
 * 获取中国反倾销税摘要
 */
export async function getChinaAntiDumpingSummary(req, res) {
  try {
    const { getAntiDumpingSummary } = await import('./chinaAntiDumpingRates.js')
    const summary = getAntiDumpingSummary()
    return success(res, summary)
  } catch (error) {
    console.error('获取中国反倾销税摘要失败:', error)
    return serverError(res, '获取中国反倾销税摘要失败')
  }
}

/**
 * 获取所有中国反倾销税 HS 编码列表
 */
export async function getChinaAntiDumpingCodes(req, res) {
  try {
    const { getAntiDumpingHsCodes } = await import('./chinaAntiDumpingRates.js')
    const codes = getAntiDumpingHsCodes()
    return success(res, {
      total: codes.length,
      codes
    })
  } catch (error) {
    console.error('获取中国反倾销税编码列表失败:', error)
    return serverError(res, '获取中国反倾销税编码列表失败')
  }
}

/**
 * 查询单个 HS 编码的中国反倾销税
 */
export async function lookupChinaAntiDumping(req, res) {
  try {
    const { hsCode } = req.params
    
    if (!hsCode || hsCode.length < 4) {
      return badRequest(res, '请提供至少4位的HS编码')
    }
    
    const { findChinaAntiDumpingRate } = await import('./chinaAntiDumpingRates.js')
    const result = findChinaAntiDumpingRate(hsCode)
    
    if (!result) {
      return success(res, {
        found: false,
        hsCode,
        message: '该编码暂无中国原产地反倾销税记录',
        note: '可能该产品无反倾销措施，或数据尚未更新'
      })
    }
    
    return success(res, {
      found: true,
      ...result
    })
  } catch (error) {
    console.error('查询中国反倾销税失败:', error)
    return serverError(res, '查询中国反倾销税失败')
  }
}

// ==================== UK Trade Tariff API 查询 ====================

/**
 * 实时查询单个 HS 编码（从 UK Trade Tariff API）
 * 支持 UK 和 XI（北爱尔兰）两个数据集
 */
export async function lookupHsCodeUk(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry, region = 'uk', saveToDb } = req.query
    
    if (!hsCode || hsCode.length < 6) {
      return badRequest(res, '请提供有效的 HS 编码（至少6位）')
    }
    
    // 验证 region 参数
    const validRegions = ['uk', 'xi']
    if (!validRegions.includes(region)) {
      return badRequest(res, '无效的地区参数，请使用 uk 或 xi')
    }
    
    // 调用 UK Trade Tariff API
    const result = await ukApiClient.lookupUkTaricCode(hsCode, originCountry || '', region)
    
    // 如果请求保存到数据库
    if (saveToDb === 'true' && result) {
      try {
        const { getDatabase } = await import('../../config/database.js')
        const db = getDatabase()
        
        // 使用10位HS编码进行查询和存储（与数据库保持一致）
        const hsCodeForDb = result.hsCode10 || result.hsCode
        
        // 检查是否已存在（同时匹配8位和10位）
        const existing = await db.prepare(`
          SELECT id FROM tariff_rates 
          WHERE (hs_code = ? OR hs_code = ?) AND COALESCE(origin_country_code, '') = ? AND data_source = ?
        `).get(hsCodeForDb, result.hsCode, result.originCountryCode || '', result.dataSource)
        
        if (existing) {
          // 更新
          await db.prepare(`
            UPDATE tariff_rates SET
              hs_code_10 = COALESCE(?, hs_code_10),
              goods_description = COALESCE(?, goods_description),
              goods_description_cn = COALESCE(?, goods_description_cn),
              third_country_duty = COALESCE(?, third_country_duty),
              duty_rate = COALESCE(?, duty_rate),
              anti_dumping_rate = COALESCE(?, anti_dumping_rate),
              vat_rate = COALESCE(?, vat_rate),
              api_source = ?,
              last_api_sync = NOW(),
              updated_at = NOW()
            WHERE id = ?
          `).run(
            result.hsCode10 || null,
            result.goodsDescription || result.formattedDescription || null,
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.antiDumpingRate ?? null,
            result.vatRate ?? null,
            result.dataSource,
            existing.id
          )
          result.savedToDb = 'updated'
        } else {
          // 插入新记录（使用10位HS编码）
          await db.prepare(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, origin_country_code,
              goods_description, goods_description_cn,
              third_country_duty, duty_rate, vat_rate,
              anti_dumping_rate, api_source, last_api_sync, data_source, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)
          `).run(
            hsCodeForDb,  // 使用10位HS编码
            result.hsCode10 || null,
            result.originCountryCode || null,
            result.goodsDescription || result.formattedDescription || 'No description',
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.vatRate ?? null,
            result.antiDumpingRate ?? null,
            result.dataSource,
            result.dataSource
          )
          result.savedToDb = 'inserted'
        }
      } catch (dbError) {
        console.error('保存到数据库失败:', dbError)
        result.savedToDb = 'failed'
        result.dbError = dbError.message
      }
    }
    
    return success(res, result)
  } catch (error) {
    console.error('UK Trade Tariff API 查询失败:', error)
    return serverError(res, 'UK Trade Tariff API 查询失败: ' + error.message)
  }
}

/**
 * 批量实时查询 UK HS 编码
 */
export async function batchLookupUk(req, res) {
  try {
    const { hsCodes, originCountry, region = 'uk', concurrency = 5 } = req.body
    
    if (!hsCodes || !Array.isArray(hsCodes) || hsCodes.length === 0) {
      return badRequest(res, '请提供 HS 编码数组')
    }
    
    if (hsCodes.length > 50) {
      return badRequest(res, '批量查询最多支持 50 个 HS 编码')
    }
    
    const validRegions = ['uk', 'xi']
    if (!validRegions.includes(region)) {
      return badRequest(res, '无效的地区参数，请使用 uk 或 xi')
    }
    
    const result = await ukApiClient.batchLookupUk(hsCodes, originCountry || '', region, { concurrency })
    
    return success(res, result)
  } catch (error) {
    console.error('UK Trade Tariff API 批量查询失败:', error)
    return serverError(res, '批量查询失败: ' + error.message)
  }
}

/**
 * 搜索 UK 商品
 */
export async function searchUkCommodities(req, res) {
  try {
    const { q, region = 'uk' } = req.query
    
    if (!q || q.length < 2) {
      return badRequest(res, '请提供至少2个字符的搜索关键词')
    }
    
    const validRegions = ['uk', 'xi']
    if (!validRegions.includes(region)) {
      return badRequest(res, '无效的地区参数，请使用 uk 或 xi')
    }
    
    const result = await ukApiClient.searchUkCommodities(q, region)
    
    return success(res, result)
  } catch (error) {
    console.error('UK Trade Tariff 搜索失败:', error)
    return serverError(res, '搜索失败: ' + error.message)
  }
}

/**
 * 获取 UK 章节列表
 */
export async function getUkChapters(req, res) {
  try {
    const { region = 'uk' } = req.query
    
    const validRegions = ['uk', 'xi']
    if (!validRegions.includes(region)) {
      return badRequest(res, '无效的地区参数，请使用 uk 或 xi')
    }
    
    const result = await ukApiClient.getUkChapters(region)
    return success(res, result)
  } catch (error) {
    console.error('获取 UK 章节列表失败:', error)
    return serverError(res, '获取章节列表失败: ' + error.message)
  }
}

/**
 * 检查 UK Trade Tariff API 健康状态
 */
export async function checkUkApiHealth(req, res) {
  try {
    const result = await ukApiClient.checkUkApiHealth()
    return success(res, result)
  } catch (error) {
    console.error('UK API 健康检查失败:', error)
    return serverError(res, 'UK API 健康检查失败: ' + error.message)
  }
}

/**
 * 清除 UK API 缓存
 */
export async function clearUkApiCache(req, res) {
  try {
    ukApiClient.clearCache()
    return success(res, { message: 'UK API 缓存已清除' })
  } catch (error) {
    console.error('清除 UK API 缓存失败:', error)
    return serverError(res, '清除缓存失败')
  }
}

/**
 * 统一实时查询接口（支持 EU 和 UK）
 * 根据 source 参数选择数据源
 */
export async function lookupHsCodeUnified(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry, source = 'eu', region = 'uk', saveToDb } = req.query
    
    if (!hsCode || hsCode.length < 6) {
      return badRequest(res, '请提供有效的 HS 编码（至少6位）')
    }
    
    let result
    
    if (source === 'uk') {
      // 使用 UK Trade Tariff API
      const validRegions = ['uk', 'xi']
      if (!validRegions.includes(region)) {
        return badRequest(res, '无效的地区参数，请使用 uk 或 xi')
      }
      result = await ukApiClient.lookupUkTaricCode(hsCode, originCountry || '', region)
    } else {
      // 使用 EU TARIC（默认）
      result = await apiClient.lookupTaricCode(hsCode, originCountry || '')
    }
    
    // 如果请求保存到数据库
    if (saveToDb === 'true' && result) {
      try {
        const { getDatabase } = await import('../../config/database.js')
        const db = getDatabase()
        
        const dataSourceValue = result.dataSource || (source === 'uk' ? 'uk_api' : 'taric_api')
        
        // 优先使用用户原始查询的编码，这样搜索时能匹配到用户输入
        // originalHsCode: 用户输入的原始编码（如 3920109090）
        // hsCode10: 系统匹配到的10位编码（如 3920102300）
        const originalCode = result.originalHsCode || hsCode  // 用户原始查询编码
        const matchedCode10 = result.hsCode10 || result.hsCode  // 系统匹配的10位编码
        
        // 检查是否已存在（同时匹配原始编码和系统匹配编码）
        const existing = await db.prepare(`
          SELECT id FROM tariff_rates 
          WHERE (hs_code = ? OR hs_code = ? OR hs_code_10 = ?) 
            AND COALESCE(origin_country_code, '') = ?
        `).get(originalCode, matchedCode10, matchedCode10, result.originCountryCode || '')
        
        if (existing) {
          // 更新
          await db.prepare(`
            UPDATE tariff_rates SET
              hs_code_10 = COALESCE(?, hs_code_10),
              goods_description = COALESCE(?, goods_description),
              goods_description_cn = COALESCE(?, goods_description_cn),
              third_country_duty = COALESCE(?, third_country_duty),
              duty_rate = COALESCE(?, duty_rate),
              anti_dumping_rate = COALESCE(?, anti_dumping_rate),
              vat_rate = COALESCE(?, vat_rate),
              api_source = ?,
              last_api_sync = NOW(),
              updated_at = NOW()
            WHERE id = ?
          `).run(
            matchedCode10 || null,
            result.goodsDescription || result.formattedDescription || null,
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.antiDumpingRate ?? null,
            result.vatRate ?? null,
            dataSourceValue,
            existing.id
          )
          result.savedToDb = 'updated'
        } else {
          // 插入新记录
          // hs_code 保存用户原始查询编码（便于搜索）
          // hs_code_10 保存系统匹配的10位编码（标准编码）
          await db.prepare(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, origin_country_code,
              goods_description, goods_description_cn,
              third_country_duty, duty_rate, vat_rate,
              anti_dumping_rate, api_source, last_api_sync, data_source, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)
          `).run(
            originalCode,  // 使用用户原始查询编码，便于搜索
            matchedCode10 || null,  // 系统匹配的10位标准编码
            result.originCountryCode || null,
            result.goodsDescription || result.formattedDescription || 'No description',
            result.goodsDescriptionCn || null,
            result.thirdCountryDuty ?? null,
            result.dutyRate ?? null,
            result.vatRate ?? null,
            result.antiDumpingRate ?? null,
            dataSourceValue,
            dataSourceValue
          )
          result.savedToDb = 'inserted'
        }
      } catch (dbError) {
        console.error('保存到数据库失败:', dbError)
        result.savedToDb = 'failed'
        result.dbError = dbError.message
      }
    }
    
    return success(res, result)
  } catch (error) {
    console.error('统一 API 查询失败:', error)
    return serverError(res, '查询失败: ' + error.message)
  }
}

/**
 * 获取所有数据源的健康状态
 */
export async function checkAllApiHealth(req, res) {
  try {
    // 并行检查 EU 和 UK API 状态
    const [euHealth, ukHealth] = await Promise.allSettled([
      apiClient.checkApiHealth(),
      ukApiClient.checkUkApiHealth()
    ])
    
    return success(res, {
      eu: euHealth.status === 'fulfilled' ? euHealth.value : { available: false, error: euHealth.reason?.message },
      uk: ukHealth.status === 'fulfilled' ? ukHealth.value : { available: false, error: ukHealth.reason?.message },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('API 健康检查失败:', error)
    return serverError(res, 'API 健康检查失败: ' + error.message)
  }
}

// ==================== HS 编码验证和改进查询 V2 API ====================

/**
 * 验证 HS 编码有效性
 * GET /api/taric/validate/:hsCode
 */
export async function validateHsCodeApi(req, res) {
  try {
    const { hsCode } = req.params
    
    if (!hsCode || hsCode.length < 2) {
      return badRequest(res, '请提供有效的 HS 编码（至少2位）')
    }
    
    const result = await apiClient.validateHsCode(hsCode)
    return success(res, result)
  } catch (error) {
    console.error('HS 编码验证失败:', error)
    return serverError(res, 'HS 编码验证失败: ' + error.message)
  }
}

/**
 * 获取 HS 编码层级树
 * GET /api/taric/hierarchy/:prefix
 */
export async function getHsCodeHierarchy(req, res) {
  try {
    const { prefix } = req.params
    const { originCountry } = req.query
    
    if (!prefix || prefix.length < 2) {
      return badRequest(res, '请提供有效的编码前缀（至少2位）')
    }
    
    const result = await apiClient.getHsCodeHierarchy(prefix, originCountry || '')
    return success(res, result)
  } catch (error) {
    console.error('获取 HS 编码层级失败:', error)
    return serverError(res, '获取 HS 编码层级失败: ' + error.message)
  }
}

/**
 * 搜索商品描述
 * GET /api/taric/search?q=xxx&chapter=xx&page=1&pageSize=20
 */
export async function searchHsCodes(req, res) {
  try {
    const { q, chapter, page, pageSize, originCountry } = req.query
    
    if (!q || q.length < 2) {
      return badRequest(res, '请提供至少2个字符的搜索关键词')
    }
    
    const result = await apiClient.searchHsCodes(q, {
      chapter,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      originCountry
    })
    
    return success(res, result)
  } catch (error) {
    console.error('商品搜索失败:', error)
    return serverError(res, '商品搜索失败: ' + error.message)
  }
}

/**
 * 改进的 HS 编码查询（V2版本）
 * GET /api/taric/lookup-v2/:hsCode?originCountry=CN
 */
export async function lookupHsCodeV2(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry, saveToDb } = req.query
    
    if (!hsCode || hsCode.length < 4) {
      return badRequest(res, '请提供有效的 HS 编码（至少4位）')
    }
    
    const result = await apiClient.lookupTaricCodeV2(hsCode, originCountry || '')
    
    // 如果请求保存精确匹配结果到数据库
    if (saveToDb === 'true' && result.exactMatch) {
      try {
        const { getDatabase } = await import('../../config/database.js')
        const db = getDatabase()
        
        const exactMatch = result.exactMatch
        const hsCodeForDb = exactMatch.hsCode10 || exactMatch.hsCode
        
        // 检查是否已存在
        const existing = await db.prepare(`
          SELECT id FROM tariff_rates 
          WHERE (hs_code = ? OR hs_code = ?) AND COALESCE(origin_country_code, '') = ?
        `).get(hsCodeForDb, exactMatch.hsCode, exactMatch.originCountryCode || '')
        
        if (existing) {
          await db.prepare(`
            UPDATE tariff_rates SET
              hs_code_10 = COALESCE(?, hs_code_10),
              goods_description = COALESCE(?, goods_description),
              goods_description_cn = COALESCE(?, goods_description_cn),
              third_country_duty = COALESCE(?, third_country_duty),
              duty_rate = COALESCE(?, duty_rate),
              anti_dumping_rate = COALESCE(?, anti_dumping_rate),
              api_source = 'taric_api_v2',
              last_api_sync = NOW(),
              updated_at = NOW()
            WHERE id = ?
          `).run(
            exactMatch.hsCode10 || null,
            exactMatch.goodsDescription || null,
            exactMatch.goodsDescriptionCn || null,
            exactMatch.thirdCountryDuty ?? null,
            exactMatch.dutyRate ?? null,
            exactMatch.antiDumpingRate ?? null,
            existing.id
          )
          result.savedToDb = 'updated'
        } else {
          await db.prepare(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, origin_country_code,
              goods_description, goods_description_cn,
              third_country_duty, duty_rate, vat_rate,
              anti_dumping_rate, api_source, last_api_sync, data_source, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 19, ?, 'taric_api_v2', NOW(), 'taric', 1)
          `).run(
            hsCodeForDb,
            exactMatch.hsCode10 || null,
            exactMatch.originCountryCode || null,
            exactMatch.goodsDescription || 'No description',
            exactMatch.goodsDescriptionCn || null,
            exactMatch.thirdCountryDuty ?? null,
            exactMatch.dutyRate ?? null,
            exactMatch.antiDumpingRate ?? null
          )
          result.savedToDb = 'inserted'
        }
      } catch (dbError) {
        console.error('保存到数据库失败:', dbError)
        result.savedToDb = 'failed'
        result.dbError = dbError.message
      }
    }
    
    return success(res, result)
  } catch (error) {
    console.error('HS 编码查询 V2 失败:', error)
    return serverError(res, 'HS 编码查询失败: ' + error.message)
  }
}

/**
 * 获取可申报编码列表
 * GET /api/taric/declarable/:prefix?originCountry=CN
 */
export async function getDeclarableCodes(req, res) {
  try {
    const { prefix } = req.params
    const { originCountry } = req.query
    
    if (!prefix || prefix.length < 4) {
      return badRequest(res, '请提供有效的编码前缀（至少4位）')
    }
    
    const result = await apiClient.getDeclarableCodes(prefix, originCountry || '')
    return success(res, {
      prefix,
      total: result.length,
      codes: result
    })
  } catch (error) {
    console.error('获取可申报编码失败:', error)
    return serverError(res, '获取可申报编码失败: ' + error.message)
  }
}

// ==================== 导出 ====================

export default {
  getSyncStatus,
  getSyncHistory,
  triggerSync,
  uploadAndSync,
  lookupHsCode,
  getTradeAgreements,
  getFileStatus,
  downloadTemplate,
  // 实时 API 查询（EU TARIC）
  lookupHsCodeRealtime,
  batchLookupRealtime,
  getMeasures,
  getCountryCodes,
  checkApiHealth,
  clearApiCache,
  // UK Trade Tariff API 查询
  lookupHsCodeUk,
  batchLookupUk,
  searchUkCommodities,
  getUkChapters,
  checkUkApiHealth,
  clearUkApiCache,
  // 统一查询接口
  lookupHsCodeUnified,
  checkAllApiHealth,
  // 翻译功能
  triggerTranslation,
  getTranslationStatus,
  clearTranslationCache,
  // 中国反倾销税查询
  getChinaAntiDumpingSummary,
  getChinaAntiDumpingCodes,
  lookupChinaAntiDumping,
  // V2 改进 API
  validateHsCodeApi,
  getHsCodeHierarchy,
  searchHsCodes,
  lookupHsCodeV2,
  getDeclarableCodes
}
