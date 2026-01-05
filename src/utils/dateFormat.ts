/**
 * 日期格式化工具函数
 * 
 * 输入格式: YY-MM-DD（不含时间）
 * 显示格式: YY-MM-DD HH:MM
 */

/**
 * 获取两位数年份
 */
function getShortYear(year: number): string {
  return String(year).slice(-2)
}

/**
 * 格式化日期 - 只显示年月日
 * 输出格式: YY-MM-DD (如: 25-01-05)
 */
export function formatDate(dateStr: string | null | undefined, showFullTime?: boolean): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const year = getShortYear(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    if (showFullTime) {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    }
    
    return `${year}-${month}-${day}`
  } catch {
    return '-'
  }
}

/**
 * 格式化日期时间 - 显示年月日时分
 * 输出格式: YY-MM-DD HH:MM (如: 25-01-05 14:30)
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const year = getShortYear(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return '-'
  }
}

/**
 * 格式化日期时间 - 简短显示（与 formatDateTime 相同）
 * 输出格式: YY-MM-DD HH:MM (如: 25-01-05 14:30)
 */
export function formatDateTimeShort(dateStr: string | null | undefined): string {
  return formatDateTime(dateStr)
}

/**
 * 格式化日期用于输入框
 * 输出格式: YYYY-MM-DD (用于 input type="date")
 */
export function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

/**
 * 格式化时间戳为相对时间（如：刚刚、5分钟前、1小时前等）
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    
    if (diffSec < 60) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    if (diffHour < 24) return `${diffHour}小时前`
    if (diffDay < 7) return `${diffDay}天前`
    
    return formatDate(dateStr)
  } catch {
    return '-'
  }
}
