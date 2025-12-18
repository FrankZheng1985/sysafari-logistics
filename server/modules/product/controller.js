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
