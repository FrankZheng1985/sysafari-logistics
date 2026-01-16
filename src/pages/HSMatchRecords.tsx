/**
 * HS匹配记录管理页面
 * 查看已匹配的商品信息、申报历史和价格统计
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, RefreshCw, FileText, CheckCircle, Trash2, Eye,
  Package, TrendingUp, History, X, Edit2, Save, FileCheck, Database
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface MatchRecord {
  id: number
  productName: string
  productNameEn: string
  hsCode: string
  material: string
  materialEn: string
  originCountry: string
  originCountryCode: string
  avgUnitPrice: number
  avgKgPrice: number
  minUnitPrice: number
  maxUnitPrice: number
  totalDeclaredValue: number
  totalDeclaredQty: number
  totalDeclaredWeight: number
  // 单件重量相关字段
  avgPieceWeight: number
  minPieceWeight: number
  maxPieceWeight: number
  dutyRate: number
  vatRate: number
  antiDumpingRate: number
  countervailingRate: number
  matchCount: number
  firstMatchTime: string
  lastMatchTime: string
  customerName: string
  isVerified: boolean
  status: string
  createdAt: string
  updatedAt: string
  // 新增字段
  minDeclarationValueRange?: string
  refWeightRange?: string
  usageScenario?: string
}

interface DeclarationHistory {
  id: number
  importId: number
  importNo: string
  containerNo: string
  customerName: string
  cargoItemId: number
  declaredQty: number
  declaredWeight: number
  declaredValue: number
  unitPrice: number
  kgPrice: number
  dutyAmount: number
  vatAmount: number
  otherTaxAmount: number
  totalTax: number
  declaredAt: string
}

interface RecordDetail extends MatchRecord {
  history: DeclarationHistory[]
}

export default function HSMatchRecords() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [hsCodeFilter, setHsCodeFilter] = useState('')
  
  // 全局统计数据（不受分页影响）
  const [stats, setStats] = useState({
    totalRecords: 0,
    verifiedCount: 0,
    totalMatchCount: 0,
    totalDeclaredValue: 0
  })

  // 详情弹窗
  const [selectedRecord, setSelectedRecord] = useState<RecordDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 编辑弹窗
  const [editingRecord, setEditingRecord] = useState<MatchRecord | null>(null)
  const [editForm, setEditForm] = useState({
    productName: '',
    productNameEn: '',
    hsCode: '',
    material: '',
    materialEn: '',
    originCountry: '',
    remarks: ''
  })
  const [saving, setSaving] = useState(false)

  // 页面tabs
  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
    { label: '匹配记录库', path: '/documents/match-records' },
    { label: '敏感产品库', path: '/documents/sensitive-products' },
  ]

  useEffect(() => {
    loadRecords()
  }, [page, pageSize])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (keyword) params.append('keyword', keyword)
      if (hsCodeFilter) params.append('hsCode', hsCodeFilter)

      const res = await fetch(`${API_BASE}/api/cargo/documents/match-records?${params}`)
      const data = await res.json()
      if (data.errCode === 200) {
        const list = data.data.list || data.data || []
        setRecords(list)
        // 修复 total 的获取逻辑
        setTotal(data.data.total || list.length || 0)
        // 设置全局统计数据
        if (data.data.stats) {
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('加载匹配记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadRecords()
  }

  const loadDetail = async (id: number) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/match-records/${id}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setSelectedRecord(data.data)
      }
    } catch (error) {
      console.error('加载详情失败:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleVerify = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/match-records/${id}/verify`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadRecords()
      }
    } catch (error) {
      console.error('验证失败:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/match-records/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadRecords()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const handleEdit = (record: MatchRecord) => {
    setEditingRecord(record)
    setEditForm({
      productName: record.productName || '',
      productNameEn: record.productNameEn || '',
      hsCode: record.hsCode || '',
      material: record.material || '',
      materialEn: record.materialEn || '',
      originCountry: record.originCountry || '',
      remarks: ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingRecord) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/match-records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setEditingRecord(null)
        loadRecords()
      }
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/match-records"
        onTabChange={(path) => navigate(path)}
      />

      {/* 页面副标题 */}
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-medium text-gray-900">HS匹配记录库</h2>
        <span className="text-sm text-gray-500">- 记录已匹配的商品信息，方便后续快速匹配</span>
      </div>

      {/* 统计卡片 - 使用全局统计数据，不受分页影响 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalRecords}</p>
              <p className="text-xs text-gray-500">商品记录</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.verifiedCount}</p>
              <p className="text-xs text-gray-500">已核实</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalMatchCount}</p>
              <p className="text-xs text-gray-500">总匹配次数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <History className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                €{stats.totalDeclaredValue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">累计申报货值</p>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索品名、材质..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="w-36">
              <input
                type="text"
                value={hsCodeFilter}
                onChange={(e) => setHsCodeFilter(e.target.value)}
                placeholder="HS编码筛选"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              搜索
            </button>
            <button
              onClick={loadRecords}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">品名</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">HS编码</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">材质</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">匹配次数</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">平均单价</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">平均公斤价</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">累计货值</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">平均单件重</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">单件重量区间</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">关税率</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">状态</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">最近匹配</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    暂无匹配记录
                    <p className="text-xs mt-1">客户确认税费后，匹配数据会自动保存到此处</p>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="max-w-[180px]">
                        <div className="font-medium text-gray-900 truncate" title={record.productName}>
                          {record.productName}
                        </div>
                        {record.productNameEn && (
                          <div className="text-gray-400 truncate" title={record.productNameEn}>
                            {record.productNameEn}
                          </div>
                        )}
                        {/* 显示参考价格和重量区间 */}
                        {(record.minDeclarationValueRange || record.refWeightRange) && (
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                            {record.minDeclarationValueRange && (
                              <span title="申报价格区间 (EUR/件)">💰{record.minDeclarationValueRange}</span>
                            )}
                            {record.refWeightRange && (
                              <span title="参考重量区间 (kg)">⚖️{record.refWeightRange}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-primary-600">{record.hsCode}</td>
                    <td className="px-3 py-2 text-gray-600">{record.material || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {record.matchCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      €{record.avgUnitPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      €{record.avgKgPrice.toFixed(2)}/kg
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      €{record.totalDeclaredValue.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {record.avgPieceWeight > 0 ? `${record.avgPieceWeight.toFixed(2)}kg` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                      {record.minPieceWeight > 0 || record.maxPieceWeight > 0 ? (
                        <span className="text-xs">
                          {record.minPieceWeight.toFixed(2)}~{record.maxPieceWeight.toFixed(2)}kg
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={record.dutyRate > 0 ? 'text-amber-600' : 'text-gray-500'}>
                        {record.dutyRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
                          record.isVerified 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {record.isVerified ? '已核实' : '待核实'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {record.lastMatchTime ? formatDate(record.lastMatchTime) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => loadDetail(record.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!record.isVerified && (
                          <button
                            onClick={() => handleVerify(record.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600"
                            title="标记已核实"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 - 与系统其他页面保持一致 */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              共 <span className="font-medium">{total}</span> 条记录
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-gray-700">
              第 {page} / {totalPages || 1} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || totalPages <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
            >
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
              <option value={100}>100 条/页</option>
            </select>
          </div>
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">匹配记录详情</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {loadingDetail ? (
                <div className="py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : (
                <>
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-xs text-gray-500">中文品名</label>
                      <p className="text-sm font-medium">{selectedRecord.productName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">英文品名</label>
                      <p className="text-sm">{selectedRecord.productNameEn || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">HS编码</label>
                      <p className="text-sm font-mono text-primary-600">{selectedRecord.hsCode}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">材质</label>
                      <p className="text-sm">{selectedRecord.material || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">原产国</label>
                      <p className="text-sm">{selectedRecord.originCountry || 'CN'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">匹配次数</label>
                      <p className="text-sm">{selectedRecord.matchCount} 次</p>
                    </div>
                  </div>

                  {/* 价格统计 */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">价格统计</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">平均单价</p>
                        <p className="text-lg font-semibold text-gray-900">€{selectedRecord.avgUnitPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">平均公斤价</p>
                        <p className="text-lg font-semibold text-gray-900">€{selectedRecord.avgKgPrice.toFixed(2)}/kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">最低单价</p>
                        <p className="text-lg font-semibold text-green-600">€{selectedRecord.minUnitPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">最高单价</p>
                        <p className="text-lg font-semibold text-amber-600">€{selectedRecord.maxUnitPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* 单件重量统计 */}
                  <div className="bg-green-50 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">单件重量统计</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">平均单件重量</p>
                        <p className="text-lg font-semibold text-gray-900">{selectedRecord.avgPieceWeight?.toFixed(3) || 0} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">最小单件重量</p>
                        <p className="text-lg font-semibold text-green-600">{selectedRecord.minPieceWeight?.toFixed(3) || 0} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">最大单件重量</p>
                        <p className="text-lg font-semibold text-amber-600">{selectedRecord.maxPieceWeight?.toFixed(3) || 0} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">重量区间</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedRecord.minPieceWeight > 0 || selectedRecord.maxPieceWeight > 0 
                            ? `${selectedRecord.minPieceWeight?.toFixed(2)}~${selectedRecord.maxPieceWeight?.toFixed(2)}kg`
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 税率信息 */}
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">税率信息</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">关税率</p>
                        <p className="text-lg font-semibold">{selectedRecord.dutyRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">增值税率</p>
                        <p className="text-lg font-semibold">{selectedRecord.vatRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">反倾销税</p>
                        <p className="text-lg font-semibold">{selectedRecord.antiDumpingRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">反补贴税</p>
                        <p className="text-lg font-semibold">{selectedRecord.countervailingRate}%</p>
                      </div>
                    </div>
                  </div>

                    {/* 申报历史 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">申报历史</h4>
                      {selectedRecord.history && selectedRecord.history.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-medium text-gray-500">集装箱号</th>
                              <th className="px-2 py-1.5 text-left font-medium text-gray-500">客户</th>
                              <th className="px-2 py-1.5 text-right font-medium text-gray-500">数量</th>
                              <th className="px-2 py-1.5 text-right font-medium text-gray-500">重量</th>
                              <th className="px-2 py-1.5 text-right font-medium text-gray-500">货值</th>
                              <th className="px-2 py-1.5 text-right font-medium text-gray-500">单价</th>
                              <th className="px-2 py-1.5 text-right font-medium text-gray-500">总税费</th>
                              <th className="px-2 py-1.5 text-left font-medium text-gray-500">申报时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRecord.history.map((h) => (
                              <tr key={h.id} className="border-b">
                                <td className="px-2 py-1.5">
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono">
                                    {h.containerNo || '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-gray-700">{h.customerName || '-'}</td>
                                <td className="px-2 py-1.5 text-right">{h.declaredQty}</td>
                                <td className="px-2 py-1.5 text-right">{h.declaredWeight.toFixed(2)} kg</td>
                                <td className="px-2 py-1.5 text-right">€{h.declaredValue.toFixed(2)}</td>
                                <td className="px-2 py-1.5 text-right">€{h.unitPrice.toFixed(2)}</td>
                                <td className="px-2 py-1.5 text-right text-amber-600">€{h.totalTax.toFixed(2)}</td>
                                <td className="px-2 py-1.5 text-gray-500">
                                  {h.declaredAt ? formatDate(h.declaredAt) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-center text-gray-400 py-4">暂无申报历史</p>
                      )}
                    </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">编辑匹配记录</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">中文品名</label>
                <input
                  type="text"
                  value={editForm.productName}
                  onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">英文品名</label>
                <input
                  type="text"
                  value={editForm.productNameEn}
                  onChange={(e) => setEditForm({ ...editForm, productNameEn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HS编码</label>
                <input
                  type="text"
                  value={editForm.hsCode}
                  onChange={(e) => setEditForm({ ...editForm, hsCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">材质</label>
                  <input
                    type="text"
                    value={editForm.material}
                    onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">原产国</label>
                  <input
                    type="text"
                    value={editForm.originCountry}
                    onChange={(e) => setEditForm({ ...editForm, originCountry: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

