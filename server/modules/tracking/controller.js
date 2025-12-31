/**
 * 物流跟踪模块控制器
 */

import {
  getTrackingRecords,
  addTrackingRecord,
  updateTrackingRecord,
  deleteTrackingRecord,
  getTrackingApiConfigs,
  getTrackingApiConfigById,
  createTrackingApiConfig,
  updateTrackingApiConfig,
  deleteTrackingApiConfig,
  getNodeTemplates,
  getLatestTrackingStatus,
  getTrackingStats,
} from './model.js'

import {
  getTrackingInfo,
  addManualTrackingNode,
  batchRefreshTracking,
  getTrackingNodeTemplates,
  getSupplementInfo,
  scrapeContainerTracking,
  scrapeBillTracking,
  smartTrack,
  getSupportedCarriers,
  clearScraperCache,
  getScraperCacheStats,
} from './trackingService.js'

// ==================== 跟踪记录 API ====================

/**
 * 获取提单跟踪记录
 */
export async function getBillTracking(req, res) {
  try {
    const { billId } = req.params
    const { refresh, transportType } = req.query
    
    const result = await getTrackingInfo(billId, {
      refresh: refresh === 'true',
      transportType,
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: result,
    })
  } catch (error) {
    console.error('获取跟踪记录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取跟踪记录失败',
    })
  }
}

/**
 * 添加手动跟踪节点
 */
export async function addManualNode(req, res) {
  try {
    const { billId } = req.params
    const data = req.body
    
    const result = await addManualTrackingNode({
      billId,
      ...data,
    })
    
    res.json({
      errCode: 200,
      msg: '节点添加成功',
      data: result,
    })
  } catch (error) {
    console.error('添加跟踪节点失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '添加跟踪节点失败',
    })
  }
}

/**
 * 更新跟踪记录
 */
export async function updateTracking(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await updateTrackingRecord(id, data)
    
    if (success) {
      res.json({
        errCode: 200,
        msg: '更新成功',
      })
    } else {
      res.status(404).json({
        errCode: 404,
        msg: '记录不存在或无变化',
      })
    }
  } catch (error) {
    console.error('更新跟踪记录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '更新失败',
    })
  }
}

/**
 * 删除跟踪记录
 */
export async function deleteTracking(req, res) {
  try {
    const { id } = req.params
    
    const success = await deleteTrackingRecord(id)
    
    if (success) {
      res.json({
        errCode: 200,
        msg: '删除成功',
      })
    } else {
      res.status(404).json({
        errCode: 404,
        msg: '记录不存在',
      })
    }
  } catch (error) {
    console.error('删除跟踪记录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '删除失败',
    })
  }
}

/**
 * 批量刷新跟踪状态
 */
export async function batchRefresh(req, res) {
  try {
    const { billIds, transportType } = req.body
    
    if (!billIds || !Array.isArray(billIds)) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供提单ID数组',
      })
    }
    
    const result = await batchRefreshTracking(billIds, transportType)
    
    res.json({
      errCode: 200,
      msg: `成功刷新 ${result.success} 条，失败 ${result.failed} 条`,
      data: result,
    })
  } catch (error) {
    console.error('批量刷新失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '批量刷新失败',
    })
  }
}

/**
 * 获取节点模板
 */
export async function getTemplates(req, res) {
  try {
    const { transportType } = req.query
    
    const templates = getTrackingNodeTemplates(transportType || 'sea')
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: templates,
    })
  } catch (error) {
    console.error('获取节点模板失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取节点模板失败',
    })
  }
}

/**
 * 获取跟踪统计
 */
export async function getStats(req, res) {
  try {
    const { transportType, startDate, endDate } = req.query
    
    const stats = await getTrackingStats({
      transportType,
      startDate,
      endDate,
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: stats,
    })
  } catch (error) {
    console.error('获取跟踪统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取统计失败',
    })
  }
}

// ==================== 补充信息查询 ====================

/**
 * 根据提单号/集装箱号获取补充信息（码头、船名航次等）
 * 用于创建提单时自动填充未识别的字段
 */
export async function getTrackingSupplementInfo(req, res) {
  try {
    const { trackingNumber, containerNumber, transportType } = req.query
    
    if (!trackingNumber && !containerNumber) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供提单号或集装箱号',
      })
    }
    
    const info = await getSupplementInfo({
      trackingNumber,
      containerNumber,
      transportType: transportType || 'sea',
    })
    
    if (info) {
      res.json({
        errCode: 200,
        msg: 'success',
        data: info,
      })
    } else {
      res.json({
        errCode: 200,
        msg: '未找到补充信息',
        data: null,
      })
    }
  } catch (error) {
    console.error('获取补充信息失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取补充信息失败',
    })
  }
}

// ==================== API配置管理 ====================

/**
 * 获取API配置列表
 */
export async function getApiConfigs(req, res) {
  try {
    const { transportType, status, provider } = req.query
    
    const result = await getTrackingApiConfigs({
      transportType,
      status,
      provider,
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: result,
    })
  } catch (error) {
    console.error('获取API配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取API配置失败',
    })
  }
}

/**
 * 获取单个API配置
 */
export async function getApiConfig(req, res) {
  try {
    const { id } = req.params
    
    const config = await getTrackingApiConfigById(id)
    
    if (config) {
      res.json({
        errCode: 200,
        msg: 'success',
        data: config,
      })
    } else {
      res.status(404).json({
        errCode: 404,
        msg: '配置不存在',
      })
    }
  } catch (error) {
    console.error('获取API配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取API配置失败',
    })
  }
}

