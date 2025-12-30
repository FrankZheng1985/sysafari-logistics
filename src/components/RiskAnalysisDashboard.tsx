/**
 * 综合风险分析仪表盘
 * 整合税率优化、申报价值分析、查验预警三大功能
 */

import React, { useState, useEffect } from 'react'
import { 
  AlertTriangle, Shield, TrendingDown, BarChart2, Eye, 
  CheckCircle, RefreshCw, ChevronDown, ChevronUp, X,
  Zap, FileWarning, DollarSign
} from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE_URL = getApiBaseUrl()

interface FullRiskResult {
  importId: number
  compositeScore: number
  overallRiskLevel: string
  taxRisk: {
    score: number
    level: string
    highRiskCount: number
    items: any[]
  }
  declarationRisk: {
    score: number
    highRiskCount: number
    mediumRiskCount: number
    items: any[]
  }
  inspectionRisk: {
    score: number
    level: string
    highRiskCount: number
    items: any[]
  }
  warnings: string[]
  needsAttention: boolean
  analyzedAt: string
}

interface Props {
  importId: number
  onClose?: () => void
}

const riskColors = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600'
}

const riskBgColors = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500'
}

export default function RiskAnalysisDashboard({ importId, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<FullRiskResult | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const analyzeRisk = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/cargo/risk-analysis/full/${importId}`, {
        method: 'GET'
      })
      const data = await response.json()
      if (data?.success) {
        setResult(data.data)
      }
    } catch (error) {
      console.error('综合风险分析失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (importId) {
      analyzeRisk()
    }
  }, [importId])

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return '高风险'
      case 'medium': return '中风险'
      default: return '低风险'
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">正在进行综合风险分析...</p>
          <p className="text-sm text-gray-400 mt-1">分析税率、申报价值、查验率三维风险</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 - 综合风险评分 */}
        <div className={`px-6 py-5 ${
          result.overallRiskLevel === 'high' ? 'bg-gradient-to-r from-red-600 to-red-500' :
          result.overallRiskLevel === 'medium' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
          'bg-gradient-to-r from-green-600 to-green-500'
        } text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full bg-white/20 flex items-center justify-center`}>
                <span className="text-2xl font-bold">{result.compositeScore}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {result.overallRiskLevel === 'high' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : result.overallRiskLevel === 'medium' ? (
                    <FileWarning className="w-6 h-6" />
                  ) : (
                    <Shield className="w-6 h-6" />
                  )}
                  综合风险评估: {getRiskLabel(result.overallRiskLevel)}
                </h2>
                <p className="text-sm opacity-90 mt-1">
                  导入批次 #{importId} | 分析时间: {new Date(result.analyzedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={analyzeRisk}
                className="p-2 hover:bg-white/20 rounded-full"
                title="重新分析"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              {onClose && (
                <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 风险警告 */}
        {result.warnings.length > 0 && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
            {result.warnings.map((warning, idx) => (
              <div key={idx} className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {warning}
              </div>
            ))}
          </div>
        )}

        {/* 三维风险概览 */}
        <div className="grid grid-cols-3 gap-px bg-gray-200">
          {/* 税率风险 */}
          <div 
            className="bg-white p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('tax')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className={`w-5 h-5 ${riskColors[result.taxRisk.level as keyof typeof riskColors]}`} />
                <span className="font-medium">税率风险</span>
              </div>
              {expandedSection === 'tax' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${riskColors[result.taxRisk.level as keyof typeof riskColors]}`}>
                {result.taxRisk.score}
              </span>
              <span className="text-sm text-gray-400 mb-1">/100</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              高风险商品: <span className="font-medium text-red-600">{result.taxRisk.highRiskCount}</span>
            </div>
          </div>

          {/* 申报价值风险 */}
          <div 
            className="bg-white p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('declaration')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className={`w-5 h-5 ${
                  result.declarationRisk.highRiskCount > 0 ? 'text-red-600' :
                  result.declarationRisk.mediumRiskCount > 0 ? 'text-amber-600' : 'text-green-600'
                }`} />
                <span className="font-medium">申报价值风险</span>
              </div>
              {expandedSection === 'declaration' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${
                result.declarationRisk.highRiskCount > 0 ? 'text-red-600' :
                result.declarationRisk.mediumRiskCount > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {result.declarationRisk.score}
              </span>
              <span className="text-sm text-gray-400 mb-1">/100</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              价格异常: <span className="font-medium text-red-600">{result.declarationRisk.highRiskCount}</span>
              {result.declarationRisk.mediumRiskCount > 0 && (
                <span className="ml-2">偏低: <span className="text-amber-600">{result.declarationRisk.mediumRiskCount}</span></span>
              )}
            </div>
          </div>

          {/* 查验风险 */}
          <div 
            className="bg-white p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('inspection')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className={`w-5 h-5 ${riskColors[result.inspectionRisk.level as keyof typeof riskColors]}`} />
                <span className="font-medium">查验风险</span>
              </div>
              {expandedSection === 'inspection' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${riskColors[result.inspectionRisk.level as keyof typeof riskColors]}`}>
                {result.inspectionRisk.score}
              </span>
              <span className="text-sm text-gray-400 mb-1">/100</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              高查验率: <span className="font-medium text-red-600">{result.inspectionRisk.highRiskCount}</span>
            </div>
          </div>
        </div>

        {/* 展开详情 */}
        <div className="flex-1 overflow-auto">
          {/* 税率风险详情 */}
          {expandedSection === 'tax' && result.taxRisk.items.length > 0 && (
            <div className="p-6 border-t">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-primary-600" />
                税率风险商品 ({result.taxRisk.items.length})
              </h3>
              <div className="space-y-3">
                {result.taxRisk.items.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-primary-600">{item.hsCode}</span>
                        <span className="ml-2 text-gray-600">{item.productName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                        高风险
                      </span>
                    </div>
                    {item.reasons && (
                      <div className="mt-2 text-sm text-amber-600">
                        {item.reasons.join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 申报价值风险详情 */}
          {expandedSection === 'declaration' && result.declarationRisk.items.length > 0 && (
            <div className="p-6 border-t">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                申报价值异常商品 ({result.declarationRisk.items.length})
              </h3>
              <div className="space-y-3">
                {result.declarationRisk.items.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-primary-600">{item.hsCode}</span>
                        <span className="ml-2 text-gray-600">{item.productName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        €{item.declaredPrice} (建议≥€{item.suggestedMinPrice})
                      </span>
                    </div>
                    {item.warnings && item.warnings.length > 0 && (
                      <div className="mt-2 text-sm text-amber-600">
                        {item.warnings[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 查验风险详情 */}
          {expandedSection === 'inspection' && result.inspectionRisk.items.length > 0 && (
            <div className="p-6 border-t">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-600" />
                高查验率商品 ({result.inspectionRisk.items.length})
              </h3>
              <div className="space-y-3">
                {result.inspectionRisk.items.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-primary-600">{item.hsCode}</span>
                        <span className="ml-2 text-gray-600">{item.productName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        查验率 {item.inspectionRate}%
                      </span>
                    </div>
                    {item.avgDelayDays > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        平均延误: {item.avgDelayDays} 天 | 历史记录: {item.historicalShipments} 次
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 无风险时显示 */}
          {!result.needsAttention && (
            <div className="p-12 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-medium text-green-700 mb-2">风险评估良好</h3>
              <p className="text-gray-500">本批货物整体风险较低，可正常进行申报</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              了解并继续
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

