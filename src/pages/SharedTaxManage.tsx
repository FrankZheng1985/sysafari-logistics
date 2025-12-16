import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Building2, CheckCircle, XCircle, 
  RefreshCw, FileText, AlertCircle, X, ChevronDown
} from 'lucide-react'

interface SharedTaxNumber {
  id: number
  taxType: 'vat' | 'eori' | 'other'
  taxNumber: string
  country?: string
  companyShortName?: string
  companyName?: string
  companyAddress?: string
  isVerified: boolean
  verifiedAt?: string
  status: string
  remark?: string
  createdAt?: string
}

type ValidationStatus = 'none' | 'valid' | 'invalid'

interface TaxFormData {
  companyShortName: string
  companyName: string
  companyAddress: string
  country: string
  remark: string
  vatEnabled: boolean
  vatNumber: string
  vatVerified: boolean
  vatValidationStatus: ValidationStatus
  vatValidationError: string
  eoriEnabled: boolean
  eoriNumber: string
  eoriVerified: boolean
  eoriValidationStatus: ValidationStatus
  eoriValidationError: string
  otherEnabled: boolean
  otherNumber: string
}

// 验证状态指示灯组件
function ValidationLight({ status, error }: { status: ValidationStatus; error?: string }) {
  if (status === 'none') {
    return <span className="w-2 h-2 rounded-full bg-gray-300" title="未验证" />
  }
  if (status === 'valid') {
    return <span className="w-2 h-2 rounded-full bg-green-500" title="已验证" />
  }
  return <span className="w-2 h-2 rounded-full bg-red-500" title={error || '验证失败'} />
}

// API 基础URL
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// 欧盟国家代码映射表
const euCountryCodeMap: Record<string, string> = {
  'AT': '奥地利', 'BE': '比利时', 'BG': '保加利亚', 'HR': '克罗地亚',
  'CY': '塞浦路斯', 'CZ': '捷克', 'DK': '丹麦', 'EE': '爱沙尼亚',
  'FI': '芬兰', 'FR': '法国', 'DE': '德国', 'EL': '希腊', 'GR': '希腊',
  'HU': '匈牙利', 'IE': '爱尔兰', 'IT': '意大利', 'LV': '拉脱维亚',
  'LT': '立陶宛', 'LU': '卢森堡', 'MT': '马耳他', 'NL': '荷兰',
  'PL': '波兰', 'PT': '葡萄牙', 'RO': '罗马尼亚', 'SK': '斯洛伐克',
  'SI': '斯洛文尼亚', 'ES': '西班牙', 'SE': '瑞典', 'GB': '英国', 'XI': '北爱尔兰'
}

