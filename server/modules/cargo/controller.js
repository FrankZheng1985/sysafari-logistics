/**
 * 货物单证管理控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as importer from './importer.js'
import * as matcher from './matcher.js'
import * as taxCalc from './taxCalc.js'
import * as recommender from './recommender.js'
import * as taxConfirmPdf from './taxConfirmPdf.js'
import fs from 'fs'
import path from 'path'

// ==================== 导入管理 ====================

/**
 * 获取统计数据
 */
export async function getStats(req, res) {
  try {
    const stats = await taxCalc.getDocumentStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return serverError(res, '获取统计数据失败')
  }
}

/**
 * 获取导入批次列表
 */
export async function getImports(req, res) {
  try {
    const { page, pageSize, status, customerName, containerNo } = req.query
    const result = await importer.getImportList({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status,
      customerName,
      containerNo
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取导入列表失败:', error)
    return serverError(res, '获取导入列表失败')
  }
}

/**
 * 获取导入批次详情
 */
export async function getImportById(req, res) {
  try {
    const { id } = req.params
    const data = await importer.getImportById(parseInt(id))
    if (!data) {
      return notFound(res, '导入批次不存在')
    }
    return success(res, data)
  } catch (error) {
    console.error('获取导入详情失败:', error)
    return serverError(res, '获取导入详情失败')
  }
}

/**
 * 获取货物明细
 */
export async function getImportItems(req, res) {
  try {
    const { id } = req.params
    const { page, pageSize, matchStatus } = req.query
    const result = await importer.getCargoItems(parseInt(id), {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50,
      matchStatus
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取货物明细失败:', error)
    return serverError(res, '获取货物明细失败')
  }
}

/**
 * 上传导入文件
 */
export async function createImport(req, res) {
  try {
    if (!req.file) {
      return badRequest(res, '请上传文件')
    }

    const file = req.file
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    
    // 解析文件
    const previewResult = await importer.parseAndPreview(fileContent, 'csv')
    
    // 如果没有有效数据
    if (previewResult.validCount === 0) {
      fs.unlinkSync(file.path) // 删除临时文件
      return badRequest(res, '没有有效数据可导入')
    }

    // 创建导入批次
    const containerNo = previewResult.items[0]?.containerNo || ''
    const billNumber = previewResult.items[0]?.billNumber || ''
    
    const batchResult = await importer.createImportBatch({
      containerNo,
      billNumber,
      totalItems: previewResult.validCount,
      fileName: file.originalname,
      filePath: file.path,
      createdBy: req.user?.id || null
    })

    // 插入货物明细
    const insertResult = await importer.insertCargoItems(
      batchResult.id,
      previewResult.items.filter(i => !i.error)
    )

    // 删除临时文件
    fs.unlinkSync(file.path)

    return success(res, {
      importId: batchResult.id,
      importNo: batchResult.importNo,
      importedCount: insertResult.insertedCount,
      skippedCount: insertResult.skippedCount
    }, '导入成功')
  } catch (error) {
    console.error('导入失败:', error)
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return serverError(res, '导入失败: ' + error.message)
  }
}

/**
 * 预览导入文件
 */
export async function previewImport(req, res) {
  try {
    if (!req.file) {
      return badRequest(res, '请上传文件')
    }

    const file = req.file
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    
    // 解析文件
    const previewResult = await importer.parseAndPreview(fileContent, 'csv')
    
    // 删除临时文件
    fs.unlinkSync(file.path)

    return success(res, previewResult)
  } catch (error) {
    console.error('预览失败:', error)
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    return serverError(res, '预览失败: ' + error.message)
  }
}

/**
 * 删除导入批次
 */
export async function deleteImport(req, res) {
  try {
    const { id } = req.params
    const deleted = await importer.deleteImportBatch(parseInt(id))
    if (!deleted) {
      return notFound(res, '导入批次不存在')
    }
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除失败:', error)
    return serverError(res, '删除失败')
  }
}

// ==================== HS匹配 ====================

/**
 * 执行批量匹配
 */
export async function runBatchMatch(req, res) {
  try {
    const { importId } = req.body
    if (!importId) {
      return badRequest(res, '缺少importId参数')
    }

    const result = await matcher.batchMatchHsCodes(parseInt(importId))
    return success(res, result, '匹配完成')
  } catch (error) {
    console.error('批量匹配失败:', error)
    return serverError(res, '批量匹配失败')
  }
}

/**
 * 获取待审核列表
 */
export async function getReviewItems(req, res) {
  try {
    const { importId, page, pageSize } = req.query
    if (!importId) {
      return badRequest(res, '缺少importId参数')
    }

    const result = await matcher.getReviewItems(parseInt(importId), {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取待审核列表失败:', error)
    return serverError(res, '获取待审核列表失败')
  }
}

/**
 * 批量审核
 */
export async function batchReview(req, res) {
  try {
    const { itemIds, action, hsCode, reviewNote } = req.body
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return badRequest(res, '请选择要审核的项目')
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      return badRequest(res, '无效的操作类型')
    }

    // 如果是单个项目的手动修改HS
    if (action === 'approve' && hsCode && itemIds.length === 1) {
      await matcher.approveMatch(itemIds[0], hsCode, reviewNote, req.user?.id)
    } else {
      await matcher.batchApprove(itemIds, action, reviewNote, req.user?.id)
    }

    return success(res, { updatedCount: itemIds.length }, '审核完成')
  } catch (error) {
    console.error('批量审核失败:', error)
    return serverError(res, '批量审核失败')
  }
}

/**
 * 获取HS推荐
 */
export async function getRecommendations(req, res) {
  try {
    const { productName, productNameEn, material, limit } = req.body
    
    if (!productName) {
      return badRequest(res, '请提供商品名称')
    }

    const recommendations = await recommender.getRecommendations(
      { productName, productNameEn, material },
      parseInt(limit) || 5
    )
    return success(res, recommendations)
  } catch (error) {
    console.error('获取推荐失败:', error)
    return serverError(res, '获取推荐失败')
  }
}

/**
 * 搜索税率库
 */
export async function searchTariff(req, res) {
  try {
    const { hsCode, keyword, limit } = req.query
    
    let results = []
    if (hsCode) {
      results = await recommender.searchTariffByHsCode(hsCode, parseInt(limit) || 20)
    } else if (keyword) {
      results = await recommender.searchTariffByName(keyword, parseInt(limit) || 20)
    } else {
      return badRequest(res, '请提供hsCode或keyword参数')
    }
    
    return success(res, results)
  } catch (error) {
    console.error('搜索税率库失败:', error)
    return serverError(res, '搜索税率库失败')
  }
}

// ==================== 税费计算 ====================

/**
 * 计算税费
 */
export async function calculateTax(req, res) {
  try {
    const { importId } = req.params
    const result = await taxCalc.calculateImportTax(parseInt(importId))
    return success(res, result, '计算完成')
  } catch (error) {
    console.error('计算税费失败:', error)
    return serverError(res, '计算税费失败')
  }
}

/**
 * 获取税费详情
 */
export async function getTaxDetails(req, res) {
  try {
    const { importId } = req.params
    const result = await taxCalc.getTaxDetails(parseInt(importId))
    if (!result) {
      return notFound(res, '导入批次不存在')
    }
    return success(res, result)
  } catch (error) {
    console.error('获取税费详情失败:', error)
    return serverError(res, '获取税费详情失败')
  }
}

/**
 * 生成税费确认单PDF
 */
export async function generateTaxPdf(req, res) {
  try {
    const { importId } = req.params
    
    const result = await taxConfirmPdf.generateTaxConfirmPdf(parseInt(importId))
    
    // 更新PDF路径
    await taxCalc.updateConfirmPdfPath(parseInt(importId), result.filePath)
    
    return success(res, {
      filePath: result.filePath,
      fileName: result.fileName
    }, 'PDF生成成功')
  } catch (error) {
    console.error('生成PDF失败:', error)
    return serverError(res, '生成PDF失败: ' + error.message)
  }
}

/**
 * 下载税费确认单PDF
 */
export async function downloadTaxPdf(req, res) {
  try {
    const { importId } = req.params
    
    // 获取批次信息
    const batchData = await importer.getImportById(parseInt(importId))
    if (!batchData || !batchData.confirmPdfPath) {
      return notFound(res, 'PDF文件不存在')
    }
    
    const filePath = taxConfirmPdf.getPdfFilePath(batchData.confirmPdfPath)
    
    if (!fs.existsSync(filePath)) {
      return notFound(res, 'PDF文件不存在')
    }
    
    const fileName = path.basename(filePath)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Type', 'application/pdf')
    
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('下载PDF失败:', error)
    return serverError(res, '下载PDF失败')
  }
}

/**
 * 标记客户已确认
 */
export async function markConfirmed(req, res) {
  try {
    const { importId } = req.params
    
    await taxCalc.markCustomerConfirmed(parseInt(importId), req.user?.id || 'system')
    
    // 更新统计
    await importer.updateImportStats(parseInt(importId))
    
    return success(res, null, '已标记客户确认')
  } catch (error) {
    console.error('标记确认失败:', error)
    return serverError(res, '标记确认失败')
  }
}

/**
 * 更新清关类型
 */
export async function updateClearanceType(req, res) {
  try {
    const { importId } = req.params
    const { clearanceType } = req.body
    
    if (!['40', '42'].includes(clearanceType)) {
      return badRequest(res, '无效的清关类型，只支持 40 或 42')
    }
    
    await taxCalc.updateClearanceType(parseInt(importId), clearanceType)
    
    return success(res, null, '清关类型已更新')
  } catch (error) {
    console.error('更新清关类型失败:', error)
    return serverError(res, '更新清关类型失败')
  }
}

// ==================== 数据补充 ====================

/**
 * 获取待补充的税率数据
 */
export async function getSupplementList(req, res) {
  try {
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    const { page = 1, pageSize = 20, search } = req.query
    
    let baseWhere = `(goods_description_cn IS NULL OR goods_description_cn = '' OR material IS NULL OR material = '' OR unit_name IS NULL OR unit_name = '')`
    
    let countResult, rows
    
    if (search) {
      // 有搜索条件
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM tariff_rates WHERE ${baseWhere} AND (hs_code ILIKE ? OR goods_description_cn ILIKE ?)`
      ).get(`%${search}%`, `%${search}%`)
      
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      rows = await db.prepare(`
        SELECT hs_code, goods_description_cn, goods_description, material, unit_code, unit_name,
               duty_rate, vat_rate
        FROM tariff_rates 
        WHERE ${baseWhere} AND (hs_code ILIKE ? OR goods_description_cn ILIKE ?)
        ORDER BY hs_code ASC
        LIMIT ? OFFSET ?
      `).all(`%${search}%`, `%${search}%`, parseInt(pageSize), offset)
    } else {
      // 无搜索条件
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM tariff_rates WHERE ${baseWhere}`
      ).get()
      
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      rows = await db.prepare(`
        SELECT hs_code, goods_description_cn, goods_description, material, unit_code, unit_name,
               duty_rate, vat_rate
        FROM tariff_rates 
        WHERE ${baseWhere}
        ORDER BY hs_code ASC
        LIMIT ? OFFSET ?
      `).all(parseInt(pageSize), offset)
    }
    
    return successWithPagination(res, (rows || []).map(row => ({
      hsCode: row.hs_code,
      productName: row.goods_description_cn,
      productNameEn: row.goods_description,
      material: row.material,
      unitCode: row.unit_code,
      unitName: row.unit_name,
      dutyRate: parseFloat(row.duty_rate) || 0,
      vatRate: parseFloat(row.vat_rate) || 19
    })), {
      total: parseInt(countResult?.total) || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取待补充列表失败:', error)
    return serverError(res, '获取待补充列表失败')
  }
}

/**
 * 批量补充税率数据
 */
export async function batchSupplement(req, res) {
  try {
    const { items } = req.body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return badRequest(res, '请提供要补充的数据')
    }
    
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    const now = new Date().toISOString()
    
    let updatedCount = 0
    
    for (const item of items) {
      if (!item.hsCode) continue
      
      // 构建更新SQL - 使用 ? 占位符
      const updates = []
      const values = []
      
      if (item.productName) {
        updates.push('goods_description_cn = ?')
        values.push(item.productName)
      }
      if (item.productNameEn) {
        updates.push('goods_description = ?')
        values.push(item.productNameEn)
      }
      if (item.material) {
        updates.push('material = ?')
        values.push(item.material)
      }
      if (item.unitCode) {
        updates.push('unit_code = ?')
        values.push(item.unitCode)
      }
      if (item.unitName) {
        updates.push('unit_name = ?')
        values.push(item.unitName)
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = ?')
        values.push(now)
        values.push(item.hsCode)
        
        await db.prepare(
          `UPDATE tariff_rates SET ${updates.join(', ')} WHERE hs_code = ?`
        ).run(...values)
        updatedCount++
      }
    }
    
    return success(res, { updatedCount }, '补充完成')
  } catch (error) {
    console.error('批量补充失败:', error)
    return serverError(res, '批量补充失败')
  }
}

export default {
  // 导入管理
  getStats,
  getImports,
  getImportById,
  getImportItems,
  createImport,
  previewImport,
  deleteImport,
  
  // HS匹配
  runBatchMatch,
  getReviewItems,
  batchReview,
  getRecommendations,
  searchTariff,
  
  // 税费计算
  calculateTax,
  getTaxDetails,
  generateTaxPdf,
  downloadTaxPdf,
  markConfirmed,
  updateClearanceType,
  
  // 数据补充
  getSupplementList,
  batchSupplement
}
