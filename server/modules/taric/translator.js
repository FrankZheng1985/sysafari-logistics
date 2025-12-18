/**
 * 翻译服务模块
 * 使用 Google Translate 免费 API 将英文翻译成中文
 * 支持错误重试和断点续传
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 翻译缓存（避免重复翻译相同内容）
const translationCache = new Map()

// 翻译进度文件路径
const PROGRESS_FILE = path.join(__dirname, '../../data/translation_progress.json')

// 翻译任务状态
let translateTaskStatus = {
  running: false,
  total: 0,
  completed: 0,
  failed: 0,
  startTime: null,
  lastError: null
}

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  const dataDir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

/**
 * 保存翻译进度到文件
 */
function saveProgress(progressData) {
  try {
    ensureDataDir()
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2))
  } catch (error) {
    console.warn('[翻译] 保存进度失败:', error.message)
  }
}

/**
 * 加载翻译进度
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.warn('[翻译] 加载进度失败:', error.message)
  }
  return null
}

/**
 * 清除进度文件
 */
function clearProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE)
    }
  } catch (error) {
    console.warn('[翻译] 清除进度失败:', error.message)
  }
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 使用 Google Translate 免费 API 翻译文本（带重试）
 * @param {string} text - 要翻译的文本
 * @param {string} sourceLang - 源语言（默认 'en'）
 * @param {string} targetLang - 目标语言（默认 'zh-CN'）
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<string>} 翻译后的文本
 */
export async function translateText(text, sourceLang = 'en', targetLang = 'zh-CN', maxRetries = 3) {
  if (!text || text.trim() === '') {
    return ''
  }
  
  // 检查缓存
  const cacheKey = `${sourceLang}:${targetLang}:${text}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }
  
  let lastError = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const encodedText = encodeURIComponent(text)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`
      
      const result = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 15000
        }, (res) => {
          // 检查 HTTP 状态码
          if (res.statusCode === 429) {
            reject(new Error('请求过于频繁，被限流'))
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            try {
              const json = JSON.parse(data)
              // Google Translate 返回格式: [[["翻译结果","原文",null,null,10]],null,"en"]
              if (json && json[0] && Array.isArray(json[0])) {
                const translated = json[0].map(item => item[0]).join('')
                resolve(translated)
              } else {
                reject(new Error('返回格式错误'))
              }
            } catch (e) {
              reject(new Error('JSON解析失败: ' + e.message))
            }
          })
        })
        
        req.on('error', (err) => reject(err))
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('请求超时'))
        })
      })
      
      // 成功，存入缓存
      translationCache.set(cacheKey, result)
      return result
      
    } catch (error) {
      lastError = error
      
      // 如果是限流错误，等待更长时间
      if (error.message.includes('限流') || error.message.includes('429')) {
        const waitTime = attempt * 5000 // 5秒、10秒、15秒
        console.warn(`[翻译] 被限流，等待 ${waitTime/1000} 秒后重试...`)
        await delay(waitTime)
      } else if (attempt < maxRetries) {
        // 其他错误，短暂等待后重试
        await delay(1000 * attempt)
      }
    }
  }
  
  // 所有重试都失败了
  console.error(`[翻译] 翻译失败 (${maxRetries}次重试): ${text.substring(0, 30)}...`, lastError?.message)
  translateTaskStatus.failed++
  return null // 返回 null 表示翻译失败
}

/**
 * 批量翻译文本（带断点续传）
 * @param {string[]} texts - 要翻译的文本数组
 * @param {string} sourceLang - 源语言
 * @param {string} targetLang - 目标语言
 * @param {number} concurrency - 并发数（默认 3）
 * @param {number} delayMs - 每批次之间的延迟（毫秒）
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
export async function batchTranslate(texts, sourceLang = 'en', targetLang = 'zh-CN', concurrency = 3, delayMs = 500) {
  const results = new Array(texts.length).fill(null)
  
  // 尝试加载之前的进度
  const savedProgress = loadProgress()
  let startIndex = 0
  
  if (savedProgress && savedProgress.texts && savedProgress.texts.length === texts.length) {
    // 恢复之前的进度
    startIndex = savedProgress.completedIndex || 0
    savedProgress.results?.forEach((r, i) => {
      if (r !== null) results[i] = r
    })
    console.log(`[翻译] 从断点恢复，已完成 ${startIndex} 条`)
  }
  
  // 分批处理
  for (let i = startIndex; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, Math.min(i + concurrency, texts.length))
    const batchPromises = batch.map((text, idx) => 
      translateText(text, sourceLang, targetLang)
        .then(translated => {
          results[i + idx] = translated
        })
    )
    
    await Promise.all(batchPromises)
    
    // 每处理 50 条保存一次进度
    if ((i + concurrency) % 50 === 0 || i + concurrency >= texts.length) {
      saveProgress({
        texts: texts.slice(0, 100), // 只保存前100个用于验证
        results,
        completedIndex: Math.min(i + concurrency, texts.length),
        timestamp: new Date().toISOString()
      })
    }
    
    // 批次之间添加延迟，避免请求过快
    if (i + concurrency < texts.length && delayMs > 0) {
      await delay(delayMs)
    }
  }
  
  // 完成后清除进度文件
  clearProgress()
  
  return results
}

/**
 * 翻译商品描述（针对 TARIC 数据优化，支持断点续传）
 * @param {Array} items - 包含 goodsDescription 字段的对象数组
 * @param {Function} onProgress - 进度回调 (current, total)
 * @returns {Promise<Array>} 添加了 goodsDescriptionCn 字段的对象数组
 */
