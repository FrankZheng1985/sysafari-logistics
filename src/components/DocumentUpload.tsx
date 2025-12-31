import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Upload, X, File, FileText, FileImage, FileSpreadsheet, 
  FileArchive, Check, AlertTriangle, RefreshCw, Trash2
} from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 获取文件图标
const getFileIcon = (file: File) => {
  const type = file.type
  if (type.startsWith('image/')) return <FileImage className="w-5 h-5 text-green-500" />
  if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
  if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
  if (type.includes('word') || type.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return <FileArchive className="w-5 h-5 text-amber-500" />
  return <File className="w-5 h-5 text-gray-500" />
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 文件状态
type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

interface UploadFile {
  id: string
  file: File
  status: FileStatus
  progress: number
  error?: string
}

interface DocumentType {
  value: string
  label: string
}

interface DocumentUploadProps {
  billId?: string
  billNumber?: string
  customerId?: string
  customerName?: string
  onSuccess?: () => void
  onClose?: () => void
  // 简单模式：直接内嵌在页面中
  embedded?: boolean
  // 默认文档类型
  defaultDocumentType?: string
}

export default function DocumentUpload({
  billId,
  billNumber,
  customerId,
  customerName,
  onSuccess,
  onClose,
  embedded = false,
  defaultDocumentType
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 状态
  const [files, setFiles] = useState<UploadFile[]>([])
  const [documentType, setDocumentType] = useState(defaultDocumentType || 'other')
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
  // 加载文档类型
  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/documents/document-types`)
        const data = await res.json()
        if (data.errCode === 200) {
          setDocumentTypes(data.data || [])
        }
      } catch (error) {
        console.error('加载文档类型失败:', error)
        // 使用默认类型
        setDocumentTypes([
          { value: 'bill_of_lading', label: '提单' },
          { value: 'invoice', label: '发票' },
          { value: 'packing_list', label: '装箱单' },
          { value: 'customs_declaration', label: '报关单' },
          { value: 'contract', label: '合同' },
          { value: 'certificate', label: '证书' },
          { value: 'insurance', label: '保险单' },
          { value: 'delivery_note', label: '送货单/CMR' },
          { value: 'inspection_report', label: '查验报告' },
          { value: 'quotation', label: '报价单' },
          { value: 'payment_receipt', label: '付款凭证' },
          { value: 'other', label: '其他' }
        ])
      }
    }
    loadDocumentTypes()
  }, [])
  
  // 处理文件选择
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    
    const newFiles: UploadFile[] = Array.from(selectedFiles).map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending' as FileStatus,
      progress: 0
    }))
    
    setFiles(prev => [...prev, ...newFiles])
  }, [])
  
  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])
  
  // 移除文件
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }
  
  // 上传单个文件
  const uploadSingleFile = async (uploadFile: UploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('documentType', documentType)
    if (billId) formData.append('billId', billId)
    if (billNumber) formData.append('billNumber', billNumber)
    if (customerId) formData.append('customerId', customerId)
    if (customerName) formData.append('customerName', customerName)
    if (description) formData.append('description', description)
    
    try {
      // 更新状态为上传中
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading' as FileStatus, progress: 0 } : f
      ))
      
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'success' as FileStatus, progress: 100 } : f
        ))
        return true
      } else {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'error' as FileStatus, error: data.msg || '上传失败' } : f
        ))
        return false
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { 
          ...f, 
          status: 'error' as FileStatus, 
          error: error instanceof Error ? error.message : '上传失败' 
        } : f
      ))
      return false
    }
  }
  
  // 开始上传
  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) {
      alert('没有待上传的文件')
      return
    }
    
    setUploading(true)
    
    let successCount = 0
    for (const file of pendingFiles) {
      const success = await uploadSingleFile(file)
      if (success) successCount++
    }
    
    setUploading(false)
    
    if (successCount > 0) {
      onSuccess?.()
    }
    
    if (successCount === pendingFiles.length) {
      // 全部成功
      setTimeout(() => {
        onClose?.()
      }, 1000)
    }
  }
  
  // 重试上传
  const retryUpload = async (uploadFile: UploadFile) => {
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'pending' as FileStatus, error: undefined } : f
    ))
    await uploadSingleFile(uploadFile)
  }
  
  const content = (
    <div className="space-y-4">
      {/* 文档类型选择 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">文档类型</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          title="选择文档类型"
        >
          {documentTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>
      
      {/* 描述 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">描述（可选）</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入文档描述..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      
      {/* 关联信息 */}
      {(billNumber || customerName) && (
        <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <div className="font-medium mb-1">关联信息</div>
          {billNumber && <div>订单号: {billNumber}</div>}
          {customerName && <div>客户: {customerName}</div>}
        </div>
      )}
      
      {/* 拖拽上传区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver 
            ? 'border-primary-400 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400'
        } ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} />
        <p className="text-sm text-gray-600 mb-1">
          {dragOver ? '释放文件以上传' : '点击或拖拽文件到此处上传'}
        </p>
        <p className="text-xs text-gray-400">
          支持 PDF、Word、Excel、图片等格式，单文件最大 50MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.zip,.rar,.7z"
          title="选择文件"
        />
      </div>
      
      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-700">
            已选择 {files.length} 个文件
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map(uploadFile => (
              <div 
                key={uploadFile.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  uploadFile.status === 'success' ? 'border-green-200 bg-green-50' :
                  uploadFile.status === 'error' ? 'border-red-200 bg-red-50' :
                  uploadFile.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                {getFileIcon(uploadFile.file)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {uploadFile.file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(uploadFile.file.size)}
                    {uploadFile.status === 'uploading' && (
                      <span className="ml-2 text-blue-600">上传中...</span>
                    )}
                    {uploadFile.status === 'success' && (
                      <span className="ml-2 text-green-600">上传成功</span>
                    )}
                    {uploadFile.status === 'error' && (
                      <span className="ml-2 text-red-600">{uploadFile.error || '上传失败'}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {uploadFile.status === 'success' && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <button
                      onClick={() => retryUpload(uploadFile)}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                      title="重试"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {uploadFile.status === 'uploading' && (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {(uploadFile.status === 'pending' || uploadFile.status === 'error') && (
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-500"
                      title="移除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        {onClose && (
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            取消
          </button>
        )}
        <button
          onClick={handleUpload}
          disabled={uploading || files.filter(f => f.status === 'pending').length === 0}
          className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              开始上传
            </>
          )}
        </button>
      </div>
    </div>
  )
  
  // 内嵌模式直接返回内容
  if (embedded) {
    return <div className="bg-white rounded-lg p-4">{content}</div>
  }
  
  // 弹窗模式
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">上传文档</h3>
          <button 
            onClick={onClose}
            disabled={uploading}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            title="关闭"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {content}
        </div>
      </div>
    </div>
  )
}
