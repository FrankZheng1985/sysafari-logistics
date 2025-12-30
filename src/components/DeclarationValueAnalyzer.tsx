/**
 * 申报价值分析组件
 * 显示历史申报统计、最低通过价值、风险提示
 */

import React, { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CheckCircle, Info, BarChart2, History, X } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE_URL = getApiBaseUrl()

interface DeclarationStats {
  found: boolean
  hsCode: string
  originCountry?: string
  priceUnit?: string
  stats?: {
    totalCount: number
    passCount: number
    questionedCount: number
    rejectedCount: number
    passRate: number
    minPassPrice: number
    maxPassPrice: number
    avgPassPrice: number
    p10PassPrice: number
    p25PassPrice: number
    minProblemPrice: number
  }
  suggestedMinPrice?: number
  riskLevel?: string
  message?: string
}

interface RiskCheckResult {
  riskLevel: string
  declaredPrice: number
  hsCode: string
  originCountry?: string
  priceUnit?: string
  historicalStats?: DeclarationStats['stats']
  suggestedMinPrice: number
  warnings: string[]
  suggestions: string[]
  isRisky: boolean
}

interface Props {
  hsCode: string
  originCountry?: string
  priceUnit?: string
  declaredPrice?: number
  onPriceWarning?: (warning: string | null) => void
  compact?: boolean
}

const riskColors = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
  unknown: 'text-gray-500'
}

const riskBgColors = {
  low: 'bg-green-50 border-green-200',
  medium: 'bg-amber-50 border-amber-200',
  high: 'bg-red-50 border-red-200',
  unknown: 'bg-gray-50 border-gray-200'
}

