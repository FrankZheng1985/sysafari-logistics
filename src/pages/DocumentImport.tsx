import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, Upload, Download, FileSpreadsheet, 
  Check, X, AlertTriangle, RefreshCw, Trash2, Eye, User, Building, ChevronDown, Ship, FileText
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getCustomers, getCustomerTaxNumbers, getBillsList, type Customer, type CustomerTaxNumber, type BillOfLading } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface ImportRecord {
  id: number
  importNo: string
  customerName: string
  containerNo: string
  billNumber: string
  totalItems: number
  matchedItems: number
  pendingItems: number
  status: string
  importFileName: string
  createdAt: string
}

interface PreviewItem {
  rowNo: number
  containerNo: string
  productCode: string
  palletCount: number
  referenceNo: string
  productName: string
  productNameEn: string
  hsCode: string
  cartonCount: number
  quantity: number
  unit: string
  unitPrice: number
  totalValue: number
  grossWeight: number
  netWeight: number
  material: string
  materialEn: string
  productImage: string
  loadingPosition: string
  dutyRate: number
  estimatedDuty: number
  error?: string
}

export default function DocumentImport() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewItem[]>([])
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // 提单选择相关状态（必选）
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [selectedBill, setSelectedBill] = useState<BillOfLading | null>(null)
  const [billSearch, setBillSearch] = useState('')
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [loadingBills, setLoadingBills] = useState(false)
  
  // 客户选择相关状态
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  
  // 进口商税号相关状态
  const [customerTaxNumbers, setCustomerTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [selectedTaxNumber, setSelectedTaxNumber] = useState<CustomerTaxNumber | null>(null)
  const [loadingTaxNumbers, setLoadingTaxNumbers] = useState(false)
  
  // 发货方信息（从提单自动获取）
  const [shipperInfo, setShipperInfo] = useState({
    name: '',
    address: '',
    contact: ''
  })

  useEffect(() => {
    loadImports()
    loadBills()
    loadCustomers()
  }, [page])
  
  // 当选择提单后，自动填充发货方信息
  useEffect(() => {
    if (selectedBill) {
      // 解析shipper字段：第一行为名称，后续行为地址
      const shipperText = selectedBill.shipper || ''
      const shipperLines = shipperText.split('\n').filter(line => line.trim())
      setShipperInfo({
        name: shipperLines[0] || '',
        address: shipperLines.slice(1).join(', ') || '',
        contact: ''
      })
    }
  }, [selectedBill])
  
  // 加载提单列表
  const loadBills = async () => {
    setLoadingBills(true)
    try {
      const response = await getBillsList({ pageSize: 100 })
      if (response.errCode === 200) {
        setBills(response.data?.list || [])
      }
    } catch (error) {
      console.error('加载提单列表失败:', error)
    } finally {
      setLoadingBills(false)
    }
  }
  
  // 过滤提单
  const filteredBills = bills.filter(b => 
    b.billNumber?.toLowerCase().includes(billSearch.toLowerCase()) ||
    b.containerNumber?.toLowerCase().includes(billSearch.toLowerCase()) ||
    b.companyName?.toLowerCase().includes(billSearch.toLowerCase()) ||
    b.customerName?.toLowerCase().includes(billSearch.toLowerCase()) ||
    b.orderNumber?.toLowerCase().includes(billSearch.toLowerCase())
  )
  
  // 当选择客户后加载该客户的税号
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerTaxNumbers(selectedCustomer.id)
    } else {
      setCustomerTaxNumbers([])
      setSelectedTaxNumber(null)
    }
  }, [selectedCustomer])
  
  // 加载客户列表
  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await getCustomers({ pageSize: 100 })
      if (response.errCode === 200) {
        setCustomers(response.data?.list || [])
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }
  
  // 加载客户税号
  const loadCustomerTaxNumbers = async (customerId: string) => {
    setLoadingTaxNumbers(true)
    try {
      const response = await getCustomerTaxNumbers(customerId)
      if (response.errCode === 200) {
        setCustomerTaxNumbers(response.data || [])
        // 自动选择默认税号
        const defaultTax = response.data?.find((t: CustomerTaxNumber) => t.isDefault)
        if (defaultTax) {
          setSelectedTaxNumber(defaultTax)
        }
      }
    } catch (error) {
      console.error('加载客户税号失败:', error)
    } finally {
      setLoadingTaxNumbers(false)
    }
  }
  
  // 过滤客户
  const filteredCustomers = customers.filter(c => 
    c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const loadImports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports?page=${page}&pageSize=${pageSize}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setImports(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载导入记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    // 生成CSV模板 - 按系统字段排序
    const headers = [
      '序列号*',           // serialNo
      '柜号*',             // containerNo
      '客户名称',          // customerName
      '提单号',            // billNumber
      '中文品名*',         // productName
      '英文商品品名*',     // productNameEn
      'HS编码*',           // customerHsCode
      '商品箱数CTNS*',     // cartonCount
      '商品总件数PCS*',    // quantity
      '商品申报单价*',     // unitPrice
      '商品申报总价*',     // totalValue
      '商品毛重*',         // grossWeight
      '商品净重*',         // netWeight
      '中文材质*',         // material
      '英文材质*',         // materialEn
      '原产国',            // originCountry
      '托盘件数*',         // palletCount
      '唛头*',             // referenceNo
      '装柜位置'           // loadingPosition
    ]
    const sampleData = [
      '1',                          // 序列号
      'CMAU4786361',                // 柜号
      '深圳电子科技有限公司',        // 客户名称
      'OOLU3456789012',             // 提单号
      '开沟机',                      // 中文品名
      'Trenching machine',          // 英文品名
      '8432800000',                 // HS编码
      '2',                          // 箱数
      '500',                        // 件数
      '1000',                       // 单价
      '500000',                     // 总价
      '700.00',                     // 毛重
      '630.00',                     // 净重
      '铁',                          // 中文材质
      'iron',                       // 英文材质
      'CN',                         // 原产国
      '1',                          // 托盘件数
      'MH-001',                     // 唛头
      'A区'                         // 装柜位置
    ]

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '货物导入模板.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件类型
    const validTypes = ['.csv', '.xlsx', '.xls']
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(fileExt)) {
      alert('请上传 CSV 或 Excel 文件')
      return
    }

    setPreviewFile(file)
    
    // 解析文件预览
    if (fileExt === '.csv') {
      await parseCSV(file)
    } else {
      // 对于Excel文件，发送到后端解析
      await parseExcel(file)
    }
  }

  const parseCSV = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      alert('文件内容为空或格式不正确')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const items: PreviewItem[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const item: PreviewItem = {
        rowNo: i,
        containerNo: values[0] || '',
        billNumber: values[1] || '',
        productName: values[2] || '',
        productNameEn: values[3] || '',
        hsCode: values[4] || '',
        quantity: parseFloat(values[5]) || 0,
        unit: values[6] || '',
        unitPrice: parseFloat(values[7]) || 0,
        totalValue: parseFloat(values[8]) || 0,
        grossWeight: parseFloat(values[9]) || 0,
        netWeight: parseFloat(values[10]) || 0,
        originCountry: values[11] || '',
        material: values[12] || ''
      }

      // 校验必填项
      const errors: string[] = []
      if (!item.containerNo) errors.push('柜号必填')
      if (!item.productName) errors.push('商品名称必填')
      if (!item.quantity || item.quantity <= 0) errors.push('数量必须大于0')
      if (!item.unit) errors.push('单位必填')
      if (!item.unitPrice || item.unitPrice <= 0) errors.push('单价必须大于0')
      if (!item.grossWeight || item.grossWeight <= 0) errors.push('毛重必须大于0')
      if (!item.originCountry) errors.push('原产国必填')
      
      if (errors.length > 0) {
        item.error = errors.join('; ')
      }

      items.push(item)
    }

    setPreviewData(items)
    setShowPreview(true)
  }

  const parseExcel = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('preview', 'true')

    setUploading(true) // 显示加载状态
    
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/preview`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setPreviewData(data.data?.items || [])
        setShowPreview(true)
      } else {
        alert(data.msg || '解析文件失败')
      }
    } catch (error) {
      console.error('解析文件失败:', error)
      alert('解析文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setUploading(false) // 隐藏加载状态
    }
  }

  const handleConfirmImport = async () => {
    if (!previewFile) return
    
    // 验证必须选择提单
    if (!selectedBill) {
      alert('请先选择要绑定的提单')
      return
    }

    const hasErrors = previewData.some(item => item.error)
    if (hasErrors) {
      if (!confirm('部分数据存在错误，是否仍要继续导入？错误数据将被跳过。')) {
        return
      }
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', previewFile)
    // 添加提单信息
    formData.append('billId', selectedBill.id)
    formData.append('billNumber', selectedBill.billNumber || '')
    formData.append('containerNo', selectedBill.containerNumber || '')
    formData.append('customerName', selectedBill.companyName || selectedBill.customerName || '')

    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.errCode === 200) {
        const importId = data.data?.importId

        // 更新发货方和进口商信息
        if (importId) {
          try {
            await fetch(`${API_BASE}/api/cargo/documents/imports/${importId}/shipper-importer`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                // 发货方信息（从提单获取）
                shipperName: shipperInfo.name || null,
                shipperAddress: shipperInfo.address || null,
                shipperContact: shipperInfo.contact || null,
                // 进口商信息
                importerCustomerId: selectedCustomer?.id || null,
                importerName: selectedCustomer?.companyName || selectedCustomer?.customerName || null,
                importerTaxId: selectedTaxNumber?.id || null,
                importerTaxNumber: selectedTaxNumber?.taxNumber || null,
                importerTaxType: selectedTaxNumber?.taxType || null,
                importerCountry: selectedTaxNumber?.country || null,
                importerCompanyName: selectedTaxNumber?.companyName || null,
                importerAddress: selectedTaxNumber?.companyAddress || null
              })
            })
          } catch (updateError) {
            console.error('更新发货方和进口商信息失败:', updateError)
          }
        }

        alert(`导入成功！共导入 ${data.data?.importedCount || 0} 条记录，已绑定提单: ${selectedBill.billNumber}`)
        setShowPreview(false)
        setPreviewData([])
        setPreviewFile(null)
        // 清空提单、发货方和进口商信息
        setSelectedBill(null)
        setShipperInfo({ name: '', address: '', contact: '' })
        setSelectedCustomer(null)
        setSelectedTaxNumber(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        loadImports()
      } else {
        alert(data.msg || '导入失败')
      }
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPreviewData([])
    setPreviewFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此导入记录吗？相关的货物数据也将被删除。')) return

    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadImports()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      matching: 'bg-blue-100 text-blue-700',
      reviewing: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700'
    }
    const labels: Record<string, string> = {
      pending: '待处理',
      matching: '匹配中',
      reviewing: '待审核',
      confirmed: '已确认',
      completed: '已完成'
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    )
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
  ]

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/import"
        onTabChange={(path) => navigate(path)}
      />

      {/* 导入区域 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">导入货物清单</h3>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded"
          >
            <Download className="w-3.5 h-3.5" />
            下载模板
          </button>
        </div>
        
        {/* 提单选择（必选） */}
        <div className="mb-4 p-3 border border-primary-200 bg-primary-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Ship className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-gray-900">绑定提单</span>
            <span className="text-xs text-red-500">* 必选</span>
          </div>
          <div className="relative">
            <div 
              className={`w-full px-3 py-2 border rounded text-sm bg-white cursor-pointer flex items-center justify-between ${
                selectedBill ? 'border-green-400' : 'border-gray-300'
              }`}
              onClick={() => setShowBillDropdown(!showBillDropdown)}
            >
              {selectedBill ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-gray-900 font-medium">{selectedBill.billNumber}</span>
                  {selectedBill.orderNumber && (
                    <span className="text-blue-600 text-xs">({selectedBill.orderNumber})</span>
                  )}
                  {selectedBill.containerNumber && (
                    <span className="text-gray-500">| 柜号: {selectedBill.containerNumber}</span>
                  )}
                  {(selectedBill.companyName || selectedBill.customerName) && (
                    <span className="text-gray-400 text-xs">({selectedBill.companyName || selectedBill.customerName})</span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">请选择要绑定的提单...</span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            {showBillDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                  <input
                    type="text"
                    value={billSearch}
                    onChange={(e) => setBillSearch(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                    placeholder="搜索提单号/柜号/客户名..."
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {loadingBills ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1" />
                    加载中...
                  </div>
                ) : filteredBills.length === 0 ? (
                  <div className="p-4 text-center">
                    <Ship className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">
                      {bills.length === 0 ? '系统中暂无提单，请先创建提单' : '无匹配提单'}
                    </p>
                  </div>
                ) : (
                  filteredBills.map(bill => (
                    <div
                      key={bill.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${
                        selectedBill?.id === bill.id ? 'bg-primary-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedBill(bill)
                        setShowBillDropdown(false)
                        setBillSearch('')
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{bill.billNumber}</span>
                          {bill.orderNumber && (
                            <span className="text-xs text-blue-600 ml-1">({bill.orderNumber})</span>
                          )}
                          {bill.containerNumber && (
                            <span className="text-xs text-gray-500 ml-2">柜号: {bill.containerNumber}</span>
                          )}
                        </div>
                        {selectedBill?.id === bill.id && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {bill.companyName || bill.customerName || '未关联客户'}
                        {bill.shipper && ` | 发货人: ${bill.shipper.split('\n')[0]}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {bills.length === 0 && !loadingBills && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ⚠️ 系统中暂无提单，请先在"订单管理"中创建提单后再导入货物清单
            </div>
          )}
        </div>
        
        {/* 发货方和进口商信息 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* 发货方信息（从提单自动获取） */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">发货方信息</span>
              <span className="text-xs text-gray-400">(从提单获取)</span>
            </div>
            {selectedBill ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">发货方名称</label>
                  <div className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-700">
                    {shipperInfo.name || '-'}
                  </div>
                </div>
                {shipperInfo.address && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">地址</label>
                    <div className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-700">
                      {shipperInfo.address}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <User className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">请先选择提单</p>
              </div>
            )}
          </div>
          
          {/* 进口商信息 */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Building className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">进口商信息</span>
              <span className="text-xs text-gray-400">(关联客户税号)</span>
            </div>
            <div className="space-y-2">
              {/* 客户选择 */}
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">选择客户</label>
                <div 
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white cursor-pointer flex items-center justify-between"
                  onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                >
                  <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedCustomer ? (selectedCustomer.companyName || selectedCustomer.customerName) : '请选择客户'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </div>
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                        placeholder="搜索客户..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {loadingCustomers ? (
                      <div className="p-3 text-center text-xs text-gray-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1" />
                        加载中...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">无匹配客户</div>
                    ) : (
                      filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${
                            selectedCustomer?.id === customer.id ? 'bg-primary-50 text-primary-700' : ''
                          }`}
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowCustomerDropdown(false)
                            setCustomerSearch('')
                          }}
                        >
                          <div className="font-medium">{customer.companyName || customer.customerName}</div>
                          <div className="text-gray-400">{customer.customerCode}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              {/* 税号选择 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">进口商税号</label>
                {!selectedCustomer ? (
                  <div className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-400">
                    请先选择客户
                  </div>
                ) : loadingTaxNumbers ? (
                  <div className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-400">
                    <RefreshCw className="w-3 h-3 animate-spin inline-block mr-1" />
                    加载税号中...
                  </div>
                ) : customerTaxNumbers.length === 0 ? (
                  <div className="w-full px-2 py-1.5 border border-amber-200 rounded text-xs bg-amber-50 text-amber-600">
                    该客户暂无税号，请在CRM客户管理中添加
                  </div>
                ) : (
                  <select
                    value={selectedTaxNumber?.id || ''}
                    onChange={(e) => {
                      const tax = customerTaxNumbers.find(t => t.id === e.target.value)
                      setSelectedTaxNumber(tax || null)
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    title="选择进口商税号"
                  >
                    <option value="">请选择税号</option>
                    {/* 按公司名称分组，每个公司显示一行 */}
                    {(() => {
                      const grouped = customerTaxNumbers.reduce((acc, tax) => {
                        const key = tax.companyName || '未命名公司'
                        if (!acc[key]) {
                          acc[key] = { companyName: key, taxes: [], defaultTax: null }
                        }
                        acc[key].taxes.push(tax)
                        if (tax.isDefault) {
                          acc[key].defaultTax = tax
                        }
                        return acc
                      }, {} as Record<string, { companyName: string; taxes: CustomerTaxNumber[]; defaultTax: CustomerTaxNumber | null }>)
                      
                      return Object.values(grouped).map(group => {
                        // 优先使用默认税号，否则使用第一个税号
                        const primaryTax = group.defaultTax || group.taxes[0]
                        // 显示所有税号类型
                        const taxTypes = group.taxes.map(t => t.taxType?.toUpperCase()).join('/')
                        return (
                          <option key={primaryTax.id} value={primaryTax.id}>
                            {group.companyName} ({taxTypes})
                          </option>
                        )
                      })
                    })()}
                  </select>
                )}
              </div>
              
              {/* 显示选中的税号详情 */}
              {selectedTaxNumber && (
                <div className="p-2 bg-green-50 rounded text-xs text-green-700">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-medium">{selectedTaxNumber.taxType?.toUpperCase()}</span>
                    <span className="font-mono">{selectedTaxNumber.taxNumber}</span>
                    {selectedTaxNumber.isVerified && (
                      <Check className="w-3 h-3 text-green-600" />
                    )}
                  </div>
                  {selectedTaxNumber.companyName && (
                    <div className="text-green-600">{selectedTaxNumber.companyName}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            !selectedBill
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : uploading 
                ? 'border-primary-400 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-400 cursor-pointer'
          }`}
          onClick={() => selectedBill && !uploading && fileInputRef.current?.click()}
        >
          {!selectedBill ? (
            <>
              <Ship className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-1">请先选择要绑定的提单</p>
              <p className="text-xs text-gray-300">选择提单后才能上传货物清单</p>
            </>
          ) : uploading ? (
            <>
              <RefreshCw className="w-12 h-12 text-primary-500 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-primary-600 mb-1">正在解析文件...</p>
              <p className="text-xs text-primary-400">请稍候，正在读取数据和图片</p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-1">点击或拖拽文件到此处上传</p>
              <p className="text-xs text-gray-400">支持 CSV, Excel (.xlsx, .xls) 格式</p>
              <p className="text-xs text-green-600 mt-2">
                已选择提单: {selectedBill.billNumber}
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            title="选择文件"
            disabled={uploading || !selectedBill}
          />
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
          <p className="font-medium mb-1">模板说明：</p>
          <ul className="space-y-0.5 text-blue-600">
            <li>• 必填字段：柜号、中文品名/英文品名(至少一个)、数量/箱数(至少一个)、申报单价/总价(至少一个)、毛重</li>
            <li>• 可选字段：箱产品号、托盘件数、提头、HS编码、净重、材质、装柜位置、税率、预估关税</li>
            <li>• 支持Excel(.xlsx/.xls)和CSV格式，建议使用Excel格式</li>
          </ul>
        </div>
      </div>

      {/* 预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">数据预览</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  共 {previewData.length} 条记录
                  {previewData.filter(i => i.error).length > 0 && (
                    <span className="text-red-500 ml-2">
                      （{previewData.filter(i => i.error).length} 条有错误）
                    </span>
                  )}
                </p>
              </div>
              <button onClick={handleCancelPreview} className="p-1 hover:bg-gray-100 rounded" title="关闭预览">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">行号</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">柜号</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 whitespace-nowrap">图片</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">中文品名</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">英文品名</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">HS编码</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 whitespace-nowrap">箱数</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 whitespace-nowrap">件数</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 whitespace-nowrap">单价</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 whitespace-nowrap">总价</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500 whitespace-nowrap">毛重</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">材质</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item) => (
                    <tr 
                      key={item.rowNo} 
                      className={`border-b ${item.error ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-2 py-2 text-gray-500">{item.rowNo}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{item.containerNo}</td>
                      <td className="px-2 py-2 text-center">
                        {item.productImage ? (
                          <img 
                            src={`${API_BASE}${item.productImage}`} 
                            alt="产品图片" 
                            className="w-10 h-10 object-cover rounded border border-gray-200 mx-auto"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 max-w-[100px] truncate" title={item.productName}>
                        {item.productName || '-'}
                      </td>
                      <td className="px-2 py-2 max-w-[100px] truncate" title={item.productNameEn}>
                        {item.productNameEn || '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{item.hsCode || '-'}</td>
                      <td className="px-2 py-2 text-right">{item.cartonCount || '-'}</td>
                      <td className="px-2 py-2 text-right">{item.quantity || '-'}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">€{(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">€{(item.totalValue || 0).toFixed(2)}</td>
                      <td className="px-2 py-2 text-right">{item.grossWeight || '-'}</td>
                      <td className="px-2 py-2 max-w-[60px] truncate" title={item.material}>
                        {item.material || '-'}
                      </td>
                      <td className="px-2 py-2">
                        {item.error ? (
                          <span className="flex items-center gap-1 text-red-600 whitespace-nowrap" title={item.error}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            错误
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5" />
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={uploading}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                {uploading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {uploading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入记录列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">导入记录</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">批次号</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap min-w-[80px]">客户</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">柜号</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap min-w-[120px]">提单号</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">商品数</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">匹配进度</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">状态</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">导入时间</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : imports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    暂无导入记录
                  </td>
                </tr>
              ) : (
                imports.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-primary-600 whitespace-nowrap">{item.importNo}</td>
                    <td className="px-3 py-2 max-w-[100px] truncate" title={item.customerName || '-'}>{item.customerName || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.containerNo || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.billNumber || '-'}</td>
                    <td className="px-3 py-2 text-center">{item.totalItems}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${item.totalItems > 0 ? (item.matchedItems / item.totalItems) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-gray-500">{item.matchedItems}/{item.totalItems}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(item.status)}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/documents/matching?importId=${item.id}`)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
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

        {/* 分页 */}
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              共 {total} 条，第 {page}/{totalPages} 页
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
