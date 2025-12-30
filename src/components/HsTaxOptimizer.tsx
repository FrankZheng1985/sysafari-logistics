/**
 * HS编码税率优化组件
 * 显示当前HS编码的税率风险，并推荐低税率替代方案
 */

import React, { useState, useEffect } from 'react'
import { AlertTriangle, TrendingDown, Search, Info, X, ChevronDown, ChevronUp, Shield, Zap } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE_URL = getApiBaseUrl()

interface TaxRates {
  dutyRate: number
  antiDumpingRate: number
  countervailingRate: number
  vatRate: number
  totalRateWithoutVat?: number
}

interface TaxBurden {
  dutyAmount: number
  antiDumpingAmount: number
  countervailingAmount: number
  otherTaxAmount: number
  vatBase: number
  vatAmount: number
  totalTax: number
  effectiveTaxRate: number
}

interface Alternative {
  hsCode: string
  productName: string
  productNameEn?: string
  material?: string
  matchType: string
  matchReason: string
  rates: TaxRates
  taxBurden: TaxBurden
  savings: number
  savingsPercent: number
  riskLevel: string
}

interface AnalysisResult {
  found: boolean
  hsCode: string
  productName?: string
  rates?: TaxRates
  taxBurden?: TaxBurden
  riskLevel?: string
  riskReasons?: string[]
  hasAntiDumping?: boolean
  hasCountervailing?: boolean
}

interface Props {
  hsCode: string
  productName?: string
  originCountry?: string
  cifValue?: number  // 用于计算实际节省金额
  onSelectAlternative?: (hsCode: string, rates: TaxRates) => void
  compact?: boolean  // 紧凑模式，只显示风险标识
}

const riskColors = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200'
}

const riskDots = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
  unknown: 'bg-gray-400'
}

const riskLabels = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  unknown: '未知'
}

