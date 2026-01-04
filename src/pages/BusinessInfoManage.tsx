/**
 * 工商信息库管理页面
 * 
 * 功能：
 * - 展示已查询/保存的工商信息列表
 * - 支持搜索、筛选
 * - 支持手动添加、编辑、删除
 * - 显示数据来源和更新时间
 */

import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit2, Trash2, Eye, RefreshCw, Loader2,
  Building2, CheckCircle, XCircle, Database, Globe, Calendar
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface BusinessInfo {
  id: string
  creditCode: string
  companyName: string
  companyNameEn?: string
  legalPerson: string
  registeredCapital: string
  paidCapital?: string
  establishmentDate: string
  businessScope: string
  address: string
  province?: string
  city?: string
  district?: string
  companyType?: string
  operatingStatus?: string
  industry?: string
  registrationAuthority?: string
  phone?: string
  email?: string
  website?: string
  source: string
  usageCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

interface FormData {
  creditCode: string
  companyName: string
  companyNameEn: string
  legalPerson: string
  registeredCapital: string
  paidCapital: string
  establishmentDate: string
  businessScope: string
  address: string
  province: string
  city: string
  district: string
  companyType: string
  operatingStatus: string
  industry: string
  registrationAuthority: string
  phone: string
  email: string
  website: string
}

const INITIAL_FORM_DATA: FormData = {
  creditCode: '',
  companyName: '',
  companyNameEn: '',
  legalPerson: '',
  registeredCapital: '',
  paidCapital: '',
  establishmentDate: '',
  businessScope: '',
  address: '',
  province: '',
  city: '',
  district: '',
  companyType: '',
  operatingStatus: '存续',
  industry: '',
  registrationAuthority: '',
  phone: '',
  email: '',
  website: ''
}

const SOURCE_OPTIONS = [
  { value: '', label: '全部来源' },
  { value: 'qichacha', label: '企查查' },
  { value: 'manual', label: '手动添加' },
  { value: 'ocr', label: 'OCR识别' }
]

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: '存续', label: '存续' },
  { value: '在业', label: '在业' },
  { value: '注销', label: '注销' },
  { value: '吊销', label: '吊销' }
]

