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
import AdmZip from 'adm-zip'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 图片上传目录
const UPLOAD_DIR = path.join(__dirname, '../../uploads/cargo-images')

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// 图片增强配置
const IMAGE_ENHANCE_CONFIG = {
  minWidth: 600,           // 最小宽度，小于此值会放大
  maxWidth: 1200,          // 最大宽度（从1600降低到1200，节省空间）
  quality: 82,             // JPEG质量（从90降低到82，压缩率更高，视觉差异极小）
  pngCompression: 9,       // PNG压缩级别（0-9，9为最高压缩）
  sharpen: true,           // 是否锐化
  enhanceContrast: true,   // 是否增强对比度
  cropEcommerce: true,     // 是否裁剪电商截图底部
  useAiEnhance: true,      // 是否使用AI超分辨率（模糊图片）
  convertToJpeg: true      // 将PNG转为JPEG以节省空间（透明图片除外）
}

// 电商截图检测配置
const ECOMMERCE_CROP_CONFIG = {
  // 常见手机截图宽高比（竖屏）
  aspectRatioMin: 1.5,     // 高/宽 > 1.5 可能是手机截图
  aspectRatioMax: 2.5,     // 高/宽 < 2.5 
  bottomCropPercent: 0.18, // 裁剪底部18%（价格/购物车区域）
  // 检测是否为电商截图的特征
  minHeight: 1000          // 手机截图通常较高
}

/**
 * 检测是否为电商截图（手机截图包含价格信息）
 * @param {Object} metadata - 图片元信息
 * @returns {boolean}
 */
function isEcommerceScreenshot(metadata) {
  const { width, height } = metadata
  if (!width || !height) return false
  
  const aspectRatio = height / width
  
  // 竖屏手机截图特征：高宽比在1.5-2.5之间，且高度较大
  if (aspectRatio >= ECOMMERCE_CROP_CONFIG.aspectRatioMin && 
      aspectRatio <= ECOMMERCE_CROP_CONFIG.aspectRatioMax &&
      height >= ECOMMERCE_CROP_CONFIG.minHeight) {
    console.log(`  检测到可能是电商截图: ${width}x${height}, 比例=${aspectRatio.toFixed(2)}`)
    return true
  }
  
  return false
}

/**
 * 检测图片是否模糊（需要AI增强）
 * 通过计算图片的拉普拉斯方差来判断清晰度
 * @param {Buffer} imageBuffer
 * @returns {Promise<boolean>}
 */
async function isImageBlurry(imageBuffer) {
  try {
    // 转换为灰度图并计算标准差
    const { info, data } = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    // 计算像素值的标准差
    let sum = 0
    let sumSq = 0
    const pixelCount = data.length
    
    for (let i = 0; i < pixelCount; i++) {
      sum += data[i]
      sumSq += data[i] * data[i]
    }
    
    const mean = sum / pixelCount
    const variance = (sumSq / pixelCount) - (mean * mean)
    const stdDev = Math.sqrt(variance)
    
    // 标准差低于某个阈值认为是模糊图片
    // 经验值：清晰图片标准差通常>40，模糊图片<30
    const isBlurry = stdDev < 35
    
    console.log(`  图片清晰度检测: 标准差=${stdDev.toFixed(1)}, ${isBlurry ? '模糊' : '清晰'}`)
    
    return isBlurry
  } catch (err) {
    console.warn(`清晰度检测失败:`, err.message)
    return false
  }
}

// AI超分辨率API代码（已合并到阿里云AI智能服务）
const AI_SR_API_CODE = 'aliyun_qwen_vl'  // 统一使用阿里云AI智能
const AI_SR_COST_PER_CALL = 0.04  // 每次调用约0.04元（万象超分辨率）

/**
 * 记录AI超分辨率调用日志
 */
async function logAiSuperResolutionUsage({ imagePath, success, originalSize, resultSize, responseTimeMs, errorMessage }) {
  try {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]
    
    // 插入详细日志
    await db.prepare(`
      INSERT INTO ai_usage_logs (
        api_code, user_id, user_name, request_type,
        image_path, success, response_summary, error_message,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, currency, response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `).run(
      AI_SR_API_CODE,
      null,
      'system',
      'super_resolution',
      imagePath || null,
      success,
      success ? `${originalSize} -> ${resultSize}` : null,
      errorMessage || null,
      0, 0, 0,  // 超分辨率不按token计费
      AI_SR_COST_PER_CALL,
      'CNY',
      responseTimeMs || 0
    )
    
    // 更新每日统计
    const existingRecord = await db.prepare(`
      SELECT id FROM api_usage_records WHERE api_code = $1 AND usage_date = $2
    `).get(AI_SR_API_CODE, today)
    
    if (existingRecord) {
      await db.prepare(`
        UPDATE api_usage_records SET
          call_count = call_count + 1,
          success_count = success_count + $1,
          fail_count = fail_count + $2,
          cost = cost + $3,
          updated_at = NOW()
        WHERE api_code = $4 AND usage_date = $5
      `).run(success ? 1 : 0, success ? 0 : 1, AI_SR_COST_PER_CALL, AI_SR_API_CODE, today)
    } else {
      await db.prepare(`
        INSERT INTO api_usage_records (api_code, usage_date, call_count, success_count, fail_count, cost)
        VALUES ($1, $2, 1, $3, $4, $5)
      `).run(AI_SR_API_CODE, today, success ? 1 : 0, success ? 0 : 1, AI_SR_COST_PER_CALL)
    }
    
    console.log('  AI超分辨率日志已记录')
  } catch (err) {
    console.warn('  记录AI超分辨率日志失败:', err.message)
  }
}

