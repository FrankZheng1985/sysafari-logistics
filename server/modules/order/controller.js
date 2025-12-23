/**
 * 订单管理模块 - 控制器
 */

import path from 'path'
import xlsx from 'xlsx'
import { getDatabase } from '../../config/database.js'
import { success, successWithPagination, badRequest, notFound, conflict, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as financeModel from '../finance/model.js'
import { recognizeTransportDocument, checkOcrConfig } from '../ocr/tencentOcrService.js'
import { parseTransportDocument, detectTransportType } from '../ocr/documentParser.js'

// ==================== 提单文件解析 ====================

/**
 * 解析提单文件
 * 使用 OCR 模块进行文件解析，并将结果映射为前端期望的字段格式
 */
export async function parseBillFile(req, res) {
  try {
    const { transportType } = req.body
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传文件'
      })
    }
    
    const fileExt = path.extname(file.originalname).toLowerCase()
    const mimeType = file.mimetype
    
    let parsedData = null
    let ocrText = ''
    
    // 根据文件类型处理
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      // Excel文件处理
      parsedData = await parseExcelBillFile(file.buffer, transportType)
    } else if (fileExt === '.pdf' || mimeType === 'application/pdf') {
      // PDF文件处理
      const ocrResult = await recognizeTransportDocument(file.buffer, 'pdf')
      
      if (!ocrResult.success) {
        return res.status(500).json({
          errCode: 500,
          msg: ocrResult.error || 'OCR识别失败'
        })
      }
      
      ocrText = ocrResult.data.fullText || ''
      
      // 如果没有指定运输方式，自动检测
      const finalTransportType = transportType || detectTransportType(ocrText)
      parsedData = parseTransportDocument(ocrText, finalTransportType)
      
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExt)) {
      // 图片文件处理
      const ocrResult = await recognizeTransportDocument(file.buffer, 'image')
      
      if (!ocrResult.success) {
        return res.status(500).json({
          errCode: 500,
          msg: ocrResult.error || 'OCR识别失败'
        })
      }
      
      ocrText = ocrResult.data.fullText || ''
      
      // 如果没有指定运输方式，自动检测
      const finalTransportType = transportType || detectTransportType(ocrText)
      parsedData = parseTransportDocument(ocrText, finalTransportType)
      
    } else {
      return res.status(400).json({
        errCode: 400,
        msg: '不支持的文件格式，请上传 PDF、图片(JPG/PNG) 或 Excel 文件'
      })
    }
    
    // 调试日志 - 查看 OCR 解析结果
    console.log('=== OCR 解析结果 ===')
    console.log('原始解析数据:', JSON.stringify(parsedData, null, 2))
    
    // 映射字段为前端期望的格式
    const mappedData = mapOcrDataToFrontend(parsedData)
    
    console.log('映射后数据:', JSON.stringify(mappedData, null, 2))
    console.log('===================')
    
    // 返回解析结果
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        ...mappedData,
        _ocrText: ocrText,
        _fileName: file.originalname,
        _fileType: fileExt
      }
    })
    
  } catch (error) {
    console.error('解析提单文件失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '解析失败'
    })
  }
}

/**
 * 将 OCR 解析结果映射为前端期望的字段格式
 */
function mapOcrDataToFrontend(ocrData) {
  if (!ocrData) return {}
  
  return {
    // 主单号/提单号映射
    masterBillNumber: ocrData.billNumber || null,
    // 起运港映射
    origin: ocrData.portOfLoading || null,
    // 目的港映射
    destination: ocrData.portOfDischarge || null,
    // 毛重映射
    weight: ocrData.grossWeight ? String(ocrData.grossWeight) : null,
    // 件数映射
    pieces: ocrData.pieces ? String(ocrData.pieces) : null,
    // 体积映射
    volume: ocrData.volume ? String(ocrData.volume) : null,
    // 船名航次映射
    vessel: ocrData.vessel || ocrData.flightNumber || ocrData.trainNumber || null,
    // 集装箱号
    containerNumber: ocrData.containerNumber || null,
    // 船公司/航空公司
    shippingCompany: ocrData.shippingCompany || ocrData.airline || ocrData.carrier || null,
    // 运输方式
    transportType: ocrData.transportType || 'sea',
    // ETD预计离开时间（装船日期）
    estimatedDeparture: ocrData.etd || null,
    // ETA预计到港时间
    estimatedArrival: ocrData.eta || null,
    // 发货人
    shipper: ocrData.shipper || null,
    // 收货人
    consignee: ocrData.consignee || null,
    // 新增字段
    sealNumber: ocrData.sealNumber || null,      // 封签号
    containerSize: ocrData.containerSize || null, // 柜型
  }
}

