/**
 * 清关合同管理页面
 * 合同列表、创建、审批、PDF导出
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, Plus, Search, Filter, Eye, Edit2, Trash2,
  Send, CheckCircle, XCircle, Download, Clock, AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface Contract {
  id: number
  contract_no: string
  customer_id: number
  customer_name: string
  customer_company: string
  payment_days: number
  late_fee_rate: number
  max_overdue_days: number
  clearance_days: number
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_by: number
  created_by_name: string
  approved_by: number
  approved_by_name: string
  approved_at: string
  reject_reason: string
  pdf_path: string
  valid_from: string
  valid_until: string
  created_at: string
  updated_at: string
}

interface Customer {
  id: number
  name: string
  company_name: string
  customer_level: string
}

interface ContractStats {
  total: number
  draft_count: number
  pending_count: number
  approved_count: number
  rejected_count: number
}

const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800', icon: Edit2 },
  pending: { label: '待审批', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: '已生效', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export default function CustomsContracts() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 筛选
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')
  
  // 弹窗
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadContracts()
    loadCustomers()
    loadStats()
  }, [filterStatus, searchText])

  const loadContracts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (searchText) params.append('search', searchText)
      
      const res = await fetch(`${API_BASE}/api/contract-template/contracts?${params}`)
      const data = await res.json()
      if (data.success) {
        setContracts(data.data)
      }
    } catch (error) {
      console.error('加载合同列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/customers`)
      const data = await res.json()
      if (data.success) {
        setCustomers(data.data)
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/stats`)
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  // 创建合同
  const createContract = async (formData: {
    customer_id: number
    customer_name: string
    customer_company: string
    payment_days: number
    late_fee_rate: number
    max_overdue_days: number
    clearance_days: number
  }) => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.success) {
        setShowCreateModal(false)
        loadContracts()
        loadStats()
        // 跳转到预览页面
        navigate(`/contracts/preview/${data.data.id}`)
      } else {
        alert('创建失败: ' + data.message)
      }
    } catch (error) {
      console.error('创建合同失败:', error)
      alert('创建失败')
    }
  }

  // 提交审批
  const submitContract = async (id: number) => {
    if (!confirm('确定要提交该合同进行审批吗？')) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${id}/submit`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.success) {
        loadContracts()
        loadStats()
      } else {
        alert('提交失败: ' + data.message)
      }
    } catch (error) {
      console.error('提交审批失败:', error)
      alert('提交失败')
    }
  }

  // 审批通过
  const approveContract = async (id: number) => {
    if (!confirm('确定要审批通过该合同吗？')) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${id}/approve`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.success) {
        loadContracts()
        loadStats()
      } else {
        alert('审批失败: ' + data.message)
      }
    } catch (error) {
      console.error('审批通过失败:', error)
      alert('审批失败')
    }
  }

  // 审批驳回
  const rejectContract = async () => {
    if (!selectedContract) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${selectedContract.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      })
      const data = await res.json()
      if (data.success) {
        setShowRejectModal(false)
        setSelectedContract(null)
        setRejectReason('')
        loadContracts()
        loadStats()
      } else {
        alert('驳回失败: ' + data.message)
      }
    } catch (error) {
      console.error('审批驳回失败:', error)
      alert('驳回失败')
    }
  }

  // 删除合同
  const deleteContract = async (id: number) => {
    if (!confirm('确定要删除该合同吗？此操作不可恢复。')) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        loadContracts()
        loadStats()
      } else {
        alert('删除失败: ' + data.message)
      }
    } catch (error) {
      console.error('删除合同失败:', error)
      alert('删除失败')
    }
  }

  // 生成PDF
  const generatePdf = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${id}/pdf`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        alert('PDF生成成功')
        loadContracts()
        // 下载PDF
        window.open(`${API_BASE}/api/contract-template/contracts/${id}/pdf`, '_blank')
      } else {
        alert('生成失败: ' + data.message)
      }
    } catch (error) {
      console.error('生成PDF失败:', error)
      alert('生成失败')
    }
  }

  // 下载PDF
  const downloadPdf = (id: number) => {
    window.open(`${API_BASE}/api/contract-template/contracts/${id}/pdf`, '_blank')
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="清关合同管理"
        actionButtons={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            新建合同
          </button>
        }
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">全部合同</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">草稿</p>
            <p className="text-2xl font-bold text-gray-600">{stats.draft_count}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">待审批</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_count}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">已生效</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved_count}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">已驳回</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected_count}</p>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索合同编号、客户名称..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadContracts()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待审批</option>
            <option value="approved">已生效</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
      </div>

      {/* 合同列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="w-12 h-12 mb-4 text-gray-300" />
            <p>暂无合同记录</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">合同编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">付款期限</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contracts.map(contract => {
                const status = statusConfig[contract.status]
                const StatusIcon = status.icon
                
                return (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-primary-600">{contract.contract_no}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{contract.customer_company || contract.customer_name}</p>
                        {contract.customer_company && (
                          <p className="text-sm text-gray-500">{contract.customer_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {contract.payment_days}天
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(contract.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {contract.status === 'rejected' && contract.reject_reason && (
                        <p className="text-xs text-red-600 mt-1">{contract.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* 预览 */}
                        <button
                          onClick={() => navigate(`/contracts/preview/${contract.id}`)}
                          className="text-gray-400 hover:text-primary-600"
                          title="预览"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* 草稿状态操作 */}
                        {contract.status === 'draft' && (
                          <>
                            <button
                              onClick={() => submitContract(contract.id)}
                              className="text-gray-400 hover:text-yellow-600"
                              title="提交审批"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteContract(contract.id)}
                              className="text-gray-400 hover:text-red-600"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {/* 待审批状态操作 */}
                        {contract.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveContract(contract.id)}
                              className="text-gray-400 hover:text-green-600"
                              title="审批通过"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedContract(contract)
                                setShowRejectModal(true)
                              }}
                              className="text-gray-400 hover:text-red-600"
                              title="驳回"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {/* 已生效状态操作 */}
                        {contract.status === 'approved' && (
                          <>
                            {contract.pdf_path ? (
                              <button
                                onClick={() => downloadPdf(contract.id)}
                                className="text-gray-400 hover:text-primary-600"
                                title="下载PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => generatePdf(contract.id)}
                                className="text-gray-400 hover:text-primary-600"
                                title="生成PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 创建合同弹窗 */}
      {showCreateModal && (
        <CreateContractModal
          customers={customers}
          onSave={createContract}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* 驳回弹窗 */}
      {showRejectModal && selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">驳回合同</h3>
            <p className="text-sm text-gray-600 mb-4">
              合同编号：<span className="font-medium">{selectedContract.contract_no}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">驳回原因</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="请输入驳回原因..."
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedContract(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={rejectContract}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 创建合同弹窗
function CreateContractModal({ customers, onSave, onClose }: {
  customers: Customer[]
  onSave: (data: any) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    customer_id: 0,
    customer_name: '',
    customer_company: '',
    payment_days: 7,
    late_fee_rate: 0.2,
    max_overdue_days: 15,
    clearance_days: 15
  })

  const handleCustomerChange = (customerId: number) => {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_company: customer.company_name || ''
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <h3 className="text-lg font-medium mb-4">新建清关合同</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择客户 *</label>
            <select
              value={formData.customer_id}
              onChange={e => handleCustomerChange(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value={0}>-- 请选择客户 --</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name || customer.name}
                  {customer.customer_level && ` (${customer.customer_level})`}
                </option>
              ))}
            </select>
          </div>

          {formData.customer_id > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">公司名称</label>
                  <input
                    type="text"
                    value={formData.customer_company}
                    onChange={e => setFormData({ ...formData, customer_company: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">合同参数（可根据客户调整）</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">付款天数</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={formData.payment_days}
                        onChange={e => setFormData({ ...formData, payment_days: parseInt(e.target.value) })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-gray-500 text-sm">天</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">违约金比例</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.late_fee_rate}
                        onChange={e => setFormData({ ...formData, late_fee_rate: parseFloat(e.target.value) })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-gray-500 text-sm">%/天</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">最大超期</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={formData.max_overdue_days}
                        onChange={e => setFormData({ ...formData, max_overdue_days: parseInt(e.target.value) })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-gray-500 text-sm">天</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">清关时效</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={formData.clearance_days}
                        onChange={e => setFormData({ ...formData, clearance_days: parseInt(e.target.value) })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-gray-500 text-sm">工作日</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={!formData.customer_id}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            创建合同
          </button>
        </div>
      </div>
    </div>
  )
}
