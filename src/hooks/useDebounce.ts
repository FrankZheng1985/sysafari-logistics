/**
 * 防抖 Hook
 * 用于延迟执行频繁触发的操作（如搜索输入）
 */

import { useState, useEffect } from 'react'

/**
 * useDebounce - 对值进行防抖处理
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 设置延迟更新
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // 清理上一次的定时器
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * useDebouncedCallback - 对回调函数进行防抖处理
 * @param callback 需要防抖的回调函数
 * @param delay 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const debouncedCallback = ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    const newTimeoutId = setTimeout(() => {
      callback(...args)
    }, delay)
    
    setTimeoutId(newTimeoutId)
  }) as T

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  return debouncedCallback
}

export default useDebounce

