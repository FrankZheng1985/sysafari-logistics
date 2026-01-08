import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Save, Building, Building2, User, Phone, Mail, MapPin,
  Globe, Loader2, AlertCircle, Search, Upload, Check, Database, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getCustomerById, type Customer } from '../utils/api'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { useDebounce } from '../hooks/useDebounce'

const API_BASE = getApiBaseUrl()

// 客户类型选项
const CUSTOMER_TYPES = [
  { value: 'shipper', label: '发货人' },
  { value: 'consignee', label: '收货人' },
  { value: 'forwarder', label: '货代公司' },
  { value: 'both', label: '发/收货人' }
]

// 客户级别选项
const CUSTOMER_LEVELS = [
  { value: 'potential', label: '潜在客户' },
  { value: 'normal', label: '普通客户' },
  { value: 'important', label: '重要客户' },
  { value: 'vip', label: 'VIP客户' }
]

// 客户状态选项
const CUSTOMER_STATUS = [
  { value: 'active', label: '活跃' },
  { value: 'inactive', label: '不活跃' },
  { value: 'blacklist', label: '黑名单' }
]

// 客户区域选项
const CUSTOMER_REGIONS = [
  { value: 'china', label: '中国客户' },
  { value: 'overseas', label: '海外客户' }
]

interface CustomerFormData {
  customerName: string
  companyName: string
  companyNameEn: string  // 公司英文全称
  customerType: string
  customerLevel: string
  customerRegion: 'china' | 'overseas'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  countryCode: string
  province: string
  city: string
  address: string
  status: string
  creditLimit: number
  paymentTerms: string
  taxNumber: string
  legalPerson: string
  registeredCapital: string
  establishmentDate: string
  businessScope: string
  notes: string
  assignedTo: number | null
  assignedName: string
  assignedOperator: number | null
  assignedOperatorName: string
}

// 可分配的业务员用户
interface SalesUser {
  id: number
  name: string
  role: string
  roleName: string
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

export default function CRMCustomerEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id // 编辑模式 vs 新增模式
  const [loading, setLoading] = useState(isEditMode) // 新增模式不需要loading
  const [saving, setSaving] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  
  // 工商信息搜索状态
  const [businessSearchKeyword, setBusinessSearchKeyword] = useState('')
  const [businessSearchResults, setBusinessSearchResults] = useState<BusinessInfo[]>([])
  const [businessSearching, setBusinessSearching] = useState(false)
  const [showBusinessResults, setShowBusinessResults] = useState(false)
  const [businessInfoError, setBusinessInfoError] = useState<string | null>(null)
  const [selectedBusinessInfo, setSelectedBusinessInfo] = useState<BusinessInfo | null>(null)
  const [loadingBusinessDetail, setLoadingBusinessDetail] = useState(false)
  const businessSearchRef = useRef<HTMLDivElement>(null)
  
  // OCR 状态
  const [showOcrMode, setShowOcrMode] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [licenseImage, setLicenseImage] = useState<string | null>(null)
  
  // 表单数据
  const [formData, setFormData] = useState<CustomerFormData>({
    customerName: '',
    companyName: '',
    companyNameEn: '',
    customerType: 'shipper',
    customerLevel: 'normal',
    customerRegion: 'china' as 'china' | 'overseas',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    countryCode: '中国',
    province: '',
    city: '',
    address: '',
    status: 'active',
    creditLimit: 0,
    paymentTerms: '',
    taxNumber: '',
    legalPerson: '',
    registeredCapital: '',
    establishmentDate: '',
    businessScope: '',
    notes: '',
    assignedTo: null,
    assignedName: '',
    assignedOperator: null,
    assignedOperatorName: ''
  })

