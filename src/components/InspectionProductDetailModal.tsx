/**
 * 查验产品详情弹窗组件
 */
import { useState } from 'react'
import { X, RefreshCw, AlertTriangle, Package, FileText, CheckCircle, ShieldAlert, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react'

// 风险等级配置
const RISK_LEVEL_CONFIG = {
  high: { label: '高风险', color: 'bg-red-100 text-red-700', desc: '查验率 > 20%' },
  medium: { label: '中风险', color: 'bg-amber-100 text-amber-700', desc: '查验率 5%-20%' },
  low: { label: '低风险', color: 'bg-green-100 text-green-700', desc: '查验率 < 5%' }
}

interface MaterialRecord {
  id: number
  productName: string
  productNameEn?: string
  hsCode: string
  quantity?: number
  unit?: string
  totalValue?: number
  originCountry?: string
  billNumber?: string
  fileName?: string
  importTime?: string
  createdAt?: string
}

interface MaterialDistributionItem {
  material: string
  count: number
  records: MaterialRecord[]
}

interface InspectionProductDetailModalProps {
  item: any
  loading: boolean
  onClose: () => void
}

export default function InspectionProductDetailModal({ item, loading, onClose }: InspectionProductDetailModalProps) {
  // 展开的材质列表
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  // 查验类型名称映射
  const inspectionTypeMap: Record<string, string> = {
    none: '未查验',
    document: '单证查验',
    physical: '实物查验',
    scan: '扫描查验',
    full: '全面查验'
  }
  
  // 查验结果名称映射
  const inspectionResultMap: Record<string, { label: string; color: string }> = {
    passed: { label: '通过', color: 'bg-green-100 text-green-700' },
    released: { label: '放行', color: 'bg-green-100 text-green-700' },
    failed: { label: '不通过', color: 'bg-red-100 text-red-700' },
    pending: { label: '待处理', color: 'bg-amber-100 text-amber-700' }
  }
  
  // 获取风险等级对应的背景色（用于整个卡片）
  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-50 border-red-200'
      case 'medium': return 'bg-amber-50 border-amber-200'
      case 'low': return 'bg-green-50 border-green-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">查验产品详情</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : item ? (
            <>
              {/* 基本信息 */}
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">中文品名</span>
                    <p className="text-base font-semibold text-gray-900">{item.product_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">英文品名</span>
                    <p className="text-base text-gray-700">
                      {item.tariffInfo?.goodsDescriptionEn || '-'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">HS编码</span>
                    <p className="text-sm font-mono text-primary-600">{item.hs_code}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">材质</span>
                    <p className="text-sm text-gray-900">{item.material || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">存储的风险等级</span>
                    <p>
                      <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
                        RISK_LEVEL_CONFIG[item.risk_level as keyof typeof RISK_LEVEL_CONFIG]?.color || 'bg-gray-100 text-gray-600'
                      }`}>
                        {RISK_LEVEL_CONFIG[item.risk_level as keyof typeof RISK_LEVEL_CONFIG]?.label || item.risk_level}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 申报次数统计 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  申报次数统计
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">HS编码申报</span>
                    <span className="text-xl font-bold text-blue-600">
                      {item.declarationStats?.hsCodeCount || 0}
                    </span>
                    <span className="text-xs text-gray-400 block">次</span>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">品名+HS申报</span>
                    <span className="text-xl font-bold text-blue-600">
                      {item.declarationStats?.productNameCount || 0}
                    </span>
                    <span className="text-xs text-gray-400 block">次</span>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">材质类型</span>
                    <span className="text-xl font-bold text-blue-600">
                      {item.declarationStats?.materialDistribution?.length || 0}
                    </span>
                    <span className="text-xs text-gray-400 block">种</span>
                  </div>
                </div>
                {/* 材质申报统计 - 可点击穿透 */}
                {item.declarationStats?.materialDistribution?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <span className="text-xs text-gray-500 mb-2 block">
                      材质申报统计（品名+HS下不同材质申报次数）
                      <span className="text-blue-500 ml-1">- 点击查看详情</span>
                    </span>
                    <div className="space-y-2">
                      {item.declarationStats.materialDistribution.map((m: MaterialDistributionItem, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg overflow-hidden border border-blue-100">
                          {/* 材质标题行 - 可点击 */}
                          <button
                            onClick={() => setExpandedMaterial(expandedMaterial === m.material ? null : m.material)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {expandedMaterial === m.material ? (
                                <ChevronDown className="w-4 h-4 text-blue-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm font-medium text-gray-800">{m.material || '未标注材质'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-blue-600">{m.count}</span>
                              <span className="text-xs text-gray-500">次申报</span>
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </div>
                          </button>
                          
                          {/* 展开的详细记录表格 */}
                          {expandedMaterial === m.material && m.records && m.records.length > 0 && (
                            <div className="border-t border-blue-100 bg-gray-50 p-3">
                              <p className="text-xs text-gray-500 mb-2">申报记录明细（最近20条）:</p>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-[110px]">提单号</th>
                                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">品名</th>
                                      <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-[100px]">HS编码</th>
                                      <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-20 whitespace-nowrap">数量</th>
                                      <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-20">货值</th>
                                      <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-16">产地</th>
                                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-24">导入时间</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {m.records.map((record: MaterialRecord) => (
                                      <tr key={record.id} className="bg-white hover:bg-blue-50/50">
                                        <td className="px-2 py-1.5 text-primary-600 font-mono">
                                          {record.billNumber || '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-800" title={record.productNameEn}>
                                          {record.productName || '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                                          {record.hsCode || '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-gray-800 whitespace-nowrap">
                                          {record.quantity ? `${record.quantity} ${record.unit || ''}` : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-gray-800">
                                          {record.totalValue ? `$${record.totalValue.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-gray-600">
                                          {record.originCountry || '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-500">
                                          {record.importTime ? new Date(record.importTime).toLocaleDateString('zh-CN') : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {m.count > m.records.length && (
                                <p className="text-center text-xs text-gray-400 mt-2">
                                  仅显示最近 {m.records.length} 条，共 {m.count} 条申报记录
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 查验统计 - 核心指标 */}
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  查验统计
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">申报次数</span>
                    <span className="text-xl font-bold text-gray-900">{item.stats?.declarationCount || 0}</span>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">被查验次数</span>
                    <span className="text-xl font-bold text-amber-600">{item.stats?.inspectedCount || 0}</span>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border-2 border-amber-300">
                    <span className="text-xs text-gray-500 block mb-1">查验率</span>
                    <span className="text-xl font-bold text-red-600">
                      {item.stats?.calculatedInspectionRate !== null 
                        ? `${item.stats.calculatedInspectionRate}%` 
                        : '-'}
                    </span>
                    <span className="text-[10px] text-gray-400 block">查验/申报</span>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">放行率</span>
                    <span className="text-xl font-bold text-green-600">
                      {item.stats?.releaseRate !== null 
                        ? `${item.stats.releaseRate}%` 
                        : '-'}
                    </span>
                    <span className="text-[10px] text-gray-400 block">放行/查验</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="text-center p-2 bg-white rounded">
                    <span className="text-xs text-gray-500 block">已放行</span>
                    <span className="text-sm font-medium text-green-600">{item.stats?.passedCount || 0} 次</span>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <span className="text-xs text-gray-500 block">待处理</span>
                    <span className="text-sm font-medium text-amber-600">{item.stats?.pendingCount || 0} 次</span>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <span className="text-xs text-gray-500 block">未通过</span>
                    <span className="text-sm font-medium text-red-600">{item.stats?.failedCount || 0} 次</span>
                  </div>
                </div>
              </div>
              
              {/* 风险评估结果 */}
              <div className={`rounded-lg p-4 border ${getRiskBgColor(item.stats?.calculatedRiskLevel)}`}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  风险评估结果
                </h3>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">计算风险等级</span>
                    <span className={`inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 rounded text-sm font-medium ${
                      RISK_LEVEL_CONFIG[item.stats?.calculatedRiskLevel as keyof typeof RISK_LEVEL_CONFIG]?.color || 'bg-gray-100 text-gray-600'
                    }`}>
                      {RISK_LEVEL_CONFIG[item.stats?.calculatedRiskLevel as keyof typeof RISK_LEVEL_CONFIG]?.label || '未知'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-gray-500 block mb-1">风险等级标准</span>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600">低风险: &lt;5%</span>
                      <span className="text-amber-600">中风险: 5%-20%</span>
                      <span className="text-red-600">高风险: &gt;20%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">高敏感产品</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      item.stats?.isSensitiveProduct ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.stats?.isSensitiveProduct ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          是
                        </>
                      ) : '否'}
                    </span>
                  </div>
                </div>
                {item.stats?.releaseRate === 100 && item.stats?.inspectedCount > 0 && (
                  <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-700">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    全部查验均已放行，风险等级已自动下调一级
                  </div>
                )}
              </div>
              
              {/* 税率信息 */}
              {item.tariffInfo && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-600" />
                    税率信息
                  </h3>
                  <div className="grid grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">关税率</span>
                      <p className="text-gray-900 font-medium">{item.tariffInfo.dutyRate || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">优惠税率</span>
                      <p className="text-gray-900 font-medium">{item.tariffInfo.preferentialRate || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">反倾销税率</span>
                      <p className="text-orange-600 font-medium">{item.tariffInfo.antiDumpingRate || '0%'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">反补贴税率</span>
                      <p className="text-orange-600 font-medium">{item.tariffInfo.countervailingRate || '0%'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">增值税率</span>
                      <p className="text-gray-900 font-medium">{item.tariffInfo.vatRate || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 历史查验记录 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  历史查验记录 ({item.historyRecords?.length || 0})
                </h3>
                {item.historyRecords && item.historyRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-[110px]">提单号</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-[100px]">集装箱号</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">中文品名</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">英文品名</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-16">材质</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-16">查验状态</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-16">放行类型</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-36">查验日期</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-36">放行日期</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {item.historyRecords.slice(0, 20).map((record: any) => {
                          // 从 items 中获取第一个匹配货物的品名和材质
                          const firstItem = record.items?.[0] || {}
                          
                          // 日期格式化函数
                          const formatDate = (dateStr: string) => {
                            if (!dateStr) return '-'
                            try {
                              const date = new Date(dateStr)
                              if (isNaN(date.getTime())) return dateStr
                              return date.toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }).replace(/\//g, '-')
                            } catch {
                              return dateStr
                            }
                          }
                          
                          return (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 whitespace-nowrap text-primary-600 font-mono text-xs">
                                {record.billNo || '-'}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-600 text-xs">
                                {record.containerNo || '-'}
                              </td>
                              <td className="px-2 py-2 text-gray-900 text-xs max-w-[120px]">
                                <div className="truncate" title={firstItem.productName}>
                                  {firstItem.productName || '-'}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-gray-600 text-xs max-w-[120px]">
                                <div className="truncate" title={firstItem.productNameEn}>
                                  {firstItem.productNameEn || '-'}
                                </div>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-600 text-xs">
                                {firstItem.material || '-'}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center justify-center min-w-[52px] px-1.5 py-0.5 rounded text-xs ${
                                  record.inspectionStatus === '查验放行' || record.inspectionStatus === '已放行' ? 'bg-green-100 text-green-700' :
                                  record.inspectionStatus === '已查验' ? 'bg-blue-100 text-blue-700' :
                                  record.inspectionStatus === '查验中' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {record.inspectionStatus || '-'}
                                </span>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-center text-xs">
                                {record.releaseType ? (
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    record.releaseType === '直接放行' ? 'bg-green-50 text-green-700' :
                                    record.releaseType === '补税放行' ? 'bg-amber-50 text-amber-700' :
                                    'bg-gray-50 text-gray-600'
                                  }`}>
                                    {record.releaseType}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-xs">
                                {formatDate(record.inspectionDate)}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-500 text-xs">
                                {formatDate(record.releaseDate)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {item.historyRecords.length > 20 && (
                      <p className="text-center text-xs text-gray-500 mt-2">
                        仅显示最近 20 条记录，共 {item.historyRecords.length} 条
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    暂无历史查验记录
                  </div>
                )}
              </div>
              
              {/* 备注 */}
              {item.risk_notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">备注</h3>
                  <p className="text-sm text-gray-600">{item.risk_notes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              未找到产品信息
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
