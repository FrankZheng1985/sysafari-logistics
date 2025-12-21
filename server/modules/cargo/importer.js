/**
 * 货物导入服务
 * 处理Excel/CSV文件解析和数据导入
 */

import { getDatabase, generateId } from '../../config/database.js'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 图片上传目录
const UPLOAD_DIR = path.join(__dirname, '../../uploads/cargo-images')

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// 模板字段映射 - 根据客户Excel模板
const FIELD_MAPPING = {
  // 基本信息
  '柜号*': 'containerNo',
  '柜号': 'containerNo',
  '序列号*': 'serialNo',
  '序列号': 'serialNo',
  '箱产品号*': 'productCode',
  '箱产品号': 'productCode',
  '托盘件数*': 'palletCount',
  '托盘件数': 'palletCount',
  '提头*': 'referenceNo',
  '提头': 'referenceNo',
  '唛头*': 'referenceNo',
  '唛头': 'referenceNo',
  '客户单号*': 'customerOrderNo',
  '客户单号': 'customerOrderNo',
  
  // 商品信息
  '英文商品品名*': 'productNameEn',
  '英文商品品名': 'productNameEn',
  '英文品名': 'productNameEn',
  '原产国': 'originCountry',
  '进口国': 'importCountry',
  'HS CODE海关编码*': 'customerHsCode',
  'HS CODE海关编码': 'customerHsCode',
  'HS编码': 'customerHsCode',
  
  // 数量信息
  '商品箱数 CTNS*': 'cartonCount',
  '商品箱数CTNS*': 'cartonCount',
  '商品箱数': 'cartonCount',
  '商品件数 PCS*': 'quantity',
  '商品件数PCS*': 'quantity',
  '商品件数': 'quantity',
  '商品总件数PCS*': 'quantity',
  '商品总件数 PCS*': 'quantity',
  '商品总件数': 'quantity',
  '数量': 'quantity',
  '件数': 'quantity',
  'PCS': 'quantity',
  
  // 价格信息
  '商品申报单价*': 'unitPrice',
  '商品申报单价': 'unitPrice',
  '单价': 'unitPrice',
  '申报单价': 'unitPrice',
  '商品申报总价*': 'totalValue',
  '商品申报总价': 'totalValue',
  '申报总价*': 'totalValue',
  '申报总价': 'totalValue',
  '货值': 'totalValue',
  '总价': 'totalValue',
  '金额': 'totalValue',
  
  // 重量信息
  '商品毛重*': 'grossWeight',
  '商品毛重': 'grossWeight',
  '毛重': 'grossWeight',
  '商品净重*': 'netWeight',
  '商品净重': 'netWeight',
  '净重': 'netWeight',
  
  // 品名和材质
  '中文品名*': 'productName',
  '中文品名': 'productName',
  '商品名称': 'productName',
  '产品图片*': 'productImage',
  '产品图片': 'productImage',
  '图片': 'productImage',
  '中文材质*': 'material',
  '中文材质': 'material',
  '材质': 'material',
  '英文材质*': 'materialEn',
  '英文材质': 'materialEn',
  
  // 其他信息
  '装柜位置': 'loadingPosition',
  '税率': 'dutyRate',
  '预估关税': 'estimatedDuty',
  
  // 兼容旧字段
  '提单号': 'billNumber',
  '提单号*': 'billNumber',
  'BL号': 'billNumber',
  'BL NO': 'billNumber',
  '客户': 'customerName',
  '客户名称': 'customerName',
  '客户*': 'customerName',
  '收货人': 'customerName',
  '单位': 'unit'
}

// 图片列名列表（用于识别图片列）
const IMAGE_COLUMN_NAMES = ['产品图片*', '产品图片', '图片']

/**
 * 生成导入批次号
 */
export function generateImportNo() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `IMP${year}${month}${day}${random}`
}

/**
 * 解析CSV文件内容
 */
export function parseCSVContent(content) {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    })
    return records
  } catch (error) {
    console.error('CSV解析失败:', error)
    throw new Error('CSV文件格式错误: ' + error.message)
  }
}

/**
 * 解析Excel文件（包含图片）
 * @param {string} filePath - 文件路径
 * @returns {Promise<Array>} 解析后的记录数组
 */