  const crmTabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  useEffect(() => {
    // 加载业务员列表（新增和编辑都需要）
    loadSalesUsers()
    // 编辑模式下加载客户数据
    if (id) {
      loadCustomer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 加载可分配的业务员列表
  const loadSalesUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users?status=active`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        // 过滤出可以作为客户负责人的角色
        // operator=跟单员, czjl=操作经理, manager=业务经理, do=单证员, finance=财务助理
        const assignableRoles = ['operator', 'czjl', 'manager', 'do', 'finance']
        const filteredUsers = (data.data.list || []).filter(
          (u: { role: string }) => assignableRoles.includes(u.role)
        )
        setSalesUsers(filteredUsers)
      }
    } catch (err) {
      console.error('加载业务员列表失败:', err)
    }
  }
  
  // 搜索工商信息
  const searchBusinessInfo = useCallback(async (keyword: string) => {
    if (!keyword || keyword.trim().length < 2) {
      setBusinessSearchResults([])
      return
    }
    
    setBusinessSearching(true)
    setBusinessInfoError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/business-info/search?keyword=${encodeURIComponent(keyword)}&pageSize=10`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setBusinessSearchResults(data.data?.list || [])
        setShowBusinessResults(true)
        if (data.msg && data.msg.includes('未配置')) {
          setBusinessInfoError('企查查API未配置，仅显示本地数据')
        }
      } else {
        setBusinessInfoError(data.msg || '搜索失败')
        setBusinessSearchResults([])
      }
    } catch (error) {
      console.error('搜索工商信息失败:', error)
      setBusinessInfoError('搜索服务暂时不可用')
      setBusinessSearchResults([])
    } finally {
      setBusinessSearching(false)
    }
  }, [])
  
  // 获取工商信息详情
  const getBusinessDetail = async (identifier: string) => {
    setLoadingBusinessDetail(true)
    setBusinessInfoError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/business-info/detail?identifier=${encodeURIComponent(identifier)}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        return data.data as BusinessInfo
      } else {
        setBusinessInfoError(data.msg || '获取详情失败')
        return null
      }
    } catch (error) {
      console.error('获取工商信息详情失败:', error)
      setBusinessInfoError('获取详情服务暂时不可用')
      return null
    } finally {
      setLoadingBusinessDetail(false)
    }
  }
  
  // 选择工商信息并填充表单
  const handleSelectBusinessInfo = async (item: BusinessInfo) => {
    // 如果没有完整信息（如经营范围），则获取详情
    let businessInfo = item
    if (!item.businessScope && item.companyName) {
      const detail = await getBusinessDetail(item.creditCode || item.companyName)
      if (detail) {
        businessInfo = detail
      }
    }
    
    setSelectedBusinessInfo(businessInfo)
    setShowBusinessResults(false)
    setBusinessSearchKeyword(businessInfo.companyName)
    
    // 填充表单
    setFormData(prev => ({
      ...prev,
      companyName: businessInfo.companyName || prev.companyName,
      customerName: businessInfo.companyName || prev.customerName,
      taxNumber: businessInfo.creditCode || prev.taxNumber,
      legalPerson: businessInfo.legalPerson || prev.legalPerson,
      registeredCapital: businessInfo.registeredCapital || prev.registeredCapital,
      establishmentDate: businessInfo.establishmentDate || prev.establishmentDate,
      businessScope: businessInfo.businessScope || prev.businessScope,
      address: businessInfo.address || prev.address,
      province: businessInfo.province || prev.province,
      city: businessInfo.city || prev.city
    }))
  }
  
  // 防抖处理工商信息搜索
  const debouncedBusinessSearch = useDebounce(businessSearchKeyword, 500)
  
  useEffect(() => {
    if (debouncedBusinessSearch && formData.customerRegion === 'china') {
      searchBusinessInfo(debouncedBusinessSearch)
    } else {
      setBusinessSearchResults([])
      setShowBusinessResults(false)
    }
  }, [debouncedBusinessSearch, formData.customerRegion, searchBusinessInfo])
  
  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (businessSearchRef.current && !businessSearchRef.current.contains(e.target as Node)) {
        setShowBusinessResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // 处理营业执照上传 OCR
  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
      setOcrError('图片大小不能超过5MB')
      return
    }
    
    // 转换为Base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setLicenseImage(base64)
      setOcrLoading(true)
      setOcrError(null)
      
      try {
        const response = await fetch(`${API_BASE}/api/ocr/business-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ imageBase64: base64 })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          try {
            const errorData = JSON.parse(errorText)
            setOcrError(errorData.msg || `服务器错误 (${response.status})`)
          } catch {
            setOcrError(`服务器错误 (${response.status})`)
          }
          setOcrLoading(false)
          return
        }
        
        const data = await response.json()
        
        if (data.errCode === 200 && data.data) {
          const ocrData = data.data
          setFormData(prev => ({
            ...prev,
            companyName: ocrData.companyName || prev.companyName,
            customerName: ocrData.companyName || prev.customerName,
            taxNumber: ocrData.creditCode || prev.taxNumber,
            legalPerson: ocrData.legalPerson || prev.legalPerson,
            registeredCapital: ocrData.registeredCapital || prev.registeredCapital,
            establishmentDate: ocrData.establishmentDate || prev.establishmentDate,
            businessScope: ocrData.businessScope || prev.businessScope,
            address: ocrData.address || prev.address
          }))
        } else {
          setOcrError(data.msg || '营业执照识别失败')
        }
      } catch (error: unknown) {
        console.error('OCR识别失败:', error)
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        setOcrError(`营业执照识别服务暂时不可用: ${errorMessage}`)
      } finally {
        setOcrLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const loadCustomer = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCustomerById(id!)
      if (response.errCode === 200 && response.data) {
        setCustomer(response.data)
        // 填充表单数据
        const c = response.data
        const regionValue = (c as any).customerRegion
        setFormData({
          customerName: c.customerName || '',
          companyName: c.companyName || '',
          companyNameEn: (c as any).companyNameEn || '',
          customerType: c.customerType || 'shipper',
          customerLevel: c.customerLevel || 'normal',
          customerRegion: (regionValue === 'china' || regionValue === 'overseas') ? regionValue : 'china',
          contactPerson: c.contactPerson || '',
          contactPhone: c.contactPhone || '',
          contactEmail: c.contactEmail || '',
          countryCode: c.countryCode || '中国',
          province: (c as any).province || '',
          city: (c as any).city || '',
          address: c.address || '',
          status: c.status || 'active',
          creditLimit: c.creditLimit || 0,
          paymentTerms: c.paymentTerms || '',
          taxNumber: (c as any).taxNumber || '',
          legalPerson: (c as any).legalPerson || '',
          registeredCapital: (c as any).registeredCapital || '',
          establishmentDate: (c as any).establishmentDate || '',
          businessScope: (c as any).businessScope || '',
          notes: c.notes || '',
          assignedTo: (c as any).assignedTo || null,
          assignedName: (c as any).assignedName || '',
          assignedOperator: (c as any).assignedOperator || null,
          assignedOperatorName: (c as any).assignedOperatorName || ''
        })
      } else {
        setError('客户不存在或已被删除')
      }
    } catch (err) {
      console.error('加载客户详情失败:', err)
      setError('加载客户详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customerName.trim()) {
      alert('请输入客户名称')
      return
    }

    setSaving(true)
    try {
      let response: Response
      
      if (isEditMode) {
        // 编辑模式：更新客户
        response = await fetch(`${API_BASE}/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(formData)
        })
      } else {
        // 新增模式：创建客户
        response = await fetch(`${API_BASE}/api/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(formData)
        })
      }
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert(isEditMode ? '保存成功' : '客户创建成功')
        // 新增模式跳转到新客户详情，编辑模式跳转回原客户详情
        const targetId = isEditMode ? id : data.data?.id
        if (targetId) {
          navigate(`/crm/customers/${targetId}`)
        } else {
          navigate('/crm/customers')
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (err) {
      console.error('保存客户失败:', err)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof CustomerFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }

  // 只在编辑模式下检查客户是否存在
  if (isEditMode && (error || !customer)) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{error || '客户不存在或已被删除'}</p>
          <button
            onClick={() => navigate('/crm/customers')}
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            返回客户列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户管理"
        description={isEditMode ? "编辑客户" : "新增客户"}
        tabs={crmTabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(isEditMode ? `/crm/customers/${id}` : '/crm/customers')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{isEditMode ? '编辑客户' : '新增客户'}</h2>
            {isEditMode && customer && (
              <p className="text-sm text-gray-500">{customer.customerCode} - {customer.customerName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(isEditMode ? `/crm/customers/${id}` : '/crm/customers')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? '保存中...' : '创建中...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? '保存修改' : '创建客户'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 编辑表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* 中国客户：工商信息查询 - 仅在新增模式且选择中国客户时显示 */}
        {!isEditMode && formData.customerRegion === 'china' && (
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
              // OCR上传模式
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            基本信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 客户区域 - 放在最前面便于选择 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户区域</label>
              <select
                value={formData.customerRegion}
                onChange={(e) => {
                  const value = e.target.value as 'china' | 'overseas'
                  setFormData(prev => ({ 
                    ...prev, 
                    customerRegion: value,
                    countryCode: value === 'china' ? '中国' : prev.countryCode
                  }))
                  // 切换区域时清除工商信息
                  setSelectedBusinessInfo(null)
                  setBusinessSearchKeyword('')
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {CUSTOMER_REGIONS.map(region => (
                  <option key={region.value} value={region.value}>{region.label}</option>
                ))}
              </select>
            </div>
            
            {/* 客户名称 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户名称 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="请输入客户名称"
                required
              />
            </div>

            {/* 公司名称（中文） */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">公司名称（中文）</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="公司中文全称"
              />
            </div>

            {/* 公司名称（英文）- 系统自动翻译，只读显示 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">公司名称（英文）<span className="text-gray-400 ml-1">自动翻译</span></label>
              <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 min-h-[38px]">
                {formData.companyNameEn || <span className="text-gray-400 italic">保存后自动翻译</span>}
              </div>
            </div>

            {/* 客户类型 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户类型</label>
              <select
                value={formData.customerType}
                onChange={(e) => handleInputChange('customerType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {CUSTOMER_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* 客户级别 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户级别</label>
              <select
                value={formData.customerLevel}
                onChange={(e) => handleInputChange('customerLevel', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {CUSTOMER_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            {/* 客户状态 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户状态</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {CUSTOMER_STATUS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            {/* 负责销售员 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  负责销售员
                </span>
              </label>
              <select
                value={formData.assignedTo || ''}
                onChange={(e) => {
                  const userId = e.target.value ? parseInt(e.target.value) : null
                  const user = salesUsers.find(u => u.id === userId)
                  setFormData(prev => ({
                    ...prev, 
                    assignedTo: userId,
                    assignedName: user?.name || ''
                  }))
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">暂不指定</option>
                {salesUsers
                  .filter(u => ['manager', 'czjl'].includes(u.role))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.roleName || user.role})
                    </option>
                  ))}
              </select>
            </div>

            {/* 负责跟单员 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  负责跟单员
                </span>
              </label>
              <select
                value={formData.assignedOperator || ''}
                onChange={(e) => {
                  const userId = e.target.value ? parseInt(e.target.value) : null
                  const user = salesUsers.find(u => u.id === userId)
                  setFormData(prev => ({
                    ...prev, 
                    assignedOperator: userId,
                    assignedOperatorName: user?.name || ''
                  }))
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">暂不指定</option>
                {salesUsers
                  .filter(u => u.role === 'operator')
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.roleName || user.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* 公司信息 - 仅中国客户显示 */}
        {formData.customerRegion === 'china' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              公司信息
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 税号/统一社会信用代码 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">税号/统一社会信用代码</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="请输入税号"
                />
              </div>

              {/* 法定代表人 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">法定代表人</label>
                <input
                  type="text"
                  value={formData.legalPerson}
                  onChange={(e) => handleInputChange('legalPerson', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="法定代表人姓名"
                />
              </div>

              {/* 注册资本 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">注册资本</label>
                <input
                  type="text"
                  value={formData.registeredCapital}
                  onChange={(e) => handleInputChange('registeredCapital', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="如：100万人民币"
                />
              </div>

              {/* 成立日期 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">成立日期</label>
                <input
                  type="text"
                  value={formData.establishmentDate}
                  onChange={(e) => handleInputChange('establishmentDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="如：2020-01-01"
                />
              </div>

              {/* 信用额度 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">信用额度 (EUR)</label>
                <input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => handleInputChange('creditLimit', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="信用额度"
                  min="0"
                  step="100"
                />
              </div>

              {/* 付款条款 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">付款条款</label>
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  placeholder="如：30天账期"
                />
              </div>
            </div>

            {/* 经营范围 */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">经营范围</label>
              <textarea
                value={formData.businessScope}
                onChange={(e) => handleInputChange('businessScope', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white resize-none"
                rows={2}
                placeholder="公司经营范围"
              />
            </div>
          </div>
        )}

        {/* 联系信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            联系信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 联系人 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  联系人
                </span>
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="联系人姓名"
              />
            </div>

            {/* 联系电话 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  联系电话
                </span>
              </label>
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="联系电话"
              />
            </div>

            {/* 电子邮箱 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  电子邮箱
                </span>
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="电子邮箱"
              />
            </div>
          </div>
        </div>

        {/* 地址信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            地址信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 国家 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  国家
                </span>
              </label>
              <input
                type="text"
                value={formData.countryCode}
                onChange={(e) => handleInputChange('countryCode', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="国家"
              />
            </div>

            {/* 省/州 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">省/州</label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="省份/州"
              />
            </div>

            {/* 城市 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">城市</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="城市"
              />
            </div>

            {/* 详细地址 */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs text-gray-600 mb-1">详细地址</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                placeholder="详细地址"
              />
            </div>
          </div>
        </div>

        {/* 备注 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">备注</h3>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white resize-none"
            rows={3}
            placeholder="备注信息..."
          />
        </div>

        {/* 底部保存按钮 */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(`/crm/customers/${id}`)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存修改
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

