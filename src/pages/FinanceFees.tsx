import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, Edit2, Trash2, Receipt,
  Truck, Shield, Building2, FileText, Package, Settings,
  Loader2, Copy,
  Anchor, Calculator, Briefcase, Box, DollarSign,
  ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FeeModal from '../components/FeeModal'
import { copyToClipboard } from '../components/Toast'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Fee {
  id: string
  billId: string | null
  billNumber: string
  orderNumber?: string      // 订单号
  containerNumber?: string  // 集装箱号
  customerId: string | null
  customerName: string
  supplierId?: string | null
  supplierName?: string
  feeType: 'receivable' | 'payable'  // 应收/应付
  category: string
  feeName: string
  amount: number
  currency: string
  feeDate: string
  description: string
  createTime: string
  invoiceStatus?: string
}

// 按订单分组的数据结构
interface OrderFeeGroup {
  orderNumber: string        // 订单号（用作分组键）
  billId: string | null
  billNumber: string
  containerNumber: string
  customerName: string
  receivableTotal: number    // 应收总额
  payableTotal: number       // 应付总额
  feeCount: number           // 费用条数
  fees: Fee[]                // 该订单下的所有费用
}

interface FeeStats {
  byCategory: Array<{ category: string; count: number; total: number }>
  totalAmount: number
  // 应收/应付分别统计
  receivable?: { amount: number; count: number }
  payable?: { amount: number; count: number }
}

