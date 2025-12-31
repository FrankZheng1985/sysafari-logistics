/**
 * 运单服务
 * 整合适配器和数据库操作，提供统一的运单管理服务
 */

import * as model from './model.js'
import * as calculator from './calculator.js'
import * as adapters from './adapters/index.js'

/**
 * 获取承运商适配器
 */
function getAdapterForCarrier(carrier) {
  if (!carrier || !carrier.carrierCode) return null
  
  let apiConfig = {}
  if (carrier.apiConfig) {
    try {
      apiConfig = typeof carrier.apiConfig === 'string'
        ? JSON.parse(carrier.apiConfig)
        : carrier.apiConfig
    } catch (e) {
      console.error('解析API配置失败:', e)
    }
  }
  
  return adapters.getAdapter(carrier.carrierCode, {
    carrierName: carrier.carrierName,
    apiConfig
  })
}

/**
 * 创建运单并调用承运商API打单
 * @param {Object} shipmentData - 运单数据
 * @returns {Promise<Object>} 创建结果
 */
export async function createAndBookShipment(shipmentData) {
  const { carrierId, ...restData } = shipmentData
  
  // 1. 获取承运商信息
  const carrier = await model.getCarrierById(carrierId)
  if (!carrier) {
    return {
      success: false,
      error: '承运商不存在'
    }
  }
  
  // 2. 计算费用和匹配Zone
  let calculatedData = {}
  if (restData.weight && restData.receiverPostalCode) {
    const calcResult = await calculator.calculateFreight({
      carrierId,
      postalCode: restData.receiverPostalCode,
      country: restData.receiverCountry,
      weight: restData.weight,
      dimensions: restData.dimensions
    })
    
    if (calcResult.success) {
      calculatedData = {
        zoneCode: calcResult.data.zoneCode,
        purchaseCost: calcResult.data.totalPurchase,
        salesAmount: calcResult.data.totalSales,
        profitAmount: calcResult.data.profit,
        chargeableWeight: calcResult.data.chargeableWeight
      }
    }
  }
  
  // 3. 创建运单记录（状态为pending）
  const createResult = await model.createShipment({
    carrierId,
    carrierCode: carrier.carrierCode,
    ...restData,
    ...calculatedData,
    status: 'pending'
  })
  
  if (!createResult.id) {
    return {
      success: false,
      error: '创建运单记录失败'
    }
  }
  
  // 4. 如果承运商启用了API，调用API打单
  if (carrier.apiEnabled && carrier.apiConfig) {
    const adapter = getAdapterForCarrier(carrier)
    
    if (adapter) {
      try {
        const bookingResult = await adapter.createShipment({
          shipmentNo: createResult.shipmentNo,
          sender: {
            name: restData.senderName,
            company: restData.senderCompany,
            phone: restData.senderPhone,
            address: restData.senderAddress,
            city: restData.senderCity,
            postalCode: restData.senderPostalCode,
            country: restData.senderCountry || 'DE'
          },
          receiver: {
            name: restData.receiverName,
            company: restData.receiverCompany,
            phone: restData.receiverPhone,
            address: restData.receiverAddress,
            city: restData.receiverCity,
            postalCode: restData.receiverPostalCode,
            country: restData.receiverCountry
          },
          weight: restData.weight,
          dimensions: restData.dimensions,
          pieces: restData.pieces || 1,
          goodsDescription: restData.goodsDescription
        })
        
        if (bookingResult.success) {
          // 更新运单记录
          await model.updateShipment(createResult.id, {
            carrierTrackingNo: bookingResult.data.carrierTrackingNo,
            labelUrl: bookingResult.data.labelUrl,
            labelData: bookingResult.data.labelData,
            status: 'created',
            apiRequest: shipmentData,
            apiResponse: bookingResult.data.rawResponse,
            shippedAt: new Date().toISOString()
          })
          
          return {
            success: true,
            data: {
              id: createResult.id,
              shipmentNo: createResult.shipmentNo,
              carrierTrackingNo: bookingResult.data.carrierTrackingNo,
              labelUrl: bookingResult.data.labelUrl,
              status: 'created'
            }
          }
        } else {
          // API调用失败，记录错误但保留运单
          await model.updateShipment(createResult.id, {
            apiResponse: { error: bookingResult.error },
            status: 'pending'
          })
          
          return {
            success: true,
            warning: 'API打单失败: ' + bookingResult.error,
            data: {
              id: createResult.id,
              shipmentNo: createResult.shipmentNo,
              status: 'pending'
            }
          }
        }
      } catch (error) {
        console.error('API打单异常:', error)
        return {
          success: true,
          warning: 'API打单异常: ' + error.message,
          data: {
            id: createResult.id,
            shipmentNo: createResult.shipmentNo,
            status: 'pending'
          }
        }
      }
    }
  }
  
  // 未启用API，直接返回
  return {
    success: true,
    data: {
      id: createResult.id,
      shipmentNo: createResult.shipmentNo,
      status: 'pending',
      ...calculatedData
    }
  }
}

/**
 * 同步运单轨迹
 * @param {number} shipmentId - 运单ID
 * @returns {Promise<Object>} 同步结果
 */
