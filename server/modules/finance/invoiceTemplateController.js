/**
 * 发票模板控制器
 * 管理多语言发票模板配置
 */

import { getDatabase, query } from '../../config/database.js'

// 获取数据库实例
const db = getDatabase()

/**
 * 获取所有发票模板
 */
export const getInvoiceTemplates = async (req, res) => {
  try {
    // 首先检查并添加缺失的字段
    await ensureInvoiceTemplateFields()
    
    const rows = await db.prepare(`
      SELECT id, template_name, is_default, languages, content, logo_url, stamp_url, created_at, updated_at
      FROM invoice_templates
      WHERE is_deleted = false
      ORDER BY is_default DESC, created_at DESC
    `).all()
    
    // 转换字段名为驼峰
    const templates = rows.map(row => ({
      id: row.id,
      templateName: row.template_name,
      isDefault: row.is_default,
      languages: row.languages,
      content: row.content,
      logoUrl: row.logo_url,
      stampUrl: row.stamp_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    res.json({ errCode: 200, data: templates })
  } catch (error) {
    console.error('获取发票模板列表失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取发票模板列表失败' })
  }
}

/**
 * 确保发票模板表有必要的字段
 */
async function ensureInvoiceTemplateFields() {
  try {
    // 检查 logo_url 字段是否存在
    const columns = await db.prepare(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'invoice_templates' AND column_name = 'logo_url'
    `).all()
    
    if (columns.length === 0) {
      console.log('[invoiceTemplate] 添加缺失的 logo_url 字段...')
      await db.prepare(`ALTER TABLE invoice_templates ADD COLUMN logo_url VARCHAR(500)`).run()
      await db.prepare(`ALTER TABLE invoice_templates ADD COLUMN stamp_url VARCHAR(500)`).run()
      console.log('[invoiceTemplate] 字段添加成功')
    }
  } catch (e) {
    // 忽略错误（可能字段已存在）
    console.log('[invoiceTemplate] 字段检查/添加:', e.message)
  }
}

/**
 * 获取单个发票模板
 */
export const getInvoiceTemplateById = async (req, res) => {
  try {
    const { id } = req.params
    
    const row = await db.prepare(`
      SELECT id, template_name, is_default, languages, content, logo_url, stamp_url, created_at, updated_at
      FROM invoice_templates
      WHERE id = ? AND is_deleted = false
    `).get(id)
    
    if (!row) {
      return res.status(404).json({ errCode: 404, msg: '模板不存在' })
    }
    
    const template = {
      id: row.id,
      templateName: row.template_name,
      isDefault: row.is_default,
      languages: row.languages,
      content: row.content,
      logoUrl: row.logo_url,
      stampUrl: row.stamp_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    
    res.json({ errCode: 200, data: template })
  } catch (error) {
    console.error('获取发票模板失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取发票模板失败' })
  }
}

/**
 * 获取默认发票模板
 */
export const getDefaultInvoiceTemplate = async (req, res) => {
  try {
    const row = await db.prepare(`
      SELECT id, template_name, is_default, languages, content, logo_url, stamp_url, created_at, updated_at
      FROM invoice_templates
      WHERE is_default = true AND is_deleted = false
      LIMIT 1
    `).get()
    
    if (!row) {
      return res.json({ errCode: 200, data: null })
    }
    
    const template = {
      id: row.id,
      templateName: row.template_name,
      isDefault: row.is_default,
      languages: row.languages,
      content: row.content,
      logoUrl: row.logo_url,
      stampUrl: row.stamp_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    
    res.json({ errCode: 200, data: template })
  } catch (error) {
    console.error('获取默认发票模板失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取默认发票模板失败' })
  }
}

/**
 * 创建发票模板
 */
export const createInvoiceTemplate = async (req, res) => {
  try {
    const { templateName, isDefault, languages, content, logoUrl, stampUrl } = req.body
    
    // 使用事务
    const createTx = db.transaction(async function() {
      // 如果设为默认，先取消其他默认模板
      if (isDefault) {
        await this.prepare(`
          UPDATE invoice_templates SET is_default = false WHERE is_default = true
        `).run()
      }
      
      const result = await this.prepare(`
        INSERT INTO invoice_templates (template_name, is_default, languages, content, logo_url, stamp_url)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `).get(templateName, isDefault || false, JSON.stringify(languages), JSON.stringify(content), logoUrl || null, stampUrl || null)
      
      return result
    })
    
    const result = await createTx()
    
    res.json({ errCode: 200, msg: '创建成功', data: { id: result?.id } })
  } catch (error) {
    console.error('创建发票模板失败:', error)
    res.status(500).json({ errCode: 500, msg: '创建发票模板失败' })
  }
}

/**
 * 更新发票模板
 */
export const updateInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params
    const { templateName, isDefault, languages, content, logoUrl, stampUrl } = req.body
    
    // 检查模板是否存在
    const checkResult = await db.prepare(
      'SELECT id FROM invoice_templates WHERE id = ? AND is_deleted = false'
    ).get(id)
    
    if (!checkResult) {
      return res.status(404).json({ errCode: 404, msg: '模板不存在' })
    }
    
    // 使用事务
    const updateTx = db.transaction(async function(templateId, tplName, tplIsDefault, tplLanguages, tplContent, tplLogoUrl, tplStampUrl) {
      // 如果设为默认，先取消其他默认模板
      if (tplIsDefault) {
        await this.prepare(`
          UPDATE invoice_templates SET is_default = false WHERE is_default = true AND id != ?
        `).run(templateId)
      }
      
      await this.prepare(`
        UPDATE invoice_templates
        SET template_name = ?, is_default = ?, languages = ?, content = ?, logo_url = ?, stamp_url = ?, updated_at = NOW()
        WHERE id = ?
      `).run(tplName, tplIsDefault || false, JSON.stringify(tplLanguages), JSON.stringify(tplContent), tplLogoUrl || null, tplStampUrl || null, templateId)
    })
    
    await updateTx(id, templateName, isDefault, languages, content, logoUrl, stampUrl)
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新发票模板失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新发票模板失败' })
  }
}

/**
 * 删除发票模板
 */
export const deleteInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params
    
    // 检查是否是默认模板
    const checkResult = await db.prepare(
      'SELECT is_default FROM invoice_templates WHERE id = ? AND is_deleted = false'
    ).get(id)
    
    if (!checkResult) {
      return res.status(404).json({ errCode: 404, msg: '模板不存在' })
    }
    
    if (checkResult.is_default) {
      return res.status(400).json({ errCode: 400, msg: '不能删除默认模板' })
    }
    
    // 软删除
    await db.prepare(`
      UPDATE invoice_templates SET is_deleted = true, updated_at = NOW() WHERE id = ?
    `).run(id)
    
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除发票模板失败:', error)
    res.status(500).json({ errCode: 500, msg: '删除发票模板失败' })
  }
}

/**
 * 翻译文本（使用谷歌翻译API）
 */
export const translateTexts = async (req, res) => {
  try {
    const { texts, sourceLang, targetLang } = req.body
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ errCode: 400, msg: '请提供要翻译的文本' })
    }
    
    if (!targetLang) {
      return res.status(400).json({ errCode: 400, msg: '请提供目标语言' })
    }
    
    // 使用谷歌翻译免费API
    const translations = []
    
    for (const text of texts) {
      if (!text || !text.trim()) {
        translations.push(text)
        continue
      }
      
      try {
        // 使用谷歌翻译的免费API端点
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang || 'auto'}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
        
        const response = await fetch(url)
        const data = await response.json()
        
        // 提取翻译结果
        if (data && data[0] && Array.isArray(data[0])) {
          const translated = data[0].map(item => item[0]).join('')
          translations.push(translated)
        } else {
          translations.push(text) // 翻译失败，保留原文
        }
        
        // 添加延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        console.error('翻译单条文本失败:', err)
        translations.push(text) // 翻译失败，保留原文
      }
    }
    
    res.json({ errCode: 200, data: { translations } })
  } catch (error) {
    console.error('翻译失败:', error)
    res.status(500).json({ errCode: 500, msg: '翻译服务暂时不可用' })
  }
}

/**
 * 获取模板按语言获取内容
 */
export const getTemplateByLanguage = async (req, res) => {
  try {
    const { language } = req.params
    
    // 首先获取默认模板
    const template = await db.prepare(`
      SELECT id, template_name, is_default, languages, content
      FROM invoice_templates
      WHERE is_default = true AND is_deleted = false
      LIMIT 1
    `).get()
    
    if (!template) {
      return res.json({ errCode: 200, data: null })
    }
    
    const content = template.content
    
    // 获取指定语言的内容
    let langContent = content[language]
    
    // 如果没有指定语言，尝试降级
    if (!langContent) {
      // 优先使用英语
      if (content['en']) {
        langContent = content['en']
      } else if (content['zh']) {
        langContent = content['zh']
      } else {
        // 使用第一个可用的语言
        const availableLangs = Object.keys(content)
        if (availableLangs.length > 0) {
          langContent = content[availableLangs[0]]
        }
      }
    }
    
    res.json({ errCode: 200, data: langContent || null })
  } catch (error) {
    console.error('获取模板内容失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取模板内容失败' })
  }
}

/**
 * 上传发票模板图片（Logo或公章）
 */
export const uploadTemplateImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ errCode: 400, msg: '请上传图片文件' })
    }
    
    const { type } = req.body // 'logo' 或 'stamp'
    
    if (!['logo', 'stamp'].includes(type)) {
      return res.status(400).json({ errCode: 400, msg: '无效的图片类型' })
    }
    
    // 返回文件的访问URL
    const fileUrl = `/api/invoice-templates/images/${req.file.filename}`
    
    res.json({ 
      errCode: 200, 
      msg: '上传成功', 
      data: { 
        url: fileUrl,
        filename: req.file.filename,
        type 
      } 
    })
  } catch (error) {
    console.error('上传图片失败:', error)
    res.status(500).json({ errCode: 500, msg: '上传图片失败' })
  }
}

/**
 * 获取发票模板图片
 */
export const getTemplateImage = async (req, res) => {
  try {
    const { filename } = req.params
    const path = await import('path')
    const fs = await import('fs')
    const { fileURLToPath } = await import('url')
    
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    
    const filePath = path.join(__dirname, '../../uploads/invoice-templates', filename)
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ errCode: 404, msg: '图片不存在' })
    }
    
    res.sendFile(filePath)
  } catch (error) {
    console.error('获取图片失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取图片失败' })
  }
}
