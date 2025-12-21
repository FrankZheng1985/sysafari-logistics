/**
 * 统一报价中心 - 控制器
 * 处理报价导入、费率查询、利润分析等业务逻辑
 */

import * as model from './model.js'
import * as lastMileModel from '../last-mile/model.js'

// ==================== 导入模板管理 ====================

/**
 * 获取导入模板列表
 */
export async function getImportTemplates(req, res) {
  try {
    const { carrierId, isActive, search, page, pageSize } = req.query
    const result = await model.getImportTemplates({
      carrierId: carrierId ? parseInt(carrierId) : null,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result
    })
  } catch (error) {
    console.error('获取导入模板列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取导入模板列表失败: ' + error.message
    })
  }
}

/**
 * 获取导入模板详情
 */
export async function getImportTemplateById(req, res) {
  try {
    const { id } = req.params
    const template = await model.getImportTemplateById(id)
    
    if (!template) {
      return res.status(404).json({
        errCode: 404,
        msg: '导入模板不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: template
    })
  } catch (error) {
    console.error('获取导入模板详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取导入模板详情失败: ' + error.message
    })
  }
}

/**
 * 创建导入模板
 */
export async function createImportTemplate(req, res) {
  try {
    const data = req.body
    
    if (!data.templateName) {
      return res.status(400).json({
        errCode: 400,
        msg: '模板名称为必填项'
      })
    }
    
    const result = await model.createImportTemplate(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建导入模板失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建导入模板失败: ' + error.message
    })
  }
}

/**
 * 更新导入模板
 */
export async function updateImportTemplate(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateImportTemplate(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '导入模板不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新导入模板失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新导入模板失败: ' + error.message
    })
  }
}

/**
 * 删除导入模板
 */
export async function deleteImportTemplate(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteImportTemplate(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '导入模板不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除导入模板失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除导入模板失败: ' + error.message
    })
  }
}

// ==================== 导入记录管理 ====================

/**
 * 获取导入记录列表
 */
export async function getImportLogs(req, res) {
  try {
    const { carrierId, status, startDate, endDate, page, pageSize } = req.query
    const result = await model.getImportLogs({
      carrierId: carrierId ? parseInt(carrierId) : null,
      status,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result
    })
  } catch (error) {
    console.error('获取导入记录列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取导入记录列表失败: ' + error.message
    })
  }
}

/**
 * 获取导入记录详情
 */
export async function getImportLogById(req, res) {
  try {
    const { id } = req.params
    const log = await model.getImportLogById(id)
    
    if (!log) {
      return res.status(404).json({
        errCode: 404,
        msg: '导入记录不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: log
    })
  } catch (error) {
    console.error('获取导入记录详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取导入记录详情失败: ' + error.message
    })
  }
}

/**
 * 确认导入（将预览数据保存为正式费率卡）
 */
export async function confirmImport(req, res) {
  try {
    const { id } = req.params
    const { rateCardName, validFrom, validUntil, confirmedBy } = req.body
    
    // 获取导入记录
    const importLog = await model.getImportLogById(id)
    if (!importLog) {
      return res.status(404).json({
        errCode: 404,
        msg: '导入记录不存在'
      })
    }
    
    if (importLog.status !== 'preview') {
      return res.status(400).json({
        errCode: 400,
        msg: '只有预览状态的记录才能确认导入'
      })
    }
    
    if (!importLog.parsedData || !importLog.parsedData.tiers) {
      return res.status(400).json({
        errCode: 400,
        msg: '没有可导入的数据'
      })
    }
    
    // 创建费率卡
    const rateCard = await lastMileModel.createRateCard({
      carrierId: importLog.carrierId,
      rateCardName: rateCardName || `导入费率卡-${new Date().toISOString().split('T')[0]}`,
      rateType: 'last_mile',
      validFrom: validFrom || new Date().toISOString().split('T')[0],
      validUntil: validUntil || null,
      importLogId: id
    })
    
    // 批量创建费率明细
    const tiers = importLog.parsedData.tiers
    await lastMileModel.batchCreateRateTiers(rateCard.id, tiers)
    
    // 更新导入记录状态
    await model.updateImportLog(id, {
      status: 'confirmed',
      rateCardId: rateCard.id,
      confirmedBy: confirmedBy || '',
      confirmedAt: new Date().toISOString()
    })
    
    res.json({
      errCode: 200,
      msg: '导入成功',
      data: {
        rateCardId: rateCard.id,
        rateCardCode: rateCard.rateCardCode,
        tierCount: tiers.length
      }
    })
  } catch (error) {
    console.error('确认导入失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '确认导入失败: ' + error.message
    })
  }
}

