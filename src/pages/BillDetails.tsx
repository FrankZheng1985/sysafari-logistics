import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Package, Download, ClipboardCheck, Truck, Ban, RotateCcw, Settings, CheckCircle, Ship, Anchor, GripVertical, ChevronUp, ChevronDown, ShieldCheck, Activity, Upload, Trash2, File, Image, FileArchive, Loader2, UserCircle, ExternalLink, DollarSign, Receipt, Plus, Repeat, Clock, Calendar, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
// DataTable available if needed
import Timeline, { TimelineItem } from '../components/Timeline'
import FeeModal from '../components/FeeModal'
import { getBillById as getBillByIdFromAPI, downloadFile, updateBillInspection, updateBillDeliveryStatus, updateBillDelivery, voidBill, restoreBill, getBillOperationLogs, updateBillShipStatus, updateBillDocSwapStatus, updateBillCustomsStatus, getDestinationPortsList, getBillFiles, uploadBillFile, downloadBillFile, deleteBillFile, getFees, type OperationLog, type DestinationPortItem, type BillFile, type CMRDetailData } from '../utils/api'
import { getBillById as getBillByIdFromMock } from '../data/mockOrders'

interface Declaration {
  id: string
  declarationNumber: string
  status: string
  createTime: string
  releaseTime?: string
  fileUrl?: string
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// mockDeclarations - 保留用于开发测试
const mockDeclarations: Declaration[] = [
  {
    id: '1',
    declarationNumber: 'DEC-2025-001',
    status: '已放行',
    createTime: '2025-11-20 10:00',
    releaseTime: '2025-11-22 15:30',
  },
]

// 提取为独立组件，避免在渲染循环中重新创建
interface ModuleWrapperProps {
  children: React.ReactNode
  title: string
  icon: React.ReactNode
  iconColor: string
  moduleId: string
  isFirst: boolean
  isLast: boolean
  isDragging: boolean
  onDragStart: (moduleId: string) => void
  onDragOver: (e: React.DragEvent, moduleId: string) => void
  onDragEnd: () => void
  onMoveModule: (moduleId: string, direction: 'up' | 'down') => void
}

function ModuleWrapper({
  children,
  title,
  icon,
  iconColor,
  moduleId,
  isFirst,
  isLast,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMoveModule,
}: ModuleWrapperProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(moduleId)}
      onDragOver={(e) => onDragOver(e, moduleId)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-lg border border-gray-200 p-4 transition-all ${
        isDragging ? 'opacity-50 border-dashed border-primary-400' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          {title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveModule(moduleId, 'up')}
            disabled={isFirst}
            className={`p-1 rounded transition-colors ${
              isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="上移"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveModule(moduleId, 'down')}
            disabled={isLast}
            className={`p-1 rounded transition-colors ${
              isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="下移"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="cursor-grab text-gray-400 hover:text-gray-600 ml-1" title="拖拽排序">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function BillDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('info')
  const [billDetail, setBillDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  // 文件管理状态
  const [billFiles, setBillFiles] = useState<BillFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  // 跳港相关状态
  const [skipPortOptions, setSkipPortOptions] = useState<DestinationPortItem[]>([])
  const [selectedSkipPort, setSelectedSkipPort] = useState<string>('')
  const [skipPortInputValue, setSkipPortInputValue] = useState<string>('')
  const [showSkipPortDropdown, setShowSkipPortDropdown] = useState(false)
  const skipPortDropdownRef = useRef<HTMLDivElement>(null)
  
  // 实际到港模态窗口状态
  const [showArrivalModal, setShowArrivalModal] = useState(false)
  const [actualArrivalDate, setActualArrivalDate] = useState<string>('')
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false)
  
  // 费用管理状态
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [billFees, setBillFees] = useState<any[]>([])
  const [feesLoading, setFeesLoading] = useState(false)
  
  // 预计提货时间模态窗口状态
  const [showPickupTimeModal, setShowPickupTimeModal] = useState(false)
  const [pickupEstimatedTime, setPickupEstimatedTime] = useState('')
  const [pickupNote, setPickupNote] = useState('')
  const [pickupSubmitting, setPickupSubmitting] = useState(false)
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (skipPortDropdownRef.current && !skipPortDropdownRef.current.contains(event.target as Node)) {
        setShowSkipPortDropdown(false)
      }
    }
    
    if (showSkipPortDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSkipPortDropdown])
  
  // 过滤后的跳港选项 - 使用 useMemo 避免不必要的重新计算
  const filteredSkipPortOptions = useMemo(() => {
    return skipPortOptions.filter(port => {
      if (!skipPortInputValue) return true
      const searchText = skipPortInputValue.toLowerCase()
      return (
        port.portNameCn?.toLowerCase().includes(searchText) ||
        port.portNameEn?.toLowerCase().includes(searchText) ||
        port.portCode?.toLowerCase().includes(searchText)
      )
    })
  }, [skipPortOptions, skipPortInputValue])
  
  // 标签页排序状态
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('billDetailsTabOrder')
    const defaultOrder = ['info', 'files', 'timeline', 'actions']
    if (saved) {
      let parsed = JSON.parse(saved)
      // 移除已废弃的标签页，替换旧标签名
      parsed = parsed.filter((t: string) => t !== 'status')
      parsed = parsed.map((t: string) => t === 'declarations' ? 'files' : t)
      // 确保包含所有标签页
      if (!parsed.includes('files')) {
        parsed.splice(1, 0, 'files')
      }
      localStorage.setItem('billDetailsTabOrder', JSON.stringify(parsed))
      return parsed.length > 0 ? parsed : defaultOrder
    }
    return defaultOrder
  })
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  
  // 标签页配置
  const tabConfig: Record<string, { label: string; badge?: () => string }> = {
    info: { label: '基本信息' },
    files: { label: '文件管理', badge: () => `(${billFiles.length})` },
    timeline: { label: '时间线' },
    actions: { label: '操作' },
  }
  
  // 标签页拖拽处理
  const handleTabDragStart = (tabId: string) => {
    setDraggedTab(tabId)
  }