/**
 * 解析Excel格式的提单文件
 */
async function parseExcelBillFile(buffer, transportType) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)
    
    if (!jsonData || jsonData.length === 0) {
      return {
        transportType: transportType || 'sea',
        error: 'Excel文件为空'
      }
    }
    
    // 取第一行数据
    const firstRow = jsonData[0]
    
    // 字段映射表
    const fieldMappings = {
      // 中文字段名
      '主单号': 'billNumber',
      '提单号': 'billNumber',
      '运单号': 'billNumber',
      '集装箱号': 'containerNumber',
      '箱号': 'containerNumber',
      '船名航次': 'vessel',
      '航班号': 'flightNumber',
      '列车号': 'trainNumber',
      '车牌号': 'vehicleNumber',
      '起运港': 'portOfLoading',
      '装货港': 'portOfLoading',
      '发货地': 'portOfLoading',
      '目的港': 'portOfDischarge',
      '卸货港': 'portOfDischarge',
      '收货地': 'portOfDischarge',
      '件数': 'pieces',
      '毛重': 'grossWeight',
      '毛重(KG)': 'grossWeight',
      '体积': 'volume',
      '体积(CBM)': 'volume',
      '发货人': 'shipper',
      '收货人': 'consignee',
      '船公司': 'shippingCompany',
      '航空公司': 'airline',
      '承运人': 'carrier',
      'ETA': 'eta',
      '预计到港': 'eta',
      // 英文字段名
      'Bill Number': 'billNumber',
      'B/L No': 'billNumber',
      'AWB': 'billNumber',
      'Container No': 'containerNumber',
      'Vessel': 'vessel',
      'Flight': 'flightNumber',
      'POL': 'portOfLoading',
      'POD': 'portOfDischarge',
      'Pieces': 'pieces',
      'Gross Weight': 'grossWeight',
      'Volume': 'volume',
      'Shipper': 'shipper',
      'Consignee': 'consignee',
    }
    
    // 映射字段
    const result = {
      transportType: transportType || 'sea'
    }
    
    for (const [excelField, modelField] of Object.entries(fieldMappings)) {
      if (firstRow[excelField] !== undefined && firstRow[excelField] !== null) {
        result[modelField] = firstRow[excelField]
      }
    }
    
    // 清理数值字段
    if (result.pieces) result.pieces = parseInt(result.pieces, 10) || null
    if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight) || null
    if (result.volume) result.volume = parseFloat(result.volume) || null
    
    return result
    
  } catch (error) {
    console.error('解析Excel文件失败:', error)
    return {
      transportType: transportType || 'sea',
      error: 'Excel解析失败: ' + error.message
    }
  }
}

/**
 * 生成下一个提单序号
 * 格式: BP + 年份后两位 + 5位序号, 如 BP2500001
 * 
 * 自动同步：如果序列号表的值小于数据库中最大的订单序号，自动同步
 */
async function generateNextBillNumber() {
  const db = getDatabase()
  
  // 获取当前年份后两位
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  
  // 先检查是否需要同步序列号
  const maxSeqResult = await db.prepare(
    "SELECT MAX(order_seq) as max_seq FROM bills_of_lading"
  ).get()
  const maxSeqInDb = maxSeqResult?.max_seq || 0
  
  const currentSeqResult = await db.prepare(
    "SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'"
  ).get()
  const currentSeq = currentSeqResult?.current_seq || 0
  
  // 如果数据库中的最大序号大于序列号表，需要同步
  if (maxSeqInDb > currentSeq) {
    await db.prepare(
      "UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = 'BILL'"
    ).run(maxSeqInDb)
    console.log(`🔄 序列号已同步: ${currentSeq} -> ${maxSeqInDb}`)
  }
  
  // 获取并递增序列号
  const row = await db.prepare(
    "SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'"
  ).get()
  
  const nextSeq = (row?.current_seq || 0) + 1
  
  // 更新序列号
  await db.prepare(
    "UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = 'BILL'"
  ).run(nextSeq)
  
  // 格式化序列号: BP + 年份后两位 + 5位序号（补零）
  const seqStr = String(nextSeq).padStart(5, '0')
  return `BP${year}${seqStr}`
}

