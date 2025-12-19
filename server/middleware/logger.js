/**
 * 日志中间件
 * 记录API请求日志
 */

/**
 * 生成请求ID
 */
export function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 请求日志中间件
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  
  // 添加请求ID到请求对象
  req.requestId = requestId
  
  // 记录请求开始
  console.log(`📥 [${requestId}] ${req.method} ${req.originalUrl}`)
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = res.statusCode
    const statusEmoji = statusCode < 400 ? '✅' : statusCode < 500 ? '⚠️' : '❌'
    
    console.log(`📤 [${requestId}] ${statusEmoji} ${statusCode} - ${duration}ms`)
  })
  
  next()
}

/**
 * 错误日志中间件
 */
export function errorLogger(err, req, res, next) {
  console.error(`❌ [${req.requestId || 'unknown'}] Error:`, err.message)
  console.error(err.stack)
  next(err)
}

/**
 * 操作日志记录器
 * 记录业务操作到数据库
 */
export function logOperation(db, params) {
  const {
    billId,
    operationType,
    operationName,
    oldValue,
    newValue,
    remark,
    operator,
    operatorId,
    module = 'order'
  } = params
  
  try {
    db.prepare(`
      INSERT INTO operation_logs (
        bill_id, operation_type, operation_name, 
        old_value, new_value, remark, 
        operator, operator_id, module,
        operation_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `).run(
      billId,
      operationType,
      operationName,
      oldValue || null,
      newValue || null,
      remark || null,
      operator || '系统',
      operatorId || null,
      module
    )
  } catch (error) {
    console.error('记录操作日志失败:', error)
  }
}

export default {
  requestLogger,
  errorLogger,
  logOperation,
  generateRequestId
}
