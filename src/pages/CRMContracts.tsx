import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, X, 
  CheckCircle, Clock, AlertTriangle, FileText
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface Contract {
  id: string
  contractNumber: string
  contractName: string
  customerId: string
  customerName: string
  contractType: string
  contractAmount: number
  currency: string
  startDate: string | null
  endDate: string | null
  signDate: string | null
  status: string
  terms: string
  notes: string
  createTime: string
}

interface Customer {
  id: string
  customerName: string
}

export default function CRMContracts() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Contract | null>(null)
  const [formData, setFormData] = useState({
    contractName: '',
    customerId: '',
    customerName: '',
    contractType: 'service',
    contractAmount: 0,
    currency: 'CNY',
    startDate: '',
    endDate: '',
    signDate: '',
    terms: '',
    notes: ''
  })

   
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterStatus])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterStatus) params.append('status', filterStatus)

      const [contractRes, custRes] = await Promise.all([
        fetch(`/api/contracts?${params}`),
        fetch('/api/customers?pageSize=100')
      ])

      const [contractData, custData] = await Promise.all([
        contractRes.json(),
        custRes.json()
      ])
      
      if (contractData.errCode === 200) {
        setContracts(contractData.data.list || [])
        setTotal(contractData.data.total || 0)
      }
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (item?: Contract) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        contractName: item.contractName,
        customerId: item.customerId || '',
        customerName: item.customerName || '',
        contractType: item.contractType || 'service',
        contractAmount: item.contractAmount,
        currency: item.currency || 'CNY',
        startDate: item.startDate || '',
        endDate: item.endDate || '',
        signDate: item.signDate || '',
        terms: item.terms || '',
        notes: item.notes || ''
      })
    } else {
      setEditingItem(null)
      setFormData({
        contractName: '',
        customerId: '',
        customerName: '',
        contractType: 'service',
        contractAmount: 0,
        currency: 'CNY',
        startDate: '',
        endDate: '',
        signDate: '',
        terms: '',
        notes: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.contractName) {
      alert('请输入合同名称')
      return
    }
    if (!formData.customerName && !formData.customerId) {
      alert('请选择客户')
      return
    }

    try {
      const url = editingItem 
        ? `/api/contracts/${editingItem.id}`
        : '/api/contracts'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadData()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  const handleDelete = async (item: Contract) => {
    if (!confirm(`确定要删除合同"${item.contractName}"吗？`)) return

    try {
      const response = await fetch(`/api/contracts/${item.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const formatCurrency = (value: number, currency = 'CNY') => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value)
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: any; color: string; bg: string }> = {
      draft: { label: '草稿', icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
      pending: { label: '待签署', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
      active: { label: '生效中', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
      expired: { label: '已过期', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
      terminated: { label: '已终止', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' }
    }
    return statusMap[status] || statusMap.draft
  }

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      service: '服务合同',
      sales: '销售合同',
      purchase: '采购合同',
      cooperation: '合作协议',
      other: '其他'
    }
    return types[type] || type
  }

  const columns: Column<Contract>[] = useMemo(() => [
    {
      key: 'contractNumber',
      label: '合同编号',
      width: 140,
      render: (item) => (
        <span className="text-primary-600 font-medium text-xs">{item.contractNumber}</span>
      )
    },
    {
      key: 'contractName',
      label: '合同名称',
      width: 180,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs line-clamp-1">{item.contractName}</div>
          <div className="text-[10px] text-gray-500">{item.customerName || '-'}</div>
        </div>
      )
    },
    {
      key: 'contractType',
      label: '类型',
      width: 90,
      render: (item) => (
        <span className="text-xs text-gray-600">{getTypeLabel(item.contractType)}</span>
      )
    },
    {
      key: 'contractAmount',
      label: '合同金额',
      width: 120,
      render: (item) => (
        <span className="text-xs font-medium text-gray-900">
          {formatCurrency(item.contractAmount, item.currency)}
        </span>
      )
    },
    {
      key: 'period',
      label: '合同期限',
      width: 160,
      render: (item) => (
        <div className="text-xs text-gray-500">
          {item.startDate && item.endDate ? (
            <span>{item.startDate} ~ {item.endDate}</span>
          ) : (
            <span>-</span>
          )}
        </div>
      )
    },
    {
      key: 'signDate',
      label: '签署日期',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">{item.signDate || '-'}</span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
      render: (item) => {
        const info = getStatusInfo(item.status)
        const Icon = info.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            <Icon className="w-3 h-3" />
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 180,
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'pending')}
              className="px-2 py-1 text-[10px] bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
            >
              提交
            </button>
          )}
          {item.status === 'pending' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'active')}
              className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
            >
              生效
            </button>
          )}
          {item.status === 'active' && (
            <button
              onClick={() => {
                if (confirm('确定要终止此合同吗？')) {
                  handleUpdateStatus(item.id, 'terminated')
                }
              }}
              className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
            >
              终止
            </button>
          )}
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {item.status !== 'active' && (
            <button 
              onClick={() => handleDelete(item)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/contracts"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索合同编号、名称、客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待签署</option>
            <option value="active">生效中</option>
            <option value="expired">已过期</option>
            <option value="terminated">已终止</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建合同
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={contracts}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">共 {total} 条记录</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-sm font-medium">{editingItem ? '编辑合同' : '新建合同'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">合同名称 *</label>
                <input
                  type="text"
                  value={formData.contractName}
                  onChange={(e) => setFormData({...formData, contractName: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="请输入合同名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户 *</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setFormData({
                        ...formData, 
                        customerId: e.target.value,
                        customerName: customer?.customerName || ''
                      })
                    }}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">请选择客户</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">合同类型</label>
                  <select
                    value={formData.contractType}
                    onChange={(e) => setFormData({...formData, contractType: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="service">服务合同</option>
                    <option value="sales">销售合同</option>
                    <option value="purchase">采购合同</option>
                    <option value="cooperation">合作协议</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">合同金额</label>
                  <input
                    type="number"
                    value={formData.contractAmount}
                    onChange={(e) => setFormData({...formData, contractAmount: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">币种</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="CNY">人民币 (CNY)</option>
                    <option value="USD">美元 (USD)</option>
                    <option value="EUR">欧元 (EUR)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">开始日期</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">签署日期</label>
                  <input
                    type="date"
                    value={formData.signDate}
                    onChange={(e) => setFormData({...formData, signDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">合同条款</label>
                <textarea
                  value={formData.terms}
                  onChange={(e) => setFormData({...formData, terms: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={3}
                  placeholder="请输入合同主要条款"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={2}
                  placeholder="请输入备注信息"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