// ==================== 提单CRUD ====================

/**
 * 获取提单列表
 * type 参数说明：
 * - schedule: 进行中的订单（未完成、未归档、未取消）
 * - history: 已完成的订单（已完成、已归档、已取消、异常关闭）
 * - draft: 草稿订单
 * - void: 已作废的订单
 */
export async function getBills(req, res) {
  try {
    const {
      type, status, shipStatus, customsStatus, inspection, deliveryStatus,
      search, page, pageSize, sortField, sortOrder, forInvoiceType, customerId
    } = req.query

    const result = await model.getBills({
      type,
      status,
      shipStatus,
      customsStatus,
      inspection,
      deliveryStatus,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      sortField,
      sortOrder,
      forInvoiceType,  // 用于新建发票时过滤已完成财务流程的订单
      customerId  // 按客户ID筛选
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取提单列表失败:', error)
    return serverError(res, '获取提单列表失败')
  }
}

/**
 * 获取单个提单
 */
export async function getBillById(req, res) {
  try {
    const bill = await model.getBillById(req.params.id)
    if (!bill) {
      return notFound(res, '提单不存在')
    }
    return success(res, bill)
  } catch (error) {
    console.error('获取提单详情失败:', error)
    return serverError(res, '获取提单详情失败')
  }
}

/**
 * 创建提单
 * 注意：billNumber（提单号）只能从提单上传OCR识别或手动填入，不自动生成
 * orderNumber（订单号）由系统自动生成，格式：BP2500001
 */
export async function createBill(req, res) {
  try {
    // 提单号从前端传入（从提单上传获取或手动填入），不自动生成
    let billNumber = req.body.billNumber || ''
    
    // 如果提供了提单号，检查是否已存在
    if (billNumber) {
      const existing = await model.getBillByNumber(billNumber)
      if (existing) {
        return conflict(res, '提单号已存在')
      }
    }

    // 检查集装箱号是否重复
    const containerNumber = req.body.containerNumber || ''
    
    if (containerNumber) {
      const duplicateBill = await model.checkDuplicateBill(containerNumber)
      if (duplicateBill) {
        return conflict(res, `提单重复：集装箱号 "${containerNumber}" 已存在（提单号: ${duplicateBill.billNumber}）`)
      }
    }

    const result = await model.createBill({
      ...req.body,
      billNumber, // 提单号：从提单上传获取或手动填入
      operator: req.user?.name || '系统',
      creator: req.user?.name || '系统'  // 创建者：当前登录用户
    })
    
    // 记录操作日志
    await model.addOperationLog({
      billId: result.id,
      operationType: 'create',
      operationName: '创建提单',
      newValue: billNumber,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order'
    })
    
    const newBill = await model.getBillById(result.id)
    return success(res, newBill, '创建成功')
  } catch (error) {
    console.error('创建提单失败:', error)
    return serverError(res, '创建提单失败')
  }
}

/**
 * 更新提单
 */
export async function updateBill(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    // 如果更新了集装箱号，检查是否与其他提单重复
    const newContainerNumber = req.body.containerNumber ?? existing.containerNumber
    
    if (newContainerNumber && req.body.containerNumber !== undefined) {
      const duplicateBill = await model.checkDuplicateBill(newContainerNumber, id)
      if (duplicateBill) {
        return conflict(res, `提单重复：集装箱号 "${newContainerNumber}" 已存在（提单号: ${duplicateBill.billNumber}）`)
      }
    }
    
    const updated = await model.updateBill(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'update',
      operationName: '更新提单',
      remark: '更新提单信息',
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order'
    })
    
    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '更新成功')
  } catch (error) {
    console.error('更新提单失败:', error)
    return serverError(res, '更新提单失败')
  }
}

