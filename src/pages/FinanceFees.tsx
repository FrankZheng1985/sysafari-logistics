import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, Plus, Edit2, Trash2, Receipt,
  Truck, Shield, Building2, FileText, Package, Settings
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import FeeModal from '../components/FeeModal'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Fee {
  id: string
  billId: string | null
  billNumber: string
  customerId: string | null
  customerName: string
  category: string
  feeName: string
  amount: number
  currency: string
  feeDate: string
  description: string
  createTime: string
}

interface FeeStats {
  byCategory: Array<{ category: string; count: number; total: number }>
  totalAmount: number
}

export default function FinanceFees() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [fees, setFees] = useState<Fee[]>([])
  const [stats, setStats] = useState<FeeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  
  const [modalVisible, setModalVisible] = useState(false)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  
  // 从URL获取筛选/预填信息（从订单详情页面跳转过来时）
  const filterBillId = searchParams.get('billId') || ''
  const defaultBillNumber = searchParams.get('billNumber') || ''
  const defaultCustomerId = searchParams.get('customerId') || ''
  const defaultCustomerName = searchParams.get('customerName') || ''
  const openAddModal = searchParams.get('add') === 'true' // 是否自动打开新增弹窗
  
  // 如果URL有 add=true 参数，自动打开模态窗口
  useEffect(() => {
    if (openAddModal) {
      setModalVisible(true)
    }
  }, [openAddModal])

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
  ]

   
  useEffect(() => {
    fetchFees()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterCategory, searchValue, filterBillId])

  const fetchFees = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(filterCategory && { category: filterCategory }),
        ...(searchValue && { search: searchValue }),
        ...(filterBillId && { billId: filterBillId }),
      })
      
      const response = await fetch(`${API_BASE}/api/fees?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setFees(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取费用列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fees/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('获取费用统计失败:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条费用记录吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/fees/${id}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.errCode === 200) {
        fetchFees()
        fetchStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除费用记录失败:', error)
      alert('删除失败')
    }
  }

  const formatCurrency = (amount: number, currency = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getCategoryConfig = (category: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof Truck }> = {
      freight: { label: '运费', color: 'text-blue-600', bg: 'bg-blue-100', icon: Truck },
      customs: { label: '关税', color: 'text-red-600', bg: 'bg-red-100', icon: Receipt },
      warehouse: { label: '仓储费', color: 'text-orange-600', bg: 'bg-orange-100', icon: Building2 },
      insurance: { label: '保险费', color: 'text-green-600', bg: 'bg-green-100', icon: Shield },
      handling: { label: '操作费', color: 'text-purple-600', bg: 'bg-purple-100', icon: Package },
      documentation: { label: '文件费', color: 'text-cyan-600', bg: 'bg-cyan-100', icon: FileText },
      other: { label: '其他费用', color: 'text-gray-600', bg: 'bg-gray-100', icon: Settings },
    }
    return configs[category] || configs.other
  }

  const columns: Column<Fee>[] = useMemo(() => [
    {
      key: 'feeName',
      label: '费用名称',
      width: 180,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.feeName}</div>
          <div className="text-xs text-gray-400">{item.feeDate}</div>
        </div>
      )
    },
    {
      key: 'category',
      label: '分类',
      width: 120,
      render: (item) => {
        const config = getCategoryConfig(item.category)
        const Icon = config.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      }
    },
    {
      key: 'billNumber',
      label: '关联提单',
      width: 150,
      render: (item) => (
        <div>
          {item.billNumber ? (
            <span className="text-sm text-primary-600 hover:underline cursor-pointer">
              {item.billNumber}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 150,
      render: (item) => (
        <span className="text-sm text-gray-600">{item.customerName || '-'}</span>
      )
    },
    {
      key: 'amount',
      label: '金额',
      width: 120,
      align: 'right',
      render: (item) => (
        <div className="text-right font-medium text-gray-900">
          {formatCurrency(item.amount, item.currency)}
        </div>
      )
    },
    {
      key: 'description',
      label: '说明',
      width: 200,
      render: (item) => (
        <span className="text-xs text-gray-500 truncate block max-w-[200px]">
          {item.description || '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 100,
      render: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setEditingFee(item)
              setModalVisible(true)
            }}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="编辑"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/fees"
        onTabChange={(path) => navigate(path)}
      />

      {/* 费用分类统计 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">费用分类统计</h3>
          <div className="text-sm">
            <span className="text-gray-500">总费用：</span>
            <span className="font-bold text-gray-900">{formatCurrency(stats?.totalAmount || 0)}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-3">
          {['freight', 'customs', 'warehouse', 'insurance', 'handling', 'documentation', 'other'].map((category) => {
            const config = getCategoryConfig(category)
            const Icon = config.icon
            const categoryStats = stats?.byCategory?.find(c => c.category === category)
            
            return (
              <div
                key={category}
                onClick={() => setFilterCategory(filterCategory === category ? '' : category)}
                className={`rounded-lg p-3 cursor-pointer transition-all ${
                  filterCategory === category 
                    ? `${config.bg} ring-2 ring-offset-1 ring-${config.color.replace('text-', '')}`
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className={`text-xs font-medium ${filterCategory === category ? config.color : 'text-gray-600'}`}>
                    {config.label}
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-900">
                  {formatCurrency(categoryStats?.total || 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {categoryStats?.count || 0} 笔
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 订单筛选提示 */}
      {filterBillId && (
        <div className="flex items-center justify-between bg-blue-50 rounded-lg border border-blue-200 p-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              正在查看订单 <span className="font-medium">{defaultBillNumber || filterBillId}</span> 的费用
            </span>
          </div>
          <button
            onClick={() => navigate('/finance/fees')}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            查看全部费用
          </button>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索费用名称..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 分类筛选 */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部分类</option>
            <option value="freight">运费</option>
            <option value="customs">关税</option>
            <option value="warehouse">仓储费</option>
            <option value="insurance">保险费</option>
            <option value="handling">操作费</option>
            <option value="documentation">文件费</option>
            <option value="other">其他费用</option>
          </select>

          {filterCategory && (
            <button
              onClick={() => setFilterCategory('')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              清除筛选
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setEditingFee(null)
            setModalVisible(true)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增费用
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={fees}
          loading={loading}
          rowKey="id"
        />
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-xs text-gray-600">
              第 {page} / {Math.ceil(total / pageSize)} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 费用录入模态窗口 */}
      <FeeModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false)
          setEditingFee(null)
        }}
        onSuccess={() => {
          fetchFees()
          fetchStats()
        }}
        editingFee={editingFee}
        defaultBillId={filterBillId}
        defaultBillNumber={defaultBillNumber}
        defaultCustomerId={defaultCustomerId}
        defaultCustomerName={defaultCustomerName}
      />
    </div>
  )
}

