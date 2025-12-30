import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, FilePlus, Save, RefreshCw, Search,
  Edit2, Check, X, AlertTriangle
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
}

interface EditingItem extends TariffItem {
  isEditing: boolean
  editedProductName: string
  editedProductNameEn: string
  editedMaterial: string
  editedUnitCode: string
  editedUnitName: string
}

export default function DocumentSupplement() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EditingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadItems()
  }, [page])

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
      
      const res = await fetch(`${API_BASE}/api/cargo/documents/supplement?${params}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setItems((data.data?.list || []).map((item: TariffItem) => ({
          ...item,
          isEditing: false,
          editedProductName: item.productName || '',
          editedProductNameEn: item.productNameEn || '',
          editedMaterial: item.material || '',
          editedUnitCode: item.unitCode || '',
          editedUnitName: item.unitName || ''
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
            editedUnitCode: item.unitCode || '',
            editedUnitName: item.unitName || ''
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
            material: item.editedMaterial,
            unitCode: item.editedUnitCode,
            unitName: item.editedUnitName
          }]
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        // 更新本地状态
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
            material: item.editedMaterial,
            unitCode: item.editedUnitCode,
            unitName: item.editedUnitName
          }))
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`保存成功，更新了 ${data.data?.updatedCount || 0} 条记录`)
        loadItems()
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

  const getMissingFields = (item: EditingItem) => {
    const missing = []
    if (!item.productName && !item.editedProductName) missing.push('商品名')
    if (!item.material && !item.editedMaterial) missing.push('材质')
    if (!item.unitName && !item.editedUnitName) missing.push('单位')
    return missing
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
  ]

  const totalPages = Math.ceil(total / pageSize)
  const editingCount = items.filter(i => i.isEditing).length

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/supplement"
        onTabChange={(path) => navigate(path)}
      />

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

      {/* 提示信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <FilePlus className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm text-blue-700 font-medium">数据补充说明</p>
            <p className="text-xs text-blue-600 mt-1">
              此页面显示税率库中缺少商品名称、材质或单位信息的记录。补充这些信息可以提高HS匹配的准确性。
            </p>
          </div>
        </div>
      </div>

      {/* 数据列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            待补充税率数据 ({total}条)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">HS编码</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">英文名称</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">材质</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">单位</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">关税率</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">缺失字段</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
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
                    <td className="px-3 py-2">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.editedMaterial}
                          onChange={(e) => handleFieldChange(item.hsCode, 'editedMaterial', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="输入材质"
                        />
                      ) : (
                        <span className={!item.material ? 'text-gray-400 italic' : ''}>
                          {item.material || '未填写'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.editedUnitName}
                          onChange={(e) => handleFieldChange(item.hsCode, 'editedUnitName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="如：件、千克"
                        />
                      ) : (
                        <span className={!item.unitName ? 'text-gray-400 italic' : ''}>
                          {item.unitName || '未填写'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{item.dutyRate}%</td>
                    <td className="px-3 py-2 text-center">
                      {getMissingFields(item).length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          {getMissingFields(item).join(', ')}
                        </span>
                      ) : (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
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
