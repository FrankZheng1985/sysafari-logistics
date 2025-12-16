import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Eye, Edit, Trash2, 
  Phone, Mail, MapPin, X, Upload, Loader2,
  ChevronLeft, ChevronRight, Check, Building2, Globe, User, FileText
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

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
  city: string
  address: string
  status: string
  assignedName: string
  lastFollowUpTime: string | null
  createTime: string
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
}

interface ContactInfo {
  contactType: string
  contactName: string
  phone: string
  mobile: string
  email: string
  position: string
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
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  
  // 模态框状态
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  
  // 表单数据
  const [formData, setFormData] = useState<CustomerFormData>({
    customerRegion: 'china',
    customerType: 'shipper',
    customerLevel: 'normal',
    customerName: '',
    companyName: '',
    taxNumber: '',
    legalPerson: '',
    registeredCapital: '',
    establishmentDate: '',
    businessScope: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    countryCode: '中国',
    province: '',
    city: '',
    address: '',
    notes: ''
  })
  
  // 多联系人
  const [contacts, setContacts] = useState<ContactInfo[]>([])
  
  // OCR状态
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [licenseImage, setLicenseImage] = useState<string | null>(null)

  const tabs = [
    { path: '/crm', label: '概览' },
    { path: '/crm/customers', label: '客户管理' },
    { path: '/crm/opportunities', label: '销售机会' },
    { path: '/crm/quotations', label: '报价管理' },
    { path: '/crm/contracts', label: '合同管理' },
    { path: '/crm/feedbacks', label: '客户反馈' }
  ]
   
  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterLevel, filterType])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterLevel) params.append('level', filterLevel)
      if (filterType) params.append('type', filterType)

      const response = await fetch(`${API_BASE}/api/customers?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setCustomers(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        customerRegion: (customer.customerRegion as 'china' | 'overseas') || 'china',
        customerType: customer.customerType,
        customerLevel: customer.customerLevel,
        customerName: customer.customerName,
        companyName: customer.companyName || '',
        taxNumber: '',
        legalPerson: '',
        registeredCapital: '',
        establishmentDate: '',
        businessScope: '',
        contactPerson: customer.contactPerson || '',
        contactPhone: customer.contactPhone || '',
        contactEmail: customer.contactEmail || '',
        countryCode: customer.countryCode || '',
        province: '',
        city: customer.city || '',
        address: customer.address || '',
        notes: ''
      })
      setCurrentStep(2) // 编辑模式直接跳到第二步
    } else {
      setEditingCustomer(null)
      setFormData({
        customerRegion: 'china',
        customerType: 'shipper',
        customerLevel: 'normal',
        customerName: '',
        companyName: '',
        taxNumber: '',
        legalPerson: '',
        registeredCapital: '',
        establishmentDate: '',
        businessScope: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        countryCode: '中国',
        province: '',
        city: '',
        address: '',
        notes: ''
      })
      setCurrentStep(1)
    }
    setContacts([])
    setLicenseImage(null)
    setOcrError(null)
    setShowModal(true)
  }

  // 处理营业执照上传
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
        const response = await fetch(`${API_BASE}/api/crm/ocr/business-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
        })
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
          
          // 如果识别出法人信息，自动添加到联系人
          if (ocrData.legalPerson) {
            setContacts(prev => {
              const hasLegal = prev.some(c => c.contactType === 'legal')
              if (!hasLegal) {
                return [...prev, {
                  contactType: 'legal',
                  contactName: ocrData.legalPerson,
                  phone: '',
                  mobile: '',
                  email: '',
                  position: '法定代表人'
                }]
              }
              return prev
            })
          }
        } else {
          setOcrError(data.msg || '营业执照识别失败')
        }
      } catch (error) {
        console.error('OCR识别失败:', error)
        setOcrError('营业执照识别服务暂时不可用')
      } finally {
        setOcrLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // 添加联系人
  const handleAddContact = () => {
    setContacts(prev => [...prev, {
      contactType: 'other',
      contactName: '',
      phone: '',
      mobile: '',
      email: '',
      position: ''
    }])
  }

  // 删除联系人
  const handleRemoveContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index))
  }

  // 更新联系人
  const handleUpdateContact = (index: number, field: keyof ContactInfo, value: string) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const handleSubmit = async () => {
    if (!formData.customerName) {
      alert('请输入客户名称')
      return
    }

    try {
      const url = editingCustomer 
        ? `${API_BASE}/api/customers/${editingCustomer.id}`
        : `${API_BASE}/api/customers`
      const method = editingCustomer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        // 如果有联系人，创建联系人
        if (contacts.length > 0 && data.data?.id) {
          for (const contact of contacts) {
            if (contact.contactName) {
              await fetch(`${API_BASE}/api/crm/customers/${data.data.id}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contact)
              })
            }
          }
        }
        
        setShowModal(false)
        loadCustomers()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存客户失败:', error)
      alert('保存失败')
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
      render: (item) => (
        <span className="text-primary-600 font-medium text-xs">{item.customerCode}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户名称',
      width: 160,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{item.customerName}</div>
          {item.companyName && (
            <div className="text-[10px] text-gray-500">{item.companyName}</div>
          )}
        </div>
      )
    },
    {
      key: 'customerLevel',
      label: '级别',
      width: 80,
      render: (item) => getLevelBadge(item.customerLevel)
    },
    {
      key: 'customerType',
      label: '类型',
      width: 80,
      render: (item) => getTypeBadge(item.customerType)
    },
    {
      key: 'contact',
      label: '联系方式',
      width: 180,
      render: (item) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-gray-700">
            <Phone className="w-3 h-3 text-gray-400" />
            {item.contactPerson || '-'}
            {item.contactPhone && <span className="text-gray-400">({item.contactPhone})</span>}
          </div>
          {item.contactEmail && (
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="w-3 h-3 text-gray-400" />
              {item.contactEmail}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'location',
      label: '地址',
      width: 200,
      render: (item) => (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="truncate">{[item.countryCode, item.city, item.address].filter(Boolean).join(' ') || '-'}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 80,
      render: (item) => (
        <span className={`px-2 py-0.5 rounded text-[10px] ${
          item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {item.status === 'active' ? '活跃' : '停用'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 120,
      render: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/crm/customers/${item.id}`)}
            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
            title="查看详情"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenModal(item)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], [navigate])

  // 步骤配置
  const steps = [
    { num: 1, title: '选择类型', icon: Building2 },
    { num: 2, title: '填写信息', icon: FileText },
    { num: 3, title: '联系人', icon: User },
    { num: 4, title: '确认', icon: Check }
  ]

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              currentStep === step.num 
                ? 'bg-primary-100 text-primary-700' 
                : currentStep > step.num 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            <step.icon className="w-4 h-4" />
            <span className="text-xs font-medium">{step.title}</span>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
          )}
        </div>
      ))}
    </div>
  )

  // 步骤1：选择客户区域和类型
  const renderStep1 = () => (
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
      {/* 中国客户：营业执照上传 */}
      {formData.customerRegion === 'china' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
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
                >
                  {CONTACT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveContact(index)}
                  className="p-1 text-gray-400 hover:text-red-500"
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

  // 步骤4：确认信息
  const renderStep4 = () => (
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
          <div className="text-gray-500">税号</div>
          <div className="text-gray-900">{formData.taxNumber || '-'}</div>
          <div className="text-gray-500">法定代表人</div>
          <div className="text-gray-900">{formData.legalPerson || '-'}</div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">地址信息</h4>
        <div className="text-xs text-gray-900">
          {[formData.countryCode, formData.province, formData.city, formData.address].filter(Boolean).join(' ') || '-'}
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
                {contact.mobile && <span className="text-gray-500">{contact.mobile}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center">
        确认以上信息无误后，点击"保存"按钮完成创建
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索客户名称、编号、联系人..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 级别筛选 */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            <option value="shipper">发货人</option>
            <option value="consignee">收货人</option>
            <option value="forwarder">货代公司</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors"
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
          </div>
        </div>
      )}

      {/* 新增/编辑弹窗 - 分步表单 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">{editingCustomer ? '编辑客户' : '新增客户'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {renderStepIndicator()}
              
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
            </div>

            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="flex items-center gap-1 px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一步
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-100"
                >
                  取消
                </button>
                {currentStep < 4 ? (
                  <button
                    onClick={() => setCurrentStep(s => s + 1)}
                    className="flex items-center gap-1 px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    下一步
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1 px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    <Check className="w-4 h-4" />
                    保存
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
