/**
 * 最后里程模块 - 控制器
 * 处理承运商、Zone、费率卡、运单等业务逻辑
 */

import * as model from './model.js'
import * as calculator from './calculator.js'
import * as shipmentService from './shipmentService.js'

// ==================== 承运商管理 ====================

/**
 * 获取承运商列表
 */
export async function getCarriers(req, res) {
  try {
    const { type, status, search, page, pageSize } = req.query
    const result = await model.getCarriers({
      type,
      status,
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
    console.error('获取承运商列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取承运商列表失败: ' + error.message
    })
  }
}

/**
 * 获取承运商详情
 */
export async function getCarrierById(req, res) {
  try {
    const { id } = req.params
    const carrier = await model.getCarrierById(id)
    
    if (!carrier) {
      return res.status(404).json({
        errCode: 404,
        msg: '承运商不存在'
      })
    }
    
    // 获取该承运商的Zone列表
    carrier.zones = await model.getZones(id)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: carrier
    })
  } catch (error) {
    console.error('获取承运商详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取承运商详情失败: ' + error.message
    })
  }
}

/**
 * 创建承运商
 */
export async function createCarrier(req, res) {
  try {
    const data = req.body
    
    if (!data.carrierCode || !data.carrierName) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商编码和名称为必填项'
      })
    }
    
    // 检查编码是否已存在
    const existing = await model.getCarrierByCode(data.carrierCode)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商编码已存在'
      })
    }
    
    const result = await model.createCarrier(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建承运商失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建承运商失败: ' + error.message
    })
  }
}

/**
 * 更新承运商
 */
export async function updateCarrier(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateCarrier(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '承运商不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新承运商失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新承运商失败: ' + error.message
    })
  }
}

/**
 * 删除承运商
 */
export async function deleteCarrier(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteCarrier(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '承运商不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除承运商失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除承运商失败: ' + error.message
    })
  }
}

// ==================== Zone配置管理 ====================

/**
 * 获取承运商的Zone列表
 */
export async function getZones(req, res) {
  try {
    const { carrierId } = req.params
    const zones = await model.getZones(carrierId)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: zones
    })
  } catch (error) {
    console.error('获取Zone列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取Zone列表失败: ' + error.message
    })
  }
}

/**
 * 创建Zone
 */
export async function createZone(req, res) {
  try {
    const { carrierId } = req.params
    const data = { ...req.body, carrierId: parseInt(carrierId) }
    
    if (!data.zoneCode) {
      return res.status(400).json({
        errCode: 400,
        msg: 'Zone编码为必填项'
      })
    }
    
    const result = await model.createZone(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建Zone失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建Zone失败: ' + error.message
    })
  }
}

/**
 * 更新Zone
 */
export async function updateZone(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateZone(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: 'Zone不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新Zone失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新Zone失败: ' + error.message
    })
  }
}

/**
 * 删除Zone
 */
export async function deleteZone(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteZone(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: 'Zone不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除Zone失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除Zone失败: ' + error.message
    })
  }
}

/**
 * 批量创建Zone
 */
export async function batchCreateZones(req, res) {
  try {
    const { carrierId } = req.params
    const { zones } = req.body
    
    if (!zones || !Array.isArray(zones) || zones.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: 'zones数组为必填项'
      })
    }
    
    const result = await model.batchCreateZones(parseInt(carrierId), zones)
    
    res.json({
      errCode: 200,
      msg: `成功创建 ${result.successCount}/${result.totalCount} 个Zone`,
      data: result
    })
  } catch (error) {
    console.error('批量创建Zone失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '批量创建Zone失败: ' + error.message
    })
  }
}

// ==================== 费率卡管理 ====================

/**
 * 获取费率卡列表
 */
export async function getRateCards(req, res) {
  try {
    const { carrierId, rateType, status, search, page, pageSize } = req.query
    const result = await model.getRateCards({
      carrierId: carrierId ? parseInt(carrierId) : null,
      rateType,
      status,
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
    console.error('获取费率卡列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取费率卡列表失败: ' + error.message
    })
  }
}

/**
 * 获取费率卡详情
 */
export async function getRateCardById(req, res) {
  try {
    const { id } = req.params
    const rateCard = await model.getRateCardById(id)
    
    if (!rateCard) {
      return res.status(404).json({
        errCode: 404,
        msg: '费率卡不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: rateCard
    })
  } catch (error) {
    console.error('获取费率卡详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取费率卡详情失败: ' + error.message
    })
  }
}

/**
 * 创建费率卡
 */
export async function createRateCard(req, res) {
  try {
    const data = req.body
    
    if (!data.rateCardName || !data.validFrom) {
      return res.status(400).json({
        errCode: 400,
        msg: '费率卡名称和生效日期为必填项'
      })
    }
    
    const result = await model.createRateCard(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建费率卡失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建费率卡失败: ' + error.message
    })
  }
}

/**
 * 更新费率卡
 */
export async function updateRateCard(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateRateCard(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '费率卡不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新费率卡失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新费率卡失败: ' + error.message
    })
  }
}

