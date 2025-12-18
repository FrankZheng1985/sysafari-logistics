import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Plus, Upload, Download, Edit2, Trash2, RefreshCw, X, Check, AlertCircle, Globe, Zap, Shield, FileWarning, Ban } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import TaricSyncPanel from '../components/TaricSyncPanel'
// UI components available if needed: PageContainer, ContentCard, LoadingSpinner, EmptyState
import {
  getTariffRates,
  createTariffRate,
  updateTariffRate,
  deleteTariffRate,
  importTariffRates,
  getTariffRateStats,
  TariffRate,
  TariffRateStats,
  lookupTaricRealtime,
  TaricRealtimeResult,
  getTaricCountryCodes,
  CountryCode,
} from '../utils/api'

// 导入弹窗组件
function ImportModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ successCount: number; failCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 下载模板
  const handleDownloadTemplate = () => {
    const templateContent = `hs_code,hs_code_10,description,description_cn,origin_country_code,duty_rate,vat_rate,anti_dumping_rate,unit_code,unit_name
61091000,6109100010,T-shirts singlets and other vests of cotton knitted,棉制针织T恤衫,CN,12,19,0,KGM,千克
84713000,8471300000,Portable automatic data processing machines,便携式自动数据处理设备,CN,0,19,0,PCE,台
85171200,8517120000,Telephones for cellular networks,蜂窝网络电话,CN,0,19,0,PCE,台
42022200,4202220000,Handbags with outer surface of plastic or textile,塑料或纺织材料面手提包,CN,3,19,0,PCE,件
64039900,6403990090,Other footwear with outer soles of rubber plastics,其他皮革面鞋靴,CN,8,19,0,PA2,双`

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'TARIC_Import_Template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      // 解析CSV头部
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      
      // 解析数据行
      const rates: Partial<TariffRate>[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        const rate: any = {}
        
        headers.forEach((header, index) => {
          const value = values[index]?.trim() || ''
          // 映射列名
          if (header === 'hs_code' || header === 'hscode' || header === 'goods code') {
            rate.hsCode = value
          } else if (header === 'hs_code_10' || header === 'hscode10') {
            rate.hsCode10 = value
          } else if (header === 'description' || header === 'goods_description') {
            rate.goodsDescription = value
          } else if (header === 'description_cn' || header === 'goods_description_cn') {
            rate.goodsDescriptionCn = value
          } else if (header === 'origin' || header === 'origin_country') {
            rate.originCountry = value
          } else if (header === 'origin_code' || header === 'origin_country_code') {
            rate.originCountryCode = value
          } else if (header === 'duty_rate' || header === 'duty') {
            rate.dutyRate = parseFloat(value) || 0
          } else if (header === 'vat_rate' || header === 'vat') {
            rate.vatRate = parseFloat(value) || 19
          } else if (header === 'unit_code') {
            rate.unitCode = value
          } else if (header === 'unit_name' || header === 'unit') {
            rate.unitName = value
          }
        })
        
        if (rate.hsCode && rate.goodsDescription) {
          rates.push(rate)
        }
      }

      if (rates.length === 0) {
        alert('未找到有效的税率数据')
        return
      }

      const response = await importTariffRates(rates)
      if (response.errCode === 200 && response.data) {
        setResult({
          successCount: response.data.successCount,
          failCount: response.data.failCount,
        })
        if (response.data.successCount > 0) {
          onSuccess()
        }
      }
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败，请检查文件格式')
    } finally {
      setImporting(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">导入税率数据</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-600 mb-2">
              支持 CSV 格式文件，包含以下列：
            </p>
            <p className="text-xs text-gray-500 mb-3">
              hs_code, description, origin_country_code, duty_rate, vat_rate, unit_name
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
            >
              选择文件
            </button>
            {file && (
              <p className="mt-2 text-xs text-green-600">
                已选择: {file.name}
              </p>
            )}
          </div>

          {result && (
            <div className={`p-3 rounded text-xs ${result.failCount > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'}`}>
              <div className="flex items-center gap-1">
                {result.failCount > 0 ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>导入完成：成功 {result.successCount} 条，失败 {result.failCount} 条</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-blue-800">CSV文件格式说明：</h4>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                <Download className="w-3 h-3" />
                下载模板
              </button>
            </div>
            <ul className="text-xs text-blue-700 space-y-0.5">
              <li>• 第一行为表头，包含列名</li>
              <li>• 必填列：hs_code（HS编码）、description（商品描述）</li>
              <li>• 可选列：duty_rate（关税率%）、vat_rate（增值税率%）、origin_country_code（原产国代码）</li>
              <li>• 可选列：description_cn（中文描述）、unit_code（单位代码）、unit_name（单位名称）</li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
          >
            关闭
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {importing && <RefreshCw className="w-3 h-3 animate-spin" />}
            {importing ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 编辑弹窗组件
function EditModal({
  visible,
  onClose,
  onSuccess,
  editData,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: TariffRate | null
}) {
  const [formData, setFormData] = useState<Partial<TariffRate>>({
    hsCode: '',
    hsCode10: '',
    goodsDescription: '',
    goodsDescriptionCn: '',
    originCountry: '',
    originCountryCode: '',
    dutyRate: 0,
    vatRate: 19,
    antiDumpingRate: 0,
    unitCode: '',
    unitName: '',
    isActive: true,
    declarationType: 'per_unit',
    minDeclarationValue: 0,
    material: '',
    usageScenario: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editData) {
      setFormData(editData)
    } else {
      setFormData({
        hsCode: '',
        hsCode10: '',
        goodsDescription: '',
        goodsDescriptionCn: '',
        originCountry: '',
        originCountryCode: '',
        dutyRate: 0,
        vatRate: 19,
        antiDumpingRate: 0,
        unitCode: '',
        unitName: '',
        isActive: true,
        declarationType: 'per_unit',
        minDeclarationValue: 0,
        material: '',
        usageScenario: '',
      })
    }
  }, [editData, visible])

  const handleSave = async () => {
    if (!formData.hsCode || !formData.goodsDescription) {
      alert('HS编码和商品描述是必填项')
      return
    }

    setSaving(true)
    try {
      if (editData?.id) {
        await updateTariffRate(editData.id, formData)
      } else {
        await createTariffRate(formData as Omit<TariffRate, 'id'>)
      }
      onSuccess()
      onClose()
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            {editData ? '编辑税率' : '新增税率'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* HS编码信息 */}
          <div className="bg-gray-50 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">HS编码信息</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">HS编码 (8位) *</label>
                <input
                  type="text"
                  value={formData.hsCode || ''}
                  onChange={(e) => setFormData({ ...formData, hsCode: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 61091000"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">HS编码 (10位)</label>
                <input
                  type="text"
                  value={formData.hsCode10 || ''}
                  onChange={(e) => setFormData({ ...formData, hsCode10: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 6109100010"
                  maxLength={10}
                />
              </div>
            </div>
          </div>

          {/* 商品描述 */}
          <div className="bg-blue-50 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">商品描述</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">英文描述 *</label>
                <textarea
                  value={formData.goodsDescription || ''}
                  onChange={(e) => setFormData({ ...formData, goodsDescription: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white resize-none"
                  rows={2}
                  placeholder="Goods description in English"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">中文描述</label>
                <textarea
                  value={formData.goodsDescriptionCn || ''}
                  onChange={(e) => setFormData({ ...formData, goodsDescriptionCn: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white resize-none"
                  rows={2}
                  placeholder="商品中文描述"
                />
              </div>
            </div>
          </div>

          {/* 税率信息 */}
          <div className="bg-green-50 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">税率信息</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">关税率 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.dutyRate || ''}
                  onChange={(e) => setFormData({ ...formData, dutyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">增值税率 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.vatRate || ''}
                  onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) || 19 })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="19"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">反倾销税 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.antiDumpingRate || ''}
                  onChange={(e) => setFormData({ ...formData, antiDumpingRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">反补贴税 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.countervailingRate || ''}
                  onChange={(e) => setFormData({ ...formData, countervailingRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* 原产地和计量单位 */}
          <div className="bg-orange-50 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">原产地和计量单位</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">原产国</label>
                <input
                  type="text"
                  value={formData.originCountry || ''}
                  onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 中国"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">国家代码</label>
                <input
                  type="text"
                  value={formData.originCountryCode || ''}
                  onChange={(e) => setFormData({ ...formData, originCountryCode: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: CN"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">单位代码</label>
                <input
                  type="text"
                  value={formData.unitCode || ''}
                  onChange={(e) => setFormData({ ...formData, unitCode: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: KGM"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">单位名称</label>
                <input
                  type="text"
                  value={formData.unitName || ''}
                  onChange={(e) => setFormData({ ...formData, unitName: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 千克"
                />
              </div>
            </div>
          </div>

          {/* 货值申报管理 */}
          <div className="bg-purple-50 rounded p-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">货值申报管理</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">申报方式</label>
                <select
                  value={formData.declarationType || 'per_unit'}
                  onChange={(e) => setFormData({ ...formData, declarationType: e.target.value as 'per_unit' | 'per_weight' })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                >
                  <option value="per_unit">按单品单价</option>
                  <option value="per_weight">按货物重量</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">最低申报金额 (EUR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minDeclarationValue || ''}
                  onChange={(e) => setFormData({ ...formData, minDeclarationValue: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">货物材质</label>
                <input
                  type="text"
                  value={formData.material || ''}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 棉、塑料、金属"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">使用场景</label>
                <input
                  type="text"
                  value={formData.usageScenario || ''}
                  onChange={(e) => setFormData({ ...formData, usageScenario: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  placeholder="如: 家居、工业、消费品"
                />
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              💡 提示：最低申报金额用于海关申报时的货值评估参考，可根据HS编码、材质和使用场景设置不同的最低申报标准
            </p>
          </div>

          {/* 状态 */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
            <div>
              <span className="text-xs font-medium text-gray-700">启用状态</span>
              <p className="text-xs text-gray-500">关闭后此税率将不在查询中显示</p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                formData.isActive ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  formData.isActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 实时查询弹窗组件
function RealtimeLookupModal({
  visible,
  onClose,
  onSaveSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSaveSuccess: () => void
}) {
  const [hsCode, setHsCode] = useState('')
  const [originCountry, setOriginCountry] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TaricRealtimeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState<CountryCode[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [saving, setSaving] = useState(false)

  // 加载国家代码
  useEffect(() => {
    if (visible && countries.length === 0) {
      loadCountries()
    }
  }, [visible])

  const loadCountries = async () => {
    setLoadingCountries(true)
    try {
      const response = await getTaricCountryCodes()
      if (response.errCode === 200 && response.data) {
        setCountries(response.data.countries || [])
      }
    } catch (err) {
      console.error('加载国家代码失败:', err)
    } finally {
      setLoadingCountries(false)
    }
  }

  const handleLookup = async () => {
    if (!hsCode || hsCode.length < 6) {
      setError('请输入至少6位的 HS 编码')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await lookupTaricRealtime(hsCode, originCountry || undefined, false)
      if (response.errCode === 200 && response.data) {
        setResult(response.data)
      } else {
        setError(response.msg || '查询失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToDb = async () => {
    if (!result) return

    setSaving(true)
    try {
      const response = await lookupTaricRealtime(hsCode, originCountry || undefined, true)
      if (response.errCode === 200 && response.data) {
        setResult(response.data)
        if (response.data.savedToDb === 'inserted' || response.data.savedToDb === 'updated') {
          onSaveSuccess()
        }
      }
    } catch (err) {
      console.error('保存失败:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded shadow-xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">TARIC 实时查询</h3>
              <p className="text-xs text-gray-500">从欧盟官方系统获取最新税率数据</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 查询表单 */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">HS 编码 (8-10位)</label>
              <input
                type="text"
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="如: 6109100010"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs text-gray-600 mb-1">原产国 (可选)</label>
              <select
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                disabled={loadingCountries}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部国家</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLookup}
              disabled={loading || !hsCode}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? '查询中...' : '实时查询'}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* 查询结果 */}
          {result && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">查询结果</span>
                  {result.fromCache && (
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">
                      来自缓存
                    </span>
                  )}
                  {result.savedToDb && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      result.savedToDb === 'inserted' ? 'bg-green-100 text-green-700' :
                      result.savedToDb === 'updated' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {result.savedToDb === 'inserted' ? '已新增' :
                       result.savedToDb === 'updated' ? '已更新' : '保存失败'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400">
                  查询时间: {new Date(result.queryTime).toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="p-3 space-y-3">
                {/* 基本信息 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">HS 编码 (8位)</p>
                    <p className="text-sm font-medium text-gray-900">{result.hsCode}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">TARIC 编码 (10位)</p>
                    <p className="text-sm font-medium text-gray-900">{result.hsCode10}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">原产国</p>
                    <p className="text-sm font-medium text-gray-900">
                      {result.originCountryCode || '全部'}
                    </p>
                  </div>
                </div>

                {/* 商品描述 */}
                {result.goodsDescription && (
                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">商品描述</p>
                    <p className="text-xs text-gray-800">{result.goodsDescription}</p>
                  </div>
                )}

                {/* 税率信息 */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">第三国关税</p>
                    <p className="text-lg font-bold text-green-700">
                      {result.thirdCountryDuty !== null ? `${result.thirdCountryDuty}%` : '-'}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">适用关税</p>
                    <p className="text-lg font-bold text-blue-700">
                      {result.dutyRate !== null ? `${result.dutyRate}%` : '-'}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">反倾销税</p>
                    <p className="text-lg font-bold text-orange-700">
                      {result.antiDumpingRate !== null ? `${result.antiDumpingRate}%` : 
                       result.hasAntiDumping ? '有' : '-'}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">反补贴税</p>
                    <p className="text-lg font-bold text-red-700">
                      {result.countervailingRate !== null ? `${result.countervailingRate}%` :
                       result.hasCountervailing ? '有' : '-'}
                    </p>
                  </div>
                </div>

                {/* 贸易限制标志 */}
                <div className="flex items-center gap-3">
                  {result.hasQuota && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      <FileWarning className="w-3 h-3" />
                      有配额限制
                    </span>
                  )}
                  {result.requiresLicense && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                      <Shield className="w-3 h-3" />
                      需要许可证
                    </span>
                  )}
                  {result.requiresSPS && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">
                      <Ban className="w-3 h-3" />
                      需要 SPS 检验
                    </span>
                  )}
                  {result.totalMeasures && result.totalMeasures > 0 && (
                    <span className="text-xs text-gray-500">
                      共 {result.totalMeasures} 项贸易措施
                    </span>
                  )}
                </div>

                {/* 措施列表 */}
                {result.measures && result.measures.length > 0 && (
                  <div className="border border-gray-200 rounded">
                    <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-700">贸易措施详情</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-40 overflow-auto">
                      {result.measures.slice(0, 10).map((measure, idx) => (
                        <div key={idx} className="px-2 py-1.5 flex items-center justify-between text-xs">
                          <span className="text-gray-700">{measure.type || '措施'}</span>
                          <span className="text-gray-900 font-medium">
                            {measure.rate !== undefined ? `${measure.rate}%` : '-'}
                          </span>
                          {measure.geographicalArea && (
                            <span className="text-gray-500">{measure.geographicalArea}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="bg-blue-50 rounded p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">💡 使用说明</p>
            <ul className="space-y-0.5 text-blue-600">
              <li>• 输入 HS 编码（8-10位）进行实时查询</li>
              <li>• 选择原产国可获取针对特定国家的税率（如反倾销税）</li>
              <li>• 查询结果会缓存24小时，避免重复请求</li>
              <li>• 点击"保存到数据库"可将查询结果保存到本地税率库</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
          >
            关闭
          </button>
          {result && (
            <button
              onClick={handleSaveToDb}
              disabled={saving}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {saving ? '保存中...' : '保存到数据库'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TariffRateManage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const location = useLocation() // reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate() // reserved for future use
  
  const [rates, setRates] = useState<TariffRate[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TariffRateStats | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [hsCodeFilter, setHsCodeFilter] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [dataSourceFilter, setDataSourceFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dutyRateMin, setDutyRateMin] = useState('')
  const [dutyRateMax, setDutyRateMax] = useState('')
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)
  
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingRate, setEditingRate] = useState<TariffRate | null>(null)
  const [realtimeLookupVisible, setRealtimeLookupVisible] = useState(false)

  // 加载税率列表
  const loadRates = async () => {
    setLoading(true)
    try {
      const response = await getTariffRates({
        search: searchValue || undefined,
        hsCode: hsCodeFilter || undefined,
        origin: originFilter || undefined,
        dataSource: dataSourceFilter || undefined,
        status: statusFilter || undefined,
        dutyRateMin: dutyRateMin ? parseFloat(dutyRateMin) : undefined,
        dutyRateMax: dutyRateMax ? parseFloat(dutyRateMax) : undefined,
        page,
        pageSize,
      })
      if (response.errCode === 200) {
        setRates(response.data || [])
        setTotal(response.total || 0)
      }
    } catch (error) {
      console.error('加载税率列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载统计信息
  const loadStats = async () => {
    try {
      const response = await getTariffRateStats()
      if (response.errCode === 200 && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  useEffect(() => {
    loadRates()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, hsCodeFilter, originFilter, dataSourceFilter, statusFilter, dutyRateMin, dutyRateMax])

  const handleSearch = () => {
    setPage(1)
    loadRates()
  }

  const handleEdit = (rate: TariffRate) => {
    setEditingRate(rate)
    setEditModalVisible(true)
  }

  const handleAdd = () => {
    setEditingRate(null)
    setEditModalVisible(true)
  }

  const handleDelete = async (rate: TariffRate) => {
    if (!confirm(`确定要删除税率 "${rate.hsCode}" 吗？`)) return
    
    try {
      await deleteTariffRate(rate.id)
      loadRates()
      loadStats()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="HS Code数据库"
        icon="$"
        breadcrumbs={[
          { label: '系统管理', path: '/system/basic-data' },
          'HS Code数据库',
        ]}
      />

      {/* TARIC 同步面板 */}
      <div className="px-4 pt-4">
        <TaricSyncPanel />
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="px-4 py-2.5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="text-gray-500">总数:</span>
              <span className="font-semibold text-gray-900 tabular-nums">{stats.total?.toLocaleString()}</span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span className="text-gray-500">启用:</span>
              <span className="font-semibold text-green-600 tabular-nums">{stats.active?.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              <span className="text-gray-500">停用:</span>
              <span className="font-semibold text-gray-600 tabular-nums">{stats.inactive?.toLocaleString()}</span>
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            {stats.bySource && Object.entries(stats.bySource).map(([source, count]) => (
              <div key={source} className="flex items-center gap-1.5">
                <span className="text-gray-500">{source}:</span>
                <span className="font-semibold text-gray-700 tabular-nums">{(count as number)?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          {/* 搜索筛选区域 */}
          <div className="flex items-center gap-2 flex-1">
            {/* HS编码搜索 */}
            <input
              type="text"
              value={hsCodeFilter}
              onChange={(e) => {
                setHsCodeFilter(e.target.value)
                setPage(1)
              }}
              placeholder="HS编码"
              title="输入 HS 编码进行精确搜索"
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs w-24 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            {/* 商品描述搜索 */}
            <div className="relative flex-1 max-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索商品描述..."
                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            {/* 原产国筛选 */}
            <input
              type="text"
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value)
                setPage(1)
              }}
              placeholder="原产国"
              title="输入原产国名称或代码筛选"
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs w-20 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            {/* 数据来源筛选 */}
            <select
              value={dataSourceFilter}
              onChange={(e) => {
                setDataSourceFilter(e.target.value)
                setPage(1)
              }}
              title="按数据来源筛选"
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors cursor-pointer"
            >
              <option value="">来源</option>
              <option value="taric">TARIC</option>
              <option value="manual">手动</option>
              <option value="import">导入</option>
            </select>
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              title="按状态筛选"
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors cursor-pointer"
            >
              <option value="">状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
            {/* 高级筛选按钮 */}
            <button
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className={`px-2 py-1.5 border rounded-md text-xs flex items-center gap-1 transition-all whitespace-nowrap ${
                showAdvancedFilter ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              高级
            </button>
            {/* 搜索按钮 */}
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs hover:bg-primary-700 flex items-center gap-1 shadow-sm transition-all hover:shadow whitespace-nowrap"
            >
              <Search className="w-3 h-3" />
              搜索
            </button>
            {/* 重置按钮 */}
            {(hsCodeFilter || searchValue || originFilter || dataSourceFilter || statusFilter || dutyRateMin || dutyRateMax) && (
              <button
                onClick={() => {
                  setHsCodeFilter('')
                  setSearchValue('')
                  setOriginFilter('')
                  setDataSourceFilter('')
                  setStatusFilter('')
                  setDutyRateMin('')
                  setDutyRateMax('')
                  setPage(1)
                }}
                className="px-1.5 py-1.5 text-gray-400 hover:text-red-500 text-xs flex items-center transition-colors"
                title="重置筛选"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* 分隔线 */}
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
          {/* 操作按钮区域 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setRealtimeLookupVisible(true)}
              className="px-2.5 py-1.5 border border-blue-500 text-blue-600 rounded-md text-xs hover:bg-blue-50 flex items-center gap-1 transition-all whitespace-nowrap"
            >
              <Globe className="w-3 h-3" />
              实时查询
            </button>
            <button
              onClick={() => setImportModalVisible(true)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs hover:bg-gray-50 hover:border-gray-400 flex items-center gap-1 transition-all whitespace-nowrap"
            >
              <Upload className="w-3 h-3" />
              导入
            </button>
            <button
              onClick={handleAdd}
              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md text-xs hover:bg-primary-700 flex items-center gap-1 shadow-sm transition-all hover:shadow whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              新增税率
            </button>
          </div>
        </div>
        {/* 高级筛选面板 */}
        {showAdvancedFilter && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">关税率:</span>
              <input
                type="number"
                value={dutyRateMin}
                onChange={(e) => {
                  setDutyRateMin(e.target.value)
                  setPage(1)
                }}
                placeholder="最小"
                className="px-2 py-1 border border-gray-300 rounded text-xs w-16 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-xs text-gray-400">~</span>
              <input
                type="number"
                value={dutyRateMax}
                onChange={(e) => {
                  setDutyRateMax(e.target.value)
                  setPage(1)
                }}
                placeholder="最大"
                className="px-2 py-1 border border-gray-300 rounded text-xs w-16 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
        )}
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">HS编码</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap min-w-[150px] text-[11px] tracking-wide">商品描述</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">原产国</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">关税率</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">增值税率</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">反倾销税</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap min-w-[100px] text-[11px] tracking-wide">贸易措施</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">申报方式</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">最低申报</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">材质/场景</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">单位</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">来源</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">状态</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap text-[11px] tracking-wide">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-500">
                  暂无数据
                </td>
              </tr>
            ) : (
              rates.map((rate) => (
                <tr key={rate.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{rate.hsCode}</div>
                    {rate.hsCode10 && (
                      <div className="text-gray-500 text-[10px]">{rate.hsCode10}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="text-gray-900 truncate" title={rate.goodsDescription}>
                      {rate.goodsDescription}
                    </div>
                    {rate.goodsDescriptionCn && (
                      <div className="text-gray-500 text-[10px] truncate" title={rate.goodsDescriptionCn}>
                        {rate.goodsDescriptionCn}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {rate.originCountryCode && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                        {rate.originCountryCode}
                      </span>
                    )}
                    {rate.originCountry && (
                      <span className="ml-1 text-gray-600">{rate.originCountry}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-medium text-gray-900 whitespace-nowrap">
                    {rate.dutyRate}%
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 whitespace-nowrap">
                    {rate.vatRate}%
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {rate.antiDumpingRate && rate.antiDumpingRate > 0 ? (
                      <span className="text-red-600 font-medium">{rate.antiDumpingRate}%</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[150px]">
                    {rate.measureType ? (
                      <span className="text-[10px] text-gray-600 truncate block" title={rate.measureType}>
                        {rate.measureType.length > 25 
                          ? rate.measureType.substring(0, 25) + '...' 
                          : rate.measureType}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap ${
                      rate.declarationType === 'per_weight' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {rate.declarationType === 'per_weight' ? '按重量' : '按单价'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {rate.minDeclarationValue && rate.minDeclarationValue > 0 ? (
                      <span className="text-orange-600 font-medium">€{rate.minDeclarationValue.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col gap-0.5">
                      {rate.material && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] truncate max-w-[80px]" title={rate.material}>
                          {rate.material}
                        </span>
                      )}
                      {rate.usageScenario && (
                        <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded text-[10px] truncate max-w-[80px]" title={rate.usageScenario}>
                          {rate.usageScenario}
                        </span>
                      )}
                      {!rate.material && !rate.usageScenario && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                    {rate.unitName || '-'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      (rate as any).dataSource === 'taric' ? 'bg-blue-100 text-blue-700' :
                      (rate as any).dataSource === 'import' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {(rate as any).dataSource === 'taric' ? 'TARIC' :
                       (rate as any).dataSource === 'import' ? '导入' : '手动'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      rate.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rate.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {rate.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEdit(rate)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rate)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            共 {total} 条，第 {page}/{totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      <ImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={() => {
          loadRates()
          loadStats()
        }}
      />

      {/* 编辑弹窗 */}
      <EditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSuccess={() => {
          loadRates()
          loadStats()
        }}
        editData={editingRate}
      />

      {/* 实时查询弹窗 */}
      <RealtimeLookupModal
        visible={realtimeLookupVisible}
        onClose={() => setRealtimeLookupVisible(false)}
        onSaveSuccess={() => {
          loadRates()
          loadStats()
        }}
      />
    </div>
  )
}