export async function parseExcelFile(filePath) {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    
    // 获取第一个工作表（使用worksheets数组更可靠）
    let worksheet = null
    if (workbook.worksheets && workbook.worksheets.length > 0) {
      worksheet = workbook.worksheets[0]
    }
    
    // 如果还是没有，尝试用索引1获取
    if (!worksheet) {
      worksheet = workbook.getWorksheet(1)
    }
    
    if (!worksheet) {
      // 打印调试信息
      console.error('工作表获取失败，workbook信息:', {
        worksheetsCount: workbook.worksheets?.length,
        sheetNames: workbook.worksheets?.map(ws => ws?.name)
      })
      throw new Error('Excel文件中没有工作表')
    }
    
    console.log(`正在解析工作表: ${worksheet.name}, 行数: ${worksheet.rowCount}`)
    
    // 获取所有行数据
    const rows = []
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // 获取单元格值
        let value = cell.value
        if (value && typeof value === 'object') {
          // 处理富文本或其他复杂类型
          if (value.richText) {
            value = value.richText.map(rt => rt.text).join('')
          } else if (value.text) {
            value = value.text
          } else if (value.result !== undefined) {
            value = value.result
          }
        }
        rowData[colNumber - 1] = value !== null && value !== undefined ? String(value).trim() : ''
      })
      rows.push({ rowNumber, data: rowData })
    })
    
    if (rows.length < 2) {
      throw new Error('Excel文件内容为空或只有标题行')
    }
    
    // ========== 读取顶部的柜号和总体积信息 ==========
    let globalContainerNo = ''
    let globalVolume = ''
    
    // 检查前几行是否包含柜号信息（格式：柜号* | OOCU9301500 | ... | 总体积* | 68）
    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      const rowData = rows[i].data
      for (let j = 0; j < rowData.length - 1; j++) {
        const cellValue = String(rowData[j] || '').trim()
        const nextValue = String(rowData[j + 1] || '').trim()
        
        // 查找柜号
        if ((cellValue === '柜号*' || cellValue === '柜号') && nextValue && !nextValue.includes('*')) {
          globalContainerNo = nextValue
          console.log(`从顶部读取到柜号: ${globalContainerNo}`)
        }
        // 查找总体积
        if ((cellValue === '总体积*' || cellValue === '总体积' || cellValue === '总立方*' || cellValue === '总立方') && nextValue) {
          globalVolume = nextValue
          console.log(`从顶部读取到总体积: ${globalVolume}`)
        }
      }
    }
    
    // ========== 智能查找标题行 ==========
    let headerRowIndex = 0
    const keyColumns = ['英文商品品名', '中文品名', 'HS CODE', '商品箱数', '商品件数', '商品申报']
    
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const rowStr = rows[i].data.join(' ')
      const matchCount = keyColumns.filter(key => rowStr.includes(key)).length
      if (matchCount >= 2) {
        headerRowIndex = i
        console.log(`找到标题行: 第${rows[i].rowNumber}行, 匹配${matchCount}个关键字`)
        break
      }
    }
    
    // 获取标题行
    const headerRow = rows[headerRowIndex].data
    const headers = headerRow.map(h => String(h || '').trim())
    
    console.log('识别到的所有列标题:', headers.join(' | '))
    console.log('列数:', headers.length)
    
    // 查找图片列的索引
    let imageColumnIndex = -1
    headers.forEach((header, index) => {
      if (IMAGE_COLUMN_NAMES.includes(header)) {
        imageColumnIndex = index
      }
    })
    
    // 提取图片信息 - 创建行号到图片的映射
    const rowImages = {}
    const images = worksheet.getImages()
    
    console.log(`工作表中找到 ${images.length} 张图片`)
    
    // 生成批次ID用于图片命名
    const batchId = Date.now().toString(36)
    
    // 也检查 workbook.media
    const mediaCount = workbook.model?.media?.length || 0
    console.log(`Workbook media 数量: ${mediaCount}`)
    
    for (let idx = 0; idx < images.length; idx++) {
      const image = images[idx]
      try {
        // 打印图片信息用于调试
        if (idx < 3) {
          console.log(`图片${idx}:`, JSON.stringify({
            imageId: image.imageId,
            range: image.range,
            tl: image.range?.tl
          }))
        }
        
        // 获取图片所在的行（基于图片的锚点位置）
        const imageRow = image.range?.tl?.nativeRow !== undefined 
          ? image.range.tl.nativeRow + 1  // 转换为1-based行号
          : null
        
        if (imageRow && imageRow > 1) { // 跳过标题行
          const imageId = image.imageId
          const imageData = workbook.model.media.find(m => m.index === imageId)
          
          if (imageData && imageData.buffer) {
            // 确定图片扩展名
            const ext = imageData.extension || 'png'
            const fileName = `${batchId}_row${imageRow}_${Date.now()}.${ext}`
            const imagePath = path.join(UPLOAD_DIR, fileName)
            
            // 保存图片文件
            fs.writeFileSync(imagePath, imageData.buffer)
            
            // 存储图片路径（可能一行有多个图片，这里取第一个）
            if (!rowImages[imageRow]) {
              rowImages[imageRow] = `/uploads/cargo-images/${fileName}`
            }
          }
        }
      } catch (imgErr) {
        console.warn('处理图片时出错:', imgErr.message)
      }
    }
    
    console.log(`成功提取 ${Object.keys(rowImages).length} 张图片`)
    
    // 转换为对象数组（从标题行之后开始）
    const dataRecords = []
    const headerActualRow = rows[headerRowIndex].rowNumber
    
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const rowData = row.data
      const rowNumber = row.rowNumber
      
      // 跳过完全空白的行
      if (!rowData || rowData.every(cell => cell === '' || cell === null || cell === undefined)) {
        continue
      }
      
      // 跳过合计行的多种检测方式
      const rowStr = rowData.join('').toLowerCase()
      
      // 1. 包含"合计"或"total"关键字
      if (rowStr.includes('合计') || rowStr.includes('total')) {
        console.log(`跳过合计行(关键字): 第${rowNumber}行`)
        continue
      }
      
      // 2. 检测最后一行特征：品名为"-"但有数值数据
      // 找到中文品名和英文品名的列索引
      const productNameIndex = headers.findIndex(h => h.includes('中文品名'))
      const productNameEnIndex = headers.findIndex(h => h.includes('英文商品品名') || h.includes('英文品名'))
      
      const productName = productNameIndex >= 0 ? (rowData[productNameIndex] || '').trim() : ''
      const productNameEn = productNameEnIndex >= 0 ? (rowData[productNameEnIndex] || '').trim() : ''
      
      // 如果中文品名和英文品名都是"-"或空，跳过该行
      if ((productName === '-' || productName === '') && (productNameEn === '-' || productNameEn === '')) {
        console.log(`跳过合计行(无品名): 第${rowNumber}行`)
        continue
      }
      
      const record = {}
      headers.forEach((header, index) => {
        if (header) {
          record[header] = rowData[index] !== undefined ? String(rowData[index]).trim() : ''
        }
      })
      
      // 应用全局柜号（如果记录中没有柜号）
      if (globalContainerNo && (!record['柜号*'] && !record['柜号'])) {
        record['柜号*'] = globalContainerNo
      }
      
      // 添加图片路径
      if (rowImages[rowNumber]) {
        record['productImage'] = rowImages[rowNumber]
      }
      
      // 记录原始行号
      record['_rowNumber'] = rowNumber
      
      dataRecords.push(record)
    }
    
    console.log(`Excel解析完成: ${dataRecords.length}条数据, ${Object.keys(rowImages).length}张图片, 标题行: ${headerActualRow}, 柜号: ${globalContainerNo}`)
    
    // 返回带有元数据的结果
    return {
      records: dataRecords,
      metadata: {
        containerNo: globalContainerNo,
        totalVolume: globalVolume
      }
    }
  } catch (error) {
    console.error('Excel解析失败:', error)
    throw new Error('Excel文件格式错误: ' + error.message)
  }
}