/**
 * 删除费率卡
 */
export async function deleteRateCard(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteRateCard(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '费率卡不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除费率卡失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除费率卡失败: ' + error.message
    })
  }
}

// ==================== 费率明细管理 ====================

/**
 * 批量创建费率明细
 */
export async function batchCreateRateTiers(req, res) {
  try {
    const { rateCardId } = req.params
    const { tiers, clearExisting } = req.body
    
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: 'tiers数组为必填项'
      })
    }
    
    // 如果需要先清空现有数据
    if (clearExisting) {
      await model.clearRateTiers(parseInt(rateCardId))
    }
    
    const result = await model.batchCreateRateTiers(parseInt(rateCardId), tiers)
    
    res.json({
      errCode: 200,
      msg: `成功创建 ${result.successCount}/${result.totalCount} 条费率明细`,
      data: result
    })
  } catch (error) {
    console.error('批量创建费率明细失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '批量创建费率明细失败: ' + error.message
    })
  }
}

/**
 * 更新费率明细
 */
export async function updateRateTier(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateRateTier(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '费率明细不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新费率明细失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新费率明细失败: ' + error.message
    })
  }
}

/**
 * 删除费率明细
 */
export async function deleteRateTier(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteRateTier(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '费率明细不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除费率明细失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除费率明细失败: ' + error.message
    })
  }
}

// ==================== 附加费管理 ====================

/**
 * 创建附加费
 */
export async function createSurcharge(req, res) {
  try {
    const { rateCardId } = req.params
    const data = { ...req.body, rateCardId: parseInt(rateCardId) }
    
    if (!data.surchargeCode || !data.surchargeName) {
      return res.status(400).json({
        errCode: 400,
        msg: '附加费编码和名称为必填项'
      })
    }
    
    const result = await model.createSurcharge(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建附加费失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建附加费失败: ' + error.message
    })
  }
}

/**
 * 更新附加费
 */
export async function updateSurcharge(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateSurcharge(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '附加费不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新附加费失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新附加费失败: ' + error.message
    })
  }
}

/**
 * 删除附加费
 */
export async function deleteSurcharge(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteSurcharge(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '附加费不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除附加费失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除附加费失败: ' + error.message
    })
  }
}

// ==================== 运单管理 ====================

/**
 * 获取运单列表
 */
export async function getShipments(req, res) {
  try {
    const { carrierId, status, billId, search, startDate, endDate, page, pageSize } = req.query
    const result = await model.getShipments({
      carrierId: carrierId ? parseInt(carrierId) : null,
      status,
      billId,
      search,
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
    console.error('获取运单列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运单列表失败: ' + error.message
    })
  }
}

/**
 * 获取运单详情
 */
export async function getShipmentById(req, res) {
  try {
    const { id } = req.params
    const shipment = await model.getShipmentById(id)
    
    if (!shipment) {
      return res.status(404).json({
        errCode: 404,
        msg: '运单不存在'
      })
    }
    
    // 获取轨迹
    shipment.tracking = await model.getShipmentTracking(id)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: shipment
    })
  } catch (error) {
    console.error('获取运单详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运单详情失败: ' + error.message
    })
  }
}

/**
 * 创建运单
 */
export async function createShipment(req, res) {
  try {
    const data = req.body
    
    if (!data.carrierId) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商为必填项'
      })
    }
    
    const result = await model.createShipment(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建运单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建运单失败: ' + error.message
    })
  }
}

/**
 * 更新运单
 */
export async function updateShipment(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await model.updateShipment(id, data)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '运单不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新运单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新运单失败: ' + error.message
    })
  }
}

/**
 * 删除运单
 */
export async function deleteShipment(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteShipment(id)
    
    if (!success) {
      return res.status(404).json({
        errCode: 404,
        msg: '运单不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除运单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除运单失败: ' + error.message
    })
  }
}

/**
 * 获取运单轨迹
 */
export async function getShipmentTracking(req, res) {
  try {
    const { id } = req.params
    const tracking = await model.getShipmentTracking(id)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: tracking
    })
  } catch (error) {
    console.error('获取运单轨迹失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运单轨迹失败: ' + error.message
    })
  }
}

// ==================== 费用计算 ====================

/**
 * 计算运费
 */
export async function calculateFreight(req, res) {
  try {
    const {
      carrierId,
      rateCardId,
      zoneCode,
      postalCode,
      country,
      weight,
      dimensions,
      serviceType,
      includeSurcharges
    } = req.body
    
    if (!carrierId && !rateCardId) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商ID或费率卡ID为必填项'
      })
    }
    
    if (!weight) {
      return res.status(400).json({
        errCode: 400,
        msg: '重量为必填项'
      })
    }
    
    const result = await calculator.calculateFreight({
      carrierId: carrierId ? parseInt(carrierId) : null,
      rateCardId: rateCardId ? parseInt(rateCardId) : null,
      zoneCode,
      postalCode,
      country,
      weight: parseFloat(weight),
      dimensions,
      serviceType,
      includeSurcharges: includeSurcharges !== false
    })
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error,
        data: result.details
      })
    }
    
    res.json({
      errCode: 200,
      msg: '计算成功',
      data: result.data
    })
  } catch (error) {
    console.error('计算运费失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '计算运费失败: ' + error.message
    })
  }
}

