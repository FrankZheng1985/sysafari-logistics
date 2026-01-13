/**
 * 全局错误边界组件
 * 捕获 React 组件树中的 JavaScript 错误，防止整个应用崩溃
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('🚨 [ErrorBoundary] 捕获到错误:')
    console.error('Error:', error)
    console.error('Component Stack:', errorInfo.componentStack)

    this.setState({ errorInfo })

    // 调用自定义错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 可以在这里上报错误到监控服务
    // reportErrorToService(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleRefreshPage = () => {
    window.location.reload()
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误界面
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
            {/* 错误头部 */}
            <div className="bg-red-50 px-6 py-8 text-center border-b border-red-100">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                页面出现问题
              </h1>
              <p className="text-sm text-gray-600">
                很抱歉，页面遇到了一些问题。您可以尝试刷新页面或返回首页。
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="px-6 py-4 space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={this.handleRefreshPage}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新页面
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Home className="w-4 h-4" />
                  返回首页
                </button>
              </div>
            </div>

            {/* 错误详情（开发模式下显示） */}
            {(import.meta.env.DEV || this.state.showDetails) && this.state.error && (
              <div className="border-t border-gray-200">
                <button
                  onClick={this.toggleDetails}
                  className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span>错误详情</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {this.state.showDetails && (
                  <div className="px-6 pb-4">
                    <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-64 text-xs">
                      <p className="text-red-400 font-mono mb-2">
                        {this.state.error.name}: {this.state.error.message}
                      </p>
                      {this.state.errorInfo && (
                        <pre className="text-gray-400 font-mono whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 提示信息 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                如果问题持续出现，请联系系统管理员
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 页面级错误边界（用于路由页面）
 * 样式更简洁，适合嵌入页面内容区域
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [PageErrorBoundary] 页面错误:', error)
    this.setState({ errorInfo })
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              页面加载失败
            </h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md">
              {this.state.error?.message || '页面遇到了问题，请重试'}
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