// ==================== 费率查询 ====================

/**
 * 获取有效费率卡
 */
export async function getActiveRateCard(req, res) {
  try {
    const { carrierId, rateType, serviceType, date } = req.query
    const rateCard = await model.getActiveRateCard({
      carrierId: carrierId ? parseInt(carrierId) : null,
      rateType,
      serviceType,
      date
    })
    
    if (!rateCard) {
      return res.status(404).json({
        errCode: 404,
        msg: '未找到有效的费率卡'
      })
    }
    
    // 获取费率明细（按Zone分组）
    rateCard.tiersByZone = await model.getRateCardTiersByZone(rateCard.id)
    
    // 获取附加费
    rateCard.surcharges = await model.getRateCardSurcharges(rateCard.id)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: rateCard
    })
  } catch (error) {
    console.error('获取有效费率卡失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取有效费率卡失败: ' + error.message
    })
  }
}

/**
 * 查询指定条件的费率
 */
export async function queryRate(req, res) {
  try {
    const { carrierId, zoneCode, weight, serviceType, date } = req.query
    
    if (!carrierId || !zoneCode || !weight) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商、Zone和重量为必填项'
      })
    }
    
    // 获取有效费率卡
    const rateCard = await model.getActiveRateCard({
      carrierId: parseInt(carrierId),
      serviceType,
      date
    })
    
    if (!rateCard) {
      return res.status(404).json({
        errCode: 404,
        msg: '未找到有效的费率卡'
      })
    }
    
    // 查询费率
    const tier = await model.findRateTier(rateCard.id, zoneCode, parseFloat(weight))
    
    if (!tier) {
      return res.status(404).json({
        errCode: 404,
        msg: '未找到匹配的费率'
      })
    }
    
    // 获取附加费
    const surcharges = await model.getRateCardSurcharges(rateCard.id)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: {
        rateCard: {
          id: rateCard.id,
          rateCardCode: rateCard.rateCardCode,
          rateCardName: rateCard.rateCardName,
          currency: rateCard.currency
        },
        tier,
        surcharges: surcharges.filter(s => s.isMandatory)
      }
    })
  } catch (error) {
    console.error('查询费率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '查询费率失败: ' + error.message
    })
  }
}

// ==================== 利润分析 ====================

/**
 * 获取费率卡利润汇总
 */
export async function getRateCardProfitSummary(req, res) {
  try {
    const { rateCardId } = req.params
    const summary = await model.getRateCardProfitSummary(rateCardId)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: summary
    })
  } catch (error) {
    console.error('获取费率卡利润汇总失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取费率卡利润汇总失败: ' + error.message
    })
  }
}

/**
 * 获取承运商利润统计
 */
export async function getCarrierProfitStats(req, res) {
  try {
    const { carrierId, startDate, endDate } = req.query
    const stats = await model.getCarrierProfitStats({
      carrierId: carrierId ? parseInt(carrierId) : null,
      startDate,
      endDate
    })
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: stats
    })
  } catch (error) {
    console.error('获取承运商利润统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取承运商利润统计失败: ' + error.message
    })
  }
}

/**
 * 利润对比分析
 */
export async function getProfitComparison(req, res) {
  try {
    const { weight, zoneCode } = req.query
    
    if (!weight || !zoneCode) {
      return res.status(400).json({
        errCode: 400,
        msg: '重量和Zone为必填项'
      })
    }
    
    // 获取所有承运商
    const carriersResult = await lastMileModel.getCarriers({ status: 'active', pageSize: 100 })
    const carriers = carriersResult.list
    
    const comparisons = []
    
    for (const carrier of carriers) {
      // 获取该承运商的有效费率卡
      const rateCard = await model.getActiveRateCard({ carrierId: carrier.id })
      if (!rateCard) continue
      
      // 查询费率
      const tier = await model.findRateTier(rateCard.id, zoneCode, parseFloat(weight))
      if (!tier) continue
      
      comparisons.push({
        carrierId: carrier.id,
        carrierCode: carrier.carrierCode,
        carrierName: carrier.carrierName,
        rateCardId: rateCard.id,
        rateCardName: rateCard.rateCardName,
        purchasePrice: tier.purchasePrice,
        salesPrice: tier.salesPrice,
        profit: tier.salesPrice && tier.purchasePrice ? tier.salesPrice - tier.purchasePrice : null,
        profitRate: tier.salesPrice && tier.purchasePrice && tier.purchasePrice > 0 
          ? ((tier.salesPrice - tier.purchasePrice) / tier.purchasePrice * 100).toFixed(2)
          : null
      })
    }
    
    // 按采购价排序
    comparisons.sort((a, b) => (a.purchasePrice || 999999) - (b.purchasePrice || 999999))
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: {
        weight: parseFloat(weight),
        zoneCode,
        comparisons
      }
    })
  } catch (error) {
    console.error('获取利润对比分析失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取利润对比分析失败: ' + error.message
    })
  }
}

