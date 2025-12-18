import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileCheck, Calculator, Download, CheckCircle, RefreshCw,
  ChevronDown, FileText, AlertTriangle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'
import { useToast } from '../components/Toast'
import { useDownload } from '../hooks/useDownload'

const API_BASE = getApiBaseUrl()

interface ImportBatch {
  id: number
  importNo: string
  customerName: string
  containerNo: string
  totalItems: number
  matchedItems: number
  status: string
}

interface TaxDetails {
  batch: {
    id: number
    importNo: string
    customerName: string
    containerNo: string
    billNumber: string
    totalItems: number
    matchedItems: number
    totalValue: number
    totalDuty: number
    totalVat: number
    totalOtherTax: number
    customerConfirmed: number
    customerConfirmedAt: string
    confirmPdfPath: string
    status: string
    clearanceType: string
  }
  items: Array<{
    id: number
    itemNo: number
    productName: string
    matchedHsCode: string
    quantity: number
    unitName: string
    totalValue: number
    dutyRate: number
    vatRate: number
    antiDumpingRate: number
    countervailingRate: number
    dutyAmount: number
    vatAmount: number
    otherTaxAmount: number
    totalTax: number
  }>
  summary: {
    totalValue: number
    totalDuty: number
    totalVat: number
    payableVat: number
    deferredVat: number
    totalOtherTax: number
    totalTax: number
    clearanceType: string
    clearanceTypeLabel: string
    isDeferred: boolean
  }
  byHsCode: Array<{
    hsCode: string
    itemCount: number
    totalValue: number
    totalDuty: number
    totalVat: number
    totalOtherTax: number
    totalTax: number
  }>
}