/**
 * 作废提单
 */
export async function voidBill(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    if (existing.isVoid) {
      return badRequest(res, '提单已作废')
    }
    
    const voided = await model.voidBill(id, reason || '', req.user?.name || '系统')
    if (!voided) {
      return serverError(res, '作废失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'void',
      operationName: '作废提单',
      oldValue: '正常',
      newValue: '已作废',
      remark: reason,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order'
    })
    
    return success(res, null, '作废成功')
  } catch (error) {
    console.error('作废提单失败:', error)
    return serverError(res, '作废提单失败')
  }
}

/**
 * 恢复提单
 */
export async function restoreBill(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    if (!existing.isVoid) {
      return badRequest(res, '提单未作废，无需恢复')
    }
    
    const restored = await model.restoreBill(id)
    if (!restored) {
      return serverError(res, '恢复失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'restore',
      operationName: '恢复提单',
      oldValue: '已作废',
      newValue: '正常',
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order'
    })
    
    return success(res, null, '恢复成功')
  } catch (error) {
    console.error('恢复提单失败:', error)
    return serverError(res, '恢复提单失败')
  }
}

/**
 * 删除提单
 */
export async function deleteBill(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const deleted = await model.deleteBill(id)
    if (!deleted) {
      return serverError(res, '删除失败')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除提单失败:', error)
    return serverError(res, '删除提单失败')
  }
}

// ==================== 状态更新 ====================

/**
 * 更新船运状态
 */
export async function updateShipStatus(req, res) {
  try {
    const { id } = req.params
    const { shipStatus, actualArrivalDate } = req.body
    
    if (!shipStatus) {
      return badRequest(res, '船运状态为必填项')
    }
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const oldStatus = existing.shipStatus
    const updated = await model.updateBillShipStatus(id, shipStatus, actualArrivalDate)
    
    if (!updated) {
      return serverError(res, '更新失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'status_change',
      operationName: '更新船运状态',
      oldValue: oldStatus,
      newValue: shipStatus,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order'
    })
    
    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '更新成功')
  } catch (error) {
    console.error('更新船运状态失败:', error)
    return serverError(res, '更新船运状态失败')
  }
}

/**
 * 更新换单状态
 */
export async function updateDocSwapStatus(req, res) {
  try {
    const { id } = req.params
    const { docSwapStatus, docSwapAgent, docSwapFee } = req.body
    
    if (!docSwapStatus) {
      return badRequest(res, '换单状态为必填项')
    }
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const oldStatus = existing.docSwapStatus
    const updated = await model.updateBillDocSwapStatus(id, docSwapStatus, docSwapAgent, docSwapFee)
    
    if (!updated) {
      return serverError(res, '更新失败')
    }
    
    // 构建操作日志备注
    let remark = ''
    if (docSwapStatus === '已换单' && docSwapAgent) {
      remark = `代理商: ${docSwapAgent}`
      if (docSwapFee !== undefined && docSwapFee !== null) {
        remark += `, 换单费: €${docSwapFee}`
      }
    }
    
    // 如果是换单完成且有换单费，自动创建一笔应付费用
    if (docSwapStatus === '已换单' && docSwapFee && parseFloat(docSwapFee) > 0) {
      try {
        await financeModel.createFee({
          billId: id,
          billNumber: existing.billNumber,
          customerId: existing.customerId,
          customerName: existing.customerName,
          supplierName: docSwapAgent,
          feeType: 'payable',  // 应付费用
          category: 'handling',  // 操作费类别
          feeName: '换单费',
          amount: parseFloat(docSwapFee),
          currency: 'EUR',
          exchangeRate: 1,
          feeDate: new Date().toISOString().split('T')[0],
          description: `换单代理: ${docSwapAgent}`,
          notes: '系统自动创建',
          createdBy: req.user?.id
        })
        console.log(`✅ 已为提单 ${existing.billNumber} 自动创建换单费 €${docSwapFee}`)
      } catch (feeError) {
        console.error('创建换单费用失败:', feeError)
        // 费用创建失败不影响换单状态更新
      }
    }
    
    // 如果是取消换单，删除之前自动创建的换单费
    if (docSwapStatus === '未换单' && oldStatus === '已换单') {
      try {
        const deletedCount = await financeModel.deleteFeeByCondition(id, {
          feeName: '换单费',
          notes: '系统自动创建'
        })
        if (deletedCount > 0) {
          console.log(`✅ 已删除提单 ${existing.billNumber} 的换单费 (${deletedCount}笔)`)
          remark += deletedCount > 0 ? `，已撤销换单费 ${deletedCount} 笔` : ''
        }
      } catch (feeError) {
        console.error('删除换单费用失败:', feeError)
        // 费用删除失败不影响状态更新，但记录日志
      }
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'doc_swap',
      operationName: docSwapStatus === '已换单' ? '换单完成' : '取消换单',
      oldValue: oldStatus || '未换单',
      newValue: docSwapStatus,
      remark: remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'doc_swap'
    })
    
    return success(res, null, '换单状态更新成功')
  } catch (error) {
    console.error('更新换单状态失败:', error)
    return serverError(res, '更新换单状态失败')
  }
}

