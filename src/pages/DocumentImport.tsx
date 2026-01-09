import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, Upload, Download, FileSpreadsheet, 
  Check, X, AlertTriangle, RefreshCw, Trash2, Eye, User, Building, 
  ChevronDown, Ship, FileText, Plus, ChevronRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders, getCustomers, getCustomerTaxNumbers, getBillsList, type Customer, type CustomerTaxNumber, type BillOfLading } from '../utils/api'
import { formatDateTime } from '../utils/dateFormat'
import { useImport, type ImportTask, type PreviewItem } from '../contexts/ImportContext'

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

// 任务卡片组件
function TaskCard({ 
  task, 
  onUploadFile, 
  onShowPreview, 
  onConfirmImport,
  onDelete,
  onUpdateTask,
  bills: initialBills,
  loadingBills: initialLoadingBills,
  customers,
  loadingCustomers,
}: {
  task: ImportTask
  onUploadFile: (taskId: string, file: File) => void
  onShowPreview: (taskId: string) => void
  onConfirmImport: (taskId: string) => void
  onDelete: (taskId: string) => void
  onUpdateTask: (taskId: string, updates: Partial<ImportTask>) => void
  bills: BillOfLading[]
  loadingBills: boolean
  customers: Customer[]
  loadingCustomers: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [billSearch, setBillSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerTaxNumbers, setCustomerTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [loadingTaxNumbers, setLoadingTaxNumbers] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  
  // 本地提单列表和加载状态（支持服务端搜索）
  const [localBills, setLocalBills] = useState<BillOfLading[]>(initialBills)
  const [localLoadingBills, setLocalLoadingBills] = useState(false)

  // 当初始提单变化时更新本地列表
  useEffect(() => {
    if (!billSearch.trim()) {
      setLocalBills(initialBills)
    }
  }, [initialBills, billSearch])

  // 搜索提单（服务端搜索，防抖）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (billSearch.trim()) {
        setLocalLoadingBills(true)
        try {
          const response = await getBillsList({ 
            pageSize: 100,
            search: billSearch.trim()
          })
          if (response.errCode === 200) {
            setLocalBills(response.data?.list || [])
          }
        } catch (error) {
          console.error('搜索提单失败:', error)
        } finally {
          setLocalLoadingBills(false)
        }
      } else {
        setLocalBills(initialBills)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [billSearch, initialBills])

  // 使用本地状态
  const filteredBills = localBills
  const loadingBills = localLoadingBills || initialLoadingBills

  // 过滤客户
  const filteredCustomers = customers.filter(c => 
    c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // 加载客户税号
  const loadCustomerTaxNumbers = async (customerId: string) => {
    setLoadingTaxNumbers(true)
    try {
      const response = await getCustomerTaxNumbers(customerId)
      if (response.errCode === 200) {
        setCustomerTaxNumbers(response.data || [])
        const defaultTax = response.data?.find((t: CustomerTaxNumber) => t.isDefault)
        if (defaultTax) {
          onUpdateTask(task.id, { selectedTaxNumber: defaultTax })
        }
      }
    } catch (error) {
      console.error('加载客户税号失败:', error)
    } finally {
      setLoadingTaxNumbers(false)
    }
  }

  // 当选择客户后加载税号
  useEffect(() => {
    if (task.selectedCustomer) {
      loadCustomerTaxNumbers(task.selectedCustomer.id)
    } else {
      setCustomerTaxNumbers([])
    }
  }, [task.selectedCustomer?.id])

  // 当选择提单后自动填充发货方信息
  useEffect(() => {
    if (task.selectedBill) {
      const shipperText = task.selectedBill.shipper || ''
      const shipperLines = shipperText.split('\n').filter(line => line.trim())
      onUpdateTask(task.id, {
        shipperInfo: {
          name: shipperLines[0] || '',
          address: shipperLines.slice(1).join(', ') || '',
          contact: ''
        }
      })
    }
  }, [task.selectedBill?.id])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['.csv', '.xlsx', '.xls']
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(fileExt)) {
      alert('请上传 CSV 或 Excel 文件')
      return
    }

    onUploadFile(task.id, file)
  }

  const getStatusBadge = () => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      parsing: 'bg-blue-100 text-blue-700',
      preview: 'bg-amber-100 text-amber-700',
      importing: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700'
    }
    const labels: Record<string, string> = {
      pending: '待上传',
      parsing: '解析中',
      preview: '待确认',
      importing: '导入中',
      completed: '已完成',
      error: '失败'
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${styles[task.status]}`}>
        {labels[task.status]}
      </span>
    )
  }

  const isProcessing = task.status === 'parsing' || task.status === 'importing'

  return (
    <div className={`border rounded-lg ${
      task.status === 'error' ? 'border-red-200 bg-red-50' :
      task.status === 'completed' ? 'border-green-200 bg-green-50' :
      isProcessing ? 'border-blue-200 bg-blue-50' :
      'border-gray-200 bg-white'
    }`}>
      {/* 任务头部 */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          <div className="flex items-center gap-2">
            {isProcessing && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
            <span className="text-sm font-medium text-gray-900">
              {task.selectedBill?.billNumber || '未选择提单'}
            </span>
            {task.selectedBill?.containerNumber && (
              <span className="text-xs text-gray-500">| 柜号: {task.selectedBill.containerNumber}</span>
            )}
          </div>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {task.fileName && (
            <span className="text-xs text-gray-500 max-w-[150px] truncate">
              {task.fileName}
            </span>
          )}
          {!isProcessing && task.status !== 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task.id)
              }}
              className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
              title="删除任务"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 任务详情 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 overflow-visible">
          {/* 进度/错误信息 */}
          {task.progress && (
            <div className="mt-3 px-3 py-2 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {task.progress}
            </div>
          )}
          {task.error && (
            <div className="mt-3 px-3 py-2 bg-red-50 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {task.error}
            </div>
          )}
          {task.status === 'completed' && (
            <div className="mt-3 px-3 py-2 bg-green-50 rounded text-xs text-green-700 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              {task.progress || '导入成功'}
            </div>
          )}

          {/* 提单选择 */}
          {task.status === 'pending' && (
            <div className="mt-3 relative z-30">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Ship className="w-3.5 h-3.5 inline mr-1" />
                绑定提单 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div 
                  className={`w-full px-3 py-2 border rounded text-sm bg-white cursor-pointer flex items-center justify-between ${
                    task.selectedBill ? 'border-green-400' : 'border-gray-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowBillDropdown(!showBillDropdown)
                  }}
                >
                  {task.selectedBill ? (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-gray-900 font-medium">{task.selectedBill.billNumber}</span>
                      {task.selectedBill.orderNumber && (
                        <span className="text-blue-600 text-xs">({task.selectedBill.orderNumber})</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">请选择要绑定的提单...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                {showBillDropdown && (
                  <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto">
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
                      <div className="p-3 text-center text-xs text-gray-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1" />
                        加载中...
                      </div>
                    ) : filteredBills.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">无匹配提单</div>
                    ) : (
                      filteredBills.map(bill => (
                        <div
                          key={bill.id}
                          className={`px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${
                            task.selectedBill?.id === bill.id ? 'bg-primary-50' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateTask(task.id, { selectedBill: bill })
                            setShowBillDropdown(false)
                            setBillSearch('')
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{bill.billNumber}</span>
                              {bill.containerNumber && (
                                <span className="text-xs text-gray-500 ml-2">柜号: {bill.containerNumber}</span>
                              )}
                            </div>
                            {task.selectedBill?.id === bill.id && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {bill.companyName || bill.customerName || '未关联客户'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 发货方和进口商信息（折叠） */}
          {task.status === 'pending' && task.selectedBill && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* 发货方信息 */}
              <div className="border border-gray-200 rounded p-2">
                <div className="flex items-center gap-1 mb-2">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">发货方信息</span>
                </div>
                <input
                  type="text"
                  value={task.shipperInfo.name}
                  onChange={(e) => onUpdateTask(task.id, { 
                    shipperInfo: { ...task.shipperInfo, name: e.target.value }
                  })}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs mb-1"
                  placeholder="发货方名称"
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="text"
                  value={task.shipperInfo.address}
                  onChange={(e) => onUpdateTask(task.id, { 
                    shipperInfo: { ...task.shipperInfo, address: e.target.value }
                  })}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                  placeholder="地址"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* 进口商信息 */}
              <div className="border border-gray-200 rounded p-2">
                <div className="flex items-center gap-1 mb-2">
                  <Building className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-gray-700">进口商信息</span>
                </div>
                <div className="relative mb-1">
                  <div 
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white cursor-pointer flex items-center justify-between"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCustomerDropdown(!showCustomerDropdown)
                    }}
                  >
                    <span className={task.selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                      {task.selectedCustomer ? (task.selectedCustomer.companyName || task.selectedCustomer.customerName) : '选择客户'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </div>
                  {showCustomerDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      <div className="p-1 border-b border-gray-100">
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
                        <div className="p-2 text-center text-xs text-gray-400">加载中...</div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="p-2 text-center text-xs text-gray-400">无匹配客户</div>
                      ) : (
                        filteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            className="px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              onUpdateTask(task.id, { selectedCustomer: customer, selectedTaxNumber: null })
                              setShowCustomerDropdown(false)
                              setCustomerSearch('')
                            }}
                          >
                            {customer.companyName || customer.customerName}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {task.selectedCustomer && (
                  <select
                    value={task.selectedTaxNumber?.id || ''}
                    onChange={(e) => {
                      const tax = customerTaxNumbers.find(t => String(t.id) === e.target.value)
                      onUpdateTask(task.id, { selectedTaxNumber: tax || null })
                    }}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                    onClick={(e) => e.stopPropagation()}
                    title="选择税号"
                  >
                    <option value="">选择税号</option>
                    {customerTaxNumbers.map(tax => (
                      <option key={tax.id} value={tax.id}>
                        {tax.companyName} ({tax.taxType?.toUpperCase()})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* 文件上传区域 */}
          {task.status === 'pending' && task.selectedBill && (
            <div className="mt-3">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-400 cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-500">点击上传文件</p>
                <p className="text-[10px] text-gray-400">支持 CSV, Excel 格式</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                title="选择文件"
              />
            </div>
          )}

          {/* 预览/确认导入按钮 */}
          {task.status === 'preview' && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowPreview(task.id)
                }}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                查看预览 ({task.previewData.length}条)
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onConfirmImport(task.id)
                }}
                className="flex-1 px-3 py-2 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                确认导入
              </button>
            </div>
          )}

          {/* 错误状态重试 */}
          {task.status === 'error' && task.file && (
            <div className="mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (task.file) {
                    onUploadFile(task.id, task.file)
                  }
                }}
                className="w-full px-3 py-2 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重试
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocumentImport() {
  const navigate = useNavigate()
  const { 
    state: importState, 
    addTask,
    updateTask,
    removeTask,
    setActiveTask,
    startParsing,
    confirmImport,
  } = useImport()
  
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  
  // 提单和客户数据
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // 预览弹窗
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null)

  useEffect(() => {
    loadImports()
    loadBills()
    loadCustomers()
  }, [page])

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
    const metaRow = ['集装箱号', 'ECMU1234567']
    const headers = [
      '序号*', '客户单号*', '托盘件数*', '唛头*', '英文品名*', 'HS编码*',
      '商品箱数CTNS*', '商品件数PCS*', '申报单价*', '申报总价*', '总毛重KG*',
      '总净重KG*', '单件净重*', '中文品名*', '产品图片*', '中文材质*', '英文材质*',
      '税率', '预估关税'
    ]
    const sampleData = [
      '1', '5881234', '2', '5881234-1', 'Tea table', '9403609000',
      '2', '3', '150', '450', '32.5', '29.25', '9.75', '茶几桌', '', '复合板',
      'Composite board', '', ''
    ]

    const csvContent = [metaRow.join(','), headers.join(','), sampleData.join(',')].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '货物明细模板.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAddTask = () => {
    addTask()
  }

  const handleUploadFile = async (taskId: string, file: File) => {
    await startParsing(taskId, file)
  }

  const handleShowPreview = (taskId: string) => {
    setPreviewTaskId(taskId)
    setShowPreviewModal(true)
  }

  const handleConfirmImport = async (taskId: string) => {
    const task = importState.tasks.find(t => t.id === taskId)
    if (!task) return

    const hasErrors = task.previewData.some(item => item.error)
    if (hasErrors) {
      if (!confirm('部分数据存在错误，是否仍要继续导入？错误数据将被跳过。')) {
        return
      }
    }

    const success = await confirmImport(taskId)
    if (success) {
      // 导入成功后，延迟2秒移除任务（让用户看到成功提示）
      setTimeout(() => {
        removeTask(taskId)
      }, 2000)
      loadImports()
    }
  }

  const handleDeleteTask = (taskId: string) => {
    if (confirm('确定要删除此导入任务吗？')) {
      removeTask(taskId)
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
    { label: '匹配记录库', path: '/documents/match-records' },
    { label: '敏感产品库', path: '/documents/sensitive-products' },
  ]

  const totalPages = Math.ceil(total / pageSize)
  const previewTask = previewTaskId ? importState.tasks.find(t => t.id === previewTaskId) : null

  // 统计任务状态
  const taskStats = {
    total: importState.tasks.length,
    pending: importState.tasks.filter(t => t.status === 'pending').length,
    processing: importState.tasks.filter(t => t.status === 'parsing' || t.status === 'importing').length,
    preview: importState.tasks.filter(t => t.status === 'preview').length,
    completed: importState.tasks.filter(t => t.status === 'completed').length,
    error: importState.tasks.filter(t => t.status === 'error').length,
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/import"
        onTabChange={(path) => navigate(path)}
      />

      {/* 导入任务区域 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-visible">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-900">导入货物清单</h3>
            {taskStats.total > 0 && (
              <div className="flex items-center gap-2 text-xs">
                {taskStats.processing > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {taskStats.processing} 处理中
                  </span>
                )}
                {taskStats.preview > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                    {taskStats.preview} 待确认
                  </span>
                )}
                {taskStats.error > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                    {taskStats.error} 失败
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded"
            >
              <Download className="w-3.5 h-3.5" />
              下载模板
            </button>
            <button
              onClick={handleAddTask}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white hover:bg-primary-700 rounded"
            >
              <Plus className="w-3.5 h-3.5" />
              添加任务
            </button>
          </div>
        </div>

        {/* 任务列表 */}
        {importState.tasks.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">暂无导入任务</p>
            <p className="text-xs text-gray-400 mb-4">点击"添加任务"创建新的导入任务，支持多个任务并行处理</p>
            <button
              onClick={handleAddTask}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded"
            >
              <Plus className="w-4 h-4" />
              添加第一个任务
            </button>
          </div>
        ) : (
          <div className="space-y-3 overflow-visible">
            {importState.tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onUploadFile={handleUploadFile}
                onShowPreview={handleShowPreview}
                onConfirmImport={handleConfirmImport}
                onDelete={handleDeleteTask}
                onUpdateTask={updateTask}
                bills={bills}
                loadingBills={loadingBills}
                customers={customers}
                loadingCustomers={loadingCustomers}
              />
            ))}
          </div>
        )}

        {/* 模板说明 */}
        <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
          <p className="font-medium mb-1">使用说明：</p>
          <ul className="space-y-0.5 text-blue-600">
            <li>• 点击"添加任务"可创建多个导入任务，支持<span className="font-medium">并行处理</span></li>
            <li>• 每个任务需要先选择提单，然后上传文件</li>
            <li>• 文件解析和确认导入都可以同时进行多个</li>
            <li>• 右下角会显示当前处理进度，可以切换到其他页面</li>
          </ul>
        </div>
      </div>

      {/* 预览弹窗 */}
      {showPreviewModal && previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  数据预览 - {previewTask.selectedBill?.billNumber}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  共 {previewTask.previewData.length} 条记录
                  {previewTask.previewData.filter(i => i.error).length > 0 && (
                    <span className="text-red-500 ml-2">
                      （{previewTask.previewData.filter(i => i.error).length} 条有错误）
                    </span>
                  )}
                </p>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)} 
                className="p-1 hover:bg-gray-100 rounded" 
                title="关闭预览"
              >
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
                  {previewTask.previewData.map((item) => (
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
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false)
                  handleConfirmImport(previewTask.id)
                }}
                disabled={previewTask.status === 'importing'}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                {previewTask.status === 'importing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                {previewTask.status === 'importing' ? '导入中...' : '确认导入'}
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
                      {item.createdAt ? formatDateTime(item.createdAt) : '-'}
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
