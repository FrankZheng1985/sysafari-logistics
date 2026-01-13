import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Eye, Edit, Trash2, 
  Phone, Mail, MapPin, X, Upload, Loader2,
  ChevronLeft, ChevronRight, Check, Building2, Globe, User, FileText,
  Package, DollarSign, Database, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'
import { useDebounce } from '../hooks/useDebounce'

const API_BASE = getApiBaseUrl()

interface Customer {
  id: string
  customerCode: string
  customerName: string
  companyName: string
  customerType: string
  customerLevel: string
  customerRegion?: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  countryCode: string
  province?: string
  city: string
  address: string
  status: string
  assignedName: string
  assignedOperatorName?: string
  lastFollowUpTime: string | null
  createTime: string
  // 工商信息字段
  taxNumber?: string
  legalPerson?: string
  registeredCapital?: string
  establishmentDate?: string
  businessScope?: string
  businessInfoId?: string
  notes?: string
}

interface CustomerFormData {
  customerRegion: 'china' | 'overseas'
  customerType: string
  customerLevel: string
  customerName: string
  companyName: string
  taxNumber: string
  legalPerson: string
  registeredCapital: string
  establishmentDate: string
  businessScope: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  countryCode: string
  province: string
  city: string
  address: string
  notes: string
  assignedTo?: number | null
  assignedName?: string
  assignedOperator?: number | null
  assignedOperatorName?: string
}

// 业务员/操作员用户接口
interface SalesUser {
  id: number
  name: string
  role: string
  roleName?: string
}

interface ContactInfo {
  contactType: string
  contactName: string
  phone: string
  mobile: string
  email: string
  position: string
}

// 工商信息接口
interface BusinessInfo {
  id?: string
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
  phone?: string
  email?: string
  source?: string
  usageCount?: number
}

// 产品接口
interface Product {
  id: string
  productCode: string
  productName: string
  productNameEn: string
  category: string
  description: string
}

// 产品费用项接口
interface ProductFeeItem {
  id: number
  feeName: string
  feeNameEn: string
  unit: string
  standardPrice: number
  currency: string
  isRequired: boolean
  description: string
}

// 联系人类型选项
const CONTACT_TYPES = [
  { value: 'legal', label: '法人代表' },
  { value: 'customs', label: '清关负责人' },
  { value: 'finance', label: '财务负责人' },
  { value: 'customer_service', label: '客服对接人' },
  { value: 'sales', label: '销售对接人' },
  { value: 'other', label: '其他' }
]

// 客户类型选项
const CUSTOMER_TYPES = [
  { value: 'shipper', label: '发货人' },
  { value: 'consignee', label: '收货人' },
  { value: 'forwarder', label: '货代公司' }
]

