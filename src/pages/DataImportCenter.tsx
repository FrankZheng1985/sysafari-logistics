/**
 * 数据导入中心
 * 支持订单、费用、客户、服务商、HS记录的Excel导入
 */

import { useState, useCallback } from 'react'
import { 
  Upload, FileSpreadsheet, Download, CheckCircle, XCircle, 
  AlertTriangle, Loader2, RefreshCw, FileText, Users, 
  Truck, Package, Database, TrendingUp, TrendingDown
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 导入类型配置
const IMPORT_TYPES = [
  { 
    id: 'orders', 
    name: '订单数据', 
    icon: FileText,
    description: '导入提单、运单等订单信息',
    color: 'blue'
  },
  { 
    id: 'receivable_fees', 
    name: '应收费用', 
    icon: TrendingUp,
    description: '导入销售报价（向客户收取）',
    color: 'green'
  },
  { 
    id: 'payable_fees', 
    name: '应付费用', 
    icon: TrendingDown,
    description: '导入服务成本（支付给服务商）',
    color: 'amber'
  },
  { 
    id: 'customers', 
    name: '客户数据', 
    icon: Users,
    description: '导入客户信息和联系人',
    color: 'purple'
  },
  { 
    id: 'providers', 
    name: '服务商数据', 
    icon: Truck,
    description: '导入运输、清关、拖车服务商',
    color: 'orange'
  },
  { 
    id: 'hs_records', 
    name: 'HS匹配记录', 
    icon: Package,
    description: '导入商品HS编码匹配记录',
    color: 'cyan'
  }
]

interface PreviewData {
  previewId: string
  fileName: string
  totalRows: number
  validRows: number
  errorRows: number
  warningRows: number
  columns: string[]
  preview: any[]
  errors: Array<{ row: number; errors: string[] }>
  warnings: Array<{ row: number; warnings: string[] }>
}

export default function DataImportCenter() {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [step, setStep] = useState<'select' | 'upload' | 'preview' | 'result'>('select')

  // 下载模板
  const downloadTemplate = async (type: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/data-import/templates/${type}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${IMPORT_TYPES.find(t => t.id === type)?.name}导入模板.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('下载模板失败:', error)
      alert('下载模板失败')
    }
  }

  // 选择文件
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreviewData(null)
      setImportResult(null)
    }
  }, [])

  // 上传并预览
  const handleUploadPreview = async () => {
    if (!file || !selectedType) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE}/api/data-import/preview/${selectedType}`, {
        method: 'POST',
        body: formData
      })

      // 检查 HTTP 状态
      if (!response.ok) {
        const errorText = await response.text()
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.msg || errorJson.message || errorMsg
        } catch {
          // 非 JSON 响应
        }
        alert(`预览失败: ${errorMsg}`)
        return
      }

      const result = await response.json()

      if (result.errCode === 200) {
        setPreviewData(result.data)
        setStep('preview')
      } else {
        alert(result.msg || '预览失败，请检查文件格式是否正确')
      }
    } catch (error: any) {
      console.error('预览失败:', error)
      // 提供更详细的错误信息
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert('网络请求失败，请检查网络连接或稍后重试')
      } else {
        alert(`预览失败: ${error.message || '未知错误'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // 确认导入
  const handleConfirmImport = async (skipErrors = false) => {
    if (!previewData || !selectedType) return

    setLoading(true)
    try {
      // 设置 5 分钟超时（大量数据导入需要较长时间）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)
      
      const response = await fetch(`${API_BASE}/api/data-import/confirm/${selectedType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId: previewData.previewId,
          skipErrors
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      // 检查 HTTP 状态
      if (!response.ok) {
        const errorText = await response.text()
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.msg || errorJson.message || errorMsg
        } catch {
          // 非 JSON 响应
        }
        alert(`导入失败: ${errorMsg}`)
        return
      }

      const result = await response.json()

      if (result.errCode === 200) {
        setImportResult(result.data)
        setStep('result')
      } else {
        alert(result.msg || '导入失败，请稍后重试')
      }
    } catch (error: any) {
      console.error('导入失败:', error)
      if (error.name === 'AbortError') {
        alert('导入超时，数据量较大时请耐心等待。如果问题持续，请联系管理员。')
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert('网络请求失败，请检查网络连接或稍后重试')
      } else {
        alert(`导入失败: ${error.message || '未知错误'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // 重置
  const handleReset = () => {
    setSelectedType(null)
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setStep('select')
  }

  // 选择类型后
  const handleSelectType = (type: string) => {
    setSelectedType(type)
    setStep('upload')
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="数据导入中心"
        icon={<Upload className="w-5 h-5 text-primary-600" />}
      />

      {/* 步骤指示器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {['select', 'upload', 'preview', 'result'].map((s, index) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-primary-600 text-white' :
                ['select', 'upload', 'preview', 'result'].indexOf(step) > index ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {['select', 'upload', 'preview', 'result'].indexOf(step) > index ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={`ml-2 text-sm ${step === s ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                {s === 'select' ? '选择类型' : s === 'upload' ? '上传文件' : s === 'preview' ? '预览确认' : '导入结果'}
              </span>
              {index < 3 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  ['select', 'upload', 'preview', 'result'].indexOf(step) > index ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤1: 选择导入类型 */}
      {step === 'select' && (
        <div className="grid grid-cols-6 gap-4">
          {IMPORT_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <div
                key={type.id}
                onClick={() => handleSelectType(type.id)}
                className={`bg-white rounded-lg border-2 px-6 pt-6 pb-3 cursor-pointer transition-all hover:shadow-lg flex flex-col h-[200px] ${
                  selectedType === type.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-lg bg-${type.color}-100 flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 text-${type.color}-600`} />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{type.name}</h3>
                <p className="text-xs text-gray-500 flex-grow">{type.description}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadTemplate(type.id) }}
                  className="mt-auto pt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  下载模板
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 步骤2: 上传文件 */}
      {step === 'upload' && selectedType && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {(() => {
                const type = IMPORT_TYPES.find(t => t.id === selectedType)
                const Icon = type?.icon || FileText
                return (
                  <>
                    <div className={`w-10 h-10 rounded-lg bg-${type?.color}-100 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 text-${type?.color}-600`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{type?.name}</h3>
                      <p className="text-sm text-gray-500">{type?.description}</p>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplate(selectedType)}
                className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                返回
              </button>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {file ? file.name : '点击或拖拽文件到此处上传'}
              </p>
              <p className="text-sm text-gray-400">支持 .xlsx, .xls, .csv 格式，最大 50MB</p>
            </label>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">{file.name}</span>
                <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                onClick={handleUploadPreview}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                上传并预览
              </button>
            </div>
          )}
        </div>
      )}

      {/* 步骤3: 预览数据 */}
      {step === 'preview' && previewData && (
        <div className="space-y-4">
          {/* 统计信息 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{previewData.totalRows}</div>
              <div className="text-sm text-gray-500">总行数</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-green-600">{previewData.validRows}</div>
              <div className="text-sm text-gray-500">有效行数</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-amber-600">{previewData.warningRows}</div>
              <div className="text-sm text-gray-500">警告行数</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-bold text-red-600">{previewData.errorRows}</div>
              <div className="text-sm text-gray-500">错误行数</div>
            </div>
          </div>

          {/* 错误列表 */}
          {previewData.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <XCircle className="w-5 h-5" />
                错误信息（{previewData.errors.length}条）
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {previewData.errors.map((err, index) => (
                  <div key={index} className="text-sm text-red-600">
                    第 {err.row} 行: {err.errors.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 警告列表 */}
          {previewData.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <AlertTriangle className="w-5 h-5" />
                警告信息（{previewData.warnings.length}条）
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {previewData.warnings.map((warn, index) => (
                  <div key={index} className="text-sm text-amber-600">
                    第 {warn.row} 行: {warn.warnings.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 数据预览表格 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">数据预览（前100条）</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">行号</th>
                    {previewData.columns.slice(0, 10).map((col, index) => (
                      <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.preview.slice(0, 50).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-500">{row._rowIndex || index + 2}</td>
                      {previewData.columns.slice(0, 10).map((col, colIndex) => (
                        <td key={colIndex} className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap max-w-[150px] truncate">
                          {row[`_${col}`] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              取消
            </button>
            <div className="flex items-center gap-3">
              {previewData.errorRows > 0 && (
                <button
                  onClick={() => handleConfirmImport(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  跳过错误行导入
                </button>
              )}
              <button
                onClick={() => handleConfirmImport(false)}
                disabled={loading || previewData.errorRows > 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                确认导入 ({previewData.validRows}条)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 步骤4: 导入结果 */}
      {step === 'result' && importResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          {importResult.errorCount === 0 ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          )}
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {importResult.errorCount === 0 ? '导入成功！' : '部分导入成功'}
          </h2>
          
          <div className="flex items-center justify-center gap-8 my-6">
            <div>
              <div className="text-3xl font-bold text-green-600">{importResult.successCount}</div>
              <div className="text-sm text-gray-500">成功导入</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600">{importResult.errorCount}</div>
              <div className="text-sm text-gray-500">导入失败</div>
            </div>
          </div>

          {importResult.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left mb-6 max-h-40 overflow-y-auto">
              {importResult.errors.map((err: any, index: number) => (
                <div key={index} className="text-sm text-red-600">
                  第 {err.row} 行: {err.error}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleReset}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            继续导入
          </button>
        </div>
      )}
    </div>
  )
}
