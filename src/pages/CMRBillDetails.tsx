import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Truck, FileText, Clock, 
  Upload, Download, Trash2, File, Image, FileArchive, Loader2,
  CheckCircle, AlertTriangle, XCircle, MapPin, Lock
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Timeline, { TimelineItem } from '../components/Timeline'
import CMRModal, { type CMRDetail } from '../components/CMRModal'
import { 
  getBillById, 
  getBillOperationLogs, 
  getBillFiles, 
  uploadBillFile, 
  downloadBillFile, 
  deleteBillFile,
  updateBillDelivery,
  type BillOfLading,
  type OperationLog,
  type BillFile,
  type CMRDetailData
} from '../utils/api'

export default function CMRBillDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'info' | 'files' | 'timeline'>('info')
  const [billDetail, setBillDetail] = useState<BillOfLading | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 时间线
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  
  // 文件管理
  const [billFiles, setBillFiles] = useState<BillFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // CMR模态框
  const [cmrModalVisible, setCmrModalVisible] = useState(false)
  
  // 加载提单详情
  useEffect(() => {
    const loadBillDetail = async () => {
      if (!id) return
      setLoading(true)
      try {
        const response = await getBillById(id)
        if (response.errCode === 200 && response.data) {
          setBillDetail(response.data)
        } else {
          setError(response.msg || '获取提单详情失败')
        }
      } catch (err) {
        console.error('加载提单详情失败:', err)
        setError('加载提单详情失败')
      } finally {
        setLoading(false)
      }
    }
    loadBillDetail()
  }, [id])
  
  // 加载操作日志
  const loadOperationLogs = async () => {
    if (!id) return
    try {
      const response = await getBillOperationLogs(id)
      if (response.errCode === 200 && response.data) {
        // 过滤派送相关的日志
        const deliveryLogs = response.data.filter(log => 
          log.operationType === 'delivery' || 
          log.operationName.includes('派送') ||
          log.operationName.includes('送达') ||
          log.operationType === 'create'
        )
        setOperationLogs(deliveryLogs)
      }
    } catch (err) {
      console.error('加载操作日志失败:', err)
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
    } catch (err) {
      console.error('加载文件列表失败:', err)
    }
  }
  
   
  useEffect(() => {
    loadOperationLogs()
    loadBillFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  
  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !id) return
    
    setUploading(true)
    setUploadProgress(0)
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(Math.round(((i + 1) / files.length) * 100))
        await uploadBillFile(id, file)
      }
      await loadBillFiles()
      alert('文件上传成功')
    } catch (err) {
      console.error('上传失败:', err)
      alert('文件上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      e.target.value = ''
    }
  }
  
  // 文件下载
  const handleFileDownload = async (fileId: string | number, fileName: string) => {
    if (!id) return
    try {
      await downloadBillFile(id, fileId, fileName)
    } catch (err) {
      console.error('下载失败:', err)
      alert('文件下载失败')
    }
  }
  
  // 文件删除
  const handleFileDelete = async (fileId: string | number, fileName: string) => {
    if (!id || !confirm(`确定要删除文件 "${fileName}" 吗？`)) return
    try {
      await deleteBillFile(id, fileId)
      await loadBillFiles()
      alert('文件删除成功')
    } catch (err) {
      console.error('删除失败:', err)
      alert('文件删除失败')
    }
  }
  
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-4 h-4 text-green-600" />
    if (fileType.includes('zip') || fileType.includes('rar')) return <FileArchive className="w-4 h-4 text-yellow-600" />
    return <File className="w-4 h-4 text-blue-600" />
  }
  
  // 获取派送状态样式
  const getDeliveryStatusStyle = (status: string) => {
    switch (status) {
      case '待派送':
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="w-3 h-3" /> }
      case '派送中':
        return { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Truck className="w-3 h-3" /> }
      case '订单异常':
        return { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-3 h-3" /> }
      case '异常关闭':
        return { bg: 'bg-gray-200', text: 'text-gray-600', icon: <XCircle className="w-3 h-3" /> }
      case '已送达':
        return { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> }
      case '已完成':
        return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle className="w-3 h-3" /> }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="w-3 h-3" /> }
    }
  }
  
  // CMR模态框提交
  const handleCMRSubmit = async (data: { status: string; detail: CMRDetail; hasException?: boolean }) => {
    if (!id) return
    
    const cmrDetailData: CMRDetailData = {
      estimatedPickupTime: data.detail.estimatedPickupTime,
      serviceProvider: data.detail.serviceProvider,
      pickupNote: data.detail.pickupNote,
      deliveryAddress: data.detail.deliveryAddress,
      estimatedArrivalTime: data.detail.estimatedArrivalTime,
      arrivalNote: data.detail.arrivalNote,
      actualArrivalTime: data.detail.actualArrivalTime,
      deliveryNote: data.detail.deliveryNote,
      unloadingCompleteTime: data.detail.unloadingCompleteTime,
      unloadingNote: data.detail.unloadingNote,
      confirmedTime: data.detail.confirmedTime,
      confirmNote: data.detail.confirmNote,
      hasException: data.hasException,
      exceptionNote: data.detail.exceptionNote,
      exceptionTime: data.detail.exceptionTime,
    }
    
    const response = await updateBillDelivery(id, data.status, undefined, cmrDetailData)
    if (response.errCode === 200) {
      setBillDetail(prev => prev ? { ...prev, ...response.data } : null)
      await loadOperationLogs()
      alert('派送状态已更新')
    } else {
      throw new Error(response.msg || '更新失败')
    }
  }
  
  // 解析CMR详情
  const parseCMRDetail = (): CMRDetail | undefined => {
    if (!billDetail) return undefined
    
    try {
      const notes = billDetail.cmrNotes ? JSON.parse(billDetail.cmrNotes) : {}
      
      return {
        estimatedPickupTime: billDetail.cmrEstimatedPickupTime,
        serviceProvider: billDetail.cmrServiceProvider,
        pickupNote: notes.pickupNote,
        deliveryAddress: billDetail.cmrDeliveryAddress,
        estimatedArrivalTime: billDetail.cmrEstimatedArrivalTime,
        arrivalNote: notes.arrivalNote,
        actualArrivalTime: billDetail.cmrActualArrivalTime,
        deliveryNote: notes.deliveryNote,
        unloadingCompleteTime: billDetail.cmrUnloadingCompleteTime,
        unloadingNote: notes.unloadingNote,
        confirmedTime: billDetail.cmrConfirmedTime,
        confirmNote: notes.confirmNote,
        hasException: !!billDetail.cmrHasException,
        exceptionNote: billDetail.cmrExceptionNote,
        exceptionTime: billDetail.cmrExceptionTime,
      }
    } catch {
      return undefined
    }
  }
  
  // 格式化时间
  const formatTime = (time?: string) => {
    if (!time) return '-'
    try {
      return new Date(time).toLocaleString('zh-CN')
    } catch {
      return time
    }
  }
  
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-sm text-gray-500">加载中...</span>
      </div>
    )
  }
  
  if (error || !billDetail) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <XCircle className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-sm text-gray-500">{error || '未找到提单信息'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          返回
        </button>
      </div>
    )
  }
  
  const deliveryStatus = getDeliveryStatusStyle(billDetail.deliveryStatus || '待派送')
  const cmrDetail = parseCMRDetail()
  
  // 判断提单是否已完成（已完成或已归档状态）
  const isCompleted = billDetail?.status === '已完成' || billDetail?.status === '已归档'
  
  // 判断用户是否有财务管理权限（财务人员可以修改已完成的提单）
  const hasFinancePermission = hasPermission('finance:manage') || hasPermission('finance:fee_manage')
  
  // 判断是否可以编辑（未完成 或 有财务权限）
  const canEdit = !isCompleted || hasFinancePermission
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary-600" />
              派送详情
            </h1>
            <p className="text-xs text-gray-500">{billDetail.billNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 已完成提示 */}
          {isCompleted && (
            <div className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200">
              <Lock className="w-3 h-3" />
              <span>已完成</span>
              {!hasFinancePermission && <span className="text-amber-500">（仅财务可改）</span>}
            </div>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${deliveryStatus.bg} ${deliveryStatus.text}`}>
            {deliveryStatus.icon}
            {billDetail.deliveryStatus || '待派送'}
          </span>
          {canEdit && billDetail.deliveryStatus !== '已送达' && billDetail.deliveryStatus !== '已完成' && (
            <button
              onClick={() => setCmrModalVisible(true)}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
            >
              <Truck className="w-3 h-3" />
              {/* 简化为3步流程 */}
              {billDetail.deliveryStatus === '待派送' ? '开始派送' :
               billDetail.cmrActualArrivalTime ? '确认送达' : '更新状态'}
            </button>
          )}
        </div>
      </div>
      
      {/* 标签页 */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50">
        {[
          { key: 'info', label: '派送信息' },
          { key: 'files', label: `文件管理 (${billFiles.length})` },
          { key: 'timeline', label: '时间线' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 派送信息 */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                基本信息
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">提单号</label>
                  <p className="text-xs font-medium text-gray-900 font-mono">{billDetail.billNumber}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">柜号</label>
                  <p className="text-xs text-gray-900">{billDetail.containerNumber || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">货主</label>
                  <p className="text-xs text-gray-900">{billDetail.shipper || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">船公司</label>
                  <p className="text-xs text-gray-900">{billDetail.shippingCompany || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">目的港</label>
                  <p className="text-xs text-gray-900">{billDetail.portOfDischarge || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">交货地</label>
                  <p className="text-xs text-gray-900">{billDetail.placeOfDelivery || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">件数</label>
                  <p className="text-xs text-gray-900">{billDetail.pieces || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">毛重</label>
                  <p className="text-xs text-gray-900">{billDetail.weight ? `${billDetail.weight} KGS` : '-'}</p>
                </div>
              </div>
            </div>
            
            {/* 派送状态 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-3 h-3 text-orange-600" />
                派送状态
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">当前状态</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${deliveryStatus.bg} ${deliveryStatus.text}`}>
                    {deliveryStatus.icon}
                    {billDetail.deliveryStatus || '待派送'}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">服务商</label>
                  <p className="text-xs text-gray-900">{cmrDetail?.serviceProvider || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">预计提货时间</label>
                  <p className="text-xs text-gray-900">{formatTime(cmrDetail?.estimatedPickupTime)}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">预计到达时间</label>
                  <p className="text-xs text-gray-900">{formatTime(cmrDetail?.estimatedArrivalTime)}</p>
                </div>
              </div>
              
              {/* 送达地址 */}
              {cmrDetail?.deliveryAddress && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">送达地址</label>
                      <p className="text-xs text-gray-900">{cmrDetail.deliveryAddress}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 实际时间（简化为3步） */}
              {(cmrDetail?.actualArrivalTime || cmrDetail?.confirmedTime) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">到达时间</label>
                      <p className="text-xs text-gray-900">{formatTime(cmrDetail?.actualArrivalTime)}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">确认送达时间</label>
                      <p className="text-xs text-gray-900">{formatTime(cmrDetail?.confirmedTime)}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 异常信息 */}
              {cmrDetail?.hasException && (
                <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    订单异常
                  </div>
                  {cmrDetail.exceptionNote && (
                    <p className="text-xs text-red-600">{cmrDetail.exceptionNote}</p>
                  )}
                  {cmrDetail.exceptionTime && (
                    <p className="text-[10px] text-red-500 mt-1">
                      异常时间: {formatTime(cmrDetail.exceptionTime)}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* 派送进度（简化为3步） */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3 text-blue-600" />
                派送进度
              </h3>
              <div className="space-y-2">
                {/* 步骤1: 提货 */}
                <div className={`flex items-center gap-2 p-2 rounded ${cmrDetail?.estimatedPickupTime ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    cmrDetail?.estimatedPickupTime ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {cmrDetail?.estimatedPickupTime ? '✓' : '1'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">提货</p>
                    {cmrDetail?.estimatedPickupTime && (
                      <p className="text-[10px] text-gray-500">
                        {formatTime(cmrDetail.estimatedPickupTime)} | 服务商: {cmrDetail.serviceProvider || '-'}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* 步骤2: 到达 */}
                <div className={`flex items-center gap-2 p-2 rounded ${cmrDetail?.actualArrivalTime ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    cmrDetail?.actualArrivalTime ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {cmrDetail?.actualArrivalTime ? '✓' : '2'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">到达</p>
                    {cmrDetail?.actualArrivalTime && (
                      <p className="text-[10px] text-gray-500">{formatTime(cmrDetail.actualArrivalTime)}</p>
                    )}
                    {cmrDetail?.deliveryAddress && (
                      <p className="text-[10px] text-gray-500 truncate max-w-xs">
                        {cmrDetail.deliveryAddress}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* 步骤3: 确认送达 */}
                <div className={`flex items-center gap-2 p-2 rounded ${cmrDetail?.confirmedTime ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    cmrDetail?.confirmedTime ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {cmrDetail?.confirmedTime ? '✓' : '3'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">确认送达</p>
                    {cmrDetail?.confirmedTime && (
                      <p className="text-[10px] text-gray-500">{formatTime(cmrDetail.confirmedTime)}</p>
                    )}
                  </div>
                </div>
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
                {canEdit ? (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
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
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 text-gray-400 cursor-not-allowed">
                    <Lock className="w-3 h-3" />
                    已锁定
                  </span>
                )}
              </div>
              {!canEdit && (
                <div className="flex items-center gap-1 px-2 py-1.5 mb-3 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200">
                  <Lock className="w-3 h-3" />
                  <span>提单已完成，仅财务人员可上传文件</span>
                </div>
              )}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">点击上方按钮或拖拽文件到此处上传</p>
                <p className="text-[10px] text-gray-400 mt-1">支持所有类型文件</p>
              </div>
            </div>
            
            {/* 文件列表 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                文件列表 ({billFiles.length})
              </h3>
              {billFiles.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  暂无文件，请上传文件
                </div>
              ) : (
                <div className="space-y-2">
                  {billFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.fileType)}
                        <div>
                          <p className="text-xs font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-[10px] text-gray-400">
                            {formatFileSize(file.originalSize)} | {new Date(file.uploadTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFileDownload(file.id, file.fileName)}
                          className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                          title="下载"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleFileDelete(file.id, file.fileName)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 时间线 */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3 text-primary-600" />
              派送时间线
            </h3>
            {operationLogs.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                暂无操作记录
              </div>
            ) : (
              <Timeline>
                {operationLogs.map((log) => {
                  const getColor = (type: string, name: string) => {
                    if (type === 'create') return 'blue'
                    if (name.includes('送达') || name.includes('完成')) return 'green'
                    if (name.includes('开始') || name.includes('派送中')) return 'blue'
                    if (name.includes('异常')) return 'red'
                    return 'gray'
                  }
                  
                  const formatLogTime = (time: string) => {
                    try {
                      return new Date(time).toLocaleString('zh-CN')
                    } catch {
                      return time
                    }
                  }
                  
                  return (
                    <TimelineItem
                      key={log.id}
                      color={getColor(log.operationType, log.operationName)}
                      label={formatLogTime(log.operationTime)}
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
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          备注: {log.remark}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        操作人: {log.operator}
                      </div>
                    </TimelineItem>
                  )
                })}
              </Timeline>
            )}
          </div>
        )}
      </div>
      
      {/* CMR模态框 */}
      {billDetail && (
        <CMRModal
          visible={cmrModalVisible}
          onClose={() => setCmrModalVisible(false)}
          billNumber={billDetail.billNumber}
          currentStatus={billDetail.deliveryStatus || '待派送'}
          cmrDetail={cmrDetail}
          defaultDeliveryAddress={billDetail.placeOfDelivery || billDetail.portOfDischarge}
          deliveryAddresses={
            // 从 referenceList 中提取地址列表
            billDetail.referenceList?.filter(ref => ref.consigneeAddress || ref.consigneeAddressDetails).map(ref => ({
              label: ref.referenceNumber || '未命名',
              address: ref.consigneeAddress || '',
              details: ref.consigneeAddressDetails || ref.consigneeAddress || ''
            })) || []
          }
          onSubmit={handleCMRSubmit}
        />
      )}
    </div>
  )
}