export default function CRMCustomers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  // 防抖搜索值，延迟 500ms 触发请求，优化输入体验
  const debouncedSearchValue = useDebounce(searchValue, 500)
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  

  const tabs = [
    { path: '/crm', label: '概览' },
    { path: '/crm/customers', label: '客户管理' },
    { path: '/crm/business-info', label: '工商信息库' },
    { path: '/crm/opportunities', label: '销售机会' },
    { path: '/crm/quotations', label: '报价管理' },
    { path: '/crm/contracts', label: '合同管理' },
    { path: '/crm/feedbacks', label: '客户反馈' }
  ]
   
  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearchValue, filterLevel, filterType])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (debouncedSearchValue) params.append('search', debouncedSearchValue)
      if (filterLevel) params.append('level', filterLevel)
      if (filterType) params.append('type', filterType)

      const response = await fetch(`${API_BASE}/api/customers?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        // 过滤掉 null/undefined 元素，并为缺失字段设置默认值
        const customerList = (data.data.list || []).filter((c: Customer | null) => c !== null && c !== undefined)
        setCustomers(customerList)
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`确定要删除客户"${customer.customerName}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/customers/${customer.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadCustomers()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除客户失败:', error)
    }
  }

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      vip: 'bg-amber-100 text-amber-700 border-amber-200',
      important: 'bg-blue-100 text-blue-700 border-blue-200',
      normal: 'bg-gray-100 text-gray-700 border-gray-200',
      potential: 'bg-green-100 text-green-700 border-green-200'
    }
    const labels: Record<string, string> = {
      vip: 'VIP',
      important: '重要',
      normal: '普通',
      potential: '潜在'
    }
    return (
      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${styles[level] || styles.normal}`}>
        {labels[level] || level}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      shipper: 'bg-indigo-100 text-indigo-700',
      consignee: 'bg-teal-100 text-teal-700',
      forwarder: 'bg-orange-100 text-orange-700',
      both: 'bg-purple-100 text-purple-700'
    }
    const labels: Record<string, string> = {
      shipper: '发货人',
      consignee: '收货人',
      forwarder: '货代公司',
      both: '两者'
    }
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] ${styles[type] || styles.shipper}`}>
        {labels[type] || type}
      </span>
    )
  }

  const columns: Column<Customer>[] = useMemo(() => [
    {
      key: 'customerCode',
      label: '客户编号',
      width: 120,
      sorter: true,
      render: (_value, item) => (
        <span className="text-primary-600 font-medium text-xs">{item?.customerCode || '-'}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户名称',
      width: 160,
      sorter: true,
      filterable: true,
      render: (_value, item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{item?.customerName || '-'}</div>
          {item?.companyName && (
            <div className="text-[10px] text-gray-500">{item.companyName}</div>
          )}
        </div>
      )
    },
    {
      key: 'customerLevel',
      label: '级别',
      width: 80,
      sorter: true,
      filters: [
        { text: 'VIP', value: 'vip' },
        { text: '重要', value: 'important' },
        { text: '普通', value: 'normal' },
        { text: '潜在', value: 'potential' },
      ],
      onFilter: (value, record) => record.customerLevel === value,
      render: (_value, item) => getLevelBadge(item?.customerLevel || 'normal')
    },
    {
      key: 'customerType',
      label: '类型',
      width: 80,
      sorter: true,
      filters: [
        { text: '发货人', value: 'shipper' },
        { text: '收货人', value: 'consignee' },
        { text: '货代公司', value: 'forwarder' },
      ],
      onFilter: (value, record) => record.customerType === value,
      render: (_value, item) => getTypeBadge(item?.customerType || 'shipper')
    },
    {
      key: 'contactPerson',
      label: '联系方式',
      width: 180,
      sorter: true,
      render: (_value, item) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-gray-700">
            <Phone className="w-3 h-3 text-gray-400" />
            {item?.contactPerson || '-'}
            {item?.contactPhone && <span className="text-gray-400">({item.contactPhone})</span>}
          </div>
          {item?.contactEmail && (
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="w-3 h-3 text-gray-400" />
              {item.contactEmail}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'address',
      label: '地址',
      width: 200,
      render: (_value, item) => (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="truncate">{[item?.countryCode, item?.city, item?.address].filter(Boolean).join(' ') || '-'}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 80,
      sorter: true,
      filters: [
        { text: '活跃', value: 'active' },
        { text: '停用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (_value, item) => (
        <span className={`px-2 py-0.5 rounded text-[10px] ${
          item?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {item?.status === 'active' ? '活跃' : '停用'}
        </span>
      )
    },
    {
      key: 'assignedName',
      label: '销售员',
      width: 80,
      sorter: true,
      render: (_value, item) => (
        <div className="flex items-center justify-center">
          {item?.assignedName ? (
            <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
              {item.assignedName}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
              -
            </span>
          )}
        </div>
      )
    },
    {
      key: 'assignedOperatorName',
      label: '跟单员',
      width: 80,
      sorter: true,
      render: (_value, item) => (
        <div className="flex items-center justify-center">
          {item?.assignedOperatorName ? (
            <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
              {item.assignedOperatorName}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
              -
            </span>
          )}
        </div>
      )
    },
    {
      key: 'createTime',
      label: '创建时间',
      width: 120,
      sorter: (a, b) => {
        const dateA = a.createTime ? new Date(a.createTime).getTime() : 0
        const dateB = b.createTime ? new Date(b.createTime).getTime() : 0
        return dateA - dateB
      },
      render: (_value, item) => (
        <span className="text-xs text-gray-500">{item?.createTime?.split(' ')[0] || '-'}</span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 120,
      render: (_value, item) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => item?.id && navigate(`/crm/customers/${item.id}`)}
            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
            title="查看详情"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            onClick={() => item?.id && navigate(`/crm/customers/${item.id}/edit`)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => item && handleDelete(item)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], [navigate])

  // 注意: 分步表单功能已移至独立的 CRMCustomerEdit.tsx 页面
  // 以下渲染函数保留作为参考但不再使用
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _deprecatedRenderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">客户区域</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, customerRegion: 'china', countryCode: '中国' })}
            className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
              formData.customerRegion === 'china' 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Building2 className={`w-8 h-8 ${formData.customerRegion === 'china' ? 'text-primary-600' : 'text-gray-400'}`} />
            <span className={`text-sm font-medium ${formData.customerRegion === 'china' ? 'text-primary-700' : 'text-gray-600'}`}>中国客户</span>
            <span className="text-xs text-gray-500">支持营业执照OCR识别</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, customerRegion: 'overseas', countryCode: '' })}
            className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
              formData.customerRegion === 'overseas' 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Globe className={`w-8 h-8 ${formData.customerRegion === 'overseas' ? 'text-primary-600' : 'text-gray-400'}`} />
            <span className={`text-sm font-medium ${formData.customerRegion === 'overseas' ? 'text-primary-700' : 'text-gray-600'}`}>海外客户</span>
            <span className="text-xs text-gray-500">手动填写信息</span>
          </button>
        </div>
        </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">客户类型</label>
        <div className="grid grid-cols-3 gap-3">
          {CUSTOMER_TYPES.map(type => (
        <button
              key={type.value}
              type="button"
              onClick={() => setFormData({ ...formData, customerType: type.value })}
              className={`p-3 border-2 rounded-lg text-center transition-all ${
                formData.customerType === type.value 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
        >
              <span className="text-sm font-medium">{type.label}</span>
        </button>
          ))}
      </div>
          </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">客户级别</label>
        <div className="grid grid-cols-4 gap-3">
          {[
            { value: 'potential', label: '潜在' },
            { value: 'normal', label: '普通' },
            { value: 'important', label: '重要' },
            { value: 'vip', label: 'VIP' }
          ].map(level => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData({ ...formData, customerLevel: level.value })}
              className={`p-2 border-2 rounded-lg text-center transition-all ${
                formData.customerLevel === level.value 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <span className="text-xs font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // 步骤2：填写公司信息
  const renderStep2 = () => (
    <div className="space-y-4">
      {/* 中国客户：工商信息查询 */}
      {formData.customerRegion === 'china' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">工商信息查询</span>
            </div>
            <button
              type="button"
              onClick={() => setShowOcrMode(!showOcrMode)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              {showOcrMode ? '切换到搜索模式' : '上传营业执照'}
            </button>
          </div>
          
          {!showOcrMode ? (
            // 工商信息搜索模式
            <div ref={businessSearchRef} className="relative">
              <div className="relative">
                <input
                  type="text"
                  value={businessSearchKeyword}
                  onChange={(e) => {
                    setBusinessSearchKeyword(e.target.value)
                    setSelectedBusinessInfo(null)
                  }}
                  onFocus={() => businessSearchResults.length > 0 && setShowBusinessResults(true)}
                  placeholder="输入公司名称或统一社会信用代码搜索..."
                  className="w-full px-4 py-2.5 pl-10 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {businessSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                )}
                {!businessSearching && selectedBusinessInfo && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>
              
              {/* 搜索结果下拉列表 */}
              {showBusinessResults && businessSearchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                  {businessSearchResults.map((item, index) => (
                    <div
                      key={item.creditCode || index}
                      onClick={() => handleSelectBusinessInfo(item)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-800 truncate">{item.companyName}</div>
                          <div className="text-xs text-gray-500 mt-1 space-x-2">
                            {item.creditCode && <span>信用代码: {item.creditCode}</span>}
                            {item.legalPerson && <span>法人: {item.legalPerson}</span>}
                          </div>
                          {item.operatingStatus && (
                            <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                              item.operatingStatus === '存续' || item.operatingStatus === '在业' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.operatingStatus}
                            </span>
                          )}
                        </div>
                        {item.source === 'local' || item.id ? (
                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Database className="w-3 h-3" /> 本地
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 无结果提示 */}
              {showBusinessResults && businessSearchResults.length === 0 && businessSearchKeyword.length >= 2 && !businessSearching && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-500">未找到相关企业</p>
                  <p className="text-xs text-gray-400 mt-1">可手动填写或尝试其他关键词</p>
                </div>
              )}
              
              {/* 选中的工商信息预览 */}
              {selectedBusinessInfo && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> 已选择企业
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBusinessInfo(null)
                        setBusinessSearchKeyword('')
                      }}
                      className="text-xs text-gray-500 hover:text-red-500"
                    >
                      清除
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div><span className="text-gray-400">公司:</span> {selectedBusinessInfo.companyName}</div>
                    <div><span className="text-gray-400">信用代码:</span> {selectedBusinessInfo.creditCode || '-'}</div>
                    <div><span className="text-gray-400">法人:</span> {selectedBusinessInfo.legalPerson || '-'}</div>
                    <div><span className="text-gray-400">状态:</span> {selectedBusinessInfo.operatingStatus || '-'}</div>
                  </div>
                </div>
              )}
              
              {loadingBusinessDetail && (
                <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">获取详细信息...</span>
                </div>
              )}
              
              {businessInfoError && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> {businessInfoError}
                </p>
              )}
            </div>
          ) : (
            // OCR上传模式（保留作为备选）
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
          <div className="text-center">
            {licenseImage ? (
              <div className="space-y-3">
                <img src={licenseImage} alt="营业执照" className="max-h-40 mx-auto rounded-lg" />
                {ocrLoading && (
                  <div className="flex items-center justify-center gap-2 text-primary-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">正在识别...</span>
                  </div>
                )}
            <button
                  type="button"
                  onClick={() => setLicenseImage(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
            >
                  重新上传
            </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">点击上传营业执照</p>
                <p className="text-xs text-gray-400 mt-1">支持 JPG/PNG 格式，不超过5MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLicenseUpload}
                  className="hidden"
                />
              </label>
            )}
            {ocrError && (
              <p className="text-xs text-red-500 mt-2">{ocrError}</p>
            )}
          </div>
            </div>
          )}
        </div>
      )}

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户名称 *</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入客户名称"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">公司名称</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            placeholder="公司全称"
                  />
                </div>
                <div>
          <label className="block text-xs text-gray-600 mb-1">税号/统一社会信用代码</label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入税号"
                  />
                </div>
                <div>
          <label className="block text-xs text-gray-600 mb-1">法定代表人</label>
                    <input
                      type="text"
            value={formData.legalPerson}
            onChange={(e) => setFormData({...formData, legalPerson: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            placeholder="法定代表人姓名"
                    />
                  </div>
        {formData.customerRegion === 'china' && (
          <>
                  <div>
              <label className="block text-xs text-gray-600 mb-1">注册资本</label>
                    <input
                      type="text"
                value={formData.registeredCapital}
                onChange={(e) => setFormData({...formData, registeredCapital: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                placeholder="如：100万人民币"
                    />
                  </div>
                  <div>
              <label className="block text-xs text-gray-600 mb-1">成立日期</label>
                    <input
                type="text"
                value={formData.establishmentDate}
                onChange={(e) => setFormData({...formData, establishmentDate: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                placeholder="如：2020-01-01"
                    />
                  </div>
          </>
        )}
                </div>

      {formData.customerRegion === 'china' && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">经营范围</label>
          <textarea
            value={formData.businessScope}
            onChange={(e) => setFormData({...formData, businessScope: e.target.value})}
            className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
            rows={2}
            placeholder="公司经营范围"
          />
              </div>
      )}

      {/* 负责业务员 */}
      <div className="border-t pt-4">
        <h4 className="text-xs font-medium text-gray-700 mb-3 flex items-center gap-2">
          <User className="w-4 h-4" />
          负责业务员
        </h4>
        <div>
          <label className="block text-xs text-gray-600 mb-1">选择负责的业务员（跟单员）</label>
          <select
            value={formData.assignedTo || ''}
            onChange={(e) => {
              const userId = e.target.value ? parseInt(e.target.value) : null
              const user = salesUsers.find(u => u.id === userId)
              setFormData({
                ...formData, 
                assignedTo: userId,
                assignedName: user?.name || ''
              })
            }}
            className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">暂不指定</option>
            {salesUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} {user.roleName ? `(${user.roleName})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            指定业务员后，该客户的询价将自动分配给对应人员处理
          </p>
        </div>
      </div>

              {/* 地址信息 */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">地址信息</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">国家</label>
                    <input
                      type="text"
                      value={formData.countryCode}
                      onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              placeholder="国家"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">省/州</label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => setFormData({...formData, province: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              placeholder="省份"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">城市</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              placeholder="城市"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">详细地址</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            placeholder="详细地址"
                  />
                </div>
              </div>
    </div>
  )

  // 步骤3：多联系人管理
  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">联系人信息</h4>
        <button
          type="button"
          onClick={handleAddContact}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50"
        >
          <Plus className="w-3 h-3" />
          添加联系人
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无联系人</p>
          <p className="text-xs mt-1">点击上方按钮添加联系人</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <select
                  value={contact.contactType}
                  onChange={(e) => handleUpdateContact(index, 'contactType', e.target.value)}
                  className="px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  title="联系人类型"
                  aria-label="联系人类型"
                >
                  {CONTACT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveContact(index)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="删除联系人"
                  aria-label="删除联系人"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
                  <input
                    type="text"
                    value={contact.contactName}
                    onChange={(e) => handleUpdateContact(index, 'contactName', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="联系人姓名"
                />
              </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">手机</label>
                  <input
                    type="text"
                    value={contact.mobile}
                    onChange={(e) => handleUpdateContact(index, 'mobile', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="手机号码"
                  />
            </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => handleUpdateContact(index, 'email', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="电子邮箱"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // 步骤4：选择产品
  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        请选择为该客户提供的服务产品
      </div>
      
      {products.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无可用产品</p>
          <p className="text-xs mt-1">请先在产品管理中添加产品</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedProductId(product.id)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                selectedProductId === product.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-sm font-medium ${selectedProductId === product.id ? 'text-primary-700' : 'text-gray-900'}`}>
                {product.productName}
              </div>
              {product.productNameEn && (
                <div className="text-xs text-gray-500 mt-1">{product.productNameEn}</div>
              )}
              {product.description && (
                <div className="text-xs text-gray-400 mt-2 line-clamp-2">{product.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // 步骤5：勾选费用项
  const renderStep5 = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        请选择需要包含在报价中的费用项（必选项已自动勾选）
      </div>
      
      {loadingFeeItems ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">加载中...</span>
        </div>
      ) : productFeeItems.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">该产品暂无费用项</p>
          <p className="text-xs mt-1">请先在产品管理中配置费用项</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productFeeItems.map(item => (
            <label
              key={item.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                selectedFeeItemIds.includes(item.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFeeItemIds.includes(item.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFeeItemIds([...selectedFeeItemIds, item.id])
                    } else {
                      setSelectedFeeItemIds(selectedFeeItemIds.filter(id => id !== item.id))
                    }
                  }}
                  disabled={item.isRequired}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <div>
                  <div className="text-sm text-gray-900 flex items-center gap-2">
                    {item.feeName}
                    {item.isRequired && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded">必选</span>
                    )}
                  </div>
                  {item.feeNameEn && (
                    <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {item.currency} {item.standardPrice.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">/{item.unit}</div>
              </div>
            </label>
          ))}
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">已选费用项：{selectedFeeItemIds.length} 项</span>
              <span className="font-medium text-primary-600">
                预估总计：EUR {productFeeItems
                  .filter(item => selectedFeeItemIds.includes(item.id))
                  .reduce((sum, item) => sum + item.standardPrice, 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // 步骤6：确认信息
  const renderStep6 = () => {
    const selectedProduct = products.find(p => p.id === selectedProductId)
    const selectedFees = productFeeItems.filter(item => selectedFeeItemIds.includes(item.id))
    const totalAmount = selectedFees.reduce((sum, item) => sum + item.standardPrice, 0)
    
    return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">基本信息</h4>
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <div className="text-gray-500">客户区域</div>
          <div className="text-gray-900">{formData.customerRegion === 'china' ? '中国' : '海外'}</div>
          <div className="text-gray-500">客户类型</div>
          <div className="text-gray-900">{CUSTOMER_TYPES.find(t => t.value === formData.customerType)?.label}</div>
          <div className="text-gray-500">客户名称</div>
          <div className="text-gray-900">{formData.customerName || '-'}</div>
          <div className="text-gray-500">公司名称</div>
          <div className="text-gray-900">{formData.companyName || '-'}</div>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">联系人 ({contacts.length})</h4>
          <div className="space-y-2">
            {contacts.map((contact, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-600">
                  {CONTACT_TYPES.find(t => t.value === contact.contactType)?.label}
                </span>
                <span className="text-gray-900">{contact.contactName}</span>
                  {contact.email && <span className="text-gray-500">{contact.email}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

        <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
          <h4 className="text-sm font-medium text-primary-700 mb-3">📋 报价信息</h4>
          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">选择产品</span>
              <span className="text-gray-900 font-medium">{selectedProduct?.productName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">费用项</span>
              <span className="text-gray-900">{selectedFees.length} 项</span>
            </div>
            <div className="flex justify-between border-t border-primary-200 pt-2 mt-2">
              <span className="text-primary-700 font-medium">预估总金额</span>
              <span className="text-primary-700 font-bold">EUR {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

      <div className="text-xs text-gray-500 text-center">
        确认以上信息无误后，点击"保存"按钮完成创建
      </div>
    </div>
  )
  }

  return (
    <div className="p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3 lg:space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 - 响应式布局 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between bg-white rounded-lg border border-gray-200 p-2 sm:p-3 gap-2 lg:gap-3">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[150px] sm:min-w-[200px] lg:flex-none lg:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 级别筛选 */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-2 sm:px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="客户级别筛选"
            aria-label="客户级别筛选"
          >
            <option value="">全部级别</option>
            <option value="vip">VIP</option>
            <option value="important">重要</option>
            <option value="normal">普通</option>
            <option value="potential">潜在</option>
          </select>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 sm:px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="客户类型筛选"
            aria-label="客户类型筛选"
          >
            <option value="">全部类型</option>
            <option value="shipper">发货人</option>
            <option value="consignee">收货人</option>
            <option value="forwarder">货代公司</option>
          </select>
        </div>

        <button
          onClick={() => navigate('/crm/customers/new')}
          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors w-full lg:w-auto"
        >
          <Plus className="w-4 h-4" />
          新增客户
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize)} 页
          </div>
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

    </div>
  )
}
