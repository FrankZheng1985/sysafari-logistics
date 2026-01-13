/**
 * useAbortController - 用于管理 API 请求取消的 Hook
 * 
 * 功能：
 * 1. 组件卸载时自动取消所有未完成的请求
 * 2. 支持手动取消请求
 * 3. 支持重置（用于重新发起请求）
 * 
 * 使用示例：
 * ```tsx
 * function MyComponent() {
 *   const { getSignal, abort } = useAbortController()
 *   
 *   useEffect(() => {
 *     async function fetchData() {
 *       try {
 *         const data = await api.get('/api/data', { signal: getSignal() })
 *         setData(data)
 *       } catch (error) {
 *         if (error instanceof ApiError && error.code === 'CANCELLED') {
 *           // 请求被取消，忽略
 *           return
 *         }
 *         setError(error)
 *       }
 *     }
 *     fetchData()
 *   }, [getSignal])
 * }
 * ```
 */

import { useRef, useCallback, useEffect } from 'react'

interface UseAbortControllerReturn {
  /** 获取当前的 AbortSignal，用于传递给 fetch 请求 */
  getSignal: () => AbortSignal
  /** 手动取消所有请求 */
  abort: () => void
  /** 重置 controller（用于重新发起请求） */
  reset: () => void
  /** 检查是否已被取消 */
  isAborted: () => boolean
}

export function useAbortController(): UseAbortControllerReturn {
  const controllerRef = useRef<AbortController>(new AbortController())

  // 组件卸载时取消所有请求
  useEffect(() => {
    return () => {
      controllerRef.current.abort()
    }
  }, [])

  const getSignal = useCallback((): AbortSignal => {
    // 如果当前 controller 已被 abort，创建新的
    if (controllerRef.current.signal.aborted) {
      controllerRef.current = new AbortController()
    }
    return controllerRef.current.signal
  }, [])

  const abort = useCallback(() => {
    controllerRef.current.abort()
  }, [])

  const reset = useCallback(() => {
    controllerRef.current.abort()
    controllerRef.current = new AbortController()
  }, [])

  const isAborted = useCallback((): boolean => {
    return controllerRef.current.signal.aborted
  }, [])

  return {
    getSignal,
    abort,
    reset,
    isAborted
  }
}

/**
 * useApiRequest - 封装 API 请求的 Hook，自动处理加载状态、错误和取消
 * 
 * 使用示例：
 * ```tsx
 * function MyComponent() {
 *   const { execute, loading, error, data } = useApiRequest<DataType>()
 *   
 *   useEffect(() => {
 *     execute(() => api.get('/api/data'))
 *   }, [execute])
 *   
 *   if (loading) return <Loading />
 *   if (error) return <Error message={error.message} />
 *   return <Display data={data} />
 * }
 * ```
 */
import { useState } from 'react'
import { ApiError } from '../utils/api'

interface UseApiRequestReturn<T> {
  /** 执行请求 */
  execute: (requestFn: (signal: AbortSignal) => Promise<T>) => Promise<T | null>
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: ApiError | null
  /** 返回数据 */
  data: T | null
  /** 重置状态 */
  reset: () => void
}

export function useApiRequest<T>(): UseApiRequestReturn<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [data, setData] = useState<T | null>(null)
  const { getSignal, reset: resetController } = useAbortController()

  const execute = useCallback(async (
    requestFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const result = await requestFn(getSignal())
      setData(result)
      return result
    } catch (err: any) {
      // 忽略取消错误
      if (err instanceof ApiError && err.code === 'CANCELLED') {
        return null
      }
      
      const apiError = err instanceof ApiError 
        ? err 
        : new ApiError(err.message || '请求失败')
      
      setError(apiError)
      return null
    } finally {
      setLoading(false)
    }
  }, [getSignal])

  const reset = useCallback(() => {
    resetController()
    setLoading(false)
    setError(null)
    setData(null)
  }, [resetController])

  return {
    execute,
    loading,
    error,
    data,
    reset
  }
}

export default useAbortController
