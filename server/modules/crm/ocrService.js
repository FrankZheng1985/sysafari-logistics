/**
 * 腾讯云OCR服务 - 营业执照识别
 * 
 * 使用腾讯云文字识别（OCR）服务识别中国营业执照
 * 文档: https://cloud.tencent.com/document/product/866/17598
 */

import tencentcloud from 'tencentcloud-sdk-nodejs-ocr'

const OcrClient = tencentcloud.ocr.v20181119.Client

// 创建OCR客户端实例
function createOcrClient() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  if (!secretId || !secretKey) {
    throw new Error('腾讯云配置缺失：请设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY 环境变量')
  }
  
  const clientConfig = {
    credential: {
      secretId: secretId,
      secretKey: secretKey,
    },
    region: 'ap-guangzhou', // 使用广州区域
    profile: {
      httpProfile: {
        endpoint: 'ocr.tencentcloudapi.com',
      },
    },
  }
  
  return new OcrClient(clientConfig)
}

/**
 * 识别营业执照图片
 * @param {string} imageBase64 - 图片的Base64编码（不含前缀）
 * @param {string} imageUrl - 图片的URL地址（与imageBase64二选一）
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeBusinessLicense(imageBase64, imageUrl = null) {
  try {
    const client = createOcrClient()
    
    const params = {}
    
    // 优先使用Base64，其次使用URL
    if (imageBase64) {
      // 移除Base64前缀（如 data:image/jpeg;base64,）
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      params.ImageBase64 = base64Data
    } else if (imageUrl) {
      params.ImageUrl = imageUrl
    } else {
      throw new Error('请提供图片的Base64编码或URL地址')
    }
    
    // 调用营业执照识别接口
    const response = await client.BizLicenseOCR(params)
    
    // 解析并返回结构化数据
    return {
      success: true,
      data: {
        // 公司名称
        companyName: response.Name || '',
        // 统一社会信用代码（税号）
        creditCode: response.RegNum || '',
        // 法定代表人
        legalPerson: response.Person || '',
        // 注册地址
        address: response.Address || '',
        // 注册资本
        registeredCapital: response.Capital || '',
        // 成立日期
        establishmentDate: response.SetDate || '',
        // 经营范围
        businessScope: response.Business || '',
        // 有效期
        validPeriod: response.Period || '',
        // 公司类型
        companyType: response.Type || '',
        // 组成形式
        composingForm: response.ComposingForm || '',
        // 原始响应（用于调试）
        _raw: response
      }
    }
  } catch (error) {
    console.error('营业执照OCR识别失败:', error)
    
    // 解析腾讯云错误
    let errorMessage = '营业执照识别失败'
    if (error.code) {
      switch (error.code) {
        case 'FailedOperation.ImageDecodeFailed':
          errorMessage = '图片解码失败，请确保图片格式正确'
          break
        case 'FailedOperation.OcrFailed':
          errorMessage = '识别失败，请确保图片清晰且包含完整的营业执照'
          break
        case 'FailedOperation.UnKnowError':
          errorMessage = '未知错误，请稍后重试'
          break
        case 'InvalidParameterValue.InvalidImageUrl':
          errorMessage = '图片URL无效'
          break
        case 'LimitExceeded.TooLargeFileError':
          errorMessage = '图片文件过大，请压缩后重试'
          break
        case 'ResourceUnavailable.InArrears':
          errorMessage = 'OCR服务欠费，请充值后使用'
          break
        case 'ResourceUnavailable.NotExist':
          errorMessage = 'OCR服务未开通，请先在腾讯云控制台开通'
          break
        default:
          errorMessage = error.message || '识别服务暂时不可用'
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 检查腾讯云OCR配置是否完整
 * @returns {Object} 配置状态
 */
export function checkOcrConfig() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  return {
    configured: !!(secretId && secretKey),
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey
  }
}

export default {
  recognizeBusinessLicense,
  checkOcrConfig
}