export default function SharedTaxManage() {
  const [taxNumbers, setTaxNumbers] = useState<SharedTaxNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTax, setEditingTax] = useState<SharedTaxNumber | null>(null)
  
  // 表单数据（多选模式）
  const [formData, setFormData] = useState<TaxFormData>({
    companyShortName: '',
    companyName: '',
    companyAddress: '',
    country: '',
    remark: '',
    vatEnabled: false,
    vatNumber: '',
    vatVerified: false,
    vatValidationStatus: 'none',
    vatValidationError: '',
    eoriEnabled: false,
    eoriNumber: '',
    eoriVerified: false,
    eoriValidationStatus: 'none',
    eoriValidationError: '',
    otherEnabled: false,
    otherNumber: ''
  })
  
  const [saving, setSaving] = useState(false)
  const [vatValidating, setVatValidating] = useState(false)
  const [eoriValidating, setEoriValidating] = useState(false)
  
  // 国家选择器
  const [countries, setCountries] = useState<Array<{ id: string; countryNameCn: string; countryCode: string }>>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  // 加载国家列表
  useEffect(() => {
    loadCountries()
  }, [])

  const loadCountries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/countries?status=active`)
      const data = await response.json()
      if (data.errCode === 200 && Array.isArray(data.data)) {
        setCountries(data.data)
      }
    } catch (error) {
      console.error('加载国家列表失败:', error)
    }
  }

  const filteredCountries = (countries || []).filter(c => 
    c.countryNameCn.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(countrySearch.toLowerCase())
  )

  // 加载共享税号列表
  const loadTaxNumbers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)
      if (filterType) params.append('taxType', filterType)
      
      const response = await fetch(`${API_BASE_URL}/api/crm/shared-tax-numbers?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setTaxNumbers(data.data || [])
      }
    } catch (error) {
      console.error('加载共享税号失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTaxNumbers()
  }, [searchText, filterType])

  // 从税号中提取国家
  const getCountryFromTaxNumber = (taxNumber: string): string | null => {
    const code = taxNumber.substring(0, 2).toUpperCase()
    return euCountryCodeMap[code] || null
  }

  // 打开新增弹窗
  const handleAdd = () => {
    setEditingTax(null)
    setFormData({
      companyShortName: '',
      companyName: '',
      companyAddress: '',
      country: '',
      remark: '',
      vatEnabled: false,
      vatNumber: '',
      vatVerified: false,
      vatValidationStatus: 'none',
      vatValidationError: '',
      eoriEnabled: false,
      eoriNumber: '',
      eoriVerified: false,
      eoriValidationStatus: 'none',
      eoriValidationError: '',
      otherEnabled: false,
      otherNumber: ''
    })
    setCountrySearch('')
    setModalVisible(true)
  }

  // 打开编辑弹窗（单个税号编辑）
  const handleEdit = (tax: SharedTaxNumber) => {
    setEditingTax(tax)
    setFormData({
      companyShortName: tax.companyShortName || '',
      companyName: tax.companyName || '',
      companyAddress: tax.companyAddress || '',
      country: tax.country || '',
      remark: tax.remark || '',
      vatEnabled: tax.taxType === 'vat',
      vatNumber: tax.taxType === 'vat' ? tax.taxNumber : '',
      vatVerified: tax.taxType === 'vat' ? tax.isVerified : false,
      vatValidationStatus: tax.taxType === 'vat' ? (tax.isVerified ? 'valid' : 'invalid') : 'none',
      vatValidationError: '',
      eoriEnabled: tax.taxType === 'eori',
      eoriNumber: tax.taxType === 'eori' ? tax.taxNumber : '',
      eoriVerified: tax.taxType === 'eori' ? tax.isVerified : false,
      eoriValidationStatus: tax.taxType === 'eori' ? (tax.isVerified ? 'valid' : 'invalid') : 'none',
      eoriValidationError: '',
      otherEnabled: tax.taxType === 'other',
      otherNumber: tax.taxType === 'other' ? tax.taxNumber : ''
    })
    setCountrySearch(tax.country || '')
    setModalVisible(true)
  }

  // 删除税号
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个共享税号吗？')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/crm/shared-tax-numbers/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadTaxNumbers()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // VAT验证
  const handleValidateVAT = async () => {
    if (!formData.vatNumber.trim()) {
      setFormData(prev => ({ ...prev, vatValidationError: '请先输入VAT税号' }))
      return
    }
    
    setVatValidating(true)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tax/validate-vat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vatNumber: formData.vatNumber.trim() })
      })
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        const detectedCountry = getCountryFromTaxNumber(formData.vatNumber.trim())
        if (data.data.valid) {
          setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || data.data.companyName || '',
            companyAddress: prev.companyAddress || data.data.companyAddress || '',
            country: prev.country || detectedCountry || '',
            vatVerified: true,
            vatValidationStatus: 'valid',
            vatValidationError: ''
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        } else {
          setFormData(prev => ({ 
            ...prev, 
            country: prev.country || detectedCountry || '',
            vatVerified: false,
            vatValidationStatus: 'invalid',
            vatValidationError: data.data.error || 'VAT税号在欧盟数据库中不存在或已失效'
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        }
      } else {
        setFormData(prev => ({ 
          ...prev, 
          vatValidationStatus: 'invalid',
          vatValidationError: 'VAT验证服务暂时不可用'
        }))
      }
    } catch (error) {
      console.error('VAT验证失败:', error)
      setFormData(prev => ({ 
        ...prev, 
        vatValidationStatus: 'invalid',
        vatValidationError: 'VAT验证服务暂时不可用'
      }))
    } finally {
      setVatValidating(false)
    }
  }

  // EORI验证
  const handleValidateEORI = async () => {
    if (!formData.eoriNumber.trim()) {
      setFormData(prev => ({ ...prev, eoriValidationError: '请先输入EORI号码' }))
      return
    }
    
    setEoriValidating(true)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tax/validate-eori`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eoriNumber: formData.eoriNumber.trim() })
      })
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        const detectedCountry = getCountryFromTaxNumber(formData.eoriNumber.trim())
        if (data.data.valid) {
          setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || data.data.companyName || '',
            companyAddress: prev.companyAddress || data.data.companyAddress || '',
            country: prev.country || detectedCountry || '',
            eoriVerified: true,
            eoriValidationStatus: 'valid',
            eoriValidationError: ''
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        } else {
          setFormData(prev => ({ 
            ...prev, 
            country: prev.country || detectedCountry || '',
            eoriVerified: false,
            eoriValidationStatus: 'invalid',
            eoriValidationError: data.data.error || 'EORI号码在欧盟数据库中不存在或已失效'
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        }
      } else {
        setFormData(prev => ({ 
          ...prev, 
          eoriValidationStatus: 'invalid',
          eoriValidationError: 'EORI验证服务暂时不可用'
        }))
      }
    } catch (error) {
      console.error('EORI验证失败:', error)
      setFormData(prev => ({ 
        ...prev, 
        eoriValidationStatus: 'invalid',
        eoriValidationError: 'EORI验证服务暂时不可用'
      }))
    } finally {
      setEoriValidating(false)
    }
  }

  // 选择国家
  const handleSelectCountry = (country: { countryNameCn: string; countryCode: string }) => {
    setFormData({ ...formData, country: country.countryNameCn })
    setCountrySearch(country.countryNameCn)
    setShowCountryDropdown(false)
  }

  // 保存税号
  const handleSave = async () => {
    // 收集所有选中的税号
    const taxNumbers: Array<{ 
      taxType: 'vat' | 'eori' | 'other'
      taxNumber: string
      isVerified: boolean
    }> = []
    
    if (formData.vatEnabled && formData.vatNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'vat', 
        taxNumber: formData.vatNumber.trim(),
        isVerified: formData.vatVerified
      })
    }
    if (formData.eoriEnabled && formData.eoriNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'eori', 
        taxNumber: formData.eoriNumber.trim(),
        isVerified: formData.eoriVerified
      })
    }
    if (formData.otherEnabled && formData.otherNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'other', 
        taxNumber: formData.otherNumber.trim(),
        isVerified: false
      })
    }

    if (taxNumbers.length === 0) {
      alert('请至少选择一种税号类型并填写税号')
      return
    }

    setSaving(true)
    try {
      if (editingTax) {
        // 编辑模式：只更新当前税号
        const currentTax = taxNumbers.find(t => t.taxType === editingTax.taxType)
        if (!currentTax) {
          alert('请填写税号')
          setSaving(false)
          return
        }
        
        const response = await fetch(`${API_BASE_URL}/api/crm/shared-tax-numbers/${editingTax.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxType: currentTax.taxType,
            taxNumber: currentTax.taxNumber,
            country: formData.country,
            companyShortName: formData.companyShortName,
            companyName: formData.companyName,
            companyAddress: formData.companyAddress,
            isVerified: currentTax.isVerified,
            remark: formData.remark
          })
        })
        const data = await response.json()
        
        if (data.errCode === 200) {
          setModalVisible(false)
          loadTaxNumbers()
        } else {
          alert(data.msg || '保存失败')
        }
      } else {
        // 新增模式：批量创建
        let hasError = false
        for (const tax of taxNumbers) {
          const response = await fetch(`${API_BASE_URL}/api/crm/shared-tax-numbers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taxType: tax.taxType,
              taxNumber: tax.taxNumber,
              country: formData.country,
              companyShortName: formData.companyShortName,
              companyName: formData.companyName,
              companyAddress: formData.companyAddress,
              isVerified: tax.isVerified,
              remark: formData.remark
            })
          })
          const data = await response.json()
          
          if (data.errCode !== 200) {
            hasError = true
            alert(data.msg || `创建${tax.taxType.toUpperCase()}失败`)
          }
        }
        
        if (!hasError) {
          setModalVisible(false)
          loadTaxNumbers()
        }
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const getTaxTypeLabel = (type: string) => {
    switch (type) {
      case 'vat': return 'VAT'
      case 'eori': return 'EORI'
      default: return '其他'
    }
  }

  const getTaxTypeBgColor = (type: string) => {
    switch (type) {
      case 'vat': return 'bg-blue-100 text-blue-700'
      case 'eori': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">共享税号库</h1>
              <p className="text-sm text-gray-500">公司级税号管理，可分享给客户使用</p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            添加税号
          </button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索税号、公司名称..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部类型</option>
            <option value="vat">VAT</option>
            <option value="eori">EORI</option>
            <option value="other">其他</option>
          </select>
          <button
            onClick={loadTaxNumbers}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 税号列表 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">税号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">公司简称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">公司全称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">国家</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : taxNumbers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    暂无共享税号
                  </td>
                </tr>
              ) : (
                taxNumbers.map((tax) => (
                  <tr key={tax.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${getTaxTypeBgColor(tax.taxType)}`}>
                        {getTaxTypeLabel(tax.taxType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{tax.taxNumber}</span>
                        {tax.isVerified ? (
                          <span title="已验证"><CheckCircle className="w-4 h-4 text-green-500" /></span>
                        ) : (
                          <span title="未验证"><XCircle className="w-4 h-4 text-red-400" /></span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tax.companyShortName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tax.companyName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tax.country || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        tax.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tax.status === 'active' ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(tax)}
                          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tax.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">
                {editingTax ? '编辑共享税号' : '添加共享税号'}
              </h3>
              <button onClick={() => setModalVisible(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* 税号类型多选 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">税号类型 *</label>
                <div className="space-y-3">
                  {/* VAT税号 */}
                  <div className="p-2 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="vat-checkbox"
                        checked={formData.vatEnabled}
                        onChange={(e) => setFormData({ ...formData, vatEnabled: e.target.checked, vatVerified: false, vatValidationStatus: 'none', vatValidationError: '' })}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        disabled={!!editingTax && editingTax.taxType !== 'vat'}
                      />
                      <label htmlFor="vat-checkbox" className="text-xs font-medium text-gray-700">VAT税号</label>
                      {formData.vatEnabled && formData.vatNumber && (
                        <ValidationLight status={formData.vatValidationStatus} error={formData.vatValidationError} />
                      )}
                    </div>
                    {formData.vatEnabled && (
                      <div className="space-y-2 ml-6">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={formData.vatNumber}
                            onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value.toUpperCase(), vatVerified: false, vatValidationStatus: 'none', vatValidationError: '' })}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="例如: DE123456789"
                          />
                          <button
                            type="button"
                            onClick={handleValidateVAT}
                            disabled={vatValidating || !formData.vatNumber.trim()}
                            className="px-2 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {vatValidating ? '验证中...' : '验证'}
                          </button>
                        </div>
                        {formData.vatValidationStatus === 'invalid' && formData.vatValidationError && (
                          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            ⚠ {formData.vatValidationError}
                          </div>
                        )}
                        {formData.vatValidationStatus === 'valid' && (
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            ✓ VAT税号验证通过
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* EORI号 */}
                  <div className="p-2 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="eori-checkbox"
                        checked={formData.eoriEnabled}
                        onChange={(e) => setFormData({ ...formData, eoriEnabled: e.target.checked, eoriVerified: false, eoriValidationStatus: 'none', eoriValidationError: '' })}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        disabled={!!editingTax && editingTax.taxType !== 'eori'}
                      />
                      <label htmlFor="eori-checkbox" className="text-xs font-medium text-gray-700">EORI号</label>
                      {formData.eoriEnabled && formData.eoriNumber && (
                        <ValidationLight status={formData.eoriValidationStatus} error={formData.eoriValidationError} />
                      )}
                    </div>
                    {formData.eoriEnabled && (
                      <div className="space-y-2 ml-6">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={formData.eoriNumber}
                            onChange={(e) => setFormData({ ...formData, eoriNumber: e.target.value.toUpperCase(), eoriVerified: false, eoriValidationStatus: 'none', eoriValidationError: '' })}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            placeholder="例如: DE123456789012345"
                          />
                          <button
                            type="button"
                            onClick={handleValidateEORI}
                            disabled={eoriValidating || !formData.eoriNumber.trim()}
                            className="px-2 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            {eoriValidating ? '验证中...' : '验证'}
                          </button>
                        </div>
                        {formData.eoriValidationStatus === 'invalid' && formData.eoriValidationError && (
                          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            ⚠ {formData.eoriValidationError}
                          </div>
                        )}
                        {formData.eoriValidationStatus === 'valid' && (
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            ✓ EORI号码验证通过
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 其他 */}
                  <div className="p-2 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="other-checkbox"
                        checked={formData.otherEnabled}
                        onChange={(e) => setFormData({ ...formData, otherEnabled: e.target.checked })}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        disabled={!!editingTax && editingTax.taxType !== 'other'}
                      />
                      <label htmlFor="other-checkbox" className="text-xs font-medium text-gray-700">其他税号</label>
                    </div>
                    {formData.otherEnabled && (
                      <div className="ml-6">
                        <input
                          type="text"
                          value={formData.otherNumber}
                          onChange={(e) => setFormData({ ...formData, otherNumber: e.target.value.toUpperCase() })}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="其他税号"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 公司信息（公共） */}
              <div className="space-y-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                <label className="block text-xs font-medium text-gray-700">公司信息</label>
                <input
                  type="text"
                  value={formData.companyShortName}
                  onChange={(e) => setFormData({ ...formData, companyShortName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  placeholder="公司简称"
                />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  placeholder="公司全称（验证后自动填充）"
                />
                <input
                  type="text"
                  value={formData.companyAddress}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  placeholder="公司地址（验证后自动填充）"
                />
              </div>

              {/* 国家选择 */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">国家</label>
                <div className="relative">
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => {
                      setCountrySearch(e.target.value)
                      setShowCountryDropdown(true)
                    }}
                    onFocus={() => setShowCountryDropdown(true)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 pr-8"
                    placeholder="选择或搜索国家..."
                  />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {showCountryDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">无匹配结果</div>
                    ) : (
                      filteredCountries.slice(0, 10).map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCountry(c)}
                          className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer"
                        >
                          {c.countryNameCn} ({c.countryCode})
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="可选备注"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setModalVisible(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
