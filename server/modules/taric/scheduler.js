/**
 * TARIC 同步调度器
 * 支持手动触发和定时自动同步
 */

import * as model from './model.js'
import * as downloader from './downloader.js'
import * as parser from './parser.js'
import { translateGoodsDescriptions } from './translator.js'

// 同步状态（内存中保存当前运行的同步任务）
let currentSync = null
let syncInterval = null

// ==================== 同步核心逻辑 ====================

/**
 * 执行 TARIC 数据同步
 * @param {Object} options - 同步选项
 * @param {string} options.syncType - 同步类型: full(全量) / incremental(增量)
 * @param {string} options.dataSource - 数据源: excel / upload
 * @param {Buffer} options.nomenclatureBuffer - 上传的 Nomenclature 文件
 * @param {Buffer} options.dutiesBuffer - 上传的 Duties 文件
 * @param {string} options.createdBy - 创建人ID
 * @returns {Promise<Object>} 同步结果
 */
export async function runSync(options = {}) {
  const {
    syncType = 'full',
    dataSource = 'excel',
    nomenclatureBuffer,
    dutiesBuffer,
    createdBy
  } = options
  
  // 检查是否有正在运行的同步任务
  if (currentSync) {
    throw new Error('已有同步任务正在运行，请稍后再试')
  }
  
  // 创建同步日志
  const syncLog = await model.createSyncLog({
    syncType,
    dataSource,
    createdBy
  })
  
  currentSync = {
    id: syncLog.id,
    startTime: Date.now()
  }
  
  try {
    console.log(`[TARIC同步] 开始同步 (ID: ${syncLog.id}, 类型: ${syncType})`)
    
    // 获取数据文件
    let nomenclatureData = null
    let dutiesData = null
    
    if (dataSource === 'upload') {
      // 使用上传的文件
      if (nomenclatureBuffer) {
        nomenclatureData = nomenclatureBuffer
      }
      if (dutiesBuffer) {
        dutiesData = dutiesBuffer
      }
    } else {
      // 从本地文件读取
      nomenclatureData = downloader.readLocalFile('nomenclature')
      dutiesData = downloader.readLocalFile('duties')
    }
    
    if (!nomenclatureData && !dutiesData) {
      throw new Error('未找到可用的 TARIC 数据文件，请先上传或下载数据文件')
    }
    
    // 获取版本号
    const taricVersion = downloader.getTaricVersion()
    await model.updateSyncLog(syncLog.id, { taricVersion })
    
    // 解析数据
    let tariffRates = []
    
    if (nomenclatureData) {
      console.log('[TARIC同步] 解析 Nomenclature 文件...')
      await model.updateSyncLog(syncLog.id, { progress: 10 })
      
      const nomenclature = parser.parseNomenclatureExcel(nomenclatureData)
      console.log(`[TARIC同步] Nomenclature 解析完成: ${nomenclature.length} 条`)
      
      if (dutiesData) {
        console.log('[TARIC同步] 解析 Duties 文件...')
        await model.updateSyncLog(syncLog.id, { progress: 30 })
        
        const duties = parser.parseDutiesExcel(dutiesData)
        console.log(`[TARIC同步] Duties 解析完成: ${duties.length} 条`)
        
        // 合并数据
        console.log('[TARIC同步] 合并数据...')
        await model.updateSyncLog(syncLog.id, { progress: 40 })
        tariffRates = parser.mergeNomenclatureAndDuties(nomenclature, duties)
      } else {
        tariffRates = nomenclature
      }
    } else if (dutiesData) {
      console.log('[TARIC同步] 仅解析 Duties 文件...')
      await model.updateSyncLog(syncLog.id, { progress: 30 })
      tariffRates = parser.parseDutiesExcel(dutiesData)
    }
    
    const totalRecords = tariffRates.length
    await model.updateSyncLog(syncLog.id, { 
      totalRecords,
      progress: 45 
    })
    
    // 翻译商品描述（英文 -> 中文）
    if (tariffRates.length > 0 && options.enableTranslation !== false) {
      console.log(`[TARIC同步] 开始翻译商品描述...`)
      await model.updateSyncLog(syncLog.id, { progress: 48 })
      
      try {
        tariffRates = await translateGoodsDescriptions(tariffRates, (current, total) => {
          // 更新翻译进度（48-55%）
          const translationProgress = 48 + Math.round((current / total) * 7)
          model.updateSyncLog(syncLog.id, { progress: translationProgress })
        })
        console.log(`[TARIC同步] 商品描述翻译完成`)
      } catch (translateError) {
        console.warn('[TARIC同步] 翻译过程出现错误，继续导入:', translateError.message)
      }
    }
    
    await model.updateSyncLog(syncLog.id, { progress: 55 })
    console.log(`[TARIC同步] 准备导入 ${totalRecords} 条税率数据...`)
    
    // 批量导入税率数据
    const batchSize = 500
    let insertedCount = 0
    let updatedCount = 0
    let failedCount = 0
    
    for (let i = 0; i < tariffRates.length; i += batchSize) {
      const batch = tariffRates.slice(i, i + batchSize)
      const result = await model.upsertTariffRates(batch, syncLog.id, taricVersion)
      
      insertedCount += result.insertedCount
      updatedCount += result.updatedCount
      failedCount += result.failedCount
      
      // 更新进度
      const progress = 55 + Math.round((i / tariffRates.length) * 35)
      await model.updateSyncLog(syncLog.id, {
        progress,
        insertedCount,
        updatedCount,
        failedCount
      })
      
      // 每处理 2000 条打印进度
      if ((i + batchSize) % 2000 === 0 || i + batchSize >= tariffRates.length) {
        console.log(`[TARIC同步] 进度: ${Math.min(i + batchSize, tariffRates.length)}/${tariffRates.length}`)
      }
    }
    
    // 提取并导入贸易协定
    console.log('[TARIC同步] 提取贸易协定信息...')
    await model.updateSyncLog(syncLog.id, { progress: 95 })
    
    const agreements = parser.extractTradeAgreements(tariffRates)
    if (agreements.length > 0) {
      const agreementResult = await model.upsertTradeAgreements(agreements, taricVersion)
      console.log(`[TARIC同步] 贸易协定: 新增 ${agreementResult.insertedCount}, 更新 ${agreementResult.updatedCount}`)
    }
    
    // 完成同步
    await model.updateSyncLog(syncLog.id, {
      status: 'completed',
      progress: 100,
      insertedCount,
      updatedCount,
      failedCount
    })
    
    const duration = Math.round((Date.now() - currentSync.startTime) / 1000)
    console.log(`[TARIC同步] 同步完成！耗时 ${duration}s, 新增 ${insertedCount}, 更新 ${updatedCount}, 失败 ${failedCount}`)
    
    return {
      success: true,
      syncId: syncLog.id,
      totalRecords,
      insertedCount,
      updatedCount,
      failedCount,
      duration,
      taricVersion
    }
    
  } catch (error) {
    console.error('[TARIC同步] 同步失败:', error)
    
    await model.updateSyncLog(syncLog.id, {
      status: 'failed',
      errorMessage: error.message
    })
    
    throw error
    
  } finally {
    currentSync = null
  }
}