/**
 * 多承运商比价
 */
export async function compareCarrierQuotes(req, res) {
  try {
    const {
      carrierIds,
      zoneCode,
      postalCode,
      country,
      weight,
      dimensions
    } = req.body
    
    if (!weight) {
      return res.status(400).json({
        errCode: 400,
        msg: '重量为必填项'
      })
    }
    
    if (!zoneCode && !postalCode) {
      return res.status(400).json({
        errCode: 400,
        msg: 'Zone或邮编为必填项'
      })
    }
    
    const quotes = await calculator.calculateMultiCarrierQuotes({
      carrierIds: carrierIds ? carrierIds.map(id => parseInt(id)) : null,
      zoneCode,
      postalCode,
      country,
      weight: parseFloat(weight),
      dimensions
    })
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: quotes
    })
  } catch (error) {
    console.error('比价失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '比价失败: ' + error.message
    })
  }
}

/**
 * 快速报价
 */
export async function quickQuote(req, res) {
  try {
    const { carrierId, zoneCode, weight } = req.query
    
    if (!carrierId || !zoneCode || !weight) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商ID、Zone和重量为必填项'
      })
    }
    
    const result = await calculator.quickQuote({
      carrierId: parseInt(carrierId),
      zoneCode,
      weight: parseFloat(weight)
    })
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result.data
    })
  } catch (error) {
    console.error('快速报价失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '快速报价失败: ' + error.message
    })
  }
}

/**
 * 根据邮编匹配Zone
 */
export async function matchZone(req, res) {
  try {
    const { carrierId, postalCode, country } = req.query
    
    if (!carrierId || !postalCode) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商ID和邮编为必填项'
      })
    }
    
    const zone = await calculator.matchZoneByPostalCode(
      parseInt(carrierId),
      postalCode,
      country
    )
    
    if (!zone) {
      return res.status(404).json({
        errCode: 404,
        msg: '未匹配到Zone'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '匹配成功',
      data: zone
    })
  } catch (error) {
    console.error('匹配Zone失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '匹配Zone失败: ' + error.message
    })
  }
}

export default {
  // 承运商
  getCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  deleteCarrier,
  
  // Zone
  getZones,
  createZone,
  updateZone,
  deleteZone,
  batchCreateZones,
  
  // 费率卡
  getRateCards,
  getRateCardById,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  
  // 费率明细
  batchCreateRateTiers,
  updateRateTier,
  deleteRateTier,
  
  // 附加费
  createSurcharge,
  updateSurcharge,
  deleteSurcharge,
  
  // 运单
  getShipments,
  getShipmentById,
  createShipment,
  updateShipment,
  deleteShipment,
  getShipmentTracking,
  
  // 费用计算
  calculateFreight,
  compareCarrierQuotes,
  quickQuote,
  matchZone,
  
  // 运单服务（API打单）
  createAndBookShipment,
  syncShipmentTracking,
  refreshShipmentLabel,
  cancelShipmentAPI
}

// ==================== 运单服务（API打单） ====================

/**
 * 创建运单并调用承运商API打单
 */
export async function createAndBookShipment(req, res) {
  try {
    const data = req.body
    
    if (!data.carrierId) {
      return res.status(400).json({
        errCode: 400,
        msg: '承运商为必填项'
      })
    }
    
    const result = await shipmentService.createAndBookShipment(data)
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: result.warning || '创建成功',
      data: result.data
    })
  } catch (error) {
    console.error('创建运单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建运单失败: ' + error.message
    })
  }
}

/**
 * 同步运单轨迹
 */
export async function syncShipmentTracking(req, res) {
  try {
    const { id } = req.params
    const result = await shipmentService.syncShipmentTracking(id)
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: '同步成功',
      data: result.data
    })
  } catch (error) {
    console.error('同步轨迹失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '同步轨迹失败: ' + error.message
    })
  }
}

/**
 * 重新获取面单
 */
export async function refreshShipmentLabel(req, res) {
  try {
    const { id } = req.params
    const result = await shipmentService.refreshLabel(id)
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result.data
    })
  } catch (error) {
    console.error('获取面单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取面单失败: ' + error.message
    })
  }
}

/**
 * 取消运单（调用承运商API）
 */
export async function cancelShipmentAPI(req, res) {
  try {
    const { id } = req.params
    const result = await shipmentService.cancelShipment(id)
    
    if (!result.success) {
      return res.status(400).json({
        errCode: 400,
        msg: result.error
      })
    }
    
    res.json({
      errCode: 200,
      msg: '取消成功',
      data: result.data
    })
  } catch (error) {
    console.error('取消运单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '取消运单失败: ' + error.message
    })
  }
}
