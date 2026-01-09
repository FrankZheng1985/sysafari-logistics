/**
 * 货物单证管理控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as importer from './importer.js'
import * as matcher from './matcher.js'
import * as taxCalc from './taxCalc.js'
import * as recommender from './recommender.js'
import * as taxConfirmPdf from './taxConfirmPdf.js'
import * as hsMatchRecords from './hsMatchRecords.js'
import * as hsOptimizer from './hsOptimizer.js'
import * as declarationValue from './declarationValue.js'
import * as inspectionRisk from './inspectionRisk.js'
import * as sensitiveProducts from './sensitiveProducts.js'
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
    const fileType = importer.getFileType(file.originalname)
    
    let previewResult
    
    if (fileType === 'csv') {
      // CSV 文件：读取内容后解析
      const fileContent = fs.readFileSync(file.path, 'utf-8')
      previewResult = await importer.parseAndPreview(fileContent, 'csv')
    } else if (fileType === 'excel') {
      // Excel 文件：直接传文件路径解析
      previewResult = await importer.parseAndPreview(file.path, 'excel', true)
    } else {
      fs.unlinkSync(file.path)
      return badRequest(res, '不支持的文件格式，请上传 CSV 或 Excel (.xlsx, .xls) 文件')
    }
    
    // 如果没有有效数据
    if (previewResult.validCount === 0) {
      fs.unlinkSync(file.path) // 删除临时文件
      return badRequest(res, '没有有效数据可导入')
    }

    // 从请求中获取提单信息（前端传入）
    const billId = req.body.billId || null
    const billNumber = req.body.billNumber || previewResult.items[0]?.billNumber || ''
    const containerNo = req.body.containerNo || previewResult.items[0]?.containerNo || ''
    const customerName = req.body.customerName || previewResult.items.find(i => i.customerName)?.customerName || ''

    const batchResult = await importer.createImportBatch({
      orderId: billId, // 关联的提单ID
      orderNo: billNumber, // 关联的提单号
      containerNo,
      billNumber,
      customerName,
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
    console.log(`[预览导入] 收到文件: ${file.originalname}, 大小: ${file.size} bytes, 路径: ${file.path}`)
    
    const fileType = importer.getFileType(file.originalname)
    console.log(`[预览导入] 文件类型: ${fileType}`)
    
    let previewResult
    
    if (fileType === 'csv') {
      // CSV 文件：读取内容后解析
      console.log('[预览导入] 开始解析CSV文件')
      const fileContent = fs.readFileSync(file.path, 'utf-8')
      previewResult = await importer.parseAndPreview(fileContent, 'csv')
    } else if (fileType === 'excel') {
      // Excel 文件：直接传文件路径解析
      console.log('[预览导入] 开始解析Excel文件')
      previewResult = await importer.parseAndPreview(file.path, 'excel', true)
    } else {
      fs.unlinkSync(file.path)
      return badRequest(res, '不支持的文件格式，请上传 CSV 或 Excel (.xlsx, .xls) 文件')
    }
    
    console.log(`[预览导入] 解析完成，有效记录: ${previewResult?.validCount || 0}，错误记录: ${previewResult?.errorCount || 0}`)
    
    // 删除临时文件
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    return success(res, previewResult)
  } catch (error) {
    console.error('[预览导入] 失败:', error.message)
    console.error('[预览导入] 错误堆栈:', error.stack)
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

/**
 * 更新导入批次的发货方和进口商信息
 */
export async function updateShipperAndImporter(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    await importer.updateShipperAndImporter(parseInt(id), data)
    return success(res, null, '发货方和进口商信息更新成功')
  } catch (error) {
    console.error('更新发货方和进口商信息失败:', error)
    return serverError(res, '更新失败: ' + error.message)
  }
}

/**
 * 从提单同步发货方信息
 */
