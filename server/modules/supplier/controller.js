/**
 * 供应商管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'
import { translateText, translateFeeName } from '../../utils/translate.js'
import * as unifiedApprovalService from '../../services/unifiedApprovalService.js'

// ==================== 供应商列表 ====================

/**
 * 获取供应商列表
 */
export async function getSupplierList(req, res) {
  try {
    const { search, type, types, status, level, page, pageSize } = req.query

    const result = await model.getSupplierList({
      search,
      type,
      types,  // 支持多类型过滤（逗号分隔）
      status,
      level,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取供应商列表失败:', error)
    return serverError(res, '获取供应商列表失败')
  }
}

/**
 * 获取供应商统计
 */
export async function getSupplierStats(req, res) {
  try {
    const stats = await model.getSupplierStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取供应商统计失败:', error)
    return serverError(res, '获取供应商统计失败')
  }
}

/**
 * 获取供应商详情
 */
export async function getSupplierById(req, res) {
  try {
    const supplier = await model.getSupplierById(req.params.id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    return success(res, supplier)
  } catch (error) {
    console.error('获取供应商详情失败:', error)
    return serverError(res, '获取供应商详情失败')
  }
}

/**
 * 获取启用的供应商列表（下拉选择用）
 */
export async function getActiveSuppliers(req, res) {
  try {
    const list = await model.getActiveSuppliers()
    return success(res, list)
  } catch (error) {
    console.error('获取供应商选项失败:', error)
    return serverError(res, '获取供应商选项失败')
  }
}

/**
 * 生成供应商编码
 */
export async function generateSupplierCode(req, res) {
  try {
    const code = await model.generateSupplierCode()
    return success(res, { code })
  } catch (error) {
    console.error('生成供应商编码失败:', error)
    return serverError(res, '生成供应商编码失败')
  }
}

// ==================== 供应商CRUD ====================

/**
 * 创建供应商
 */
export async function createSupplier(req, res) {
  try {
    const { supplierCode, supplierName } = req.body
    
    // 验证必填字段
    if (!supplierCode || !supplierName) {
      return badRequest(res, '供应商编码和名称为必填项')
    }
    
    // 检查编码是否已存在
    if (await model.checkSupplierCodeExists(supplierCode)) {
      return badRequest(res, '供应商编码已存在')
    }
    
    // 添加创建者信息
    const data = {
      ...req.body,
      createdBy: req.user?.name || '系统'
    }
    
    const result = await model.createSupplier(data)
    const newSupplier = await model.getSupplierById(result.id)
    
    return success(res, newSupplier, '创建成功')
  } catch (error) {
    console.error('创建供应商失败:', error)
    if (error.message?.includes('UNIQUE constraint')) {
      return badRequest(res, '供应商编码已存在')
    }
    return serverError(res, '创建供应商失败')
  }
}

/**
 * 更新供应商
 */
export async function updateSupplier(req, res) {
  try {
    const { id } = req.params
    
    // 检查供应商是否存在
    const existing = await model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    // 如果修改了编码，检查是否重复
    if (req.body.supplierCode && req.body.supplierCode !== existing.supplierCode) {
      if (await model.checkSupplierCodeExists(req.body.supplierCode, id)) {
        return badRequest(res, '供应商编码已存在')
      }
    }
    
    // 添加更新者信息
    const data = {
      ...req.body,
      updatedBy: req.user?.name || '系统'
    }
    
    const updated = await model.updateSupplier(id, data)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedSupplier = await model.getSupplierById(id)
    return success(res, updatedSupplier, '更新成功')
  } catch (error) {
    console.error('更新供应商失败:', error)
    return serverError(res, '更新供应商失败')
  }
}

/**
 * 删除供应商
 * 需要审批：检查 SUPPLIER_DELETE 触发点配置
 */
export async function deleteSupplier(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    // 检查是否需要审批
    const { needsApproval, approval, error } = await unifiedApprovalService.checkAndCreate('SUPPLIER_DELETE', {
      title: `删除供应商 - ${existing.supplier_name}`,
      content: `申请删除供应商「${existing.supplier_name}」(${existing.supplier_code})`,
      businessId: id,
      businessTable: 'suppliers',
      applicantId: req.user?.id,
      applicantName: req.user?.name,
      applicantRole: req.user?.role,
      requestData: { supplier: existing }
    })
    
    if (needsApproval) {
      // 需要审批，返回提示信息
      return success(res, { 
        needsApproval: true, 
        approvalNo: approval?.approval_no,
        message: '删除申请已提交审批'
      }, '删除申请已提交审批，请等待审批通过')
    }
    
    // 不需要审批，直接删除
    model.deleteSupplier(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除供应商失败:', error)
    return serverError(res, '删除供应商失败')
  }
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(req, res) {
  try {
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请选择要删除的供应商')
    }
    
    const deletedCount = await model.batchDeleteSuppliers(ids)
    return success(res, { deletedCount }, `成功删除 ${deletedCount} 个供应商`)
  } catch (error) {
    console.error('批量删除供应商失败:', error)
    return serverError(res, '批量删除供应商失败')
  }
}

/**
 * 更新供应商状态
 */
export async function updateSupplierStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status) {
      return badRequest(res, '状态不能为空')
    }
    
    const existing = await model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    const updated = await model.updateSupplierStatus(id, status, req.user?.name || '系统')
    if (!updated) {
      return badRequest(res, '更新状态失败')
    }
    
    const updatedSupplier = await model.getSupplierById(id)
    return success(res, updatedSupplier, '状态更新成功')
  } catch (error) {
    console.error('更新供应商状态失败:', error)
    return serverError(res, '更新供应商状态失败')
  }
}