/**
 * 更新清关状态
 */
export async function updateCustomsStatus(req, res) {
  try {
    const { id } = req.params
    const { customsStatus } = req.body
    
    if (!customsStatus) {
      return badRequest(res, '清关状态为必填项')
    }
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const oldStatus = existing.customsStatus
    const updated = await model.updateBillCustomsStatus(id, customsStatus)
    
    if (!updated) {
      return serverError(res, '更新失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'status_change',
      operationName: '更新清关状态',
      oldValue: oldStatus,
      newValue: customsStatus,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'customs'
    })
    
    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '更新成功')
  } catch (error) {
    console.error('更新清关状态失败:', error)
    return serverError(res, '更新清关状态失败')
  }
}

/**
 * 更新查验状态
 */
export async function updateInspection(req, res) {
  try {
    const { id } = req.params
    const { inspection, ...rest } = req.body
    
    if (!inspection) {
      return badRequest(res, '查验状态为必填项')
    }
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const oldStatus = existing.inspection
    const updated = await model.updateBillInspection(id, { inspection, ...rest })
    
    if (!updated) {
      return serverError(res, '更新失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'status_change',
      operationName: '更新查验状态',
      oldValue: oldStatus,
      newValue: inspection,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'inspection'
    })
    
    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '更新成功')
  } catch (error) {
    console.error('更新查验状态失败:', error)
    return serverError(res, '更新查验状态失败')
  }
}

/**
 * 更新派送状态
 */
export async function updateDelivery(req, res) {
  try {
    const { id } = req.params
    const { deliveryStatus, ...rest } = req.body
    
    if (!deliveryStatus) {
      return badRequest(res, '派送状态为必填项')
    }
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const oldStatus = existing.deliveryStatus
    const updated = await model.updateBillDelivery(id, { deliveryStatus, ...rest })
    
    if (!updated) {
      return serverError(res, '更新失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'status_change',
      operationName: '更新派送状态',
      oldValue: oldStatus,
      newValue: deliveryStatus,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'delivery'
    })
    
    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '更新成功')
  } catch (error) {
    console.error('更新派送状态失败:', error)
    return serverError(res, '更新派送状态失败')
  }
}

/**
 * 标记提单为已完成
 * 将订单状态标记为"已完成"，完成后不可更改
 */
export async function markBillComplete(req, res) {
  try {
    const { id } = req.params
    const { completeNote } = req.body

    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }

    // 检查是否已经完成
    if (existing.status === '已完成') {
      return badRequest(res, '该提单已经标记为完成')
    }

    const oldStatus = existing.status
    
    // 更新状态为已完成
    const updated = await model.updateBill(id, {
      status: '已完成',
      completeNote: completeNote || null,
      completeTime: new Date().toISOString()
    })

    if (!updated) {
      return serverError(res, '标记失败')
    }

    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'status_change',
      operationName: '标记已完成',
      oldValue: oldStatus,
      newValue: '已完成',
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'order',
      remark: completeNote || ''
    })

    const updatedBill = await model.getBillById(id)
    return success(res, updatedBill, '标记成功')
  } catch (error) {
    console.error('标记完成失败:', error)
    return serverError(res, '标记完成失败')
  }
}

