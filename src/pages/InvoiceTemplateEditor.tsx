/**
 * 发票模板编辑器
 * 支持多语言配置（英语、中文），通过谷歌翻译自动翻译
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, Globe, Save, Plus, Trash2, Eye, Copy, X,
  Building2, CreditCard, FileCheck, Languages, RefreshCw,
  ChevronDown, Check, AlertCircle, Loader2, ArrowLeft, Image, Upload
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
]

// 发票模板字段定义
interface InvoiceTemplateField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  group: 'company' | 'bank' | 'terms' | 'labels'
}

const TEMPLATE_FIELDS: InvoiceTemplateField[] = [
  // 公司信息
  { key: 'companyName', label: '公司名称', type: 'text', group: 'company', required: true },
  { key: 'companyAddress', label: '公司地址', type: 'textarea', group: 'company', required: true },
  { key: 'companyCity', label: '城市', type: 'text', group: 'company' },
  { key: 'companyCountry', label: '国家', type: 'text', group: 'company' },
  { key: 'companyPostcode', label: '邮编', type: 'text', group: 'company' },
  { key: 'companyPhone', label: '电话', type: 'text', group: 'company' },
  { key: 'companyEmail', label: '邮箱', type: 'text', group: 'company' },
  { key: 'companyWebsite', label: '网站', type: 'text', group: 'company' },
  { key: 'taxNumber', label: '税号/VAT', type: 'text', group: 'company', required: true },
  { key: 'registrationNumber', label: '注册号', type: 'text', group: 'company' },
  
  // 银行信息
  { key: 'bankName', label: '银行名称', type: 'text', group: 'bank', required: true },
  { key: 'bankAddress', label: '银行地址', type: 'text', group: 'bank' },
  { key: 'accountName', label: '账户名称', type: 'text', group: 'bank', required: true },
  { key: 'accountNumber', label: '账号/IBAN', type: 'text', group: 'bank', required: true },
  { key: 'swiftCode', label: 'SWIFT/BIC', type: 'text', group: 'bank' },
  { key: 'sortCode', label: 'Sort Code', type: 'text', group: 'bank' },
  
  // 发票条款（付款条款根据开票时设置的账期天数自动生成）
  { key: 'footerNote', label: '页脚备注', type: 'textarea', group: 'terms', placeholder: '显示在发票底部的额外说明' },
  { key: 'thankYouMessage', label: '感谢语', type: 'text', group: 'terms', placeholder: '感谢您的惠顾！' },
  
  // 发票标签（多语言）
  { key: 'labelInvoice', label: '发票标题', type: 'text', group: 'labels', placeholder: 'INVOICE / 发票' },
  { key: 'labelInvoiceNumber', label: '发票号标签', type: 'text', group: 'labels', placeholder: 'Invoice No.' },
  { key: 'labelDate', label: '日期标签', type: 'text', group: 'labels', placeholder: 'Date' },
  { key: 'labelDueDate', label: '到期日标签', type: 'text', group: 'labels', placeholder: 'Due Date' },
  { key: 'labelBillTo', label: '收票方标签', type: 'text', group: 'labels', placeholder: 'Bill To' },
  { key: 'labelDescription', label: '描述标签', type: 'text', group: 'labels', placeholder: 'Description' },
  { key: 'labelQuantity', label: '数量标签', type: 'text', group: 'labels', placeholder: 'Qty' },
  { key: 'labelUnitPrice', label: '单价标签', type: 'text', group: 'labels', placeholder: 'Unit Price' },
  { key: 'labelAmount', label: '金额标签', type: 'text', group: 'labels', placeholder: 'Amount' },
  { key: 'labelSubtotal', label: '小计标签', type: 'text', group: 'labels', placeholder: 'Subtotal' },
  { key: 'labelTax', label: '税额标签', type: 'text', group: 'labels', placeholder: 'Tax' },
  { key: 'labelTotal', label: '总计标签', type: 'text', group: 'labels', placeholder: 'Total' },
  { key: 'labelBankDetails', label: '银行信息标签', type: 'text', group: 'labels', placeholder: 'Bank Details' },
  { key: 'labelPaymentTerms', label: '付款条款标签', type: 'text', group: 'labels', placeholder: 'Payment Terms' },
  { key: 'labelContainerNo', label: '集装箱号标签', type: 'text', group: 'labels', placeholder: 'Container No.' },
  { key: 'labelDiscount', label: '折扣标签', type: 'text', group: 'labels', placeholder: 'Discount' },
  { key: 'labelFinal', label: '最终金额标签', type: 'text', group: 'labels', placeholder: 'Final' },
  { key: 'labelPaymentDate', label: '付款日期标签', type: 'text', group: 'labels', placeholder: 'Payment Date' },
]

// 默认模板值
const DEFAULT_TEMPLATE: Record<string, Record<string, string>> = {
  zh: {
    companyName: '',
    companyAddress: '',
    companyCity: '',
    companyCountry: '',
    companyPostcode: '',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: '',
    taxNumber: '',
    registrationNumber: '',
    bankName: '',
    bankAddress: '',
    accountName: '',
    accountNumber: '',
    swiftCode: '',
    sortCode: '',
    footerNote: '',
    thankYouMessage: '感谢您的惠顾！',
    labelInvoice: '发票',
    labelInvoiceNumber: '发票号',
    labelDate: '日期',
    labelDueDate: '到期日',
    labelBillTo: '收票方',
    labelDescription: '描述',
    labelQuantity: '数量',
    labelUnitPrice: '单价',
    labelAmount: '金额',
    labelSubtotal: '小计',
    labelTax: '税额',
    labelTotal: '总计',
    labelBankDetails: '银行信息',
    labelPaymentTerms: '付款条款',
    labelContainerNo: '集装箱号',
    labelDiscount: '折扣',
    labelFinal: '最终金额',
    labelPaymentDate: '付款日期',
  },
  en: {
    companyName: '',
    companyAddress: '',
    companyCity: '',
    companyCountry: '',
    companyPostcode: '',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: '',
    taxNumber: '',
    registrationNumber: '',
    bankName: '',
    bankAddress: '',
    accountName: '',
    accountNumber: '',
    swiftCode: '',
    sortCode: '',
    footerNote: '',
    thankYouMessage: 'Thank you for your business!',
    labelInvoice: 'INVOICE',
    labelInvoiceNumber: 'Invoice No.',
    labelDate: 'Date',
    labelDueDate: 'Due Date',
    labelBillTo: 'Bill To',
    labelDescription: 'Description',
    labelQuantity: 'Qty',
    labelUnitPrice: 'Unit Price',
    labelAmount: 'Amount',
    labelSubtotal: 'Subtotal',
    labelTax: 'Tax',
    labelTotal: 'Total',
    labelBankDetails: 'Bank Details',
    labelPaymentTerms: 'Payment Terms',
    labelContainerNo: 'Container No.',
    labelDiscount: 'Discount',
    labelFinal: 'Final',
    labelPaymentDate: 'Payment Date',
  },
}

interface InvoiceTemplate {
  id?: number
  templateName: string
  isDefault: boolean
  languages: string[]
  content: Record<string, Record<string, string>>
  logoUrl?: string
  stampUrl?: string
  createdAt?: string
  updatedAt?: string
}

export default function InvoiceTemplateEditor() {
  const navigate = useNavigate()
  
  // 模板列表
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 当前编辑的模板
  const [currentTemplate, setCurrentTemplate] = useState<InvoiceTemplate>({
    templateName: '默认模板',
    isDefault: true,
    languages: ['zh', 'en'],
    content: { ...DEFAULT_TEMPLATE }
  })
  
  // 当前选中的语言
  const [selectedLang, setSelectedLang] = useState('zh')
  
  // 标签页
  const [activeTab, setActiveTab] = useState<'company' | 'bank' | 'terms' | 'labels' | 'images'>('company')
  
  // 图片上传状态
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const stampInputRef = useRef<HTMLInputElement>(null)
  
  // 翻译状态
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  
  // 语言选择下拉菜单
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  
  // 预览模式
  const [showPreview, setShowPreview] = useState(false)

  // 加载模板列表
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/invoice-templates`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setTemplates(data.data || [])
        // 如果有默认模板，加载它
        const defaultTemplate = data.data?.find((t: InvoiceTemplate) => t.isDefault)
        if (defaultTemplate) {
          setCurrentTemplate(defaultTemplate)
        }
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存模板
  const saveTemplate = async () => {
    setSaving(true)
    try {
      const method = currentTemplate.id ? 'PUT' : 'POST'
      const url = currentTemplate.id 
        ? `${API_BASE}/api/invoice-templates/${currentTemplate.id}`
        : `${API_BASE}/api/invoice-templates`
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(currentTemplate)
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        alert('模板保存成功')
        loadTemplates()
        if (data.data?.id) {
          setCurrentTemplate(prev => ({ ...prev, id: data.data.id }))
        }
      } else {
        alert('保存失败: ' + data.msg)
      }
    } catch (error) {
      console.error('保存模板失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除模板
  const deleteTemplate = async (id: number) => {
    if (!confirm('确定要删除此模板吗？')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/invoice-templates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        loadTemplates()
        // 如果删除的是当前模板，重置
        if (currentTemplate.id === id) {
          setCurrentTemplate({
            templateName: '新模板',
            isDefault: false,
            languages: ['zh', 'en'],
            content: { ...DEFAULT_TEMPLATE }
          })
        }
      }
    } catch (error) {
      console.error('删除模板失败:', error)
    }
  }

  // 复制模板
  const duplicateTemplate = (template: InvoiceTemplate) => {
    setCurrentTemplate({
      ...template,
      id: undefined,
      templateName: `${template.templateName} (副本)`,
      isDefault: false
    })
  }

  // 创建新模板
  const createNewTemplate = () => {
    setCurrentTemplate({
      templateName: '新模板',
      isDefault: false,
      languages: ['zh', 'en'],
      content: { ...DEFAULT_TEMPLATE }
    })
  }

  // 更新模板字段
  const updateField = (key: string, value: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [selectedLang]: {
          ...prev.content[selectedLang],
          [key]: value
        }
      }
    }))
  }

  // 添加语言
  const addLanguage = (langCode: string) => {
    if (currentTemplate.languages.includes(langCode)) return
    
    setCurrentTemplate(prev => ({
      ...prev,
      languages: [...prev.languages, langCode],
      content: {
        ...prev.content,
        [langCode]: { ...DEFAULT_TEMPLATE.en } // 使用英语作为默认值
      }
    }))
    setShowLangDropdown(false)
    setSelectedLang(langCode)
  }

  // 移除语言
  const removeLanguage = (langCode: string) => {
    if (currentTemplate.languages.length <= 1) {
      alert('至少需要保留一种语言')
      return
    }
    
    const newLanguages = currentTemplate.languages.filter(l => l !== langCode)
    const newContent = { ...currentTemplate.content }
    delete newContent[langCode]
    
    setCurrentTemplate(prev => ({
      ...prev,
      languages: newLanguages,
      content: newContent
    }))
    
    if (selectedLang === langCode) {
      setSelectedLang(newLanguages[0])
    }
  }

  // 使用谷歌翻译
  const translateToLanguage = useCallback(async (targetLang: string, sourceLang: string = 'zh') => {
    if (targetLang === sourceLang) return
    
    setTranslating(true)
    setTranslateError(null)
    
    try {
      const sourceContent = currentTemplate.content[sourceLang]
      if (!sourceContent) {
        throw new Error('源语言内容为空')
      }
      
      // 收集需要翻译的文本
      const textsToTranslate: { key: string; text: string }[] = []
      for (const field of TEMPLATE_FIELDS) {
        const text = sourceContent[field.key]
        if (text && text.trim()) {
          textsToTranslate.push({ key: field.key, text })
        }
      }
      
      if (textsToTranslate.length === 0) {
        throw new Error('没有可翻译的内容')
      }
      
      // 调用后端翻译API
      const res = await fetch(`${API_BASE}/api/invoice-templates/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          texts: textsToTranslate.map(t => t.text),
          sourceLang,
          targetLang
        })
      })
      
      const data = await res.json()
      
      if (data.errCode === 200 && data.data?.translations) {
        const translations = data.data.translations
        const newContent = { ...currentTemplate.content[targetLang] || {} }
        
        textsToTranslate.forEach((item, index) => {
          if (translations[index]) {
            newContent[item.key] = translations[index]
          }
        })
        
        setCurrentTemplate(prev => ({
          ...prev,
          content: {
            ...prev.content,
            [targetLang]: newContent
          }
        }))
        
        alert(`成功翻译 ${translations.length} 个字段到 ${SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}`)
      } else {
        throw new Error(data.msg || '翻译失败')
      }
    } catch (error: any) {
      console.error('翻译失败:', error)
      setTranslateError(error.message || '翻译失败')
      alert('翻译失败: ' + (error.message || '未知错误'))
    } finally {
      setTranslating(false)
    }
  }, [currentTemplate.content])

  // 从其他语言复制内容
  const copyFromLanguage = (sourceLang: string) => {
    if (sourceLang === selectedLang) return
    
    const sourceContent = currentTemplate.content[sourceLang]
    if (!sourceContent) return
    
    if (confirm(`确定要将 ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name} 的内容复制到当前语言吗？这将覆盖当前内容。`)) {
      setCurrentTemplate(prev => ({
        ...prev,
        content: {
          ...prev.content,
          [selectedLang]: { ...sourceContent }
        }
      }))
    }
  }

  const tabs = [
    { id: 'company' as const, label: '公司信息', icon: Building2 },
    { id: 'bank' as const, label: '银行信息', icon: CreditCard },
    { id: 'terms' as const, label: '发票条款', icon: FileCheck },
    { id: 'labels' as const, label: '多语言标签', icon: Languages },
    { id: 'images' as const, label: 'Logo/公章', icon: Image },
  ]

  // 上传Logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件')
      return
    }
    
    // 验证文件大小（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB')
      return
    }
    
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')
      
      const res = await fetch(`${API_BASE}/api/invoice-templates/upload-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setCurrentTemplate(prev => ({ ...prev, logoUrl: data.data.url }))
        alert('Logo上传成功')
      } else {
        alert('上传失败: ' + data.msg)
      }
    } catch (error) {
      console.error('上传Logo失败:', error)
      alert('上传失败')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // 上传公章
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件')
      return
    }
    
    // 验证文件大小（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB')
      return
    }
    
    setUploadingStamp(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'stamp')
      
      const res = await fetch(`${API_BASE}/api/invoice-templates/upload-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setCurrentTemplate(prev => ({ ...prev, stampUrl: data.data.url }))
        alert('公章上传成功')
      } else {
        alert('上传失败: ' + data.msg)
      }
    } catch (error) {
      console.error('上传公章失败:', error)
      alert('上传失败')
    } finally {
      setUploadingStamp(false)
      if (stampInputRef.current) stampInputRef.current.value = ''
    }
  }

  // 删除Logo
  const handleDeleteLogo = () => {
    if (confirm('确定要删除Logo吗？')) {
      setCurrentTemplate(prev => ({ ...prev, logoUrl: undefined }))
    }
  }

  // 删除公章
  const handleDeleteStamp = () => {
    if (confirm('确定要删除公章吗？')) {
      setCurrentTemplate(prev => ({ ...prev, stampUrl: undefined }))
    }
  }

  const currentLangFields = TEMPLATE_FIELDS.filter(f => f.group === activeTab)
  const currentContent = currentTemplate.content[selectedLang] || {}

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 页头 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/system')}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="返回系统管理"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="p-2 bg-amber-100 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">发票模板编辑器</h1>
              <p className="text-xs text-gray-500">配置发票模板内容，支持多语言</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              预览
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? '保存中...' : '保存模板'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* 左侧：模板列表 */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={createNewTemplate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-600 text-sm font-medium rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                暂无模板
              </div>
            ) : (
              templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setCurrentTemplate(template)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentTemplate.id === template.id
                      ? 'bg-primary-50 border border-primary-200'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {template.templateName}
                        </span>
                        {template.isDefault && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">
                            默认
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {template.languages.map(lang => {
                          const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)
                          return (
                            <span key={lang} className="text-xs" title={langInfo?.name}>
                              {langInfo?.flag}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateTemplate(template) }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="复制"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {!template.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id!) }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：编辑区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 模板基本信息 */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1" htmlFor="templateName">模板名称</label>
                <input
                  id="templateName"
                  type="text"
                  value={currentTemplate.templateName}
                  onChange={(e) => setCurrentTemplate(prev => ({ ...prev, templateName: e.target.value }))}
                  placeholder="请输入模板名称"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">设为默认</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTemplate.isDefault}
                    onChange={(e) => setCurrentTemplate(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">默认模板</span>
                </label>
              </div>
            </div>
          </div>

          {/* 语言选择栏 */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">当前语言：</span>
                <div className="flex items-center gap-1">
                  {currentTemplate.languages.map(lang => {
                    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)
                    return (
                      <button
                        key={lang}
                        onClick={() => setSelectedLang(lang)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors ${
                          selectedLang === lang
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span>{langInfo?.flag}</span>
                        <span>{langInfo?.name}</span>
                        {currentTemplate.languages.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeLanguage(lang) }}
                            className="ml-1 p-0.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                            title="移除此语言"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </button>
                    )
                  })}
                </div>
                
                {/* 添加语言下拉菜单 */}
                <div className="relative">
                  <button
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    添加语言
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showLangDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[160px]">
                      {SUPPORTED_LANGUAGES.filter(l => !currentTemplate.languages.includes(l.code)).map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => addLanguage(lang.code)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </button>
                      ))}
                      {SUPPORTED_LANGUAGES.filter(l => !currentTemplate.languages.includes(l.code)).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">已添加所有语言</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 翻译工具 */}
              <div className="flex items-center gap-2">
                {currentTemplate.languages.length > 1 && selectedLang !== 'zh' && (
                  <button
                    onClick={() => translateToLanguage(selectedLang, 'zh')}
                    disabled={translating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                    title="从中文翻译到当前语言"
                  >
                    {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    从中文翻译
                  </button>
                )}
                {currentTemplate.languages.length > 1 && selectedLang !== 'en' && (
                  <button
                    onClick={() => translateToLanguage(selectedLang, 'en')}
                    disabled={translating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    title="从英文翻译到当前语言"
                  >
                    {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    从英文翻译
                  </button>
                )}
              </div>
            </div>
            
            {translateError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {translateError}
              </div>
            )}
          </div>

          {/* 内容编辑区 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* 标签页 */}
            <div className="bg-white border-b border-gray-200">
              <nav className="flex px-4">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* 表单区域 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-3xl mx-auto">
                {/* 图片上传区域 */}
                {activeTab === 'images' ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">发票图片资源</h3>
                    <p className="text-sm text-gray-500 mb-6">上传公司Logo和公章图片，将显示在发票中</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Logo上传 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">公司Logo</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                          {currentTemplate.logoUrl ? (
                            <div className="flex flex-col items-center">
                              <img 
                                src={currentTemplate.logoUrl.startsWith('http') ? currentTemplate.logoUrl : `${API_BASE}${currentTemplate.logoUrl}`}
                                alt="Logo" 
                                className="max-w-[150px] max-h-[100px] object-contain mb-3"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => logoInputRef.current?.click()}
                                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                >
                                  更换
                                </button>
                                <button
                                  onClick={handleDeleteLogo}
                                  className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => logoInputRef.current?.click()}
                            >
                              {uploadingLogo ? (
                                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                              ) : (
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                              )}
                              <p className="text-sm text-gray-500">点击上传Logo</p>
                              <p className="text-xs text-gray-400 mt-1">支持 PNG、JPG，最大2MB</p>
                            </div>
                          )}
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            title="上传公司Logo"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">建议尺寸：200×100 像素，透明背景PNG最佳</p>
                      </div>
                      
                      {/* 公章上传 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">公司公章</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                          {currentTemplate.stampUrl ? (
                            <div className="flex flex-col items-center">
                              <img 
                                src={currentTemplate.stampUrl.startsWith('http') ? currentTemplate.stampUrl : `${API_BASE}${currentTemplate.stampUrl}`}
                                alt="公章" 
                                className="max-w-[100px] max-h-[100px] object-contain mb-3"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => stampInputRef.current?.click()}
                                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                >
                                  更换
                                </button>
                                <button
                                  onClick={handleDeleteStamp}
                                  className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => stampInputRef.current?.click()}
                            >
                              {uploadingStamp ? (
                                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                              ) : (
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                              )}
                              <p className="text-sm text-gray-500">点击上传公章</p>
                              <p className="text-xs text-gray-400 mt-1">支持 PNG、JPG，最大2MB</p>
                            </div>
                          )}
                          <input
                            ref={stampInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleStampUpload}
                            className="hidden"
                            title="上传公司公章"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">建议尺寸：100×100 像素，透明背景PNG最佳</p>
                      </div>
                    </div>
                    
                    {/* 提示信息 */}
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-900">使用说明</h4>
                          <ul className="text-sm text-amber-700 mt-1 space-y-1">
                            <li>• Logo将显示在发票左上角</li>
                            <li>• 公章将显示在发票合计金额附近</li>
                            <li>• 上传后需要点击"保存模板"按钮才能生效</li>
                            <li>• 建议使用透明背景的PNG格式图片</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentLangFields.map(field => (
                          <div 
                            key={field.key}
                            className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                          >
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                value={currentContent[field.key] || ''}
                                onChange={(e) => updateField(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                              />
                            ) : (
                              <input
                                type={field.type}
                                value={currentContent[field.key] || ''}
                                onChange={(e) => updateField(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* 从其他语言复制提示 */}
                    {currentTemplate.languages.length > 1 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Languages className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-900">快速填充</h4>
                            <p className="text-sm text-blue-700 mt-1">
                              可以从其他语言复制内容，或使用翻译功能自动翻译
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {currentTemplate.languages.filter(l => l !== selectedLang).map(lang => {
                                const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)
                                return (
                                  <button
                                    key={lang}
                                    onClick={() => copyFromLanguage(lang)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white text-blue-600 rounded border border-blue-200 hover:bg-blue-100"
                                  >
                                    <span>{langInfo?.flag}</span>
                                    复制自 {langInfo?.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {showPreview && (
        <InvoicePreviewModal
          template={currentTemplate}
          selectedLang={selectedLang}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

// 发票预览弹窗组件 - 使用真实发票样式
function InvoicePreviewModal({ 
  template, 
  selectedLang, 
  onClose 
}: { 
  template: InvoiceTemplate
  selectedLang: string
  onClose: () => void 
}) {
  const content = template.content[selectedLang] || {}
  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)
  
  // 示例数据
  const sampleItems = [
    { description: 'Terminal Handling Charge', descriptionZh: '堆场费', qty: 1, unitPrice: 280, discount: 0 },
    { description: 'Customs Clearance Fee', descriptionZh: '清关费', qty: 1, unitPrice: 150, discount: 0 },
    { description: 'Import Agency Fee', descriptionZh: '进口商代理费', qty: 1, unitPrice: 200, discount: 50 },
    { description: 'Trucking Fee', descriptionZh: '拖车费', qty: 1, unitPrice: 350, discount: 0 },
  ]
  const subtotal = sampleItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const totalDiscount = sampleItems.reduce((sum, item) => sum + item.discount, 0)
  const total = subtotal - totalDiscount

  // 根据语言获取费用名称
  const getItemName = (item: typeof sampleItems[0]) => {
    if (selectedLang === 'zh') return item.descriptionZh
    return item.description
  }

  // 主题颜色
  const primaryColor = '#E67E22' // 橙色

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">发票预览</h3>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {langInfo?.flag} {langInfo?.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" title="关闭预览">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 预览内容 - 模拟真实发票样式 */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: '210mm', minHeight: '297mm', padding: '15mm 20mm' }}>
            {/* 发票头部 - Logo + 公司信息 */}
            <div className="flex justify-between items-start pb-3 mb-4" style={{ borderBottom: `2px solid ${primaryColor}` }}>
              <div className="flex items-center gap-4">
                {/* Logo */}
                {template.logoUrl ? (
                  <img 
                    src={template.logoUrl.startsWith('http') ? template.logoUrl : `${API_BASE}${template.logoUrl}`}
                    alt="Logo" 
                    className="max-w-[70px] max-h-[70px] object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                    LOGO
                  </div>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold" style={{ color: primaryColor }}>
                  {content.companyName || 'Company Name'}
                </h2>
                <p className="text-[9px] italic text-gray-500 mb-1">
                  PRECISION LOGISTICS, TRUSTED CHOICE
                </p>
                <div className="text-[9px] text-gray-500 space-y-0.5">
                  {content.registrationNumber && <p>Registration No: {content.registrationNumber}</p>}
                  <p>Address: {content.companyAddress || 'Company Address'}</p>
                  {content.companyCity && <p>{content.companyCity} {content.companyPostcode} {content.companyCountry}</p>}
                </div>
              </div>
            </div>
            
            {/* 客户和发票信息 */}
            <div className="flex justify-between mb-4">
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 mb-1">{content.labelBillTo || 'Bill to'}:</p>
                <p className="text-sm font-bold mb-1">Sample Customer Co., Ltd</p>
                <p className="text-[10px] text-gray-600">123 Business Street, Berlin 10115, Germany</p>
                <div className="mt-3 text-[10px]">
                  <span className="font-bold">{content.labelContainerNo || 'Container No'}:</span> CMAU1234567
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold mb-2" style={{ color: primaryColor }}>
                  {content.labelInvoice || 'INVOICE'}
                </h1>
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  <p>{content.labelInvoiceNumber || 'Invoice No'}: <span>INV20260001</span></p>
                  <p>{content.labelDate || 'Invoice Date'}: 2026-01-09</p>
                  <p>{content.labelPaymentTerms || 'Payment Terms'}: 30 Days</p>
                  <p>{content.labelDueDate || 'Due Date'}: 2026-02-08</p>
                </div>
              </div>
            </div>
            
            {/* 费用明细表 */}
            <table className="w-full mb-4 text-[10px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-bold" style={{ width: '40%' }}>
                    {content.labelDescription || 'Service Description'}
                  </th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-bold" style={{ width: '10%' }}>
                    {content.labelQuantity || 'Qty'}
                  </th>
                  <th className="border border-gray-200 px-2 py-1.5 text-right font-bold" style={{ width: '15%' }}>
                    {content.labelUnitPrice || 'Unit Value'}
                  </th>
                  <th className="border border-gray-200 px-2 py-1.5 text-right font-bold" style={{ width: '15%' }}>
                    {content.labelAmount || 'Amount'} EUR
                  </th>
                  <th className="border border-gray-200 px-2 py-1.5 text-right font-bold" style={{ width: '10%', color: primaryColor }}>
                    {content.labelDiscount || 'Discount'}
                  </th>
                  <th className="border border-gray-200 px-2 py-1.5 text-right font-bold" style={{ width: '10%' }}>
                    {content.labelFinal || 'Final'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-gray-200 px-2 py-1.5">{getItemName(item)}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{item.qty}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right">{item.unitPrice.toFixed(2)}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right">{(item.qty * item.unitPrice).toFixed(2)}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right" style={{ color: item.discount > 0 ? primaryColor : undefined }}>
                      {item.discount > 0 ? `-${item.discount.toFixed(2)}` : '-'}
                    </td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                      {(item.qty * item.unitPrice - item.discount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* 合计区域 */}
            <div className="flex justify-end items-start mb-4">
              {/* 公章 - 放在合计金额左侧 */}
              <div className="mr-6 mt-2">
                {template.stampUrl ? (
                  <img 
                    src={template.stampUrl.startsWith('http') ? template.stampUrl : `${API_BASE}${template.stampUrl}`}
                    alt="公章" 
                    className="w-16 h-16 object-contain opacity-80"
                  />
                ) : (
                  <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-gray-400 text-[9px]">
                    公章
                  </div>
                )}
              </div>
              <div className="text-right text-[10px]">
                <div className="flex justify-end gap-10 mb-1">
                  <span>{content.labelSubtotal || 'Sub Total'}</span>
                  <span>{subtotal.toFixed(2)} EUR</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-end gap-10 mb-1" style={{ color: primaryColor }}>
                    <span>{content.labelDiscount || 'Discount'}</span>
                    <span>-{totalDiscount.toFixed(2)} EUR</span>
                  </div>
                )}
                <div className="flex justify-end gap-10 pt-1.5 mt-1.5 border-t-2 border-gray-800 text-sm font-bold">
                  <span>{content.labelTotal || 'Total'}:</span>
                  <span>{total.toFixed(2)} EUR</span>
                </div>
              </div>
            </div>
            
            {/* 付款提示 */}
            <div className="mb-4 pl-3 text-[10px] font-bold text-red-600" style={{ borderLeft: '3px solid #C0392B' }}>
              When making payment please state invoice no
            </div>
            
            {/* 底部信息 - 公司信息 + 银行信息 */}
            <div className="flex justify-between pt-3 border-t border-gray-200 text-[9px] text-gray-600">
              <div className="space-y-0.5">
                <p><span className="font-bold">{content.companyName || 'Company Name'}</span></p>
                {content.registrationNumber && <p><span className="font-bold">Registration No:</span> {content.registrationNumber}</p>}
                <p><span className="font-bold">Address:</span> {content.companyAddress || 'Company Address'}</p>
                {content.taxNumber && <p><span className="font-bold">VAT:</span> {content.taxNumber}</p>}
              </div>
              <div className="text-right space-y-0.5">
                <p><span className="font-bold">Account Holder's Name:</span> {content.accountName || 'Account Name'}</p>
                <p><span className="font-bold">Account Number:</span> {content.accountNumber || 'IBAN/Account'}</p>
                <p><span className="font-bold">Bank's Name:</span> {content.bankName || 'Bank Name'}</p>
                {content.bankAddress && <p><span className="font-bold">Bank's Address:</span> {content.bankAddress}</p>}
                {content.swiftCode && <p><span className="font-bold">SWIFT Code:</span> {content.swiftCode}</p>}
                {content.sortCode && <p><span className="font-bold">Clearing No:</span> {content.sortCode}</p>}
              </div>
            </div>
            
            {/* 付款条款和感谢语 */}
            {(content.paymentTerms || content.thankYouMessage) && (
              <div className="mt-4 pt-3 border-t border-gray-100 text-center text-[9px] text-gray-500">
                {content.paymentTerms && <p className="mb-1">{content.paymentTerms}</p>}
                {content.thankYouMessage && <p className="font-medium">{content.thankYouMessage}</p>}
              </div>
            )}
          </div>
        </div>
        
        {/* 弹窗底部 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            关闭预览
          </button>
        </div>
      </div>
    </div>
  )
}
