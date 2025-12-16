import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Building2, CheckCircle, XCircle, 
  RefreshCw, FileText, AlertCircle
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

// API 基础URL
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export default function SharedTaxManage() {
  const [taxNumbers, setTaxNumbers] = useState<SharedTaxNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTax, setEditingTax] = useState<SharedTaxNumber | null>(null)
  const [formData, setFormData] = useState({
    taxType: 'vat' as 'vat' | 'eori' | 'other',
    taxNumber: '',
    country: '',
    companyShortName: '',
    companyName: '',
    companyAddress: '',
    remark: ''
  })
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{valid: boolean; error?: string} | null>(null)

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

  // 打开新增弹窗
  const handleAdd = () => {
    setEditingTax(null)
    setFormData({
      taxType: 'vat',
      taxNumber: '',
      country: '',
      companyShortName: '',
      companyName: '',
      companyAddress: '',
      remark: ''
    })
    setValidationResult(null)
    setModalVisible(true)
  }

  // 打开编辑弹窗
  const handleEdit = (tax: SharedTaxNumber) => {
    setEditingTax(tax)
    setFormData({
      taxType: tax.taxType,
      taxNumber: tax.taxNumber,
      country: tax.country || '',
      companyShortName: tax.companyShortName || '',
      companyName: tax.companyName || '',
      companyAddress: tax.companyAddress || '',
      remark: tax.remark || ''
    })
    setValidationResult(tax.isVerified ? { valid: true } : null)
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

  // 验证税号
  const handleValidate = async () => {
    if (!formData.taxNumber.trim()) {
      alert('请先输入税号')
      return
    }
    
    setValidating(true)
    setValidationResult(null)
    
    try {
      const endpoint = formData.taxType === 'vat' 
        ? '/api/tax/validate-vat' 
        : '/api/tax/validate-eori'
      
      const body = formData.taxType === 'vat'
        ? { vatNumber: formData.taxNumber }
        : { eoriNumber: formData.taxNumber }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setValidationResult({
          valid: data.data.valid,
          error: data.data.error
        })
        
        // 自动填充公司信息
        if (data.data.valid && data.data.companyName) {
          setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || data.data.companyName || '',
            companyAddress: prev.companyAddress || data.data.companyAddress || ''
          }))
        }
        
        // 自动填充国家
        const countryCode = formData.taxNumber.substring(0, 2).toUpperCase()
        const countryMap: Record<string, string> = {
          'AT': '奥地利', 'BE': '比利时', 'BG': '保加利亚', 'HR': '克罗地亚',
          'CY': '塞浦路斯', 'CZ': '捷克', 'DK': '丹麦', 'EE': '爱沙尼亚',
          'FI': '芬兰', 'FR': '法国', 'DE': '德国', 'EL': '希腊', 'GR': '希腊',
          'HU': '匈牙利', 'IE': '爱尔兰', 'IT': '意大利', 'LV': '拉脱维亚',
          'LT': '立陶宛', 'LU': '卢森堡', 'MT': '马耳他', 'NL': '荷兰',
          'PL': '波兰', 'PT': '葡萄牙', 'RO': '罗马尼亚', 'SK': '斯洛伐克',
          'SI': '斯洛文尼亚', 'ES': '西班牙', 'SE': '瑞典', 'GB': '英国'
        }
        if (!formData.country && countryMap[countryCode]) {
          setFormData(prev => ({ ...prev, country: countryMap[countryCode] }))
        }
      } else {
        setValidationResult({ valid: false, error: '验证服务暂时不可用' })
      }
    } catch (error) {
      console.error('验证失败:', error)
      setValidationResult({ valid: false, error: '验证服务暂时不可用' })
    } finally {
      setValidating(false)
    }
  }

  // 保存税号
  const handleSave = async () => {
    if (!formData.taxNumber.trim()) {
      alert('请输入税号')
      return
    }
    
    setSaving(true)
    try {
      const url = editingTax 
        ? `${API_BASE_URL}/api/crm/shared-tax-numbers/${editingTax.id}`
        : `${API_BASE_URL}/api/crm/shared-tax-numbers`
      
      const response = await fetch(url, {
        method: editingTax ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isVerified: validationResult?.valid || false
        })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setModalVisible(false)
        loadTaxNumbers()
      } else {
        alert(data.msg || '保存失败')
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
              <button
                onClick={() => setModalVisible(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {/* 税号类型 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">税号类型 *</label>
                <select
                  value={formData.taxType}
                  onChange={(e) => setFormData({ ...formData, taxType: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={!!editingTax}
                >
                  <option value="vat">VAT税号</option>
                  <option value="eori">EORI号码</option>
                  <option value="other">其他</option>
                </select>
              </div>

              {/* 税号输入和验证 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">税号 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, taxNumber: e.target.value.toUpperCase() })
                      setValidationResult(null)
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder={formData.taxType === 'vat' ? '如: DE179625447' : '如: DE58222747480765'}
                  />
                  {(formData.taxType === 'vat' || formData.taxType === 'eori') && (
                    <button
                      type="button"
                      onClick={handleValidate}
                      disabled={validating || !formData.taxNumber.trim()}
                      className="px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {validating ? '验证中...' : '验证'}
                    </button>
                  )}
                </div>
                {validationResult && (
                  <div className={`mt-1 text-xs flex items-center gap-1 ${validationResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                    {validationResult.valid ? (
                      <><CheckCircle className="w-3 h-3" /> 验证通过</>
                    ) : (
                      <><AlertCircle className="w-3 h-3" /> {validationResult.error || '验证失败'}</>
                    )}
                  </div>
                )}
              </div>

              {/* 公司信息 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">公司简称</label>
                <input
                  type="text"
                  value={formData.companyShortName}
                  onChange={(e) => setFormData({ ...formData, companyShortName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="公司简称"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">公司全称</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="验证后自动填充"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">公司地址</label>
                <input
                  type="text"
                  value={formData.companyAddress}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="验证后自动填充"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">国家</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="根据税号自动识别"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
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
