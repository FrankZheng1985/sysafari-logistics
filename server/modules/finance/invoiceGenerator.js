/**
 * 发票生成器
 * 
 * 生成PDF发票和Excel明细，并上传到腾讯云COS
 */

import puppeteer from 'puppeteer'
import ExcelJS from 'exceljs'
import { generateInvoiceHTML, COMPANY_INFO, getLogoBase64, getStampBase64 } from './invoiceTemplate.js'
import { db } from '../../config/db-adapter.js'
import * as cosStorage from './cosStorage.js'
import { generateId } from '../../utils/id.js'

/**
 * 生成发票编号
 * 格式：INV + 年份(4位) + 序号(7位)
 * 每年1月1日重置序号
 */
export async function generateInvoiceNumber() {
  const year = new Date().getFullYear()
  const prefix = `INV${year}`
  
  // 查询当年最大序号
  const result = await db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_number DESC 
    LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (result && result.invoice_number) {
    // 提取序号部分（最后7位）
    const lastSeq = parseInt(result.invoice_number.slice(-7), 10)
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1
    }
  }
  
  // 生成新编号：INV + 年份 + 7位序号
  return `${prefix}${seq.toString().padStart(7, '0')}`
}

/**
 * 汇总费用数据（按费用类型）
 * 用于PDF发票
 */
export function summarizeFees(fees) {
  const summary = {}
  
  fees.forEach(fee => {
    const key = fee.fee_name || fee.feeName || 'Other'
    if (!summary[key]) {
      summary[key] = {
        description: key,
        quantity: 0,
        totalAmount: 0,
        items: []
      }
    }
    summary[key].quantity += 1
    summary[key].totalAmount += parseFloat(fee.amount) || 0
    summary[key].items.push(fee)
  })
  
  // 转换为数组，计算平均单价
  return Object.values(summary).map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitValue: item.quantity > 0 ? item.totalAmount / item.quantity : 0,
    amount: item.totalAmount
  }))
}

/**
 * 生成PDF发票
 */
export async function generatePDF(invoiceData) {
  const html = generateInvoiceHTML(invoiceData)
  
  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })
    
    return pdfBuffer
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * 生成Excel明细（Statement of Account）
 */
export async function generateExcel(data) {
  const {
    customerName,
    date,
    items,
    total,
    currency = 'EUR'
  } = data
  
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Xianfeng International Logistics'
  workbook.created = new Date()
  
  const worksheet = workbook.addWorksheet('Statement of Account')
  
  // 设置列宽
  worksheet.columns = [
    { header: 'JOB NO', key: 'jobNo', width: 20 },
    { header: 'BILL NO', key: 'billNo', width: 20 },
    { header: 'FEE TYPE', key: 'feeType', width: 30 },
    { header: `Amount ${currency}`, key: 'amount', width: 15 }
  ]
  
  // 标题行
  worksheet.mergeCells('A1:D1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'STATEMENT OF ACCOUNT'
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }
  
  // 客户信息行
  worksheet.mergeCells('A3:B3')
  worksheet.getCell('A3').value = `客户名称 ${customerName}`
  worksheet.getCell('A3').font = { bold: true }
  
  worksheet.mergeCells('C3:D3')
  worksheet.getCell('C3').value = `日期 ${date}`
  worksheet.getCell('C3').font = { bold: true }
  
  // 表头行
  const headerRow = worksheet.getRow(5)
  headerRow.values = ['JOB NO', 'BILL NO', 'FEE TYPE', `Amount ${currency}`]
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  
  // 数据行
  let rowIndex = 6
  let currentJobNo = ''
  let currentBillNo = ''
  
  items.forEach(item => {
    const row = worksheet.getRow(rowIndex)
    
    // 如果是同一个柜号/提单，不重复显示
    const showJobNo = item.containerNumber !== currentJobNo
    const showBillNo = item.billNumber !== currentBillNo
    
    if (showJobNo) currentJobNo = item.containerNumber
    if (showBillNo) currentBillNo = item.billNumber
    
    row.values = [
      showJobNo ? item.containerNumber : '',
      showBillNo ? item.billNumber : '',
      item.feeName || item.fee_name,
      parseFloat(item.amount) || 0
    ]
    
    // 设置边框
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
    
    // 金额右对齐
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(4).numFmt = '#,##0.00'
    
    rowIndex++
  })
  
  // 合计行
  const totalRow = worksheet.getRow(rowIndex)
  totalRow.values = ['', '', 'Total:', total]
  totalRow.font = { bold: true }
  totalRow.getCell(3).alignment = { horizontal: 'right' }
  totalRow.getCell(4).alignment = { horizontal: 'right' }
  totalRow.getCell(4).numFmt = '#,##0.00'
  totalRow.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  
  // 生成Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

/**
 * 从费用记录生成发票数据
 */
export async function prepareInvoiceData(feeIds, customerId) {
  // 获取费用记录
  const placeholders = feeIds.map(() => '?').join(',')
  const fees = await db.prepare(`
    SELECT f.*, b.container_number, b.bill_number
    FROM fees f
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id
    WHERE f.id IN (${placeholders})
    ORDER BY b.container_number, f.fee_name
  `).all(...feeIds)
  
  if (!fees || fees.length === 0) {
    throw new Error('未找到费用记录')
  }
  
  // 获取客户信息
  let customer = null
  if (customerId) {
    customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
  }
  if (!customer && fees[0].customer_id) {
    customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(fees[0].customer_id)
  }
  
  // 提取柜号列表
  const containerNumbers = [...new Set(fees.map(f => f.container_number).filter(Boolean))]
  
  // 汇总费用
  const summarizedItems = summarizeFees(fees)
  
  // 计算总金额
  const total = fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0)
  
  return {
    customer: {
      id: customer?.id,
      name: customer?.customer_name || customer?.company_name || fees[0].customer_name || '',
      address: customer?.address || ''
    },
    containerNumbers,
    fees,
    summarizedItems,
    total,
    currency: fees[0]?.currency || 'EUR'
  }
}

