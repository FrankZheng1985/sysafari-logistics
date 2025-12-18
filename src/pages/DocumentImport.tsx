import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, Upload, Download, FileSpreadsheet, 
  Check, X, AlertTriangle, RefreshCw, Trash2, Eye
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

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
  billNumber: string
  productName: string
  productNameEn: string
  hsCode: string
  quantity: number
  unit: string
  unitPrice: number
  totalValue: number
  grossWeight: number
  netWeight: number
  originCountry: string
  material: string
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

  useEffect(() => {
    loadImports()
  }, [page])

  const loadImports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/imports?page=${page}&pageSize=${pageSize}`)
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
    // 生成CSV模板
    const headers = [
      '柜号', '提单号', '商品名称', '英文品名', 'HS编码',
      '数量', '单位', '单价(EUR)', '货值(EUR)', '毛重(KG)',
      '净重(KG)', '原产国', '材质'
    ]
    const sampleData = [
      'MSKU1234567', 'BL2024010001', '男式棉质T恤', "Men's Cotton T-shirt", '61091000',
      '1000', 'PCS', '5.50', '5500.00', '250',
      '200', 'CN', '100%棉'
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

    try {
      const res = await fetch(`${API_BASE}/api/documents/imports/preview`, {
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
      alert('解析文件失败')
    }
  }

  const handleConfirmImport = async () => {
    if (!previewFile) return

    const hasErrors = previewData.some(item => item.error)
    if (hasErrors) {
      if (!confirm('部分数据存在错误，是否仍要继续导入？错误数据将被跳过。')) {
        return
      }
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', previewFile)

    try {
      const res = await fetch(`${API_BASE}/api/documents/imports`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`导入成功！共导入 ${data.data?.importedCount || 0} 条记录`)
        setShowPreview(false)
        setPreviewData([])
        setPreviewFile(null)
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
      const res = await fetch(`${API_BASE}/api/documents/imports/${id}`, {
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
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || styles.pending}`}>
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

        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-1">点击或拖拽文件到此处上传</p>
          <p className="text-xs text-gray-400">支持 CSV, Excel (.xlsx, .xls) 格式</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            title="选择文件"
          />
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
          <p className="font-medium mb-1">模板说明：</p>
          <ul className="space-y-0.5 text-blue-600">
            <li>• 必填字段：柜号、商品名称、数量、单位、单价、毛重、原产国</li>
            <li>• 可选字段：提单号、英文品名、HS编码、净重、材质</li>
            <li>• 金额单位默认为欧元(EUR)，重量单位默认为千克(KG)</li>
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
                    <th className="px-2 py-2 text-left font-medium text-gray-500">行号</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">柜号</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">商品名称</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">HS编码</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">数量</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">单位</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">单价</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">货值</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">毛重</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">原产国</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item) => (
                    <tr 
                      key={item.rowNo} 
                      className={`border-b ${item.error ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-2 py-2 text-gray-500">{item.rowNo}</td>
                      <td className="px-2 py-2">{item.containerNo}</td>
                      <td className="px-2 py-2 max-w-[150px] truncate" title={item.productName}>
                        {item.productName}
                      </td>
                      <td className="px-2 py-2">{item.hsCode || '-'}</td>
                      <td className="px-2 py-2 text-right">{item.quantity}</td>
                      <td className="px-2 py-2">{item.unit}</td>
                      <td className="px-2 py-2 text-right">€{item.unitPrice.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right">€{item.totalValue.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right">{item.grossWeight}</td>
                      <td className="px-2 py-2">{item.originCountry}</td>
                      <td className="px-2 py-2">
                        {item.error ? (
                          <span className="flex items-center gap-1 text-red-600" title={item.error}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            错误
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
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
                <th className="px-4 py-2 text-left font-medium text-gray-500">批次号</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">客户</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">柜号</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">提单号</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">商品数</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">匹配进度</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">状态</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">导入时间</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">操作</th>
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
                    <td className="px-4 py-2 font-medium text-primary-600">{item.importNo}</td>
                    <td className="px-4 py-2">{item.customerName || '-'}</td>
                    <td className="px-4 py-2">{item.containerNo || '-'}</td>
                    <td className="px-4 py-2">{item.billNumber || '-'}</td>
                    <td className="px-4 py-2 text-center">{item.totalItems}</td>
                    <td className="px-4 py-2 text-center">
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
                    <td className="px-4 py-2 text-center">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-4 py-2">
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
