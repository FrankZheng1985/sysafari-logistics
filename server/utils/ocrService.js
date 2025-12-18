/**
 * OCR 文字识别服务
 * 用于扫描件 PDF 和图片的文字识别
 */

/**
 * 使用 Tesseract.js 进行 OCR 识别
 * @param {Buffer} imageBuffer - 图片 Buffer
 * @param {string} language - 识别语言 (chi_sim, eng, etc.)
 * @returns {Object} 识别结果
 */
export async function recognizeImage(imageBuffer, language = 'chi_sim+eng') {
  try {
    // 动态导入 tesseract.js
    const Tesseract = await import('tesseract.js')
    
    const result = await Tesseract.recognize(imageBuffer, language, {
      logger: info => {
        if (info.status === 'recognizing text') {
          console.log(`OCR progress: ${Math.round(info.progress * 100)}%`)
        }
      }
    })
    
    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words?.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      }))
    }
  } catch (error) {
    console.error('OCR 识别失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 将扫描件 PDF 转换为图片再进行 OCR
 * 需要 pdf-poppler 或类似库
 * @param {Buffer} pdfBuffer - PDF Buffer
 * @returns {Object} 识别结果
 */
export async function recognizeScannedPdf(pdfBuffer) {
  try {
    // 对于扫描件PDF，我们需要先将其转换为图片
    // 这里使用简化方案：提示用户文件可能是扫描件
    
    // 先尝试使用 pdf-parse 检测是否有文本
    const pdfParse = await import('pdf-parse').then(m => m.default || m)
    
    try {
      const data = await pdfParse(pdfBuffer)
      
      // 如果提取到有意义的文本，说明不是纯扫描件
      if (data.text && data.text.trim().length > 50) {
        return {
          success: true,
          isScanned: false,
          text: data.text,
          pageCount: data.numpages
        }
      }
    } catch (e) {
      // pdf-parse 失败，可能是扫描件
    }
    
    // 标记为扫描件，需要 OCR 处理
    // 注意：完整的 OCR 处理需要将 PDF 转换为图片，这需要额外的依赖
    return {
      success: false,
      isScanned: true,
      message: '检测到扫描件PDF，需要手动输入数据或使用在线OCR工具处理后再导入'
    }
  } catch (error) {
    console.error('扫描件处理失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 从 OCR 结果中提取结构化数据
 * @param {string} text - OCR 识别的文本
 * @returns {Array} 提取的数据项
 */
export function extractDataFromOcrText(text) {
  const items = []
  const lines = text.split('\n').filter(l => l.trim())
  
  lines.forEach(line => {
    // 尝试匹配费用项格式
    // 格式1: 服务名称 金额€
    // 格式2: 服务名称 数量 单价 金额
    
    const patterns = [
      // 服务名称 + 金额（带货币符号）
      /^(.+?)\s+([\d,\.]+)\s*[€$¥]/,
      // 服务名称 + 数量 + 金额
      /^(.+?)\s+(\d+)\s+([\d,\.]+)/,
      // 只有服务名称和金额（数字结尾）
      /^(.{3,30}?)\s+([\d,]+\.?\d*)$/
    ]
    
    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (match) {
        const feeName = match[1].trim()
        const amount = parseFloat(match[match.length - 1].replace(/,/g, ''))
        
        if (feeName && !isNaN(amount) && amount > 0) {
          items.push({
            feeName,
            price: amount,
            originalLine: line,
            source: 'ocr'
          })
          break
        }
      }
    }
  })
  
  return items
}

export default {
  recognizeImage,
  recognizeScannedPdf,
  extractDataFromOcrText
}