/**
 * 调用阿里云AI图像超分辨率
 * 注意：阿里云要求图片尺寸在256x256到4096x4096之间，高度至少512px
 * @param {Buffer} imageBuffer
 * @param {string} outputPath
 * @returns {Promise<boolean>}
 */
async function aiSuperResolution(imageBuffer, outputPath) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    console.warn('  AI超分辨率: DASHSCOPE_API_KEY 未配置')
    return false
  }
  
  const startTime = Date.now()
  
  try {
    console.log('  调用AI超分辨率服务...')
    
    // 获取原图尺寸
    const metadata = await sharp(imageBuffer).metadata()
    const { width, height } = metadata
    
    // 阿里云要求：256 < 尺寸 < 4096，且高度至少512
    const MIN_SIZE = 512
    const MAX_SIZE = 4096
    
    let processedBuffer = imageBuffer
    let scale = 1
    
    // 如果图片太小，先放大到满足最小尺寸要求
    if (width < MIN_SIZE || height < MIN_SIZE) {
      scale = Math.max(MIN_SIZE / width, MIN_SIZE / height)
      const newWidth = Math.min(Math.round(width * scale), MAX_SIZE)
      const newHeight = Math.min(Math.round(height * scale), MAX_SIZE)
      
      console.log(`  预处理: ${width}x${height} -> ${newWidth}x${newHeight}`)
      
      processedBuffer = await sharp(imageBuffer)
        .resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false
        })
        .png()
        .toBuffer()
    }
    
    // 将图片转为base64 data URL
    const base64 = processedBuffer.toString('base64')
    const mimeType = 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    // 创建超分任务
    const createResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify({
        model: 'wanx2.1-imageedit',
        input: {
          function: 'super_resolution',
          prompt: '图像超分增强清晰度',
          base_image_url: dataUrl
        },
        parameters: {
          upscale_factor: 2,  // 放大2倍
          n: 1
        }
      })
    })
    
    const createResult = await createResponse.json()
    
    if (!createResult.output?.task_id) {
      console.warn('  AI超分辨率创建任务失败:', createResult)
      return false
    }
    
    const taskId = createResult.output.task_id
    console.log(`  AI任务已创建: ${taskId}`)
    
    // 轮询等待结果（最多等待90秒）
    const maxWait = 90000
    const pollInterval = 3000
    let waited = 0
    
    while (waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      waited += pollInterval
      
      const statusResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      
      const statusResult = await statusResponse.json()
      const status = statusResult.output?.task_status
      
      if (status === 'SUCCEEDED') {
        // 下载结果图片
        const resultUrl = statusResult.output?.results?.[0]?.url
        if (resultUrl) {
          const imageResponse = await fetch(resultUrl)
          const resultBuffer = Buffer.from(await imageResponse.arrayBuffer())
          
          // 额外锐化处理
          const finalBuffer = await sharp(resultBuffer)
            .sharpen({ sigma: 1.0, m1: 0.8, m2: 1.5 })
            .jpeg({ quality: 95 })
            .toBuffer()
          
          fs.writeFileSync(outputPath, finalBuffer)
          
          const finalMeta = await sharp(outputPath).metadata()
          const responseTime = Date.now() - startTime
          console.log(`  AI超分辨率完成! ${finalMeta.width}x${finalMeta.height}`)
          
          // 记录成功日志
          await logAiSuperResolutionUsage({
            imagePath: outputPath,
            success: true,
            originalSize: `${width}x${height}`,
            resultSize: `${finalMeta.width}x${finalMeta.height}`,
            responseTimeMs: responseTime
          })
          
          return true
        }
      } else if (status === 'FAILED') {
        console.warn('  AI超分辨率任务失败:', statusResult)
        // 记录失败日志
        await logAiSuperResolutionUsage({
          imagePath: outputPath,
          success: false,
          originalSize: `${width}x${height}`,
          responseTimeMs: Date.now() - startTime,
          errorMessage: statusResult.output?.message || 'Task failed'
        })
        return false
      }
      
      console.log(`  等待AI处理... ${waited/1000}s`)
    }
    
    console.warn('  AI超分辨率超时')
    // 记录超时日志
    await logAiSuperResolutionUsage({
      imagePath: outputPath,
      success: false,
      originalSize: `${width}x${height}`,
      responseTimeMs: Date.now() - startTime,
      errorMessage: 'Timeout'
    })
    return false
  } catch (err) {
    console.warn('  AI超分辨率错误:', err.message)
    // 记录错误日志
    await logAiSuperResolutionUsage({
      imagePath: outputPath,
      success: false,
      responseTimeMs: Date.now() - startTime,
      errorMessage: err.message
    })
    return false
  }
}

/**
 * 图片增强处理
 * 1. 检测并裁剪电商截图底部（价格/购物车）
 * 2. 模糊图片使用AI超分辨率
 * 3. 普通图片放大+锐化+对比度增强
 * @param {Buffer} imageBuffer - 原始图片数据
 * @param {string} outputPath - 输出路径
 * @returns {Promise<boolean>} - 处理是否成功
 */
