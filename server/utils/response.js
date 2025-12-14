/**
 * 统一响应格式工具
 */

import { ERROR_CODES } from '../config/constants.js'

/**
 * 成功响应
 * @param {Object} res - Express response 对象
 * @param {any} data - 响应数据
 * @param {string} msg - 响应消息
 */
export function success(res, data = null, msg = 'success') {
  return res.json({
    errCode: ERROR_CODES.SUCCESS,
    msg,
    data
  })
}

/**
 * 分页成功响应
 * @param {Object} res - Express response 对象
 * @param {Array} list - 数据列表
 * @param {Object} pagination - 分页信息 { total, page, pageSize, stats, ... }
 * @param {string} msg - 响应消息
 */
export function successWithPagination(res, list, pagination, msg = 'success') {
  const { total, page, pageSize, stats, ...extra } = pagination
  return res.json({
    errCode: ERROR_CODES.SUCCESS,
    msg,
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      ...(stats && { stats }),
      ...extra
    }
  })
}

/**
 * 错误响应
 * @param {Object} res - Express response 对象
 * @param {string} msg - 错误消息
 * @param {number} errCode - 错误码
 * @param {number} httpStatus - HTTP状态码
 */
export function error(res, msg = '操作失败', errCode = ERROR_CODES.SERVER_ERROR, httpStatus = 500) {
  return res.status(httpStatus).json({
    errCode,
    msg,
    data: null
  })
}

/**
 * 参数错误响应
 */
export function badRequest(res, msg = '参数错误') {
  return error(res, msg, ERROR_CODES.INVALID_PARAMS, 400)
}

/**
 * 未授权响应
 */
export function unauthorized(res, msg = '未授权访问') {
  return error(res, msg, ERROR_CODES.UNAUTHORIZED, 401)
}

/**
 * 禁止访问响应
 */
export function forbidden(res, msg = '禁止访问') {
  return error(res, msg, ERROR_CODES.FORBIDDEN, 403)
}

/**
 * 资源未找到响应
 */
export function notFound(res, msg = '资源未找到') {
  return error(res, msg, ERROR_CODES.NOT_FOUND, 404)
}

/**
 * 资源冲突响应
 */
export function conflict(res, msg = '资源已存在') {
  return error(res, msg, ERROR_CODES.DUPLICATE, 409)
}

/**
 * 服务器错误响应
 */
export function serverError(res, msg = '服务器内部错误') {
  return error(res, msg, ERROR_CODES.SERVER_ERROR, 500)
}

export default {
  success,
  successWithPagination,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
}
