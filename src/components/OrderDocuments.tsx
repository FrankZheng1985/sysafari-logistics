import { useState, useEffect, useCallback } from 'react'
import { 
  FileText, Upload, Download, Trash2, Eye, RefreshCw, 
  FolderOpen, File, FileImage, FileSpreadsheet, FileArchive, X, Cloud
} from 'lucide-react'
import DocumentUpload from './DocumentUpload'
import { getApiBaseUrl } from '../utils/api'
import { formatDateTime } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

// 文档类型图标映射
const getDocTypeIcon = (type: string, mimeType?: string) => {
  if (mimeType?.startsWith('image/')) return <FileImage className="w-4 h-4 text-green-500" />
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
  if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('7z')) return <FileArchive className="w-4 h-4 text-amber-500" />
  
  switch (type) {
    case 'bill_of_lading': return <FileText className="w-4 h-4 text-blue-500" />
    case 'invoice': return <FileText className="w-4 h-4 text-purple-500" />
    case 'packing_list': return <FileSpreadsheet className="w-4 h-4 text-teal-500" />
    case 'customs_declaration': return <FileText className="w-4 h-4 text-orange-500" />
    case 'contract': return <FileText className="w-4 h-4 text-indigo-500" />
    default: return <File className="w-4 h-4 text-gray-500" />
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}


interface Document {
  id: string
  documentName: string
  originalName: string
  documentType: string
  documentTypeLabel: string
  cosKey: string
  cosUrl: string
  fileSize: number
  mimeType: string
  uploadedByName: string
  uploadTime: string
}

interface GroupedDocuments {
  type: string
  label: string
  documents: Document[]
}

interface OrderDocumentsProps {
  billId: string
  billNumber?: string
  customerId?: string
  customerName?: string
  // 是否显示上传按钮
  showUpload?: boolean
  // 紧凑模式（用于嵌入其他页面）
  compact?: boolean
}

export default function OrderDocuments({
  billId,
  billNumber,
  customerId,
  customerName,
  showUpload = true,
  compact = false
}: OrderDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [groupedDocuments, setGroupedDocuments] = useState<GroupedDocuments[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped')
  
  // 加载文档列表
  const loadDocuments = useCallback(async () => {
    if (!billId) return
    
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/order/${billId}?grouped=true`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        if (Array.isArray(data.data) && data.data[0]?.documents) {
          // 分组数据
          setGroupedDocuments(data.data)
          const allDocs = data.data.flatMap((g: GroupedDocuments) => g.documents)
          setDocuments(allDocs)
        } else {
          // 平铺数据
          setDocuments(data.data || [])
          setGroupedDocuments([])
        }
      }
    } catch (error) {
      console.error('加载订单文档失败:', error)
    } finally {
      setLoading(false)
    }
  }, [billId])
  
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])
  
  // 预览文档
  const handlePreview = async (doc: Document) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}/preview-url`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        if (doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf') {
          setPreviewUrl(data.data.url)
          setPreviewFileName(doc.originalName)
        } else {
          window.open(data.data.url, '_blank')
        }
      } else {
        alert(data.msg || '获取预览链接失败')
      }
    } catch (error) {
      console.error('预览文档失败:', error)
      alert('预览失败')
    }
  }
  
  // 下载文档
  const handleDownload = async (doc: Document) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}/download-url`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        window.open(data.data.url, '_blank')
      } else {
        alert(data.msg || '获取下载链接失败')
      }
    } catch (error) {
      console.error('下载文档失败:', error)
      alert('下载失败')
    }
  }
  
  // 删除文档
  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`确定要删除文档 "${doc.documentName}" 吗？`)) return
    
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        loadDocuments()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除文档失败:', error)
      alert('删除失败')
    }
  }
  
  // 上传成功回调
  const handleUploadSuccess = () => {
    setUploadModalVisible(false)
    loadDocuments()
  }
  
  // 渲染单个文档行
  const renderDocumentRow = (doc: Document) => (
    <div 
      key={doc.id}
      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 group"
    >
      {getDocTypeIcon(doc.documentType, doc.mimeType)}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-900 truncate" title={doc.documentName}>
          {doc.documentName}
        </div>
        <div className="text-[10px] text-gray-400 flex items-center gap-2">
          <span>{formatFileSize(doc.fileSize)}</span>
          <span>•</span>
          <span>{doc.uploadedByName || '未知'}</span>
          <span>•</span>
          <span>{formatDateTime(doc.uploadTime)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => handlePreview(doc)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-primary-600"
          title="预览"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleDownload(doc)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-green-600"
          title="下载"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleDelete(doc)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-red-600"
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-xs text-gray-500">加载中...</span>
      </div>
    )
  }
  
  return (
    <div className={compact ? '' : 'bg-white rounded-lg border border-gray-200 p-4'}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900">
            订单文档
          </span>
          <span className="text-xs text-gray-400">
            ({documents.length} 个文件)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDocuments}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {showUpload && (
            <button
              onClick={() => setUploadModalVisible(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
            >
              <Upload className="w-3.5 h-3.5" />
              上传文档
            </button>
          )}
        </div>
      </div>
      
      {/* 文档列表 */}
      {documents.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-1">暂无文档</p>
          <p className="text-xs text-gray-400 mb-4">上传的文档将存储到腾讯云COS</p>
          {showUpload && (
            <button
              onClick={() => setUploadModalVisible(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
            >
              <Upload className="w-3.5 h-3.5" />
              上传文档
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' && groupedDocuments.length > 0 ? (
        // 分组视图
        <div className="space-y-4">
          {groupedDocuments.map(group => (
            <div key={group.type}>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                {group.label} ({group.documents.length})
              </div>
              <div className="space-y-1 border-l-2 border-gray-200 pl-3">
                {group.documents.map(doc => renderDocumentRow(doc))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 列表视图
        <div className="space-y-1">
          {documents.map(doc => renderDocumentRow(doc))}
        </div>
      )}
      
      {/* 上传弹窗 */}
      {uploadModalVisible && (
        <DocumentUpload
          billId={billId}
          billNumber={billNumber}
          customerId={customerId}
          customerName={customerName}
          onSuccess={handleUploadSuccess}
          onClose={() => setUploadModalVisible(false)}
        />
      )}
      
      {/* 预览弹窗 */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
              title="关闭预览"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-white text-sm mb-2">{previewFileName}</div>
            {previewUrl.includes('.pdf') || previewFileName.endsWith('.pdf') ? (
              <iframe
                src={previewUrl}
                className="w-[80vw] h-[80vh] bg-white rounded"
                title="PDF Preview"
              />
            ) : (
              <img
                src={previewUrl}
                alt={previewFileName}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