async function enhanceImage(imageBuffer, outputPath) {
  try {
    // 获取图片元信息
    const metadata = await sharp(imageBuffer).metadata()
    const { width, height, format } = metadata
    
    console.log(`处理图片: ${width}x${height} ${format}`)
    
    let processor = sharp(imageBuffer)
    let processedBuffer = imageBuffer
    
    // ========== 步骤1: 电商截图裁剪（去除底部价格区域）==========
    if (IMAGE_ENHANCE_CONFIG.cropEcommerce && isEcommerceScreenshot(metadata)) {
      const cropHeight = Math.round(height * (1 - ECOMMERCE_CROP_CONFIG.bottomCropPercent))
      
      processedBuffer = await sharp(imageBuffer)
        .extract({ 
          left: 0, 
          top: 0, 
          width: width, 
          height: cropHeight 
        })
        .toBuffer()
      
      console.log(`  已裁剪底部: ${height} -> ${cropHeight} (移除${Math.round(ECOMMERCE_CROP_CONFIG.bottomCropPercent*100)}%)`)
      
      // 更新processor使用裁剪后的图片
      processor = sharp(processedBuffer)
    }
    
    // ========== 步骤2: 检测模糊图片，使用AI增强 ==========
    if (IMAGE_ENHANCE_CONFIG.useAiEnhance) {
      const blurry = await isImageBlurry(processedBuffer)
      if (blurry) {
        console.log(`  图片模糊，尝试AI超分辨率...`)
        const aiSuccess = await aiSuperResolution(processedBuffer, outputPath)
        if (aiSuccess) {
          return { success: true, outputPath } // AI处理成功，直接返回
        }
        console.log(`  AI增强未成功，使用传统方法`)
      }
    }
    
    // ========== 步骤3: 传统增强处理 ==========
    // 获取当前尺寸（可能已裁剪）
    const currentMetadata = await sharp(processedBuffer).metadata()
    const currentWidth = currentMetadata.width || width
    
    // 如果图片太小，放大到目标尺寸
    if (currentWidth < IMAGE_ENHANCE_CONFIG.minWidth) {
      const finalWidth = Math.min(IMAGE_ENHANCE_CONFIG.minWidth, IMAGE_ENHANCE_CONFIG.maxWidth)
      
      processor = processor.resize(finalWidth, null, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false
      })
      
      console.log(`  放大: ${currentWidth} -> ${finalWidth}`)
    }
    
    // 锐化处理（增强版）
    if (IMAGE_ENHANCE_CONFIG.sharpen) {
      processor = processor.sharpen({
        sigma: 1.5,      // 增强锐化强度
        m1: 1.2,         // 平坦区域锐化
        m2: 2.5          // 边缘锐化
      })
    }
    
    // 增强对比度和饱和度
    if (IMAGE_ENHANCE_CONFIG.enhanceContrast) {
      processor = processor.modulate({
        brightness: 1.03,   // 略微提亮
        saturation: 1.15    // 提升饱和度
      }).normalise()        // 自动调整对比度
    }
    
    // 确定输出格式 - 优化压缩策略
    const ext = path.extname(outputPath).toLowerCase()
    let finalOutputPath = outputPath
    
    // 检查PNG是否有透明通道，没有则转为JPEG以节省空间
    if (ext === '.png' && IMAGE_ENHANCE_CONFIG.convertToJpeg) {
      const meta = await sharp(processedBuffer).metadata()
      const hasAlpha = meta.hasAlpha && meta.channels === 4
      
      if (!hasAlpha) {
        // 无透明通道，转为JPEG
        finalOutputPath = outputPath.replace(/\.png$/i, '.jpg')
        processor = processor.jpeg({ 
          quality: IMAGE_ENHANCE_CONFIG.quality, 
          mozjpeg: true,
          chromaSubsampling: '4:2:0'  // 更好的压缩
        })
        console.log(`  PNG转JPEG: 无透明通道，节省空间`)
      } else {
        // 有透明通道，保持PNG但使用最高压缩
        processor = processor.png({ 
          compressionLevel: IMAGE_ENHANCE_CONFIG.pngCompression,
          palette: true  // 使用调色板进一步压缩
        })
      }
    } else if (ext === '.png') {
      processor = processor.png({ 
        compressionLevel: IMAGE_ENHANCE_CONFIG.pngCompression,
        palette: true
      })
    } else {
      // JPEG格式，使用mozjpeg获得更好的压缩
      processor = processor.jpeg({ 
        quality: IMAGE_ENHANCE_CONFIG.quality, 
        mozjpeg: true,
        chromaSubsampling: '4:2:0'
      })
    }
    
    // 保存处理后的图片
    await processor.toFile(finalOutputPath)
    
    // 如果文件名改变了（PNG转JPEG），删除原始路径的文件（如果存在）
    if (finalOutputPath !== outputPath && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    }
    
    // 获取处理后的文件大小
    const stats = fs.statSync(finalOutputPath)
    const fileSizeKB = (stats.size / 1024).toFixed(1)
    console.log(`  增强完成: ${fileSizeKB}KB ${finalOutputPath !== outputPath ? '(已转为JPEG)' : ''}`)
    
    return { success: true, outputPath: finalOutputPath }
  } catch (err) {
    console.warn(`图片增强失败，使用原图:`, err.message)
    // 增强失败时，保存原始图片
    fs.writeFileSync(outputPath, imageBuffer)
    return { success: false, outputPath, error: err.message }
  }
}