  const handleTabDragOver = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTab || draggedTab === targetTabId) return
    
    const newOrder = [...tabOrder]
    const draggedIndex = newOrder.indexOf(draggedTab)
    const targetIndex = newOrder.indexOf(targetTabId)
    
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedTab)
    
    setTabOrder(newOrder)
  }

  const handleTabDragEnd = () => {
    if (draggedTab) {
      localStorage.setItem('billDetailsTabOrder', JSON.stringify(tabOrder))
    }
    setDraggedTab(null)
  }
  
  // 操作模块排序状态
  const [moduleOrder, setModuleOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('billDetailsModuleOrder')
    const defaultOrder = ['ship', 'doc_swap', 'customs', 'inspection', 'delivery', 'finance', 'order']
    if (saved) {
      const parsed = JSON.parse(saved)
      // 确保包含所有模块（兼容旧数据），添加 doc_swap
      if (!parsed.includes('doc_swap')) {
        const shipIndex = parsed.indexOf('ship')
        if (shipIndex !== -1) {
          parsed.splice(shipIndex + 1, 0, 'doc_swap')
        } else {
          parsed.unshift('doc_swap')
        }
      }
      if (!parsed.includes('customs')) {
        parsed.splice(1, 0, 'customs') // 在inspection后面插入customs
        localStorage.setItem('billDetailsModuleOrder', JSON.stringify(parsed))
      }
      if (!parsed.includes('finance')) {
        parsed.splice(4, 0, 'finance') // 在delivery后面插入finance
        localStorage.setItem('billDetailsModuleOrder', JSON.stringify(parsed))
      }
      return parsed
    }
    return defaultOrder
  })
  const [draggedModule, setDraggedModule] = useState<string | null>(null)

  // 拖拽排序处理
  const handleDragStart = (moduleId: string) => {
    setDraggedModule(moduleId)
  }

  const handleDragOver = (e: React.DragEvent, targetModuleId: string) => {
    e.preventDefault()
    if (!draggedModule || draggedModule === targetModuleId) return
    
    const newOrder = [...moduleOrder]
    const draggedIndex = newOrder.indexOf(draggedModule)
    const targetIndex = newOrder.indexOf(targetModuleId)
    
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedModule)
    
    setModuleOrder(newOrder)
  }

  const handleDragEnd = () => {
    if (draggedModule) {
      localStorage.setItem('billDetailsModuleOrder', JSON.stringify(moduleOrder))
    }
    setDraggedModule(null)
  }

  // 上下移动模块
  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const newOrder = [...moduleOrder]
    const index = newOrder.indexOf(moduleId)
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setModuleOrder(newOrder)
    localStorage.setItem('billDetailsModuleOrder', JSON.stringify(newOrder))
  }

  // 加载操作日志
  const loadOperationLogs = async () => {
    if (!id) return
    try {
      const response = await getBillOperationLogs(id)
      if (response.errCode === 200 && response.data) {
        setOperationLogs(response.data)
      }
    } catch (error) {
      console.error('加载操作日志失败:', error)
    }
  }

  // 加载文件列表
  const loadBillFiles = async () => {
    if (!id) return
    try {
      const response = await getBillFiles(id)
      if (response.errCode === 200 && response.data) {
        setBillFiles(response.data)
      }
    } catch (error) {
      console.error('加载文件列表失败:', error)
    }
  }

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !id) return
    
    setUploading(true)
    setUploadProgress(0)
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(Math.round(((i) / files.length) * 100))
        
        const response = await uploadBillFile(id, file)
        if (response.errCode === 200) {
          // 上传成功后刷新文件列表和操作日志
          await loadBillFiles()
          await loadOperationLogs()
        } else {
          alert(`文件 ${file.name} 上传失败: ${response.msg}`)
        }
        
        setUploadProgress(Math.round(((i + 1) / files.length) * 100))
      }
      alert('文件上传成功！')
    } catch (error) {
      console.error('文件上传失败:', error)
      alert('文件上传失败，请稍后重试')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      // 清空 input
      e.target.value = ''
    }
  }

  // 处理文件下载
  const handleFileDownload = async (fileId: number, fileName: string) => {
    if (!id) return
    try {
      await downloadBillFile(id, fileId, fileName)
      // 下载后刷新操作日志
      await loadOperationLogs()
    } catch (error) {
      console.error('文件下载失败:', error)
      alert('文件下载失败，请稍后重试')
    }
  }

  // 处理文件删除
  const handleFileDelete = async (fileId: number, fileName: string) => {
    if (!id) return
    if (!confirm(`确定要删除文件 "${fileName}" 吗？`)) return
    
    try {
      const response = await deleteBillFile(id, fileId)
      if (response.errCode === 200) {
        await loadBillFiles()
        await loadOperationLogs()
        alert('文件已删除')
      } else {
        alert(`删除失败: ${response.msg}`)
      }
    } catch (error) {
      console.error('文件删除失败:', error)
      alert('文件删除失败，请稍后重试')
    }
  }

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-4 h-4 text-green-500" />
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) return <FileArchive className="w-4 h-4 text-yellow-500" />
    if (fileType.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />
    return <File className="w-4 h-4 text-blue-500" />
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 根据目的港所在大洲加载跳港选项
  const loadSkipPortOptions = async (portOfDischarge: string) => {
    if (!portOfDischarge) return
    
    try {
      // 根据目的港名称推测所在大洲
      // 这里可以根据实际需求调整逻辑，比如从数据库查询目的港的大洲信息
      let continent = ''
      
      // 简单的大洲推断逻辑（可以根据实际情况完善）
      const europePorts = ['DEHAM', 'NLRTM', 'BEANR', 'GBFXT', 'GBLON', 'FRLEH', 'ESALG', 'ITMIL', 'PLGDN']
      const asiaPorts = ['CNSHA', 'CNNBO', 'CNSZX', 'HKHKG', 'SGSIN', 'JPYOK', 'KRPUS', 'TWKHH']
      const americaPorts = ['USNYC', 'USLAX', 'USMIA', 'CAYVR', 'MXVER', 'BRSSZ']
      const africaPorts = ['ZADUR', 'EGPSD', 'MACAS', 'NGLOS']
      const oceaniaPorts = ['AUSYD', 'AUMEL', 'NZAKL']
      
      const portCode = portOfDischarge.toUpperCase()
      if (europePorts.some(p => portCode.includes(p) || portOfDischarge.includes('欧洲') || portOfDischarge.includes('德国') || portOfDischarge.includes('荷兰') || portOfDischarge.includes('英国') || portOfDischarge.includes('法国') || portOfDischarge.includes('意大利') || portOfDischarge.includes('西班牙'))) {
        continent = '欧洲'
      } else if (asiaPorts.some(p => portCode.includes(p) || portOfDischarge.includes('中国') || portOfDischarge.includes('日本') || portOfDischarge.includes('韩国') || portOfDischarge.includes('新加坡') || portOfDischarge.includes('香港'))) {
        continent = '亚洲'
      } else if (americaPorts.some(p => portCode.includes(p) || portOfDischarge.includes('美国') || portOfDischarge.includes('加拿大') || portOfDischarge.includes('墨西哥') || portOfDischarge.includes('巴西'))) {
        continent = '北美洲'
      } else if (africaPorts.some(p => portCode.includes(p) || portOfDischarge.includes('南非') || portOfDischarge.includes('埃及'))) {
        continent = '非洲'
      } else if (oceaniaPorts.some(p => portCode.includes(p) || portOfDischarge.includes('澳大利亚') || portOfDischarge.includes('新西兰'))) {
        continent = '大洋洲'
      }
      
      // 获取对应大洲的海运港口数据
      const response = await getDestinationPortsList({
        continent: continent || undefined,
        status: 'active',
        transportType: 'sea',  // 只获取海运港口
      })
      
      if (response.errCode === 200 && response.data) {
        setSkipPortOptions(response.data)
      }
    } catch (error) {
      console.error('加载跳港选项失败:', error)
    }
  }

  // 从 API 获取提单详情
  useEffect(() => {
    const loadBillDetail = async () => {
      if (!id) return
      
      setLoading(true)
      try {
        const response = await getBillByIdFromAPI(id)
        if (response.errCode === 200 && response.data) {
          setBillDetail(response.data)
        } else {
          // 降级到 mock 数据
          const mockBill = getBillByIdFromMock(id) || getBillByIdFromMock('1')
          setBillDetail(mockBill)
        }
        // 加载操作日志和文件列表
        await loadOperationLogs()
        await loadBillFiles()
      } catch (error) {
        console.error('加载提单详情失败:', error)
        // 降级到 mock 数据
        const mockBill = getBillByIdFromMock(id || '1') || getBillByIdFromMock('1')
        setBillDetail(mockBill)
      } finally {
        setLoading(false)
      }
    }
    
    loadBillDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 加载订单关联的费用列表
  const loadBillFees = async () => {
    if (!id) return
    setFeesLoading(true)
    try {
      const response = await getFees({ billId: id, pageSize: 100 })
      if (response.errCode === 200 && response.data) {
        setBillFees(response.data.list || [])
      }
    } catch (error) {
      console.error('加载费用列表失败:', error)
    } finally {
      setFeesLoading(false)
    }
  }

  // 当提单详情加载后，加载关联费用
  useEffect(() => {
    if (billDetail?.id) {
      loadBillFees()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billDetail?.id])

  // 当提单详情加载后，根据目的港加载跳港选项
  useEffect(() => {
    if (billDetail?.portOfDischarge) {
      loadSkipPortOptions(billDetail.portOfDischarge)
    }
  }, [billDetail?.portOfDischarge])

  if (loading || !billDetail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xs text-gray-500">加载中...</div>
      </div>
    )
  }

  const handleDownload = async (declarationNumber: string) => {
    try {
      await downloadFile(declarationNumber)
    } catch (error) {
      alert('下载失败，请稍后重试')
      console.error('下载文件失败:', error)
    }
  }

  // declarationColumns - 保留用于报关单功能
  const declarationColumns = [
    { key: 'declarationNumber', label: '报关单号' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
    { key: 'releaseTime', label: '放行时间' },
    {
      key: 'actions',
      label: '操作',
      render: (item: Declaration) => (
        <button
          onClick={() => handleDownload(item.declarationNumber)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          title="下载文件"
        >
          <Download className="w-4 h-4" />
          <span>下载</span>
        </button>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="提单详情"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '提单', path: '/bookings/bill' },
          { label: '详情' }
        ]}
        actionButtons={
          <button
            onClick={() => navigate('/bookings/bill')}
            className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* 标签页 - 可拖拽排序 */}
        <div className="mb-4 border-b border-gray-200">
          <div className="flex gap-1 items-center">
            {tabOrder.map((tabId) => {
              const config = tabConfig[tabId]
              if (!config) return null
              const isDragging = draggedTab === tabId
              return (
                <button
                  key={tabId}
                  draggable
                  onDragStart={() => handleTabDragStart(tabId)}
                  onDragOver={(e) => handleTabDragOver(e, tabId)}
                  onDragEnd={handleTabDragEnd}
                  onClick={() => setActiveTab(tabId)}
                  className={`px-2 py-1 text-xs font-medium border-b-2 transition-all cursor-grab active:cursor-grabbing ${
                    activeTab === tabId
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } ${isDragging ? 'opacity-50' : ''}`}
                >
                  {config.label}{config.badge ? ` ${config.badge()}` : ''}
                </button>
              )
            })}
            <span className="ml-2 text-xs text-gray-300 flex items-center gap-0.5" title="拖拽标签页可调整顺序">
              <GripVertical className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 基本信息 */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* 提单基本信息 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                提单信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">序号:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.billNumber}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">提单号:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.containerNumber}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">集装箱号:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.actualContainerNo || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">船名航次:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.vessel}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">ATA:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.ata || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">ETA:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.eta}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">实际到港:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.actualArrivalDate || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">件数:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.pieces}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">毛重 (KGS):</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.weight}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">体积 (CBM):</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.volume || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">报关统计:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.customsStats}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">创建者:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.creator}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">创建时间:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.createTime}</span>
                </div>
              </div>
            </div>

            {/* 关联客户 */}
            {billDetail.customerId && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <UserCircle className="w-3 h-3 text-blue-600" />
                  关联客户
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{billDetail.customerName}</div>
                      <div className="text-xs text-gray-500">{billDetail.customerCode}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/crm/customers/${billDetail.customerId}`)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                  >
                    <span>查看客户详情</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* 收发货信息 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Package className="w-3 h-3 text-primary-600" />
                收发货信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">发货人:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.shipper || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">收货人:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.consignee || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">通知方:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.notifyParty || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">交货地:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.placeOfDelivery || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">装货港:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.portOfLoading || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">卸货港:</span>
                  <span className="ml-2 font-medium text-xs">{billDetail.portOfDischarge || '-'}</span>
                </div>
              </div>
            </div>

            {/* 状态信息 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Activity className="w-3 h-3 text-primary-600" />
                状态信息
              </h3>
              {/* 状态卡片 */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                {/* 船状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.shipStatus === '已到港' ? 'border-green-200 bg-green-50' :
                  billDetail.shipStatus === '跳港' ? 'border-cyan-200 bg-cyan-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Ship className={`w-3 h-3 ${
                      billDetail.shipStatus === '已到港' ? 'text-green-600' :
                      billDetail.shipStatus === '跳港' ? 'text-cyan-600' :
                      'text-gray-500'
                    }`} />
                    <span className="text-xs text-gray-500">船状态</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.shipStatus === '未到港' ? 'text-gray-600' :
                    billDetail.shipStatus === '已到港' ? 'text-green-600' :
                    billDetail.shipStatus === '跳港' ? 'text-cyan-600' :
                    'text-gray-600'
                  }`}>
                    {billDetail.shipStatus || '未到港'}
                    {billDetail.skipPort && <span className="block text-xs font-normal text-cyan-500">→ {billDetail.skipPort}</span>}
                  </div>
                </div>

                {/* 换单状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.docSwapStatus === '已换单' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Repeat className={`w-3 h-3 ${
                      billDetail.docSwapStatus === '已换单' ? 'text-green-600' : 'text-gray-500'
                    }`} />
                    <span className="text-xs text-gray-500">换单</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.docSwapStatus === '已换单' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {billDetail.docSwapStatus || '未换单'}
                  </div>
                </div>

                {/* 清关状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.customsStatus === '已放行' ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <ShieldCheck className={`w-3 h-3 ${
                      billDetail.customsStatus === '已放行' ? 'text-green-600' : 'text-orange-500'
                    }`} />
                    <span className="text-xs text-gray-500">清关状态</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.customsStatus === '已放行' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {billDetail.customsStatus || '未放行'}
                  </div>
                </div>

                {/* 查验状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.inspection === '已放行' ? 'border-green-200 bg-green-50' :
                  billDetail.inspection === '查验中' ? 'border-orange-200 bg-orange-50' :
                  billDetail.inspection === '待查验' ? 'border-yellow-200 bg-yellow-50' :
                  billDetail.inspection === '已查验' ? 'border-blue-200 bg-blue-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <ClipboardCheck className={`w-3 h-3 ${
                      billDetail.inspection === '已放行' ? 'text-green-600' :
                      billDetail.inspection === '查验中' ? 'text-orange-500' :
                      billDetail.inspection === '待查验' ? 'text-yellow-600' :
                      billDetail.inspection === '已查验' ? 'text-blue-600' :
                      'text-gray-500'
                    }`} />
                    <span className="text-xs text-gray-500">查验状态</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.inspection === '待查验' ? 'text-yellow-600' :
                    billDetail.inspection === '查验中' ? 'text-orange-600' :
                    billDetail.inspection === '已查验' ? 'text-blue-600' :
                    billDetail.inspection === '已放行' ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                    {billDetail.inspection || '-'}
                  </div>
                </div>

                {/* 派送状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.deliveryStatus === '已送达' ? 'border-green-200 bg-green-50' :
                  billDetail.deliveryStatus === '派送中' ? 'border-blue-200 bg-blue-50' :
                  billDetail.deliveryStatus === '订单异常' ? 'border-red-200 bg-red-50' :
                  billDetail.deliveryStatus === '异常关闭' ? 'border-gray-300 bg-gray-100' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Truck className={`w-3 h-3 ${
                      billDetail.deliveryStatus === '已送达' ? 'text-green-600' :
                      billDetail.deliveryStatus === '派送中' ? 'text-blue-600' :
                      billDetail.deliveryStatus === '订单异常' ? 'text-red-600' :
                      billDetail.deliveryStatus === '异常关闭' ? 'text-gray-500' :
                      'text-gray-500'
                    }`} />
                    <span className="text-xs text-gray-500">派送状态</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.deliveryStatus === '未派送' ? 'text-gray-600' :
                    billDetail.deliveryStatus === '派送中' ? 'text-blue-600' :
                    billDetail.deliveryStatus === '已送达' ? 'text-green-600' :
                    billDetail.deliveryStatus === '订单异常' ? 'text-red-600' :
                    billDetail.deliveryStatus === '异常关闭' ? 'text-gray-500' :
                    'text-gray-600'
                  }`}>
                    {billDetail.deliveryStatus || '未派送'}
                  </div>
                </div>

                {/* 订单状态 */}
                <div className={`rounded-lg border p-2 ${
                  billDetail.isVoid ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <FileText className={`w-3 h-3 ${
                      billDetail.isVoid ? 'text-red-600' : 'text-green-600'
                    }`} />
                    <span className="text-xs text-gray-500">订单状态</span>
                  </div>
                  <div className={`text-xs font-semibold ${
                    billDetail.isVoid ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {billDetail.isVoid ? '已作废' : '有效'}
                  </div>
                  {billDetail.isVoid && billDetail.voidReason && (
                    <div className="text-xs text-red-500 truncate" title={billDetail.voidReason}>
                      {billDetail.voidReason}
                    </div>
                  )}
                </div>
              </div>
              
              {/* 快捷操作提示 */}
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                如需修改状态，请前往"操作"标签页
              </div>
            </div>
          </div>
        )}

        {/* 文件管理 */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* 上传区域 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                  <Upload className="w-3 h-3 text-primary-600" />
                  文件上传
                </h3>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${
                    uploading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        上传中 {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        选择文件
                      </>
                    )}
                  </span>
                </label>
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">点击上方按钮或拖拽文件到此处上传</p>
                <p className="text-xs text-gray-400 mt-1">支持所有类型文件，文件会自动压缩存储以节省空间</p>
              </div>
            </div>

            {/* 文件列表 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                文件列表 ({billFiles.length})
              </h3>
              {billFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  暂无文件，请上传文件
                </div>
              ) : (
                <div className="space-y-2">
                  {billFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.fileType)}
                        <div>
                          <p className="text-xs font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-xs text-gray-400">
                            原始: {formatFileSize(file.originalSize)} → 压缩后: {formatFileSize(file.compressedSize)}
                            <span className="ml-2 text-green-600">
                              (节省 {Math.round((1 - file.compressedSize / file.originalSize) * 100)}%)
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">
                            上传时间: {new Date(file.uploadTime).toLocaleString()} | 上传者: {file.uploadBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFileDownload(file.id, file.fileName)}
                          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="下载文件（恢复原始大小）"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFileDelete(file.id, file.fileName)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="删除文件"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 存储统计 */}
            {billFiles.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileArchive className="w-3 h-3 text-primary-600" />
                  存储统计
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">
                      {formatFileSize(billFiles.reduce((sum, f) => sum + f.originalSize, 0))}
                    </p>
                    <p className="text-xs text-gray-500">原始总大小</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">
                      {formatFileSize(billFiles.reduce((sum, f) => sum + f.compressedSize, 0))}
                    </p>
                    <p className="text-xs text-gray-500">压缩后总大小</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-600">
                      {formatFileSize(billFiles.reduce((sum, f) => sum + (f.originalSize - f.compressedSize), 0))}
                    </p>
                    <p className="text-xs text-gray-500">节省空间</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 时间线 */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            {operationLogs.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">暂无操作记录</div>
            ) : (
              <Timeline>
                {operationLogs.map((log) => {
                  // 根据操作类型确定颜色
                  const getColor = (type: string, name: string) => {
                    if (type === 'create') return 'blue'
                    if (type === 'void') return 'red'
                    if (type === 'restore') return 'green'
                    if (name === '放行' || name === '确认送达') return 'green'
                    if (name === '开始查验' || name === '开始派送') return 'blue'
                    if (name === '完成查验') return 'blue'
                    if (name === '标记查验') return 'blue'
                    return 'gray'
                  }
                  
                  // 格式化时间
                  const formatTime = (time: string) => {
                    try {
                      const date = new Date(time)
                      return date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    } catch {
                      return time
                    }
                  }
                  
                  return (
                    <TimelineItem
                      key={log.id}
                      color={getColor(log.operationType, log.operationName)}
                      label={formatTime(log.operationTime)}
                    >
                      <div className="font-medium text-xs">{log.operationName}</div>
                      {(log.oldValue || log.newValue) && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {log.oldValue && log.newValue 
                            ? `${log.oldValue} → ${log.newValue}` 
                            : log.newValue || log.oldValue
                          }
                        </div>
                      )}
                      {log.remark && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          备注: {log.remark}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        操作人: {log.operator}
                      </div>
                    </TimelineItem>
                  )
                })}
              </Timeline>
            )}
          </div>
        )}

        {/* 操作 */}
        {activeTab === 'actions' && (
          <div className="space-y-2">
              {/* 提示文字 */}
            <div className="text-xs text-gray-400 flex items-center gap-1">
                <GripVertical className="w-3 h-3" />
                拖拽模块或使用上下箭头调整顺序
              </div>
              
            {/* 主内容区 - 左右布局 */}
            <div className="flex gap-4 items-stretch">
              {/* 左侧操作模块 */}
              <div className="flex-1 space-y-2">
              {moduleOrder.filter(id => id !== 'finance').map((moduleId, index, filteredOrder) => {
              const isFirst = index === 0
              const isLast = index === filteredOrder.length - 1
              const isDragging = draggedModule === moduleId
              
              // 通用的 ModuleWrapper props
              const wrapperProps = {
                moduleId,
                isFirst,
                isLast,
                isDragging,
                onDragStart: handleDragStart,
                onDragOver: handleDragOver,
                onDragEnd: handleDragEnd,
                onMoveModule: moveModule,
              }
              
              // 根据模块ID渲染不同内容
              switch (moduleId) {
                case 'inspection':
                  return (
                    <ModuleWrapper key={moduleId} title="查验操作" icon={<ClipboardCheck className="w-4 h-4" />} iconColor="text-yellow-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2">
                        {billDetail.inspection === '-' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要将此提单标记为待查验吗？')) return
                              try {
                                const response = await updateBillInspection(String(billDetail.id), '待查验')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, inspection: '待查验' })
                                  loadOperationLogs()
                                  alert('已标记为待查验')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center gap-1"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            标记查验
                          </button>
                        )}
                        {billDetail.inspection === '待查验' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要开始查验吗？')) return
                              try {
                                const response = await updateBillInspection(String(billDetail.id), '查验中')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, inspection: '查验中' })
                                  loadOperationLogs()
                                  alert('已开始查验')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            开始查验
                          </button>
                        )}
                        {billDetail.inspection === '查验中' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要完成查验吗？')) return
                              try {
                                const response = await updateBillInspection(String(billDetail.id), '已查验')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, inspection: '已查验' })
                                  loadOperationLogs()
                                  alert('已完成查验')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            完成查验
                          </button>
                        )}
                        {billDetail.inspection === '已查验' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要放行此提单吗？放行后将转移到CMR管理。')) return
                              try {
                                const response = await updateBillInspection(String(billDetail.id), '已放行')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, inspection: '已放行' })
                                  loadOperationLogs()
                                  alert('已放行')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            放行
                          </button>
                        )}
                        {billDetail.inspection !== '-' && (
                          <button
                            onClick={() => {
                              // 根据查验状态决定跳转到哪个标签页
                              const path = billDetail.inspection === '已放行' 
                                ? '/inspection-overview/release' 
                                : '/inspection-overview'
                              navigate(`${path}?search=${encodeURIComponent(billDetail.billNumber)}`)
                            }}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                          >
                            查看查验明细
                          </button>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          当前状态: <span className={`font-medium ${
                            billDetail.inspection === '待查验' ? 'text-yellow-600' :
                            billDetail.inspection === '查验中' ? 'text-orange-600' :
                            billDetail.inspection === '已查验' ? 'text-blue-600' :
                            billDetail.inspection === '已放行' ? 'text-green-600' :
                            'text-gray-600'
                          }`}>{billDetail.inspection}</span>
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                  
                case 'ship':
                  return (
                    <ModuleWrapper key={moduleId} title="船状态操作" icon={<Ship className="w-4 h-4" />} iconColor="text-cyan-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2 items-center">
                        {billDetail.shipStatus !== '未到港' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要将船状态设为未到港吗？')) return
                              try {
                                const response = await updateBillShipStatus(String(billDetail.id), '未到港')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, shipStatus: '未到港', skipPort: null })
                                  loadOperationLogs()
                                  alert('已设为未到港')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                          >
                            <Ship className="w-3.5 h-3.5" />
                            未到港
                          </button>
                        )}
                        {billDetail.shipStatus !== '已到港' && (
                          <button
                            onClick={() => {
                              setActualArrivalDate(new Date().toISOString().split('T')[0])
                              setShowArrivalModal(true)
                            }}
                            className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
                          >
                            <Anchor className="w-3.5 h-3.5" />
                            已到港
                          </button>
                        )}
                        {billDetail.shipStatus !== '跳港' && (
                          <div className="flex items-center gap-2">
                            <div className="relative" ref={skipPortDropdownRef}>
                              <input
                                key="skip-port-input"
                                type="text"
                                value={skipPortInputValue}
                                onChange={(e) => {
                                  setSkipPortInputValue(e.target.value)
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onFocus={() => setShowSkipPortDropdown(true)}
                                placeholder="选择或输入跳港目的地"
                                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 w-48"
                              />
                              {/* 自定义下拉菜单 */}
                              {showSkipPortDropdown && filteredSkipPortOptions.length > 0 && (
                                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                                  {filteredSkipPortOptions.map((port) => (
                                    <div
                                      key={port.id}
                                      className="px-2 py-1.5 text-xs hover:bg-primary-50 cursor-pointer"
                                      onClick={() => {
                                        const value = `${port.portNameCn} (${port.portCode})`
                                        setSkipPortInputValue(value)
                                        setSelectedSkipPort(value)
                                        setShowSkipPortDropdown(false)
                                      }}
                                    >
                                      <div className="font-medium">{port.portNameCn}</div>
                                      <div className="text-gray-400">{port.portCode} - {port.portNameEn}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                const skipPort = skipPortInputValue || selectedSkipPort
                                if (!skipPort) {
                                  alert('请选择或输入跳港目的地')
                                  return
                                }
                                if (!confirm(`确定要将船跳港至 ${skipPort} 吗？`)) return
                                try {
                                  const response = await updateBillShipStatus(String(billDetail.id), '跳港', skipPort)
                                  if (response.errCode === 200) {
                                    setBillDetail({ ...billDetail, shipStatus: '跳港', skipPort })
                                    loadOperationLogs()
                                    setSkipPortInputValue('')
                                    setSelectedSkipPort('')
                                    alert(`已跳港至 ${skipPort}`)
                                  } else {
                                    alert(`操作失败: ${response.msg}`)
                                  }
                                } catch (error) {
                                  console.error('操作失败:', error)
                                  alert('操作失败，请稍后重试')
                                }
                              }}
                              className="px-3 py-1.5 text-xs bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 flex items-center gap-1"
                            >
                              <Ship className="w-3.5 h-3.5" />
                              跳港
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          当前状态: <span className={`font-medium ${
                            billDetail.shipStatus === '未到港' ? 'text-gray-600' :
                            billDetail.shipStatus === '已到港' ? 'text-green-600' :
                            billDetail.shipStatus === '跳港' ? 'text-cyan-600' :
                            'text-gray-600'
                          }`}>{billDetail.shipStatus || '未到港'}</span>
                          {billDetail.skipPort && (
                            <span className="ml-1 text-cyan-600">({billDetail.skipPort})</span>
                          )}
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                
                case 'doc_swap':
                  return (
                    <ModuleWrapper key={moduleId} title="换单操作" icon={<Repeat className="w-4 h-4" />} iconColor="text-amber-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2 items-center">
                        {billDetail.docSwapStatus !== '已换单' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要标记为已换单吗？')) return
                              try {
                                const response = await updateBillDocSwapStatus(String(billDetail.id), '已换单')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, docSwapStatus: '已换单', docSwapTime: new Date().toISOString() })
                                  loadOperationLogs()
                                  alert('已标记为换单完成')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 flex items-center gap-1"
                          >
                            <Repeat className="w-3.5 h-3.5" />
                            换单完成
                          </button>
                        )}
                        {billDetail.docSwapStatus === '已换单' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要取消换单状态吗？')) return
                              try {
                                const response = await updateBillDocSwapStatus(String(billDetail.id), '未换单')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, docSwapStatus: '未换单', docSwapTime: undefined })
                                  loadOperationLogs()
                                  alert('已取消换单状态')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            取消换单
                          </button>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          换单状态: <span className={`font-medium ${
                            billDetail.docSwapStatus === '已换单' ? 'text-green-600' : 'text-gray-600'
                          }`}>{billDetail.docSwapStatus || '未换单'}</span>
                          {billDetail.docSwapTime && (
                            <span className="ml-1 text-gray-400">
                              ({new Date(billDetail.docSwapTime).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                  
                case 'delivery':
                  return (
                    <ModuleWrapper key={moduleId} title="派送操作" icon={<Truck className="w-4 h-4" />} iconColor="text-blue-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2">
                        {/* 预计提货时间按钮 */}
                        <button
                          onClick={() => {
                            // 初始化值（如果已有数据则显示）
                            setPickupEstimatedTime(billDetail.cmrEstimatedPickupTime || '')
                            setPickupNote('')
                            setShowPickupTimeModal(true)
                          }}
                          className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          预计提货时间
                          {billDetail.cmrEstimatedPickupTime && (
                            <span className="ml-1 text-amber-500">✓</span>
                          )}
                        </button>
                        {billDetail.deliveryStatus === '未派送' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要开始派送吗？')) return
                              try {
                                const response = await updateBillDeliveryStatus(String(billDetail.id), '派送中')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, deliveryStatus: '派送中' })
                                  loadOperationLogs()
                                  alert('已开始派送')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            开始派送
                          </button>
                        )}
                        <button
                          onClick={() => {
                            // 根据派送状态决定跳转到哪个标签页
                            let path = '/cmr-manage'
                            const status = billDetail.deliveryStatus || '未派送'
                            if (status === '派送中') {
                              path = '/cmr-manage/delivering'
                            } else if (status === '订单异常' || status === '异常关闭') {
                              path = '/cmr-manage/exception'
                            } else if (status === '已送达') {
                              path = '/cmr-manage/archived'
                            }
                            navigate(`${path}?search=${encodeURIComponent(billDetail.billNumber)}`)
                          }}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                        >
                          查看CMR管理
                        </button>
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          当前状态: <span className={`font-medium ${
                            billDetail.deliveryStatus === '未派送' ? 'text-gray-600' :
                            billDetail.deliveryStatus === '派送中' ? 'text-blue-600' :
                            billDetail.deliveryStatus === '已送达' ? 'text-green-600' :
                            billDetail.deliveryStatus === '订单异常' ? 'text-red-600' :
                            billDetail.deliveryStatus === '异常关闭' ? 'text-gray-500' :
                            'text-gray-600'
                          }`}>{billDetail.deliveryStatus || '未派送'}</span>
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                  
                case 'customs':
                  return (
                    <ModuleWrapper key={moduleId} title="清关操作" icon={<ShieldCheck className="w-4 h-4" />} iconColor="text-purple-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2 items-center">
                        {billDetail.customsStatus !== '已放行' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要将清关状态设为已放行吗？')) return
                              try {
                                const response = await updateBillCustomsStatus(String(billDetail.id), '已放行')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, customsStatus: '已放行', customsReleaseTime: new Date().toISOString() })
                                  loadOperationLogs()
                                  alert('已标记为清关放行')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            清关放行
                          </button>
                        )}
                        {billDetail.customsStatus === '已放行' && (
                          <button
                            onClick={async () => {
                              if (!confirm('确定要取消清关放行状态吗？')) return
                              try {
                                const response = await updateBillCustomsStatus(String(billDetail.id), '未放行')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, customsStatus: '未放行', customsReleaseTime: null })
                                  loadOperationLogs()
                                  alert('已取消清关放行')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            取消放行
                          </button>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          清关状态: <span className={`font-medium ${
                            billDetail.customsStatus === '已放行' ? 'text-green-600' : 'text-orange-600'
                          }`}>{billDetail.customsStatus || '未放行'}</span>
                          {billDetail.customsReleaseTime && (
                            <span className="ml-1 text-gray-400">
                              ({new Date(billDetail.customsReleaseTime).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                
                case 'finance':
                  return (
                    <ModuleWrapper key={moduleId} title="费用管理" icon={<DollarSign className="w-4 h-4" />} iconColor="text-emerald-600" {...wrapperProps}>
                      <div className="space-y-3">
                        {/* 操作按钮 */}
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            onClick={() => setShowFeeModal(true)}
                            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            录入费用
                          </button>
                          <button
                            onClick={() => {
                              navigate(`/finance/fees?billId=${billDetail.id}`)
                            }}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            查看全部费用
                          </button>
                          <button
                            onClick={() => {
                              navigate('/finance/invoices')
                            }}
                            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            发票管理
                          </button>
                        </div>
                        
                        {/* 费用汇总 */}
                        {billFees.length > 0 && (
                          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-emerald-800">费用汇总</span>
                              <span className="text-sm font-bold text-emerald-600">
                                ¥{billFees.reduce((sum, fee) => sum + (fee.amount || 0), 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-xs text-emerald-600">
                              共 {billFees.length} 笔费用
                            </div>
                          </div>
                        )}
                        
                        {/* 费用列表 */}
                        {feesLoading ? (
                          <div className="text-center py-4 text-xs text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                            加载费用中...
                          </div>
                        ) : billFees.length > 0 ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium text-gray-600">费用名称</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-600">类别</th>
                                  <th className="text-right px-3 py-2 font-medium text-gray-600">金额</th>
                                  <th className="text-left px-3 py-2 font-medium text-gray-600">日期</th>
                                </tr>
                              </thead>
                              <tbody>
                                {billFees.slice(0, 5).map((fee) => (
                                  <tr key={fee.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-900">{fee.feeName}</td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                                        fee.category === 'freight' ? 'bg-blue-100 text-blue-700' :
                                        fee.category === 'customs' ? 'bg-red-100 text-red-700' :
                                        fee.category === 'warehouse' ? 'bg-orange-100 text-orange-700' :
                                        fee.category === 'insurance' ? 'bg-green-100 text-green-700' :
                                        fee.category === 'handling' ? 'bg-purple-100 text-purple-700' :
                                        fee.category === 'documentation' ? 'bg-cyan-100 text-cyan-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {fee.category === 'freight' ? '运费' :
                                         fee.category === 'customs' ? '关税' :
                                         fee.category === 'warehouse' ? '仓储' :
                                         fee.category === 'insurance' ? '保险' :
                                         fee.category === 'handling' ? '操作' :
                                         fee.category === 'documentation' ? '文件' : '其他'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                                      {fee.currency || '¥'}{fee.amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-gray-500">
                                      {fee.feeDate ? new Date(fee.feeDate).toLocaleDateString() : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {billFees.length > 5 && (
                              <div className="bg-gray-50 px-3 py-2 text-center">
                                <button
                                  onClick={() => navigate(`/finance/fees?billId=${billDetail.id}`)}
                                  className="text-xs text-primary-600 hover:text-primary-700"
                                >
                                  查看全部 {billFees.length} 笔费用 →
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg">
                            暂无费用记录，点击"录入费用"添加
                          </div>
                        )}
                      </div>
                    </ModuleWrapper>
                  )
                  
                case 'order':
                  return (
                    <ModuleWrapper key={moduleId} title="订单操作" icon={<FileText className="w-4 h-4" />} iconColor="text-gray-600" {...wrapperProps}>
                      <div className="flex flex-wrap gap-2">
                        {!billDetail.isVoid ? (
                          <button
                            onClick={async () => {
                              if (!confirm(`确定要作废订单 ${billDetail.billNumber} 吗？`)) return
                              try {
                                const response = await voidBill(String(billDetail.id), '用户手动作废')
                                if (response.errCode === 200) {
                                  setBillDetail({ ...billDetail, isVoid: true, voidReason: '用户手动作废' })
                                  loadOperationLogs()
                                  alert('订单已作废')
                                } else {
                                  alert(`操作失败: ${response.msg}`)
                                }
                              } catch (error) {
                                console.error('操作失败:', error)
                                alert('操作失败，请稍后重试')
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            作废订单
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={async () => {
                                if (!confirm('确定要恢复此订单吗？')) return
                                try {
                                  const response = await restoreBill(String(billDetail.id))
                                  if (response.errCode === 200) {
                                    setBillDetail({ ...billDetail, isVoid: false, voidReason: null })
                                    loadOperationLogs()
                                    alert('订单已恢复')
                                  } else {
                                    alert(`操作失败: ${response.msg}`)
                                  }
                                } catch (error) {
                                  console.error('操作失败:', error)
                                  alert('操作失败，请稍后重试')
                                }
                              }}
                              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              恢复订单
                            </button>
                            <div className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 bg-red-50 rounded">
                              作废原因: {billDetail.voidReason}
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded">
                          订单状态: <span className={`font-medium ${billDetail.isVoid ? 'text-red-600' : 'text-green-600'}`}>
                            {billDetail.isVoid ? '已作废' : '有效'}
                          </span>
                        </div>
                      </div>
                    </ModuleWrapper>
                  )
                  
                default:
                  return null
              }
            })}
            </div>
            
            {/* 右侧费用管理面板 */}
            <div className="w-80 flex-shrink-0 flex">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                {/* 标题 */}
                <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-gray-900 text-sm">费用管理</span>
                  </div>
                </div>
                
                {/* 操作按钮 */}
                <div className="p-3 border-b border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowFeeModal(true)}
                      className="flex-1 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      录入费用
                    </button>
                    <button
                      onClick={() => navigate(`/finance/fees?billId=${billDetail.id}`)}
                      className="flex-1 px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      全部费用
                    </button>
                  </div>
                </div>
                
                {/* 费用汇总 */}
                {billFees.length > 0 && (
                  <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50/50 to-green-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">费用总计</span>
                      <span className="text-base font-bold text-emerald-600">
                        ¥{billFees.reduce((sum, fee) => sum + (fee.amount || 0), 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">共 {billFees.length} 笔</div>
                  </div>
                )}
                
                {/* 费用列表 */}
                <div className="flex-1 overflow-y-auto">
                  {feesLoading ? (
                    <div className="text-center py-8 text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                      加载中...
                    </div>
                  ) : billFees.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {billFees.map((fee) => (
                        <div key={fee.id} className="px-3 py-2.5 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900">{fee.feeName}</span>
                            <span className="text-xs font-semibold text-gray-900">
                              {fee.currency || '¥'}{fee.amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${
                              fee.category === 'freight' ? 'bg-blue-100 text-blue-700' :
                              fee.category === 'customs' ? 'bg-red-100 text-red-700' :
                              fee.category === 'warehouse' ? 'bg-orange-100 text-orange-700' :
                              fee.category === 'insurance' ? 'bg-green-100 text-green-700' :
                              fee.category === 'handling' ? 'bg-purple-100 text-purple-700' :
                              fee.category === 'documentation' ? 'bg-cyan-100 text-cyan-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {fee.category === 'freight' ? '运费' :
                               fee.category === 'customs' ? '关税' :
                               fee.category === 'warehouse' ? '仓储' :
                               fee.category === 'insurance' ? '保险' :
                               fee.category === 'handling' ? '操作' :
                               fee.category === 'documentation' ? '文件' : '其他'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {fee.feeDate ? new Date(fee.feeDate).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-gray-400">
                      <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      暂无费用记录
                    </div>
                  )}
                </div>
                
                {/* 底部操作 */}
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => navigate('/finance/invoices')}
                    className="w-full px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    发票管理
                  </button>
                </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 实际到港日期模态窗口 */}
      {showArrivalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Anchor className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">确认到港</h3>
              </div>
              <button
                onClick={() => setShowArrivalModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="关闭"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="arrival-date-input" className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    实际到港日期 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="arrival-date-input"
                      type="date"
                      value={actualArrivalDate}
                      onChange={(e) => setActualArrivalDate(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                      title="选择实际到港日期"
                      required
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowArrivalModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!actualArrivalDate) {
                    alert('请选择实际到港日期')
                    return
                  }
                  setArrivalSubmitting(true)
                  try {
                    const response = await updateBillShipStatus(String(billDetail.id), '已到港', actualArrivalDate)
                    if (response.errCode === 200) {
                      setBillDetail({ 
                        ...billDetail, 
                        shipStatus: '已到港', 
                        skipPort: null,
                        actualArrivalDate: actualArrivalDate 
                      })
                      loadOperationLogs()
                      setShowArrivalModal(false)
                      alert('已确认到港')
                    } else {
                      alert(`操作失败: ${response.msg}`)
                    }
                  } catch (error) {
                    console.error('操作失败:', error)
                    alert('操作失败，请稍后重试')
                  } finally {
                    setArrivalSubmitting(false)
                  }
                }}
                disabled={!actualArrivalDate || arrivalSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {arrivalSubmitting ? '提交中...' : '确认到港'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 预计提货时间模态窗口 */}
      {showPickupTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-gray-900">预计提货时间</h3>
              </div>
              <button
                onClick={() => setShowPickupTimeModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  预计提货时间 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={pickupEstimatedTime}
                    onChange={(e) => setPickupEstimatedTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                  placeholder="可选填写备注信息..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white resize-none"
                />
              </div>
              
              {/* 已有预计提货时间提示 */}
              {billDetail?.cmrEstimatedPickupTime && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">当前设置：</span>
                    {new Date(billDetail.cmrEstimatedPickupTime).toLocaleString('zh-CN')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowPickupTimeModal(false)}
                className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!pickupEstimatedTime) {
                    alert('请选择预计提货时间')
                    return
                  }
                  setPickupSubmitting(true)
                  try {
                    const cmrDetail: CMRDetailData = {
                      estimatedPickupTime: pickupEstimatedTime,
                      pickupNote: pickupNote || undefined,
                    }
                    // 保持当前派送状态不变，只更新 CMR 详情
                    const response = await updateBillDelivery(
                      String(billDetail.id),
                      billDetail.deliveryStatus || '未派送',
                      undefined,
                      cmrDetail
                    )
                    if (response.errCode === 200) {
                      setBillDetail({ 
                        ...billDetail, 
                        cmrEstimatedPickupTime: pickupEstimatedTime 
                      })
                      loadOperationLogs()
                      setShowPickupTimeModal(false)
                      alert('预计提货时间已保存')
                    } else {
                      alert(`操作失败: ${response.msg}`)
                    }
                  } catch (error) {
                    console.error('操作失败:', error)
                    alert('操作失败，请稍后重试')
                  } finally {
                    setPickupSubmitting(false)
                  }
                }}
                disabled={!pickupEstimatedTime || pickupSubmitting}
                className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pickupSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 费用录入弹窗 */}
      <FeeModal
        visible={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        onSuccess={() => {
          setShowFeeModal(false)
          loadBillFees()
        }}
        defaultBillId={billDetail?.id}
        defaultBillNumber={billDetail?.billNumber}
        defaultCustomerId={billDetail?.customerId}
        defaultCustomerName={billDetail?.customerName}
      />
    </div>
  )
}