// ==================== 操作日志 ====================

/**
 * 获取操作日志
 */
export async function getOperationLogs(req, res) {
  try {
    const { id } = req.params
    const { module } = req.query
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const logs = await model.getOperationLogs(id, module)
    return success(res, logs)
  } catch (error) {
    console.error('获取操作日志失败:', error)
    return serverError(res, '获取操作日志失败')
  }
}

// ==================== 文件管理 ====================

/**
 * 获取提单文件列表
 */
export async function getBillFiles(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const files = await model.getBillFiles(id)
    return success(res, files)
  } catch (error) {
    console.error('获取文件列表失败:', error)
    return serverError(res, '获取文件列表失败')
  }
}

/**
 * 删除提单文件
 */
export async function deleteBillFile(req, res) {
  try {
    const { id, fileId } = req.params
    
    const file = await model.getBillFileById(fileId)
    if (!file) {
      return notFound(res, '文件不存在')
    }
    
    if (file.billId !== id) {
      return badRequest(res, '文件不属于此提单')
    }
    
    const deleted = await model.deleteBillFile(fileId)
    if (!deleted) {
      return serverError(res, '删除失败')
    }
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'file_delete',
      operationName: '删除文件',
      oldValue: file.fileName,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id,
      module: 'file'
    })
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除文件失败:', error)
    return serverError(res, '删除文件失败')
  }
}

// ==================== 统计和列表 ====================

/**
 * 获取提单统计
 */
export async function getBillStats(req, res) {
  try {
    const stats = await model.getBillStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return serverError(res, '获取统计数据失败')
  }
}

/**
 * 获取CMR管理列表
 */