export async function syncShipmentTracking(shipmentId) {
  const shipment = await model.getShipmentById(shipmentId)
  if (!shipment) {
    return { success: false, error: '运单不存在' }
  }
  
  if (!shipment.carrierTrackingNo) {
    return { success: false, error: '无承运商运单号' }
  }
  
  const carrier = await model.getCarrierById(shipment.carrierId)
  if (!carrier || !carrier.apiEnabled) {
    return { success: false, error: '承运商未启用API' }
  }
  
  const adapter = getAdapterForCarrier(carrier)
  if (!adapter) {
    return { success: false, error: '无可用适配器' }
  }
  
  try {
    const trackingResult = await adapter.getTracking(shipment.carrierTrackingNo)
    
    if (trackingResult.success && trackingResult.data.events) {
      // 保存轨迹事件
      for (const event of trackingResult.data.events) {
        await model.addTrackingEvent({
          shipmentId,
          trackingNo: shipment.carrierTrackingNo,
          eventTime: event.timestamp,
          eventCode: event.status,
          eventDescription: event.description,
          eventLocation: event.location,
          rawData: event.rawData
        })
      }
      
      // 更新运单状态
      const latestStatus = trackingResult.data.status
      let newStatus = shipment.status
      
      if (latestStatus === 'delivered' || latestStatus === 'DELIVERED') {
        newStatus = 'delivered'
        await model.updateShipment(shipmentId, {
          status: newStatus,
          deliveredAt: new Date().toISOString()
        })
      } else if (latestStatus === 'in_transit' || latestStatus === 'IN_TRANSIT' || latestStatus === 'transit') {
        newStatus = 'in_transit'
        await model.updateShipment(shipmentId, { status: newStatus })
      }
      
      return {
        success: true,
        data: {
          eventsCount: trackingResult.data.events.length,
          currentStatus: newStatus,
          estimatedDelivery: trackingResult.data.estimatedDelivery
        }
      }
    } else {
      return {
        success: false,
        error: trackingResult.error || '获取轨迹失败'
      }
    }
  } catch (error) {
    console.error('同步轨迹异常:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 取消运单
 * @param {number} shipmentId - 运单ID
 * @returns {Promise<Object>} 取消结果
 */
export async function cancelShipment(shipmentId) {
  const shipment = await model.getShipmentById(shipmentId)
  if (!shipment) {
    return { success: false, error: '运单不存在' }
  }
  
  if (shipment.status === 'delivered') {
    return { success: false, error: '已送达的运单无法取消' }
  }
  
  // 如果有承运商运单号，尝试调用API取消
  if (shipment.carrierTrackingNo) {
    const carrier = await model.getCarrierById(shipment.carrierId)
    
    if (carrier && carrier.apiEnabled) {
      const adapter = getAdapterForCarrier(carrier)
      
      if (adapter) {
        try {
          const cancelResult = await adapter.cancelShipment(shipment.carrierTrackingNo)
          
          if (!cancelResult.success) {
            console.warn('承运商取消运单失败:', cancelResult.error)
            // 继续执行本地取消
          }
        } catch (error) {
          console.error('取消运单API异常:', error)
        }
      }
    }
  }
  
  // 更新本地状态
  await model.updateShipment(shipmentId, {
    status: 'cancelled'
  })
  
  return {
    success: true,
    data: { shipmentId, status: 'cancelled' }
  }
}

/**
 * 重新获取面单
 * @param {number} shipmentId - 运单ID
 * @returns {Promise<Object>} 面单数据
 */
export async function refreshLabel(shipmentId) {
  const shipment = await model.getShipmentById(shipmentId)
  if (!shipment) {
    return { success: false, error: '运单不存在' }
  }
  
  if (!shipment.carrierTrackingNo) {
    return { success: false, error: '无承运商运单号' }
  }
  
  const carrier = await model.getCarrierById(shipment.carrierId)
  if (!carrier || !carrier.apiEnabled) {
    return { success: false, error: '承运商未启用API' }
  }
  
  const adapter = getAdapterForCarrier(carrier)
  if (!adapter) {
    return { success: false, error: '无可用适配器' }
  }
  
  try {
    const labelResult = await adapter.getLabel(shipment.carrierTrackingNo)
    
    if (labelResult.success) {
      // 更新面单数据
      await model.updateShipment(shipmentId, {
        labelData: labelResult.data.content,
        labelUrl: labelResult.data.url
      })
      
      return {
        success: true,
        data: labelResult.data
      }
    } else {
      return {
        success: false,
        error: labelResult.error || '获取面单失败'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 批量同步轨迹
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 同步结果
 */
export async function batchSyncTracking(params = {}) {
  const { status = 'in_transit', limit = 50 } = params
  
  // 获取需要同步的运单
  const shipmentsResult = await model.getShipments({
    status,
    pageSize: limit
  })
  
  const results = {
    total: shipmentsResult.list.length,
    success: 0,
    failed: 0,
    errors: []
  }
  
  for (const shipment of shipmentsResult.list) {
    if (!shipment.carrierTrackingNo) {
      results.failed++
      continue
    }
    
    const syncResult = await syncShipmentTracking(shipment.id)
    
    if (syncResult.success) {
      results.success++
    } else {
      results.failed++
      results.errors.push({
        shipmentId: shipment.id,
        shipmentNo: shipment.shipmentNo,
        error: syncResult.error
      })
    }
  }
  
  return results
}

export default {
  createAndBookShipment,
  syncShipmentTracking,
  cancelShipment,
  refreshLabel,
  batchSyncTracking
}