export default function FinanceFees() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [fees, setFees] = useState<Fee[]>([])
  const [stats, setStats] = useState<FeeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFeeType, setFilterFeeType] = useState<'' | 'receivable' | 'payable'>('')  // 费用类型筛选
  
  const [modalVisible, setModalVisible] = useState(false)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [defaultFeeType, setDefaultFeeType] = useState<'receivable' | 'payable'>('receivable')  // 新增时的默认类型
  
  // 展开/收起状态管理（存储已展开的订单号）
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  
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
    { label: '历史记录', path: '/finance/invoices/history' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

   
  useEffect(() => {
    fetchFees()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filterCategory, filterFeeType, searchValue, filterBillId])

  const fetchFees = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(filterCategory && { category: filterCategory }),
        ...(filterFeeType && { feeType: filterFeeType }),
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

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  // 切换订单展开/收起状态
  const toggleOrderExpand = (orderKey: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderKey)) {
        newSet.delete(orderKey)
      } else {
        newSet.add(orderKey)
      }
      return newSet
    })
  }

  // 全部展开/收起
  const toggleExpandAll = () => {
    if (expandedOrders.size === orderGroups.length) {
      setExpandedOrders(new Set())
    } else {
      setExpandedOrders(new Set(orderGroups.map(g => g.orderNumber || 'no-order')))
    }
  }

  // 按订单号分组费用数据
  const orderGroups = useMemo<OrderFeeGroup[]>(() => {
    const groupMap = new Map<string, OrderFeeGroup>()
    
    fees.forEach(fee => {
      // 使用订单号作为分组键，没有订单号的用 billNumber 或 'no-order'
      const groupKey = fee.orderNumber || fee.billNumber || 'no-order'
      
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          orderNumber: fee.orderNumber || '',
          billId: fee.billId,
          billNumber: fee.billNumber || '',
          containerNumber: fee.containerNumber || '',
          customerName: fee.customerName || '',
          receivableTotal: 0,
          payableTotal: 0,
          feeCount: 0,
          fees: []
        })
      }
      
      const group = groupMap.get(groupKey)!
      group.fees.push(fee)
      group.feeCount++
      
      // 确保 amount 转换为数字（API 返回的是字符串）
      const amount = Number(fee.amount) || 0
      
      if (fee.feeType === 'receivable') {
        group.receivableTotal += amount
      } else {
        group.payableTotal += amount
      }
      
      // 更新客户名（取第一个有值的）
      if (!group.customerName && fee.customerName) {
        group.customerName = fee.customerName
      }
      // 更新集装箱号（取第一个有值的）
      if (!group.containerNumber && fee.containerNumber) {
        group.containerNumber = fee.containerNumber
      }
    })
    
    // 转换为数组并按订单号排序
    return Array.from(groupMap.values()).sort((a, b) => {
      // 有订单号的排在前面
      if (a.orderNumber && !b.orderNumber) return -1
      if (!a.orderNumber && b.orderNumber) return 1
      // 按订单号字母顺序排序
      return (b.orderNumber || b.billNumber).localeCompare(a.orderNumber || a.billNumber)
    })
  }, [fees])

  // 费用分类配置 - 支持所有数据库中的分类
  const getCategoryConfig = (category: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof Truck }> = {
      // 标准分类
      freight: { label: '运费', color: 'text-blue-600', bg: 'bg-blue-100', icon: Truck },
      transport: { label: '运输费', color: 'text-blue-600', bg: 'bg-blue-100', icon: Truck },
      customs: { label: '关税', color: 'text-red-600', bg: 'bg-red-100', icon: Receipt },
      duty: { label: '进口税', color: 'text-rose-600', bg: 'bg-rose-100', icon: Calculator },
      tax: { label: '增值税', color: 'text-pink-600', bg: 'bg-pink-100', icon: DollarSign },
      warehouse: { label: '仓储费', color: 'text-orange-600', bg: 'bg-orange-100', icon: Building2 },
      storage: { label: '仓储费', color: 'text-orange-600', bg: 'bg-orange-100', icon: Building2 },
      insurance: { label: '保险费', color: 'text-green-600', bg: 'bg-green-100', icon: Shield },
      handling: { label: '操作费', color: 'text-purple-600', bg: 'bg-purple-100', icon: Package },
      documentation: { label: '文件费', color: 'text-cyan-600', bg: 'bg-cyan-100', icon: FileText },
      port: { label: '港口费', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: Anchor },
      service: { label: '服务费', color: 'text-teal-600', bg: 'bg-teal-100', icon: Briefcase },
      package: { label: '包装费', color: 'text-amber-600', bg: 'bg-amber-100', icon: Box },
      other: { label: '其他费用', color: 'text-gray-600', bg: 'bg-gray-100', icon: Settings },
    }
    return configs[category] || { label: category, color: 'text-gray-600', bg: 'bg-gray-100', icon: Settings }
  }


  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/fees"
        onTabChange={(path) => navigate(path)}
      />

      {/* 费用统计 - 应收/应付总览 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">费用统计</h3>
          <div className="flex items-center gap-6 text-sm">
            {/* 应收总额 */}
            <button
              onClick={() => setFilterFeeType(filterFeeType === 'receivable' ? '' : 'receivable')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                filterFeeType === 'receivable' 
                  ? 'bg-green-100 ring-2 ring-green-500' 
                  : 'hover:bg-green-50'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-500">应收：</span>
              <span className="font-bold text-green-600">{formatCurrency(stats?.receivable?.amount || 0)}</span>
              <span className="text-xs text-gray-400">({stats?.receivable?.count || 0}笔)</span>
            </button>
            {/* 应付总额 */}
            <button
              onClick={() => setFilterFeeType(filterFeeType === 'payable' ? '' : 'payable')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                filterFeeType === 'payable' 
                  ? 'bg-orange-100 ring-2 ring-orange-500' 
                  : 'hover:bg-orange-50'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4 text-orange-600" />
              <span className="text-gray-500">应付：</span>
              <span className="font-bold text-orange-600">{formatCurrency(stats?.payable?.amount || 0)}</span>
              <span className="text-xs text-gray-400">({stats?.payable?.count || 0}笔)</span>
            </button>
            {/* 净额 */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-l border-gray-200">
              <span className="text-gray-500">净额：</span>
              <span className={`font-bold ${
                (stats?.receivable?.amount || 0) - (stats?.payable?.amount || 0) >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {formatCurrency((stats?.receivable?.amount || 0) - (stats?.payable?.amount || 0))}
              </span>
            </div>
          </div>
        </div>
        
        {/* 动态网格：根据分类数量自适应列数 */}
        <div className={`grid gap-3 ${
          (stats?.byCategory?.length || 0) <= 5 ? 'grid-cols-5' :
          (stats?.byCategory?.length || 0) <= 7 ? 'grid-cols-7' :
          'grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10'
        }`}>
          {/* 按金额降序排列显示所有分类 */}
          {stats?.byCategory
            ?.slice()
            .sort((a, b) => b.total - a.total)
            .map((categoryData) => {
              const config = getCategoryConfig(categoryData.category)
              const Icon = config.icon
              
              return (
                <div
                  key={categoryData.category}
                  onClick={() => setFilterCategory(filterCategory === categoryData.category ? '' : categoryData.category)}
                  className={`rounded-lg p-3 cursor-pointer transition-all ${
                    filterCategory === categoryData.category 
                      ? `${config.bg} ring-2 ring-offset-1 ring-current`
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className={`text-xs font-medium truncate ${filterCategory === categoryData.category ? config.color : 'text-gray-600'}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {formatCurrency(categoryData.total)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {categoryData.count} 笔
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
              placeholder="搜索费用名称/订单号/提单号/柜号..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 费用类型筛选 */}
          <select
            value={filterFeeType}
            onChange={(e) => setFilterFeeType(e.target.value as '' | 'receivable' | 'payable')}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选费用类型"
          >
            <option value="">全部类型</option>
            <option value="receivable">应收费用</option>
            <option value="payable">应付费用</option>
          </select>

          {/* 分类筛选 - 动态生成选项 */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选费用分类"
          >
            <option value="">全部分类</option>
            {stats?.byCategory
              ?.slice()
              .sort((a, b) => b.total - a.total)
              .map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {getCategoryConfig(cat.category).label} ({cat.count}笔)
                </option>
              ))}
          </select>

          {(filterCategory || filterFeeType) && (
            <button
              onClick={() => {
                setFilterCategory('')
                setFilterFeeType('')
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              清除筛选
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingFee(null)
              setDefaultFeeType('receivable')
              setModalVisible(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowDownCircle className="w-4 h-4" />
            录入应收
          </button>
          <button
            onClick={() => {
              setEditingFee(null)
              setDefaultFeeType('payable')
              setModalVisible(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            录入应付
          </button>
        </div>
      </div>

      {/* 分组数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '400px' }}>
        {/* 表格头部 */}
        <div className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center px-3 py-2 text-xs font-medium text-gray-500">
            <div className="w-8 flex-shrink-0 flex items-center justify-center">
              <button 
                onClick={toggleExpandAll}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title={expandedOrders.size === orderGroups.length ? '全部收起' : '全部展开'}
              >
                {expandedOrders.size === orderGroups.length ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <div className="w-[100px] flex-shrink-0">订单号</div>
            <div className="w-[140px] flex-shrink-0">提单号</div>
            <div className="w-[130px] flex-shrink-0">集装箱号</div>
            <div className="w-[100px] flex-shrink-0">客户</div>
            <div className="w-[60px] flex-shrink-0 text-center">费用数</div>
            <div className="w-[110px] flex-shrink-0 text-right">应收</div>
            <div className="w-[110px] flex-shrink-0 text-right">应付</div>
            <div className="w-[110px] flex-shrink-0 text-right">净额</div>
            <div className="flex-1"></div>
          </div>
        </div>

        {/* 表格内容 - 可滚动区域 */}
        <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">加载中...</span>
            </div>
          ) : orderGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Receipt className="w-12 h-12 mb-2 opacity-50" />
              <span className="text-sm">暂无费用数据</span>
            </div>
          ) : (
            orderGroups.map((group) => {
              const groupKey = group.orderNumber || group.billNumber || 'no-order'
              const isExpanded = expandedOrders.has(groupKey)
              const netAmount = group.receivableTotal - group.payableTotal
              
              return (
                <div key={groupKey}>
                  {/* 订单汇总行 */}
                  <div 
                    className={`flex items-center px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-primary-50/50' : ''
                    }`}
                    onClick={() => toggleOrderExpand(groupKey)}
                  >
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-primary-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="w-[100px] flex-shrink-0">
                      {group.orderNumber ? (
                        <span 
                          className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            group.billId && navigate(`/finance/bill-details/${group.billId}`)
                          }}
                        >
                          {group.orderNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">无订单号</span>
                      )}
                    </div>
                    <div className="w-[140px] flex-shrink-0">
                      {group.billNumber ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-600 truncate max-w-[110px]" title={group.billNumber}>
                            {group.billNumber}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(group.billNumber, e)
                            }}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                            title="复制提单号"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                    <div className="w-[130px] flex-shrink-0 text-xs text-gray-600">
                      {group.containerNumber || '-'}
                    </div>
                    <div className="w-[100px] flex-shrink-0 text-xs text-gray-600 truncate" title={group.customerName}>
                      {group.customerName || '-'}
                    </div>
                    <div className="w-[60px] flex-shrink-0">
                      <div className="flex items-center justify-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {group.feeCount}
                        </span>
                      </div>
                    </div>
                    <div className="w-[110px] flex-shrink-0 text-right text-xs font-medium text-green-600">
                      {group.receivableTotal > 0 ? formatCurrency(group.receivableTotal) : '-'}
                    </div>
                    <div className="w-[110px] flex-shrink-0 text-right text-xs font-medium text-orange-600">
                      {group.payableTotal > 0 ? formatCurrency(group.payableTotal) : '-'}
                    </div>
                    <div className={`w-[110px] flex-shrink-0 text-right text-xs font-bold ${
                      netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(netAmount)}
                    </div>
                    <div className="flex-1"></div>
                  </div>

                  {/* 展开的费用明细 */}
                  {isExpanded && (
                    <div className="bg-gray-50/50">
                      {/* 明细表头 */}
                      <div className="flex items-center px-3 py-1.5 bg-gray-100/80 text-xs text-gray-500 border-y border-gray-200/50">
                        <div className="w-8 flex-shrink-0"></div>
                        <div className="w-[140px] flex-shrink-0 pl-4">费用名称</div>
                        <div className="w-[70px] flex-shrink-0 text-center">类型</div>
                        <div className="w-[90px] flex-shrink-0 text-center">分类</div>
                        <div className="w-[90px] flex-shrink-0">客户/供应商</div>
                        <div className="w-[100px] flex-shrink-0 text-right">金额</div>
                        <div className="w-[90px] flex-shrink-0 text-center">日期</div>
                        <div className="flex-1 min-w-[100px]">说明</div>
                        <div className="w-[70px] flex-shrink-0 text-center">操作</div>
                      </div>
                      
                      {/* 明细行 */}
                      {group.fees.map((fee, feeIndex) => {
                        const categoryConfig = getCategoryConfig(fee.category)
                        const CategoryIcon = categoryConfig.icon
                        
                        return (
                          <div 
                            key={fee.id}
                            className={`flex items-center px-3 py-2 hover:bg-white transition-colors ${
                              feeIndex < group.fees.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                          >
                            <div className="w-8 flex-shrink-0"></div>
                            <div className="w-[140px] flex-shrink-0 pl-4">
                              <div className="text-xs font-medium text-gray-900 truncate" title={fee.feeName}>{fee.feeName}</div>
                            </div>
                            <div className="w-[70px] flex-shrink-0">
                              <div className="flex items-center justify-center">
                                {fee.feeType === 'payable' ? (
                                  <span className="inline-flex items-center justify-center min-w-[52px] gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                    <ArrowUpCircle className="w-3 h-3" />
                                    应付
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center min-w-[52px] gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                    <ArrowDownCircle className="w-3 h-3" />
                                    应收
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="w-[90px] flex-shrink-0">
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex items-center justify-center min-w-[60px] gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${categoryConfig.bg} ${categoryConfig.color}`}>
                                  <CategoryIcon className="w-3 h-3" />
                                  {categoryConfig.label}
                                </span>
                              </div>
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-xs truncate">
                              {fee.feeType === 'payable' ? (
                                <span className="text-orange-600" title={fee.supplierName}>{fee.supplierName || '-'}</span>
                              ) : (
                                <span className="text-gray-600" title={fee.customerName}>{fee.customerName || '-'}</span>
                              )}
                            </div>
                            <div className="w-[100px] flex-shrink-0 text-right text-xs font-medium text-gray-900">
                              {formatCurrency(Number(fee.amount) || 0, fee.currency)}
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-xs text-gray-500 text-center">
                              {fee.feeDate || '-'}
                            </div>
                            <div className="flex-1 min-w-[100px]">
                              <span className="text-xs text-gray-500 truncate block" title={fee.description}>
                                {fee.description || '-'}
                              </span>
                            </div>
                            <div className="w-[70px] flex-shrink-0">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingFee(fee)
                                    setModalVisible(true)
                                  }}
                                  className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                  title="编辑"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(fee.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 分页 */}
      {total > 0 && (
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
              第 {page} / {Math.ceil(total / pageSize) || 1} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
              title="每页显示条数"
            >
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
              <option value={100}>100 条/页</option>
            </select>
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
        defaultFeeType={defaultFeeType}
      />
    </div>
  )
}