/**
 * 获取当前同步状态
 */
export function getCurrentSyncStatus() {
  return currentSync
}

/**
 * 取消当前同步
 * 注：当前版本暂不支持取消正在进行的同步任务
 */
export function cancelSync() {
  throw new Error('暂不支持取消同步')
}

// ==================== 定时任务 ====================

/**
 * 启动定时同步任务
 * @param {Object} options - 配置选项
 * @param {string} options.cron - cron 表达式（简化版：每天几点）
 * @param {number} options.hour - 每天执行的小时（0-23）
 */
export function startScheduler(options = {}) {
  const { hour = 2 } = options // 默认凌晨2点
  
  // 清除旧的定时器
  if (syncInterval) {
    clearInterval(syncInterval)
  }
  
  // 计算到下次执行的时间
  const now = new Date()
  const next = new Date()
  next.setHours(hour, 0, 0, 0)
  
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  
  const msToNext = next.getTime() - now.getTime()
  
  console.log(`[TARIC调度] 定时任务已启动，下次执行时间: ${next.toLocaleString('zh-CN')}`)
  
  // 首次执行（延迟到指定时间）
  setTimeout(() => {
    runScheduledSync()
    
    // 之后每24小时执行一次
    syncInterval = setInterval(runScheduledSync, 24 * 60 * 60 * 1000)
  }, msToNext)
  
  return {
    nextRun: next.toISOString(),
    hour
  }
}

/**
 * 停止定时同步任务
 */
export function stopScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.log('[TARIC调度] 定时任务已停止')
  }
}

/**
 * 执行定时同步
 */
async function runScheduledSync() {
  console.log('[TARIC调度] 开始执行定时同步...')
  
  try {
    // 检查是否有本地数据文件
    const fileStatus = downloader.checkLocalFiles()
    const hasNomenclature = fileStatus.nomenclature?.exists
    const hasDuties = fileStatus.duties?.exists
    
    if (!hasNomenclature && !hasDuties) {
      console.log('[TARIC调度] 未找到本地数据文件，跳过同步')
      return
    }
    
    await runSync({
      syncType: 'incremental',
      dataSource: 'excel',
      createdBy: 'scheduler'
    })
    
    console.log('[TARIC调度] 定时同步完成')
    
  } catch (error) {
    console.error('[TARIC调度] 定时同步失败:', error.message)
  }
}

// ==================== 导出 ====================

export default {
  runSync,
  getCurrentSyncStatus,
  cancelSync,
  startScheduler,
  stopScheduler
}