export default function DocumentTaxCalc() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const importIdParam = searchParams.get('importId')
  const { showToast } = useToast()
  const { downloadTaxConfirmPdf } = useDownload()

  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [taxDetails, setTaxDetails] = useState<TaxDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [changingType, setChangingType] = useState(false)

  useEffect(() => {
    loadBatches()
  }, [])

  useEffect(() => {
    if (importIdParam) {
      const batch = batches.find(b => b.id === parseInt(importIdParam))
      if (batch) {
        setSelectedBatch(batch)
      }
    }
  }, [importIdParam, batches])

  useEffect(() => {
    if (selectedBatch) {
      loadTaxDetails()
    }
  }, [selectedBatch])

  const loadBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/imports?pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setBatches(data.data?.list || [])
        if (importIdParam) {
          const batch = data.data?.list?.find((b: ImportBatch) => b.id === parseInt(importIdParam))
          if (batch) {
            setSelectedBatch(batch)
          }
        }
      }
    } catch (error) {
      console.error('加载批次列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTaxDetails = async () => {
    if (!selectedBatch) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/tax-calc/${selectedBatch.id}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setTaxDetails(data.data)
      }
    } catch (error) {
      console.error('加载税费详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!selectedBatch) return
    setCalculating(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/tax-calc/${selectedBatch.id}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', '税费计算完成')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '计算失败')
      }
    } catch (error) {
      console.error('计算失败:', error)
      showToast('error', '计算失败')
    } finally {
      setCalculating(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!selectedBatch) return
    setGeneratingPdf(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/tax-calc/${selectedBatch.id}/pdf`)
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', 'PDF生成成功')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || 'PDF生成失败')
      }
    } catch (error) {
      console.error('PDF生成失败:', error)
      showToast('error', 'PDF生成失败')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!selectedBatch || !taxDetails?.batch.confirmPdfPath) return
    downloadTaxConfirmPdf(selectedBatch.id, taxDetails.batch.importNo)
  }

  const handleMarkConfirmed = async () => {
    if (!selectedBatch) return
    if (!confirm('确定标记客户已确认？')) return
    
    setConfirming(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/tax-calc/${selectedBatch.id}/confirm`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', '已标记客户确认')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      showToast('error', '操作失败')
    } finally {
      setConfirming(false)
    }
  }

  // 更新清关类型
  const handleClearanceTypeChange = async (type: '40' | '42') => {
    if (!selectedBatch) return
    setChangingType(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/tax-calc/${selectedBatch.id}/clearance-type`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearanceType: type })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', type === '42' ? '已切换为42号递延清关' : '已切换为40号普通清关')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新清关类型失败:', error)
      showToast('error', '更新失败')
    } finally {
      setChangingType(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
  ]

  const isDeferred = taxDetails?.summary?.isDeferred || false

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/tax-calc"
        onTabChange={(path) => navigate(path)}
      />

      {/* 批次选择 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">选择导入批次</label>
            <div className="relative">
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => {
                  const batch = batches.find(b => b.id === parseInt(e.target.value))
                  setSelectedBatch(batch || null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm appearance-none bg-white"
                title="选择导入批次"
              >
                <option value="">请选择批次</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.importNo} - {batch.containerNo || '无柜号'} ({batch.matchedItems}/{batch.totalItems}件已匹配)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {selectedBatch && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                {calculating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4" />
                )}
                {calculating ? '计算中...' : '计算税费'}
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
              >
                {generatingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                生成PDF
              </button>
              {taxDetails?.batch.confirmPdfPath && (
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  下载PDF
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 税费详情 */}
      {taxDetails && (
        <>
          {/* 清关类型选择 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">清关方式</h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clearanceType"
                      value="40"
                      checked={!isDeferred}
                      onChange={() => handleClearanceTypeChange('40')}
                      disabled={changingType}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">
                      <span className="font-medium">40号普通清关</span>
                      <span className="text-gray-500 ml-1">（关税+增值税在进口国缴纳）</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clearanceType"
                      value="42"
                      checked={isDeferred}
                      onChange={() => handleClearanceTypeChange('42')}
                      disabled={changingType}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">
                      <span className="font-medium">42号递延清关</span>
                      <span className="text-gray-500 ml-1">（增值税递延到目的地国家缴纳）</span>
                    </span>
                  </label>
                </div>
              </div>
              {isDeferred && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded text-blue-700 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  递延清关：增值税 {formatCurrency(taxDetails.summary.deferredVat || 0)} 将在目的地国家缴纳
                </div>
              )}
            </div>
          </div>

          {/* 汇总卡片 */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">货值总额</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(taxDetails.summary.totalValue)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">关税</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(taxDetails.summary.totalDuty)}</div>
            </div>
            <div className={`bg-white rounded-lg border p-4 ${isDeferred ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
              <div className="text-xs text-gray-500 mb-1">
                增值税
                {isDeferred && <span className="ml-1 text-blue-600">(递延)</span>}
              </div>
              <div className={`text-xl font-bold ${isDeferred ? 'text-gray-400 line-through' : 'text-amber-600'}`}>
                {formatCurrency(taxDetails.summary.totalVat)}
              </div>
              {isDeferred && (
                <div className="text-xs text-blue-600 mt-1">目的地国家缴纳</div>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">其他税费</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(taxDetails.summary.totalOtherTax)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 bg-gradient-to-br from-green-50 to-green-100">
              <div className="text-xs text-gray-500 mb-1">
                {isDeferred ? '进口应付税费' : '税费合计'}
              </div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(taxDetails.summary.totalTax)}</div>
              {isDeferred && (
                <div className="text-xs text-gray-500 mt-1">
                  不含递延增值税
                </div>
              )}
            </div>
          </div>

          {/* 客户确认状态 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">客户确认状态</h3>
                {taxDetails.batch.customerConfirmed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">客户已确认</span>
                    <span className="text-xs text-gray-500">
                      ({taxDetails.batch.customerConfirmedAt ? new Date(taxDetails.batch.customerConfirmedAt).toLocaleString('zh-CN') : '-'})
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-600 text-sm">待客户确认</div>
                )}
              </div>
              {!taxDetails.batch.customerConfirmed && (
                <button
                  onClick={handleMarkConfirmed}
                  disabled={confirming}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {confirming ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  标记客户已确认
                </button>
              )}
            </div>
          </div>

          {/* 按HS编码汇总 */}
          {taxDetails.byHsCode.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">按HS编码汇总</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">HS编码</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-500">商品数</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">货值</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">关税</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        增值税
                        {isDeferred && <span className="text-blue-500 ml-1">(递延)</span>}
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">其他税</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">税费合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxDetails.byHsCode.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono">{item.hsCode}</td>
                        <td className="px-4 py-2 text-center">{item.itemCount}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.totalValue)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.totalDuty)}</td>
                        <td className={`px-4 py-2 text-right ${isDeferred ? 'text-gray-400' : ''}`}>
                          {formatCurrency(item.totalVat)}
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.totalOtherTax)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(isDeferred 
                            ? item.totalDuty + item.totalOtherTax 
                            : item.totalTax
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 商品明细 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">商品税费明细 ({taxDetails.items.length}项)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">行号</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">HS编码</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">货值</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">关税率</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">关税</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">增值税率</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      增值税
                      {isDeferred && <span className="text-blue-500 ml-1">(递延)</span>}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">其他税</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">税费合计</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        加载中...
                      </td>
                    </tr>
                  ) : taxDetails.items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    taxDetails.items.map(item => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.itemNo}</td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="px-3 py-2 font-mono">{item.matchedHsCode || '-'}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.totalValue)}</td>
                        <td className="px-3 py-2 text-right">{item.dutyRate}%</td>
                        <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(item.dutyAmount)}</td>
                        <td className="px-3 py-2 text-right">{item.vatRate}%</td>
                        <td className={`px-3 py-2 text-right ${isDeferred ? 'text-gray-400' : 'text-amber-600'}`}>
                          {formatCurrency(item.vatAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-purple-600">{formatCurrency(item.otherTaxAmount)}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {formatCurrency(isDeferred 
                            ? item.dutyAmount + item.otherTaxAmount 
                            : item.totalTax
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {taxDetails.items.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 font-medium">合计</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(taxDetails.summary.totalValue)}</td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-medium text-blue-600">{formatCurrency(taxDetails.summary.totalDuty)}</td>
                      <td></td>
                      <td className={`px-3 py-2 text-right font-medium ${isDeferred ? 'text-gray-400' : 'text-amber-600'}`}>
                        {formatCurrency(taxDetails.summary.totalVat)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-purple-600">{formatCurrency(taxDetails.summary.totalOtherTax)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-600">{formatCurrency(taxDetails.summary.totalTax)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* 递延清关说明 */}
          {isDeferred && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-1">42号递延清关说明</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 货物在进口国（如荷兰）清关时，仅需缴纳关税 {formatCurrency(taxDetails.summary.totalDuty)}</li>
                    <li>• 增值税 {formatCurrency(taxDetails.summary.deferredVat || 0)} 将递延到货物最终目的地国家缴纳</li>
                    <li>• 适用于货物清关后将运往其他欧盟成员国的情况</li>
                    <li>• 需要提供有效的目的地国家增值税号</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 无批次选择提示 */}
      {!selectedBatch && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">请选择一个导入批次查看税费计算结果</p>
        </div>
      )}
    </div>
  )
}
