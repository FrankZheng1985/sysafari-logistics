/**
 * 客户询价模块 - 控制器
 */

import * as model from './model.js'
import * as hereService from './hereService.js'
import * as quoteCalculator from './quoteCalculator.js'
import * as addressCacheModel from './addressCacheModel.js'
import { success, badRequest, notFound, serverError, successWithPagination } from '../../utils/response.js'

// ==================== 询价管理 ====================

/**
 * 创建询价
 */
export async function createInquiry(req, res) {
  try {
    const { inquiryType, clearanceData, transportData, notes } = req.body
    
    if (!inquiryType) {
      return badRequest(res, '请选择询价类型')
    }
    
    // 验证清关询价数据
    if ((inquiryType === 'clearance' || inquiryType === 'combined') && !clearanceData) {
      return badRequest(res, '请提供清关询价数据')
    }
    
    // 验证运输询价数据
    if ((inquiryType === 'transport' || inquiryType === 'combined') && !transportData) {
      return badRequest(res, '请提供运输询价数据')
    }
    
    // 获取客户信息（从认证中间件）
    const customerId = req.customer?.customerId || req.body.customerId
    const customerName = req.customer?.customerName || req.body.customerName
    
    if (!customerId) {
      return badRequest(res, '客户信息缺失')
    }
    
    const result = await model.createInquiry({
      customerId,
      customerName,
      inquiryType,
      clearanceData,
      transportData,
      notes
    })
    
    return success(res, result, '询价已提交')
  } catch (error) {
    console.error('创建询价失败:', error)
    return serverError(res, '创建询价失败')
  }
}

/**
 * 获取询价列表
 */
