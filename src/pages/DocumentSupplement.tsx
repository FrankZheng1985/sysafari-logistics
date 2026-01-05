import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, FilePlus, Save, RefreshCw, Search,
  Edit2, Check, X, AlertTriangle, Zap, Database,
  CheckCircle, AlertCircle, HelpCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface TariffItem {
  hsCode: string
  productName: string
  productNameEn: string
  material: string
  unitCode: string
  unitName: string
  dutyRate: number
  vatRate: number
  // 智能规则信息
  needMaterial: boolean
  suggestedUnit: string | null
  suggestedUnitCode: string | null
  chapterName: string
  missingFields: string[]
  canAutoFill: boolean
}

interface EditingItem extends TariffItem {
  isEditing: boolean
  editedProductName: string
  editedProductNameEn: string
  editedMaterial: string
  editedUnitCode: string
  editedUnitName: string
}

interface Stats {
  total: number
  autoFillable: number
  needMaterial: number
  needName: number
  chapterStats: { chapter: string; count: string }[]
}

type Category = 'all' | 'autoFillable' | 'needMaterial'

export default function DocumentSupplement() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EditingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [category, setCategory] = useState<Category>('all')
  const [selectedChapter, setSelectedChapter] = useState<string>('')
  const pageSize = 20

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    loadItems()
  }, [page, category])

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/supplement/stats`)
      const data = await res.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  const loadItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (search) {
        params.append('search', search)
      }
      if (category !== 'all') {
        params.append('category', category)
      }
      
      const res = await fetch(`${API_BASE}/api/cargo/documents/supplement?${params}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setItems((data.data?.list || []).map((item: TariffItem) => ({
          ...item,
          isEditing: false,
          editedProductName: item.productName || '',
          editedProductNameEn: item.productNameEn || '',
          editedMaterial: item.material || '',
          editedUnitCode: item.unitCode || item.suggestedUnitCode || '',
          editedUnitName: item.unitName || item.suggestedUnit || ''
        })))
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载待补充列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadItems()
  }

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory)
    setPage(1)
  }

  const handleStartEdit = (hsCode: string) => {
    setItems(prev => prev.map(item => 
      item.hsCode === hsCode 
        ? { ...item, isEditing: true }
        : item
    ))
  }

  const handleCancelEdit = (hsCode: string) => {
    setItems(prev => prev.map(item => 
      item.hsCode === hsCode 
        ? { 
            ...item, 
            isEditing: false,
            editedProductName: item.productName || '',
            editedProductNameEn: item.productNameEn || '',
            editedMaterial: item.material || '',
            editedUnitCode: item.unitCode || item.suggestedUnitCode || '',
            editedUnitName: item.unitName || item.suggestedUnit || ''
          }
        : item
    ))
  }

  const handleFieldChange = (hsCode: string, field: string, value: string) => {
    setItems(prev => prev.map(item => 
      item.hsCode === hsCode 
        ? { ...item, [field]: value }
        : item
    ))
  }

  // 应用建议单位
  const handleApplySuggestion = (hsCode: string) => {
    setItems(prev => prev.map(item => 
      item.hsCode === hsCode && item.suggestedUnit
        ? { 
            ...item, 
            isEditing: true,
            editedUnitName: item.suggestedUnit,
            editedUnitCode: item.suggestedUnitCode || ''
          }
        : item
    ))
  }

  const handleSaveItem = async (item: EditingItem) => {
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/supplement/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            hsCode: item.hsCode,
            productName: item.editedProductName,
            productNameEn: item.editedProductNameEn,
            material: item.needMaterial ? item.editedMaterial : null,
            unitCode: item.editedUnitCode,
            unitName: item.editedUnitName
          }]
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setItems(prev => prev.map(i => 
          i.hsCode === item.hsCode 
            ? { 
                ...i, 
                isEditing: false,
                productName: item.editedProductName,
                productNameEn: item.editedProductNameEn,
                material: item.editedMaterial,
                unitCode: item.editedUnitCode,
                unitName: item.editedUnitName
              }
            : i
        ))
        loadStats() // 刷新统计
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleBatchSave = async () => {
    const editingItems = items.filter(i => i.isEditing)
    if (editingItems.length === 0) {
      alert('没有需要保存的修改')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/supplement/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editingItems.map(item => ({
            hsCode: item.hsCode,
            productName: item.editedProductName,
            productNameEn: item.editedProductNameEn,
            material: item.needMaterial ? item.editedMaterial : null,
            unitCode: item.editedUnitCode,
            unitName: item.editedUnitName
          }))
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`保存成功，更新了 ${data.data?.updatedCount || 0} 条记录`)
        loadItems()
        loadStats()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 自动批量补充（分批处理避免超时）
  const handleAutoFill = async () => {
    // 如果选择了特定章节，直接处理
    if (selectedChapter) {
      if (!confirm(`确定要自动补充第${selectedChapter}章的数据吗？`)) {
        return
      }
      setAutoFilling(true)
      try {
        const res = await fetch(`${API_BASE}/api/cargo/documents/supplement/auto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter: selectedChapter, dryRun: false })
        })
        const data = await res.json()
        if (data.errCode === 200) {
          alert(`✅ 第${selectedChapter}章补充完成！\n\n成功更新 ${data.data?.updatedCount || 0} 条记录`)
          loadItems()
          loadStats()
        } else {
          alert(data.msg || '自动补充失败')
        }
      } catch (error) {
        console.error('自动补充失败:', error)
        alert('自动补充失败，请稍后重试')
      } finally {
        setAutoFilling(false)
      }
      return
    }

    // 未选择章节时，分批处理所有章节
    if (!confirm(`确定要自动补充全部 ${stats?.autoFillable || 0} 条记录吗？\n\n系统将按章节分批处理，可能需要几分钟时间。`)) {
      return
    }

    setAutoFilling(true)
    const chapters = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']
    let totalUpdated = 0
    let processedChapters = 0

    try {
      for (const chapter of chapters) {
        try {
          const res = await fetch(`${API_BASE}/api/cargo/documents/supplement/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter, dryRun: false })
          })
          const data = await res.json()
          if (data.errCode === 200 && data.data?.updatedCount > 0) {
            totalUpdated += data.data.updatedCount
            processedChapters++
          }
        } catch (e) {
          console.warn(`第${chapter}章处理失败:`, e)
        }
      }
      
      alert(`✅ 自动补充完成！\n\n处理了 ${processedChapters} 个章节\n成功更新 ${totalUpdated} 条记录`)
      loadItems()
      loadStats()
    } catch (error) {
      console.error('自动补充失败:', error)
      alert(`部分完成：已更新 ${totalUpdated} 条记录\n\n请刷新页面查看结果`)
    } finally {
      setAutoFilling(false)
    }
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
    { label: '匹配记录库', path: '/documents/match-records' },
    { label: '敏感产品库', path: '/documents/sensitive-products' },
  ]

  const totalPages = Math.ceil(total / pageSize)
  const editingCount = items.filter(i => i.isEditing).length

  // 获取可自动补充的章节列表
  const autoFillableChapters = stats?.chapterStats
    .filter(s => parseInt(s.chapter) <= 38)
    .sort((a, b) => parseInt(b.count) - parseInt(a.count))
    .slice(0, 10) || []

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/supplement"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div 
            onClick={() => handleCategoryChange('all')}
            className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
              category === 'all' ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">全部待补充</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total.toLocaleString()}</p>
              </div>
              <Database className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div 
            onClick={() => handleCategoryChange('autoFillable')}
            className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
              category === 'autoFillable' ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">可自动补充</p>
                <p className="text-2xl font-semibold text-green-600">{stats.autoFillable.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">不需要材质，可自动填充单位</p>
              </div>
              <Zap className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div 
            onClick={() => handleCategoryChange('needMaterial')}
            className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
              category === 'needMaterial' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">需要补充材质</p>
                <p className="text-2xl font-semibold text-amber-600">{stats.needMaterial.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">工业制品等，需手动填写材质</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
          </div>
        </div>
      )}

      {/* 搜索和操作 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索HS编码或商品名"
                className="w-64 pl-9 pr-3 py-2 border border-gray-300 rounded text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              搜索
            </button>
          </div>
          <div className="flex items-center gap-2">
            {editingCount > 0 && (
              <span className="text-xs text-amber-600">
                {editingCount} 项待保存
              </span>
            )}
            <button
              onClick={handleBatchSave}
              disabled={saving || editingCount === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? '保存中...' : '批量保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 自动补充面板 - 仅在 autoFillable 分类下显示 */}
      {category === 'autoFillable' && stats && stats.autoFillable > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">智能自动补充</p>
              <p className="text-xs text-green-700 mt-1">
                这些记录属于<span className="font-medium">不需要材质</span>的品类（第01-38章：活动物、食品、饮料、化学品等）。
                系统可以根据HS编码自动填充默认单位。
              </p>
              <div className="mt-3 flex items-center gap-3">
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="px-3 py-1.5 border border-green-300 rounded text-sm bg-white"
                >
                  <option value="">全部章节</option>
                  {autoFillableChapters.map(ch => (
                    <option key={ch.chapter} value={ch.chapter}>
                      第{ch.chapter}章 ({parseInt(ch.count).toLocaleString()}条)
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAutoFill}
                  disabled={autoFilling}
                  className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {autoFilling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {autoFilling ? '补充中...' : '一键自动补充'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {category === 'needMaterial' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm text-amber-700 font-medium">需要手动补充材质</p>
              <p className="text-xs text-amber-600 mt-1">
                这些记录属于工业制品类（第39-97章），如塑料制品、纺织品、服装、电子产品等。
                材质信息对于HS分类至关重要，需要人工填写。
              </p>
            </div>
          </div>
        </div>
      )}

      {category === 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <FilePlus className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 font-medium">数据补充说明</p>
              <p className="text-xs text-blue-600 mt-1">
                点击上方卡片可以筛选不同类型的数据。
                <span className="text-green-600 font-medium">绿色卡片</span>的数据可以一键自动补充单位，
                <span className="text-amber-600 font-medium">橙色卡片</span>的数据需要手动填写材质。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 数据列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            {category === 'all' ? '全部' : category === 'autoFillable' ? '可自动补充' : '需补充材质'}
            税率数据 ({total.toLocaleString()}条)
          </h3>
          {category === 'autoFillable' && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              不需要材质
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">HS编码</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">英文名称</th>
                {category !== 'autoFillable' && (
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    材质
                    {category === 'needMaterial' && <span className="text-red-500">*</span>}
                  </th>
                )}
                <th className="px-3 py-2 text-left font-medium text-gray-500">单位</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">章节</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">状态</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={category === 'autoFillable' ? 7 : 8} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={category === 'autoFillable' ? 7 : 8} className="px-4 py-8 text-center text-gray-400">
                    <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    太棒了！没有需要补充的数据
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.hsCode} className={`border-b hover:bg-gray-50 ${item.isEditing ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2 font-mono">{item.hsCode}</td>
                    <td className="px-3 py-2">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.editedProductName}
                          onChange={(e) => handleFieldChange(item.hsCode, 'editedProductName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="输入商品名称"
                        />
                      ) : (
                        <span className={!item.productName ? 'text-gray-400 italic' : ''}>
                          {item.productName || '未填写'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.editedProductNameEn}
                          onChange={(e) => handleFieldChange(item.hsCode, 'editedProductNameEn', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="English name"
                        />
                      ) : (
                        <span className={!item.productNameEn ? 'text-gray-400 italic' : ''}>
                          {item.productNameEn || '-'}
                        </span>
                      )}
                    </td>
                    {category !== 'autoFillable' && (
                      <td className="px-3 py-2">
                        {item.isEditing ? (
                          <input
                            type="text"
                            value={item.editedMaterial}
                            onChange={(e) => handleFieldChange(item.hsCode, 'editedMaterial', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder={item.needMaterial ? "请输入材质" : "不需要"}
                            disabled={!item.needMaterial}
                          />
                        ) : item.needMaterial ? (
                          <span className={!item.material ? 'text-red-500 italic' : ''}>
                            {item.material || '必填'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {item.isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.editedUnitName}
                            onChange={(e) => handleFieldChange(item.hsCode, 'editedUnitName', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="如：件、千克"
                          />
                        </div>
                      ) : item.unitName ? (
                        <span>{item.unitName}</span>
                      ) : item.suggestedUnit ? (
                        <button
                          onClick={() => handleApplySuggestion(item.hsCode)}
                          className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
                          title="点击应用建议单位"
                        >
                          <span className="border-b border-dashed border-green-400">{item.suggestedUnit}</span>
                          <Zap className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-gray-400 italic">未填写</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-gray-500">{item.chapterName}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.missingFields.length === 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                          完整
                        </span>
                      ) : item.canAutoFill ? (
                        <span className="inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs bg-green-100 text-green-600">
                          <Zap className="w-3 h-3 mr-0.5" />
                          可自动
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3 mr-0.5" />
                          待补充
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {item.isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveItem(item)}
                              className="p-1 hover:bg-green-100 rounded text-green-600"
                              title="保存"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancelEdit(item.hsCode)}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              title="取消"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(item.hsCode)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
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
              共 {total.toLocaleString()} 条，第 {page}/{totalPages} 页
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
