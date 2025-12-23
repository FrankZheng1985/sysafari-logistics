import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Plus, RefreshCw, Archive, Trash2, CheckCircle, RotateCcw, Copy } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import CreateBillModal from '../components/CreateBillModal'
import VoidApplyModal from '../components/VoidApplyModal'
import { PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import { getBillsList, voidBill, restoreBill, publishDraft, type BillOfLading, type BillStats, getApiBaseUrl } from '../utils/api'
import { useColumnSettings } from '../hooks/useColumnSettings'
import { copyToClipboard } from '../components/Toast'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

// 统一样式类
const textPrimary = "text-gray-900"
const textSecondary = "text-gray-500"
const textMuted = "text-gray-400"

export default function OrderBills() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('')
  const [createBillModalVisible, setCreateBillModalVisible] = useState(false)
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [billStats, setBillStats] = useState<BillStats | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // 作废申请模态框状态
  const [voidApplyModalVisible, setVoidApplyModalVisible] = useState(false)
  const [selectedBillForVoid, setSelectedBillForVoid] = useState<BillOfLading | null>(null)
  
  // 从 URL 参数读取筛选状态
  const getInitialFilters = (): Record<string, string[]> => {
    const searchParams = new URLSearchParams(location.search)
    const filtersParam = searchParams.get('filters')
    if (filtersParam) {
      try {
        return JSON.parse(decodeURIComponent(filtersParam))
      } catch {
        return {}
      }
    }
    return {}
  }
  
  const [tableFilters, setTableFilters] = useState<Record<string, string[]>>(getInitialFilters)
  
  // 筛选状态变化时更新 URL
  const handleFilterChange = (filters: Record<string, string[]>) => {
    setTableFilters(filters)
    const searchParams = new URLSearchParams(location.search)
    
    // 检查是否有任何筛选条件
    const hasFilters = Object.values(filters).some(arr => arr.length > 0)
    
    if (hasFilters) {
      searchParams.set('filters', encodeURIComponent(JSON.stringify(filters)))
    } else {
      searchParams.delete('filters')
    }
    
    // 使用 replace 避免产生过多历史记录
    const newUrl = `${location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    navigate(newUrl, { replace: true })
  }
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const activeTabPath = currentPath === '/bookings/bill/draft' 
    ? '/bookings/bill/draft' 
    : currentPath === '/bookings/bill/void' 
      ? '/bookings/bill/void' 
      : '/bookings/bill'
  const isDraftTab = activeTabPath === '/bookings/bill/draft'
  const isVoidTab = activeTabPath === '/bookings/bill/void'
  
  // 防抖搜索：300ms 延迟
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue])
  
  // 从 API 获取数据
  useEffect(() => {
    const loadBills = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: { type: 'schedule' | 'draft' | 'history' | 'void'; page: number; pageSize: number; search?: string } = {
          type: isVoidTab ? 'void' : isDraftTab ? 'draft' : 'schedule',
          page: 1,
          pageSize: 1000,
        }
        if (debouncedSearchValue && debouncedSearchValue.trim()) {
          params.search = debouncedSearchValue.trim()
        }
        const response = await getBillsList(params)
        
        if (response.errCode === 200 && response.data) {
          setBills(response.data.list || [])
          setTotal(response.data.total || 0)
          if (response.data.stats) {
            setBillStats(response.data.stats)
          }
          
          if (response.msg?.includes('mock')) {
            console.warn('⚠️ 后端服务器未启动，当前使用 mock 数据。请运行: cd server && npm run dev')
          }
        } else {
          console.error('获取数据失败:', response.msg)
          setError(response.msg || '获取数据失败')
          const { scheduleBills, historyBills } = await import('../data/mockOrders')
          const mockData = isDraftTab ? historyBills : scheduleBills
          setBills(mockData)
          setTotal(mockData.length)
        }
      } catch (error) {
        console.error('加载提单列表失败:', error)
        setError(error instanceof Error ? error.message : '加载数据失败')
        try {
          const { scheduleBills, historyBills } = await import('../data/mockOrders')
          const mockData = isDraftTab ? historyBills : scheduleBills
          setBills(mockData)
          setTotal(mockData.length)
        } catch (importError) {
          console.error('加载 mock 数据也失败:', importError)
          setBills([])
          setTotal(0)
        }
      } finally {
        setLoading(false)
      }
    }
    
    loadBills()
  }, [isDraftTab, isVoidTab, debouncedSearchValue, refreshKey])
  
  // 作废提单
  const handleVoidBill = async (bill: BillOfLading) => {
    try {
      // 先检查是否有操作记录或费用
      const checkResponse = await fetch(`${API_BASE}/api/bills/${bill.id}/void-check`)
      const checkData = await checkResponse.json()
      
      if (checkData.errCode === 200 && checkData.data?.hasOperations) {
        // 有操作记录或费用，需要走审批流程
        setSelectedBillForVoid(bill)
        setVoidApplyModalVisible(true)
      } else {
        // 没有操作记录，直接作废
        if (!window.confirm(`确定要作废提单 ${bill.billNumber} 吗？`)) return
        
        const response = await voidBill(bill.id, '用户手动作废')
        if (response.errCode === 200) {
          alert('提单作废成功')
          setRefreshKey(prev => prev + 1)
        } else {
          alert(response.msg || '作废失败')
        }
      }
    } catch (error) {
      console.error('作废提单失败:', error)
      alert('作废失败，请稍后重试')
    }
  }
  
  // 恢复作废的提单
  const handleRestoreBill = async (bill: BillOfLading) => {
    if (!confirm('确定要恢复这个已作废的提单吗？')) return
    
    try {
      const response = await restoreBill(bill.id)
      if (response.errCode === 200) {
        alert('提单恢复成功')
        setRefreshKey(prev => prev + 1)
      } else {
        alert(response.msg || '恢复失败')
      }
    } catch (error) {
      console.error('恢复提单失败:', error)
      alert('恢复失败，请稍后重试')
    }
  }
  
  // 发布草稿为正式订单
  const handlePublishDraft = async (bill: BillOfLading) => {
    if (!confirm('确定要将此草稿发布为正式订单吗？发布后将分配正式订单序号。')) return
    
    try {
      const response = await publishDraft(bill.id, '船未到港')
      if (response.errCode === 200) {
        alert(`草稿已发布为正式订单，新序号：${response.data?.orderSeq}`)
        setRefreshKey(prev => prev + 1)
      } else {
        alert(response.msg || '发布失败')
      }
    } catch (error) {
      console.error('发布草稿失败:', error)
      alert('发布失败，请稍后重试')
    }
  }
  
  const displayBills = bills
  
  // 智能状态计算函数
  const getSmartStatus = (bill: BillOfLading): { text: string; color: string; bgColor: string; dotColor: string } => {
    if (bill.isVoid) {
      return { text: '已作废', color: 'text-gray-500', bgColor: 'bg-gray-100', dotColor: 'bg-gray-400' }
    }
    
    const deliveryStatus = bill.deliveryStatus || '待派送'
    if (deliveryStatus === '订单异常') {
      return { text: '订单异常', color: 'text-red-600', bgColor: 'bg-red-50', dotColor: 'bg-red-500' }
    }
    if (deliveryStatus === '异常关闭') {
      return { text: '异常关闭', color: 'text-gray-600', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' }
    }
    
    const shipStatus = bill.shipStatus || '未到港'
    if (shipStatus === '未到港') {
      return { text: '船未到港', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' }
    }
    if (shipStatus === '跳港') {
      return { text: '跳港', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500' }
    }
    
    const customsStatus = bill.customsStatus || '未放行'
    if (customsStatus === '未放行') {
      return { text: '清关中', color: 'text-purple-600', bgColor: 'bg-purple-50', dotColor: 'bg-purple-500' }
    }
    
    const inspection = bill.inspection || '-'
    if (inspection !== '-' && inspection !== '已放行') {
      if (inspection === '待查验') {
        return { text: '待查验', color: 'text-yellow-600', bgColor: 'bg-yellow-50', dotColor: 'bg-yellow-500' }
      }
      if (inspection === '查验中') {
        return { text: '查验中', color: 'text-orange-600', bgColor: 'bg-orange-50', dotColor: 'bg-orange-500' }
      }
      if (inspection === '已查验') {
        return { text: '已查验', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' }
      }
    }
    
    if (deliveryStatus === '待派送') {
      return { text: '待派送', color: 'text-gray-600', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' }
    }
    if (deliveryStatus === '派送中') {
      return { text: '派送中', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' }
    }
    if (deliveryStatus === '已送达') {
      return { text: '已送达', color: 'text-green-600', bgColor: 'bg-green-50', dotColor: 'bg-green-500' }
    }
    
    return { text: '已到港', color: 'text-green-600', bgColor: 'bg-green-50', dotColor: 'bg-green-500' }
  }
  
  const pageKey = isDraftTab ? '/bookings/bill/draft' : '/bookings/bill'
  
  // 草稿页面的列定义
  const draftColumns: Column<BillOfLading>[] = [
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: (a, b) => (a.orderSeq || 0) - (b.orderSeq || 0),
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span className="font-medium text-primary-600">{record.orderNumber || '-'}</span>
          {record.orderNumber && (
            <button
              title="复制订单号"
              className="text-gray-400 hover:text-gray-600"
              onClick={(e) => copyToClipboard(record.orderNumber || '', e)}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'billId',
      label: '提单ID',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.billId || record.id}</span>
      ),
    },
    {
      key: 'billNumber',
      label: '提单号',
      sorter: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span className={`font-medium ${textPrimary}`}>{record.billNumber}</span>
          {record.billNumber && (
            <button
              title="复制提单号"
              className="text-gray-400 hover:text-gray-600"
              onClick={(e) => copyToClipboard(record.billNumber, e)}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'transportMethod',
      label: '运输方式',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => {
        const methodIcon: Record<string, string> = {
          '海运': '🚢',
          '空运': '✈️',
          '铁路': '🚂',
          '卡车': '🚛',
          '卡铁': '🚛🚂',
        }
        return (
          <span className={textPrimary}>
            {methodIcon[record.transportMethod || ''] || ''} {record.transportMethod || '-'}
          </span>
        )
      },
    },
    {
      key: 'pieces',
      label: '件数',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (_value, record: BillOfLading) => (
        <span className={`font-medium ${textPrimary}`}>{record.pieces}</span>
      ),
    },
    {
      key: 'companyName',
      label: '公司名',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.companyName || record.shipper || '-'}</span>
      ),
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.createTime && !b.createTime) return 0
        if (!a.createTime) return 1
        if (!b.createTime) return -1
        const dateA = new Date(a.createTime).getTime()
        const dateB = new Date(b.createTime).getTime()
        return dateA - dateB
      },
      render: (_value, record: BillOfLading) => (
        <span className={textSecondary}>{formatDate(record.createTime)}</span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      filters: [
        { text: '草稿', value: '草稿' },
        { text: '已作废', value: '已作废' },
      ],
      onFilter: (value, record) => {
        if (value === '已作废') return record.isVoid === true
        return record.status === value
      },
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1.5">
          {record.isVoid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              已作废
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              {record.status || '草稿'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          {record.isVoid ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRestoreBill(record)
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              恢复
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePublishDraft(record)
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                发布
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/bookings/bill/${record.id}`)
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors"
              >
                编辑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleVoidBill(record)
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                删除
              </button>
            </>
          )}
        </div>
      ),
    },
  ]
  
  // 提单页面的列定义
  const billColumns: Column<BillOfLading>[] = [
    {
      key: 'status',
      label: '状态',
      filters: [
        { text: '船未到港', value: '船未到港' },
        { text: '已到港', value: '已到港' },
        { text: '清关中', value: '清关中' },
        { text: '清关放行', value: '清关放行' },
        { text: '查验中', value: '查验中' },
        { text: '派送中', value: '派送中' },
        { text: '已送达', value: '已送达' },
        { text: '已作废', value: '已作废' },
      ],
      onFilter: (value, record) => {
        if (value === '已作废') return record.isVoid === true
        const currentStatus = getSmartStatus(record)
        return currentStatus.text === value
      },
      render: (_value, record: BillOfLading) => {
        const status = getSmartStatus(record)
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color} ${record.isVoid ? 'line-through' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></span>
            {status.text}
          </span>
        )
      },
    },
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: (a, b) => (a.orderSeq || 0) - (b.orderSeq || 0),
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <button
            className={`font-medium hover:underline ${record.isVoid ? 'text-gray-400 line-through cursor-not-allowed' : 'text-primary-600 cursor-pointer'}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!record.isVoid) {
                navigate(`/bookings/bill/${record.id}`)
              }
            }}
            disabled={record.isVoid}
          >
            {record.orderNumber || '-'}
          </button>
          {record.orderNumber && !record.isVoid && (
            <button
              title="复制订单号"
              className="text-gray-400 hover:text-gray-600 p-0.5"
              onClick={(e) => copyToClipboard(record.orderNumber || '', e)}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'billNumber',
      label: '提单号',
      sorter: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <button
            className={`font-semibold hover:underline ${record.isVoid ? 'text-gray-400 line-through cursor-not-allowed' : 'text-gray-900 cursor-pointer'}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!record.isVoid) {
                navigate(`/bookings/bill/${record.id}`)
              }
            }}
            disabled={record.isVoid}
          >
            {record.billNumber}
          </button>
          {record.billNumber && (
            <button
              title="复制提单号"
              className="text-gray-400 hover:text-gray-600 p-0.5"
              onClick={(e) => copyToClipboard(record.billNumber, e)}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {record.isVoid && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">作废</span>
          )}
        </div>
      ),
    },
    {
      key: 'containerNumber',
      label: '集装箱号',
      sorter: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <button
            className={`font-medium hover:underline ${record.isVoid ? 'text-gray-400 line-through cursor-not-allowed' : 'text-primary-600 cursor-pointer'}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!record.isVoid) {
                navigate(`/bookings/bill/${record.id}`)
              }
            }}
            disabled={record.isVoid}
          >
            {record.containerNumber || '-'}
          </button>
          {record.containerNumber && (
            <button
              title="复制集装箱号"
              className="text-gray-400 hover:text-gray-600 p-0.5"
              onClick={(e) => copyToClipboard(record.containerNumber || '', e)}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'vessel',
      label: '航班号/船名航次',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.vessel || '-'}</span>
      ),
    },
    {
      key: 'shippingCompany',
      label: '船公司',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.shippingCompany || '-'}</span>
      ),
    },
    {
      key: 'transportMethod',
      label: '运输方式',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.transportMethod || '-'}</span>
      ),
    },
    {
      key: 'portOfLoading',
      label: '起运港/目的港',
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <div className="space-y-0.5">
          <div className={textPrimary}>{record.portOfLoading || '-'}</div>
          <div className="text-xs text-blue-600">→ {record.portOfDischarge || '-'}</div>
        </div>
      ),
    },
    {
      key: 'containerSize',
      label: '柜型/封号',
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <div className="space-y-0.5">
          <div className={textPrimary}>{record.containerSize || '-'}</div>
          {record.sealNumber && (
            <div className={`text-xs ${textSecondary}`}>{record.sealNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'etd',
      label: 'ETD',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.etd && !b.etd) return 0
        if (!a.etd) return 1  // a 为空，排后面
        if (!b.etd) return -1 // b 为空，排后面
        const dateA = new Date(a.etd).getTime()
        const dateB = new Date(b.etd).getTime()
        return dateA - dateB
      },
      dateFilterable: true,
      dateField: 'etd',
      render: (_value, record: BillOfLading) => (
        <span className={textPrimary}>{record.etd || '-'}</span>
      ),
    },
    {
      key: 'eta',
      label: 'ETA/ATA',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.eta && !b.eta) return 0
        if (!a.eta) return 1
        if (!b.eta) return -1
        const dateA = new Date(a.eta).getTime()
        const dateB = new Date(b.eta).getTime()
        return dateA - dateB
      },
      dateFilterable: true,
      dateField: 'eta',
      render: (_value, record: BillOfLading) => (
        <div className="space-y-0.5">
          <div className={textPrimary}>{record.eta || '-'}</div>
          {record.ata && (
            <div className="text-green-600 text-xs">{record.ata}</div>
          )}
        </div>
      ),
    },
    {
      key: 'customsClearedDate',
      label: '清关完成',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.customsReleaseTime && !b.customsReleaseTime) return 0
        if (!a.customsReleaseTime) return 1
        if (!b.customsReleaseTime) return -1
        const dateA = new Date(a.customsReleaseTime).getTime()
        const dateB = new Date(b.customsReleaseTime).getTime()
        return dateA - dateB
      },
      dateFilterable: true,
      dateField: 'customsReleaseTime',
      render: (_value, record: BillOfLading) => (
        <span className={record.customsReleaseTime ? textPrimary : textMuted}>
          {record.customsReleaseTime || '-'}
        </span>
      ),
    },
    {
      key: 'dischargeDate',
      label: '卸货日期',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.cmrUnloadingCompleteTime && !b.cmrUnloadingCompleteTime) return 0
        if (!a.cmrUnloadingCompleteTime) return 1
        if (!b.cmrUnloadingCompleteTime) return -1
        const dateA = new Date(a.cmrUnloadingCompleteTime).getTime()
        const dateB = new Date(b.cmrUnloadingCompleteTime).getTime()
        return dateA - dateB
      },
      dateFilterable: true,
      dateField: 'cmrUnloadingCompleteTime',
      render: (_value, record: BillOfLading) => (
        <span className={record.cmrUnloadingCompleteTime ? textPrimary : textMuted}>
          {record.cmrUnloadingCompleteTime || '-'}
        </span>
      ),
    },
    {
      key: 'pieces',
      label: '件数/毛重',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (_value, record: BillOfLading) => (
        <div className="space-y-0.5">
          <div className={`font-medium ${textPrimary}`}>{record.pieces} 件</div>
          <div className="text-green-600 text-xs">{record.weight} KGS</div>
        </div>
      ),
    },
    {
      key: 'inspection',
      label: '查验',
      filters: [
        { text: '已查验', value: '已查验' },
        { text: '未查验', value: '-' },
      ],
      onFilter: (value, record) => {
        if (value === '已查验') return record.inspection !== '-'
        return record.inspection === value
      },
      render: (_value, record: BillOfLading) => {
        const inspection = record.inspection || '-'
        if (inspection === '-') {
          return <span className={textMuted}>-</span>
        }
        const inspectionColors: Record<string, string> = {
          '待查验': 'bg-yellow-50 text-yellow-600',
          '查验中': 'bg-orange-50 text-orange-600',
          '已查验': 'bg-green-50 text-green-600',
          '已放行': 'bg-blue-50 text-blue-600',
        }
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${inspectionColors[inspection] || 'bg-gray-100 text-gray-600'}`}>
            {inspection}
          </span>
        )
      },
    },
    { 
      key: 'customsStats', 
      label: '报关统计',
      render: (_value, record: BillOfLading) => (
        <span className={textSecondary}>{record.customsStats || '-'}</span>
      ),
    },
    {
      key: 'creator',
      label: '创建者/时间',
      sorter: (a, b) => {
        // 空值始终排在最后
        if (!a.createTime && !b.createTime) return 0
        if (!a.createTime) return 1
        if (!b.createTime) return -1
        const dateA = new Date(a.createTime).getTime()
        const dateB = new Date(b.createTime).getTime()
        return dateA - dateB
      },
      render: (_value, record: BillOfLading) => (
        <div className="space-y-0.5">
          <div className={`font-medium ${textPrimary}`}>{record.creator || '-'}</div>
          <div className={`text-xs ${textMuted}`}>{formatDate(record.createTime)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${record.id}`)
            }}
            className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            详情
          </button>
          {record.isVoid ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRestoreBill(record)
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              恢复
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleVoidBill(record)
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Archive className="w-3 h-3" />
              作废
            </button>
          )}
        </div>
      ),
    },
  ]

  // 根据标签页选择列定义
  const columns = isVoidTab ? billColumns : isDraftTab ? draftColumns : billColumns
  
  // 使用列设置 hook
  const {
    columnConfigs,
    visibleColumns,
    settingsModalVisible,
    setSettingsModalVisible,
    handleSettingsClick,
    handleSaveColumnSettings,
  } = useColumnSettings(pageKey, columns)
  
  // 如果组件渲染出错，显示错误信息
  if (error && bills.length === 0 && !loading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新页面
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="BL 提单管理"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '提单管理' }
        ]}
        tabs={[
          { label: '提单列表', path: '/bookings/bill' },
          { label: '草稿箱', path: '/bookings/bill/draft' },
          { label: '作废记录', path: '/bookings/bill/void' },
        ]}
        activeTab={activeTabPath}
        onTabChange={(path) => {
          if (path !== currentPath) {
            navigate(path)
          }
        }}
        searchPlaceholder={isDraftTab ? "搜索订单号、提单号..." : "搜索订单号、提单号、集装箱号..."}
        defaultSearchValue={searchValue}
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-gray-700">
              {isVoidTab ? '作废记录' : isDraftTab ? '草稿列表' : '提单列表'}: 
              <span className="ml-1 text-primary-600">{total}</span>
            </span>
            {billStats && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">提单 <span className="font-medium text-gray-900">{billStats.scheduleCount}</span></span>
                <span className="text-gray-600">草稿 <span className="font-medium text-orange-600">{billStats.draftCount}</span></span>
                <span className="text-gray-600">作废 <span className="font-medium text-red-600">{billStats.voidCount}</span></span>
              </>
            )}
          </div>
        }
        actionButtons={
          <button
            onClick={() => setCreateBillModalVisible(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增提单
          </button>
        }
      />
      
      <div style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
      <ContentCard noPadding className="flex flex-col h-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : displayBills.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title={isDraftTab ? '暂无草稿' : isVoidTab ? '暂无作废记录' : '暂无提单数据'}
            description={isDraftTab ? '创建提单时选择保存为草稿' : ''}
          />
        ) : (
          <DataTable
            key={isDraftTab ? 'draft' : isVoidTab ? 'void' : 'bill'}
            columns={columns}
            data={displayBills}
            loading={loading}
            searchValue={searchValue}
            searchableColumns={isDraftTab ? ['billId', 'billNumber', 'orderNumber', 'companyName'] : ['orderNumber', 'billNumber', 'containerNumber', 'vessel']}
            visibleColumns={visibleColumns}
            compact={true}
            initialFilters={tableFilters}
            onFilterChange={handleFilterChange}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            onRow={(record) => ({
              onClick: () => {
                navigate(`/bookings/bill/${record.id}`)
              },
              className: 'cursor-pointer hover:bg-gray-50 transition-colors',
            })}
          />
        )}
      </ContentCard>
      </div>

      {/* Column Settings Modal */}
      <ColumnSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        columns={columnConfigs}
        onSave={handleSaveColumnSettings}
        pageKey={pageKey}
      />

      {/* Create Bill Modal */}
      <CreateBillModal
        visible={createBillModalVisible}
        onClose={() => setCreateBillModalVisible(false)}
        onSubmit={(_type) => {
          // type parameter available for future use
        }}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1)
        }}
      />

      {/* Void Apply Modal */}
      {selectedBillForVoid && (
        <VoidApplyModal
          visible={voidApplyModalVisible}
          onClose={() => {
            setVoidApplyModalVisible(false)
            setSelectedBillForVoid(null)
          }}
          onSuccess={() => {
            setRefreshKey(prev => prev + 1)
          }}
          billId={selectedBillForVoid.id}
          billNumber={selectedBillForVoid.billNumber}
        />
      )}
    </PageContainer>
  )
}