export async function getInquiries(req, res) {
  try {
    const customerId = req.customer?.customerId
    const { status, inquiryType, page, pageSize } = req.query
    
    const result = await model.getInquiries({
      customerId,
      status,
      inquiryType,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取询价列表失败:', error)
    return serverError(res, '获取询价列表失败')
  }
}

/**
 * 获取询价详情
 */
export async function getInquiryById(req, res) {
  try {
    const { id } = req.params
    const customerId = req.customer?.customerId
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    // 验证客户权限
    if (customerId && inquiry.customerId !== customerId) {
      return notFound(res, '询价不存在')
    }
    
    return success(res, inquiry)
  } catch (error) {
    console.error('获取询价详情失败:', error)
    return serverError(res, '获取询价详情失败')
  }
}

/**
 * 接受报价
 */
export async function acceptQuote(req, res) {
  try {
    const { id } = req.params
    const customerId = req.customer?.customerId
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    // 验证客户权限
    if (customerId && inquiry.customerId !== customerId) {
      return notFound(res, '询价不存在')
    }
    
    // 验证状态
    if (inquiry.status !== 'quoted') {
      return badRequest(res, '当前状态无法接受报价')
    }
    
    // 验证有效期
    if (inquiry.validUntil && new Date(inquiry.validUntil) < new Date()) {
      return badRequest(res, '报价已过期')
    }
    
    await model.updateInquiryStatus(id, 'accepted')
    
    // TODO: 创建正式订单/提单
    
    return success(res, { id }, '报价已接受')
  } catch (error) {
    console.error('接受报价失败:', error)
    return serverError(res, '接受报价失败')
  }
}

/**
 * 拒绝报价
 */
export async function rejectQuote(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    const customerId = req.customer?.customerId
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    // 验证客户权限
    if (customerId && inquiry.customerId !== customerId) {
      return notFound(res, '询价不存在')
    }
    
    // 验证状态
    if (inquiry.status !== 'quoted') {
      return badRequest(res, '当前状态无法拒绝报价')
    }
    
    await model.updateInquiry(id, {
      status: 'rejected',
      notes: reason ? `${inquiry.notes || ''}\n拒绝原因: ${reason}` : inquiry.notes
    })
    
    return success(res, { id }, '报价已拒绝')
  } catch (error) {
    console.error('拒绝报价失败:', error)
    return serverError(res, '拒绝报价失败')
  }
}

// ==================== 运输计算 ====================

/**
 * 计算运输费用
 */
export async function calculateTransport(req, res) {
  try {
    const { origin, destination, waypoints, truckTypeCode, goods } = req.body
    
    if (!origin || !destination) {
      return badRequest(res, '请提供起点和终点')
    }
    
    // 获取卡车类型
    let truckType = null
    if (truckTypeCode) {
      truckType = await model.getTruckTypeByCode(truckTypeCode)
    } else if (goods) {
      // 根据货物推荐卡车
      const recommendation = quoteCalculator.recommendTruckByGoods(goods)
      const trucks = await model.getTruckTypes({ category: recommendation.recommendedCategory })
      truckType = trucks[0]
    }
    
    if (!truckType) {
      // 使用默认卡车类型
      truckType = await model.getTruckTypeByCode('SEMI_40')
    }
    
    // 计算路线
    const routeData = await hereService.calculateTruckRoute({
      origin,
      destination,
      waypoints: waypoints || [],
      truck: {
        grossWeight: truckType.maxWeight,
        height: truckType.height,
        width: truckType.width,
        length: truckType.length,
        axleCount: truckType.axleCount
      }
    })
    
    // 计算费用
    const costResult = hereService.calculateTransportCost(routeData, truckType)
    
    return success(res, {
      route: routeData,
      cost: costResult,
      truckType: {
        code: truckType.code,
        name: truckType.name,
        nameEn: truckType.nameEn,
        category: truckType.category
      }
    })
  } catch (error) {
    console.error('计算运输费用失败:', error)
    return serverError(res, error.message || '计算运输费用失败')
  }
}

/**
 * 运输报价计算（用于报价弹窗）
 * 返回完整的路线信息、费用明细和polyline数据用于地图显示
 */
export async function calculateTransportQuote(req, res) {
  try {
    const { origin, destination, waypoints, truckTypeCode, goods } = req.body
    
    if (!origin || !destination) {
      return badRequest(res, '请提供起点和终点')
    }
    
    // 获取卡车类型
    let truckType = null
    if (truckTypeCode) {
      truckType = await model.getTruckTypeByCode(truckTypeCode)
    } else if (goods) {
      // 根据货物推荐卡车
      const recommendation = quoteCalculator.recommendTruckByGoods(goods)
      const trucks = await model.getTruckTypes({ category: recommendation.recommendedCategory })
      truckType = trucks[0]
    }
    
    if (!truckType) {
      // 使用默认卡车类型
      truckType = await model.getTruckTypeByCode('SEMI_40')
    }
    
    // 计算路线
    const routeData = await hereService.calculateTruckRoute({
      origin,
      destination,
      waypoints: waypoints || [],
      truck: {
        grossWeight: truckType.maxWeight,
        height: truckType.height,
        width: truckType.width,
        length: truckType.length,
        axleCount: truckType.axleCount
      }
    })
    
    // 计算费用明细
    const costResult = hereService.calculateTransportCost(routeData, truckType)
    
    // 构建费用明细项（用于报价单）
    const costItems = [
      {
        source: 'HERE',
        name: '运输费',
        nameEn: 'Transport Fee',
        category: 'transport',
        costPrice: costResult.transportCost,
        currency: 'EUR',
        unit: '趟',
        quantity: 1,
        selected: true
      },
      {
        source: 'HERE',
        name: '通行费',
        nameEn: 'Toll Fee',
        category: 'transport',
        costPrice: costResult.tolls,
        currency: 'EUR',
        unit: '趟',
        quantity: 1,
        selected: costResult.tolls > 0
      },
      {
        source: 'HERE',
        name: '燃油附加费',
        nameEn: 'Fuel Surcharge',
        category: 'transport',
        costPrice: costResult.fuelSurcharge,
        currency: 'EUR',
        unit: '趟',
        quantity: 1,
        selected: costResult.fuelSurcharge > 0
      }
    ]
    
    // 如果有渡轮费，添加渡轮费项
    if (costResult.ferryFee > 0) {
      costItems.push({
        source: 'HERE',
        name: '渡轮费',
        nameEn: 'Ferry Fee',
        category: 'transport',
        costPrice: costResult.ferryFee,
        currency: 'EUR',
        unit: '趟',
        quantity: 1,
        selected: true
      })
    }
    
    return success(res, {
      // 路线信息
      route: {
        origin: routeData.origin,
        destination: routeData.destination,
        waypoints: routeData.waypoints,
        distance: routeData.route.distance,
        roadDistance: routeData.route.roadDistance,
        ferryDistance: routeData.route.ferryDistance,
        duration: routeData.route.duration,
        durationFormatted: routeData.route.durationFormatted,
        hasFerry: routeData.route.hasFerry,
        polyline: routeData.route.polyline  // 用于地图显示
      },
      // 费用明细
      costItems: costItems,
      // 费用汇总
      summary: {
        totalCost: costResult.totalCost,
        currency: 'EUR'
      },
      // 卡车类型信息
      truckType: {
        code: truckType.code,
        name: truckType.name,
        nameEn: truckType.nameEn,
        category: truckType.category
      }
    })
  } catch (error) {
    console.error('运输报价计算失败:', error)
    return serverError(res, error.message || '运输报价计算失败')
  }
}

/**
 * 估算清关费用
 */
export async function estimateClearance(req, res) {
  try {
    const { items, totalValue, hsCodeCount, hasTaxNumber, isSpecialGoods, isExpress } = req.body
    
    // 估算关税
    let taxResult = null
    if (items && items.length > 0) {
      taxResult = quoteCalculator.estimateTaxes(items)
    }
    
    // 计算清关费用
    const clearanceResult = quoteCalculator.calculateClearanceFee({
      items,
      totalValue: totalValue || (taxResult?.summary?.totalValue) || 0,
      hsCodeCount: hsCodeCount || (items?.length) || 0,
      hasTaxNumber,
      isSpecialGoods,
      isExpress
    })
    
    return success(res, {
      clearance: clearanceResult,
      tax: taxResult
    })
  } catch (error) {
    console.error('估算清关费用失败:', error)
    return serverError(res, '估算清关费用失败')
  }
}

// ==================== 卡车类型 ====================

/**
 * 获取卡车类型列表
 */
export async function getTruckTypes(req, res) {
  try {
    const { category } = req.query
    
    const list = await model.getTruckTypes({
      category,
      isActive: true
    })
    
    return success(res, list)
  } catch (error) {
    console.error('获取卡车类型失败:', error)
    return serverError(res, '获取卡车类型失败')
  }
}

/**
 * 推荐卡车类型
 */
export async function recommendTruckType(req, res) {
  try {
    const { weight, volume } = req.query
    
    const list = await model.recommendTruckType(
      parseFloat(weight) || 0,
      parseFloat(volume) || 0
    )
    
    return success(res, list)
  } catch (error) {
    console.error('推荐卡车类型失败:', error)
    return serverError(res, '推荐卡车类型失败')
  }
}

// ==================== 地理编码 ====================

/**
 * 地址地理编码
 */
export async function geocodeAddress(req, res) {
  try {
    const { address } = req.query
    
    if (!address) {
      return badRequest(res, '请提供地址')
    }
    
    const result = await hereService.geocodeAddress(address)
    
    if (!result) {
      return notFound(res, '无法解析地址')
    }
    
    return success(res, result)
  } catch (error) {
    console.error('地理编码失败:', error)
    return serverError(res, '地理编码失败')
  }
}

/**
 * 地址自动补全
 */
export async function autosuggestAddress(req, res) {
  try {
    const { query, limit = 5 } = req.query
    
    if (!query || query.length < 2) {
      return success(res, [])
    }
    
    const results = await hereService.autosuggestAddress(query, parseInt(limit))
    
    return success(res, results)
  } catch (error) {
    console.error('地址自动补全失败:', error)
    return serverError(res, '地址自动补全失败')
  }
}

// ==================== ERP内部接口（报价管理） ====================

/**
 * 获取所有询价列表（ERP后台）
 */
export async function getAllInquiries(req, res) {
  try {
    const { status, inquiryType, customerId, page, pageSize } = req.query
    
    const result = await model.getInquiries({
      customerId,
      status,
      inquiryType,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取询价列表失败:', error)
    return serverError(res, '获取询价列表失败')
  }
}

/**
 * 设置询价报价（ERP后台）
 */
export async function setQuote(req, res) {
  try {
    const { id } = req.params
    const {
      estimatedDuty,
      estimatedVat,
      estimatedOtherTax,
      clearanceFee,
      transportFee,
      transportQuote,
      totalQuote,
      validUntil,
      notes,
      crmQuoteId,
      transportPriceId
    } = req.body
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    // 设置报价
    await model.setInquiryQuote(id, {
      estimatedDuty,
      estimatedVat,
      estimatedOtherTax,
      clearanceFee,
      transportFee,
      transportQuote,
      totalQuote,
      quotedBy: req.user?.id,
      quotedByName: req.user?.name,
      validUntil,
      crmQuoteId,
      transportPriceId
    })
    
    // 更新备注
    if (notes) {
      await model.updateInquiry(id, { notes })
    }
    
    return success(res, { id }, '报价已设置')
  } catch (error) {
    console.error('设置报价失败:', error)
    return serverError(res, '设置报价失败')
  }
}

// ==================== 待办任务管理 ====================

/**
 * 获取待处理询价任务列表
 */
export async function getPendingTasks(req, res) {
  try {
    const userId = req.user?.id
    const { status, page, pageSize } = req.query
    
    const result = await model.getPendingInquiryTasks({
      userId,
      status,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取待处理任务失败:', error)
    return serverError(res, '获取待处理任务失败')
  }
}

/**
 * 获取任务统计
 */
export async function getTaskStats(req, res) {
  try {
    const userId = req.user?.id
    
    if (!userId) {
      return badRequest(res, '用户信息缺失')
    }
    
    const stats = await model.getTaskStats(userId)
    
    return success(res, stats)
  } catch (error) {
    console.error('获取任务统计失败:', error)
    return serverError(res, '获取任务统计失败')
  }
}

/**
 * 分配询价给跟单员
 */
export async function assignInquiry(req, res) {
  try {
    const { id } = req.params
    const { assigneeId } = req.body
    
    if (!assigneeId) {
      return badRequest(res, '请选择要分配的跟单员')
    }
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    const result = await model.assignInquiry(id, assigneeId, req.user?.id)
    
    return success(res, result, '询价已分配')
  } catch (error) {
    console.error('分配询价失败:', error)
    return serverError(res, error.message || '分配询价失败')
  }
}

/**
 * 开始处理询价
 */
export async function startProcessing(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    
    if (!userId) {
      return badRequest(res, '用户信息缺失')
    }
    
    const inquiry = await model.getInquiryById(id)
    
    if (!inquiry) {
      return notFound(res, '询价不存在')
    }
    
    // 验证是否是分配给当前用户的
    if (inquiry.assignedTo && inquiry.assignedTo !== userId) {
      return badRequest(res, '您没有权限处理此询价')
    }
    
    await model.startInquiryTask(id, userId)
    
    return success(res, { id }, '已开始处理')
  } catch (error) {
    console.error('开始处理询价失败:', error)
    return serverError(res, '开始处理询价失败')
  }
}

/**
 * 检查超时任务（定时任务调用）
 */
export async function checkOverdueTasks(req, res) {
  try {
    const result = await model.checkOverdueTasks()
    
    return success(res, { 
      overdueCount: result.length,
      tasks: result 
    }, `已标记 ${result.length} 个超时任务`)
  } catch (error) {
    console.error('检查超时任务失败:', error)
    return serverError(res, '检查超时任务失败')
  }
}

export default {
  // 询价管理
  createInquiry,
  getInquiries,
  getInquiryById,
  acceptQuote,
  rejectQuote,
  
  // 计算
  calculateTransport,
  calculateTransportQuote,
  estimateClearance,
  
  // 卡车类型
  getTruckTypes,
  recommendTruckType,
  
  // 地理编码
  geocodeAddress,
  autosuggestAddress,
  batchGetCitiesByPostalCodes,
  
  // ERP内部
  getAllInquiries,
  setQuote,
  
  // 待办任务
  getPendingTasks,
  getTaskStats,
  assignInquiry,
  startProcessing,
  checkOverdueTasks,
  
  // 地址缓存管理
  getAddressCacheStats,
  searchAddressCache,
  addAddressToCache,
  deleteAddressCache,
  cleanupAddressCache,
  
  // HERE API 使用量监控
  getHereApiUsageStats,
  getHereApiUsageHistory,
  syncHereApiCallCount
}

/**
 * 批量获取邮编对应的城市
 */
export async function batchGetCitiesByPostalCodes(req, res) {
  try {
    const { postalCodes } = req.body
    
    if (!Array.isArray(postalCodes) || postalCodes.length === 0) {
      return res.status(400).json({ error: '请提供邮编数组' })
    }
    
    // 限制一次最多查询100个
    if (postalCodes.length > 100) {
      return res.status(400).json({ error: '单次查询最多支持100个邮编' })
    }
    
    const result = await hereService.batchGetCities(postalCodes)
    
    res.json({
      success: true,
      cities: result
    })
  } catch (error) {
    console.error('批量获取城市失败:', error)
    res.status(500).json({ error: '获取城市信息失败' })
  }
}

// ==================== 地址缓存管理 ====================

/**
 * 获取地址缓存统计
 */
export async function getAddressCacheStats(req, res) {
  try {
    const stats = await addressCacheModel.getCacheStats()
    const topAddresses = await addressCacheModel.getTopAddresses(10)
    
    return success(res, {
      stats,
      topAddresses
    })
  } catch (error) {
    console.error('获取地址缓存统计失败:', error)
    return serverError(res, '获取地址缓存统计失败')
  }
}

/**
 * 搜索地址缓存
 */
export async function searchAddressCache(req, res) {
  try {
    const { keyword, countryCode, cacheType, page, pageSize } = req.query
    
    const result = await addressCacheModel.searchCachedAddresses({
      keyword,
      countryCode,
      cacheType,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('搜索地址缓存失败:', error)
    return serverError(res, '搜索地址缓存失败')
  }
}

/**
 * 手动添加地址到缓存
 */
export async function addAddressToCache(req, res) {
  try {
    const addressData = req.body
    
    if (!addressData.address && !addressData.queryText) {
      return badRequest(res, '请提供地址或查询关键词')
    }
    
    const result = await addressCacheModel.addManualAddress(addressData)
    
    return success(res, result, '地址已添加到缓存')
  } catch (error) {
    console.error('添加地址缓存失败:', error)
    if (error.code === '23505') {
      return badRequest(res, '该地址已存在于缓存中')
    }
    return serverError(res, '添加地址缓存失败')
  }
}

/**
 * 删除地址缓存
 */
export async function deleteAddressCache(req, res) {
  try {
    const { id } = req.params
    
    if (!id) {
      return badRequest(res, '请提供缓存ID')
    }
    
    await addressCacheModel.deleteCache(id)
    
    return success(res, { id }, '地址缓存已删除')
  } catch (error) {
    console.error('删除地址缓存失败:', error)
    return serverError(res, '删除地址缓存失败')
  }
}

/**
 * 清理过期缓存
 */
export async function cleanupAddressCache(req, res) {
  try {
    const { days = 90 } = req.body
    
    const count = await addressCacheModel.cleanupOldCache(parseInt(days))
    
    return success(res, { cleanedCount: count }, `已清理 ${count} 条过期缓存`)
  } catch (error) {
    console.error('清理地址缓存失败:', error)
    return serverError(res, '清理地址缓存失败')
  }
}

// ==================== HERE API 使用量监控 ====================

/**
 * 获取 HERE API 使用统计
 */
export async function getHereApiUsageStats(req, res) {
  try {
    const stats = await hereService.getApiUsageStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取 HERE API 使用统计失败:', error)
    return serverError(res, '获取 HERE API 使用统计失败')
  }
}

/**
 * 获取 HERE API 使用历史
 */
export async function getHereApiUsageHistory(req, res) {
  try {
    const { months = 6 } = req.query
    const history = await hereService.getApiUsageHistory(parseInt(months))
    return success(res, history)
  } catch (error) {
    console.error('获取 HERE API 使用历史失败:', error)
    return serverError(res, '获取 HERE API 使用历史失败')
  }
}

/**
 * 同步 HERE API 调用次数
 * 用于从 HERE 控制台同步实际使用量
 */
export async function syncHereApiCallCount(req, res) {
  try {
    const { apiType, count } = req.body
    
    if (!apiType || count === undefined) {
      return badRequest(res, '请提供 API 类型和调用次数')
    }
    
    const validTypes = ['autosuggest', 'geocoding', 'routing', 'matrix_routing']
    if (!validTypes.includes(apiType)) {
      return badRequest(res, `无效的 API 类型，支持: ${validTypes.join(', ')}`)
    }
    
    if (count < 0) {
      return badRequest(res, '调用次数不能为负数')
    }
    
    const result = await hereService.syncApiCallCount(apiType, count)
    
    if (result) {
      return success(res, { apiType, count }, '调用次数已同步')
    } else {
      return serverError(res, '同步失败')
    }
  } catch (error) {
    console.error('同步 HERE API 调用次数失败:', error)
    return serverError(res, '同步 HERE API 调用次数失败')
  }
}

