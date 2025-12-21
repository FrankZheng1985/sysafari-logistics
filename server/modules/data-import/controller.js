/**
 * 数据导入模块 - 控制器
 * 支持订单、费用、客户、服务商、HS记录的Excel导入
 */

import { success, error, serverError } from '../../utils/response.js'
import * as orderParser from './parsers/orderParser.js'
import * as feeParser from './parsers/feeParser.js'
import * as receivableFeeParser from './parsers/receivableFeeParser.js'
import * as payableFeeParser from './parsers/payableFeeParser.js'
import * as customerParser from './parsers/customerParser.js'
import * as providerParser from './parsers/providerParser.js'
import * as hsRecordParser from './parsers/hsRecordParser.js'
import { getDatabase, generateId } from '../../config/database.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 解析器映射
const PARSERS = {
  orders: orderParser,
  fees: feeParser,
  receivable_fees: receivableFeeParser,
  payable_fees: payableFeeParser,
  customers: customerParser,
  providers: providerParser,
  hs_records: hsRecordParser
}

// 类型名称映射
const TYPE_NAMES = {
  orders: '订单数据',
  fees: '费用数据',
  receivable_fees: '应收费用',
  payable_fees: '应付费用',
  customers: '客户数据',
  providers: '服务商数据',
  hs_records: 'HS匹配记录'
}

/**
 * 下载导入模板
 */
export async function downloadTemplate(req, res) {
  try {
    const { type } = req.params
    
    if (!PARSERS[type]) {
      return error(res, `不支持的导入类型: ${type}`)
    }
    
    const templatePath = path.join(__dirname, 'templates', `${type}_template.xlsx`)
    const fileName = `${TYPE_NAMES[type]}导入模板.xlsx`
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    
    // 生成模板
    const parser = PARSERS[type]
    const templateBuffer = await parser.generateTemplate()
    res.send(templateBuffer)
    
  } catch (err) {
    console.error('下载模板失败:', err)
    return serverError(res, '下载模板失败')
  }
}

/**
 * 预览导入数据
 */
export async function previewImport(req, res) {
  try {
    const { type } = req.params
    const file = req.file
    
    if (!file) {
      return error(res, '请上传文件')
    }
    
    if (!PARSERS[type]) {
      return error(res, `不支持的导入类型: ${type}`)
    }
    
    const parser = PARSERS[type]
    
    // 解析Excel文件
    const parseResult = await parser.parseExcel(file.buffer)
    
    if (!parseResult.success) {
      return error(res, parseResult.error)
    }
    
    // 校验数据
    const validationResult = await parser.validateData(parseResult.data)
    
    // 生成预览ID（用于后续确认导入）
    const previewId = generateId()
    
    // 将预览数据存入内存缓存（实际项目可存入Redis）
    global.importPreviewCache = global.importPreviewCache || {}
    global.importPreviewCache[previewId] = {
      type,
      data: parseResult.data,
      validationResult,
      createdAt: new Date(),
      fileName: file.originalname
    }
    
    // 30分钟后自动清理（延长时间以支持大量数据导入）
    setTimeout(() => {
      if (global.importPreviewCache && global.importPreviewCache[previewId]) {
        delete global.importPreviewCache[previewId]
      }
    }, 30 * 60 * 1000)
    
    return success(res, {
      previewId,
      fileName: file.originalname,
      totalRows: parseResult.data.length,
      validRows: validationResult.validCount,
      errorRows: validationResult.errorCount,
      warningRows: validationResult.warningCount,
      columns: parseResult.columns,
      preview: parseResult.data.slice(0, 100), // 只返回前100条预览
      errors: validationResult.errors.slice(0, 50), // 只返回前50条错误
      warnings: validationResult.warnings.slice(0, 50)
    })
    
  } catch (err) {
    console.error('预览导入失败:', err)
    return serverError(res, '预览导入失败: ' + err.message)
  }
}

/**
 * 确认导入数据
 */
export async function confirmImport(req, res) {
  try {
    const { type } = req.params
    const { previewId, skipErrors = false } = req.body
    
    if (!previewId) {
      return error(res, '缺少预览ID')
    }
    
    // 从缓存获取预览数据
    const previewData = global.importPreviewCache?.[previewId]
    if (!previewData) {
      return error(res, '预览数据已过期，请重新上传')
    }
    
    if (previewData.type !== type) {
      return error(res, '导入类型不匹配')
    }
    
    const parser = PARSERS[type]
    const db = getDatabase()
    
    // 执行导入
    const importResult = await parser.importData(previewData.data, { skipErrors })
    
    // 记录导入历史（id 为 SERIAL 自增，使用 RETURNING 获取）
    const insertResult = await db.prepare(`
      INSERT INTO import_records (import_type, file_name, total_rows, success_rows, error_rows, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      RETURNING id
    `).get(
      type,
      previewData.fileName,
      previewData.data.length,
      importResult.successCount,
      importResult.errorCount,
      importResult.errorCount === 0 ? 'completed' : 'partial'
    )
    const historyId = insertResult?.id
    
    // 清理缓存
    delete global.importPreviewCache[previewId]
    
    return success(res, {
      historyId,
      totalRows: previewData.data.length,
      successCount: importResult.successCount,
      errorCount: importResult.errorCount,
      errors: importResult.errors.slice(0, 50)
    })
    
  } catch (err) {
    console.error('确认导入失败:', err)
    return serverError(res, '确认导入失败: ' + err.message)
  }
}

/**
 * 获取导入历史
 */
export async function getImportHistory(req, res) {
  try {
    const { page = 1, pageSize = 20, type } = req.query
    const db = getDatabase()
    
    let whereClause = ''
    const params = []
    
    if (type) {
      whereClause = 'WHERE import_type = ?'
      params.push(type)
    }
    
    const offset = (page - 1) * pageSize
    
    const records = await db.prepare(`
      SELECT * FROM import_records
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset)
    
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM import_records ${whereClause}
    `).get(...params)
    
    return success(res, {
      list: records,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
    
  } catch (err) {
    console.error('获取导入历史失败:', err)
    return serverError(res, '获取导入历史失败')
  }
}

/**
 * 获取导入详情
 */
export async function getImportDetail(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const record = await db.prepare('SELECT * FROM import_records WHERE id = ?').get(id)
    
    if (!record) {
      return error(res, '导入记录不存在')
    }
    
    return success(res, record)
    
  } catch (err) {
    console.error('获取导入详情失败:', err)
    return serverError(res, '获取导入详情失败')
  }
}

/**
 * 获取字段映射配置
 */
export async function getFieldMapping(req, res) {
  try {
    const { type } = req.params
    
    if (!PARSERS[type]) {
      return error(res, `不支持的导入类型: ${type}`)
    }
    
    const parser = PARSERS[type]
    const fieldMapping = parser.getFieldMapping()
    
    return success(res, fieldMapping)
    
  } catch (err) {
    console.error('获取字段映射失败:', err)
    return serverError(res, '获取字段映射失败')
  }
}

/**
 * 保存字段映射配置
 */
export async function saveFieldMapping(req, res) {
  try {
    const { type } = req.params
    const { mapping } = req.body
    
    // 这里可以保存到数据库，目前简化处理
    return success(res, { message: '保存成功' })
    
  } catch (err) {
    console.error('保存字段映射失败:', err)
    return serverError(res, '保存字段映射失败')
  }
}