// 模板字段映射 - 根据最新客户Excel模板（2024版）
const FIELD_MAPPING = {
  // 基本信息 - 集装箱/柜号
  '集装箱号': 'containerNo',
  '柜号*': 'containerNo',
  '柜号': 'containerNo',
  
  // 序号
  '序号*': 'serialNo',
  '序号': 'serialNo',
  '序列号*': 'serialNo',
  '序列号': 'serialNo',
  
  // 客户单号（一个托盘多产品时，只在首行填写）
  '客户单号*': 'customerOrderNo',
  '客户单号': 'customerOrderNo',
  
  // 托盘和唛头
  '托盘件数*': 'palletCount',
  '托盘件数': 'palletCount',
  '唛头*': 'referenceNo',
  '唛头': 'referenceNo',
  '提头*': 'referenceNo',
  '提头': 'referenceNo',
  
  // 箱产品号（兼容旧版）
  '箱产品号*': 'productCode',
  '箱产品号': 'productCode',
  
  // 商品信息 - 英文品名
  '英文品名*': 'productNameEn',
  '英文品名': 'productNameEn',
  '英文商品品名*': 'productNameEn',
  '英文商品品名': 'productNameEn',
  
  // HS编码
  'HS编码*': 'customerHsCode',
  'HS编码': 'customerHsCode',
  'HS CODE海关编码*': 'customerHsCode',
  'HS CODE海关编码': 'customerHsCode',
  
  // 原产国/进口国
  '原产国': 'originCountry',
  '进口国': 'importCountry',
  
  // 数量信息
  '商品箱数CTNS*': 'cartonCount',
  '商品箱数 CTNS*': 'cartonCount',
  '商品箱数': 'cartonCount',
  '商品件数PCS*': 'quantity',
  '商品件数 PCS*': 'quantity',
  '商品件数': 'quantity',
  '商品总件数PCS*': 'quantity',
  '商品总件数 PCS*': 'quantity',
  '商品总件数': 'quantity',
  '数量': 'quantity',
  '件数': 'quantity',
  'PCS': 'quantity',
  
  // 价格信息 - 新版简化字段名
  '申报单价*': 'unitPrice',
  '申报单价': 'unitPrice',
  '商品申报单价*': 'unitPrice',
  '商品申报单价': 'unitPrice',
  '单价': 'unitPrice',
  '申报总价*': 'totalValue',
  '申报总价': 'totalValue',
  '商品申报总价*': 'totalValue',
  '商品申报总价': 'totalValue',
  '货值': 'totalValue',
  '总价': 'totalValue',
  '金额': 'totalValue',
  
  // 重量信息 - 新版字段名
  '总毛重KG*': 'grossWeight',
  '总毛重KG': 'grossWeight',
  '商品毛重*': 'grossWeight',
  '商品毛重': 'grossWeight',
  '毛重': 'grossWeight',
  '总净重KG*': 'netWeight',
  '总净重KG': 'netWeight',
  '商品净重*': 'netWeight',
  '商品净重': 'netWeight',
  '净重': 'netWeight',
  '单件净重*': 'unitNetWeight',
  '单件净重': 'unitNetWeight',
  
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
 * 提取Excel中的DISPIMG格式图片（WPS/Excel 365动态图片）
 * @param {string} filePath - Excel文件路径
 * @param {string} batchId - 批次ID用于命名图片
 * @returns {Promise<Object>} 图片ID到文件路径的映射
 */
async function extractDispImgImages(filePath, batchId) {
  const imageIdToPath = {}
  
  try {
    const zip = new AdmZip(filePath)
    const zipEntries = zip.getEntries()
    
    // 检查是否存在cellimages相关文件
    const hasCellImages = zipEntries.some(e => e.entryName.includes('cellimages'))
    if (!hasCellImages) {
      console.log('Excel文件不包含DISPIMG格式图片')
      return imageIdToPath
    }
    
    // 读取cellimages.xml.rels获取rId到图片文件的映射
    const rIdToImage = {}
    const relsEntry = zipEntries.find(e => e.entryName === 'xl/_rels/cellimages.xml.rels')
    if (relsEntry) {
      const relsContent = zip.readAsText(relsEntry)
      // 解析Relationship标签
      const relMatches = relsContent.matchAll(/Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]+)"/g)
      for (const match of relMatches) {
        const rId = match[1]
        const target = match[2]
        rIdToImage[rId] = target
      }
      console.log(`找到 ${Object.keys(rIdToImage).length} 个图片关系映射`)
    }
    
    // 读取cellimages.xml获取图片ID到rId的映射
    const imageIdToRId = {}
    const cellImagesEntry = zipEntries.find(e => e.entryName === 'xl/cellimages.xml')
    if (cellImagesEntry) {
      const cellImagesContent = zip.readAsText(cellImagesEntry)
      // 解析cellImage中的name和r:embed
      // 格式: name="ID_xxx" ... r:embed="rId1"
      const imgMatches = cellImagesContent.matchAll(/name="(ID_[^"]+)"[^>]*>.*?r:embed="(rId\d+)"/gs)
      for (const match of imgMatches) {
        const imageId = match[1]
        const rId = match[2]
        imageIdToRId[imageId] = rId
      }
      console.log(`找到 ${Object.keys(imageIdToRId).length} 个图片ID映射`)
    }
    
    // 提取并保存图片
    for (const [imageId, rId] of Object.entries(imageIdToRId)) {
      const imageTarget = rIdToImage[rId]
      if (!imageTarget) continue
      
      // 图片路径: xl/media/image1.png -> 完整路径: xl/media/image1.png
      const imagePath = imageTarget.startsWith('media/') ? `xl/${imageTarget}` : imageTarget
      const imageEntry = zipEntries.find(e => e.entryName === imagePath)
      
      if (imageEntry) {
        try {
          const imageBuffer = zip.readFile(imageEntry)
          const ext = path.extname(imagePath) || '.png'
          const fileName = `${batchId}_${imageId}${ext}`
          const savePath = path.join(UPLOAD_DIR, fileName)
          
          // 使用图片增强处理（放大+锐化+提升清晰度+压缩）
          const result = await enhanceImage(imageBuffer, savePath)
          // 获取实际保存的文件名（可能PNG被转为JPG）
          const actualPath = result && result.outputPath ? result.outputPath : savePath
          const actualFileName = path.basename(actualPath)
          imageIdToPath[imageId] = `/uploads/cargo-images/${actualFileName}`
          console.log(`保存图片(已增强): ${imageId} -> ${actualFileName}`)
        } catch (saveErr) {
          console.warn(`保存图片 ${imageId} 失败:`, saveErr.message)
        }
      }
    }
    
    console.log(`成功提取 ${Object.keys(imageIdToPath).length} 张DISPIMG图片`)
  } catch (err) {
    console.warn('提取DISPIMG图片失败:', err.message)
  }
  
  return imageIdToPath
}