export async function getCMRList(req, res) {
  try {
    const { type = 'undelivered', search, page, pageSize } = req.query
    
    const result = await model.getCMRList(type, {
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    // 获取各状态统计
    const db = getDatabase()
    const stats = db.prepare(`
      SELECT 
        SUM(CASE WHEN ship_status = '已到港' 
                 AND customs_status = '已放行' 
                 AND (inspection = '-' OR inspection = '已放行')
                 AND delivery_status = '待派送' 
                 AND is_void = 0 THEN 1 ELSE 0 END) as undelivered,
        SUM(CASE WHEN delivery_status = '派送中' AND is_void = 0 THEN 1 ELSE 0 END) as delivering,
        SUM(CASE WHEN delivery_status = '已送达' AND is_void = 0 THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN (delivery_status = '订单异常' OR delivery_status = '异常关闭') AND is_void = 0 THEN 1 ELSE 0 END) as exception
      FROM bills_of_lading
    `).get()
    
    return success(res, {
      ...result,
      stats
    })
  } catch (error) {
    console.error('获取CMR列表失败:', error)
    return serverError(res, '获取CMR列表失败')
  }
}

/**
 * 获取查验管理列表
 */
export async function getInspectionList(req, res) {
  try {
    const { type = 'pending', search, page, pageSize } = req.query
    
    const result = await model.getInspectionList(type, {
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    // 获取各状态统计（遵循订单流转规则）
    const db = getDatabase()
    const statsResult = await db.prepare(`
      SELECT 
        SUM(CASE WHEN inspection IN ('待查验', '查验中', '已查验', '查验放行') 
            AND (is_void = 0 OR is_void IS NULL) 
            AND status != '草稿'
            AND (delivery_status IS NULL OR delivery_status NOT IN ('已送达', '已完成'))
            THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN inspection = '已放行' 
            AND (is_void = 0 OR is_void IS NULL) 
            AND status != '草稿'
            THEN 1 ELSE 0 END) as released
      FROM bills_of_lading
    `).get()
    
    return success(res, {
      ...result,
      stats: {
        pending: parseInt(statsResult?.pending) || 0,
        released: parseInt(statsResult?.released) || 0
      }
    })
  } catch (error) {
    console.error('获取查验列表失败:', error)
    return serverError(res, '获取查验列表失败')
  }
}

// ==================== 作废申请相关 ====================

/**
 * 检查提单是否有操作记录或费用
 */
export async function checkBillOperations(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    const result = await model.checkBillHasOperations(id)
    return success(res, result)
  } catch (error) {
    console.error('检查提单操作记录失败:', error)
    return serverError(res, '检查失败')
  }
}

/**
 * 提交作废申请
 */
export async function submitVoidApplication(req, res) {
  try {
    const { id } = req.params
    const { reason, fees } = req.body
    
    const existing = await model.getBillById(id)
    if (!existing) {
      return notFound(res, '提单不存在')
    }
    
    if (existing.isVoid) {
      return badRequest(res, '提单已作废')
    }
    
    // 创建作废申请
    const applicationId = await model.createVoidApplication({
      billId: id,
      reason,
      applicantId: req.user?.id || 'admin',
      applicantName: req.user?.name || 'Admin',
      feesJson: fees ? JSON.stringify(fees) : null
    })
    
    // 记录操作日志
    await model.addOperationLog({
      billId: id,
      operationType: 'void_apply',
      operationName: '提交作废申请',
      oldValue: '有效',
      newValue: '待审批',
      remark: reason,
      operator: req.user?.name || 'admin',
      operatorId: req.user?.id || 'admin'
    })
    
    return success(res, { applicationId }, '作废申请已提交，等待审批')
  } catch (error) {
    console.error('提交作废申请失败:', error)
    return serverError(res, '提交失败')
  }
}

/**
 * 获取待审批列表
 */
export async function getVoidApplications(req, res) {
  try {
    const { status, userId } = req.query
    
    const applications = await model.getVoidApplications({ status, userId })
    return success(res, applications)
  } catch (error) {
    console.error('获取作废申请列表失败:', error)
    return serverError(res, '获取失败')
  }
}

/**
 * 获取作废申请详情
 */
export async function getVoidApplicationDetail(req, res) {
  try {
    const { id } = req.params
    
    const application = await model.getVoidApplicationById(id)
    if (!application) {
      return notFound(res, '申请不存在')
    }
    
    return success(res, application)
  } catch (error) {
    console.error('获取作废申请详情失败:', error)
    return serverError(res, '获取失败')
  }
}

/**
 * 审批通过
 */
export async function approveVoidApplication(req, res) {
  try {
    const { id } = req.params
    const { comment } = req.body
    
    const result = await model.approveVoidApplication(
      id,
      req.user?.id || 'admin',
      req.user?.name || 'Admin',
      comment
    )
    
    if (!result.success) {
      return badRequest(res, result.message)
    }
    
    return success(res, { nextStatus: result.nextStatus }, result.message)
  } catch (error) {
    console.error('审批失败:', error)
    return serverError(res, '审批失败')
  }
}

/**
 * 审批拒绝
 */
export async function rejectVoidApplication(req, res) {
  try {
    const { id } = req.params
    const { comment } = req.body
    
    if (!comment) {
      return badRequest(res, '请填写拒绝原因')
    }
    
    const result = await model.rejectVoidApplication(
      id,
      req.user?.id || 'admin',
      req.user?.name || 'Admin',
      comment
    )
    
    if (!result.success) {
      return badRequest(res, result.message)
    }
    
    return success(res, null, result.message)
  } catch (error) {
    console.error('拒绝失败:', error)
    return serverError(res, '拒绝失败')
  }
}

// ==================== 系统配置相关 ====================

/**
 * 获取所有系统配置
 */
export async function getSystemConfigs(req, res) {
  try {
    const configs = await model.getAllSystemConfigs()
    return success(res, configs)
  } catch (error) {
    console.error('获取系统配置失败:', error)
    return serverError(res, '获取失败')
  }
}

/**
 * 更新系统配置
 */
export async function updateSystemConfig(req, res) {
  try {
    const { key, value, description } = req.body
    
    if (!key) {
      return badRequest(res, '配置键不能为空')
    }
    
    await model.setSystemConfig(key, value, description)
    return success(res, null, '配置已更新')
  } catch (error) {
    console.error('更新系统配置失败:', error)
    return serverError(res, '更新失败')
  }
}

