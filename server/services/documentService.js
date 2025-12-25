/**
 * 统一文档上传服务
 * 所有模块的文件上传都通过此服务，自动存储到COS并记录到documents表
 * 
 * 环境隔离：
 * - 生产环境 (NODE_ENV=production): 文件存储在 prod/ 前缀下
 * - 开发环境 (NODE_ENV=development): 文件存储在 dev/ 前缀下
 * - 可通过 COS_PATH_PREFIX 环境变量自定义前缀
 */

import * as cosService from '../utils/cosService.js'
import * as documentModel from '../modules/document/model.js'

/**
 * 获取环境路径前缀
 * 用于区分开发和生产环境的文件存储
 */
function getEnvPrefix() {
  // 优先使用自定义前缀
  if (process.env.COS_PATH_PREFIX) {
    return process.env.COS_PATH_PREFIX
  }
  // 根据环境自动选择前缀
  const isProduction = process.env.NODE_ENV === 'production'
  return isProduction ? 'prod' : 'dev'
}

/**
 * 统一文档上传
 * @param {Object} options - 上传选项
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.documentType - 文档类型 (见 documentModel.DOCUMENT_TYPE)
 * @param {string} [options.billId] - 关联订单ID
 * @param {string} [options.billNumber] - 关联订单号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {string} [options.description] - 文档描述
 * @param {string} [options.accessLevel] - 访问级别 (order_related/finance/admin)
 * @param {boolean} [options.isPublic] - 是否公开
 * @param {Object} [options.user] - 上传用户信息 {id, name}
 * @param {string} [options.remark] - 备注
 * @param {string} [options.customKey] - 自定义COS Key（可选）
 * @returns {Promise<Object>} 上传结果，包含documentId, cosUrl等
 */
export async function uploadDocument(options) {
  const {
    fileBuffer,
    fileName,
    documentType,
    billId,
    billNumber,
    customerId,
    customerName,
    description,
    accessLevel = 'order_related',
    isPublic = true,
    user,
    remark,
    customKey
  } = options

  // 1. 上传到COS
  const cosResult = await cosService.uploadDocument({
    body: fileBuffer,
    fileName,
    billNumber: billNumber || 'general',
    documentType,
    customKey
  })

  // 2. 提取文件信息
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
  const mimeType = cosResult.mimeType || cosService.getMimeType(fileName)

  // 3. 在documents表创建记录
  const docResult = await documentModel.createDocument({
    documentName: fileName,
    originalName: fileName,
    documentType,
    billId,
    billNumber,
    customerId,
    customerName,
    cosKey: cosResult.key,
    cosUrl: cosResult.url,
    cosBucket: cosResult.bucket,
    cosRegion: cosResult.region,
    fileSize: fileBuffer.length,
    mimeType,
    fileExtension,
    accessLevel,
    isPublic,
    description,
    remark,
    uploadedBy: user?.id,
    uploadedByName: user?.name || '系统'
  })

  return {
    documentId: docResult.id,
    documentNumber: docResult.documentNumber,
    cosKey: cosResult.key,
    cosUrl: cosResult.url,
    fileName,
    fileSize: fileBuffer.length,
    mimeType,
    documentType
  }
}