export default function BusinessInfoManage() {
  const [list, setList] = useState<BusinessInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingItem, setEditingItem] = useState<BusinessInfo | null>(null)
  const [viewingItem, setViewingItem] = useState<BusinessInfo | null>(null)
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  const [submitting, setSubmitting] = useState(false)
  
  // API配置状态
  const [apiConfigured, setApiConfigured] = useState(false)
  const [stats, setStats] = useState<{total: number, fromQichacha: number, fromManual: number, fromOcr: number}>()

  useEffect(() => {
    loadList()
    loadConfigStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterSource, filterStatus])

  const loadList = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (search) params.append('search', search)
      if (filterSource) params.append('source', filterSource)
      if (filterStatus) params.append('operatingStatus', filterStatus)

      const response = await fetch(`${API_BASE}/api/business-info?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setList(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载工商信息列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfigStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/business-info/config-status`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setApiConfigured(data.data.apiConfigured)
        setStats(data.data.localStats)
      }
    } catch (error) {
      console.error('获取配置状态失败:', error)
    }
  }

  const handleOpenModal = (item?: BusinessInfo) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        creditCode: item.creditCode || '',
        companyName: item.companyName || '',
        companyNameEn: item.companyNameEn || '',
        legalPerson: item.legalPerson || '',
        registeredCapital: item.registeredCapital || '',
        paidCapital: item.paidCapital || '',
        establishmentDate: item.establishmentDate || '',
        businessScope: item.businessScope || '',
        address: item.address || '',
        province: item.province || '',
        city: item.city || '',
        district: item.district || '',
        companyType: item.companyType || '',
        operatingStatus: item.operatingStatus || '存续',
        industry: item.industry || '',
        registrationAuthority: item.registrationAuthority || '',
        phone: item.phone || '',
        email: item.email || '',
        website: item.website || ''
      })
    } else {
      setEditingItem(null)
      setFormData(INITIAL_FORM_DATA)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData(INITIAL_FORM_DATA)
  }

  const handleSubmit = async () => {
    if (!formData.companyName.trim()) {
      alert('请输入公司名称')
      return
    }

    setSubmitting(true)
    try {
      const url = editingItem 
        ? `${API_BASE}/api/business-info/${editingItem.id}`
        : `${API_BASE}/api/business-info`
      
      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        handleCloseModal()
        loadList()
        loadConfigStatus()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存工商信息失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: BusinessInfo) => {
    if (!confirm(`确定要删除 "${item.companyName}" 的工商信息吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/business-info/${item.id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadList()
        loadConfigStatus()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除工商信息失败:', error)
      alert('删除失败，请重试')
    }
  }

  const handleViewDetail = (item: BusinessInfo) => {
    setViewingItem(item)
    setShowDetailModal(true)
  }

  const getSourceLabel = (source: string) => {
    const option = SOURCE_OPTIONS.find(o => o.value === source)
    return option?.label || source
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'qichacha': return <Globe className="w-3 h-3" />
      case 'manual': return <Edit2 className="w-3 h-3" />
      case 'ocr': return <Eye className="w-3 h-3" />
      default: return <Database className="w-3 h-3" />
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="工商信息库"
        description="管理已查询和保存的中国企业工商信息"
        showBackButton
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p>
                <p className="text-xs text-gray-500">总记录数</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.fromQichacha || 0}</p>
                <p className="text-xs text-gray-500">企查查查询</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Edit2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.fromManual || 0}</p>
                <p className="text-xs text-gray-500">手动添加</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${apiConfigured ? 'bg-green-100' : 'bg-gray-100'}`}>
                {apiConfigured ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${apiConfigured ? 'text-green-600' : 'text-gray-500'}`}>
                  {apiConfigured ? 'API已配置' : 'API未配置'}
                </p>
                <p className="text-xs text-gray-500">企查查接口</p>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索和操作栏 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="搜索公司名称、信用代码、法人..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select
                value={filterSource}
                onChange={(e) => { setFilterSource(e.target.value); setPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { loadList(); loadConfigStatus() }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                手动添加
              </button>
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无工商信息记录</p>
              <p className="text-sm text-gray-400 mt-1">可在客户管理中搜索企业自动保存，或手动添加</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">公司名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">信用代码</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">法定代表人</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">来源</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">引用次数</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">更新时间</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <div className="font-medium text-sm text-gray-800 truncate" title={item.companyName}>
                            {item.companyName}
                          </div>
                          {item.address && (
                            <div className="text-xs text-gray-400 truncate" title={item.address}>
                              {item.province}{item.city}{item.district}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                        {item.creditCode || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.legalPerson || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
                            item.operatingStatus === '存续' || item.operatingStatus === '在业'
                              ? 'bg-green-100 text-green-700'
                              : item.operatingStatus === '注销' || item.operatingStatus === '吊销'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {item.operatingStatus || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            item.source === 'qichacha' ? 'bg-blue-50 text-blue-600' :
                            item.source === 'manual' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {getSourceIcon(item.source)}
                            {getSourceLabel(item.source)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {item.usageCount || 0}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {formatDate(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetail(item)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* 分页 */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize) || 1} 页
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= Math.ceil(total / pageSize)}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingItem ? '编辑工商信息' : '添加工商信息'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">公司名称 *</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="公司全称"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">统一社会信用代码</label>
                  <input
                    type="text"
                    value={formData.creditCode}
                    onChange={(e) => setFormData({...formData, creditCode: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="18位信用代码"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">法定代表人</label>
                  <input
                    type="text"
                    value={formData.legalPerson}
                    onChange={(e) => setFormData({...formData, legalPerson: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="法人姓名"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">注册资本</label>
                  <input
                    type="text"
                    value={formData.registeredCapital}
                    onChange={(e) => setFormData({...formData, registeredCapital: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="如：100万人民币"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">成立日期</label>
                  <input
                    type="date"
                    value={formData.establishmentDate}
                    onChange={(e) => setFormData({...formData, establishmentDate: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">经营状态</label>
                  <select
                    value={formData.operatingStatus}
                    onChange={(e) => setFormData({...formData, operatingStatus: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="存续">存续</option>
                    <option value="在业">在业</option>
                    <option value="注销">注销</option>
                    <option value="吊销">吊销</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">公司类型</label>
                  <input
                    type="text"
                    value={formData.companyType}
                    onChange={(e) => setFormData({...formData, companyType: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="如：有限责任公司"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">注册地址</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="详细地址"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">省份</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="省/直辖市"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">城市</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="市/区"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">所属行业</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({...formData, industry: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="行业分类"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">联系电话</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="企业电话"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">经营范围</label>
                  <textarea
                    value={formData.businessScope}
                    onChange={(e) => setFormData({...formData, businessScope: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={3}
                    placeholder="公司经营范围"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingItem ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailModal && viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-800">{viewingItem.companyName}</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="space-y-6">
                {/* 基本信息 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> 基本信息
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">统一社会信用代码:</span>
                      <span className="ml-2 text-gray-800 font-mono">{viewingItem.creditCode || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">法定代表人:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.legalPerson || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">注册资本:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.registeredCapital || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">实缴资本:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.paidCapital || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">成立日期:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.establishmentDate || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">经营状态:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                        viewingItem.operatingStatus === '存续' || viewingItem.operatingStatus === '在业'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {viewingItem.operatingStatus || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">公司类型:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.companyType || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">所属行业:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.industry || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 联系方式 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> 联系方式
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2">
                      <span className="text-gray-400">注册地址:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">联系电话:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">企业邮箱:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.email || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">企业网址:</span>
                      <span className="ml-2 text-gray-800">{viewingItem.website || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 经营范围 */}
                {viewingItem.businessScope && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">经营范围</h4>
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">
                      {viewingItem.businessScope}
                    </p>
                  </div>
                )}

                {/* 数据来源 */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        {getSourceIcon(viewingItem.source)}
                        数据来源: {getSourceLabel(viewingItem.source)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        引用次数: {viewingItem.usageCount || 0}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      更新时间: {formatDate(viewingItem.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

