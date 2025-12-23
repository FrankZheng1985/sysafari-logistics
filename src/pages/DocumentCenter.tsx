import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileText, Upload, Download, Trash2, Eye, RefreshCw, 
  Filter, FolderOpen, Link, Unlink, Search, MoreVertical,
  File, FileImage, FileSpreadsheet, FileArchive, Check, X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DocumentUpload from '../components/DocumentUpload'
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
    case 'certificate': return <FileText className="w-4 h-4 text-cyan-500" />
    default: return <File className="w-4 h-4 text-gray-500" />
  }
}

// 文档类型标签样式
const getDocTypeBadge = (type: string, label: string) => {
  const styles: Record<string, string> = {
    bill_of_lading: 'bg-blue-100 text-blue-700',
    invoice: 'bg-purple-100 text-purple-700',
    packing_list: 'bg-teal-100 text-teal-700',
    customs_declaration: 'bg-orange-100 text-orange-700',
    contract: 'bg-indigo-100 text-indigo-700',
    certificate: 'bg-cyan-100 text-cyan-700',
    insurance: 'bg-pink-100 text-pink-700',
    delivery_note: 'bg-emerald-100 text-emerald-700',
    inspection_report: 'bg-amber-100 text-amber-700',
    quotation: 'bg-violet-100 text-violet-700',
    payment_receipt: 'bg-rose-100 text-rose-700',
    other: 'bg-gray-100 text-gray-700'
  }
  
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${styles[type] || styles.other}`}>
      {label}
    </span>
  )
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
  documentNumber: string
  documentName: string
  originalName: string
  documentType: string
  documentTypeLabel: string
  billId: string | null
  billNumber: string | null
  orderNumber: string | null  // 订单号
  customerId: string | null
  customerName: string | null
  cosKey: string
  cosUrl: string
  fileSize: number
  fileSizeFormatted: string
  mimeType: string
  fileExtension: string
  accessLevel: string
  isPublic: boolean
  description: string | null
  tags: string[]
  version: number
  uploadedBy: string
  uploadedByName: string
  uploadTime: string
  status: string
}

interface DocumentType {
  value: string
  label: string
}

interface Stats {
  total: { count: number; totalSize: number }
  byType: { type: string; label: string; count: number; totalSize: number }[]
}

export default function DocumentCenter() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // 状态
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  
  // 筛选条件
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '')
  const [selectedBillId] = useState(searchParams.get('billId') || '')
  
  // 上传弹窗
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  
  // 选中项
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // 预览弹窗
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  
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
      }
    }
    loadDocumentTypes()
  }, [])
  
  // 加载文档列表
  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())
      if (search) params.set('search', search)
      if (selectedType) params.set('documentType', selectedType)
      if (selectedBillId) params.set('billId', selectedBillId)
      
      const res = await fetch(`${API_BASE}/api/documents?${params.toString()}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setDocuments(data.data || [])
        setTotal(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('加载文档列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search, selectedType, selectedBillId])
  
  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedBillId) params.set('billId', selectedBillId)
      
      const res = await fetch(`${API_BASE}/api/documents/stats?${params.toString()}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }, [selectedBillId])
  
  useEffect(() => {
    loadDocuments()
    loadStats()
  }, [loadDocuments, loadStats])
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    setSearchParams(params)
  }
  
  // 类型筛选
  const handleTypeFilter = (type: string) => {
    setSelectedType(type)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (type) {
      params.set('type', type)
    } else {
      params.delete('type')
    }
    setSearchParams(params)
  }
  
  // 预览文档
  const handlePreview = async (doc: Document) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}/preview-url`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        // 图片和PDF直接预览
        if (doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf') {
          setPreviewUrl(data.data.url)
          setPreviewFileName(doc.originalName)
        } else {
          // 其他文件类型直接下载
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
        loadStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除文档失败:', error)
      alert('删除失败')
    }
  }
  
  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的文档')
      return
    }
    
    if (!window.confirm(`确定要删除选中的 ${selectedIds.length} 个文档吗？`)) return
    
    try {
      const res = await fetch(`${API_BASE}/api/documents/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setSelectedIds([])
        loadDocuments()
        loadStats()
      } else {
        alert(data.msg || '批量删除失败')
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      alert('批量删除失败')
    }
  }
  
  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(documents.map(d => d.id))
    }
  }
  
  // 上传成功回调
  const handleUploadSuccess = () => {
    setUploadModalVisible(false)
    loadDocuments()
    loadStats()
  }
  
  // 刷新
  const handleRefresh = () => {
    loadDocuments()
    loadStats()
  }
  
  const totalPages = Math.ceil(total / pageSize)
  
  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="文档中心"
        icon={<FolderOpen className="w-5 h-5 text-primary-600" />}
        searchPlaceholder="搜索文档名称、订单号..."
        defaultSearchValue={search}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        actionButtons={
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除 ({selectedIds.length})
              </button>
            )}
            <button
              onClick={() => setUploadModalVisible(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
            >
              <Upload className="w-3.5 h-3.5" />
              上传文档
            </button>
          </div>
        }
      />
      
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">全部文档</div>
            <div className="text-lg font-semibold text-gray-900">{stats.total.count}</div>
            <div className="text-[10px] text-gray-400">{formatFileSize(stats.total.totalSize)}</div>
          </div>
          {stats.byType.slice(0, 5).map(item => (
            <div 
              key={item.type} 
              className={`bg-white rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedType === item.type ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTypeFilter(selectedType === item.type ? '' : item.type)}
            >
              <div className="text-xs text-gray-500 mb-1">{item.label}</div>
              <div className="text-lg font-semibold text-gray-900">{item.count}</div>
              <div className="text-[10px] text-gray-400">{formatFileSize(item.totalSize)}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">类型：</span>
          <button
            onClick={() => handleTypeFilter('')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              !selectedType ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {documentTypes.map(type => (
            <button
              key={type.value}
              onClick={() => handleTypeFilter(type.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedType === type.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* 文档列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === documents.length && documents.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                    title="全选"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">文档</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">类型</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">订单号</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">提单号</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">大小</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">上传者</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">上传时间</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    暂无文档
                  </td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, doc.id])
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== doc.id))
                          }
                        }}
                        className="rounded border-gray-300"
                        title={`选择 ${doc.documentName}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getDocTypeIcon(doc.documentType, doc.mimeType)}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]" title={doc.documentName}>
                            {doc.documentName}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[200px]" title={doc.originalName}>
                            {doc.originalName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {getDocTypeBadge(doc.documentType, doc.documentTypeLabel)}
                    </td>
                    <td className="px-3 py-2">
                      {doc.orderNumber ? (
                        <button
                          onClick={() => navigate(`/bookings/bill/${doc.billId}`)}
                          className="text-primary-600 hover:underline text-xs font-medium"
                        >
                          {doc.orderNumber}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {doc.billNumber ? (
                        <button
                          onClick={() => navigate(`/bookings/bill/${doc.billId}`)}
                          className="text-gray-600 hover:underline text-xs"
                        >
                          {doc.billNumber}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {doc.fileSizeFormatted || formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {doc.uploadedByName || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {formatDateTime(doc.uploadTime)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                          title="预览"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600"
                          title="下载"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
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
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <span className="text-sm text-gray-700">
            共 <span className="font-medium">{total}</span> 条记录
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-gray-700">
              第 {page} / {totalPages || 1} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
      
      {/* 上传弹窗 */}
      {uploadModalVisible && (
        <DocumentUpload
          billId={selectedBillId || undefined}
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