// ==================== 文件上传解析 ====================

import * as importManager from '../last-mile/importers/index.js'

/**
 * 解析上传的报价文件
 */
export async function parseUploadedFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传文件'
      })
    }
    
    const { templateId } = req.body
    const file = req.file
    
    // 获取模板配置（如果指定）
    let templateConfig = null
    if (templateId) {
      templateConfig = await model.getImportTemplateById(templateId)
    }
    
    // 解析文件
    const parseResult = await importManager.parseFile(
      file.buffer,
      file.originalname,
      templateConfig || {}
    )
    
    if (!parseResult.success) {
      return res.status(400).json({
        errCode: 400,
        msg: parseResult.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: '解析成功',
      data: {
        fileName: file.originalname,
        fileType: parseResult.fileType,
        sheetName: parseResult.data?.sheetName,
        availableSheets: parseResult.data?.availableSheets,
        totalRows: parseResult.data?.totalRows,
        totalColumns: parseResult.data?.totalColumns,
        headers: parseResult.data?.headers,
        previewRows: parseResult.data?.rows?.slice(0, 10),
        formatDetection: parseResult.formatDetection,
        autoMapping: parseResult.autoMapping
      }
    })
  } catch (error) {
    console.error('解析文件失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '解析文件失败: ' + error.message
    })
  }
}

/**
 * 预览导入数据
 */
export async function previewImportData(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传文件'
      })
    }
    
    const { carrierId, mapping, format, headerRow, dataStartRow } = req.body
    const file = req.file
    
    // 解析文件
    const parseResult = await importManager.parseFile(
      file.buffer,
      file.originalname,
      { headerRow: parseInt(headerRow) || 1, dataStartRow: parseInt(dataStartRow) || 2 }
    )
    
    if (!parseResult.success) {
      return res.status(400).json({
        errCode: 400,
        msg: parseResult.error
      })
    }
    
    // 应用映射预览
    const mappingConfig = mapping ? JSON.parse(mapping) : parseResult.autoMapping
    const previewResult = importManager.previewImport(
      parseResult,
      mappingConfig,
      {
        headerRow: parseInt(headerRow) || 0,
        dataStartRow: parseInt(dataStartRow) || 1,
        format: format || 'auto'
      }
    )
    
    if (!previewResult.success) {
      return res.status(400).json({
        errCode: 400,
        msg: previewResult.error
      })
    }
    
    // 创建导入记录（预览状态）
    const importLog = await model.createImportLog({
      carrierId: carrierId ? parseInt(carrierId) : null,
      fileName: file.originalname,
      fileType: parseResult.fileType,
      status: 'preview',
      totalRows: previewResult.totalRecords,
      parsedData: {
        tiers: previewResult.allRates,
        mapping: mappingConfig
      }
    })
    
    res.json({
      errCode: 200,
      msg: '预览成功',
      data: {
        importLogId: importLog.id,
        format: previewResult.format,
        totalRecords: previewResult.totalRecords,
        previewRecords: previewResult.previewRecords,
        rates: previewResult.rates,
        validation: previewResult.validation,
        summary: previewResult.summary
      }
    })
  } catch (error) {
    console.error('预览导入数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '预览导入数据失败: ' + error.message
    })
  }
}

/**
 * 检查OCR服务状态
 */
export async function checkOCRStatus(req, res) {
  try {
    const status = importManager.checkOCRStatus()
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: status
    })
  } catch (error) {
    console.error('检查OCR状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '检查OCR状态失败: ' + error.message
    })
  }
}

export default {
  // 导入模板
  getImportTemplates,
  getImportTemplateById,
  createImportTemplate,
  updateImportTemplate,
  deleteImportTemplate,
  
  // 导入记录
  getImportLogs,
  getImportLogById,
  confirmImport,
  
  // 文件解析
  parseUploadedFile,
  previewImportData,
  checkOCRStatus,
  
  // 费率查询
  getActiveRateCard,
  queryRate,
  
  // 利润分析
  getRateCardProfitSummary,
  getCarrierProfitStats,
  getProfitComparison
}
