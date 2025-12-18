import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, 
  Edit2, Trash2, Plus, ChevronDown, ChevronRight, X, Loader2, Download
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
}

interface ParsedSheet {
  name: string
  headers: string[]
  fieldMapping: Record<string, { columnIndex: number; originalHeader: string }>
  rowCount: number
  preview: any[][]
  data: any[]
}

interface ParsedItem {
  feeName: string
  feeNameEn: string
  unit: string
  price: number
  currency: string
  routeFrom: string
  routeTo: string
  remark: string
  _rowIndex?: number
  _warnings?: string[]
  _sheetName?: string
  _selected?: boolean
}

interface ParseResult {
  fileType: string
  sheetCount?: number
  sheets?: ParsedSheet[]
  data?: ParsedItem[]
  totalRecords: number
  validCount?: number
  warningCount?: number
}

const FEE_CATEGORIES = [
  { value: 'freight', label: '运费' },
  { value: 'customs', label: '关税' },
  { value: 'warehouse', label: '仓储' },
  { value: 'handling', label: '操作' },
  { value: 'documentation', label: '文件' },
  { value: 'other', label: '其他' }
]

export default function SupplierPriceImport() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const supplierId = searchParams.get('supplierId')
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [step, setStep] = useState(1) // 1: 选择供应商, 2: 上传文件, 3: 预览编辑, 4: 确认导入
  
  // 文件上传状态
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  
  // 编辑状态
  const [editingItems, setEditingItems] = useState<ParsedItem[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [expandedSheets, setExpandedSheets] = useState<string[]>([])
  
  // 提交状态
  const [submitting, setSubmitting] = useState(false)

  const tabs = [
    { key: 'supplier-list', label: '供应商列表', path: '/suppliers/manage' },
    { key: 'supplier-prices', label: '采购价管理', path: '/suppliers/prices' },
    { key: 'import', label: '智能导入', path: '/suppliers/import' }
  ]

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (supplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === supplierId)
      if (supplier) {
        setSelectedSupplier(supplier)
        setStep(2)
      }
    }
  }, [supplierId, suppliers])

  const loadSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers?status=active&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSuppliers(data.data?.list || [])
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setParseResult(null)
      setEditingItems([])
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setParseResult(null)
      setEditingItems([])
    }
  }, [])

  const handleUploadAndParse = async () => {
    if (!file) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_BASE}/api/suppliers/import/parse`, {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setParseResult(data.data)
        
        // 初始化编辑数据
        if (data.data.fileType === 'excel' && data.data.sheets) {
          // Excel 文件 - 选择所有 Sheet
          const sheetNames = data.data.sheets.map((s: ParsedSheet) => s.name)
          setSelectedSheets(sheetNames)
          setExpandedSheets([sheetNames[0]]) // 展开第一个
          
          // 合并所有 Sheet 的数据
          const allItems: ParsedItem[] = []
          data.data.sheets.forEach((sheet: ParsedSheet) => {
            sheet.data.forEach((item: any) => {
              allItems.push({
                ...item,
                _sheetName: sheet.name,
                _selected: true
              })
            })
          })
          setEditingItems(allItems)
        } else if (data.data.data) {
          // PDF 或其他格式
          setEditingItems(data.data.data.map((item: any) => ({
            ...item,
            _selected: !item._warnings?.length
          })))
        }
        
        setStep(3)
      } else {
        alert(data.msg || '文件解析失败')
      }
    } catch (error) {
      console.error('上传解析失败:', error)
      alert('上传解析失败')
    } finally {
      setUploading(false)
    }
  }

  const handleItemChange = (index: number, field: keyof ParsedItem, value: any) => {
    setEditingItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleToggleItem = (index: number) => {
    setEditingItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], _selected: !newItems[index]._selected }
      return newItems
    })
  }

  const handleSelectAll = (selected: boolean) => {
    setEditingItems(prev => prev.map(item => ({ ...item, _selected: selected })))
  }

  const handleRemoveItem = (index: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddItem = () => {
    setEditingItems(prev => [...prev, {
      feeName: '',
      feeNameEn: '',
      unit: '',
      price: 0,
      currency: 'EUR',
      routeFrom: '',
      routeTo: '',
      remark: '',
      _selected: true
    }])
  }

  const handleConfirmImport = async () => {
    const selectedItems = editingItems.filter(item => item._selected && item.feeName)
    
    if (selectedItems.length === 0) {
      alert('请选择要导入的数据')
      return
    }
    
    if (!selectedSupplier) {
      alert('请选择供应商')
      return
    }
    
    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${selectedSupplier.id}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems,
          fileName: file?.name
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`导入成功！共导入 ${data.data.successCount} 条记录`)
        navigate(`/suppliers/prices?supplierId=${selectedSupplier.id}`)
      } else {
        alert(data.msg || '导入失败')
      }
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCount = editingItems.filter(item => item._selected).length

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="供应商管理"
        subtitle="智能导入供应商报价"
        tabs={tabs}
        activeTab="import"
        onTabChange={(key) => {
          const tab = tabs.find(t => t.key === key)
          if (tab) navigate(tab.path)
        }}
      />

      {/* 步骤指示器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center">
          {[
            { num: 1, label: '选择供应商' },
            { num: 2, label: '上传文件' },
            { num: 3, label: '预览编辑' },
            { num: 4, label: '确认导入' }
          ].map((s, index) => (
            <div key={s.num} className="flex items-center">
              {index > 0 && (
                <div className={`w-16 h-0.5 ${step >= s.num ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s.num ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
                </div>
                <span className={`mt-1 text-xs ${step >= s.num ? 'text-primary-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 步骤1：选择供应商 */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">选择供应商</h3>
          <div className="max-w-md">
            <select
              value={selectedSupplier?.id || ''}
              onChange={(e) => {
                const supplier = suppliers.find(s => s.id === e.target.value)
                setSelectedSupplier(supplier || null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">请选择供应商</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <button
              onClick={() => selectedSupplier && setStep(2)}
              disabled={!selectedSupplier}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步骤2：上传文件 */}
      {step === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-medium text-gray-900">上传报价文件</h3>
              <p className="text-xs text-gray-500 mt-1">
                供应商：{selectedSupplier?.supplierName}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              更换供应商
            </button>
          </div>

          {/* 上传区域 */}
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                {file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? (
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                ) : (
                  <FileText className="w-10 h-10 text-red-500" />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">拖拽文件到此处，或</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg cursor-pointer hover:bg-primary-100">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  选择文件
                </label>
                <p className="text-xs text-gray-400 mt-3">
                  支持 Excel (.xlsx, .xls) 和 PDF 格式，最大 10MB
                </p>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleUploadAndParse}
              disabled={!file || uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  上传并解析
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 步骤3：预览编辑 */}
      {step === 3 && parseResult && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="text-base font-medium text-gray-900">预览并编辑</h3>
              <p className="text-xs text-gray-500 mt-1">
                解析到 {parseResult.totalRecords} 条记录，已选择 {selectedCount} 条
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-3 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
              >
                全选
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded"
              >
                取消全选
              </button>
              <button
                onClick={handleAddItem}
                className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加行
              </button>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCount === editingItems.length && editingItems.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">费用名称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">英文名称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">单位</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">价格</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">起运地</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">目的地</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">备注</th>
                  <th className="w-16 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {editingItems.map((item, index) => (
                  <tr key={index} className={`border-t border-gray-100 ${
                    item._warnings?.length ? 'bg-yellow-50' : ''
                  }`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item._selected}
                        onChange={() => handleToggleItem(index)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.feeName}
                        onChange={(e) => handleItemChange(index, 'feeName', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="费用名称"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.feeNameEn}
                        onChange={(e) => handleItemChange(index, 'feeNameEn', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="英文名称"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="单位"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          value={item.currency}
                          onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                          className="px-1 py-1 text-xs border border-gray-300 rounded bg-gray-50"
                        >
                          <option value="EUR">€</option>
                          <option value="USD">$</option>
                          <option value="CNY">¥</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.routeFrom}
                        onChange={(e) => handleItemChange(index, 'routeFrom', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="起运地"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.routeTo}
                        onChange={(e) => handleItemChange(index, 'routeTo', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="目的地"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.remark}
                        onChange={(e) => handleItemChange(index, 'remark', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="备注"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {item._warnings?.length ? (
                          <span className="text-yellow-500" title={item._warnings.join(', ')}>
                            <AlertCircle className="w-4 h-4" />
                          </span>
                        ) : null}
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              上一步
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              下一步：确认导入 ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* 步骤4：确认导入 */}
      {step === 4 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">确认导入</h3>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">供应商：</span>
                <span className="font-medium text-gray-900 ml-2">{selectedSupplier?.supplierName}</span>
              </div>
              <div>
                <span className="text-gray-500">文件名：</span>
                <span className="font-medium text-gray-900 ml-2">{file?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">导入数量：</span>
                <span className="font-medium text-primary-600 ml-2">{selectedCount} 条</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              返回编辑
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  确认导入
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
