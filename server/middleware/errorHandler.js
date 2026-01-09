/**
 * 全局错误处理中间件
 */

import { serverError } from '../utils/response.js'

/**
 * 自定义业务错误类
 */
export class BusinessError extends Error {
  constructor(message, code = 400, httpStatus = 400) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    errCode: 404,
    msg: `接口不存在: ${req.method} ${req.originalUrl}`,
    data: null
  })
}

/**
 * 全局错误处理中间件
 */
export function globalErrorHandler(err, req, res, next) {
  // 记录错误日志
  console.error('🚨 Error:', err.message)
  console.error('🚨 Stack:', err.stack)
  console.error('🚨 Request:', req.method, req.originalUrl)
  
  // 业务错误
  if (err instanceof BusinessError) {
    return res.status(err.httpStatus).json({
      errCode: err.code,
      msg: err.message,
      data: null
    })
  }
  
  // Multer 文件上传错误
  if (err.name === 'MulterError') {
    let msg = '文件上传失败'
    if (err.code === 'LIMIT_FILE_SIZE') {
      msg = '文件大小超出限制（最大10MB）'
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      msg = '不支持的文件字段'
    }
    return res.status(400).json({
      errCode: 400,
      msg,
      data: null
    })
  }
  
  // 文件格式错误（multer fileFilter 抛出的错误）
  if (err.message && (err.message.includes('只支持') || err.message.includes('文件格式'))) {
    return res.status(400).json({
      errCode: 400,
      msg: err.message,
      data: null
    })
  }
  
  // 数据库约束错误 (PostgreSQL: 23505=唯一约束, 23503=外键约束, 23502=非空约束)
  if (err.code === '23505' || err.code === '23503' || err.code === '23502') {
    return res.status(409).json({
      errCode: 409,
      msg: '数据约束错误，可能存在重复数据',
      data: null
    })
  }
  
  // JSON 解析错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      errCode: 400,
      msg: '请求体JSON格式错误',
      data: null
    })
  }
  
  // Excel/文件解析错误 - 提供有用的错误信息
  if (err.message && (err.message.includes('Excel') || err.message.includes('解析') || err.message.includes('文件'))) {
    return serverError(res, err.message)
  }
  
  // 未知错误 - 在任何环境都提供基本错误描述
  const errorMsg = process.env.NODE_ENV === 'development' 
    ? err.message 
    : (err.message && !err.message.includes('at ') ? err.message : '服务器内部错误，请稍后重试')
  return serverError(res, errorMsg)
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理函数，自动捕获错误
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export default {
  BusinessError,
  notFoundHandler,
  globalErrorHandler,
  asyncHandler
}