/**
 * 根据文件路径获取文件类型
 * @param {string} filePath - 文件路径
 * @returns {string} 文件类型 'csv' | 'excel'
 */
export function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.csv') {
    return 'csv'
  } else if (ext === '.xlsx' || ext === '.xls') {
    return 'excel'
  }
  return 'unknown'
}

/**
 * 映射字段名
 */
export function mapFieldNames(record, debug = false) {
  const mapped = {}
  const unmappedKeys = []
  
  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = key.trim()
    const fieldName = FIELD_MAPPING[trimmedKey]
    if (fieldName) {
      mapped[fieldName] = value
    } else if (trimmedKey === 'productImage') {
      // 直接保留已提取的图片路径
      mapped.productImage = value
    } else if (trimmedKey && trimmedKey !== '_rowNumber') {
      unmappedKeys.push(trimmedKey)
    }
  }
  
  // 只在第一条记录时打印未映射的字段
  if (debug && unmappedKeys.length > 0) {
    console.log('未映射的列名:', unmappedKeys.join(', '))
  }
  
  return mapped
}

/**
 * 校验单条数据 - 根据客户Excel模板格式
 * 注意：柜号可能是合并单元格，所以不作为必填项
 */
export function validateItem(item, rowNo) {
  const errors = []

  // 中文品名或英文品名至少一个必填
  const hasProductName = item.productName && item.productName.trim()
  const hasProductNameEn = item.productNameEn && item.productNameEn.trim()
  if (!hasProductName && !hasProductNameEn) {
    errors.push('中文品名或英文品名至少填写一个')
  }
  
  // 数量校验（箱数或件数至少一个大于0）
  const quantity = parseFloat(item.quantity) || 0
  const cartonCount = parseFloat(item.cartonCount) || 0
  // 放宽验证：只要有品名就允许导入
  // if (quantity <= 0 && cartonCount <= 0) {
  //   errors.push('商品件数或箱数必须大于0')
  // }
  
  // 单价和总价校验（放宽：允许为0）
  const unitPrice = parseFloat(item.unitPrice) || 0
  const totalValue = parseFloat(item.totalValue) || 0
  
  // 毛重（放宽：允许为0）
  const grossWeight = parseFloat(item.grossWeight) || 0

  // 计算总价（如果没有提供）
  const calculatedTotalValue = totalValue > 0 ? totalValue : (quantity * unitPrice)

  return {
    rowNo,
    // 基本信息
    containerNo: item.containerNo?.trim() || '',
    serialNo: item.serialNo?.trim() || '',
    productCode: item.productCode?.trim() || '',
    palletCount: parseFloat(item.palletCount) || 0,
    referenceNo: item.referenceNo?.trim() || '',
    
    // 商品信息
    productName: item.productName?.trim() || '',
    productNameEn: item.productNameEn?.trim() || '',
    hsCode: item.customerHsCode?.trim() || '',
    originCountry: item.originCountry?.trim() || '中国',
    importCountry: item.importCountry?.trim() || '德国',
    
    // 数量信息
    cartonCount: cartonCount,
    quantity: quantity > 0 ? quantity : cartonCount,
    unit: item.unit?.trim() || 'PCS',
    
    // 价格信息
    unitPrice: unitPrice,
    totalValue: calculatedTotalValue,
    
    // 重量信息
    grossWeight: grossWeight,
    netWeight: parseFloat(item.netWeight) || 0,
    
    // 材质信息
    material: item.material?.trim() || '',
    materialEn: item.materialEn?.trim() || '',
    
    // 图片信息
    productImage: item.productImage || '',
    
    // 其他信息
    loadingPosition: item.loadingPosition?.trim() || '',
    dutyRate: parseFloat(item.dutyRate) || 0,
    estimatedDuty: parseFloat(item.estimatedDuty) || 0,
    
    // 兼容旧字段
    billNumber: item.billNumber?.trim() || '',
    customerName: item.customerName?.trim() || '',

    // 错误信息
    error: errors.length > 0 ? errors.join('; ') : null
  }
}

