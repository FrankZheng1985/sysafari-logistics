/**
 * 查验风险预警组件
 * 分析导入批次的查验风险，显示高风险商品预警
 */

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Shield, Search, CheckCircle, X, Eye, Clock, Ban, FileWarning } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE_URL = getApiBaseUrl()

interface RiskItem {
  itemId: number
  hsCode: string
  productName: string
  originCountry?: string
  riskLevel: string
  inspectionRate: number
  physicalRate?: number
  avgDelayDays: number
  historicalShipments: number
}

interface InspectionRiskResult {
  importId: number
  totalItems: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  avgRiskScore: number
  overallRiskLevel: string
  riskItems: RiskItem[]
  warnings: string[]
  needsAttention: boolean
  analyzedAt: string
}

interface Props {
  importId: number
  autoAnalyze?: boolean
  onAnalysisComplete?: (result: InspectionRiskResult) => void
  onConfirm?: () => void
  onCancel?: () => void
}

const riskColors = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600'
}

const riskBgColors = {
  low: 'bg-green-100',
  medium: 'bg-amber-100',
  high: 'bg-red-100'
}

export default function InspectionRiskAlert({
  importId,
  autoAnalyze = true,
  onAnalysisComplete,
  onConfirm,
  onCancel
}: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InspectionRiskResult | null>(null)
  const [showModal, setShowModal] = useState(false)

  // 自动分析
  useEffect(() => {
    if (autoAnalyze && importId) {
      analyzeRisk()
    }
  }, [importId, autoAnalyze])

  const analyzeRisk = async () => {
    if (loading) return
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/cargo/inspection/analyze-risk/${importId}`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data?.errCode === 200 || data?.success) {
        const result = data.data as InspectionRiskResult
        setResult(result)
        onAnalysisComplete?.(result)
        
        // 如果有高风险，自动显示弹窗
        if (result.needsAttention) {
          setShowModal(true)
        }
      }
    } catch (error) {
      console.error('分析查验风险失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理确认
  const handleConfirm = () => {
    setShowModal(false)
    onConfirm?.()
  }

  // 处理取消
  const handleCancel = () => {
    setShowModal(false)
    onCancel?.()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-500">正在分析查验风险...</span>
      </div>
    )
  }

  if (!result) {
    return (
      <button
        onClick={analyzeRisk}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
      >
        <Search className="w-4 h-4" />
        分析查验风险
      </button>
    )
  }

  // 风险摘要卡片
  const RiskSummaryCard = () => (
    <div className={`rounded-lg border p-4 ${
      result.overallRiskLevel === 'high' ? 'bg-red-50 border-red-200' :
      result.overallRiskLevel === 'medium' ? 'bg-amber-50 border-amber-200' :
      'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {result.overallRiskLevel === 'high' ? (
            <AlertTriangle className="w-8 h-8 text-red-600" />
          ) : result.overallRiskLevel === 'medium' ? (
            <FileWarning className="w-8 h-8 text-amber-600" />
          ) : (
            <Shield className="w-8 h-8 text-green-600" />
          )}
          <div>
            <div className={`font-bold text-lg ${riskColors[result.overallRiskLevel as keyof typeof riskColors]}`}>
              {result.overallRiskLevel === 'high' ? '高查验风险' :
               result.overallRiskLevel === 'medium' ? '中等查验风险' : '低查验风险'}
            </div>
            <div className="text-sm text-gray-500">
              综合风险评分: {result.avgRiskScore}/100
            </div>
          </div>
        </div>
        {result.needsAttention && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            查看详情
          </button>
        )}
      </div>

      {/* 风险分布 */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-white rounded-lg">
          <div className="text-2xl font-bold text-red-600">{result.highRiskCount}</div>
          <div className="text-xs text-gray-500">高风险商品</div>
        </div>
        <div className="p-3 bg-white rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{result.mediumRiskCount}</div>
          <div className="text-xs text-gray-500">中风险商品</div>
        </div>
        <div className="p-3 bg-white rounded-lg">
          <div className="text-2xl font-bold text-green-600">{result.lowRiskCount}</div>
          <div className="text-xs text-gray-500">低风险商品</div>
        </div>
      </div>

      {/* 警告信息 */}
      {result.warnings.length > 0 && (
        <div className="mt-4 space-y-1">
          {result.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <RiskSummaryCard />

      {/* 详情弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancel}>
          <div 
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className={`px-6 py-4 ${
              result.overallRiskLevel === 'high' ? 'bg-red-600' :
              result.overallRiskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-600'
            } text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6" />
                  <div>
                    <h3 className="font-bold text-lg">查验风险预警</h3>
                    <p className="text-sm opacity-90">
                      本批货物包含高查验率商品，请仔细核对
                    </p>
                  </div>
                </div>
                <button onClick={handleCancel} className="p-2 hover:bg-white/20 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 风险商品列表 */}
            <div className="flex-1 overflow-auto p-6">
              {result.riskItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">无高风险商品</p>
                  <p className="text-sm">本批货物查验风险较低</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-2">
                    以下 <span className="font-bold text-red-600">{result.riskItems.length}</span> 个商品存在较高查验风险:
                  </div>
                  
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">HS编码</th>
                        <th className="px-3 py-2 text-left">商品名称</th>
                        <th className="px-3 py-2 text-center">查验率</th>
                        <th className="px-3 py-2 text-center">历史记录</th>
                        <th className="px-3 py-2 text-center">平均延误</th>
                        <th className="px-3 py-2 text-center">风险等级</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.riskItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-primary-600">
                            {item.hsCode}
                          </td>
                          <td className="px-3 py-2">
                            <div className="max-w-[200px] truncate" title={item.productName}>
                              {item.productName}
                            </div>
                            {item.originCountry && (
                              <div className="text-xs text-gray-400">{item.originCountry}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${
                              item.inspectionRate >= 30 ? 'text-red-600' :
                              item.inspectionRate >= 15 ? 'text-amber-600' : 'text-gray-600'
                            }`}>
                              {item.inspectionRate}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500">
                            {item.historicalShipments} 次
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.avgDelayDays > 0 ? (
                              <span className="flex items-center justify-center gap-1 text-amber-600">
                                <Clock className="w-3 h-3" />
                                {item.avgDelayDays} 天
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                item.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                item.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {item.riskLevel === 'high' ? '高' :
                                 item.riskLevel === 'medium' ? '中' : '低'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 建议 */}
            <div className="px-6 py-4 bg-blue-50 border-t">
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>建议措施:</strong>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>确保所有单证资料完整、准确</li>
                    <li>商品描述与实际货物一致</li>
                    <li>申报价值合理，有相关佐证</li>
                    <li>提前准备可能需要的补充材料</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                返回修改
              </button>
              <button
                onClick={handleConfirm}
                className={`px-6 py-2 rounded-lg text-white ${
                  result.overallRiskLevel === 'high' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  确认继续
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * 简化版查验风险标识组件
 * 用于在表格中显示
 */
export function InspectionRiskBadge({ 
  hsCode, 
  originCountry 
}: { 
  hsCode: string
  originCountry?: string 
}) {
  const [stats, setStats] = useState<{ inspectionRate: number; riskLevel: string } | null>(null)

  useEffect(() => {
    if (!hsCode) return
    
    const fetchStats = async () => {
      try {
        const params = new URLSearchParams()
        if (originCountry) params.append('originCountry', originCountry)
        const url = `${API_BASE_URL}/api/cargo/inspection/stats/${hsCode}${params.toString() ? '?' + params.toString() : ''}`
        const response = await fetch(url)
        const data = await response.json()
        if ((data?.errCode === 200 || data?.success) && data.data.found) {
          setStats({
            inspectionRate: data.data.stats.inspectionRate,
            riskLevel: data.data.riskLevel
          })
        }
      } catch (error) {
        // 静默处理
      }
    }
    fetchStats()
  }, [hsCode, originCountry])

  if (!stats || stats.riskLevel === 'low') return null

  return (
    <span 
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
        stats.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
      title={`历史查验率: ${stats.inspectionRate}%`}
    >
      <Eye className="w-3 h-3" />
      {stats.inspectionRate}%
    </span>
  )
}

