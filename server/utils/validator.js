/**
 * 数据校验工具
 */

/**
 * 校验必填字段
 * @param {Object} data - 数据对象
 * @param {Array<string>} requiredFields - 必填字段列表
 * @returns {{ valid: boolean, missing: Array<string> }}
 */
export function validateRequired(data, requiredFields) {
  const missing = []
  
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field)
    }
  })
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * 校验字段类型
 * @param {any} value - 值
 * @param {string} type - 期望类型
 * @returns {boolean}
 */
export function validateType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !isNaN(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case 'phone':
      return typeof value === 'string' && /^[\d\s\-+()]+$/.test(value)
    case 'date':
      return !isNaN(Date.parse(value))
    default:
      return true
  }
}

/**
 * 校验字符串长度
 * @param {string} value - 字符串值
 * @param {number} min - 最小长度
 * @param {number} max - 最大长度
 * @returns {boolean}
 */
export function validateLength(value, min = 0, max = Infinity) {
  if (typeof value !== 'string') return false
  return value.length >= min && value.length <= max
}

/**
 * 校验数值范围
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {boolean}
 */
export function validateRange(value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number') return false
  return value >= min && value <= max
}

/**
 * 校验枚举值
 * @param {any} value - 值
 * @param {Array} allowedValues - 允许的值列表
 * @returns {boolean}
 */
export function validateEnum(value, allowedValues) {
  return allowedValues.includes(value)
}

/**
 * 清理和转换数据
 * @param {Object} data - 原始数据
 * @param {Object} schema - 字段schema定义
 * @returns {Object} 清理后的数据
 */
export function sanitizeData(data, schema) {
  const result = {}
  
  Object.entries(schema).forEach(([field, config]) => {
    let value = data[field]
    
    // 如果值不存在且有默认值，使用默认值
    if ((value === undefined || value === null) && config.default !== undefined) {
      value = config.default
    }
    
    // 类型转换
    if (value !== undefined && value !== null) {
      switch (config.type) {
        case 'string':
          value = String(value).trim()
          break
        case 'number':
          value = Number(value)
          if (isNaN(value)) value = config.default || 0
          break
        case 'boolean':
          value = Boolean(value)
          break
        case 'date':
          value = new Date(value).toISOString()
          break
      }
    }
    
    result[field] = value
  })
  
  return result
}

/**
 * 密码强度校验
 * @param {string} password - 密码
 * @param {Object} rules - 校验规则
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
export function validatePassword(password, rules = {}) {
  const errors = []
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = true
  } = rules
  
  if (password.length < minLength) {
    errors.push(`密码长度至少${minLength}位`)
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  }
  
  if (requireNumber && !/\d/.test(password)) {
    errors.push('密码必须包含数字')
  }
  
  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含特殊字符')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  validateRequired,
  validateType,
  validateLength,
  validateRange,
  validateEnum,
  sanitizeData,
  validatePassword
}