export default function DeclarationValueAnalyzer({
  hsCode,
  originCountry,
  priceUnit,
  declaredPrice,
  onPriceWarning,
  compact = false
}: Props) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<DeclarationStats | null>(null)
  const [riskCheck, setRiskCheck] = useState<RiskCheckResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 获取申报统计
  useEffect(() => {
    if (!hsCode || hsCode.length < 6) {
      setStats(null)
      return
    }

    const fetchStats = async () => {
      try {
        const params = new URLSearchParams()
        if (originCountry) params.append('originCountry', originCountry)
        if (priceUnit) params.append('priceUnit', priceUnit)
        const url = `${API_BASE_URL}/api/cargo/declaration-value/stats/${hsCode}${params.toString() ? '?' + params.toString() : ''}`
        const response = await fetch(url)
        const data = await response.json()
        if (data?.success) {
          setStats(data.data)
        }
      } catch (error) {
        console.error('获取申报统计失败:', error)
      }
    }

    fetchStats()
  }, [hsCode, originCountry, priceUnit])

  // 检查申报价格风险
  useEffect(() => {
    if (!hsCode || !declaredPrice || declaredPrice <= 0) {
      setRiskCheck(null)
      onPriceWarning?.(null)
      return
    }

    const checkRisk = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/cargo/declaration-value/check-risk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hsCode, declaredPrice, originCountry, priceUnit })
        })
        const data = await response.json()
        if (data?.success) {
          const result = data.data as RiskCheckResult
          setRiskCheck(result)
          
          // 通知父组件价格警告
          if (result.isRisky && result.warnings.length > 0) {
            onPriceWarning?.(result.warnings[0])
          } else {
            onPriceWarning?.(null)
          }
        }
      } catch (error) {
        console.error('检查申报风险失败:', error)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(checkRisk, 500)
    return () => clearTimeout(debounce)
  }, [hsCode, declaredPrice, originCountry, priceUnit])

  // 紧凑模式
  if (compact) {
    if (!stats?.found || !riskCheck) return null

    const riskLevel = riskCheck.riskLevel || 'unknown'
    if (riskLevel === 'low') return null

    return (
      <div className={`inline-flex items-center gap-1 text-xs ${riskColors[riskLevel as keyof typeof riskColors]}`}>
        <AlertTriangle className="w-3 h-3" />
        <span>
          {riskLevel === 'high' ? '价格过低' : '价格偏低'}
          (建议≥€{riskCheck.suggestedMinPrice})
        </span>
      </div>
    )
  }

  // 完整模式
  if (!stats?.found) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
        <Info className="w-4 h-4 inline mr-2" />
        暂无该HS编码的历史申报数据
      </div>
    )
  }

  const riskLevel = riskCheck?.riskLevel || stats.riskLevel || 'unknown'

  return (
    <div className={`rounded-lg border ${riskBgColors[riskLevel as keyof typeof riskBgColors]}`}>
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-inherit">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className={`w-5 h-5 ${riskColors[riskLevel as keyof typeof riskColors]}`} />
            <span className="font-medium">申报价值分析</span>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            查看历史
          </button>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500">历史申报</div>
            <div className="font-medium">{stats.stats?.totalCount || 0} 次</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">通过率</div>
            <div className={`font-medium ${
              (stats.stats?.passRate || 0) >= 90 ? 'text-green-600' :
              (stats.stats?.passRate || 0) >= 70 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {stats.stats?.passRate || 0}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">最低通过价</div>
            <div className="font-medium">€{stats.stats?.minPassPrice?.toFixed(2) || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">平均通过价</div>
            <div className="font-medium">€{stats.stats?.avgPassPrice?.toFixed(2) || '-'}</div>
          </div>
        </div>

        {/* 建议最低价格 */}
        <div className="flex items-center gap-2 p-3 bg-white rounded border border-inherit">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div className="flex-1">
            <div className="text-xs text-gray-500">建议最低申报价格</div>
            <div className="font-bold text-lg">
              €{stats.suggestedMinPrice?.toFixed(2) || '-'}
              <span className="text-xs font-normal text-gray-500 ml-1">
                /{stats.priceUnit || 'PCS'}
              </span>
            </div>
          </div>
        </div>

        {/* 当前申报价格风险提示 */}
        {riskCheck && riskCheck.isRisky && (
          <div className={`mt-4 p-3 rounded-lg ${
            riskCheck.riskLevel === 'high' ? 'bg-red-100 border border-red-200' : 'bg-amber-100 border border-amber-200'
          }`}>
            <div className={`flex items-start gap-2 ${
              riskCheck.riskLevel === 'high' ? 'text-red-700' : 'text-amber-700'
            }`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">
                  {riskCheck.riskLevel === 'high' ? '高风险警告' : '风险提示'}
                </div>
                {riskCheck.warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm">{warning}</div>
                ))}
                {riskCheck.suggestions.length > 0 && (
                  <div className="mt-2 text-sm font-medium">
                    💡 {riskCheck.suggestions[0]}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 安全提示 */}
        {riskCheck && !riskCheck.isRisky && declaredPrice && (
          <div className="mt-4 p-3 rounded-lg bg-green-100 border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">申报价格在安全范围内</span>
            </div>
          </div>
        )}
      </div>

      {/* 历史记录弹窗 */}
      {showHistory && (
        <DeclarationHistoryModal
          hsCode={hsCode}
          originCountry={originCountry}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

// 申报历史弹窗
function DeclarationHistoryModal({
  hsCode,
  originCountry,
  onClose
}: {
  hsCode: string
  originCountry?: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const params = new URLSearchParams()
        params.append('hsCode', hsCode)
        if (originCountry) params.append('originCountry', originCountry)
        params.append('pageSize', '50')
        const url = `${API_BASE_URL}/api/cargo/declaration-value/history?${params.toString()}`
        const response = await fetch(url)
        const data = await response.json()
        if (data?.success) {
          setHistory(data.data || [])
        }
      } catch (error) {
        console.error('获取申报历史失败:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [hsCode, originCountry])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary-600" />
            申报历史记录
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无历史记录
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">日期</th>
                  <th className="px-4 py-2 text-left">申报单价</th>
                  <th className="px-4 py-2 text-left">结果</th>
                  <th className="px-4 py-2 text-left">调整价</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{item.declarationDate}</td>
                    <td className="px-4 py-2 font-mono">
                      €{item.declaredUnitPrice?.toFixed(2)}/{item.priceUnit}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.declarationResult === 'passed' ? 'bg-green-100 text-green-700' :
                        item.declarationResult === 'questioned' ? 'bg-amber-100 text-amber-700' :
                        item.declarationResult === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.declarationResult === 'passed' ? '通过' :
                         item.declarationResult === 'questioned' ? '被质疑' :
                         item.declarationResult === 'rejected' ? '被拒绝' : '待处理'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {item.customsAdjustedPrice ? `€${item.customsAdjustedPrice.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

