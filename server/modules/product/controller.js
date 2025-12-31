/**
 * 产品管理模块 - 控制器
 */

import * as model from './model.js'

// ==================== 产品管理 ====================

/**
 * 获取产品列表
 */
export async function getProducts(req, res) {
  try {
    const result = await model.getProducts(req.query)
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result
    })
  } catch (error) {
    console.error('获取产品列表失败:', error)
    res.json({
      errCode: 500,
      msg: '获取产品列表失败: ' + error.message
    })
  }
}

/**
 * 获取单个产品详情
 */
export async function getProductById(req, res) {
  try {
    const { id } = req.params
    const product = await model.getProductById(id)
    
    if (!product) {
      return res.json({
        errCode: 404,
        msg: '产品不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: product
    })
  } catch (error) {
    console.error('获取产品详情失败:', error)
    res.json({
      errCode: 500,
      msg: '获取产品详情失败: ' + error.message
    })
  }
}

/**
 * 创建产品
 */
export async function createProduct(req, res) {
  try {
    const { productName } = req.body
    
    if (!productName) {
      return res.json({
        errCode: 400,
        msg: '产品名称不能为空'
      })
    }
    
    const result = await model.createProduct(req.body)
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建产品失败:', error)
    res.json({
      errCode: 500,
      msg: '创建产品失败: ' + error.message
    })
  }
}

/**
 * 更新产品
 */
export async function updateProduct(req, res) {
  try {
    const { id } = req.params
    const updated = await model.updateProduct(id, req.body)
    
    if (!updated) {
      return res.json({
        errCode: 404,
        msg: '产品不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新产品失败:', error)
    res.json({
      errCode: 500,
      msg: '更新产品失败: ' + error.message
    })
  }
}

/**
 * 删除产品
 */
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params
    const deleted = await model.deleteProduct(id)
    
    if (!deleted) {
      return res.json({
        errCode: 404,
        msg: '产品不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除产品失败:', error)
    res.json({
      errCode: 500,
      msg: '删除产品失败: ' + error.message
    })
  }
}

// ==================== 产品费用项管理 ====================

/**
 * 获取产品费用项
 */
export async function getProductFeeItems(req, res) {
  try {
    const { productId } = req.params
    const items = await model.getProductFeeItems(productId)
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: items
    })
  } catch (error) {
    console.error('获取产品费用项失败:', error)
    res.json({
      errCode: 500,
      msg: '获取产品费用项失败: ' + error.message
    })
  }
}

/**
 * 添加产品费用项
 */
export async function addProductFeeItem(req, res) {
  try {
    const { productId } = req.params
    const { feeName } = req.body
    
    if (!feeName) {
      return res.json({
        errCode: 400,
        msg: '费用名称不能为空'
      })
    }
    
    const result = await model.addProductFeeItem(productId, req.body)
    res.json({
      errCode: 200,
      msg: '添加成功',
      data: result
    })
  } catch (error) {
    console.error('添加产品费用项失败:', error)
    res.json({
      errCode: 500,
      msg: '添加产品费用项失败: ' + error.message
    })
  }
}

/**
 * 更新产品费用项
 */
export async function updateProductFeeItem(req, res) {
  try {
    const { id } = req.params
    const updated = await model.updateProductFeeItem(id, req.body)
    
    if (!updated) {
      return res.json({
        errCode: 404,
        msg: '费用项不存在或无更新'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '更新成功'
    })
  } catch (error) {
    console.error('更新产品费用项失败:', error)
    res.json({
      errCode: 500,
      msg: '更新产品费用项失败: ' + error.message
    })
  }
}

/**
 * 删除产品费用项
 */
export async function deleteProductFeeItem(req, res) {
  try {
    const { id } = req.params
    const deleted = await model.deleteProductFeeItem(id)
    
    if (!deleted) {
      return res.json({
        errCode: 404,
        msg: '费用项不存在'
      })
    }
    
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除产品费用项失败:', error)
    res.json({
      errCode: 500,
      msg: '删除产品费用项失败: ' + error.message
    })
  }
}

/**
 * 批量设置产品费用项
 */
export async function setProductFeeItems(req, res) {
  try {
    const { productId } = req.params
    const { items } = req.body
    
    if (!Array.isArray(items)) {
      return res.json({
        errCode: 400,
        msg: '费用项列表格式错误'
      })
    }
    
    await model.setProductFeeItems(productId, items)
    res.json({
      errCode: 200,
      msg: '保存成功'
    })
  } catch (error) {
    console.error('设置产品费用项失败:', error)
    res.json({
      errCode: 500,
      msg: '设置产品费用项失败: ' + error.message
    })
  }
}

// ==================== 批量操作 ====================

/**
 * 批量同步成本价（从供应商报价更新）
 */
export async function batchSyncCostFromSupplier(req, res) {
  try {
    const { feeItemIds } = req.body
    
    if (!Array.isArray(feeItemIds) || feeItemIds.length === 0) {
      return res.json({
        errCode: 400,
        msg: '请选择要同步的费用项'
      })
    }
    
    const result = await model.batchSyncCostFromSupplier(feeItemIds)
    res.json({
      errCode: 200,
      msg: `成功同步 ${result.updated} 项，失败 ${result.failed} 项`,
      data: result
    })
  } catch (error) {
    console.error('批量同步成本失败:', error)
    res.json({
      errCode: 500,
      msg: '批量同步成本失败: ' + error.message
    })
  }
}

/**
 * 批量设置利润
 */
export async function batchSetProfit(req, res) {
  try {
    const { feeItemIds, profitType, profitValue } = req.body
    
    if (!Array.isArray(feeItemIds) || feeItemIds.length === 0) {
      return res.json({
        errCode: 400,
        msg: '请选择要设置的费用项'
      })
    }
    
    if (!profitType || !['amount', 'rate'].includes(profitType)) {
      return res.json({
        errCode: 400,
        msg: '请选择有效的利润类型'
      })
    }
    
    const result = await model.batchSetProfit(feeItemIds, profitType, parseFloat(profitValue) || 0)
    res.json({
      errCode: 200,
      msg: `成功设置 ${result.updated} 项利润`,
      data: result
    })
  } catch (error) {
    console.error('批量设置利润失败:', error)
    res.json({
      errCode: 500,
      msg: '批量设置利润失败: ' + error.message
    })
  }
}

/**
 * 批量从供应商报价导入
 */
export async function batchImportFromSupplier(req, res) {
  try {
    const { productId } = req.params
    const { supplierPriceIds, profitType, profitValue } = req.body
    
    if (!Array.isArray(supplierPriceIds) || supplierPriceIds.length === 0) {
      return res.json({
        errCode: 400,
        msg: '请选择要导入的供应商报价'
      })
    }
    
    const result = await model.batchImportFromSupplier(
      productId, 
      supplierPriceIds, 
      profitType || 'amount', 
      parseFloat(profitValue) || 0
    )
    res.json({
      errCode: 200,
      msg: `成功导入 ${result.imported} 项，失败 ${result.failed} 项`,
      data: result
    })
  } catch (error) {
    console.error('批量导入失败:', error)
    res.json({
      errCode: 500,
      msg: '批量导入失败: ' + error.message
    })
  }
}

/**
 * 批量调价
 */
export async function batchAdjustPrice(req, res) {
  try {
    const { feeItemIds, adjustType, adjustValue } = req.body
    
    if (!Array.isArray(feeItemIds) || feeItemIds.length === 0) {
      return res.json({
        errCode: 400,
        msg: '请选择要调价的费用项'
      })
    }
    
    if (!adjustType || !['percent', 'amount'].includes(adjustType)) {
      return res.json({
        errCode: 400,
        msg: '请选择有效的调价类型'
      })
    }
    
    const result = await model.batchAdjustPrice(feeItemIds, adjustType, parseFloat(adjustValue) || 0)
    res.json({
      errCode: 200,
      msg: `成功调整 ${result.updated} 项价格`,
      data: result
    })
  } catch (error) {
    console.error('批量调价失败:', error)
    res.json({
      errCode: 500,
      msg: '批量调价失败: ' + error.message
    })
  }
}

/**
 * 批量重新计算取整
 */
export async function batchRecalculateRounding(req, res) {
  try {
    const { feeItemIds } = req.body
    
    if (!Array.isArray(feeItemIds) || feeItemIds.length === 0) {
      return res.json({
        errCode: 400,
        msg: '请选择要重新计算的费用项'
      })
    }
    
    const result = await model.batchRecalculateRounding(feeItemIds)
    res.json({
      errCode: 200,
      msg: `成功更新 ${result.updated} 项价格取整`,
      data: result
    })
  } catch (error) {
    console.error('批量重新计算取整失败:', error)
    res.json({
      errCode: 500,
      msg: '批量重新计算取整失败: ' + error.message
    })
  }
}

/**
 * 插入演示测试数据 (仅用于演示环境)
 */
export async function seedDemoData(req, res) {
  try {
    const result = await model.seedDemoData()
    res.json({
      errCode: 200,
      msg: '演示数据插入成功',
      data: result
    })
  } catch (error) {
    console.error('插入演示数据失败:', error)
    res.json({
      errCode: 500,
      msg: '插入演示数据失败: ' + error.message
    })
  }
}