/**
 * 完整的发票生成流程
 * 1. 生成发票编号
 * 2. 准备发票数据
 * 3. 生成PDF和Excel
 * 4. 上传到COS
 * 5. 保存发票记录
 */
export async function createInvoiceWithFiles(feeIds, customerId, options = {}) {
  // 1. 生成发票编号
  const invoiceNumber = await generateInvoiceNumber()
  const invoiceDate = new Date().toISOString().split('T')[0]
  
  // 2. 准备发票数据
  const invoiceData = await prepareInvoiceData(feeIds, customerId)
  
  // 3. 生成PDF
  const pdfData = {
    invoiceNumber,
    invoiceDate,
    customer: invoiceData.customer,
    containerNumbers: invoiceData.containerNumbers,
    items: invoiceData.summarizedItems,
    subtotal: invoiceData.total,
    total: invoiceData.total,
    currency: invoiceData.currency
  }
  
  const pdfBuffer = await generatePDF(pdfData)
  
  // 4. 生成Excel
  const excelData = {
    customerName: invoiceData.customer.name,
    date: invoiceDate,
    items: invoiceData.fees.map(f => ({
      containerNumber: f.container_number,
      billNumber: f.bill_number,
      feeName: f.fee_name,
      amount: f.amount
    })),
    total: invoiceData.total,
    currency: invoiceData.currency
  }
  
  const excelBuffer = await generateExcel(excelData)
  
  // 5. 上传到COS
  let pdfUrl = null
  let excelUrl = null
  
  const cosConfig = cosStorage.checkCosConfig()
  if (cosConfig.configured) {
    try {
      pdfUrl = await cosStorage.uploadInvoicePDF(pdfBuffer, invoiceNumber)
      excelUrl = await cosStorage.uploadStatementExcel(excelBuffer, invoiceNumber)
    } catch (error) {
      console.error('上传到COS失败:', error)
      // 继续执行，即使上传失败也保存发票记录
    }
  } else {
    console.warn('COS未配置，跳过文件上传')
  }
  
  // 6. 保存发票记录
  const invoiceId = generateId()
  const now = new Date().toISOString()
  
  await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, invoice_type, customer_id, customer_name, customer_address,
      container_numbers, invoice_date, subtotal, total_amount, currency, items, fee_ids,
      pdf_url, excel_url, pdf_generated_at, excel_generated_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    invoiceNumber,
    'sales',
    invoiceData.customer.id || null,
    invoiceData.customer.name,
    invoiceData.customer.address,
    JSON.stringify(invoiceData.containerNumbers),
    invoiceDate,
    invoiceData.total,
    invoiceData.total,
    invoiceData.currency,
    JSON.stringify(invoiceData.summarizedItems),
    JSON.stringify(feeIds),
    pdfUrl,
    excelUrl,
    pdfUrl ? now : null,
    excelUrl ? now : null,
    'issued',
    now,
    now
  )
  
  // 7. 更新费用记录的发票状态
  for (const feeId of feeIds) {
    await db.prepare(`
      UPDATE fees SET 
        invoice_status = 'invoiced',
        invoice_number = ?,
        invoice_date = ?,
        updated_at = ?
      WHERE id = ?
    `).run(invoiceNumber, invoiceDate, now, feeId)
  }
  
  return {
    id: invoiceId,
    invoiceNumber,
    invoiceDate,
    customer: invoiceData.customer,
    containerNumbers: invoiceData.containerNumbers,
    items: invoiceData.summarizedItems,
    feeDetails: invoiceData.fees,
    total: invoiceData.total,
    currency: invoiceData.currency,
    pdfUrl,
    excelUrl,
    status: 'issued'
  }
}

