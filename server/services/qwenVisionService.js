/**
 * 阿里通义千问 Qwen-VL 视觉分析服务
 * 用于分析产品图片，识别材质并建议HS编码
 * 集成API使用日志记录
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '../config/database.js'

const API_CODE = 'aliyun_qwen_vl'
const COST_PER_1K_TOKENS = 0.008  // 约每1000 token 0.008元（qwen-vl-plus定价）

// 创建OpenAI客户端（兼容阿里云DashScope）
let client = null

function getClient() {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      throw new Error('未配置DASHSCOPE_API_KEY环境变量')
    }
    
    client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    })
  }
  return client
}

/**
 * 记录AI调用日志
 */
async function logUsage({
  userId,
  userName,
  requestType,
  imagePath,
  productName,
  success,
  responseSummary,
  errorMessage,
  promptTokens,
  completionTokens,
  totalTokens,
  responseTimeMs,
  importId,
  cargoItemId
}) {
  try {
    const db = getDatabase()
    
    // 计算预估成本
    const estimatedCost = (totalTokens / 1000) * COST_PER_1K_TOKENS
    
    // 插入详细日志
    await db.prepare(`
      INSERT INTO ai_usage_logs (
        api_code, user_id, user_name, request_type,
        image_path, product_name,
        success, response_summary, error_message,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, currency, response_time_ms,
        import_id, cargo_item_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `).run(
      API_CODE,
      userId || null,
      userName || null,
      requestType || 'image_analysis',
      imagePath || null,
      productName || null,
      success,
      responseSummary || null,
      errorMessage || null,
      promptTokens || 0,
      completionTokens || 0,
      totalTokens || 0,
      estimatedCost,
      'CNY',
      responseTimeMs || 0,
      importId || null,
      cargoItemId || null
    )
    
    // 更新每日统计（api_usage_records）
    const today = new Date().toISOString().split('T')[0]
    
    // 检查今天的记录是否存在
    const existingRecord = await db.prepare(`
      SELECT id FROM api_usage_records 
      WHERE api_code = $1 AND usage_date = $2
    `).get(API_CODE, today)
    
    if (existingRecord) {
      // 更新现有记录
      await db.prepare(`
        UPDATE api_usage_records SET
          call_count = call_count + 1,
          success_count = success_count + $1,
          fail_count = fail_count + $2,
          data_volume = data_volume + $3,
          cost = cost + $4,
          updated_at = NOW()
        WHERE api_code = $5 AND usage_date = $6
      `).run(
        success ? 1 : 0,
        success ? 0 : 1,
        totalTokens || 0,
        estimatedCost,
        API_CODE,
        today
      )
    } else {
      // 插入新记录
      await db.prepare(`
        INSERT INTO api_usage_records (
          api_code, usage_date, call_count, success_count, fail_count, data_volume, cost
        ) VALUES ($1, $2, 1, $3, $4, $5, $6)
      `).run(
        API_CODE,
        today,
        success ? 1 : 0,
        success ? 0 : 1,
        totalTokens || 0,
        estimatedCost
      )
    }
    
    // 更新API余额
    if (success && totalTokens > 0) {
      await db.prepare(`
        UPDATE api_integrations SET
          balance = balance - $1,
          total_consumed = total_consumed + $1,
          updated_at = NOW()
        WHERE api_code = $2
      `).run(totalTokens, API_CODE)
    }
    
  } catch (error) {
    console.error('记录AI使用日志失败:', error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 将本地图片转换为Base64
 * @param {string} imagePath - 图片路径
 * @returns {string} Base64编码的图片
 */
function imageToBase64(imagePath) {
  const absolutePath = path.resolve(imagePath)
  const imageBuffer = fs.readFileSync(absolutePath)
  const base64 = imageBuffer.toString('base64')
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  return `data:${mimeType};base64,${base64}`
}

/**
 * 分析产品图片
 * @param {string} imageSource - 图片URL或本地路径
 * @param {string} productName - 产品名称（可选，用于辅助分析）
 * @param {Object} context - 上下文信息（用于日志记录）
 * @returns {Promise<Object>} 分析结果
 */
export async function analyzeProductImage(imageSource, productName = '', context = {}) {
  const startTime = Date.now()
  
  try {
    const openai = getClient()
    
    // 判断是URL还是本地文件
    let imageUrl
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      imageUrl = imageSource
    } else if (imageSource.startsWith('data:')) {
      imageUrl = imageSource
    } else {
      // 本地文件，转换为Base64
      imageUrl = imageToBase64(imageSource)
    }
    
    const prompt = `你是一位专业的产品材质分析师。请仔细分析这张产品图片，提供详细的材质信息，帮助海关人员判断商品分类。

请提供以下信息：

1. **产品描述**：详细描述图片中产品的外观、结构、组成部件
2. **主要材质**：识别产品的主要材质成分，请尽可能具体（如：不锈钢304、ABS塑料、钢化玻璃、100%棉、聚酯纤维等）
3. **材质占比**：估算各材质在产品中的大致占比（如：金属60%、塑料30%、其他10%）
4. **表面处理**：描述产品表面的处理工艺（如：电镀、喷涂、抛光、印刷等）
5. **产品用途**：推测产品的主要使用场景和功能
6. **特殊说明**：任何有助于海关分类的额外信息（如：是否含电子元件、是否需要电源、是否可食用接触等）

${productName ? `参考信息：产品名称为"${productName}"` : ''}

请以JSON格式返回，结构如下：
{
  "productDescription": "详细的产品描述",
  "mainMaterial": "主要材质（最具体的描述）",
  "materialBreakdown": [
    {"material": "材质名称", "percentage": "占比", "location": "应用部位"}
  ],
  "surfaceTreatment": "表面处理工艺",
  "usage": "产品用途和使用场景",
  "specialNotes": "特殊说明（电子元件、电源需求等）"
}`

    const response = await openai.chat.completions.create({
      model: 'qwen-vl-plus', // 通义千问视觉增强版
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 1500
    })

    const responseTime = Date.now() - startTime
    const content = response.choices[0]?.message?.content || ''
    const usage = response.usage || {}
    
    // 尝试解析JSON响应
    let result
    try {
      // 提取JSON部分（处理可能包含的markdown代码块）
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = {
          productDescription: content,
          mainMaterial: '无法解析',
          usage: '无法解析',
          materialBreakdown: [],
          raw: content
        }
      }
    } catch (parseError) {
      result = {
        productDescription: content,
        mainMaterial: '无法解析',
        usage: '无法解析',
        materialBreakdown: [],
        raw: content
      }
    }
    
    // 记录使用日志
    await logUsage({
      userId: context.userId,
      userName: context.userName,
      requestType: 'image_analysis',
      imagePath: imageSource,
      productName: productName,
      success: true,
      responseSummary: result.mainMaterial || '分析完成',
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      responseTimeMs: responseTime,
      importId: context.importId,
      cargoItemId: context.cargoItemId
    })
    
    return {
      success: true,
      data: result,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        responseTimeMs: responseTime
      }
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('通义千问视觉分析错误:', error)
    
    // 记录失败日志
    await logUsage({
      userId: context.userId,
      userName: context.userName,
      requestType: 'image_analysis',
      imagePath: imageSource,
      productName: productName,
      success: false,
      errorMessage: error.message || '未知错误',
      responseTimeMs: responseTime,
      importId: context.importId,
      cargoItemId: context.cargoItemId
    })
    
    return {
      success: false,
      error: error.message || '分析失败',
      errorCode: error.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 检查服务是否可用
 * @returns {boolean}
 */
export function isServiceAvailable() {
  return !!process.env.DASHSCOPE_API_KEY
}

/**
 * 获取API使用统计
 */
export async function getUsageStats(days = 30) {
  try {
    const db = getDatabase()
    
    // 获取总体统计
    const totalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_calls,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        AVG(response_time_ms) as avg_response_time
      FROM ai_usage_logs
      WHERE api_code = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
    `).get(API_CODE)
    
    // 获取每日统计
    const dailyStats = await db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as calls,
        SUM(total_tokens) as tokens,
        SUM(estimated_cost) as cost
      FROM ai_usage_logs
      WHERE api_code = $1
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(API_CODE)
    
    // 获取余额信息
    const apiInfo = await db.prepare(`
      SELECT balance, total_consumed, alert_threshold
      FROM api_integrations
      WHERE api_code = $1
    `).get(API_CODE)
    
    return {
      totalStats: {
        totalCalls: parseInt(totalStats?.total_calls) || 0,
        successCalls: parseInt(totalStats?.success_calls) || 0,
        totalTokens: parseInt(totalStats?.total_tokens) || 0,
        totalCost: parseFloat(totalStats?.total_cost) || 0,
        avgResponseTime: Math.round(parseFloat(totalStats?.avg_response_time) || 0)
      },
      dailyStats: dailyStats || [],
      balance: {
        remaining: parseFloat(apiInfo?.balance) || 0,
        consumed: parseFloat(apiInfo?.total_consumed) || 0,
        alertThreshold: parseFloat(apiInfo?.alert_threshold) || 0
      }
    }
  } catch (error) {
    console.error('获取AI使用统计失败:', error)
    return null
  }
}

/**
 * 获取最近调用记录
 */
export async function getRecentLogs(limit = 50) {
  try {
    const db = getDatabase()
    
    const logs = await db.prepare(`
      SELECT 
        id, user_name, request_type, product_name,
        success, response_summary, error_message,
        total_tokens, estimated_cost, response_time_ms,
        created_at
      FROM ai_usage_logs
      WHERE api_code = $1
      ORDER BY created_at DESC
      LIMIT $2
    `).all(API_CODE, limit)
    
    return logs || []
  } catch (error) {
    console.error('获取AI调用记录失败:', error)
    return []
  }
}
