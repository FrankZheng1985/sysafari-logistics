/**
 * 系统常量配置
 */

// API 响应状态码
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
}

// 业务错误码
export const ERROR_CODES = {
  SUCCESS: 200,
  INVALID_PARAMS: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500
}

// 单据编号规则
export const SEQUENCE_RULES = {
  // 订单管理
  BILL: { prefix: 'BP', length: 5, description: '提单编号', yearOnly: true },
  PKG: { prefix: 'PK', length: 6, description: '包裹编号' },
  DEC: { prefix: 'DC', length: 6, description: '报关单编号' },
  LABEL: { prefix: 'LB', length: 6, description: '标签编号' },
  
  // CRM
  CUST: { prefix: 'CU', length: 6, description: '客户编号' },
  SUPP: { prefix: 'SP', length: 6, description: '供应商编号' },
  
  // 财务
  INV: { prefix: 'IV', length: 6, description: '发票编号' },
  PAY: { prefix: 'PY', length: 6, description: '付款编号' },
  REC: { prefix: 'RC', length: 6, description: '收款编号' },
  
  // TMS
  CMR: { prefix: 'CM', length: 6, description: 'CMR编号' },
  LM: { prefix: 'LM', length: 6, description: '末端配送编号' },
  
  // 文档
  DOC: { prefix: 'DO', length: 6, description: '文档编号' },
  
  // 合同
  CON: { prefix: 'CT', length: 6, description: '合同编号' },
}

// 订单状态
export const ORDER_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  VOID: 'void',
  COMPLETED: 'completed'
}

// 船运状态
export const SHIP_STATUS = {
  NOT_ARRIVED: '未到港',
  ARRIVED: '已到港',
  SKIPPED: '跳港'
}

// 清关状态
export const CUSTOMS_STATUS = {
  NOT_CLEARED: '未放行',
  CLEARED: '已放行'
}

// 查验状态
export const INSPECTION_STATUS = {
  NONE: '-',
  PENDING: '待查验',
  IN_PROGRESS: '查验中',
  COMPLETED: '已查验',
  RELEASED: '查验放行',
  CONFIRMED: '已放行'
}

// 派送状态
export const DELIVERY_STATUS = {
  NOT_DELIVERED: '待派送',
  DELIVERING: '派送中',
  DELIVERED: '已送达',
  EXCEPTION: '订单异常',
  CLOSED: '异常关闭'
}

// 用户角色
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
}

// 用户状态
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
}

// 数据状态
export const DATA_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
}

// 分页默认值
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
}

export default {
  HTTP_STATUS,
  ERROR_CODES,
  SEQUENCE_RULES,
  ORDER_STATUS,
  SHIP_STATUS,
  CUSTOMS_STATUS,
  INSPECTION_STATUS,
  DELIVERY_STATUS,
  USER_ROLES,
  USER_STATUS,
  DATA_STATUS,
  PAGINATION
}