/**
 * 解析并预览文件数据
 * @param {string} fileContentOrPath - CSV内容字符串或文件路径
 * @param {string} fileType - 文件类型 'csv' | 'excel'
 * @param {boolean} isFilePath - 是否为文件路径（用于Excel解析）
 */
export async function parseAndPreview(fileContentOrPath, fileType, isFilePath = false) {
  const items = []
  let records = []
  let metadata = {}
  
  if (fileType === 'csv') {
    // CSV 格式：直接解析内容字符串
    records = parseCSVContent(fileContentOrPath)
  } else if (fileType === 'excel') {
    // Excel 格式：需要文件路径（异步处理，包含图片）
    if (!isFilePath) {
      throw new Error('Excel文件解析需要提供文件路径')
    }
    const result = await parseExcelFile(fileContentOrPath)
    records = result.records
    metadata = result.metadata
  } else {
    throw new Error(`不支持的文件格式: ${fileType}`)
  }
  
  // 处理解析后的记录
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const mapped = mapFieldNames(record, i === 0) // 第一条记录打印调试信息
    
    // 第一条记录打印原始数据
    if (i === 0) {
      console.log('第一条原始记录字段:', Object.keys(record).join(', '))
      console.log('第一条映射后字段:', Object.keys(mapped).join(', '))
    }
    
    // 应用全局柜号（如果元数据中有）
    if (metadata.containerNo && !mapped.containerNo) {
      mapped.containerNo = metadata.containerNo
    }
    
    // 保留图片路径（如果有）
    if (record.productImage) {
      mapped.productImage = record.productImage
    }
    
    const validated = validateItem(mapped, i + 1)
    items.push(validated)
  }
  
  return {
    items,
    metadata, // 包含柜号和总体积
    totalCount: items.length,
    validCount: items.filter(i => !i.error).length,
    errorCount: items.filter(i => i.error).length
  }
}

