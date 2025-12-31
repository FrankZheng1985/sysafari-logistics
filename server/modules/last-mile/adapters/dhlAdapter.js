/**
 * DHL Express API 适配器
 * 文档: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */

import { BaseCarrierAdapter } from './baseAdapter.js'

export class DHLAdapter extends BaseCarrierAdapter {
  constructor(config = {}) {
    super({
      carrierCode: 'DHL',
      carrierName: 'DHL Express',
      ...config
    })

    // DHL API配置
    this.baseUrl = config.apiConfig?.baseUrl || 'https://express.api.dhl.com/mydhlapi'
    this.testUrl = 'https://express.api.dhl.com/mydhlapi/test'
    this.apiKey = config.apiConfig?.apiKey || process.env.DHL_API_KEY || ''
    this.apiSecret = config.apiConfig?.apiSecret || process.env.DHL_API_SECRET || ''
    this.accountNumber = config.apiConfig?.accountNumber || process.env.DHL_ACCOUNT_NUMBER || ''
    this.isTest = config.apiConfig?.isTest !== false
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret && this.accountNumber)
  }

  getSupportedFeatures() {
    return {
      createShipment: true,
      getLabel: true,
      getTracking: true,
      cancelShipment: true,
      validateAddress: true,
      getRates: true
    }
  }

  getApiUrl() {
    return this.isTest ? this.testUrl : this.baseUrl
  }

  getAuthHeader() {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * 创建运单 (下单)
   */
  async createShipment(shipmentData) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'DHL API未配置',
        configMissing: true
      }
    }

    try {
      const normalized = this.normalizeShipmentData(shipmentData)
      
      const requestBody = {
        plannedShippingDateAndTime: new Date().toISOString(),
        pickup: {
          isRequested: false
        },
        productCode: this.mapServiceType(normalized.service),
        accounts: [{
          typeCode: 'shipper',
          number: this.accountNumber
        }],
        customerDetails: {
          shipperDetails: {
            postalAddress: {
              postalCode: normalized.sender.postalCode,
              cityName: normalized.sender.city,
              countryCode: normalized.sender.country,
              addressLine1: normalized.sender.street1
            },
            contactInformation: {
              phone: normalized.sender.phone,
              companyName: normalized.sender.company || normalized.sender.name,
              fullName: normalized.sender.name
            }
          },
          receiverDetails: {
            postalAddress: {
              postalCode: normalized.receiver.postalCode,
              cityName: normalized.receiver.city,
              countryCode: normalized.receiver.country,
              addressLine1: normalized.receiver.street1
            },
            contactInformation: {
              phone: normalized.receiver.phone,
              companyName: normalized.receiver.company || normalized.receiver.name,
              fullName: normalized.receiver.name
            }
          }
        },
        content: {
          packages: normalized.packages.map((pkg, idx) => ({
            weight: pkg.weight,
            dimensions: {
              length: pkg.length || 10,
              width: pkg.width || 10,
              height: pkg.height || 10
            },
            customerReferences: [{
              value: normalized.reference || `PKG${idx + 1}`
            }]
          })),
          isCustomsDeclarable: false,
          description: normalized.description || 'General Goods',
          incoterm: 'DAP',
          unitOfMeasurement: 'metric'
        },
        outputImageProperties: {
          imageOptions: [{
            typeCode: 'label',
            templateName: 'ECOM26_84_001'
          }],
          printerDPI: 300,
          encodingFormat: 'pdf'
        }
      }

      const response = await this.makeRequest(`${this.getApiUrl()}/shipments`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      this.log('info', 'DHL运单创建成功', { trackingNo: response.shipmentTrackingNumber })

      return {
        success: true,
        data: {
          carrierTrackingNo: response.shipmentTrackingNumber,
          shipmentId: response.shipmentTrackingNumber,
          labelUrl: response.documents?.[0]?.url,
          labelData: response.documents?.[0]?.content,
          labelFormat: 'PDF',
          estimatedDelivery: response.estimatedDeliveryDate,
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'DHL运单创建失败', { error: error.message })
      return {
        success: false,
        error: `DHL创建运单失败: ${error.message}`
      }
    }
  }

  /**
   * 获取面单
   */
  async getLabel(trackingNo, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'DHL API未配置' }
    }

    try {
      const format = options.format || 'pdf'
      const response = await this.makeRequest(
        `${this.getApiUrl()}/shipments/${trackingNo}/get-image?typeCode=label`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader()
          }
        }
      )

      return {
        success: true,
        data: {
          labelData: response.documents?.[0]?.content,
          labelFormat: format.toUpperCase(),
          trackingNo
        }
      }
    } catch (error) {
      this.log('error', 'DHL获取面单失败', { trackingNo, error: error.message })
      return {
        success: false,
        error: `获取面单失败: ${error.message}`
      }
    }
  }

  /**
   * 查询轨迹
   */
  async getTracking(trackingNo) {
    if (!this.isConfigured()) {
      return { success: false, error: 'DHL API未配置' }
    }

    try {
      const response = await this.makeRequest(
        `${this.getApiUrl()}/tracking?shipmentTrackingNumber=${trackingNo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader()
          }
        }
      )

      const shipment = response.shipments?.[0]
      if (!shipment) {
        return {
          success: false,
          error: '未找到轨迹信息'
        }
      }

      const events = (shipment.events || []).map(event => this.normalizeTrackingEvent({
        timestamp: event.timestamp,
        status: event.typeCode,
        description: event.description,
        location: event.serviceArea?.[0]?.description || ''
      }))

      return {
        success: true,
        data: {
          trackingNo,
          status: shipment.status?.statusCode || 'UNKNOWN',
          statusDescription: shipment.status?.description || '',
          estimatedDelivery: shipment.estimatedDeliveryDate,
          events,
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'DHL查询轨迹失败', { trackingNo, error: error.message })
      return {
        success: false,
        error: `查询轨迹失败: ${error.message}`
      }
    }
  }

  /**
   * 取消运单
   */
  async cancelShipment(trackingNo) {
    if (!this.isConfigured()) {
      return { success: false, error: 'DHL API未配置' }
    }

    try {
      await this.makeRequest(
        `${this.getApiUrl()}/shipments/${trackingNo}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': this.getAuthHeader()
          }
        }
      )

      this.log('info', 'DHL运单取消成功', { trackingNo })

      return {
        success: true,
        data: { trackingNo, cancelled: true }
      }
    } catch (error) {
      this.log('error', 'DHL取消运单失败', { trackingNo, error: error.message })
      return {
        success: false,
        error: `取消运单失败: ${error.message}`
      }
    }
  }

  /**
   * 地址校验
   */
  async validateAddress(address) {
    if (!this.isConfigured()) {
      return { success: false, error: 'DHL API未配置' }
    }

    try {
      const normalized = this.normalizeAddress(address)
      
      const response = await this.makeRequest(
        `${this.getApiUrl()}/address-validate`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'delivery',
            postalCode: normalized.postalCode,
            cityName: normalized.city,
            countryCode: normalized.country,
            addressLine1: normalized.street1
          })
        }
      )

      return {
        success: true,
        data: {
          valid: response.address?.length > 0,
          suggestions: response.address || [],
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'DHL地址校验失败', { error: error.message })
      return {
        success: false,
        error: `地址校验失败: ${error.message}`
      }
    }
  }

  /**
   * 获取实时报价
   */
  async getRates(params) {
    if (!this.isConfigured()) {
      return { success: false, error: 'DHL API未配置' }
    }

    try {
      const response = await this.makeRequest(
        `${this.getApiUrl()}/rates`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerDetails: {
              shipperDetails: {
                postalCode: params.originPostalCode,
                cityName: params.originCity,
                countryCode: params.originCountry
              },
              receiverDetails: {
                postalCode: params.destinationPostalCode,
                cityName: params.destinationCity,
                countryCode: params.destinationCountry
              }
            },
            accounts: [{
              typeCode: 'shipper',
              number: this.accountNumber
            }],
            plannedShippingDateAndTime: new Date().toISOString(),
            unitOfMeasurement: 'metric',
            isCustomsDeclarable: false,
            packages: [{
              weight: params.weight || 1,
              dimensions: {
                length: params.length || 10,
                width: params.width || 10,
                height: params.height || 10
              }
            }]
          })
        }
      )

      const products = response.products || []

      return {
        success: true,
        data: {
          rates: products.map(p => ({
            serviceCode: p.productCode,
            serviceName: p.productName,
            totalPrice: p.totalPrice?.[0]?.price || 0,
            currency: p.totalPrice?.[0]?.priceCurrency || 'EUR',
            estimatedDelivery: p.deliveryCapabilities?.estimatedDeliveryDateAndTime
          })),
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'DHL获取报价失败', { error: error.message })
      return {
        success: false,
        error: `获取报价失败: ${error.message}`
      }
    }
  }

  /**
   * 映射服务类型到DHL产品代码
   */
  mapServiceType(serviceType) {
    const mapping = {
      'express': 'P',      // Express Worldwide
      'standard': 'N',     // DHL Express 12:00
      'economy': 'U',      // Express Worldwide ECX
      'sameday': 'I'       // Express 9:00
    }
    return mapping[serviceType?.toLowerCase()] || 'P'
  }
}

export default DHLAdapter
