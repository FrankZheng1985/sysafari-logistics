/**
 * API 模块统一导出
 * 
 * 使用方式：
 * import { getBillsList, type BillOfLading } from '@/utils/api'
 * 
 * 或者：
 * import { getBillsList } from '@/utils/api'
 * import type { BillOfLading } from '@/utils/api/types'
 */

// 导出所有类型定义
export * from './types'

// 导出主 API 文件中的所有函数（保持向后兼容）
// 注意：api.ts 会逐步迁移到各个模块文件中

