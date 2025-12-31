import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Save, Building, Building2, User, Phone, Mail, MapPin,
  Globe, Loader2, AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getCustomerById, type Customer } from '../utils/api'
import { getApiBaseUrl } from '../utils/api'

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
  customerRegion: string
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
}

export default function CRMCustomerEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 表单数据
  const [formData, setFormData] = useState<CustomerFormData>({
    customerName: '',
    companyName: '',
    companyNameEn: '',
    customerType: 'shipper',
    customerLevel: 'normal',
    customerRegion: 'china',
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
    notes: ''
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
    if (id) {
      loadCustomer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadCustomer = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCustomerById(id!)
      if (response.errCode === 200 && response.data) {
        setCustomer(response.data)
        // 填充表单数据
        const c = response.data
        setFormData({
          customerName: c.customerName || '',
          companyName: c.companyName || '',
          companyNameEn: (c as any).companyNameEn || '',
          customerType: c.customerType || 'shipper',
          customerLevel: c.customerLevel || 'normal',
          customerRegion: (c as any).customerRegion || 'china',
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
          notes: c.notes || ''
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
      const response = await fetch(`${API_BASE}/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert('保存成功')
        navigate(`/crm/customers/${id}`)
      } else {
        alert(data.msg || '保存失败')
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

  if (error || !customer) {
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
        description="编辑客户"
        tabs={crmTabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/crm/customers/${id}`)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">编辑客户</h2>
            <p className="text-sm text-gray-500">{customer.customerCode} - {customer.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/crm/customers/${id}`)}
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
      </div>

      {/* 编辑表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 基本信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            基本信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* 客户区域 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">客户区域</label>
              <select
                value={formData.customerRegion}
                onChange={(e) => handleInputChange('customerRegion', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {CUSTOMER_REGIONS.map(region => (
                  <option key={region.value} value={region.value}>{region.label}</option>
                ))}
              </select>
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

