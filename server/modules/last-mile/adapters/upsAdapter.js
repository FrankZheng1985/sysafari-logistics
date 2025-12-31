/**
 * UPS API 适配器
 * 文档: https://developer.ups.com/
 */

import { BaseCarrierAdapter } from './baseAdapter.js'

export class UPSAdapter extends BaseCarrierAdapter {
  constructor(config = {}) {
    super({
      carrierCode: 'UPS',
      carrierName: 'UPS',
      ...config
    })

    // UPS API配置
    this.baseUrl = config.apiConfig?.baseUrl || 'https://onlinetools.ups.com/api'
    this.testUrl = 'https://wwwcie.ups.com/api'
    this.clientId = config.apiConfig?.clientId || process.env.UPS_CLIENT_ID || ''
    this.clientSecret = config.apiConfig?.clientSecret || process.env.UPS_CLIENT_SECRET || ''
    this.accountNumber = config.apiConfig?.accountNumber || process.env.UPS_ACCOUNT_NUMBER || ''
    this.isTest = config.apiConfig?.isTest !== false
    this.accessToken = null
    this.tokenExpiry = null
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.accountNumber)
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

  /**
   * 获取OAuth访问令牌
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch(`${this.getApiUrl()}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      throw new Error('UPS认证失败')
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000

    return this.accessToken
  }

  /**
   * 创建运单 (下单)
   */
  async createShipment(shipmentData) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'UPS API未配置',
        configMissing: true
      }
    }

    try {
      const token = await this.getAccessToken()
      const normalized = this.normalizeShipmentData(shipmentData)
      
      const requestBody = {
        ShipmentRequest: {
          Request: {
            SubVersion: '1801',
            RequestOption: 'nonvalidate',
            TransactionReference: {
              CustomerContext: normalized.reference || `REF${Date.now()}`
            }
          },
          Shipment: {
            Description: normalized.description || 'General Goods',
            Shipper: {
              Name: normalized.sender.company || normalized.sender.name,
              AttentionName: normalized.sender.name,
              ShipperNumber: this.accountNumber,
              Phone: {
                Number: normalized.sender.phone
              },
              Address: {
                AddressLine: [normalized.sender.street1],
                City: normalized.sender.city,
                PostalCode: normalized.sender.postalCode,
                CountryCode: normalized.sender.country
              }
            },
            ShipTo: {
              Name: normalized.receiver.company || normalized.receiver.name,
              AttentionName: normalized.receiver.name,
              Phone: {
                Number: normalized.receiver.phone
              },
              Address: {
                AddressLine: [normalized.receiver.street1],
                City: normalized.receiver.city,
                PostalCode: normalized.receiver.postalCode,
                CountryCode: normalized.receiver.country
              }
            },
            PaymentInformation: {
              ShipmentCharge: [{
                Type: '01',
                BillShipper: {
                  AccountNumber: this.accountNumber
                }
              }]
            },
            Service: {
              Code: this.mapServiceType(normalized.service)
            },
            Package: normalized.packages.map(pkg => ({
              Description: pkg.description || 'Package',
              Packaging: {
                Code: '02' // Customer Supplied Package
              },
              Dimensions: {
                UnitOfMeasurement: { Code: 'CM' },
                Length: String(pkg.length || 10),
                Width: String(pkg.width || 10),
                Height: String(pkg.height || 10)
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: 'KGS' },
                Weight: String(pkg.weight)
              }
            }))
          },
          LabelSpecification: {
            LabelImageFormat: {
              Code: 'PDF'
            }
          }
        }
      }

      const response = await this.makeRequest(`${this.getApiUrl()}/shipments/v1801/ship`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'transId': `TXN${Date.now()}`,
          'transactionSrc': 'sysafari-logistics'
        },
        body: JSON.stringify(requestBody)
      })

      const shipmentResult = response.ShipmentResponse?.ShipmentResults
      if (!shipmentResult) {
        throw new Error('无效的UPS响应')
      }

      this.log('info', 'UPS运单创建成功', { 
        trackingNo: shipmentResult.ShipmentIdentificationNumber 
      })

      return {
        success: true,
        data: {
          carrierTrackingNo: shipmentResult.ShipmentIdentificationNumber,
          shipmentId: shipmentResult.ShipmentIdentificationNumber,
          labelUrl: null,
          labelData: shipmentResult.PackageResults?.[0]?.ShippingLabel?.GraphicImage,
          labelFormat: 'PDF',
          totalCharge: shipmentResult.ShipmentCharges?.TotalCharges?.MonetaryValue,
          currency: shipmentResult.ShipmentCharges?.TotalCharges?.CurrencyCode,
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'UPS运单创建失败', { error: error.message })
      return {
        success: false,
        error: `UPS创建运单失败: ${error.message}`
      }
    }
  }

  /**
   * 获取面单
   */
  async getLabel(trackingNo, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'UPS API未配置' }
    }

    try {
      const token = await this.getAccessToken()
      
      const response = await this.makeRequest(
        `${this.getApiUrl()}/labels/v1/label?trackingNumber=${trackingNo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'transId': `TXN${Date.now()}`,
            'transactionSrc': 'sysafari-logistics'
          }
        }
      )

      return {
        success: true,
        data: {
          labelData: response.LabelRecoveryResponse?.LabelResults?.LabelImage?.GraphicImage,
          labelFormat: 'PDF',
          trackingNo
        }
      }
    } catch (error) {
      this.log('error', 'UPS获取面单失败', { trackingNo, error: error.message })
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
      return { success: false, error: 'UPS API未配置' }
    }

    try {
      const token = await this.getAccessToken()
      
      const response = await this.makeRequest(
        `${this.getApiUrl()}/track/v1/details/${trackingNo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'transId': `TXN${Date.now()}`,
            'transactionSrc': 'sysafari-logistics'
          }
        }
      )

      const trackResponse = response.trackResponse?.shipment?.[0]
      if (!trackResponse) {
        return {
          success: false,
          error: '未找到轨迹信息'
        }
      }

      const pkg = trackResponse.package?.[0]
      const events = (pkg?.activity || []).map(activity => this.normalizeTrackingEvent({
        timestamp: `${activity.date}T${activity.time}`,
        status: activity.status?.type,
        description: activity.status?.description,
        location: activity.location?.address?.city || ''
      }))

      return {
        success: true,
        data: {
          trackingNo,
          status: pkg?.currentStatus?.type || 'UNKNOWN',
          statusDescription: pkg?.currentStatus?.description || '',
          estimatedDelivery: pkg?.deliveryDate?.[0]?.date,
          events,
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'UPS查询轨迹失败', { trackingNo, error: error.message })
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
      return { success: false, error: 'UPS API未配置' }
    }

    try {
      const token = await this.getAccessToken()
      
      await this.makeRequest(
        `${this.getApiUrl()}/shipments/v1/void/cancel/${trackingNo}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'transId': `TXN${Date.now()}`,
            'transactionSrc': 'sysafari-logistics'
          }
        }
      )

      this.log('info', 'UPS运单取消成功', { trackingNo })

      return {
        success: true,
        data: { trackingNo, cancelled: true }
      }
    } catch (error) {
      this.log('error', 'UPS取消运单失败', { trackingNo, error: error.message })
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
      return { success: false, error: 'UPS API未配置' }
    }

    try {
      const token = await this.getAccessToken()
      const normalized = this.normalizeAddress(address)
      
      const response = await this.makeRequest(
        `${this.getApiUrl()}/addressvalidation/v1/1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'transId': `TXN${Date.now()}`,
            'transactionSrc': 'sysafari-logistics'
          },
          body: JSON.stringify({
            XAVRequest: {
              AddressKeyFormat: {
                AddressLine: [normalized.street1],
                PoliticalDivision2: normalized.city,
                PostcodePrimaryLow: normalized.postalCode,
                CountryCode: normalized.country
              }
            }
          })
        }
      )

      const candidate = response.XAVResponse?.Candidate?.[0]

      return {
        success: true,
        data: {
          valid: !!candidate,
          suggestions: candidate ? [{
            street: candidate.AddressKeyFormat?.AddressLine?.[0],
            city: candidate.AddressKeyFormat?.PoliticalDivision2,
            postalCode: candidate.AddressKeyFormat?.PostcodePrimaryLow,
            country: candidate.AddressKeyFormat?.CountryCode
          }] : [],
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'UPS地址校验失败', { error: error.message })
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
      return { success: false, error: 'UPS API未配置' }
    }

    try {
      const token = await this.getAccessToken()
      
      const response = await this.makeRequest(
        `${this.getApiUrl()}/rating/v1/Shop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'transId': `TXN${Date.now()}`,
            'transactionSrc': 'sysafari-logistics'
          },
          body: JSON.stringify({
            RateRequest: {
              Request: {
                SubVersion: '1801'
              },
              Shipment: {
                Shipper: {
                  Address: {
                    PostalCode: params.originPostalCode,
                    City: params.originCity,
                    CountryCode: params.originCountry
                  }
                },
                ShipTo: {
                  Address: {
                    PostalCode: params.destinationPostalCode,
                    City: params.destinationCity,
                    CountryCode: params.destinationCountry
                  }
                },
                Package: [{
                  PackagingType: { Code: '02' },
                  Dimensions: {
                    UnitOfMeasurement: { Code: 'CM' },
                    Length: String(params.length || 10),
                    Width: String(params.width || 10),
                    Height: String(params.height || 10)
                  },
                  PackageWeight: {
                    UnitOfMeasurement: { Code: 'KGS' },
                    Weight: String(params.weight || 1)
                  }
                }]
              }
            }
          })
        }
      )

      const ratedShipments = response.RateResponse?.RatedShipment || []

      return {
        success: true,
        data: {
          rates: ratedShipments.map(rs => ({
            serviceCode: rs.Service?.Code,
            serviceName: this.getServiceName(rs.Service?.Code),
            totalPrice: parseFloat(rs.TotalCharges?.MonetaryValue) || 0,
            currency: rs.TotalCharges?.CurrencyCode || 'USD',
            estimatedDelivery: rs.GuaranteedDelivery?.BusinessDaysInTransit
          })),
          rawResponse: response
        }
      }
    } catch (error) {
      this.log('error', 'UPS获取报价失败', { error: error.message })
      return {
        success: false,
        error: `获取报价失败: ${error.message}`
      }
    }
  }

  /**
   * 映射服务类型到UPS服务代码
   */
  mapServiceType(serviceType) {
    const mapping = {
      'express': '01',      // UPS Next Day Air
      'standard': '03',     // UPS Ground
      'economy': '11',      // UPS Standard
      'sameday': '14'       // UPS Next Day Air Early
    }
    return mapping[serviceType?.toLowerCase()] || '11'
  }

  /**
   * 获取服务名称
   */
  getServiceName(code) {
    const names = {
      '01': 'UPS Next Day Air',
      '02': 'UPS Second Day Air',
      '03': 'UPS Ground',
      '07': 'UPS Express',
      '08': 'UPS Expedited',
      '11': 'UPS Standard',
      '14': 'UPS Next Day Air Early'
    }
    return names[code] || `UPS Service ${code}`
  }
}

export default UPSAdapter