/**
 * 上传付款凭证 - 财务模块专用
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.paymentNumber - 付款单号
 * @param {string} [options.billId] - 关联订单ID
 * @param {string} [options.billNumber] - 关联订单号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadPaymentReceipt(options) {
  const {
    fileBuffer,
    fileName,
    paymentNumber,
    billId,
    billNumber,
    customerId,
    customerName,
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf'
  const customKey = `${envPrefix}/payments/${year}/${paymentNumber}_receipt.${ext}`

  return uploadDocument({
    fileBuffer,
    fileName,
    documentType: 'payment_receipt',
    billId,
    billNumber,
    customerId,
    customerName,
    description: `付款凭证 - ${paymentNumber}`,
    accessLevel: 'finance',
    user,
    customKey
  })
}

/**
 * 上传合同文件 - CRM模块专用
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.contractNumber - 合同编号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {string} [options.contractType] - 合同类型 (unsigned/signed)
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadContract(options) {
  const {
    fileBuffer,
    fileName,
    contractNumber,
    customerId,
    customerName,
    contractType = 'signed',
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf'
  const customKey = `${envPrefix}/contracts/${year}/${contractNumber}_${contractType}.${ext}`

  return uploadDocument({
    fileBuffer,
    fileName,
    documentType: 'contract',
    customerId,
    customerName,
    description: `合同文件 - ${contractNumber}`,
    accessLevel: 'finance',
    user,
    customKey
  })
}

/**
 * 上传发票文件 - 财务模块专用
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.invoiceNumber - 发票号
 * @param {string} [options.billId] - 关联订单ID
 * @param {string} [options.billNumber] - 关联订单号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadInvoice(options) {
  const {
    fileBuffer,
    fileName,
    invoiceNumber,
    billId,
    billNumber,
    customerId,
    customerName,
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf'
  const customKey = `${envPrefix}/invoices/${year}/${invoiceNumber}.${ext}`

  return uploadDocument({
    fileBuffer,
    fileName,
    documentType: 'invoice',
    billId,
    billNumber,
    customerId,
    customerName,
    description: `发票 - ${invoiceNumber}`,
    accessLevel: 'finance',
    user,
    customKey
  })
}

/**
 * 上传报关单/税费确认单 - 单证模块专用
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.importId - 导入批次ID
 * @param {string} [options.billId] - 关联订单ID
 * @param {string} [options.billNumber] - 关联订单号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadCustomsDocument(options) {
  const {
    fileBuffer,
    fileName,
    importId,
    billId,
    billNumber,
    customerId,
    customerName,
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const customKey = `${envPrefix}/customs/${year}/${month}/${importId}_tax_confirm.pdf`

  return uploadDocument({
    fileBuffer,
    fileName: fileName || `${importId}_tax_confirm.pdf`,
    documentType: 'customs_declaration',
    billId,
    billNumber,
    customerId,
    customerName,
    description: `税费确认单 - ${importId}`,
    accessLevel: 'finance',
    user,
    customKey
  })
}

/**
 * 上传运输单/CMR - TMS模块专用
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.cmrNumber - CMR编号
 * @param {string} [options.billId] - 关联订单ID
 * @param {string} [options.billNumber] - 关联订单号
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadDeliveryNote(options) {
  const {
    fileBuffer,
    fileName,
    cmrNumber,
    billId,
    billNumber,
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf'
  const customKey = `${envPrefix}/delivery/${year}/${month}/${cmrNumber}.${ext}`

  return uploadDocument({
    fileBuffer,
    fileName,
    documentType: 'delivery_note',
    billId,
    billNumber,
    description: `运输单 - ${cmrNumber}`,
    accessLevel: 'order_related',
    user,
    customKey
  })
}

/**
 * 上传报价单PDF
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - 文件Buffer
 * @param {string} options.quotationNumber - 报价单号
 * @param {string} [options.customerId] - 客户ID
 * @param {string} [options.customerName] - 客户名称
 * @param {Object} [options.user] - 上传用户
 * @returns {Promise<Object>}
 */
export async function uploadQuotation(options) {
  const {
    fileBuffer,
    quotationNumber,
    customerId,
    customerName,
    user
  } = options

  // 自定义COS路径（带环境前缀）
  const envPrefix = getEnvPrefix()
  const year = new Date().getFullYear()
  const timestamp = Date.now()
  const customKey = `${envPrefix}/quotations/${year}/${quotationNumber}_${timestamp}.pdf`

  return uploadDocument({
    fileBuffer,
    fileName: `${quotationNumber}.pdf`,
    documentType: 'quotation',
    customerId,
    customerName,
    description: `报价单 - ${quotationNumber}`,
    accessLevel: 'order_related',
    user,
    customKey
  })
}

/**
 * 获取文档预览URL
 */
export async function getDocumentPreviewUrl(documentId) {
  const document = await documentModel.getDocumentById(documentId)
  if (!document || !document.cosKey) {
    throw new Error('文档不存在')
  }
  return cosService.getSignedUrl(document.cosKey, 3600) // 1小时有效
}

/**
 * 获取文档下载URL
 */
export async function getDocumentDownloadUrl(documentId) {
  const document = await documentModel.getDocumentById(documentId)
  if (!document || !document.cosKey) {
    throw new Error('文档不存在')
  }
  return cosService.getDownloadUrl(document.cosKey, document.originalName, 3600)
}

// 导出文档类型常量
export const DOCUMENT_TYPE = documentModel.DOCUMENT_TYPE
export const DOCUMENT_TYPE_LABELS = documentModel.DOCUMENT_TYPE_LABELS
