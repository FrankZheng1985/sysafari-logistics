/**
 * 客户询价模块 - 控制器
 */

import * as model from './model.js'
import * as hereService from './hereService.js'
import * as quoteCalculator from './quoteCalculator.js'
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
      notes
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
      validUntil
    })
    
    // 更新备注
    if (notes) {
      await model.updateInquiry(id, { notes })
    }
    
    // TODO: 同步到CRM商机
    
    return success(res, { id }, '报价已设置')
  } catch (error) {
    console.error('设置报价失败:', error)
    return serverError(res, '设置报价失败')
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
  estimateClearance,
  
  // 卡车类型
  getTruckTypes,
  recommendTruckType,
  
  // 地理编码
  geocodeAddress,
  
  // ERP内部
  getAllInquiries,
  setQuote
}

