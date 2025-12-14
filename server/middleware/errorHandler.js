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
  console.error('🚨 Error:', err)
  
  // 业务错误
  if (err instanceof BusinessError) {
    return res.status(err.httpStatus).json({
      errCode: err.code,
      msg: err.message,
      data: null
    })
  }
  
  // 数据库错误
  if (err.code === 'SQLITE_CONSTRAINT') {
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
  
  // 未知错误
  return serverError(res, process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误')
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