export default function HsTaxOptimizer({ 
  hsCode, 
  productName, 
  originCountry,
  cifValue = 10000,
  onSelectAlternative,
  compact = false 
}: Props) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 分析当前HS编码
  useEffect(() => {
    if (!hsCode || hsCode.length < 6) {
      setAnalysis(null)
      return
    }

    const analyze = async () => {
      try {
        const params = new URLSearchParams()
        if (originCountry) params.append('originCountry', originCountry)
        const url = `${API_BASE_URL}/api/cargo/hs-optimize/analyze/${hsCode}${params.toString() ? '?' + params.toString() : ''}`
        const response = await fetch(url)
        const data = await response.json()
        if (data?.success) {
          setAnalysis(data.data)
        }
      } catch (error) {
        console.error('分析HS税率失败:', error)
      }
    }

    analyze()
  }, [hsCode, originCountry])

  // 获取替代方案
  const loadAlternatives = async () => {
    if (!hsCode || loading) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (productName) params.append('productName', productName)
      if (originCountry) params.append('originCountry', originCountry)
      params.append('limit', '10')
      const url = `${API_BASE_URL}/api/cargo/hs-optimize/alternatives/${hsCode}?${params.toString()}`
      const response = await fetch(url)
      const data = await response.json()
      if (data?.success) {
        setAlternatives(data.data.alternatives || [])
      }
    } catch (error) {
      console.error('获取替代方案失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 打开详情面板时加载替代方案
  useEffect(() => {
    if (showPanel && alternatives.length === 0) {
      loadAlternatives()
    }
  }, [showPanel])

  // 紧凑模式：只显示风险点
  if (compact) {
    const riskLevel = analysis?.riskLevel || 'unknown'
    return (
      <div 
        className="inline-flex items-center gap-1 cursor-pointer group"
        onClick={() => setShowPanel(true)}
        title={analysis?.hasAntiDumping ? '存在反倾销税' : riskLabels[riskLevel as keyof typeof riskLabels]}
      >
        <span className={`w-2 h-2 rounded-full ${riskDots[riskLevel as keyof typeof riskDots]}`} />
        {analysis?.hasAntiDumping && (
          <AlertTriangle className="w-3 h-3 text-red-500" />
        )}
        {showPanel && (
          <OptimizerPanel 
            analysis={analysis}
            alternatives={alternatives}
            loading={loading}
            cifValue={cifValue}
            onClose={() => setShowPanel(false)}
            onSelect={onSelectAlternative}
          />
        )}
      </div>
    )
  }

  // 完整模式
  const riskLevel = analysis?.riskLevel || 'unknown'

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 头部：风险摘要 */}
      <div 
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${riskColors[riskLevel as keyof typeof riskColors]}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${riskDots[riskLevel as keyof typeof riskDots]}`} />
          <div>
            <div className="font-medium text-sm">
              {riskLabels[riskLevel as keyof typeof riskLabels]}
              {analysis?.hasAntiDumping && (
                <span className="ml-2 text-red-600">
                  <AlertTriangle className="w-4 h-4 inline" /> 反倾销税 {analysis.rates?.antiDumpingRate}%
                </span>
              )}
            </div>
            {analysis?.rates && (
              <div className="text-xs opacity-75">
                关税 {analysis.rates.dutyRate}% + 增值税 {analysis.rates.vatRate}%
                {(analysis.rates.antiDumpingRate || 0) > 0 && ` + 反倾销 ${analysis.rates.antiDumpingRate}%`}
                {analysis.taxBurden && ` = 有效税率 ${analysis.taxBurden.effectiveTaxRate}%`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowPanel(true)
            }}
            className="px-3 py-1 bg-white/50 hover:bg-white rounded text-xs font-medium flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            优化建议
          </button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* 展开内容：风险详情 */}
      {expanded && analysis && (
        <div className="p-4 bg-white border-t">
          {analysis.riskReasons && analysis.riskReasons.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-500 mb-1">风险因素:</div>
              <ul className="space-y-1">
                {analysis.riskReasons.map((reason, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.taxBurden && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">关税金额 (基于€{cifValue.toLocaleString()})</div>
                <div className="font-medium">€{analysis.taxBurden.dutyAmount.toLocaleString()}</div>
              </div>
              {analysis.taxBurden.antiDumpingAmount > 0 && (
                <div>
                  <div className="text-xs text-gray-500">反倾销税</div>
                  <div className="font-medium text-red-600">€{analysis.taxBurden.antiDumpingAmount.toLocaleString()}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">增值税</div>
                <div className="font-medium">€{analysis.taxBurden.vatAmount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">税费总计</div>
                <div className="font-medium text-lg">€{analysis.taxBurden.totalTax.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 优化建议面板 */}
      {showPanel && (
        <OptimizerPanel 
          analysis={analysis}
          alternatives={alternatives}
          loading={loading}
          cifValue={cifValue}
          onClose={() => setShowPanel(false)}
          onSelect={onSelectAlternative}
        />
      )}
    </div>
  )
}

// 优化建议面板组件
function OptimizerPanel({ 
  analysis, 
  alternatives, 
  loading, 
  cifValue,
  onClose, 
  onSelect 
}: {
  analysis: AnalysisResult | null
  alternatives: Alternative[]
  loading: boolean
  cifValue: number
  onClose: () => void
  onSelect?: (hsCode: string, rates: TaxRates) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-primary-50 to-white">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary-600" />
              HS编码税率优化建议
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              当前编码: <span className="font-mono font-medium">{analysis?.hsCode}</span>
              {analysis?.productName && ` - ${analysis.productName}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 当前税率摘要 */}
        {analysis?.rates && (
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="text-sm font-medium text-gray-700 mb-2">当前税率:</div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">关税:</span>
                <span className="font-medium">{analysis.rates.dutyRate}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">增值税:</span>
                <span className="font-medium">{analysis.rates.vatRate}%</span>
              </div>
              {analysis.rates.antiDumpingRate > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>反倾销税: {analysis.rates.antiDumpingRate}%</span>
                </div>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-gray-500">有效税率:</span>
                <span className="font-bold text-lg">{analysis.taxBurden?.effectiveTaxRate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 替代方案列表 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-500">正在搜索低税率编码...</span>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>当前HS编码已是最优选择</p>
              <p className="text-sm mt-1">未找到税率更低的替代编码</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 mb-4">
                找到 <span className="font-medium text-primary-600">{alternatives.length}</span> 个可能的低税率替代方案:
              </div>
              {alternatives.map((alt, idx) => {
                const savingsAmount = (analysis?.taxBurden?.totalTax || 0) - alt.taxBurden.totalTax
                return (
                  <div 
                    key={idx}
                    className={`border rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-colors ${
                      alt.riskLevel === 'low' ? 'border-green-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-medium text-primary-700">{alt.hsCode}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${riskColors[alt.riskLevel as keyof typeof riskColors]}`}>
                            {riskLabels[alt.riskLevel as keyof typeof riskLabels]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                            {alt.matchReason}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">{alt.productName}</div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>关税: {alt.rates.dutyRate}%</span>
                          <span>增值税: {alt.rates.vatRate}%</span>
                          {alt.rates.antiDumpingRate > 0 && (
                            <span className="text-amber-600">反倾销: {alt.rates.antiDumpingRate}%</span>
                          )}
                          <span className="font-medium">有效税率: {alt.taxBurden.effectiveTaxRate}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 font-bold text-lg">
                          -{alt.savingsPercent}%
                        </div>
                        <div className="text-sm text-green-600">
                          省 €{Math.round(savingsAmount * cifValue / 10000).toLocaleString()}
                        </div>
                        {onSelect && (
                          <button
                            onClick={() => onSelect(alt.hsCode, alt.rates)}
                            className="mt-2 px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
                          >
                            使用此编码
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 bg-amber-50 border-t text-xs text-amber-700 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>重要提示:</strong> 更换HS编码前，请确保商品确实符合目标编码的归类要求。
            不当归类可能导致海关处罚。建议咨询专业报关人员确认。
          </div>
        </div>
      </div>
    </div>
  )
}