/**
 * 创建API配置
 */
export async function createApiConfig(req, res) {
  try {
    const data = req.body
    
    if (!data.providerCode || !data.providerName) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供服务商代码和名称',
      })
    }
    
    const result = await createTrackingApiConfig(data)
    
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result,
    })
  } catch (error) {
    console.error('创建API配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '创建失败',
    })
  }
}

/**
 * 更新API配置
 */
export async function updateApiConfig(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const success = await updateTrackingApiConfig(id, data)
    
    if (success) {
      res.json({
        errCode: 200,
        msg: '更新成功',
      })
    } else {
      res.status(404).json({
        errCode: 404,
        msg: '配置不存在或无变化',
      })
    }
  } catch (error) {
    console.error('更新API配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '更新失败',
    })
  }
}

/**
 * 删除API配置
 */
export async function deleteApiConfig(req, res) {
  try {
    const { id } = req.params
    
    const success = await deleteTrackingApiConfig(id)
    
    if (success) {
      res.json({
        errCode: 200,
        msg: '删除成功',
      })
    } else {
      res.status(404).json({
        errCode: 404,
        msg: '配置不存在',
      })
    }
  } catch (error) {
    console.error('删除API配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '删除失败',
    })
  }
}

// ==================== 爬虫追踪 API ====================

/**
 * 通过爬虫追踪集装箱（免费，无需API Key）
 */
export async function scrapeContainer(req, res) {
  try {
    const { containerNumber } = req.query
    
    if (!containerNumber) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供集装箱号',
      })
    }
    
    console.log(`[Controller] 爬虫追踪集装箱: ${containerNumber}`)
    const result = await scrapeContainerTracking(containerNumber)
    
    if (result) {
      res.json({
        errCode: 200,
        msg: 'success',
        data: result,
      })
    } else {
      res.json({
        errCode: 200,
        msg: '未找到追踪信息。可能原因：\n1. 集装箱号不存在或已过期\n2. 船公司网站暂时无法访问\n3. 集装箱号格式不正确\n建议：请确认集装箱号是否正确，或联系船公司核实',
        data: null,
      })
    }
  } catch (error) {
    console.error('爬虫追踪失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '追踪失败',
    })
  }
}

/**
 * 通过爬虫追踪提单（免费，无需API Key）
 */
export async function scrapeBill(req, res) {
  try {
    const { billNumber } = req.query
    
    if (!billNumber) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供提单号',
      })
    }
    
    console.log(`[Controller] 爬虫追踪提单: ${billNumber}`)
    const result = await scrapeBillTracking(billNumber)
    
    if (result) {
      res.json({
        errCode: 200,
        msg: 'success',
        data: result,
      })
    } else {
      res.json({
        errCode: 200,
        msg: '未找到追踪信息。可能原因：\n1. 提单号不存在或已过期\n2. 船公司网站暂时无法访问\n3. 提单号格式不正确\n建议：请确认提单号是否正确，或联系船公司核实',
        data: null,
      })
    }
  } catch (error) {
    console.error('爬虫追踪失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '追踪失败',
    })
  }
}

/**
 * 智能追踪（自动判断是集装箱号还是提单号）
 */
export async function smartTrackApi(req, res) {
  try {
    const { trackingNumber, shippingCompany } = req.query
    
    if (!trackingNumber) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供追踪号（集装箱号或提单号）',
      })
    }
    
    console.log(`[Controller] 智能追踪: ${trackingNumber}, 船公司: ${shippingCompany || '未指定'}`)
    const result = await smartTrack(trackingNumber, shippingCompany)
    
    if (result) {
      res.json({
        errCode: 200,
        msg: 'success',
        data: result,
      })
    } else {
      res.json({
        errCode: 200,
        msg: '未找到追踪信息。可能原因：\n1. 提单号不存在或已过期\n2. 船公司网站暂时无法访问\n3. 提单号格式不正确\n建议：请确认提单号是否正确，或联系船公司核实',
        data: null,
      })
    }
  } catch (error) {
    console.error('智能追踪失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '追踪失败',
    })
  }
}

/**
 * 获取支持的船公司列表
 */
export async function getCarriers(req, res) {
  try {
    const carriers = getSupportedCarriers()
    res.json({
      errCode: 200,
      msg: 'success',
      data: carriers,
    })
  } catch (error) {
    console.error('获取船公司列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取失败',
    })
  }
}

/**
 * 清理爬虫缓存
 */
export async function clearCache(req, res) {
  try {
    clearScraperCache()
    res.json({
      errCode: 200,
      msg: '缓存已清理',
    })
  } catch (error) {
    console.error('清理缓存失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '清理失败',
    })
  }
}

/**
 * 获取爬虫缓存统计
 */
export async function getCacheStatsApi(req, res) {
  try {
    const stats = getScraperCacheStats()
    res.json({
      errCode: 200,
      msg: 'success',
      data: stats,
    })
  } catch (error) {
    console.error('获取缓存统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '获取失败',
    })
  }
}

export default {
  // 跟踪记录
  getBillTracking,
  addManualNode,
  updateTracking,
  deleteTracking,
  batchRefresh,
  getTemplates,
  getStats,
  
  // 补充信息
  getTrackingSupplementInfo,
  
  // API配置
  getApiConfigs,
  getApiConfig,
  createApiConfig,
  updateApiConfig,
  deleteApiConfig,
  
  // 爬虫追踪
  scrapeContainer,
  scrapeBill,
  smartTrackApi,
  getCarriers,
  clearCache,
  getCacheStatsApi,
}
