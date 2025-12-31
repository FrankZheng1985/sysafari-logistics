/**
 * 预警定时任务调度器
 * 定期执行预警检查
 */

import alertService from '../services/alertService.js'

let intervalId = null

/**
 * 启动定时任务
 * @param {number} intervalHours - 检查间隔（小时），默认24小时
 */
export function startScheduler(intervalHours = 24) {
  // 先执行一次
  console.log('📅 预警调度器已启动')
  
  // 延迟5秒后执行首次检查（等待数据库连接就绪）
  setTimeout(async () => {
    console.log('🔔 执行首次预警检查...')
    try {
      await alertService.runAllChecks()
    } catch (error) {
      console.error('首次预警检查失败:', error)
    }
  }, 5000)
  
  // 设置定时任务
  const intervalMs = intervalHours * 60 * 60 * 1000
  intervalId = setInterval(async () => {
    console.log(`🔔 执行定时预警检查 (${new Date().toLocaleString()})`)
    try {
      await alertService.runAllChecks()
    } catch (error) {
      console.error('定时预警检查失败:', error)
    }
  }, intervalMs)
  
  console.log(`📅 预警检查将每 ${intervalHours} 小时执行一次`)
}

/**
 * 停止定时任务
 */
export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('📅 预警调度器已停止')
  }
}

/**
 * 手动触发预警检查
 */
export async function triggerCheck() {
  console.log('🔔 手动触发预警检查...')
  return await alertService.runAllChecks()
}

export default {
  startScheduler,
  stopScheduler,
  triggerCheck
}
