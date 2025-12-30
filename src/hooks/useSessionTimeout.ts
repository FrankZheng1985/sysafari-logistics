/**
 * 会话超时监控 Hook
 * 监听用户活动，15分钟无活动后自动登出
 */

import { useEffect, useCallback, useRef, useState } from 'react'

// 配置参数
const SESSION_TIMEOUT = 15 * 60 * 1000 // 15分钟（毫秒）
const WARNING_TIME = 60 * 1000 // 超时前1分钟显示警告
const CHECK_INTERVAL = 1000 // 每秒检查一次

// localStorage 键
const LAST_ACTIVITY_KEY = 'bp_logistics_last_activity'
const SESSION_TIMEOUT_KEY = 'bp_logistics_session_timeout'

// 需要监听的用户活动事件
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'click',
]

interface UseSessionTimeoutOptions {
  onTimeout: () => void // 超时回调（登出）
  onWarning?: () => void // 警告回调
  enabled?: boolean // 是否启用
}

interface UseSessionTimeoutReturn {
  showWarning: boolean // 是否显示警告弹窗
  remainingTime: number // 剩余时间（秒）
  extendSession: () => void // 延长会话
  resetTimer: () => void // 重置计时器
}

export function useSessionTimeout({
  onTimeout,
  onWarning,
  enabled = true,
}: UseSessionTimeoutOptions): UseSessionTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(SESSION_TIMEOUT / 1000)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)

  // 获取最后活动时间
  const getLastActivity = useCallback((): number => {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY)
    return stored ? parseInt(stored, 10) : Date.now()
  }, [])

  // 更新最后活动时间
  const updateLastActivity = useCallback(() => {
    const now = Date.now()
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
  }, [])

  // 重置计时器
  const resetTimer = useCallback(() => {
    updateLastActivity()
    setShowWarning(false)
    warningShownRef.current = false
    setRemainingTime(SESSION_TIMEOUT / 1000)
  }, [updateLastActivity])

  // 延长会话（用户点击"继续使用"按钮）
  const extendSession = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  // 处理用户活动事件
  const handleActivity = useCallback(() => {
    // 如果警告弹窗已显示，不自动重置（需要用户明确点击）
    if (!warningShownRef.current) {
      resetTimer()
    }
  }, [resetTimer])

  // 检查会话是否超时
  const checkTimeout = useCallback(() => {
    if (!enabled) return

    const lastActivity = getLastActivity()
    const now = Date.now()
    const elapsed = now - lastActivity
    const remaining = SESSION_TIMEOUT - elapsed

    if (remaining <= 0) {
      // 会话已超时，执行登出
      setShowWarning(false)
      localStorage.setItem(SESSION_TIMEOUT_KEY, 'true')
      onTimeout()
    } else if (remaining <= WARNING_TIME && !warningShownRef.current) {
      // 进入警告时间
      warningShownRef.current = true
      setShowWarning(true)
      onWarning?.()
    }

    // 更新剩余时间
    setRemainingTime(Math.max(0, Math.ceil(remaining / 1000)))
  }, [enabled, getLastActivity, onTimeout, onWarning])

  // 监听其他标签页的活动（通过 storage 事件）
  const handleStorageChange = useCallback((event: StorageEvent) => {
    if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
      // 其他标签页有活动，重置本标签页的警告状态
      if (!warningShownRef.current) {
        setShowWarning(false)
        setRemainingTime(SESSION_TIMEOUT / 1000)
      }
    }
    
    // 其他标签页触发了超时登出
    if (event.key === SESSION_TIMEOUT_KEY && event.newValue === 'true') {
      onTimeout()
    }
  }, [onTimeout])

  // 初始化和清理
  useEffect(() => {
    if (!enabled) {
      // 如果禁用，清理所有状态
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // 初始化最后活动时间
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      updateLastActivity()
    }

    // 清除之前的超时标记
    localStorage.removeItem(SESSION_TIMEOUT_KEY)

    // 添加用户活动事件监听
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // 监听其他标签页的 storage 变化
    window.addEventListener('storage', handleStorageChange)

    // 定时检查超时
    timerRef.current = setInterval(checkTimeout, CHECK_INTERVAL)

    // 清理函数
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      window.removeEventListener('storage', handleStorageChange)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, handleActivity, handleStorageChange, checkTimeout, updateLastActivity])

  return {
    showWarning,
    remainingTime,
    extendSession,
    resetTimer,
  }
}

// 格式化剩余时间显示
export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}分${secs.toString().padStart(2, '0')}秒`
  }
  return `${secs}秒`
}

// 导出配置常量（方便其他组件使用）
export const SESSION_CONFIG = {
  TIMEOUT: SESSION_TIMEOUT,
  WARNING_TIME,
  CHECK_INTERVAL,
}