export async function translateGoodsDescriptions(items, onProgress) {
  if (translateTaskStatus.running) {
    throw new Error('翻译任务正在运行中')
  }
  
  translateTaskStatus = {
    running: true,
    total: 0,
    completed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    lastError: null
  }
  
  try {
    // 提取所有需要翻译的描述（去重）
    const uniqueDescriptions = [...new Set(items.map(item => item.goodsDescription).filter(d => d && d.trim()))]
    translateTaskStatus.total = uniqueDescriptions.length
    
    console.log(`[翻译] 共 ${uniqueDescriptions.length} 个不重复的商品描述需要翻译`)
    
    // 尝试加载已保存的翻译结果
    const savedProgress = loadProgress()
    const translationMap = new Map()
    
    if (savedProgress?.translationMap) {
      Object.entries(savedProgress.translationMap).forEach(([k, v]) => {
        translationMap.set(k, v)
      })
      console.log(`[翻译] 从缓存恢复 ${translationMap.size} 条翻译`)
    }
    
    // 过滤出需要翻译的（排除已翻译的）
    const toTranslate = uniqueDescriptions.filter(desc => !translationMap.has(desc))
    console.log(`[翻译] 需要新翻译 ${toTranslate.length} 条`)
    
    // 批量翻译
    const batchSize = 5 // 降低并发，避免被限流
    const delayBetweenBatches = 800 // 增加延迟
    
    for (let i = 0; i < toTranslate.length; i += batchSize) {
      const batch = toTranslate.slice(i, i + batchSize)
      
      // 并发翻译这一批
      const translations = await Promise.all(
        batch.map(desc => translateText(desc, 'en', 'zh-CN'))
      )
      
      // 存储翻译结果
      batch.forEach((desc, idx) => {
        if (translations[idx] !== null) {
          translationMap.set(desc, translations[idx])
        }
      })
      
      translateTaskStatus.completed = translationMap.size
      
      if (onProgress) {
        onProgress(translationMap.size, uniqueDescriptions.length)
      }
      
      // 每 100 条保存一次进度
      if ((i + batchSize) % 100 === 0 || i + batchSize >= toTranslate.length) {
        console.log(`[翻译] 进度: ${translationMap.size}/${uniqueDescriptions.length} (失败: ${translateTaskStatus.failed})`)
        
        // 保存进度
        saveProgress({
          translationMap: Object.fromEntries(translationMap),
          completed: translationMap.size,
          total: uniqueDescriptions.length,
          timestamp: new Date().toISOString()
        })
      }
      
      // 延迟，避免请求过快
      if (i + batchSize < toTranslate.length) {
        await delay(delayBetweenBatches)
      }
    }
    
    // 完成后清除进度文件
    clearProgress()
    
    // 应用翻译结果到所有项目
    const result = items.map(item => ({
      ...item,
      goodsDescriptionCn: item.goodsDescription ? translationMap.get(item.goodsDescription) || null : null
    }))
    
    translateTaskStatus.running = false
    return result
    
  } catch (error) {
    translateTaskStatus.running = false
    translateTaskStatus.lastError = error.message
    throw error
  }
}

/**
 * 获取翻译任务状态
 */
export function getTranslateStatus() {
  return { ...translateTaskStatus }
}

/**
 * 清除翻译缓存
 */
export function clearTranslationCache() {
  translationCache.clear()
  clearProgress()
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  return {
    size: translationCache.size,
    entries: Array.from(translationCache.keys()).slice(0, 10)
  }
}

export default {
  translateText,
  batchTranslate,
  translateGoodsDescriptions,
  getTranslateStatus,
  clearTranslationCache,
  getCacheStats
}