/**
 * 创建货物导入批次
 */
export async function createImportBatch(data) {
  const db = getDatabase()
  const importNo = generateImportNo()
  const now = new Date().toISOString()

  const result = await db.prepare(`
    INSERT INTO cargo_imports (
      import_no, order_id, order_no, customer_id, customer_name, container_no, bill_number,
      origin_country_code, total_items, status, import_file_name, import_file_path,
      shipper_name, shipper_address, shipper_contact,
      importer_customer_id, importer_name, importer_tax_id, importer_tax_number,
      importer_tax_type, importer_country, importer_company_name, importer_address,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    importNo,
    data.orderId || null, // 关联的提单ID
    data.orderNo || null, // 关联的提单号
    data.customerId || null,
    data.customerName || null,
    data.containerNo || null,
    data.billNumber || null,
    data.originCountryCode || null,
    data.totalItems || 0,
    'pending',
    data.fileName || null,
    data.filePath || null,
    // 发货方信息
    data.shipperName || null,
    data.shipperAddress || null,
    data.shipperContact || null,
    // 进口商信息
    data.importerCustomerId || null,
    data.importerName || null,
    data.importerTaxId || null,
    data.importerTaxNumber || null,
    data.importerTaxType || null,
    data.importerCountry || null,
    data.importerCompanyName || null,
    data.importerAddress || null,
    data.createdBy || null,
    now,
    now
  )

  return { id: result.id, importNo }
}

/**
 * 批量插入货物明细
 */
export async function insertCargoItems(importId, items) {
  const db = getDatabase()
  const now = new Date().toISOString()
  let insertedCount = 0
  let skippedCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    
    // 跳过有错误的数据
    if (item.error) {
      skippedCount++
      continue
    }

    await db.prepare(`
      INSERT INTO cargo_items (
        import_id, item_no, product_name, product_name_en, customer_hs_code,
        quantity, unit_code, unit_name, unit_price, total_value,
        gross_weight, net_weight, origin_country, material,
        product_image, match_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      importId,
      item.rowNo || (i + 1),
      item.productName,
      item.productNameEn || null,
      item.hsCode || null,
      item.quantity,
      item.unit,
      item.unit,
      item.unitPrice,
      item.totalValue,
      item.grossWeight,
      item.netWeight || null,
      item.originCountry,
      item.material || null,
      item.productImage || null,
      'pending',
      now
    )
    insertedCount++
  }

  // 更新导入批次的商品总数
  await db.prepare(`
    UPDATE cargo_imports 
    SET total_items = ?, updated_at = ?
    WHERE id = ?
  `).run(insertedCount, now, importId)

  return { insertedCount, skippedCount }
}

/**
 * 获取导入批次列表
 */