export async function syncShipperFromBL(req, res) {
  try {
    const { id } = req.params
    
    const result = await importer.syncShipperFromBL(parseInt(id))
    return success(res, result, '已从提单同步发货方信息')
  } catch (error) {
    console.error('从提单同步发货方信息失败:', error)
    return serverError(res, error.message)
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
 * 获取待审核列表（未匹配）
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
 * 获取已匹配列表
 */
export async function getMatchedItems(req, res) {
  try {
    const { importId, page, pageSize } = req.query
    if (!importId) {
      return badRequest(res, '缺少importId参数')
    }

    const result = await matcher.getMatchedItems(parseInt(importId), {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取已匹配列表失败:', error)
    return serverError(res, '获取已匹配列表失败')
  }
}

/**
 * 获取匹配统计
 */
export async function getMatchingStats(req, res) {
  try {
    const { importId } = req.query
    if (!importId) {
      return badRequest(res, '缺少importId参数')
    }

    const stats = await matcher.getMatchingStats(parseInt(importId))
    return success(res, stats)
  } catch (error) {
    console.error('获取匹配统计失败:', error)
    return serverError(res, '获取匹配统计失败')
  }
}

/**
 * 更新货物明细信息（原产地、材质、用途）
 */
export async function updateCargoItemDetail(req, res) {
  try {
    const { itemId } = req.params
    const { originCountry, material, materialEn, usageScenario, productName, productNameEn, updateTariff } = req.body
    
    const result = await matcher.updateCargoItemDetail(parseInt(itemId), {
      originCountry,
      material,
      materialEn,
      usageScenario,
      productName,
      productNameEn,
      updateTariff: updateTariff !== false
    })
    
    if (!result.success) {
      return badRequest(res, result.message)
    }
    
    return success(res, result, result.message)
  } catch (error) {
    console.error('更新货物信息失败:', error)
    return serverError(res, '更新货物信息失败')
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

    // 生成PDF文件
    const result = await taxConfirmPdf.generateTaxConfirmPdf(parseInt(importId))

    // 获取批次信息用于关联订单
    const batchData = await importer.getImportById(parseInt(importId))

    // 上传到COS并存入文档管理
    let documentId = null
    let cosUrl = null
    try {
      const documentService = await import('../../../services/documentService.js')
      
      // 读取生成的PDF文件
      const pdfBuffer = fs.readFileSync(result.fullPath)
      
      const docResult = await documentService.uploadCustomsDocument({
        fileBuffer: pdfBuffer,
        fileName: result.fileName,
        importId: batchData.importNo,
        billId: batchData.billId,
        billNumber: batchData.billNumber,
        customerId: batchData.customerId,
        customerName: batchData.customerName,
        user: req.user
      })

      documentId = docResult.documentId
      cosUrl = docResult.cosUrl
      console.log('✅ 税费确认单已同步到文档管理:', documentId)
    } catch (docError) {
      console.warn('⚠️ 上传到文档管理失败，但本地PDF已生成:', docError.message)
    }

    // 更新PDF路径
    await taxCalc.updateConfirmPdfPath(parseInt(importId), cosUrl || result.filePath)

    return success(res, {
      filePath: result.filePath,
      fileName: result.fileName,
      cosUrl,
      documentId
    }, 'PDF生成成功，已同步到文档管理')
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

/**
 * 更新单个商品的税费信息
 */
export async function updateItemTax(req, res) {
  try {
    const { itemId } = req.params
    const { productName, matchedHsCode, totalValue, dutyRate, vatRate, antiDumpingRate, countervailingRate } = req.body

    const result = await taxCalc.updateCargoItemTax(parseInt(itemId), {
      productName,
      matchedHsCode,
      totalValue,
      dutyRate,
      vatRate,
      antiDumpingRate,
      countervailingRate
    })
    
    const message = result.tariffUpdated 
      ? '税费信息已更新，税率已根据新HS编码自动调整' 
      : '税费信息已更新'
    
    return success(res, result, message)
  } catch (error) {
    console.error('更新商品税费失败:', error)
    return serverError(res, error.message || '更新商品税费失败')
  }
}

// ==================== 贸易条件和完税价格 ====================

/**
 * 获取 Incoterms 贸易条款列表
 */
export async function getIncotermsList(req, res) {
  try {
    const list = taxCalc.getIncotermsList()
    return success(res, list)
  } catch (error) {
    console.error('获取贸易条款列表失败:', error)
    return serverError(res, '获取贸易条款列表失败')
  }
}

/**
 * 更新贸易条件和运费信息
 */
export async function updateTradeTerms(req, res) {
  try {
    const { importId } = req.params
    const { 
      incoterm,
      internationalFreight,
      domesticFreightExport,
      domesticFreightImport,
      insuranceCost,
      prepaidDuties,
      freightAllocationMethod
    } = req.body
    
    // 验证 Incoterm
    const validIncoterms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'DDU']
    if (incoterm && !validIncoterms.includes(incoterm.toUpperCase())) {
      return badRequest(res, `无效的贸易条款，支持: ${validIncoterms.join(', ')}`)
    }
    
    await taxCalc.updateTradeTerms(parseInt(importId), {
      incoterm: incoterm?.toUpperCase(),
      internationalFreight,
      domesticFreightExport,
      domesticFreightImport,
      insuranceCost,
      prepaidDuties,
      freightAllocationMethod
    })
    
    return success(res, null, '贸易条件已更新')
  } catch (error) {
    console.error('更新贸易条件失败:', error)
    return serverError(res, error.message || '更新贸易条件失败')
  }
}

/**
 * 更新商品原产地
 */
export async function updateItemOrigin(req, res) {
  try {
    const { itemId } = req.params
    const { originCountryCode, updateTariff = true } = req.body
    
    if (!originCountryCode) {
      return badRequest(res, '请提供原产国代码')
    }
    
    // 验证原产国代码格式（2位字母）
    if (!/^[A-Z]{2}$/i.test(originCountryCode)) {
      return badRequest(res, '原产国代码格式错误，应为2位字母（如 CN, US, DE）')
    }
    
    const result = await taxCalc.updateItemOrigin(
      parseInt(itemId), 
      originCountryCode.toUpperCase(), 
      updateTariff
    )
    
    const message = result.tariffUpdated 
      ? '原产地已更新，税率已根据原产国自动调整' 
      : '原产地已更新'
    
    return success(res, result, message)
  } catch (error) {
    console.error('更新商品原产地失败:', error)
    return serverError(res, error.message || '更新商品原产地失败')
  }
}

/**
 * 批量更新整个提单的原产地
 */
export async function updateBatchOrigin(req, res) {
  try {
    const { importId, originCountry } = req.body
    
    if (!importId) {
      return badRequest(res, '请提供导入批次ID')
    }
    
    if (!originCountry) {
      return badRequest(res, '请输入原产地国家代码')
    }
    
    // 验证原产国代码格式（2位字母）
    if (!/^[A-Z]{2}$/i.test(originCountry)) {
      return badRequest(res, '原产国代码格式错误，应为2位字母（如 CN, US, DE）')
    }
    
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    // 更新该批次所有商品的原产地
    const updateStmt = db.prepare(`
      UPDATE cargo_items 
      SET origin_country = ?, updated_at = CURRENT_TIMESTAMP
      WHERE import_id = ?
    `)
    
    const result = updateStmt.run(originCountry.toUpperCase(), parseInt(importId))
    
    return success(res, {
      updatedCount: result.changes,
      originCountry: originCountry.toUpperCase()
    }, `已将 ${result.changes} 件商品的原产地设置为 ${originCountry.toUpperCase()}`)
  } catch (error) {
    console.error('批量更新原产地失败:', error)
    return serverError(res, error.message || '批量更新原产地失败')
  }
}

/**
 * 更新单个商品的材质和用途
 */
export async function updateItemDetail(req, res) {
  try {
    const { itemId } = req.params
    const { material, materialEn, usageScenario } = req.body
    
    if (!itemId) {
      return badRequest(res, '请提供商品ID')
    }
    
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    // 更新商品材质和用途
    const updateStmt = db.prepare(`
      UPDATE cargo_items 
      SET material = ?, material_en = ?, usage_scenario = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    
    const result = updateStmt.run(
      material || null, 
      materialEn || null, 
      usageScenario || null, 
      parseInt(itemId)
    )
    
    if (result.changes === 0) {
      return notFound(res, '商品不存在')
    }
    
    return success(res, {
      itemId: parseInt(itemId),
      material,
      materialEn,
      usageScenario
    }, '商品材质和用途已更新')
  } catch (error) {
    console.error('更新商品材质用途失败:', error)
    return serverError(res, error.message || '更新商品材质用途失败')
  }
}

/**
 * 重新计算完税价格和税费
 */
export async function recalculateTax(req, res) {
  try {
    const { importId } = req.params
    const { recalculateCustomsValue = true, updateOriginTariffs = false } = req.body
    
    const result = await taxCalc.calculateImportTax(parseInt(importId), {
      recalculateCustomsValue,
      updateOriginTariffs
    })
    
    return success(res, result, '税费已重新计算')
  } catch (error) {
    console.error('重新计算税费失败:', error)
    return serverError(res, error.message || '重新计算税费失败')
  }
}

/**
 * 根据原产地和材质查询税率
 */
export async function getTariffByOrigin(req, res) {
  try {
    const { hsCode, originCountryCode, material } = req.query
    
    if (!hsCode) {
      return badRequest(res, '请提供HS编码')
    }
    
    // 支持材质参数用于更精确的税率匹配
    const result = await taxCalc.getTariffByOrigin(hsCode, originCountryCode || 'CN', material || null)
    
    if (!result) {
      return notFound(res, '未找到该HS编码的税率信息')
    }
    
    return success(res, result)
  } catch (error) {
    console.error('查询税率失败:', error)
    return serverError(res, error.message || '查询税率失败')
  }
}

// ==================== 数据补充 ====================

/**
 * 获取待补充的税率数据
 */
export async function getSupplementList(req, res) {
  try {
    const { getDatabase } = await import('../../config/database.js')
    const { getSupplementRule } = await import('../../config/hsSupplementRules.js')
    const db = getDatabase()
    const { page = 1, pageSize = 20, search, category } = req.query
    
    // 不需要材质的章节（01-38章）
    const noMaterialChapters = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']
    
    // 修正：真正需要补充的数据条件
    // 01-38章：只看单位是否缺失（不需要材质）
    // 39-97章：看材质和单位是否缺失
    let baseWhere = `(
      (SUBSTRING(hs_code, 1, 2) IN ('${noMaterialChapters.join("','")}') AND (unit_name IS NULL OR unit_name = ''))
      OR
      (SUBSTRING(hs_code, 1, 2) NOT IN ('${noMaterialChapters.join("','")}') AND ((material IS NULL OR material = '') OR (unit_name IS NULL OR unit_name = '')))
    )`
    
    // 根据分类添加额外条件
    let categoryWhere = ''
    if (category === 'autoFillable') {
      // 可自动补充：01-38章，且缺少单位
      baseWhere = `SUBSTRING(hs_code, 1, 2) IN ('${noMaterialChapters.join("','")}') AND (unit_name IS NULL OR unit_name = '')`
      categoryWhere = ''
    } else if (category === 'needMaterial') {
      // 需要补充材质：39-97章，缺少材质或单位
      baseWhere = `SUBSTRING(hs_code, 1, 2) NOT IN ('${noMaterialChapters.join("','")}') AND ((material IS NULL OR material = '') OR (unit_name IS NULL OR unit_name = ''))`
      categoryWhere = ''
    } else if (category === 'needManual') {
      // 完全手动：39-97章
      categoryWhere = ` AND (SUBSTRING(hs_code, 1, 2) NOT IN ('${noMaterialChapters.join("','")}'))`
    }
    
    let countResult, rows
    
    if (search) {
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM tariff_rates WHERE ${baseWhere}${categoryWhere} AND (hs_code ILIKE ? OR goods_description_cn ILIKE ?)`
      ).get(`%${search}%`, `%${search}%`)
      
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      rows = await db.prepare(`
        SELECT hs_code, goods_description_cn, goods_description, material, unit_code, unit_name,
               duty_rate, vat_rate
        FROM tariff_rates 
        WHERE ${baseWhere}${categoryWhere} AND (hs_code ILIKE ? OR goods_description_cn ILIKE ?)
        ORDER BY hs_code ASC
        LIMIT ? OFFSET ?
      `).all(`%${search}%`, `%${search}%`, parseInt(pageSize), offset)
    } else {
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM tariff_rates WHERE ${baseWhere}${categoryWhere}`
      ).get()
      
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      rows = await db.prepare(`
        SELECT hs_code, goods_description_cn, goods_description, material, unit_code, unit_name,
               duty_rate, vat_rate
        FROM tariff_rates 
        WHERE ${baseWhere}${categoryWhere}
        ORDER BY hs_code ASC
        LIMIT ? OFFSET ?
      `).all(parseInt(pageSize), offset)
    }
    
    // 应用智能规则，添加建议值
    const list = (rows || []).map(row => {
      const rule = getSupplementRule(row.hs_code)
      const missingFields = []
      if (!row.goods_description_cn) missingFields.push('商品名称')
      if (!row.material && rule.needMaterial) missingFields.push('材质')
      if (!row.unit_name) missingFields.push('单位')
      
      return {
        hsCode: row.hs_code,
        productName: row.goods_description_cn,
        productNameEn: row.goods_description,
        material: row.material,
        unitCode: row.unit_code,
        unitName: row.unit_name,
        dutyRate: parseFloat(row.duty_rate) || 0,
        vatRate: parseFloat(row.vat_rate) || 19,
        // 智能规则信息
        needMaterial: rule.needMaterial,
        suggestedUnit: rule.defaultUnit,
        suggestedUnitCode: rule.defaultUnitCode,
        chapterName: rule.chapterName,
        missingFields,
        canAutoFill: !rule.needMaterial && rule.defaultUnit && !row.unit_name
      }
    })
    
    return successWithPagination(res, list, {
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
 * 获取数据补充统计信息
 */
export async function getSupplementStats(req, res) {
  try {
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    // 不需要材质的章节（01-38章）
    const noMaterialChapters = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']
    
    // 修正：根据章节判断真正缺失的数据
    // 01-38章：只看单位是否缺失（不需要材质）
    // 39-97章：看材质和单位是否缺失
    
    // 可自动补充：01-38章，只缺单位
    const autoFillableResult = await db.prepare(
      `SELECT COUNT(*) as count FROM tariff_rates 
       WHERE SUBSTRING(hs_code, 1, 2) IN ('${noMaterialChapters.join("','")}')
       AND (unit_name IS NULL OR unit_name = '')`
    ).get()
    
    // 需要补充材质的（39-97章，缺少材质或单位）
    const needMaterialResult = await db.prepare(
      `SELECT COUNT(*) as count FROM tariff_rates 
       WHERE SUBSTRING(hs_code, 1, 2) NOT IN ('${noMaterialChapters.join("','")}')
       AND ((material IS NULL OR material = '') OR (unit_name IS NULL OR unit_name = ''))`
    ).get()
    
    // 统计总数 = 可自动补充 + 需要材质
    const totalCount = (parseInt(autoFillableResult?.count) || 0) + (parseInt(needMaterialResult?.count) || 0)
    
    // 只缺商品名称的（任意章节）
    const needNameResult = await db.prepare(
      `SELECT COUNT(*) as count FROM tariff_rates 
       WHERE (goods_description_cn IS NULL OR goods_description_cn = '')`
    ).get()
    
    // 按章节统计（修正：01-38章只统计缺单位的，39+章统计缺材质或单位的）
    const chapterStats01_38 = await db.prepare(`
      SELECT 
        SUBSTRING(hs_code, 1, 2) as chapter,
        COUNT(*) as count
      FROM tariff_rates 
      WHERE SUBSTRING(hs_code, 1, 2) IN ('${noMaterialChapters.join("','")}')
      AND (unit_name IS NULL OR unit_name = '')
      GROUP BY SUBSTRING(hs_code, 1, 2)
      ORDER BY chapter
    `).all()
    
    const chapterStats39_plus = await db.prepare(`
      SELECT 
        SUBSTRING(hs_code, 1, 2) as chapter,
        COUNT(*) as count
      FROM tariff_rates 
      WHERE SUBSTRING(hs_code, 1, 2) NOT IN ('${noMaterialChapters.join("','")}')
      AND ((material IS NULL OR material = '') OR (unit_name IS NULL OR unit_name = ''))
      GROUP BY SUBSTRING(hs_code, 1, 2)
      ORDER BY chapter
    `).all()
    
    const chapterStats = [...chapterStats01_38, ...chapterStats39_plus].sort((a, b) => a.chapter.localeCompare(b.chapter))
    
    return success(res, {
      total: totalCount,
      autoFillable: parseInt(autoFillableResult?.count) || 0,
      needMaterial: parseInt(needMaterialResult?.count) || 0,
      needName: parseInt(needNameResult?.count) || 0,
      chapterStats: chapterStats || []
    })
  } catch (error) {
    console.error('获取补充统计失败:', error)
    return serverError(res, '获取补充统计失败')
  }
}

/**
 * 自动批量补充（仅补充不需要材质的默认单位）
 */
export async function autoSupplement(req, res) {
  try {
    const { getDatabase } = await import('../../config/database.js')
    const { getSupplementRule } = await import('../../config/hsSupplementRules.js')
    const db = getDatabase()
    const { chapter, dryRun = false } = req.body
    
    // 不需要材质的章节
    const noMaterialChapters = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']
    
    // 构建查询条件
    let chapterFilter = ''
    if (chapter) {
      if (!noMaterialChapters.includes(chapter)) {
        return badRequest(res, `第${chapter}章需要材质信息，无法自动补充`)
      }
      chapterFilter = ` AND SUBSTRING(hs_code, 1, 2) = '${chapter}'`
    } else {
      chapterFilter = ` AND SUBSTRING(hs_code, 1, 2) IN ('${noMaterialChapters.join("','")}')`
    }
    
    // 获取需要补充单位的记录
    const rows = await db.prepare(`
      SELECT hs_code, goods_description_cn
      FROM tariff_rates 
      WHERE (unit_name IS NULL OR unit_name = '')
      ${chapterFilter}
      LIMIT 10000
    `).all()
    
    if (!rows || rows.length === 0) {
      return success(res, { updatedCount: 0, items: [] }, '没有需要自动补充的数据')
    }
    
    // 应用规则
    const updates = []
    for (const row of rows) {
      const rule = getSupplementRule(row.hs_code)
      if (rule.defaultUnit && rule.defaultUnitCode) {
        updates.push({
          hsCode: row.hs_code,
          productName: row.goods_description_cn,
          unitName: rule.defaultUnit,
          unitCode: rule.defaultUnitCode,
          chapterName: rule.chapterName
        })
      }
    }
    
    if (dryRun) {
      // 预览模式，不实际更新
      return success(res, {
        updatedCount: updates.length,
        items: updates.slice(0, 100),
        preview: true
      }, `预览：将补充 ${updates.length} 条记录的单位`)
    }
    
    // 实际更新
    const now = new Date().toISOString()
    let updatedCount = 0
    
    for (const item of updates) {
      await db.prepare(
        `UPDATE tariff_rates SET unit_name = ?, unit_code = ?, updated_at = ? WHERE hs_code = ?`
      ).run(item.unitName, item.unitCode, now, item.hsCode)
      updatedCount++
    }
    
    return success(res, {
      updatedCount,
      items: updates.slice(0, 20)
    }, `成功补充 ${updatedCount} 条记录`)
  } catch (error) {
    console.error('自动补充失败:', error)
    return serverError(res, '自动补充失败')
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

// ==================== HS匹配记录管理 ====================

/**
 * 获取匹配记录列表
 */
export async function getMatchRecordsList(req, res) {
  try {
    const { page = 1, pageSize = 20, keyword, hsCode, status } = req.query
    const result = await hsMatchRecords.getMatchRecordsList({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      keyword,
      hsCode,
      status
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      stats: result.stats
    })
  } catch (error) {
    console.error('获取匹配记录列表失败:', error)
    return serverError(res, '获取匹配记录列表失败')
  }
}

/**
 * 搜索匹配记录（用于快速匹配建议）
 */
export async function searchMatchRecords(req, res) {
  try {
    const { keyword, limit } = req.query
    if (!keyword) {
      return badRequest(res, '请提供搜索关键词')
    }
    const results = await hsMatchRecords.searchMatchRecords(keyword, parseInt(limit) || 20)
    return success(res, results)
  } catch (error) {
    console.error('搜索匹配记录失败:', error)
    return serverError(res, '搜索匹配记录失败')
  }
}

/**
 * 获取匹配记录详情
 */
export async function getMatchRecordDetail(req, res) {
  try {
    const { id } = req.params
    const detail = await hsMatchRecords.getMatchRecordDetail(parseInt(id))
    if (!detail) {
      return notFound(res, '匹配记录不存在')
    }
    return success(res, detail)
  } catch (error) {
    console.error('获取匹配记录详情失败:', error)
    return serverError(res, '获取匹配记录详情失败')
  }
}

/**
 * 更新匹配记录
 */
export async function updateMatchRecord(req, res) {
  try {
    const { id } = req.params
    await hsMatchRecords.updateMatchRecord(parseInt(id), req.body)
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新匹配记录失败:', error)
    return serverError(res, '更新匹配记录失败')
  }
}

/**
 * 验证匹配记录
 */
export async function verifyMatchRecord(req, res) {
  try {
    const { id } = req.params
    const verifiedBy = req.user?.username || 'system'
    await hsMatchRecords.verifyMatchRecord(parseInt(id), verifiedBy)
    return success(res, null, '已标记为已核实')
  } catch (error) {
    console.error('验证匹配记录失败:', error)
    return serverError(res, '验证匹配记录失败')
  }
}

/**
 * 删除匹配记录
 */
export async function deleteMatchRecord(req, res) {
  try {
    const { id } = req.params
    await hsMatchRecords.deleteMatchRecord(parseInt(id))
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除匹配记录失败:', error)
    return serverError(res, '删除匹配记录失败')
  }
}

/**
 * 保存税费计算结果到匹配记录
 */
export async function saveToMatchRecords(req, res) {
  try {
    const { importId } = req.params
    
    // 获取税费详情中的所有商品
    const taxDetails = await taxCalc.getTaxDetails(parseInt(importId))
    if (!taxDetails || !taxDetails.items) {
      return badRequest(res, '未找到税费数据')
    }

    // 批量保存到匹配记录
    const results = await hsMatchRecords.batchSaveFromTaxCalc(
      parseInt(importId),
      taxDetails.items.map(item => ({
        ...item,
        importNo: taxDetails.importNo,
        customerName: taxDetails.customerName
      }))
    )

    const successCount = results.filter(r => r.success).length
    return success(res, results, `已保存 ${successCount} 条匹配记录`)
  } catch (error) {
    console.error('保存匹配记录失败:', error)
    return serverError(res, '保存匹配记录失败')
  }
}

/**
 * 检测价格异常（与历史记录对比）
 */
export async function checkPriceAnomaly(req, res) {
  try {
    const { importId } = req.params

    // 获取导入批次的商品
    const items = await importer.getImportItems(parseInt(importId))
    if (!items || items.length === 0) {
      return badRequest(res, '未找到商品数据')
    }

    // 批量检测价格异常
    const results = await hsMatchRecords.batchCheckPriceAnomaly(items)
    
    // 统计异常数量
    const anomalyCount = results.filter(r => r.hasAnomaly).length
    const newProductCount = results.filter(r => r.isNewProduct).length
    
    return success(res, {
      total: results.length,
      anomalyCount,
      newProductCount,
      normalCount: results.length - anomalyCount - newProductCount,
      items: results
    }, anomalyCount > 0 ? `发现 ${anomalyCount} 个价格异常商品需要审核` : '价格检测正常')
  } catch (error) {
    console.error('价格异常检测失败:', error)
    return serverError(res, '价格异常检测失败')
  }
}

/**
 * 检测单个商品价格异常
 */
export async function checkSinglePriceAnomaly(req, res) {
  try {
    const { productName, material, unitPrice, kgPrice } = req.body
    
    if (!productName) {
      return badRequest(res, '请提供商品名称')
    }

    const result = await hsMatchRecords.checkPriceAnomaly(
      productName,
      material || '',
      parseFloat(unitPrice) || 0,
      parseFloat(kgPrice) || 0
    )
    
    return success(res, result)
  } catch (error) {
    console.error('价格异常检测失败:', error)
    return serverError(res, '价格异常检测失败')
  }
}

// ==================== HS编码税率优化 ====================

/**
 * 分析HS编码税率风险
 */
export async function analyzeHsTaxRisk(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry } = req.query
    
    if (!hsCode) {
      return badRequest(res, '请提供HS编码')
    }
    
    const result = await hsOptimizer.analyzeHsCodeTaxRisk(hsCode, originCountry)
    return success(res, result)
  } catch (error) {
    console.error('分析HS税率风险失败:', error)
    return serverError(res, '分析HS税率风险失败')
  }
}

/**
 * 获取低税率替代编码
 */
export async function findTaxAlternatives(req, res) {
  try {
    const { hsCode } = req.params
    const { productName, originCountry, limit } = req.query
    
    if (!hsCode) {
      return badRequest(res, '请提供HS编码')
    }
    
    const result = await hsOptimizer.findLowerTaxAlternatives(
      hsCode, 
      productName, 
      originCountry, 
      parseInt(limit) || 10
    )
    return success(res, result)
  } catch (error) {
    console.error('获取替代编码失败:', error)
    return serverError(res, '获取替代编码失败')
  }
}

/**
 * 搜索同前缀HS编码
 */
export async function searchHsByPrefix(req, res) {
  try {
    const { prefix } = req.params
    const { limit } = req.query
    
    if (!prefix || prefix.length < 4) {
      return badRequest(res, '前缀长度至少为4位')
    }
    
    const result = await hsOptimizer.searchByPrefix(prefix, parseInt(limit) || 50)
    return success(res, result)
  } catch (error) {
    console.error('搜索HS编码失败:', error)
    return serverError(res, '搜索HS编码失败')
  }
}

/**
 * 获取反倾销税风险编码列表
 */
export async function getAntiDumpingRisks(req, res) {
  try {
    const { originCountry } = req.query
    const result = await hsOptimizer.getAntiDumpingRiskCodes(originCountry || 'China')
    return success(res, result)
  } catch (error) {
    console.error('获取反倾销风险编码失败:', error)
    return serverError(res, '获取反倾销风险编码失败')
  }
}

/**
 * 批量分析导入批次税率风险
 */
export async function batchAnalyzeTaxRisk(req, res) {
  try {
    const { importId } = req.params
    
    if (!importId) {
      return badRequest(res, '请提供导入批次ID')
    }
    
    const result = await hsOptimizer.batchAnalyzeImportRisk(parseInt(importId))
    return success(res, result)
  } catch (error) {
    console.error('批量分析税率风险失败:', error)
    return serverError(res, '批量分析税率风险失败')
  }
}

// ==================== 申报价值分析 ====================

/**
 * 记录申报价值
 */
export async function recordDeclaration(req, res) {
  try {
    const recordId = await declarationValue.recordDeclarationValue(req.body)
    return success(res, { id: recordId }, '申报记录已保存')
  } catch (error) {
    console.error('记录申报价值失败:', error)
    return serverError(res, '记录申报价值失败')
  }
}

/**
 * 更新申报结果
 */
export async function updateDeclarationResultCtrl(req, res) {
  try {
    const { id } = req.params
    const { result, adjustedPrice, adjustmentReason } = req.body
    
    if (!['pending', 'passed', 'questioned', 'rejected'].includes(result)) {
      return badRequest(res, '无效的申报结果')
    }
    
    await declarationValue.updateDeclarationResult(
      parseInt(id), 
      result, 
      adjustedPrice, 
      adjustmentReason
    )
    return success(res, null, '申报结果已更新')
  } catch (error) {
    console.error('更新申报结果失败:', error)
    return serverError(res, '更新申报结果失败')
  }
}

/**
 * 获取HS编码申报统计
 */
export async function getDeclarationStatsCtrl(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry, priceUnit } = req.query
    
    const result = await declarationValue.getDeclarationStats(hsCode, originCountry, priceUnit)
    return success(res, result)
  } catch (error) {
    console.error('获取申报统计失败:', error)
    return serverError(res, '获取申报统计失败')
  }
}

/**
 * 检查申报价值风险
 */
export async function checkDeclarationRiskCtrl(req, res) {
  try {
    const { hsCode, declaredPrice, originCountry, priceUnit } = req.body
    
    if (!hsCode || !declaredPrice) {
      return badRequest(res, '请提供HS编码和申报价格')
    }
    
    const result = await declarationValue.checkDeclarationRisk(
      hsCode, 
      parseFloat(declaredPrice), 
      originCountry, 
      priceUnit
    )
    return success(res, result)
  } catch (error) {
    console.error('检查申报风险失败:', error)
    return serverError(res, '检查申报风险失败')
  }
}

/**
 * 批量检查导入批次申报风险
 */
export async function batchCheckDeclarationRiskCtrl(req, res) {
  try {
    const { importId } = req.params
    
    const result = await declarationValue.batchCheckDeclarationRisk(parseInt(importId))
    return success(res, result)
  } catch (error) {
    console.error('批量检查申报风险失败:', error.message, error.stack)
    return serverError(res, `批量检查申报风险失败: ${error.message}`)
  }
}

/**
 * 从导入批次创建申报记录
 */
export async function createDeclarationFromImport(req, res) {
  try {
    const { importId } = req.params
    const { billNo } = req.body
    const userId = req.user?.id
    
    const result = await declarationValue.createDeclarationRecordsFromImport(
      parseInt(importId), 
      billNo, 
      userId
    )
    return success(res, result, `已创建 ${result.createdCount} 条申报记录`)
  } catch (error) {
    console.error('创建申报记录失败:', error)
    return serverError(res, '创建申报记录失败')
  }
}

/**
 * 获取申报历史
 */
export async function getDeclarationHistoryCtrl(req, res) {
  try {
    const { hsCode, originCountry, result, startDate, endDate, page, pageSize } = req.query
    
    const data = await declarationValue.getDeclarationHistory({
      hsCode, originCountry, result, startDate, endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, data.list, {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize
    })
  } catch (error) {
    console.error('获取申报历史失败:', error)
    return serverError(res, '获取申报历史失败')
  }
}

// ==================== 查验风险管理 ====================

/**
 * 记录查验信息
 */
export async function recordInspectionCtrl(req, res) {
  try {
    const userId = req.user?.id
    const recordId = await inspectionRisk.recordInspection({ ...req.body, createdBy: userId })
    return success(res, { id: recordId }, '查验记录已保存')
  } catch (error) {
    console.error('记录查验信息失败:', error)
    return serverError(res, '记录查验信息失败')
  }
}

/**
 * 更新查验结果
 */
export async function updateInspectionCtrl(req, res) {
  try {
    const { id } = req.params
    await inspectionRisk.updateInspectionResult(parseInt(id), req.body)
    return success(res, null, '查验结果已更新')
  } catch (error) {
    console.error('更新查验结果失败:', error)
    return serverError(res, '更新查验结果失败')
  }
}

/**
 * 获取HS编码查验率统计
 */
export async function getInspectionStatsCtrl(req, res) {
  try {
    const { hsCode } = req.params
    const { originCountry } = req.query
    
    const result = await inspectionRisk.getInspectionStats(hsCode, originCountry)
    return success(res, result)
  } catch (error) {
    console.error('获取查验统计失败:', error)
    return serverError(res, '获取查验统计失败')
  }
}

/**
 * 获取高查验率编码列表
 */
export async function getHighRiskCodesCtrl(req, res) {
  try {
    const { originCountry, minRate } = req.query
    
    const result = await inspectionRisk.getHighInspectionRateCodes(
      originCountry, 
      parseInt(minRate) || 15
    )
    return success(res, result)
  } catch (error) {
    console.error('获取高风险编码失败:', error)
    return serverError(res, '获取高风险编码失败')
  }
}

/**
 * 分析导入批次查验风险
 */
export async function analyzeInspectionRiskCtrl(req, res) {
  try {
    const { importId } = req.params
    
    const result = await inspectionRisk.analyzeImportInspectionRisk(parseInt(importId))
    return success(res, result)
  } catch (error) {
    console.error('分析查验风险失败:', error)
    return serverError(res, '分析查验风险失败')
  }
}

/**
 * 从导入批次创建查验记录
 */
export async function createInspectionFromImport(req, res) {
  try {
    const { importId } = req.params
    const { containerNo, billNo } = req.body
    const userId = req.user?.id
    
    const result = await inspectionRisk.createInspectionRecordsFromImport(
      parseInt(importId), 
      containerNo, 
      billNo, 
      userId
    )
    return success(res, result, `已创建 ${result.createdCount} 条查验记录`)
  } catch (error) {
    console.error('创建查验记录失败:', error)
    return serverError(res, '创建查验记录失败')
  }
}

/**
 * 获取查验历史
 */
export async function getInspectionHistoryCtrl(req, res) {
  try {
    const { 
      hsCode, originCountry, inspectionType, inspectionResult, 
      containerNo, startDate, endDate, page, pageSize 
    } = req.query
    
    const data = await inspectionRisk.getInspectionHistory({
      hsCode, originCountry, inspectionType, inspectionResult, 
      containerNo, startDate, endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, data.list, {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize
    })
  } catch (error) {
    console.error('获取查验历史失败:', error)
    return serverError(res, '获取查验历史失败')
  }
}

/**
 * 获取查验类型统计
 */
export async function getInspectionTypeSummaryCtrl(req, res) {
  try {
    const result = await inspectionRisk.getInspectionTypeSummary()
    return success(res, result)
  } catch (error) {
    console.error('获取查验类型统计失败:', error)
    return serverError(res, '获取查验类型统计失败')
  }
}

// ==================== 综合风险分析 ====================

/**
 * 分析导入批次的综合风险
 * 整合：税率风险、申报价值风险、查验风险、敏感产品库检测
 */
export async function analyzeFullRisk(req, res) {
  try {
    const { importId } = req.params
    const id = parseInt(importId)
    
    // 并行执行四种风险分析（新增敏感产品库检测）
    const [taxRisk, declarationRisk, inspectionRiskResult, productLibraryRisk] = await Promise.all([
      hsOptimizer.batchAnalyzeImportRisk(id),
      declarationValue.batchCheckDeclarationRisk(id),
      inspectionRisk.analyzeImportInspectionRisk(id),
      sensitiveProducts.batchCheckImportRisk(id)
    ])
    
    // 计算综合风险评分
    const taxScore = taxRisk.riskScore || 0
    const declScore = declarationRisk.highRiskCount > 0 ? 80 : (declarationRisk.mediumRiskCount > 0 ? 50 : 20)
    const inspScore = inspectionRiskResult.avgRiskScore || 0
    
    // 敏感产品库风险分数
    let sensitiveScore = 0
    if (productLibraryRisk.antiDumpingCount > 0) {
      sensitiveScore = 90  // 反倾销产品风险最高
    } else if (productLibraryRisk.sensitiveCount > 0) {
      sensitiveScore = 70  // 敏感产品
    } else if (productLibraryRisk.inspectionRiskCount > 0) {
      sensitiveScore = 50  // 查验产品库命中
    }
    
    // 综合评分 (税率风险25% + 申报风险30% + 查验风险25% + 敏感产品20%)
    const compositeScore = Math.round(taxScore * 0.25 + declScore * 0.30 + inspScore * 0.25 + sensitiveScore * 0.20)
    
    // 确定综合风险等级
    let overallRiskLevel = 'low'
    if (compositeScore >= 60 || 
        taxRisk.overallRiskLevel === 'high' || 
        declarationRisk.highRiskCount > 0 ||
        inspectionRiskResult.overallRiskLevel === 'high' ||
        productLibraryRisk.antiDumpingCount > 0) {
      overallRiskLevel = 'high'
    } else if (compositeScore >= 35 || 
               taxRisk.overallRiskLevel === 'medium' || 
               declarationRisk.mediumRiskCount > 0 ||
               inspectionRiskResult.overallRiskLevel === 'medium' ||
               productLibraryRisk.sensitiveCount > 0) {
      overallRiskLevel = 'medium'
    }
    
    // 汇总风险警告
    const warnings = []
    if (productLibraryRisk.antiDumpingCount > 0) {
      warnings.push(`⚠️ ${productLibraryRisk.antiDumpingCount} 个商品命中反倾销产品库`)
    }
    if (productLibraryRisk.sensitiveCount > 0) {
      warnings.push(`⚠️ ${productLibraryRisk.sensitiveCount} 个商品命中高敏感产品库`)
    }
    if (productLibraryRisk.inspectionRiskCount > 0) {
      warnings.push(`📋 ${productLibraryRisk.inspectionRiskCount} 个商品命中海关查验产品库`)
    }
    if (taxRisk.highRiskCount > 0) {
      warnings.push(`${taxRisk.highRiskCount} 个商品存在高税率/反倾销税风险`)
    }
    if (declarationRisk.highRiskCount > 0) {
      warnings.push(`${declarationRisk.highRiskCount} 个商品申报价值存在风险`)
    }
    if (inspectionRiskResult.highRiskCount > 0) {
      warnings.push(`${inspectionRiskResult.highRiskCount} 个商品查验率较高`)
    }
    
    return success(res, {
      importId: id,
      compositeScore,
      overallRiskLevel,
      taxRisk: {
        score: taxScore,
        level: taxRisk.overallRiskLevel,
        highRiskCount: taxRisk.highRiskCount,
        items: taxRisk.riskItems?.slice(0, 5)
      },
      declarationRisk: {
        score: declScore,
        highRiskCount: declarationRisk.highRiskCount,
        mediumRiskCount: declarationRisk.mediumRiskCount,
        items: declarationRisk.riskItems?.slice(0, 5)
      },
      inspectionRisk: {
        score: inspScore,
        level: inspectionRiskResult.overallRiskLevel,
        highRiskCount: inspectionRiskResult.highRiskCount,
        items: inspectionRiskResult.riskItems?.slice(0, 5)
      },
      // 新增：敏感产品库检测结果
      productLibraryRisk: {
        score: sensitiveScore,
        sensitiveCount: productLibraryRisk.sensitiveCount,
        antiDumpingCount: productLibraryRisk.antiDumpingCount,
        inspectionRiskCount: productLibraryRisk.inspectionRiskCount,
        items: productLibraryRisk.riskItems?.slice(0, 10)
      },
      warnings,
      needsAttention: overallRiskLevel !== 'low',
      analyzedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('综合风险分析失败:', error.message, error.stack)
    return serverError(res, `综合风险分析失败: ${error.message}`)
  }
}

// ==================== 敏感产品库管理 ====================

/**
 * 获取敏感产品列表
 */
export async function getSensitiveProductsCtrl(req, res) {
  try {
    const { page, pageSize, category, productType, riskLevel, search, isActive } = req.query
    const result = await sensitiveProducts.getSensitiveProducts({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50,
      category,
      productType,
      riskLevel,
      search,
      isActive: isActive === 'false' ? false : isActive === 'all' ? null : true
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取敏感产品列表失败:', error)
    return serverError(res, '获取敏感产品列表失败')
  }
}

/**
 * 获取敏感产品分类列表
 */
export async function getSensitiveProductCategoriesCtrl(req, res) {
  try {
    const categories = await sensitiveProducts.getSensitiveProductCategories()
    return success(res, categories)
  } catch (error) {
    console.error('获取敏感产品分类失败:', error)
    return serverError(res, '获取敏感产品分类失败')
  }
}

/**
 * 检查HS编码是否为敏感产品
 */
export async function checkSensitiveProductCtrl(req, res) {
  try {
    const { hsCode, productName } = req.query
    if (!hsCode && !productName) {
      return badRequest(res, '请提供HS编码或产品名称')
    }
    
    let result
    if (hsCode) {
      result = await sensitiveProducts.checkSensitiveProduct(hsCode)
    } else {
      result = await sensitiveProducts.matchSensitiveByName(productName)
    }
    return success(res, result)
  } catch (error) {
    console.error('检查敏感产品失败:', error)
    return serverError(res, '检查敏感产品失败')
  }
}

/**
 * 创建敏感产品
 */
export async function createSensitiveProductCtrl(req, res) {
  try {
    const id = await sensitiveProducts.createSensitiveProduct(req.body)
    return success(res, { id }, '创建成功')
  } catch (error) {
    console.error('创建敏感产品失败:', error)
    return serverError(res, '创建敏感产品失败')
  }
}

/**
 * 更新敏感产品
 */
export async function updateSensitiveProductCtrl(req, res) {
  try {
    const { id } = req.params
    await sensitiveProducts.updateSensitiveProduct(parseInt(id), req.body)
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新敏感产品失败:', error)
    return serverError(res, '更新敏感产品失败')
  }
}

/**
 * 删除敏感产品
 */
export async function deleteSensitiveProductCtrl(req, res) {
  try {
    const { id } = req.params
    await sensitiveProducts.deleteSensitiveProduct(parseInt(id))
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除敏感产品失败:', error)
    return serverError(res, '删除敏感产品失败')
  }
}

// ==================== 查验产品库管理 ====================

/**
 * 获取查验产品列表
 */
export async function getInspectionProductsCtrl(req, res) {
  try {
    const { page, pageSize, riskLevel, search, isActive } = req.query
    const result = await sensitiveProducts.getInspectionProducts({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50,
      riskLevel,
      search,
      isActive: isActive === 'false' ? false : isActive === 'all' ? null : true
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取查验产品列表失败:', error)
    return serverError(res, '获取查验产品列表失败')
  }
}

/**
 * 检查HS编码是否为查验产品
 */
export async function checkInspectionProductCtrl(req, res) {
  try {
    const { hsCode, productName } = req.query
    if (!hsCode && !productName) {
      return badRequest(res, '请提供HS编码或产品名称')
    }
    
    let result
    if (hsCode) {
      result = await sensitiveProducts.checkInspectionProduct(hsCode)
    } else {
      result = await sensitiveProducts.matchInspectionByName(productName)
    }
    return success(res, result)
  } catch (error) {
    console.error('检查查验产品失败:', error)
    return serverError(res, '检查查验产品失败')
  }
}

/**
 * 创建查验产品
 */
export async function createInspectionProductCtrl(req, res) {
  try {
    const id = await sensitiveProducts.createInspectionProduct(req.body)
    return success(res, { id }, '创建成功')
  } catch (error) {
    console.error('创建查验产品失败:', error)
    return serverError(res, '创建查验产品失败')
  }
}

/**
 * 更新查验产品
 */
export async function updateInspectionProductCtrl(req, res) {
  try {
    const { id } = req.params
    await sensitiveProducts.updateInspectionProduct(parseInt(id), req.body)
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新查验产品失败:', error)
    return serverError(res, '更新查验产品失败')
  }
}

/**
 * 删除查验产品
 */
export async function deleteInspectionProductCtrl(req, res) {
  try {
    const { id } = req.params
    await sensitiveProducts.deleteInspectionProduct(parseInt(id))
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除查验产品失败:', error)
    return serverError(res, '删除查验产品失败')
  }
}

// ==================== 综合产品风险检测 ====================

/**
 * 综合检测产品风险
 */
export async function checkProductRiskCtrl(req, res) {
  try {
    const { hsCode, productName } = req.query
    if (!hsCode && !productName) {
      return badRequest(res, '请提供HS编码或产品名称')
    }
    const result = await sensitiveProducts.checkProductRisk(hsCode, productName)
    return success(res, result)
  } catch (error) {
    console.error('检测产品风险失败:', error)
    return serverError(res, '检测产品风险失败')
  }
}

/**
 * 批量检测导入批次的产品风险
 */
export async function batchCheckImportRiskCtrl(req, res) {
  try {
    const { importId } = req.params
    const result = await sensitiveProducts.batchCheckImportRisk(parseInt(importId))
    return success(res, result)
  } catch (error) {
    console.error('批量检测产品风险失败:', error)
    return serverError(res, '批量检测产品风险失败')
  }
}

/**
 * 获取产品库统计信息
 */
export async function getProductLibraryStatsCtrl(req, res) {
  try {
    const stats = await sensitiveProducts.getProductLibraryStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取产品库统计失败:', error)
    return serverError(res, '获取产品库统计失败')
  }
}

// ==================== AI图片分析 ====================

/**
 * AI分析产品图片 - 识别材质并建议HS编码
 */
export async function analyzeProductImageCtrl(req, res) {
  try {
    const { imagePath, productName, imageUrl, importId, cargoItemId } = req.body
    
    if (!imagePath && !imageUrl) {
      return badRequest(res, '请提供图片路径或URL')
    }
    
    // 动态导入服务（避免模块加载时出错）
    const qwenVision = await import('../../services/qwenVisionService.js')
    
    // 检查服务是否可用
    if (!qwenVision.isServiceAvailable()) {
      return badRequest(res, 'AI分析服务未配置，请联系管理员设置DASHSCOPE_API_KEY')
    }
    
    // 处理图片路径
    let imageSource = imageUrl
    if (!imageSource && imagePath) {
      // 如果是相对路径（如 /uploads/xxx），转为绝对路径
      if (imagePath.startsWith('/uploads/')) {
        // 后端运行在 server/ 目录下，uploads 在同级
        // /uploads/cargo-images/xxx -> uploads/cargo-images/xxx
        imageSource = path.join(process.cwd(), imagePath.substring(1))
      } else {
        imageSource = imagePath
      }
    }
    
    // 获取用户信息用于日志记录
    const context = {
      userId: req.user?.id || null,
      userName: req.user?.name || req.user?.username || 'anonymous',
      importId: importId || null,
      cargoItemId: cargoItemId || null
    }
    
    // 调用AI分析（带日志记录）
    const result = await qwenVision.analyzeProductImage(imageSource, productName || '', context)
    
    if (result.success) {
      return success(res, {
        ...result.data,
        usage: result.usage  // 返回token使用情况
      }, 'AI分析完成')
    } else {
      return serverError(res, result.error || 'AI分析失败')
    }
    
  } catch (error) {
    console.error('AI图片分析失败:', error)
    return serverError(res, 'AI图片分析失败: ' + error.message)
  }
}

/**
 * 获取AI使用统计
 */
export async function getAiUsageStatsCtrl(req, res) {
  try {
    const { days = 30 } = req.query
    const qwenVision = await import('../../services/qwenVisionService.js')
    
    const stats = await qwenVision.getUsageStats(parseInt(days))
    
    if (stats) {
      return success(res, stats)
    } else {
      return serverError(res, '获取统计数据失败')
    }
  } catch (error) {
    console.error('获取AI使用统计失败:', error)
    return serverError(res, '获取AI使用统计失败')
  }
}

/**
 * 获取AI调用记录
 */
export async function getAiUsageLogsCtrl(req, res) {
  try {
    const { limit = 50 } = req.query
    const qwenVision = await import('../../services/qwenVisionService.js')
    
    const logs = await qwenVision.getRecentLogs(parseInt(limit))
    
    return success(res, logs)
  } catch (error) {
    console.error('获取AI调用记录失败:', error)
    return serverError(res, '获取AI调用记录失败')
  }
}

// ==================== 图片处理 ====================

/**
 * 批量重新处理所有图片
 */
export async function reprocessAllImagesCtrl(req, res) {
  try {
    const { batchId, forceAll = false, limit = 50 } = req.body
    
    const results = await importer.reprocessAllImages({
      batchId,
      forceAll,
      limit: parseInt(limit)
    })
    
    return success(res, results, `处理完成: 成功${results.processed}, 失败${results.failed}`)
  } catch (error) {
    console.error('批量重新处理图片失败:', error)
    return serverError(res, '批量处理图片失败')
  }
}

/**
 * 重新处理单张图片
 */
export async function reprocessSingleImageCtrl(req, res) {
  try {
    const { imagePath, forceAi = false } = req.body
    
    if (!imagePath) {
      return badRequest(res, '请提供图片路径')
    }
    
    const result = await importer.reprocessSingleImage(imagePath, { forceAi })
    
    if (result.success) {
      const methodName = result.method === 'ai_super_resolution' ? 'AI超分辨率' : '传统增强'
      return success(res, result, `图片处理成功 (${methodName})`)
    } else {
      return badRequest(res, result.error || '图片处理失败')
    }
  } catch (error) {
    console.error('重新处理图片失败:', error)
    return serverError(res, '图片处理失败')
  }
}

/**
 * 检查AI分析服务状态
 */
export async function checkAiServiceStatusCtrl(req, res) {
  try {
    const qwenVision = await import('../../services/qwenVisionService.js')
    const isAvailable = qwenVision.isServiceAvailable()
    
    return success(res, {
      available: isAvailable,
      service: '阿里通义千问 Qwen-VL',
      message: isAvailable ? 'AI分析服务已就绪' : '未配置DASHSCOPE_API_KEY'
    })
  } catch (error) {
    return success(res, {
      available: false,
      service: '阿里通义千问 Qwen-VL',
      message: '服务检查失败: ' + error.message
    })
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
  updateShipperAndImporter,
  syncShipperFromBL,
  
  // HS匹配
  runBatchMatch,
  getReviewItems,
  getMatchedItems,
  getMatchingStats,
  updateCargoItemDetail,
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
  updateItemTax,
  
  // 贸易条件和完税价格
  getIncotermsList,
  updateTradeTerms,
  updateItemOrigin,
  updateBatchOrigin,
  updateItemDetail,
  recalculateTax,
  getTariffByOrigin,

  // 数据补充
  getSupplementList,
  getSupplementStats,
  batchSupplement,
  autoSupplement,

  // HS匹配记录
  getMatchRecordsList,
  searchMatchRecords,
  getMatchRecordDetail,
  updateMatchRecord,
  verifyMatchRecord,
  deleteMatchRecord,
  saveToMatchRecords,
  
  // 价格异常检测
  checkPriceAnomaly,
  checkSinglePriceAnomaly,
  
  // HS编码税率优化
  analyzeHsTaxRisk,
  findTaxAlternatives,
  searchHsByPrefix,
  getAntiDumpingRisks,
  batchAnalyzeTaxRisk,
  
  // 申报价值分析
  recordDeclaration,
  updateDeclarationResultCtrl,
  getDeclarationStatsCtrl,
  checkDeclarationRiskCtrl,
  batchCheckDeclarationRiskCtrl,
  createDeclarationFromImport,
  getDeclarationHistoryCtrl,
  
  // 查验风险管理
  recordInspectionCtrl,
  updateInspectionCtrl,
  getInspectionStatsCtrl,
  getHighRiskCodesCtrl,
  analyzeInspectionRiskCtrl,
  createInspectionFromImport,
  getInspectionHistoryCtrl,
  getInspectionTypeSummaryCtrl,
  
  // 综合风险分析
  analyzeFullRisk,
  
  // 敏感产品库
  getSensitiveProductsCtrl,
  getSensitiveProductCategoriesCtrl,
  checkSensitiveProductCtrl,
  createSensitiveProductCtrl,
  updateSensitiveProductCtrl,
  deleteSensitiveProductCtrl,
  
  // 查验产品库
  getInspectionProductsCtrl,
  checkInspectionProductCtrl,
  createInspectionProductCtrl,
  updateInspectionProductCtrl,
  deleteInspectionProductCtrl,
  
  // 综合产品风险检测
  checkProductRiskCtrl,
  batchCheckImportRiskCtrl,
  getProductLibraryStatsCtrl,
  
  // AI图片分析
  analyzeProductImageCtrl,
  checkAiServiceStatusCtrl,
  getAiUsageStatsCtrl,
  getAiUsageLogsCtrl,
  
  // 图片处理
  reprocessAllImagesCtrl,
  reprocessSingleImageCtrl
}
