/**
 * 日期格式化工具函数
 * 
 * formatDate: 只显示日期 (2025-11-03)
 * formatDateTime: 显示日期和时间 (2025-11-03 00:00:00)
 */

/**
 * 格式化日期 - 只显示年月日
 * 输出格式: 2025-11-03
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  } catch {
    return '-'
  }
}

/**
 * 格式化日期时间 - 显示年月日时分秒
 * 输出格式: 2025-11-03T00:00:00
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  } catch {
    return '-'
  }
}

/**
 * 格式化日期时间 - 只显示时分（用于简短显示）
 * 输出格式: 2025-11-03T00:00
 */
export function formatDateTimeShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return '-'
  }
}