/**
 * 重新生成发票文件（不创建新发票）
 */
export async function regenerateInvoiceFiles(invoiceId) {
  // 获取发票记录
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId)
  if (!invoice) {
    throw new Error('发票不存在')
  }
  
  // 解析fee_ids
  let feeIds = []
  try {
    feeIds = JSON.parse(invoice.fee_ids || '[]')
  } catch {
    throw new Error('发票费用数据无效')
  }
  
  if (feeIds.length === 0) {
    throw new Error('发票没有关联的费用记录')
  }
  
  // 准备发票数据
  const invoiceData = await prepareInvoiceData(feeIds, invoice.customer_id)
  
  // 生成PDF
  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    customer: {
      name: invoice.customer_name,
      address: invoice.customer_address
    },
    containerNumbers: JSON.parse(invoice.container_numbers || '[]'),
    items: invoiceData.summarizedItems,
    subtotal: invoiceData.total,
    total: invoiceData.total,
    currency: invoice.currency
  }
  
  const pdfBuffer = await generatePDF(pdfData)
  
  // 生成Excel
  const excelData = {
    customerName: invoice.customer_name,
    date: invoice.invoice_date,
    items: invoiceData.fees.map(f => ({
      containerNumber: f.container_number,
      billNumber: f.bill_number,
      feeName: f.fee_name,
      amount: f.amount
    })),
    total: invoiceData.total,
    currency: invoice.currency
  }
  
  const excelBuffer = await generateExcel(excelData)
  
  // 上传到COS
  let pdfUrl = invoice.pdf_url
  let excelUrl = invoice.excel_url
  
  const cosConfig = cosStorage.checkCosConfig()
  if (cosConfig.configured) {
    try {
      pdfUrl = await cosStorage.uploadInvoicePDF(pdfBuffer, invoice.invoice_number)
      excelUrl = await cosStorage.uploadStatementExcel(excelBuffer, invoice.invoice_number)
    } catch (error) {
      console.error('上传到COS失败:', error)
    }
  }
  
  // 更新发票记录
  const now = new Date().toISOString()
  await db.prepare(`
    UPDATE invoices SET 
      pdf_url = ?,
      excel_url = ?,
      pdf_generated_at = ?,
      excel_generated_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(pdfUrl, excelUrl, now, now, now, invoiceId)
  
  return {
    id: invoiceId,
    invoiceNumber: invoice.invoice_number,
    pdfUrl,
    excelUrl
  }
}

/**
 * 获取发票文件的临时下载URL
 */
export async function getInvoiceDownloadUrl(invoiceId, fileType = 'pdf') {
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId)
  if (!invoice) {
    throw new Error('发票不存在')
  }
  
  const url = fileType === 'excel' ? invoice.excel_url : invoice.pdf_url
  if (!url) {
    throw new Error(`发票${fileType === 'excel' ? 'Excel' : 'PDF'}文件不存在`)
  }
  
  // 如果COS配置了，生成带签名的临时URL
  const cosConfig = cosStorage.checkCosConfig()
  if (cosConfig.configured) {
    const key = cosStorage.extractKeyFromUrl(url)
    if (key) {
      return await cosStorage.getSignedUrl(key, 3600) // 1小时有效
    }
  }
  
  // 否则返回原始URL
  return url
}

export default {
  generateInvoiceNumber,
  summarizeFees,
  generatePDF,
  generateExcel,
  prepareInvoiceData,
  createInvoiceWithFiles,
  regenerateInvoiceFiles,
  getInvoiceDownloadUrl
}
