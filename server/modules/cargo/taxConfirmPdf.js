/**
 * 税费确认单PDF生成服务
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getTaxDetails } from './taxCalc.js'

// 获取当前模块的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 服务器根目录（从 modules/cargo 向上两级）
const SERVER_ROOT = path.resolve(__dirname, '..', '..')

// 确保上传目录存在
const UPLOAD_DIR = path.join(SERVER_ROOT, 'uploads', 'tax-confirms')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// 中文字体路径
const FONT_PATH = path.join(SERVER_ROOT, 'assets', 'fonts', 'NotoSansSC-Regular.ttf')

/**
 * 生成税费确认单PDF
 */
export async function generateTaxConfirmPdf(importId) {
  // 获取税费详情
  const taxDetails = await getTaxDetails(importId)
  if (!taxDetails) {
    throw new Error('导入批次不存在')
  }

  const { batch, items, summary } = taxDetails
  
  // 生成文件名
  const fileName = `TAX_CONFIRM_${batch.importNo}_${Date.now()}.pdf`
  const filePath = path.join(UPLOAD_DIR, fileName)
  const relativePath = `tax-confirms/${fileName}`
  
  return new Promise((resolve, reject) => {
    try {
      // 创建PDF文档 - 使用更小的边距
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 35, bottom: 35, left: 40, right: 40 },
        info: {
          Title: `税费确认单 - ${batch.importNo}`,
          Author: 'BP Logistics',
          Subject: '清关税费确认'
        }
      })
      
      // 创建写入流
      const writeStream = fs.createWriteStream(filePath)
      doc.pipe(writeStream)
      
      // 注册中文字体
      if (fs.existsSync(FONT_PATH)) {
        doc.registerFont('Chinese', FONT_PATH)
        doc.font('Chinese')
        console.log('✅ PDF中文字体加载成功:', FONT_PATH)
      } else {
        console.warn('⚠️ 中文字体文件不存在:', FONT_PATH)
        console.warn('PDF中的中文可能显示为乱码')
      }
      
      const pageLeft = 40
      const pageRight = 555
      const pageWidth = pageRight - pageLeft
      
      // 标题
      doc.fontSize(14)
         .text('税费确认单 / TAX CONFIRMATION', pageLeft, 35, { align: 'center', width: pageWidth })
      
      // 分隔线
      doc.moveTo(pageLeft, 55).lineTo(pageRight, 55).stroke()
      
      // 基本信息 - 两列布局更紧凑
      let y = 62
      doc.fontSize(9)
      doc.text(`批次号: ${batch.importNo}`, pageLeft, y)
      doc.text(`日期: ${new Date().toLocaleDateString('zh-CN')}`, pageLeft + 280, y)
      y += 13
      doc.text(`柜号: ${batch.containerNo || '-'}`, pageLeft, y)
      doc.text(`提单号: ${batch.billNumber || '-'}`, pageLeft + 280, y)
      y += 13
      doc.text(`客户: ${batch.customerName || '-'}`, pageLeft, y)
      
      y += 18
      
      // 分隔线
      doc.moveTo(pageLeft, y).lineTo(pageRight, y).stroke()
      
      y += 8
      
      // 商品明细表头
      doc.fontSize(10)
         .text('货物明细', pageLeft, y)
      
      y += 15
      
      // 表格
      const tableLeft = pageLeft
      const colWidths = [25, 130, 65, 60, 55, 55, 45, 55]
      
      // 表头背景
      doc.rect(tableLeft, y - 2, pageWidth, 14).fill('#f3f4f6')
      doc.fillColor('#000000')
      
      // 表头
      doc.fontSize(8)
      let x = tableLeft + 2
      const headers = ['序号', '商品名称', 'HS编码', '货值(€)', '关税(€)', '增值税(€)', '其他(€)', '合计(€)']
      headers.forEach((header, i) => {
        doc.text(header, x, y, { width: colWidths[i], align: 'left' })
        x += colWidths[i]
      })
      
      y += 14
      
      // 表格内容 - 更紧凑的行高
      const rowHeight = 11
      const maxItemsPerPage = 20  // 减少显示数量以适应一页
      const displayItems = items.slice(0, maxItemsPerPage)
      
      displayItems.forEach((item, index) => {
        // 交替行背景
        if (index % 2 === 1) {
          doc.rect(tableLeft, y - 1, pageWidth, rowHeight).fill('#fafafa')
          doc.fillColor('#000000')
        }
        
        x = tableLeft + 2
        doc.fontSize(7)
        doc.text(String(item.itemNo || index + 1), x, y, { width: colWidths[0] })
        x += colWidths[0]
        doc.text(item.productName?.substring(0, 18) || '', x, y, { width: colWidths[1] })
        x += colWidths[1]
        doc.text(item.matchedHsCode || '', x, y, { width: colWidths[2] })
        x += colWidths[2]
        doc.text(item.totalValue.toFixed(2), x, y, { width: colWidths[3] })
        x += colWidths[3]
        doc.text(item.dutyAmount.toFixed(2), x, y, { width: colWidths[4] })
        x += colWidths[4]
        doc.text(item.vatAmount.toFixed(2), x, y, { width: colWidths[5] })
        x += colWidths[5]
        doc.text(item.otherTaxAmount.toFixed(2), x, y, { width: colWidths[6] })
        x += colWidths[6]
        doc.text(item.totalTax.toFixed(2), x, y, { width: colWidths[7] })
        
        y += rowHeight
      })
      
      if (items.length > maxItemsPerPage) {
        doc.fontSize(7)
           .text(`... 还有 ${items.length - maxItemsPerPage} 件商品`, tableLeft, y)
        y += 10
      }
      
      // 分隔线
      doc.moveTo(pageLeft, y + 3).lineTo(pageRight, y + 3).stroke()
      
      y += 12
      
      // 税费汇总 - 更紧凑的布局
      doc.fontSize(10).text('税费汇总', pageLeft, y)
      
      y += 15
      doc.fontSize(9)
      
      // 汇总信息 - 三列布局
      const col1X = pageLeft
      const col2X = pageLeft + 180
      const col3X = pageLeft + 360
      
      doc.text(`货值总额: €${summary.totalValue.toFixed(2)}`, col1X, y)
      doc.text(`关税: €${summary.totalDuty.toFixed(2)}`, col2X, y)
      doc.text(`增值税: €${summary.totalVat.toFixed(2)}`, col3X, y)
      
      y += 14
      doc.text(`其他税费: €${summary.totalOtherTax.toFixed(2)}`, col1X, y)
      doc.fontSize(10)
      doc.text(`税费合计: €${summary.totalTax.toFixed(2)}`, col2X, y)
      
      y += 20
      
      // 分隔线
      doc.moveTo(pageLeft, y).lineTo(pageRight, y).stroke()
      
      y += 10
      
      // 确认栏 - 更紧凑
      doc.fontSize(9)
         .text('客户确认: 本人确认已审阅以上税费明细，并同意该计算结果。', pageLeft, y, { width: pageWidth })
      
      y += 25
      
      // 签名栏 - 同一行
      doc.fontSize(9)
      doc.text('签字: ____________________', pageLeft, y)
      doc.text('日期: ____________________', pageLeft + 200, y)
      doc.text('公司盖章:', pageLeft + 380, y)
      
      // 页脚 - 在签名栏下方，确保在第一页内
      // A4高度842，使用Math.max确保页脚不会太靠上
      y += 30
      const footerY = Math.max(y, 780)  // 至少在780的位置，但不超过页面
      
      // 绘制页脚分隔线
      doc.moveTo(pageLeft, footerY).lineTo(pageRight, footerY).strokeColor('#cccccc').stroke()
      doc.strokeColor('#000000')
      
      doc.fontSize(7)
         .fillColor('#888888')
         .text(
           '本文件由BP物流系统生成 / Generated by BP Logistics System',
           pageLeft, footerY + 5,
           { align: 'center', width: pageWidth, lineBreak: false }
         )
      doc.fillColor('#000000')
      
      // 结束文档
      doc.end()
      
      writeStream.on('finish', () => {
        resolve({
          filePath: relativePath,
          fileName,
          fullPath: filePath
        })
      })
      
      writeStream.on('error', (error) => {
        reject(error)
      })
      
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 获取PDF文件路径
 */
export function getPdfFilePath(relativePath) {
  return path.join(SERVER_ROOT, 'uploads', relativePath)
}

export default {
  generateTaxConfirmPdf,
  getPdfFilePath,
  UPLOAD_DIR
}
