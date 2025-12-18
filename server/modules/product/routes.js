/**
 * 产品管理模块 - 路由
 */

import { Router } from 'express'
import * as controller from './controller.js'

const router = Router()

// 产品管理
router.get('/products', controller.getProducts)
router.get('/products/:id', controller.getProductById)
router.post('/products', controller.createProduct)
router.put('/products/:id', controller.updateProduct)
router.delete('/products/:id', controller.deleteProduct)

// 产品费用项管理
router.get('/products/:productId/fee-items', controller.getProductFeeItems)
router.post('/products/:productId/fee-items', controller.addProductFeeItem)
router.put('/products/fee-items/:id', controller.updateProductFeeItem)
router.delete('/products/fee-items/:id', controller.deleteProductFeeItem)
router.put('/products/:productId/fee-items/batch', controller.setProductFeeItems)

export default router
