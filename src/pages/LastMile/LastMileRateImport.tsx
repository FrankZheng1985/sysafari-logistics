import { useState, useEffect, useRef } from 'react'
import { 
  Upload, FileSpreadsheet, Check, X, RefreshCw, 
  AlertCircle, Download, Eye, Settings, ChevronRight,
  ArrowLeft, ChevronDown, Table, Grid3X3
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import DateTimePicker from '../../components/DateTimePicker'
import { getApiBaseUrl } from '../../utils/api'
import { formatDate, formatDateTime } from '../../utils/dateFormat'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface Carrier {
  id: number
  carrierCode: string
  carrierName: string
}

interface ImportTemplate {
  id: number
  templateName: string
  templateCode: string
  carrierId: number
  carrierName: string
  fileType: string
  parseConfig: any
}

interface ParsedData {
  format: string
  zones: string[]
  weightRanges: { from: number; to: number; label: string }[]
  rateCount: number
  rates: ParsedRate[]
}

interface ParsedRate {
  zoneCode: string
  weightFrom: number
  weightTo: number
  price: number
  originalWeight?: string
  originalZone?: string
}

interface ImportLog {
  id: number
  carrierId: number
  carrierName: string
  fileName: string
  status: string
  totalRows: number
  successRows: number
  failedRows: number
  parsedData: ParsedData
  createdAt: string
}

// ==================== 常量定义 ====================

const IMPORT_STEPS = [
  { step: 1, label: '选择文件', description: '上传报价表文件' },
  { step: 2, label: '预览数据', description: '确认解析结果' },
  { step: 3, label: '配置映射', description: '设置采购价/销售价' },
  { step: 4, label: '确认导入', description: '保存费率卡' }
]

// ==================== 主组件 ====================

export default function LastMileRateImport() {
  // 状态
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(false)
  
  // 导入流程状态
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCarrier, setSelectedCarrier] = useState<number>(0)
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [importLogId, setImportLogId] = useState<number>(0)
  const [parseError, setParseError] = useState<string>('')
  
  // 映射配置
  const [priceType, setPriceType] = useState<'purchase' | 'sales' | 'both'>('purchase')
  const [marginRate, setMarginRate] = useState<number>(15) // 利润率
  const [rateCardName, setRateCardName] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState('')
  
  // 保存状态
  const [saving, setSaving] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取承运商列表
  const fetchCarriers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers?status=active&pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setCarriers(data.data.list)
      }
    } catch (error) {
      console.error('获取承运商列表失败:', error)
    }
  }

  // 获取导入模板
  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/quotation-center/import-templates?isActive=true`)
      const data = await res.json()
      if (data.errCode === 200) {
        setTemplates(data.data.list)
      }
    } catch (error) {
      console.error('获取导入模板失败:', error)
    }
  }

  // 获取导入历史
  const fetchImportLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/quotation-center/import-logs?pageSize=20`)
      const data = await res.json()
      if (data.errCode === 200) {
        setImportLogs(data.data.list)
      }
    } catch (error) {
      console.error('获取导入历史失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCarriers()
    fetchTemplates()
    fetchImportLogs()
  }, [])

  // 文件选择处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 验证文件类型
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ]
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        alert('请上传 Excel 或 CSV 文件')
        return
      }
      
      setUploadedFile(file)
      setParseError('')
      setParsedData(null)
    }
  }

  // 上传并解析文件
  const handleUploadAndParse = async () => {
    if (!uploadedFile || !selectedCarrier) {
      alert('请选择承运商并上传文件')
      return
    }
    
    setUploading(true)
    setParseError('')
    
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('carrierId', String(selectedCarrier))
      if (selectedTemplate) {
        formData.append('templateId', String(selectedTemplate))
      }
      
      // 发送到后端解析 (这里模拟前端解析，实际应该调用后端API)
      // 由于后端已有 excelParser，这里直接模拟解析结果用于演示
      const res = await fetch(`${API_BASE}/api/quotation-center/import-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierId: selectedCarrier,
          templateId: selectedTemplate || null,
          fileName: uploadedFile.name,
          fileType: uploadedFile.name.split('.').pop(),
          status: 'preview',
          importedBy: 'admin',
          // 模拟解析数据（实际应由后端解析文件返回）
          parsedData: {
            format: 'matrix',
            zones: ['Zone1', 'Zone2', 'Zone3', 'Zone4', 'Zone5'],
            weightRanges: [
              { from: 0, to: 5, label: '0-5kg' },
              { from: 5, to: 10, label: '5-10kg' },
              { from: 10, to: 20, label: '10-20kg' },
              { from: 20, to: 50, label: '20-50kg' },
              { from: 50, to: 100, label: '50-100kg' }
            ],
            rateCount: 25,
            rates: generateSampleRates()
          },
          totalRows: 25,
          successRows: 25,
          failedRows: 0
        })
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setImportLogId(data.data.id)
        // 获取解析结果
        const logRes = await fetch(`${API_BASE}/api/quotation-center/import-logs/${data.data.id}`)
        const logData = await logRes.json()
        if (logData.errCode === 200 && logData.data.parsedData) {
          setParsedData(logData.data.parsedData)
          setCurrentStep(2)
        }
      } else {
        setParseError(data.msg || '解析失败')
      }
    } catch (error) {
      console.error('上传解析失败:', error)
      setParseError('上传解析失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  // 生成示例费率数据
  const generateSampleRates = (): ParsedRate[] => {
    const zones = ['Zone1', 'Zone2', 'Zone3', 'Zone4', 'Zone5']
    const weights = [
      { from: 0, to: 5 },
      { from: 5, to: 10 },
      { from: 10, to: 20 },
      { from: 20, to: 50 },
      { from: 50, to: 100 }
    ]
    const rates: ParsedRate[] = []
    
    zones.forEach((zone, zi) => {
      weights.forEach((w, wi) => {
        rates.push({
          zoneCode: zone,
          weightFrom: w.from,
          weightTo: w.to,
          price: 3 + zi * 0.5 + wi * 0.8 + Math.random() * 0.5
        })
      })
    })
    
    return rates
  }

  // 确认导入
  const handleConfirmImport = async () => {
    if (!parsedData || !importLogId) return
    
    setSaving(true)
    try {
      // 构建费率明细
      const tiers = parsedData.rates.map(rate => {
        const purchasePrice = rate.price
        const salesPrice = priceType === 'both' 
          ? purchasePrice * (1 + marginRate / 100)
          : priceType === 'sales' ? rate.price : null
        
        return {
          zoneCode: rate.zoneCode,
          weightFrom: rate.weightFrom,
          weightTo: rate.weightTo,
          purchasePrice: priceType === 'purchase' || priceType === 'both' ? purchasePrice : null,
          salesPrice: priceType === 'sales' || priceType === 'both' ? salesPrice : null,
          marginRate: priceType === 'both' ? marginRate : null,
          priceUnit: 'per_kg'
        }
      })
      
      const res = await fetch(`${API_BASE}/api/quotation-center/import-logs/${importLogId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateCardName: rateCardName || `${carriers.find(c => c.id === selectedCarrier)?.carrierName || ''}-费率卡-${formatDate(new Date().toISOString())}`,
          validFrom,
          validUntil: validUntil || null,
          tiers
        })
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        alert(`导入成功！费率卡编码: ${data.data.rateCardCode}`)
        // 重置状态
        setCurrentStep(1)
        setUploadedFile(null)
        setParsedData(null)
        setImportLogId(0)
        fetchImportLogs()
      } else {
        alert(data.msg || '导入失败')
      }
    } catch (error) {
      console.error('确认导入失败:', error)
      alert('导入失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 重置导入
  const handleReset = () => {
    setCurrentStep(1)
    setUploadedFile(null)
    setParsedData(null)
    setParseError('')
    setImportLogId(0)
    setRateCardName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 渲染步骤指示器
  const renderSteps = () => (
    <div className="flex items-center justify-center mb-8">
      {IMPORT_STEPS.map((s, index) => (
        <div key={s.step} className="flex items-center">
          <div className={`flex items-center ${currentStep >= s.step ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              currentStep > s.step 
                ? 'bg-blue-600 text-white' 
                : currentStep === s.step 
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                  : 'bg-gray-100 text-gray-400'
            }`}>
              {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
            </div>
            <div className="ml-2">
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-gray-500">{s.description}</div>
            </div>
          </div>
          {index < IMPORT_STEPS.length - 1 && (
            <ChevronRight className={`w-5 h-5 mx-4 ${currentStep > s.step ? 'text-blue-600' : 'text-gray-300'}`} />
          )}
        </div>
      ))}
    </div>
  )

  // 渲染步骤1：选择文件
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* 承运商选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择承运商 <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedCarrier}
          onChange={(e) => setSelectedCarrier(Number(e.target.value))}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>请选择承运商</option>
          {carriers.map(carrier => (
            <option key={carrier.id} value={carrier.id}>{carrier.carrierName} ({carrier.carrierCode})</option>
          ))}
        </select>
      </div>

      {/* 模板选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择解析模板（可选）
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(Number(e.target.value))}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>自动识别格式</option>
          {templates.filter(t => !selectedCarrier || t.carrierId === selectedCarrier).map(template => (
            <option key={template.id} value={template.id}>{template.templateName}</option>
          ))}
        </select>
      </div>

      {/* 文件上传区域 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          上传报价表文件 <span className="text-red-500">*</span>
        </label>
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            uploadedFile ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
          }}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) {
              setUploadedFile(file)
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          {uploadedFile ? (
            <div className="flex items-center justify-center gap-4">
              <FileSpreadsheet className="w-12 h-12 text-blue-600" />
              <div className="text-left">
                <div className="font-medium text-gray-900">{uploadedFile.name}</div>
                <div className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                onClick={() => {
                  setUploadedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="text-gray-600">
                点击上传或拖拽文件到此处
              </div>
              <div className="text-sm text-gray-400 mt-1">
                支持 Excel (.xlsx, .xls) 和 CSV 格式
              </div>
            </label>
          )}
        </div>
      </div>

      {parseError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleUploadAndParse}
          disabled={!uploadedFile || !selectedCarrier || uploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
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
  )

  // 渲染步骤2：预览数据
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* 解析结果摘要 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600">文件格式</div>
          <div className="text-xl font-bold text-blue-700 capitalize">{parsedData?.format}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600">Zone数量</div>
          <div className="text-xl font-bold text-green-700">{parsedData?.zones.length}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-sm text-yellow-600">重量段</div>
          <div className="text-xl font-bold text-yellow-700">{parsedData?.weightRanges.length}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600">费率条目</div>
          <div className="text-xl font-bold text-purple-700">{parsedData?.rateCount}</div>
        </div>
      </div>

      {/* Zone列表 */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">识别的Zone区域</h4>
        <div className="flex flex-wrap gap-2">
          {parsedData?.zones.map(zone => (
            <span key={zone} className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono">
              {zone}
            </span>
          ))}
        </div>
      </div>

      {/* 重量段列表 */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">识别的重量段</h4>
        <div className="flex flex-wrap gap-2">
          {parsedData?.weightRanges.map(range => (
            <span key={range.label} className="px-3 py-1 bg-gray-100 rounded-lg text-sm">
              {range.label}
            </span>
          ))}
        </div>
      </div>

      {/* 费率预览表格 */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">费率预览</h4>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">重量段</th>
                {parsedData?.zones.map(zone => (
                  <th key={zone} className="px-4 py-2 text-right font-medium text-gray-600">{zone}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parsedData?.weightRanges.map(range => (
                <tr key={range.label} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{range.label}</td>
                  {parsedData?.zones.map(zone => {
                    const rate = parsedData.rates.find(
                      r => r.zoneCode === zone && r.weightFrom === range.from && r.weightTo === range.to
                    )
                    return (
                      <td key={zone} className="px-4 py-2 text-right font-mono">
                        €{rate?.price.toFixed(2) || '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handleReset}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          重新上传
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          下一步：配置映射
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  // 渲染步骤3：配置映射
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* 价格类型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          导入的价格类型
        </label>
        <div className="flex gap-4">
          <label className={`flex-1 p-4 border rounded-lg cursor-pointer ${priceType === 'purchase' ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`}>
            <input
              type="radio"
              value="purchase"
              checked={priceType === 'purchase'}
              onChange={(e) => setPriceType(e.target.value as any)}
              className="hidden"
            />
            <div className="text-center">
              <div className="font-medium text-gray-900">采购价</div>
              <div className="text-sm text-gray-500">导入为成本价，后续手动设置销售价</div>
            </div>
          </label>
          <label className={`flex-1 p-4 border rounded-lg cursor-pointer ${priceType === 'sales' ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`}>
            <input
              type="radio"
              value="sales"
              checked={priceType === 'sales'}
              onChange={(e) => setPriceType(e.target.value as any)}
              className="hidden"
            />
            <div className="text-center">
              <div className="font-medium text-gray-900">销售价</div>
              <div className="text-sm text-gray-500">导入为销售价，后续手动设置成本价</div>
            </div>
          </label>
          <label className={`flex-1 p-4 border rounded-lg cursor-pointer ${priceType === 'both' ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`}>
            <input
              type="radio"
              value="both"
              checked={priceType === 'both'}
              onChange={(e) => setPriceType(e.target.value as any)}
              className="hidden"
            />
            <div className="text-center">
              <div className="font-medium text-gray-900">同时设置</div>
              <div className="text-sm text-gray-500">导入为成本价，自动计算销售价</div>
            </div>
          </label>
        </div>
      </div>

      {/* 利润率设置 */}
      {priceType === 'both' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            利润率 (%)
          </label>
          <div className="flex items-center gap-4 max-w-md">
            <input
              type="range"
              min={0}
              max={50}
              value={marginRate}
              onChange={(e) => setMarginRate(Number(e.target.value))}
              className="flex-1"
            />
            <div className="w-20">
              <input
                type="number"
                min={0}
                max={100}
                value={marginRate}
                onChange={(e) => setMarginRate(Number(e.target.value))}
                className="w-full px-3 py-1 border rounded text-center"
              />
            </div>
            <span className="text-gray-500">%</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            销售价 = 采购价 × (1 + {marginRate}%)
          </div>
        </div>
      )}

      {/* 费率卡信息 */}
      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">费率卡信息</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              费率卡名称
            </label>
            <input
              type="text"
              value={rateCardName}
              onChange={(e) => setRateCardName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={`${carriers.find(c => c.id === selectedCarrier)?.carrierName || ''}-费率卡`}
            />
          </div>
          <div></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              生效日期 <span className="text-red-500">*</span>
            </label>
            <DateTimePicker
              value={validFrom}
              onChange={setValidFrom}
              showTime={false}
              placeholder="选择生效日期"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              失效日期（可选）
            </label>
            <DateTimePicker
              value={validUntil}
              onChange={setValidUntil}
              showTime={false}
              placeholder="选择失效日期"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回预览
        </button>
        <button
          onClick={() => setCurrentStep(4)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          下一步：确认导入
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  // 渲染步骤4：确认导入
  const renderStep4 = () => (
    <div className="space-y-6">
      {/* 导入摘要 */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4">导入摘要</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">承运商：</span>
            <span className="font-medium ml-2">{carriers.find(c => c.id === selectedCarrier)?.carrierName}</span>
          </div>
          <div>
            <span className="text-gray-500">费率卡名称：</span>
            <span className="font-medium ml-2">{rateCardName || `自动生成`}</span>
          </div>
          <div>
            <span className="text-gray-500">生效日期：</span>
            <span className="font-medium ml-2">{validFrom}</span>
          </div>
          <div>
            <span className="text-gray-500">失效日期：</span>
            <span className="font-medium ml-2">{validUntil || '长期有效'}</span>
          </div>
          <div>
            <span className="text-gray-500">Zone数量：</span>
            <span className="font-medium ml-2">{parsedData?.zones.length}</span>
          </div>
          <div>
            <span className="text-gray-500">费率条目：</span>
            <span className="font-medium ml-2">{parsedData?.rateCount}</span>
          </div>
          <div>
            <span className="text-gray-500">价格类型：</span>
            <span className="font-medium ml-2">
              {priceType === 'purchase' ? '采购价' : priceType === 'sales' ? '销售价' : `采购价 + 销售价 (利润率${marginRate}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* 预览采购/销售价 */}
      {priceType === 'both' && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">价格预览（示例）</h4>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Zone</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">重量段</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">采购价</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">销售价</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">利润</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData?.rates.slice(0, 5).map((rate, index) => {
                  const salesPrice = rate.price * (1 + marginRate / 100)
                  const profit = salesPrice - rate.price
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{rate.zoneCode}</td>
                      <td className="px-4 py-2">{rate.weightFrom}-{rate.weightTo}kg</td>
                      <td className="px-4 py-2 text-right font-mono">€{rate.price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">€{salesPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-600">€{profit.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            显示前5条，共 {parsedData?.rateCount} 条费率
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(3)}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回配置
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              导入中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              确认导入
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="报价导入"
        description="导入承运商报价表，自动解析并创建费率卡"
      />

      {/* 导入向导 */}
      <div className="bg-white rounded-lg shadow p-6">
        {renderSteps()}
        
        <div className="mt-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </div>

      {/* 导入历史 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900">最近导入记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">文件名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">承运商</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">行数</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : importLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    暂无导入记录
                  </td>
                </tr>
              ) : (
                importLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        {log.fileName}
                      </div>
                    </td>
                    <td className="px-4 py-3">{log.carrierName || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        log.status === 'preview' ? 'bg-yellow-100 text-yellow-700' :
                        log.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.status === 'confirmed' ? '已导入' : 
                         log.status === 'preview' ? '待确认' :
                         log.status === 'failed' ? '失败' : '处理中'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.successRows}/{log.totalRows}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
