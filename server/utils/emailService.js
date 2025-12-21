/**
 * 邮件发送服务
 * 使用 nodemailer + SMTP 发送邮件
 */

import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

// SMTP 配置
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false', // 默认true
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || 'Sysafari Logistics <noreply@sysafari.com>'
}

// 邮件传输器实例
let transporter = null

/**
 * 获取邮件传输器
 */
function getTransporter() {
  if (!transporter && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    })
  }
  return transporter
}

/**
 * 检查邮件服务配置是否完整
 */
export function checkEmailConfig() {
  const { host, user, pass } = smtpConfig
  return {
    configured: !!(host && user && pass),
    missing: {
      host: !host,
      user: !user,
      pass: !pass
    }
  }
}

/**
 * 发送报价单邮件
 * @param {Object} options - 邮件选项
 * @param {string} options.to - 收件人邮箱
 * @param {string} options.customerName - 客户名称
 * @param {string} options.quoteNumber - 报价单号
 * @param {string} options.validUntil - 有效期
 * @param {string} options.pdfUrl - PDF在COS的URL（可选）
 * @param {Buffer} options.pdfBuffer - PDF文件Buffer（作为附件）
 * @returns {Promise<Object>} - 发送结果
 */
export async function sendQuotationEmail({ to, customerName, quoteNumber, validUntil, pdfUrl, pdfBuffer }) {
  const transport = getTransporter()
  
  if (!transport) {
    throw new Error('邮件服务未配置，请检查环境变量')
  }
  
  // 邮件主题
  const subject = `【Sysafari Logistics】您的服务报价单 - ${quoteNumber}`
  
  // 邮件正文（HTML格式）
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Sysafari Logistics</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">专业物流服务</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; color: #333;">尊敬的 <strong>${customerName}</strong>：</p>
        
        <p style="font-size: 14px; color: #555; line-height: 1.8;">
          感谢您选择我们的服务！
        </p>
        
        <p style="font-size: 14px; color: #555; line-height: 1.8;">
          附件是我们为您准备的服务报价单，报价有效期至 <strong style="color: #667eea;">${validUntil}</strong>。
        </p>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">报价单信息</p>
          <p style="margin: 0; font-size: 18px; color: #333; font-weight: bold;">${quoteNumber}</p>
        </div>
        
        ${pdfUrl ? `
        <p style="font-size: 14px; color: #555;">
          您也可以通过以下链接在线查看报价单：<br>
          <a href="${pdfUrl}" style="color: #667eea;">${pdfUrl}</a>
        </p>
        ` : ''}
        
        <p style="font-size: 14px; color: #555; line-height: 1.8;">
          如有任何疑问，欢迎随时联系我们。
        </p>
        
        <p style="font-size: 14px; color: #555; margin-top: 30px;">
          祝商祺！<br>
          <strong>Sysafari Logistics 团队</strong>
        </p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #999;">
          此邮件由系统自动发送，请勿直接回复
        </p>
      </div>
    </div>
  `
  
  // 纯文本版本
  const text = `
尊敬的 ${customerName}：

感谢您选择我们的服务！

附件是我们为您准备的服务报价单，报价有效期至 ${validUntil}。

报价单号：${quoteNumber}

${pdfUrl ? `在线查看链接：${pdfUrl}` : ''}

如有任何疑问，欢迎随时联系我们。

祝商祺！
Sysafari Logistics 团队
  `.trim()
  
  // 邮件选项
  const mailOptions = {
    from: smtpConfig.from,
    to,
    subject,
    text,
    html,
    attachments: []
  }
  
  // 添加PDF附件
  if (pdfBuffer) {
    mailOptions.attachments.push({
      filename: `报价单_${quoteNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    })
  }
  
  try {
    const result = await transport.sendMail(mailOptions)
    console.log(`📧 邮件发送成功: ${to}, messageId: ${result.messageId}`)
    return {
      success: true,
      messageId: result.messageId,
      to
    }
  } catch (error) {
    console.error(`📧 邮件发送失败: ${to}`, error)
    throw error
  }
}

/**
 * 批量发送报价单邮件
 * @param {Array<string>} emails - 收件人邮箱列表
 * @param {Object} quotationData - 报价单数据
 * @returns {Promise<Object>} - 发送结果汇总
 */
export async function sendQuotationEmailBatch(emails, quotationData) {
  const results = {
    success: [],
    failed: []
  }
  
  for (const email of emails) {
    try {
      const result = await sendQuotationEmail({
        to: email,
        ...quotationData
      })
      results.success.push({ email, messageId: result.messageId })
    } catch (error) {
      results.failed.push({ email, error: error.message })
    }
  }
  
  return results
}

/**
 * 验证邮件服务连接
 */
export async function verifyConnection() {
  const transport = getTransporter()
  
  if (!transport) {
    return { success: false, error: '邮件服务未配置' }
  }
  
  try {
    await transport.verify()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * 发送通用邮件
 * @param {Object} options - 邮件选项
 */
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const transport = getTransporter()
  
  if (!transport) {
    throw new Error('邮件服务未配置，请检查环境变量')
  }
  
  const mailOptions = {
    from: smtpConfig.from,
    to,
    subject,
    text,
    html,
    attachments
  }
  
  const result = await transport.sendMail(mailOptions)
  return {
    success: true,
    messageId: result.messageId
  }
}

export default {
  checkEmailConfig,
  sendQuotationEmail,
  sendQuotationEmailBatch,
  verifyConnection,
  sendEmail
}