// ==================== 采购价管理 ====================

/**
 * 获取供应商采购价列表
 */
export async function getSupplierPrices(req, res) {
  try {
    const { id } = req.params
    const { category, isActive, search } = req.query
    
    // 检查供应商是否存在
    const supplier = await model.getSupplierById(id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    
    const prices = await model.getSupplierPrices(id, {
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search
    })
    
    // 返回 { list: [...] } 格式，与前端期望一致
    return success(res, { list: prices, total: prices.length })
  } catch (error) {
    console.error('获取采购价列表失败:', error)
    return serverError(res, '获取采购价列表失败')
  }
}

/**
 * 创建采购价
 */
export async function createSupplierPrice(req, res) {
  try {
    const { id } = req.params
    const { 
      category, name, nameEn, unit, unitPrice, currency, 
      validFrom, validUntil, notes,
      routeFrom, routeTo, returnPoint, transportMode, billingType  // 新增字段
    } = req.body
    
    // 验证必填字段
    if (!category || !name || unitPrice === undefined) {
      return badRequest(res, '费用类别、名称和单价为必填项')
    }
    
    // 检查供应商是否存在
    const supplier = await model.getSupplierById(id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    
    const result = await model.createSupplierPrice({
      supplierId: id,
      supplierName: supplier.supplierName,  // 添加供应商名称
      category,
      name,
      nameEn,
      unit,
      unitPrice,
      currency,
      validFrom,
      validUntil,
      notes,
      routeFrom,       // 起运地
      routeTo,         // 目的地
      returnPoint,     // 还柜点
      transportMode,   // 运输方式
      billingType      // 计费类型
    })
    
    return success(res, result, '创建成功')
  } catch (error) {
    console.error('创建采购价失败:', error)
    return serverError(res, '创建采购价失败')
  }
}

/**
 * 更新采购价
 */
export async function updateSupplierPrice(req, res) {
  try {
    const { id, priceId } = req.params
    
    // 检查供应商是否存在
    const supplier = await model.getSupplierById(id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    
    // 检查采购价是否存在
    const existing = await model.getSupplierPriceById(priceId)
    if (!existing) {
      return notFound(res, '采购价不存在')
    }
    
    const updated = await model.updateSupplierPrice(priceId, req.body)
    return success(res, updated, '更新成功')
  } catch (error) {
    console.error('更新采购价失败:', error)
    return serverError(res, '更新采购价失败')
  }
}

/**
 * 删除采购价
 */
export async function deleteSupplierPrice(req, res) {
  try {
    const { id, priceId } = req.params
    
    // 检查供应商是否存在
    const supplier = await model.getSupplierById(id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    
    // 检查采购价是否存在
    const existing = await model.getSupplierPriceById(priceId)
    if (!existing) {
      return notFound(res, '采购价不存在')
    }
    
    await model.deleteSupplierPrice(priceId)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除采购价失败:', error)
    return serverError(res, '删除采购价失败')
  }
}

// ==================== 翻译 API ====================

/**
 * 翻译文本
 */
export async function translate(req, res) {
  try {
    const { text, from, to } = req.body
    
    if (!text) {
      return badRequest(res, '翻译文本不能为空')
    }
    
    const translated = await translateText(text, from || 'zh-CN', to || 'en')
    return success(res, { original: text, translated })
  } catch (error) {
    console.error('翻译失败:', error)
    return serverError(res, '翻译失败')
  }
}

/**
 * 翻译费用名称（带预设映射）
 */
export async function translateFee(req, res) {
  try {
    const { name } = req.body
    
    if (!name) {
      return badRequest(res, '费用名称不能为空')
    }
    
    const translated = await translateFeeName(name)
    return success(res, { original: name, translated })
  } catch (error) {
    console.error('翻译费用名称失败:', error)
    return serverError(res, '翻译费用名称失败')
  }
}

// ==================== 供应商报价智能导入 ====================

/**
 * 解析上传的文件（预览阶段）
 */
export async function parseImportFile(req, res) {
  try {
    if (!req.file) {
      return badRequest(res, '请上传文件')
    }
    
    const { buffer, originalname } = req.file
    
    // 动态导入解析器
    const { parseImportFile: parse, validateAndNormalizeData, mergeSheetData } = 
      await import('../../utils/importRecognizer.js')
    
    // 解析文件
    const parseResult = await parse(buffer, originalname)
    
    if (!parseResult.success) {
      return badRequest(res, parseResult.error || parseResult.message || '文件解析失败')
    }
    
    // 根据文件类型处理数据
    let previewData
    if (parseResult.fileType === 'excel' && parseResult.sheets) {
      // Excel 文件 - 返回各 Sheet 的预览数据
      previewData = {
        fileType: 'excel',
        sheetCount: parseResult.sheetCount,
        sheets: parseResult.sheets.map(sheet => ({
          name: sheet.name,
          headers: sheet.headers,
          fieldMapping: sheet.fieldMapping,
          rowCount: sheet.rowCount,
          preview: sheet.rawRows || [],
          data: sheet.data
        })),
        totalRecords: parseResult.totalRecords
      }
    } else {
      // PDF 或其他格式
      const validated = validateAndNormalizeData(parseResult.data || [])
      previewData = {
        fileType: parseResult.fileType,
        pageCount: parseResult.pageCount,
        data: validated.data,
        validCount: validated.validCount,
        warningCount: validated.warningCount,
        totalRecords: validated.totalCount
      }
    }
    
    return success(res, previewData)
  } catch (error) {
    console.error('解析导入文件失败:', error)
    return serverError(res, '解析文件失败: ' + error.message)
  }
}

/**
 * 确认导入数据
 */
export async function confirmImport(req, res) {
  try {
    const { id: supplierId } = req.params
    const { items, fileName } = req.body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return badRequest(res, '导入数据为空')
    }
    
    // 获取供应商信息
    const supplier = await model.getSupplierById(supplierId)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    
    // 批量创建供应商报价
    const importBatchId = `IMP${Date.now()}`
    const results = await model.batchCreateSupplierPrices(supplierId, items, {
      supplierName: supplier.supplierName,
      importBatchId,
      fileName
    })
    
    // 记录导入历史
    await model.createImportRecord({
      supplierId,
      supplierName: supplier.supplierName,
      fileName,
      recordCount: results.successCount,
      status: 'completed',
      importBatchId
    })
    
    return success(res, {
      message: '导入成功',
      importBatchId,
      successCount: results.successCount,
      failCount: results.failCount
    })
  } catch (error) {
    console.error('确认导入失败:', error)
    return serverError(res, '导入失败: ' + error.message)
  }
}

/**
 * 获取导入历史记录
 */
export async function getImportRecords(req, res) {
  try {
    const { id: supplierId } = req.params
    const { page = 1, pageSize = 20 } = req.query
    
    const records = await model.getImportRecords(supplierId, { page, pageSize })
    return success(res, records)
  } catch (error) {
    console.error('获取导入记录失败:', error)
    return serverError(res, '获取导入记录失败')
  }
}

/**
 * 匹配运输报价
 * 根据起点和终点匹配供应商的运输报价
 */
export async function matchTransportPrices(req, res) {
  try {
    const { origin, destination, originPostalCode, destPostalCode } = req.query
    
    if (!destination && !destPostalCode) {
      return badRequest(res, '请提供目的地信息')
    }
    
    const prices = await model.matchTransportPrices({
      origin,
      destination,
      originPostalCode,
      destPostalCode
    })
    
    return success(res, prices, `找到 ${prices.length} 条匹配的运输报价`)
  } catch (error) {
    console.error('匹配运输报价失败:', error)
    return serverError(res, '匹配运输报价失败')
  }
}

/**
 * 供应商运输报价比对分析
 * 将供应商报价与市场参考价格（基于距离计算）进行对比
 */
export async function compareTransportPrices(req, res) {
  try {
    const { origin, destination, truckType, distance } = req.body
    
    if (!origin || !destination) {
      return badRequest(res, '请提供起点和终点')
    }
    
    // 1. 获取匹配的供应商报价
    const supplierPrices = await model.matchTransportPrices({
      origin,
      destination
    })
    
    // 2. 计算市场参考价格（基于距离和标准费率）
    // 欧洲卡车运输市场参考费率（€/km）
    const marketRates = {
      sprinter: { ratePerKm: 1.0, minCharge: 80 },
      small_van: { ratePerKm: 1.2, minCharge: 100 },
      medium_van: { ratePerKm: 1.5, minCharge: 150 },
      large_van: { ratePerKm: 1.8, minCharge: 200 },
      curtainsider: { ratePerKm: 2.2, minCharge: 350 },
      semi_40: { ratePerKm: 2.5, minCharge: 400 },
      mega_trailer: { ratePerKm: 2.7, minCharge: 450 },
      double_deck: { ratePerKm: 3.0, minCharge: 500 },
      reefer_small: { ratePerKm: 2.0, minCharge: 200 },
      reefer_large: { ratePerKm: 3.5, minCharge: 600 },
      flatbed: { ratePerKm: 2.8, minCharge: 450 },
      lowloader: { ratePerKm: 4.0, minCharge: 800 },
      hazmat: { ratePerKm: 4.5, minCharge: 700 },
      tanker: { ratePerKm: 3.8, minCharge: 600 }
    }
    
    // 默认使用标准半挂费率
    const selectedRate = marketRates[truckType] || marketRates.semi_40
    
    // 如果提供了距离，计算市场参考价
    let marketRefPrice = null
    if (distance && distance > 0) {
      const baseCost = distance * selectedRate.ratePerKm
      marketRefPrice = Math.max(baseCost, selectedRate.minCharge)
      // 加上估算的通行费（约 0.15€/km）和燃油附加费（5%）
      const tolls = distance * 0.15
      const fuelSurcharge = baseCost * 0.05
      marketRefPrice = Math.round((marketRefPrice + tolls + fuelSurcharge) * 100) / 100
    }
    
    // 3. 对供应商报价进行分析
    const analysis = supplierPrices.map(price => {
      let advantage = 'unknown'
      let diffPercent = null
      let diffAmount = null
      
      if (marketRefPrice && price.price) {
        diffAmount = price.price - marketRefPrice
        diffPercent = ((price.price - marketRefPrice) / marketRefPrice * 100).toFixed(1)
        
        if (price.price < marketRefPrice * 0.9) {
          advantage = 'strong' // 价格优势明显（低于市场价10%以上）
        } else if (price.price < marketRefPrice) {
          advantage = 'slight' // 略有优势
        } else if (price.price > marketRefPrice * 1.1) {
          advantage = 'weak' // 价格劣势明显（高于市场价10%以上）
        } else {
          advantage = 'normal' // 价格合理
        }
      }
      
      return {
        ...price,
        marketRefPrice,
        diffAmount: diffAmount ? Math.round(diffAmount * 100) / 100 : null,
        diffPercent: diffPercent ? parseFloat(diffPercent) : null,
        advantage,
        ratePerKm: distance > 0 ? Math.round(price.price / distance * 100) / 100 : null
      }
    })
    
    // 4. 按优势排序（优势大的在前）
    analysis.sort((a, b) => {
      const order = { strong: 1, slight: 2, normal: 3, weak: 4, unknown: 5 }
      return (order[a.advantage] || 5) - (order[b.advantage] || 5)
    })
    
    // 5. 统计分析结果
    const summary = {
      totalSuppliers: analysis.length,
      strongAdvantage: analysis.filter(a => a.advantage === 'strong').length,
      slightAdvantage: analysis.filter(a => a.advantage === 'slight').length,
      normalPrice: analysis.filter(a => a.advantage === 'normal').length,
      weakAdvantage: analysis.filter(a => a.advantage === 'weak').length,
      marketRefPrice,
      marketRatePerKm: selectedRate.ratePerKm,
      distance,
      bestPrice: analysis.length > 0 ? Math.min(...analysis.filter(a => a.price).map(a => a.price)) : null,
      avgPrice: analysis.length > 0 ? Math.round(analysis.filter(a => a.price).reduce((sum, a) => sum + a.price, 0) / analysis.filter(a => a.price).length * 100) / 100 : null
    }
    
    return success(res, { analysis, summary }, `已完成 ${analysis.length} 家供应商的价格比对分析`)
  } catch (error) {
    console.error('供应商价格比对分析失败:', error)
    return serverError(res, '供应商价格比对分析失败')
  }
}

/**
 * 获取运输报价概览
 * 按路线分组显示供应商报价情况
 */
export async function getTransportPriceOverview(req, res) {
  try {
    const { supplierId, feeCategory } = req.query
    
    const overview = await model.getTransportPriceOverview({
      supplierId,
      feeCategory: feeCategory || 'transport'
    })
    
    return success(res, overview, `获取到 ${overview.length} 条路线的报价概览`)
  } catch (error) {
    console.error('获取运输报价概览失败:', error)
    return serverError(res, '获取运输报价概览失败')
  }
}

export default {
  getSupplierList,
  getSupplierStats,
  getSupplierById,
  getActiveSuppliers,
  generateSupplierCode,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  batchDeleteSuppliers,
  updateSupplierStatus,
  // 采购价管理
  getSupplierPrices,
  createSupplierPrice,
  updateSupplierPrice,
  deleteSupplierPrice,
  // 翻译
  translate,
  translateFee,
  // 智能导入
  parseImportFile,
  confirmImport,
  getImportRecords,
  // 运输报价匹配与分析
  matchTransportPrices,
  compareTransportPrices,
  getTransportPriceOverview
}