export async function getImportList(params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20, status, customerName, containerNo } = params

  let whereClause = 'WHERE 1=1'
  const queryParams = []

  if (status) {
    whereClause += ' AND status = ?'
    queryParams.push(status)
  }
  if (customerName) {
    whereClause += ' AND customer_name ILIKE ?'
    queryParams.push(`%${customerName}%`)
  }
  if (containerNo) {
    whereClause += ' AND container_no ILIKE ?'
    queryParams.push(`%${containerNo}%`)
  }

  // 获取总数
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM cargo_imports ${whereClause}`
  ).get(...queryParams)
  const total = parseInt(countResult?.total) || 0

  // 分页查询
  const offset = (page - 1) * pageSize
  const listParams = [...queryParams, pageSize, offset]
  
  const rows = await db.prepare(`
    SELECT * FROM cargo_imports 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...listParams)

  return {
    list: (rows || []).map(row => ({
      id: row.id,
      importNo: row.import_no,
      orderId: row.order_id, // 关联的提单ID
      orderNo: row.order_no, // 关联的提单号
      customerId: row.customer_id,
      customerName: row.customer_name,
      containerNo: row.container_no,
      billNumber: row.bill_number,
      totalItems: row.total_items,
      matchedItems: row.matched_items,
      pendingItems: row.pending_items,
      status: row.status,
      importFileName: row.import_file_name,
      // 发货方信息
      shipperName: row.shipper_name,
      shipperAddress: row.shipper_address,
      shipperContact: row.shipper_contact,
      // 进口商信息
      importerCustomerId: row.importer_customer_id,
      importerName: row.importer_name,
      importerTaxId: row.importer_tax_id,
      importerTaxNumber: row.importer_tax_number,
      importerTaxType: row.importer_tax_type,
      importerCountry: row.importer_country,
      importerCompanyName: row.importer_company_name,
      importerAddress: row.importer_address,
      createdAt: row.created_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 获取导入批次详情
 */
export async function getImportById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM cargo_imports WHERE id = ?').get(id)
  
  if (!row) return null

  return {
    id: row.id,
    importNo: row.import_no,
    orderId: row.order_id, // 关联的提单ID
    orderNo: row.order_no, // 关联的提单号
    customerId: row.customer_id,
    customerName: row.customer_name,
    containerNo: row.container_no,
    billNumber: row.bill_number,
    originCountryCode: row.origin_country_code,
    totalItems: row.total_items,
    matchedItems: row.matched_items,
    pendingItems: row.pending_items,
    totalValue: parseFloat(row.total_value) || 0,
    totalDuty: parseFloat(row.total_duty) || 0,
    totalVat: parseFloat(row.total_vat) || 0,
    totalOtherTax: parseFloat(row.total_other_tax) || 0,
    customerConfirmed: row.customer_confirmed,
    customerConfirmedAt: row.customer_confirmed_at,
    confirmPdfPath: row.confirm_pdf_path,
    status: row.status,
    importFileName: row.import_file_name,
    // 发货方信息
    shipperName: row.shipper_name,
    shipperAddress: row.shipper_address,
    shipperContact: row.shipper_contact,
    // 进口商信息
    importerCustomerId: row.importer_customer_id,
    importerName: row.importer_name,
    importerTaxId: row.importer_tax_id,
    importerTaxNumber: row.importer_tax_number,
    importerTaxType: row.importer_tax_type,
    importerCountry: row.importer_country,
    importerCompanyName: row.importer_company_name,
    importerAddress: row.importer_address,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 获取货物明细列表
 */
export async function getCargoItems(importId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 50, matchStatus } = params

  let whereClause = 'WHERE import_id = ?'
  const queryParams = [importId]

  if (matchStatus) {
    whereClause += ' AND match_status = ?'
    queryParams.push(matchStatus)
  }

  // 获取总数
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM cargo_items ${whereClause}`
  ).get(...queryParams)
  const total = parseInt(countResult?.total) || 0

  // 分页查询
  const offset = (page - 1) * pageSize
  const listParams = [...queryParams, pageSize, offset]

  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    ${whereClause}
    ORDER BY item_no ASC
    LIMIT ? OFFSET ?
  `).all(...listParams)

  return {
    list: (rows || []).map(row => ({
      id: row.id,
      importId: row.import_id,
      itemNo: row.item_no,
      productName: row.product_name,
      productNameEn: row.product_name_en,
      customerHsCode: row.customer_hs_code,
      matchedHsCode: row.matched_hs_code,
      matchConfidence: parseFloat(row.match_confidence) || 0,
      matchSource: row.match_source,
      quantity: parseFloat(row.quantity) || 0,
      unitCode: row.unit_code,
      unitName: row.unit_name,
      unitPrice: parseFloat(row.unit_price) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      grossWeight: parseFloat(row.gross_weight) || 0,
      netWeight: parseFloat(row.net_weight) || 0,
      originCountry: row.origin_country,
      material: row.material,
      dutyRate: parseFloat(row.duty_rate) || 0,
      vatRate: parseFloat(row.vat_rate) || 19,
      antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(row.countervailing_rate) || 0,
      dutyAmount: parseFloat(row.duty_amount) || 0,
      vatAmount: parseFloat(row.vat_amount) || 0,
      otherTaxAmount: parseFloat(row.other_tax_amount) || 0,
      totalTax: parseFloat(row.total_tax) || 0,
      matchStatus: row.match_status,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 删除导入批次及相关数据
 */
export async function deleteImportBatch(id) {
  const db = getDatabase()
  
  // 删除货物明细（由于外键CASCADE，也可以只删除主表）
  await db.prepare('DELETE FROM cargo_items WHERE import_id = ?').run(id)
  
  // 删除导入批次
  const result = await db.prepare('DELETE FROM cargo_imports WHERE id = ?').run(id)
  
  return result.changes > 0
}

/**
 * 更新导入批次状态
 */
export async function updateImportStatus(id, status) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE cargo_imports 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, now, id)
  
  return result.changes > 0
}

/**
 * 更新导入批次统计信息
 */
export async function updateImportStats(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 计算匹配统计
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN match_status IN ('matched', 'approved', 'auto_approved') THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN match_status = 'pending' OR match_status = 'review' THEN 1 ELSE 0 END) as pending,
      COALESCE(SUM(total_value), 0) as total_value,
      COALESCE(SUM(duty_amount), 0) as total_duty,
      COALESCE(SUM(vat_amount), 0) as total_vat,
      COALESCE(SUM(other_tax_amount), 0) as total_other_tax
    FROM cargo_items 
    WHERE import_id = ?
  `).get(importId)
  
  await db.prepare(`
    UPDATE cargo_imports SET
      total_items = ?,
      matched_items = ?,
      pending_items = ?,
      total_value = ?,
      total_duty = ?,
      total_vat = ?,
      total_other_tax = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    parseInt(stats?.total) || 0,
    parseInt(stats?.matched) || 0,
    parseInt(stats?.pending) || 0,
    parseFloat(stats?.total_value) || 0,
    parseFloat(stats?.total_duty) || 0,
    parseFloat(stats?.total_vat) || 0,
    parseFloat(stats?.total_other_tax) || 0,
    now,
    importId
  )
}

/**
 * 更新导入批次的发货方和进口商信息
 */
export async function updateShipperAndImporter(importId, data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      shipper_name = COALESCE(?, shipper_name),
      shipper_address = COALESCE(?, shipper_address),
      shipper_contact = COALESCE(?, shipper_contact),
      importer_customer_id = COALESCE(?, importer_customer_id),
      importer_name = COALESCE(?, importer_name),
      importer_tax_id = COALESCE(?, importer_tax_id),
      importer_tax_number = COALESCE(?, importer_tax_number),
      importer_tax_type = COALESCE(?, importer_tax_type),
      importer_country = COALESCE(?, importer_country),
      importer_company_name = COALESCE(?, importer_company_name),
      importer_address = COALESCE(?, importer_address),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.shipperName,
    data.shipperAddress,
    data.shipperContact,
    data.importerCustomerId,
    data.importerName,
    data.importerTaxId,
    data.importerTaxNumber,
    data.importerTaxType,
    data.importerCountry,
    data.importerCompanyName,
    data.importerAddress,
    now,
    importId
  )
  
  return true
}

export default {
  generateImportNo,
  parseCSVContent,
  parseExcelFile,
  getFileType,
  mapFieldNames,
  validateItem,
  parseAndPreview,
  createImportBatch,
  insertCargoItems,
  getImportList,
  getImportById,
  getCargoItems,
  deleteImportBatch,
  updateImportStatus,
  updateImportStats,
  updateShipperAndImporter
}
