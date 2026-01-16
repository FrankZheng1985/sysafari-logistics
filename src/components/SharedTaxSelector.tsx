import { useState, useEffect, useRef } from 'react'
import { Building2, ChevronDown, X, Check, Search } from 'lucide-react'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE_URL = getApiBaseUrl()

interface SharedTaxNumber {
  id: number
  taxType: 'vat' | 'eori' | 'other'
  taxNumber: string
  country?: string
  companyShortName?: string
  companyName?: string
  isVerified: boolean
}

interface SharedTaxSelectorProps {
  billId: string
  billNumber?: string
  containerNumber?: string
  transportType?: string // sea/air/rail/truck
  quantity?: number // 空运为公斤，其他为柜数
  customerId?: string
  customerName?: string
  currentSharedTaxId?: number
  onChange?: (sharedTaxId: number | null, companyName?: string) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export default function SharedTaxSelector({
  billId,
  billNumber,
  containerNumber,
  transportType = 'sea',
  quantity = 1,
  customerId,
  customerName,
  currentSharedTaxId,
  onChange,
  disabled = false,
  size = 'sm'
}: SharedTaxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [taxNumbers, setTaxNumbers] = useState<SharedTaxNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTax, setSelectedTax] = useState<SharedTaxNumber | null>(null)
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 加载共享税号列表
  const loadTaxNumbers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/shared-tax-numbers?status=active`, {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.list || [])
        setTaxNumbers(list)
        
        // 如果有当前选中的ID，找到对应的税号
        if (currentSharedTaxId) {
          const current = list.find((t: SharedTaxNumber) => t.id === currentSharedTaxId)
          if (current) {
            setSelectedTax(current)
          }
        }
      }
    } catch (error) {
      console.error('加载共享税号失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTaxNumbers()
  }, [currentSharedTaxId])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 按公司分组税号
  const groupedTaxNumbers = taxNumbers.reduce((groups: Record<string, SharedTaxNumber[]>, tax) => {
    const key = tax.companyName || tax.companyShortName || '未知公司'
    if (!groups[key]) groups[key] = []
    groups[key].push(tax)
    return groups
  }, {})

  // 筛选
  const filteredGroups = Object.entries(groupedTaxNumbers).filter(([companyName, taxes]) => {
    if (!searchText) return true
    const search = searchText.toLowerCase()
    return companyName.toLowerCase().includes(search) ||
      taxes.some(t => t.taxNumber.toLowerCase().includes(search))
  })

  // 选择税号
  const handleSelect = async (tax: SharedTaxNumber) => {
    if (saving) return
    
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/shared-tax-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          sharedTaxId: tax.id,
          billId,
          billNumber,
          containerNumber,
          transportType,
          quantity,
          customerId,
          customerName
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setSelectedTax(tax)
        setIsOpen(false)
        onChange?.(tax.id, tax.companyName || tax.companyShortName)
      } else {
        console.error('记录使用失败:', data.msg)
      }
    } catch (error) {
      console.error('记录使用失败:', error)
    } finally {
      setSaving(false)
    }
  }

  // 清除选择
  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saving || !selectedTax) return
    
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/shared-tax-usage/${billId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setSelectedTax(null)
        onChange?.(null)
      }
    } catch (error) {
      console.error('清除使用失败:', error)
    } finally {
      setSaving(false)
    }
  }

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-1.5' 
    : 'text-sm px-3 py-2'

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 选择器按钮 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || saving}
        className={`
          w-full flex items-center justify-between gap-2 
          border rounded-lg transition-colors
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-primary-400 cursor-pointer'}
          ${selectedTax ? 'border-green-300' : 'border-gray-300'}
          ${sizeClasses}
        `}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 className={`flex-shrink-0 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${selectedTax ? 'text-green-600' : 'text-gray-400'}`} />
          {selectedTax ? (
            <span className="truncate text-gray-900">
              {selectedTax.companyShortName || selectedTax.companyName}
            </span>
          ) : (
            <span className="text-gray-400">选择共享税号...</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedTax && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded"
              title="清除"
            >
              <X className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-gray-400 hover:text-gray-600`} />
            </button>
          )}
          <ChevronDown className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* 搜索框 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索公司或税号..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* 列表 */}
          <div className="overflow-y-auto max-h-48">
            {loading ? (
              <div className="p-3 text-center text-xs text-gray-400">加载中...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">暂无可用税号</div>
            ) : (
              filteredGroups.map(([companyName, taxes]) => (
                <div key={companyName} className="border-b border-gray-50 last:border-0">
                  <div
                    className={`
                      px-3 py-2 hover:bg-gray-50 cursor-pointer
                      ${selectedTax && taxes.some(t => t.id === selectedTax.id) ? 'bg-green-50' : ''}
                    `}
                    onClick={() => handleSelect(taxes[0])}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-900 truncate">{companyName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {taxes.map(tax => (
                            <span
                              key={tax.id}
                              className={`
                                inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                                ${tax.taxType === 'vat' ? 'bg-blue-50 text-blue-600' : 
                                  tax.taxType === 'eori' ? 'bg-purple-50 text-purple-600' : 
                                  'bg-gray-50 text-gray-600'}
                              `}
                            >
                              <span className="font-medium">{tax.taxType.toUpperCase()}</span>
                              {tax.isVerified && <Check className="w-2.5 h-2.5 text-green-500" />}
                            </span>
                          ))}
                        </div>
                      </div>
                      {selectedTax && taxes.some(t => t.id === selectedTax.id) && (
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
