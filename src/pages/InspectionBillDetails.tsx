import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, ClipboardCheck, Package, FileText, Clock, 
  Upload, Download, Trash2, File, Image, FileArchive, Loader2,
  CheckCircle, AlertCircle, XCircle
} from 'lucide-react'
import Timeline, { TimelineItem } from '../components/Timeline'
import InspectionModal, { type InspectionDetail } from '../components/InspectionModal'
import { formatDateTime } from '../utils/dateFormat'
import { 
  getBillById, 
  getBillOperationLogs, 
  getBillFiles, 
  uploadBillFile, 
  downloadBillFile, 
  deleteBillFile,
  updateBillInspection,
  type BillOfLading,
  type OperationLog,
  type BillFile,
  type InspectionDetailData
} from '../utils/api'

export default function InspectionBillDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
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
  
  // 查验模态框
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false)
  
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
        // 过滤查验相关的日志
        const inspectionLogs = response.data.filter(log => 
          log.operationType === 'inspection' || 
          log.operationName.includes('查验') ||
          log.operationType === 'create'
        )
        setOperationLogs(inspectionLogs)
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
  
  // 获取查验状态样式
  const getInspectionStatusStyle = (status: string) => {
    switch (status) {
      case '待查验':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Clock className="w-3 h-3" /> }
      case '查验中':
        return { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> }
      case '已查验':
        return { bg: 'bg-blue-100', text: 'text-blue-700', icon: <CheckCircle className="w-3 h-3" /> }
      case '查验放行':
        return { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: <CheckCircle className="w-3 h-3" /> }
      case '已放行':
        return { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: <AlertCircle className="w-3 h-3" /> }
    }
  }
  
  // 获取查验结果样式
  const getResultStyle = (result: string) => {
    switch (result) {
      case 'pass':
        return { bg: 'bg-green-100', text: 'text-green-700', label: '查验通过', icon: <CheckCircle className="w-4 h-4" /> }
      case 'second_inspection':
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: '需二次查验', icon: <AlertCircle className="w-4 h-4" /> }
      case 'fail':
        return { bg: 'bg-red-100', text: 'text-red-700', label: '查验不通过', icon: <XCircle className="w-4 h-4" /> }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: '待查验', icon: <Clock className="w-4 h-4" /> }
    }
  }
  
  // 查验模态框提交
  const handleInspectionSubmit = async (data: { status: string; detail: InspectionDetail }) => {
    if (!id) return
    
    const detailData: InspectionDetailData = {
      items: data.detail.items,
      estimatedTime: data.detail.estimatedTime,
      actualStartTime: data.detail.actualStartTime,
      actualEndTime: data.detail.actualEndTime,
      result: data.detail.result,
      resultNote: data.detail.resultNote,
      releaseTime: data.detail.releaseTime,
      confirmedTime: data.detail.confirmedTime,
    }
    
    const response = await updateBillInspection(id, data.status, detailData)
    if (response.errCode === 200) {
      setBillDetail(prev => prev ? { ...prev, ...response.data } : null)
      await loadOperationLogs()
      alert('查验状态已更新')
    } else {
      throw new Error(response.msg || '更新失败')
    }
  }
  
  // 解析查验详情
  const parseInspectionDetail = (): InspectionDetail | undefined => {
    if (!billDetail) return undefined
    
    try {
      const items = billDetail.inspectionDetail 
        ? (typeof billDetail.inspectionDetail === 'string' 
            ? JSON.parse(billDetail.inspectionDetail) 
            : billDetail.inspectionDetail)
        : []
      
      return {
        items,
        estimatedTime: billDetail.inspectionEstimatedTime,
        actualStartTime: billDetail.inspectionStartTime,
        actualEndTime: billDetail.inspectionEndTime,
        result: billDetail.inspectionResult as 'pass' | 'second_inspection' | 'fail' | undefined,
        resultNote: billDetail.inspectionResultNote,
        releaseTime: billDetail.inspectionReleaseTime,
        confirmedTime: billDetail.inspectionConfirmedTime,
      }
    } catch {
      return undefined
    }
  }
  
  // 格式化时间
  const formatTime = (time?: string) => {
    return formatDateTime(time)
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
  
  const inspectionStatus = getInspectionStatusStyle(billDetail.inspection)
  const inspectionDetail = parseInspectionDetail()
  
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
              <ClipboardCheck className="w-4 h-4 text-primary-600" />
              查验详情
            </h1>
            <p className="text-xs text-gray-500">{billDetail.billNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${inspectionStatus.bg} ${inspectionStatus.text}`}>
            {inspectionStatus.icon}
            {billDetail.inspection}
          </span>
          {billDetail.inspection !== '已放行' && (
            <button
              onClick={() => setInspectionModalVisible(true)}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
            >
              <ClipboardCheck className="w-3 h-3" />
              查验操作
            </button>
          )}
        </div>
      </div>
      
      {/* 标签页 */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50">
        {[
          { key: 'info', label: '查验信息' },
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
        {/* 查验信息 */}
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
                  <label className="block text-[10px] text-gray-500 mb-0.5">船名</label>
                  <p className="text-xs text-gray-900">{billDetail.vesselName || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">航次</label>
                  <p className="text-xs text-gray-900">{billDetail.voyage || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">目的港</label>
                  <p className="text-xs text-gray-900">{billDetail.destinationPort || '-'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">ETA</label>
                  <p className="text-xs text-gray-900">{billDetail.eta || '-'}</p>
                </div>
              </div>
            </div>
            
            {/* 查验状态 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-3 h-3 text-yellow-600" />
                查验状态
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">当前状态</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${inspectionStatus.bg} ${inspectionStatus.text}`}>
                    {inspectionStatus.icon}
                    {billDetail.inspection}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">预计查验时间</label>
                  <p className="text-xs text-gray-900">{formatTime(inspectionDetail?.estimatedTime)}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">开始查验时间</label>
                  <p className="text-xs text-gray-900">{formatTime(inspectionDetail?.actualStartTime)}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">完成查验时间</label>
                  <p className="text-xs text-gray-900">{formatTime(inspectionDetail?.actualEndTime)}</p>
                </div>
              </div>
              
              {/* 查验结果 */}
              {inspectionDetail?.result && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">查验结果</label>
                      {(() => {
                        const resultStyle = getResultStyle(inspectionDetail.result || '')
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${resultStyle.bg} ${resultStyle.text}`}>
                            {resultStyle.icon}
                            {resultStyle.label}
                          </span>
                        )
                      })()}
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">放行时间</label>
                      <p className="text-xs text-gray-900">{formatTime(inspectionDetail?.releaseTime)}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">确认放行时间</label>
                      <p className="text-xs text-gray-900">{formatTime(inspectionDetail?.confirmedTime)}</p>
                    </div>
                  </div>
                  {inspectionDetail.resultNote && (
                    <div className="mt-2">
                      <label className="block text-[10px] text-gray-500 mb-0.5">备注</label>
                      <p className="text-xs text-gray-900 bg-gray-50 p-2 rounded">{inspectionDetail.resultNote}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* 查验货物列表 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-3 h-3 text-blue-600" />
                查验货物 ({inspectionDetail?.items?.length || 0})
              </h3>
              {!inspectionDetail?.items || inspectionDetail.items.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  暂无查验货物记录
                </div>
              ) : (
                <div className="space-y-2">
                  {inspectionDetail.items.map((item, index) => (
                    <div 
                      key={item.id || index}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded"
                    >
                      <div className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-[10px] font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-400">HS Code</label>
                          <p className="text-xs font-mono text-primary-600">{item.hsCode}</p>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400">品名</label>
                          <p className="text-xs text-gray-900">{item.productName}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              </div>
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
                        <button
                          onClick={() => handleFileDelete(file.id, file.fileName)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
              查验时间线
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
                    if (name.includes('放行')) return 'green'
                    if (name.includes('开始') || name.includes('查验中')) return 'blue'
                    if (name.includes('完成') || name.includes('已查验')) return 'blue'
                    if (name.includes('标记')) return 'gray'
                    return 'gray'
                  }
                  
                  const formatLogTime = (time: string) => {
                    return formatDateTime(time)
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
      
      {/* 查验模态框 */}
      {billDetail && (
        <InspectionModal
          visible={inspectionModalVisible}
          onClose={() => setInspectionModalVisible(false)}
          billId={id || ''}
          billNumber={billDetail.billNumber}
          currentStatus={billDetail.inspection}
          inspectionDetail={inspectionDetail}
          onSubmit={handleInspectionSubmit}
        />
      )}
    </div>
  )
}

