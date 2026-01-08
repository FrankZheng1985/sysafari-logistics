import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, FileText, Package, User, Ship, DollarSign, Anchor, Search } from 'lucide-react'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import DatePicker from './DatePicker'

const API_BASE = getApiBaseUrl()

interface DocumentType {
  id: number
  code: string
  nameCn: string
  nameEn: string
}

interface BillOption {
  id: string
  billNumber: string
  containerNumber: string
  customerName: string
  portOfLoading: string
  portOfDischarge: string
}

interface DocumentItem {
  id?: string
  description: string
  hsCode: string
  quantity: number
  quantityUnit: string
  unitPrice: number
  totalPrice: number
  grossWeight: number
  netWeight: number
  volume: number
  countryOfOrigin: string
  remark: string
}

interface ClearanceDocumentModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
  documentTypes: DocumentType[]
  billId?: string
  billNumber?: string
}

// 统一的输入框样式
const inputClass = "w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
const selectClass = "w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
const textareaClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

export default function ClearanceDocumentModal({
  visible,
  onClose,
  onSuccess,
  data,
  documentTypes,
  billId,
  billNumber,
}: ClearanceDocumentModalProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'goods' | 'transport' | 'customs' | 'items'>('basic')
  
  // 订单选择相关状态
  const [billOptions, setBillOptions] = useState<BillOption[]>([])
  const [billSearchValue, setBillSearchValue] = useState('')
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillOption | null>(null)
  const [loadingBills, setLoadingBills] = useState(false)
  const billDropdownRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    documentType: '',
    documentTypeName: '',
    billId: billId || '',
    billNumber: billNumber || '',
    shipperName: '',
    shipperAddress: '',
    shipperContact: '',
    consigneeName: '',
    consigneeAddress: '',
    consigneeContact: '',
    notifyParty: '',
    goodsDescription: '',
    hsCode: '',
    quantity: 0,
    quantityUnit: 'PCS',
    grossWeight: 0,
    netWeight: 0,
    weightUnit: 'KGS',
    volume: 0,
    volumeUnit: 'CBM',
    packages: 0,
    packageType: 'CARTON',
    currency: 'EUR',
    totalValue: 0,
    unitPrice: 0,
    freightAmount: 0,
    insuranceAmount: 0,
    transportMethod: '',
    vesselName: '',
    voyageNo: '',
    portOfLoading: '',
    portOfDischarge: '',
    countryOfOrigin: '',
    countryOfDestination: '',
    etd: '',
    eta: '',
    customsBroker: '',
    customsEntryNo: '',
    customsReleaseDate: '',
    dutyAmount: 0,
    taxAmount: 0,
    status: 'draft',
    remark: '',
  })
  
  const [items, setItems] = useState<DocumentItem[]>([])

  useEffect(() => {
    if (visible) {
      if (data) {
        loadDocumentDetail(data.id)
      } else {
        resetForm()
      }
      loadBillOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, data])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (billDropdownRef.current && !billDropdownRef.current.contains(event.target as Node)) {
        setShowBillDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 加载订单列表
  const loadBillOptions = async (search?: string) => {
    setLoadingBills(true)
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (search) params.append('search', search)
      
      const response = await fetch(`${API_BASE}/api/bills?${params}`)
      const result = await response.json()
      
      if (result.errCode === 200 && result.data?.list) {
        setBillOptions(result.data.list.map((bill: any) => ({
          id: bill.id,
          billNumber: bill.billNumber,
          containerNumber: bill.containerNumber,
          customerName: bill.customerName,
          portOfLoading: bill.portOfLoading,
          portOfDischarge: bill.portOfDischarge,
        })))
      }
    } catch (error) {
      console.error('加载订单列表失败:', error)
    } finally {
      setLoadingBills(false)
    }
  }

  // 处理订单选择
  const handleBillSelect = (bill: BillOption) => {
    setSelectedBill(bill)
    setFormData(prev => ({
      ...prev,
      billId: bill.id,
      billNumber: bill.billNumber,
      // 自动填充发货人信息
      shipperName: bill.customerName || prev.shipperName,
      // 自动填充运输信息
      portOfLoading: bill.portOfLoading || prev.portOfLoading,
      portOfDischarge: bill.portOfDischarge || prev.portOfDischarge,
    }))
    setBillSearchValue(`${bill.billNumber}${bill.containerNumber ? ` (${bill.containerNumber})` : ''}`)
    setShowBillDropdown(false)
  }

  // 处理订单搜索
  const handleBillSearch = (value: string) => {
    setBillSearchValue(value)
    setShowBillDropdown(true)
    // 防抖搜索
    const timeoutId = setTimeout(() => {
      loadBillOptions(value)
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  // 清除选中的订单
  const handleClearBill = () => {
    setSelectedBill(null)
    setBillSearchValue('')
    setFormData(prev => ({
      ...prev,
      billId: '',
      billNumber: '',
    }))
  }

  const loadDocumentDetail = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/clearance/documents/${id}`)
      const result = await response.json()
      if (result.errCode === 200 && result.data) {
        const doc = result.data
        setFormData({
          documentType: doc.documentType || '',
          documentTypeName: doc.documentTypeName || '',
          billId: doc.billId || billId || '',
          billNumber: doc.billNumber || billNumber || '',
          shipperName: doc.shipperName || '',
          shipperAddress: doc.shipperAddress || '',
          shipperContact: doc.shipperContact || '',
          consigneeName: doc.consigneeName || '',
          consigneeAddress: doc.consigneeAddress || '',
          consigneeContact: doc.consigneeContact || '',
          notifyParty: doc.notifyParty || '',
          goodsDescription: doc.goodsDescription || '',
          hsCode: doc.hsCode || '',
          quantity: doc.quantity || 0,
          quantityUnit: doc.quantityUnit || 'PCS',
          grossWeight: doc.grossWeight || 0,
          netWeight: doc.netWeight || 0,
          weightUnit: doc.weightUnit || 'KGS',
          volume: doc.volume || 0,
          volumeUnit: doc.volumeUnit || 'CBM',
          packages: doc.packages || 0,
          packageType: doc.packageType || 'CARTON',
          currency: doc.currency || 'EUR',
          totalValue: doc.totalValue || 0,
          unitPrice: doc.unitPrice || 0,
          freightAmount: doc.freightAmount || 0,
          insuranceAmount: doc.insuranceAmount || 0,
          transportMethod: doc.transportMethod || '',
          vesselName: doc.vesselName || '',
          voyageNo: doc.voyageNo || '',
          portOfLoading: doc.portOfLoading || '',
          portOfDischarge: doc.portOfDischarge || '',
          countryOfOrigin: doc.countryOfOrigin || '',
          countryOfDestination: doc.countryOfDestination || '',
          etd: doc.etd || '',
          eta: doc.eta || '',
          customsBroker: doc.customsBroker || '',
          customsEntryNo: doc.customsEntryNo || '',
          customsReleaseDate: doc.customsReleaseDate || '',
          dutyAmount: doc.dutyAmount || 0,
          taxAmount: doc.taxAmount || 0,
          status: doc.status || 'draft',
          remark: doc.remark || '',
        })
        setItems(doc.items || [])
        // 设置订单搜索值
        if (doc.billNumber) {
          setBillSearchValue(doc.billNumber)
        }
      }
    } catch (error) {
      console.error('加载单证详情失败:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      documentType: '',
      documentTypeName: '',
      billId: billId || '',
      billNumber: billNumber || '',
      shipperName: '',
      shipperAddress: '',
      shipperContact: '',
      consigneeName: '',
      consigneeAddress: '',
      consigneeContact: '',
      notifyParty: '',
      goodsDescription: '',
      hsCode: '',
      quantity: 0,
      quantityUnit: 'PCS',
      grossWeight: 0,
      netWeight: 0,
      weightUnit: 'KGS',
      volume: 0,
      volumeUnit: 'CBM',
      packages: 0,
      packageType: 'CARTON',
      currency: 'EUR',
      totalValue: 0,
      unitPrice: 0,
      freightAmount: 0,
      insuranceAmount: 0,
      transportMethod: '',
      vesselName: '',
      voyageNo: '',
      portOfLoading: '',
      portOfDischarge: '',
      countryOfOrigin: '',
      countryOfDestination: '',
      etd: '',
      eta: '',
      customsBroker: '',
      customsEntryNo: '',
      customsReleaseDate: '',
      dutyAmount: 0,
      taxAmount: 0,
      status: 'draft',
      remark: '',
    })
    setItems([])
    setActiveTab('basic')
    setSelectedBill(null)
    setBillSearchValue('')
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleDocumentTypeChange = (code: string) => {
    const type = documentTypes.find(t => t.code === code)
    setFormData(prev => ({
      ...prev,
      documentType: code,
      documentTypeName: type?.nameCn || ''
    }))
  }

  const handleAddItem = () => {
    setItems([...items, {
      description: '',
      hsCode: '',
      quantity: 0,
      quantityUnit: 'PCS',
      unitPrice: 0,
      totalPrice: 0,
      grossWeight: 0,
      netWeight: 0,
      volume: 0,
      countryOfOrigin: '',
      remark: '',
    }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].totalPrice = (newItems[index].quantity || 0) * (newItems[index].unitPrice || 0)
    }
    
    setItems(newItems)
  }

  const handleSubmit = async () => {
    if (!formData.documentType) {
      alert('请选择单证类型')
      return
    }

    setLoading(true)
    try {
      const submitData = {
        ...formData,
        items: items.length > 0 ? items : undefined
      }

      const url = data ? `/api/clearance/documents/${data.id}` : '/api/clearance/documents'
      const method = data ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(submitData)
      })
      
      const result = await response.json()
      
      if (result.errCode === 200) {
        onSuccess()
      } else {
        alert(result.msg || '操作失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  const tabs = [
    { key: 'basic', label: '基础信息', icon: FileText },
    { key: 'goods', label: '货物信息', icon: Package },
    { key: 'transport', label: '运输信息', icon: Ship },
    { key: 'customs', label: '清关信息', icon: DollarSign },
    { key: 'items', label: '货物明细', icon: Package },
  ]

  // 表单分组组件
  const FormSection = ({ title, icon: Icon, children, className = '' }: { title: string; icon: any; children: React.ReactNode; className?: string }) => (
    <div className={`bg-gray-50 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
        <div className="p-1.5 bg-primary-100 rounded-lg">
          <Icon className="w-4 h-4 text-primary-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  )

  // 表单行组件
  const FormRow = ({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) => (
    <div className={`grid grid-cols-${cols} gap-4`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )

  // 表单项组件
  const FormItem = ({ label, required, children, className = '' }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) => (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {data ? '编辑单证' : '新建单证'}
              </h2>
              <p className="text-xs text-primary-100">填写清关单证信息</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex-shrink-0 flex bg-gray-50 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative ${
                  isActive
                    ? 'text-primary-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
                )}
              </button>
            )
          })}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-white">
          {/* 基础信息 */}
          {activeTab === 'basic' && (
            <div className="space-y-5">
              {/* 单证类型和状态 */}
              <FormSection title="单证信息" icon={FileText}>
                <FormRow cols={3}>
                  <FormItem label="单证类型" required>
                    <select
                      value={formData.documentType}
                      onChange={(e) => handleDocumentTypeChange(e.target.value)}
                      className={selectClass}
                      disabled={!!data}
                    >
                      <option value="">请选择单证类型</option>
                      {documentTypes.map((type) => (
                        <option key={type.code} value={type.code}>
                          {type.nameCn} ({type.code})
                        </option>
                      ))}
                    </select>
                  </FormItem>
                  <FormItem label="关联订单">
                    <div className="relative" ref={billDropdownRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={billSearchValue}
                          onChange={(e) => handleBillSearch(e.target.value)}
                          onFocus={() => setShowBillDropdown(true)}
                          placeholder="搜索订单号..."
                          className={`${inputClass} pl-9 pr-8`}
                        />
                        {billSearchValue && (
                          <button
                            type="button"
                            onClick={handleClearBill}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {showBillDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {loadingBills ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">加载中...</div>
                          ) : billOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">未找到订单</div>
                          ) : (
                            billOptions.map((bill) => (
                              <div
                                key={bill.id}
                                onClick={() => handleBillSelect(bill)}
                                className={`px-4 py-2 cursor-pointer hover:bg-primary-50 transition-colors ${
                                  selectedBill?.id === bill.id ? 'bg-primary-50' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">{bill.billNumber}</span>
                                  {bill.containerNumber && (
                                    <span className="text-xs text-gray-500">{bill.containerNumber}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {bill.customerName && (
                                    <span className="text-xs text-gray-500">{bill.customerName}</span>
                                  )}
                                  {bill.portOfLoading && bill.portOfDischarge && (
                                    <span className="text-xs text-gray-400">
                                      {bill.portOfLoading} → {bill.portOfDischarge}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </FormItem>
                  <FormItem label="状态">
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className={selectClass}
                    >
                      <option value="draft">草稿</option>
                      <option value="pending">待提交</option>
                      <option value="submitted">已提交</option>
                      <option value="processing">处理中</option>
                      <option value="completed">已完成</option>
                    </select>
                  </FormItem>
                </FormRow>
              </FormSection>

              {/* 发货人信息 */}
              <FormSection title="发货人信息" icon={User}>
                <div className="space-y-3">
                  <FormRow cols={2}>
                    <FormItem label="发货人名称">
                      <input
                        type="text"
                        value={formData.shipperName}
                        onChange={(e) => handleInputChange('shipperName', e.target.value)}
                        placeholder="请输入发货人名称"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="联系方式">
                      <input
                        type="text"
                        value={formData.shipperContact}
                        onChange={(e) => handleInputChange('shipperContact', e.target.value)}
                        placeholder="电话/邮箱"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                  <FormItem label="地址">
                    <textarea
                      value={formData.shipperAddress}
                      onChange={(e) => handleInputChange('shipperAddress', e.target.value)}
                      placeholder="请输入详细地址"
                      rows={2}
                      className={textareaClass}
                    />
                  </FormItem>
                </div>
              </FormSection>

              {/* 收货人信息 */}
              <FormSection title="收货人信息" icon={User}>
                <div className="space-y-3">
                  <FormRow cols={2}>
                    <FormItem label="收货人名称">
                      <input
                        type="text"
                        value={formData.consigneeName}
                        onChange={(e) => handleInputChange('consigneeName', e.target.value)}
                        placeholder="请输入收货人名称"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="联系方式">
                      <input
                        type="text"
                        value={formData.consigneeContact}
                        onChange={(e) => handleInputChange('consigneeContact', e.target.value)}
                        placeholder="电话/邮箱"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                  <FormItem label="地址">
                    <textarea
                      value={formData.consigneeAddress}
                      onChange={(e) => handleInputChange('consigneeAddress', e.target.value)}
                      placeholder="请输入详细地址"
                      rows={2}
                      className={textareaClass}
                    />
                  </FormItem>
                  <FormItem label="通知方">
                    <input
                      type="text"
                      value={formData.notifyParty}
                      onChange={(e) => handleInputChange('notifyParty', e.target.value)}
                      placeholder="请输入通知方信息"
                      className={inputClass}
                    />
                  </FormItem>
                </div>
              </FormSection>

              {/* 备注 */}
              <FormItem label="备注">
                <textarea
                  value={formData.remark}
                  onChange={(e) => handleInputChange('remark', e.target.value)}
                  placeholder="其他需要说明的信息"
                  rows={3}
                  className={textareaClass}
                />
              </FormItem>
            </div>
          )}

          {/* 货物信息 */}
          {activeTab === 'goods' && (
            <div className="space-y-5">
              <FormSection title="货物描述" icon={Package}>
                <FormItem label="货物描述">
                  <textarea
                    value={formData.goodsDescription}
                    onChange={(e) => handleInputChange('goodsDescription', e.target.value)}
                    placeholder="请详细描述货物信息"
                    rows={3}
                    className={textareaClass}
                  />
                </FormItem>
              </FormSection>

              <FormSection title="数量规格" icon={Package}>
                <div className="space-y-4">
                  <FormRow cols={3}>
                    <FormItem label="HS编码">
                      <input
                        type="text"
                        value={formData.hsCode}
                        onChange={(e) => handleInputChange('hsCode', e.target.value)}
                        placeholder="如: 8471300000"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="数量">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.quantity || ''}
                          onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className={`${inputClass} flex-1`}
                        />
                        <select
                          value={formData.quantityUnit}
                          onChange={(e) => handleInputChange('quantityUnit', e.target.value)}
                          className={`${selectClass} w-20`}
                        >
                          <option value="PCS">PCS</option>
                          <option value="CTN">CTN</option>
                          <option value="SET">SET</option>
                          <option value="KG">KG</option>
                        </select>
                      </div>
                    </FormItem>
                    <FormItem label="件数">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.packages || ''}
                          onChange={(e) => handleInputChange('packages', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className={`${inputClass} flex-1`}
                        />
                        <select
                          value={formData.packageType}
                          onChange={(e) => handleInputChange('packageType', e.target.value)}
                          className={`${selectClass} w-24`}
                        >
                          <option value="CARTON">CARTON</option>
                          <option value="PALLET">PALLET</option>
                          <option value="BAG">BAG</option>
                          <option value="DRUM">DRUM</option>
                        </select>
                      </div>
                    </FormItem>
                  </FormRow>

                  <FormRow cols={3}>
                    <FormItem label="毛重 (KGS)">
                      <input
                        type="number"
                        value={formData.grossWeight || ''}
                        onChange={(e) => handleInputChange('grossWeight', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="净重 (KGS)">
                      <input
                        type="number"
                        value={formData.netWeight || ''}
                        onChange={(e) => handleInputChange('netWeight', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="体积 (CBM)">
                      <input
                        type="number"
                        value={formData.volume || ''}
                        onChange={(e) => handleInputChange('volume', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                </div>
              </FormSection>

              <FormSection title="货值信息" icon={DollarSign}>
                <FormRow cols={3}>
                  <FormItem label="币种">
                    <select
                      value={formData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      className={selectClass}
                    >
                      <option value="EUR">EUR - 欧元</option>
                      <option value="USD">USD - 美元</option>
                      <option value="CNY">CNY - 人民币</option>
                      <option value="GBP">GBP - 英镑</option>
                    </select>
                  </FormItem>
                  <FormItem label="单价">
                    <input
                      type="number"
                      value={formData.unitPrice || ''}
                      onChange={(e) => handleInputChange('unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </FormItem>
                  <FormItem label="货值总额">
                    <input
                      type="number"
                      value={formData.totalValue || ''}
                      onChange={(e) => handleInputChange('totalValue', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </FormItem>
                </FormRow>
              </FormSection>
            </div>
          )}

          {/* 运输信息 */}
          {activeTab === 'transport' && (
            <div className="space-y-5">
              <FormSection title="运输方式" icon={Ship}>
                <FormRow cols={3}>
                  <FormItem label="运输方式">
                    <select
                      value={formData.transportMethod}
                      onChange={(e) => handleInputChange('transportMethod', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">请选择</option>
                      <option value="sea">🚢 海运</option>
                      <option value="air">✈️ 空运</option>
                      <option value="rail">🚂 铁路</option>
                      <option value="truck">🚛 卡车</option>
                    </select>
                  </FormItem>
                  <FormItem label="船名/航班">
                    <input
                      type="text"
                      value={formData.vesselName}
                      onChange={(e) => handleInputChange('vesselName', e.target.value)}
                      placeholder="如: EVER GIVEN"
                      className={inputClass}
                    />
                  </FormItem>
                  <FormItem label="航次">
                    <input
                      type="text"
                      value={formData.voyageNo}
                      onChange={(e) => handleInputChange('voyageNo', e.target.value)}
                      placeholder="如: 2025E"
                      className={inputClass}
                    />
                  </FormItem>
                </FormRow>
              </FormSection>

              <FormSection title="港口信息" icon={Anchor}>
                <div className="space-y-4">
                  <FormRow cols={2}>
                    <FormItem label="起运港">
                      <input
                        type="text"
                        value={formData.portOfLoading}
                        onChange={(e) => handleInputChange('portOfLoading', e.target.value)}
                        placeholder="如: SHANGHAI"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="目的港">
                      <input
                        type="text"
                        value={formData.portOfDischarge}
                        onChange={(e) => handleInputChange('portOfDischarge', e.target.value)}
                        placeholder="如: ROTTERDAM"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                  <FormRow cols={2}>
                    <FormItem label="原产国">
                      <input
                        type="text"
                        value={formData.countryOfOrigin}
                        onChange={(e) => handleInputChange('countryOfOrigin', e.target.value)}
                        placeholder="如: CHINA"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="目的国">
                      <input
                        type="text"
                        value={formData.countryOfDestination}
                        onChange={(e) => handleInputChange('countryOfDestination', e.target.value)}
                        placeholder="如: NETHERLANDS"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                </div>
              </FormSection>

              <FormSection title="时间节点" icon={FileText}>
                <FormRow cols={2}>
                  <FormItem label="预计离港 (ETD)">
                    <DatePicker
                      value={formData.etd}
                      onChange={(value) => handleInputChange('etd', value)}
                      placeholder="选择离港日期"
                    />
                  </FormItem>
                  <FormItem label="预计到港 (ETA)">
                    <DatePicker
                      value={formData.eta}
                      onChange={(value) => handleInputChange('eta', value)}
                      placeholder="选择到港日期"
                    />
                  </FormItem>
                </FormRow>
              </FormSection>
            </div>
          )}

          {/* 清关信息 */}
          {activeTab === 'customs' && (
            <div className="space-y-5">
              <FormSection title="报关信息" icon={FileText}>
                <div className="space-y-4">
                  <FormRow cols={2}>
                    <FormItem label="报关行">
                      <input
                        type="text"
                        value={formData.customsBroker}
                        onChange={(e) => handleInputChange('customsBroker', e.target.value)}
                        placeholder="请输入报关行名称"
                        className={inputClass}
                      />
                    </FormItem>
                    <FormItem label="报关单号">
                      <input
                        type="text"
                        value={formData.customsEntryNo}
                        onChange={(e) => handleInputChange('customsEntryNo', e.target.value)}
                        placeholder="请输入报关单号"
                        className={inputClass}
                      />
                    </FormItem>
                  </FormRow>
                  <FormItem label="清关放行日期">
                    <DatePicker
                      value={formData.customsReleaseDate}
                      onChange={(value) => handleInputChange('customsReleaseDate', value)}
                      placeholder="选择放行日期"
                    />
                  </FormItem>
                </div>
              </FormSection>

              <FormSection title="税费信息" icon={DollarSign}>
                <FormRow cols={2}>
                  <FormItem label="关税金额">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{formData.currency}</span>
                      <input
                        type="number"
                        value={formData.dutyAmount || ''}
                        onChange={(e) => handleInputChange('dutyAmount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`${inputClass} pl-12`}
                      />
                    </div>
                  </FormItem>
                  <FormItem label="税金金额">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{formData.currency}</span>
                      <input
                        type="number"
                        value={formData.taxAmount || ''}
                        onChange={(e) => handleInputChange('taxAmount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`${inputClass} pl-12`}
                      />
                    </div>
                  </FormItem>
                </FormRow>
                <div className="mt-4">
                  <FormRow cols={2}>
                    <FormItem label="运费">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{formData.currency}</span>
                        <input
                          type="number"
                          value={formData.freightAmount || ''}
                          onChange={(e) => handleInputChange('freightAmount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className={`${inputClass} pl-12`}
                        />
                      </div>
                    </FormItem>
                    <FormItem label="保险费">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{formData.currency}</span>
                        <input
                          type="number"
                          value={formData.insuranceAmount || ''}
                          onChange={(e) => handleInputChange('insuranceAmount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className={`${inputClass} pl-12`}
                        />
                      </div>
                    </FormItem>
                  </FormRow>
                </div>
              </FormSection>
            </div>
          )}

          {/* 货物明细 */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">货物明细列表</h3>
                  <p className="text-xs text-gray-500 mt-0.5">添加详细的货物信息</p>
                </div>
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加明细
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">暂无货物明细</p>
                  <p className="text-gray-400 text-xs mt-1">点击上方按钮添加货物明细信息</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary-600">{index + 1}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">明细项</span>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <FormRow cols={3}>
                          <FormItem label="品名描述" className="col-span-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              placeholder="请输入品名描述"
                              className={inputClass}
                            />
                          </FormItem>
                          <FormItem label="HS编码">
                            <input
                              type="text"
                              value={item.hsCode}
                              onChange={(e) => handleItemChange(index, 'hsCode', e.target.value)}
                              placeholder="HS编码"
                              className={inputClass}
                            />
                          </FormItem>
                        </FormRow>
                        
                        <FormRow cols={4}>
                          <FormItem label="数量">
                            <input
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className={inputClass}
                            />
                          </FormItem>
                          <FormItem label="单价">
                            <input
                              type="number"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={inputClass}
                            />
                          </FormItem>
                          <FormItem label="总价">
                            <input
                              type="number"
                              value={item.totalPrice || ''}
                              readOnly
                              className={`${inputClass} bg-gray-100`}
                            />
                          </FormItem>
                          <FormItem label="原产国">
                            <input
                              type="text"
                              value={item.countryOfOrigin}
                              onChange={(e) => handleItemChange(index, 'countryOfOrigin', e.target.value)}
                              placeholder="原产国"
                              className={inputClass}
                            />
                          </FormItem>
                        </FormRow>
                        
                        <FormRow cols={3}>
                          <FormItem label="毛重 (KGS)">
                            <input
                              type="number"
                              value={item.grossWeight || ''}
                              onChange={(e) => handleItemChange(index, 'grossWeight', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={inputClass}
                            />
                          </FormItem>
                          <FormItem label="净重 (KGS)">
                            <input
                              type="number"
                              value={item.netWeight || ''}
                              onChange={(e) => handleItemChange(index, 'netWeight', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={inputClass}
                            />
                          </FormItem>
                          <FormItem label="体积 (CBM)">
                            <input
                              type="number"
                              value={item.volume || ''}
                              onChange={(e) => handleItemChange(index, 'volume', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={inputClass}
                            />
                          </FormItem>
                        </FormRow>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            <span className="text-red-500">*</span> 为必填项
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '保存中...' : data ? '保存修改' : '创建单证'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