/**
 * 从单元格值中提取DISPIMG图片ID
 * @param {string} cellValue - 单元格值（可能包含DISPIMG公式）
 * @returns {string|null} 图片ID或null
 */
function extractDispImgId(cellValue) {
  if (!cellValue || typeof cellValue !== 'string') return null
  
  // 匹配 =_xlfn.DISPIMG("ID_xxx") 或 DISPIMG("ID_xxx")
  const match = cellValue.match(/DISPIMG\s*\(\s*"(ID_[^"]+)"/i)
  if (match) {
    return match[1]
  }
  return null
}

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
    // 确保上传目录存在
    if (!fs.existsSync(UPLOAD_DIR)) {
      console.log(`创建图片上传目录: ${UPLOAD_DIR}`)
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }
    
    const workbook = new ExcelJS.Workbook()
    console.log(`开始读取Excel文件: ${filePath}`)
    await workbook.xlsx.readFile(filePath)
    console.log('Excel文件读取成功')
    
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
          } else if (value.formula) {
            // 处理公式单元格（如DISPIMG图片公式）
            value = value.formula
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
    
    // ========== 读取顶部的柜号/集装箱号和总体积信息 ==========
    let globalContainerNo = ''
    let globalVolume = ''
    
    // 检查前几行是否包含柜号信息（支持多种格式）
    // 格式1：柜号* | OOCU9301500 | ... | 总体积* | 68
    // 格式2：集装箱号 | ECMU1234567
    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      const rowData = rows[i].data
      for (let j = 0; j < rowData.length - 1; j++) {
        const cellValue = String(rowData[j] || '').trim()
        const nextValue = String(rowData[j + 1] || '').trim()
        
        // 查找柜号/集装箱号
        if ((cellValue === '柜号*' || cellValue === '柜号' || cellValue === '集装箱号' || cellValue === '集装箱号*') && nextValue && !nextValue.includes('*')) {
          globalContainerNo = nextValue
          console.log(`从顶部读取到集装箱号: ${globalContainerNo}`)
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
    // 支持新旧模板的关键字
    const keyColumns = ['英文品名', '中文品名', 'HS编码', 'HS CODE', '商品箱数', '商品件数', '申报单价', '申报总价', '总毛重', '总净重', '序号']
    
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const rowStr = rows[i].data.join(' ')
      const matchCount = keyColumns.filter(key => rowStr.includes(key)).length
      if (matchCount >= 3) {
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
        console.log(`找到图片列: 第${index + 1}列 (${header})`)
      }
    })
    
    // 提取图片信息 - 创建行号到图片的映射
    const rowImages = {}
    
    // 生成批次ID用于图片命名
    const batchId = Date.now().toString(36)
    
    // ========== 方法1: 提取DISPIMG格式图片（WPS/Excel 365） ==========
    const dispImgMap = await extractDispImgImages(filePath, batchId)
    const hasDispImg = Object.keys(dispImgMap).length > 0
    console.log(`DISPIMG图片数量: ${Object.keys(dispImgMap).length}`)
    
    // ========== 方法2: 提取传统嵌入式图片（ExcelJS方式） ==========
    let images = []
    try {
      images = worksheet.getImages() || []
    } catch (imgListErr) {
      console.warn('获取嵌入式图片列表失败:', imgListErr.message)
      images = []
    }
    console.log(`嵌入式图片数量: ${images.length}`)
    
    // 安全检查 workbook.model.media
    const mediaArray = workbook.model?.media || []
    const mediaCount = mediaArray.length
    console.log(`Workbook media 数量: ${mediaCount}`)
    
    // 处理传统嵌入式图片
    if (images.length > 0 && mediaCount > 0) {
      for (let idx = 0; idx < images.length; idx++) {
        const image = images[idx]
        try {
          // 打印图片信息用于调试
          if (idx < 3) {
            console.log(`嵌入式图片${idx}:`, JSON.stringify({
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
            const imageData = mediaArray.find(m => m.index === imageId)
            
            if (imageData && imageData.buffer) {
              try {
                // 确定图片扩展名
                const ext = imageData.extension || 'png'
                const fileName = `${batchId}_row${imageRow}_${Date.now()}.${ext}`
                const imageFilePath = path.join(UPLOAD_DIR, fileName)
                
                // 使用图片增强处理（放大+锐化+提升清晰度+压缩）
                const result = await enhanceImage(imageData.buffer, imageFilePath)
                
                // 获取实际保存的文件名（可能PNG被转为JPG）
                const actualPath = result && result.outputPath ? result.outputPath : imageFilePath
                const actualFileName = path.basename(actualPath)
                
                // 存储图片路径（可能一行有多个图片，这里取第一个）
                if (!rowImages[imageRow]) {
                  rowImages[imageRow] = `/uploads/cargo-images/${actualFileName}`
                }
                console.log(`保存嵌入式图片(已增强): 行${imageRow} -> ${actualFileName}`)
              } catch (saveErr) {
                console.warn(`保存嵌入式图片到行${imageRow}失败:`, saveErr.message)
              }
            }
          }
        } catch (imgErr) {
          console.warn(`处理嵌入式图片${idx}时出错:`, imgErr.message)
        }
      }
    }
    
    console.log(`成功提取 ${Object.keys(rowImages).length} 张嵌入式图片`)
    
    // 如果有DISPIMG图片，后续在处理每行数据时会根据单元格中的ID匹配
    // 将DISPIMG映射传递给后续处理
    const dispImgImageMap = hasDispImg ? dispImgMap : null
    
    // 转换为对象数组（从标题行之后开始）
    const dataRecords = []
    const headerActualRow = rows[headerRowIndex].rowNumber
    
    // 用于继承的上一行数据（处理一个托盘多产品的情况）
    let lastCustomerOrderNo = ''
    let lastPalletCount = ''
    
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
      
      // 跳过备注行（包含"此列有公式"等说明性文字）
      if (rowStr.includes('此列有公式') || rowStr.includes('这两列')) {
        console.log(`跳过备注行: 第${rowNumber}行`)
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
      
      // ========== 处理一个托盘多产品的继承关系 ==========
      // 查找客户单号和托盘件数的列
      const customerOrderNoKey = headers.find(h => h.includes('客户单号'))
      const palletCountKey = headers.find(h => h.includes('托盘件数'))
      
      // 如果当前行有客户单号，更新继承值
      if (customerOrderNoKey && record[customerOrderNoKey]) {
        lastCustomerOrderNo = record[customerOrderNoKey]
        if (palletCountKey && record[palletCountKey]) {
          lastPalletCount = record[palletCountKey]
        }
      } else {
        // 如果当前行没有客户单号，继承上一行的值
        if (customerOrderNoKey && lastCustomerOrderNo) {
          record[customerOrderNoKey] = lastCustomerOrderNo
          record['_inheritedCustomerOrderNo'] = true // 标记为继承
        }
        if (palletCountKey && lastPalletCount && !record[palletCountKey]) {
          record[palletCountKey] = lastPalletCount
          record['_inheritedPalletCount'] = true // 标记为继承
        }
      }
      
      // 应用全局柜号/集装箱号（如果记录中没有）
      if (globalContainerNo) {
        if (!record['柜号*'] && !record['柜号'] && !record['集装箱号']) {
          record['集装箱号'] = globalContainerNo
        }
      }
      
      // ========== 添加图片路径（支持多种方式） ==========
      // 方式1: 传统嵌入式图片（按行号匹配）
      if (rowImages[rowNumber]) {
        record['productImage'] = rowImages[rowNumber]
      }
      
      // 方式2: DISPIMG格式图片（从单元格公式中提取ID匹配）
      if (dispImgImageMap && imageColumnIndex >= 0) {
        const imageCellValue = rowData[imageColumnIndex] || ''
        const dispImgId = extractDispImgId(imageCellValue)
        if (dispImgId && dispImgImageMap[dispImgId]) {
          record['productImage'] = dispImgImageMap[dispImgId]
          console.log(`行${rowNumber}: 匹配DISPIMG图片 ${dispImgId}`)
        }
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
 * 校验单条数据 - 根据最新客户Excel模板格式（2024版）
 * 注意：
 * 1. 柜号/集装箱号可能是合并单元格，所以不作为必填项
 * 2. 一个托盘下可能有多个产品，客户单号只在首行填写
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
  
  // 重量信息
  const grossWeight = parseFloat(item.grossWeight) || 0
  const netWeight = parseFloat(item.netWeight) || 0
  const unitNetWeight = parseFloat(item.unitNetWeight) || 0

  // 计算总价（如果没有提供）
  const calculatedTotalValue = totalValue > 0 ? totalValue : (quantity * unitPrice)
  
  // 计算单件净重（如果没有提供但有净重和件数）
  const calculatedUnitNetWeight = unitNetWeight > 0 ? unitNetWeight : (quantity > 0 ? netWeight / quantity : 0)

  return {
    rowNo,
    // 基本信息
    containerNo: item.containerNo?.trim() || '',
    serialNo: item.serialNo?.trim() || '',
    productCode: item.productCode?.trim() || '',
    palletCount: parseFloat(item.palletCount) || 0,
    referenceNo: item.referenceNo?.trim() || '',
    customerOrderNo: item.customerOrderNo?.trim() || '', // 客户单号
    
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
    netWeight: netWeight,
    unitNetWeight: calculatedUnitNetWeight, // 单件净重（新增）
    
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
 * 检查是否存在相同集装箱号的导入批次
 * @param {string} containerNo - 集装箱号
 * @returns {Promise<Array>} 存在的批次列表
 */
export async function findExistingImportsByContainer(containerNo) {
  if (!containerNo) return []
  
  const db = getDatabase()
  const rows = await db.prepare(`
    SELECT id, import_no, container_no, total_items, status, created_at
    FROM cargo_imports 
    WHERE container_no = $1
    ORDER BY created_at DESC
  `).all(containerNo.trim())
  
  return rows || []
}

/**
 * 删除指定的导入批次（包括关联的货物明细）
 * @param {Array<number>} importIds - 要删除的批次ID列表
 * @returns {Promise<number>} 删除的批次数量
 */
export async function deleteImportsByIds(importIds) {
  if (!importIds || importIds.length === 0) return 0
  
  const db = getDatabase()
  
  // 由于外键CASCADE设置，删除主表会自动删除明细
  const placeholders = importIds.map((_, i) => `$${i + 1}`).join(',')
  await db.prepare(`
    DELETE FROM cargo_imports WHERE id IN (${placeholders})
  `).run(...importIds)
  
  console.log(`已删除 ${importIds.length} 个旧的导入批次`)
  return importIds.length
}

/**
 * 创建货物导入批次
 * @param {Object} data - 批次数据
 * @param {Object} options - 选项
 * @param {boolean} options.overwriteExisting - 是否覆盖已存在的同集装箱号批次（默认true）
 */
export async function createImportBatch(data, options = {}) {
  const { overwriteExisting = true } = options
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 如果开启覆盖模式，检查并删除已存在的同集装箱号批次
  if (overwriteExisting && data.containerNo) {
    const existingImports = await findExistingImportsByContainer(data.containerNo)
    if (existingImports.length > 0) {
      const idsToDelete = existingImports.map(imp => imp.id)
      console.log(`发现 ${existingImports.length} 个相同集装箱号(${data.containerNo})的批次，将覆盖更新`)
      await deleteImportsByIds(idsToDelete)
    }
  }
  
  const importNo = generateImportNo()

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
 * 批量插入货物明细（优化版：使用多行 INSERT 批量插入）
 * PostgreSQL 支持一条 INSERT 插入多行，大幅提升性能
 */
export async function insertCargoItems(importId, items) {
  const { query } = await import('../../config/database.js')
  const now = new Date().toISOString()
  let insertedCount = 0
  let skippedCount = 0

  // 过滤掉有错误的数据
  const validItems = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.error) {
      skippedCount++
      continue
    }
    validItems.push({
      ...item,
      itemNo: item.rowNo || (i + 1)
    })
  }

  // 使用多行 INSERT 批量插入（一次插入最多 50 条）
  if (validItems.length > 0) {
    const BATCH_SIZE = 50  // 每批插入的数量
    
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batch = validItems.slice(i, i + BATCH_SIZE)
      
      // 构建 VALUES 子句和参数数组
      const values = []
      const params = []
      let paramIndex = 1
      
      for (const item of batch) {
        const placeholders = []
        for (let j = 0; j < 20; j++) {
          placeholders.push(`$${paramIndex++}`)
        }
        values.push(`(${placeholders.join(', ')})`)
        
        params.push(
          importId,
          item.itemNo,
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
          item.customerOrderNo || null,
          item.palletCount || null,
          item.referenceNo || null,
          'pending',
          now
        )
      }
      
      // 执行批量插入
      const sql = `
        INSERT INTO cargo_items (
          import_id, item_no, product_name, product_name_en, customer_hs_code,
          quantity, unit_code, unit_name, unit_price, total_value,
          gross_weight, net_weight, origin_country, material,
          product_image, customer_order_no, pallet_count, reference_no,
          match_status, created_at
        ) VALUES ${values.join(', ')}
      `
      
      await query(sql, params)
    }
    
    insertedCount = validItems.length
  }

  // 更新导入批次的商品总数
  await query(
    'UPDATE cargo_imports SET total_items = $1, updated_at = $2 WHERE id = $3',
    [insertedCount, now, importId]
  )

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
      productImage: row.product_image || null,
      customerOrderNo: row.customer_order_no || null,
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

/**
 * 从提单同步发货方信息
 * 根据 cargo_imports 的 bill_number 或 order_id 查找关联的提单，获取 shipper 信息
 * 注意：bills_of_lading 表只有 shipper 字段，没有 shipper_address 和 shipper_contact
 */
export async function syncShipperFromBL(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 1. 获取导入批次信息
  const importBatch = await db.prepare(
    'SELECT id, bill_number, order_id FROM cargo_imports WHERE id = ?'
  ).get(importId)
  
  if (!importBatch) {
    throw new Error('找不到导入批次')
  }
  
  // 2. 根据 bill_number 或 order_id 查找提单
  // bills_of_lading 表只有 shipper 字段
  let billInfo = null
  
  if (importBatch.bill_number) {
    billInfo = await db.prepare(
      'SELECT id, shipper FROM bills_of_lading WHERE bill_number = ?'
    ).get(importBatch.bill_number)
  }
  
  // 如果通过 bill_number 没找到，尝试通过 order_id
  if (!billInfo && importBatch.order_id) {
    billInfo = await db.prepare(
      'SELECT id, shipper FROM bills_of_lading WHERE id = ?'
    ).get(importBatch.order_id)
  }
  
  if (!billInfo) {
    throw new Error('找不到关联的提单，请确保已设置正确的提单号')
  }
  
  if (!billInfo.shipper) {
    throw new Error('提单中没有发货人(Shipper)信息')
  }
  
  // 3. 更新 cargo_imports 的发货方信息（只更新 shipper_name）
  await db.prepare(`
    UPDATE cargo_imports SET
      shipper_name = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    billInfo.shipper,
    now,
    importId
  )
  
  return {
    shipperName: billInfo.shipper,
    shipperAddress: null,
    shipperContact: null,
    source: 'bill_of_lading'
  }
}

/**
 * 批量重新处理已有图片（增强清晰度+裁剪电商截图）
 * @param {Object} options - 处理选项
 * @returns {Promise<Object>} 处理结果
 */
export async function reprocessAllImages(options = {}) {
  const { 
    batchId = null,      // 指定批次ID，null表示全部
    forceAll = false,    // 是否强制处理所有图片（包括已处理的）
    limit = 100          // 一次最多处理的图片数量
  } = options
  
  const results = {
    total: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    details: []
  }
  
  try {
    // 获取所有图片文件
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    
    results.total = files.length
    console.log(`开始批量处理图片，共 ${files.length} 个文件`)
    
    // 如果指定了批次ID，只处理该批次的图片
    const filteredFiles = batchId 
      ? files.filter(f => f.startsWith(batchId))
      : files
    
    // 限制处理数量
    const toProcess = filteredFiles.slice(0, limit)
    
    for (const fileName of toProcess) {
      const filePath = path.join(UPLOAD_DIR, fileName)
      const backupPath = path.join(UPLOAD_DIR, `_backup_${fileName}`)
      
      try {
        // 检查是否已处理过（通过检查备份文件）
        if (!forceAll && fs.existsSync(backupPath)) {
          results.skipped++
          continue
        }
        
        // 读取原始图片
        const imageBuffer = fs.readFileSync(filePath)
        
        // 备份原图
        fs.copyFileSync(filePath, backupPath)
        
        // 使用增强处理
        const result = await enhanceImage(imageBuffer, filePath)
        const success = result && (result.success || result === true)
        
        if (success) {
          results.processed++
          const newFileName = result.outputPath ? path.basename(result.outputPath) : fileName
          results.details.push({
            file: fileName,
            newFile: newFileName !== fileName ? newFileName : undefined,
            status: 'success'
          })
          console.log(`  ✓ ${fileName}${newFileName !== fileName ? ` -> ${newFileName}` : ''}`)
        } else {
          results.failed++
          results.details.push({
            file: fileName,
            status: 'failed',
            reason: '处理失败'
          })
        }
      } catch (err) {
        results.failed++
        results.details.push({
          file: fileName,
          status: 'error',
          reason: err.message
        })
        console.warn(`  ✗ ${fileName}: ${err.message}`)
      }
    }
    
    console.log(`批量处理完成: 成功${results.processed}, 跳过${results.skipped}, 失败${results.failed}`)
    
  } catch (err) {
    console.error('批量处理图片失败:', err)
    throw err
  }
  
  return results
}

/**
 * 重新处理单张图片
 * @param {string} imagePath - 图片路径（如 /uploads/cargo-images/xxx.png）
 * @param {Object} options - 处理选项
 * @returns {Promise<Object>}
 */
export async function reprocessSingleImage(imagePath, options = {}) {
  const { forceAi = false } = options
  
  try {
    // 转换为本地文件路径
    const localPath = imagePath.startsWith('/uploads')
      ? path.join(__dirname, '../..', imagePath)
      : imagePath
    
    if (!fs.existsSync(localPath)) {
      return { success: false, error: '图片文件不存在' }
    }
    
    // 备份原图
    const backupPath = localPath.replace(/(\.\w+)$/, '_backup$1')
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(localPath, backupPath)
    }
    
    // 读取原始图片（从备份恢复原图进行处理）
    const sourceFile = fs.existsSync(backupPath) ? backupPath : localPath
    const imageBuffer = fs.readFileSync(sourceFile)
    
    console.log(`重新处理图片: ${localPath}, 强制AI: ${forceAi}`)
    
    // 如果强制使用AI增强
    if (forceAi) {
      const aiSuccess = await aiSuperResolution(imageBuffer, localPath)
      if (aiSuccess) {
        const stats = fs.statSync(localPath)
        const metadata = await sharp(localPath).metadata()
        return {
          success: true,
          method: 'ai_super_resolution',
          originalPath: imagePath,
          size: stats.size,
          width: metadata.width,
          height: metadata.height
        }
      } else {
        // AI失败，回退到传统方法
        console.log('AI增强失败，使用传统方法')
      }
    }
    
    // 传统增强处理
    const result = await enhanceImage(imageBuffer, localPath)
    const success = result && (result.success || result === true)
    const finalPath = result && result.outputPath ? result.outputPath : localPath
    
    // 获取处理后的信息
    const stats = fs.statSync(finalPath)
    const metadata = await sharp(finalPath).metadata()
    
    return {
      success,
      method: 'traditional',
      originalPath: imagePath,
      newPath: finalPath !== localPath ? finalPath : undefined,
      size: stats.size,
      width: metadata.width,
      height: metadata.height
    }
  } catch (err) {
    console.error('重新处理图片失败:', err)
    return { success: false, error: err.message }
  }
}

export default {
  generateImportNo,
  parseCSVContent,
  parseExcelFile,
  getFileType,
  mapFieldNames,
  validateItem,
  parseAndPreview,
  findExistingImportsByContainer,
  deleteImportsByIds,
  createImportBatch,
  insertCargoItems,
  getImportList,
  getImportById,
  getCargoItems,
  deleteImportBatch,
  updateImportStatus,
  updateImportStats,
  updateShipperAndImporter,
  syncShipperFromBL,
  reprocessAllImages,
  reprocessSingleImage
}
