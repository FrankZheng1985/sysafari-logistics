/**
 * 基础数据模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 国家相关路由 ====================

// 获取国家列表
router.get('/countries', controller.getCountries)

// 获取国家大洲列表
router.get('/countries/continents', controller.getCountryContinents)

// 获取单个国家
router.get('/countries/:id', controller.getCountryById)

// 创建国家
router.post('/countries', controller.createCountry)

// 更新国家
router.put('/countries/:id', controller.updateCountry)

// 删除国家
router.delete('/countries/:id', controller.deleteCountry)

// ==================== 城市相关路由 ====================

// 获取城市列表
router.get('/cities', controller.getCities)

// 根据国家获取城市列表
router.get('/cities/country/:countryCode', controller.getCitiesByCountry)

// 批量创建城市
router.post('/cities/batch', controller.createCitiesBatch)

// 获取单个城市
router.get('/cities/:id', controller.getCityById)

// 创建城市
router.post('/cities', controller.createCity)

// 更新城市
router.put('/cities/:id', controller.updateCity)

// 删除城市
router.delete('/cities/:id', controller.deleteCity)

// ==================== 起运港相关路由 ====================

// 获取起运港国家列表 (需要在 :id 路由之前)
router.get('/ports-of-loading/countries', controller.getPortOfLoadingCountries)

// 获取起运港列表
router.get('/ports-of-loading', controller.getPortsOfLoading)

// 获取单个起运港
router.get('/ports-of-loading/:id', controller.getPortOfLoadingById)

// 创建起运港
router.post('/ports-of-loading', controller.createPortOfLoading)

// 更新起运港
router.put('/ports-of-loading/:id', controller.updatePortOfLoading)

// 删除起运港
router.delete('/ports-of-loading/:id', controller.deletePortOfLoading)

// ==================== 目的港相关路由 ====================

// 获取目的港国家列表 (需要在 :id 路由之前)
router.get('/destination-ports/countries', controller.getDestinationPortCountries)

// 获取目的港列表
router.get('/destination-ports', controller.getDestinationPorts)

// 获取单个目的港
router.get('/destination-ports/:id', controller.getDestinationPortById)

// 创建目的港
router.post('/destination-ports', controller.createDestinationPort)

// 更新目的港
router.put('/destination-ports/:id', controller.updateDestinationPort)

// 删除目的港
router.delete('/destination-ports/:id', controller.deleteDestinationPort)

// ==================== 机场相关路由 ====================

// 获取机场国家列表 (需要在 :id 路由之前)
router.get('/air-ports/countries', controller.getAirPortCountries)

// 获取机场列表
router.get('/air-ports', controller.getAirPorts)

// 获取单个机场
router.get('/air-ports/:id', controller.getAirPortById)

// 创建机场
router.post('/air-ports', controller.createAirPort)

// 更新机场
router.put('/air-ports/:id', controller.updateAirPort)

// 删除机场
router.delete('/air-ports/:id', controller.deleteAirPort)

// ==================== 船公司相关路由 ====================

// 获取船公司列表
router.get('/shipping-companies', controller.getShippingCompanies)

// 获取单个船公司
router.get('/shipping-companies/:id', controller.getShippingCompanyById)

// 创建船公司
router.post('/shipping-companies', controller.createShippingCompany)

// 更新船公司
router.put('/shipping-companies/:id', controller.updateShippingCompany)

// 删除船公司
router.delete('/shipping-companies/:id', controller.deleteShippingCompany)

// ==================== 柜号相关路由 ====================

// 获取柜号列表
router.get('/container-codes', controller.getContainerCodes)

// 创建柜号
router.post('/container-codes', controller.createContainerCode)

// 更新柜号
router.put('/container-codes/:id', controller.updateContainerCode)

// 删除柜号
router.delete('/container-codes/:id', controller.deleteContainerCode)

// ==================== 增值税率相关路由 ====================

// 根据国家代码获取增值税率 (需要在 :id 路由之前)
router.get('/vat-rates/by-country/:countryCode', controller.getVatRateByCountryCode)

// 获取增值税率列表
router.get('/vat-rates', controller.getVatRates)

// 获取单个增值税率
router.get('/vat-rates/:id', controller.getVatRateById)

// 创建增值税率
router.post('/vat-rates', controller.createVatRate)

// 更新增值税率
router.put('/vat-rates/:id', controller.updateVatRate)

// 删除增值税率
router.delete('/vat-rates/:id', controller.deleteVatRate)

// ==================== 运输方式相关路由 ====================

// 获取运输方式列表
router.get('/transport-methods', controller.getTransportMethods)

// 创建运输方式
router.post('/transport-methods', controller.createTransportMethod)

// 更新运输方式
router.put('/transport-methods/:id', controller.updateTransportMethod)

// 删除运输方式
router.delete('/transport-methods/:id', controller.deleteTransportMethod)

// ==================== 服务费类别相关路由 ====================

// 获取服务费类别列表（支持树形结构：?tree=true）
router.get('/service-fee-categories', controller.getServiceFeeCategories)

// 获取顶级分类列表（用于选择父级）
router.get('/service-fee-categories/top-level', controller.getTopLevelCategories)

// 创建服务费类别
router.post('/service-fee-categories', controller.createServiceFeeCategory)

// 更新服务费类别
router.put('/service-fee-categories/:id', controller.updateServiceFeeCategory)

// 删除服务费类别
router.delete('/service-fee-categories/:id', controller.deleteServiceFeeCategory)

export default router
