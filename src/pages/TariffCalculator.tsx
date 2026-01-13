import { useState, useEffect, useRef } from 'react'
import { Calculator, Package, Search, X, Info, Loader2, ChevronDown } from 'lucide-react'
import PageHeader from '../components/PageHeader'
// UI components available if needed: PageContainer, ContentCard

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

const currencyOptions = ['EUR', 'USD', 'CNY', 'GBP']

// 国家数据接口
interface CountryData {
  id: string
  countryCode: string
  countryNameCn: string
  countryNameEn: string
  continent: string
  status: 'active' | 'inactive'
}

// 重量单位
const weightUnits = ['KG', 'G', 'T', 'LB']

interface TariffRate {
  id: string
  hsCode: string
  hsCode10: string
  goodsDescription: string
  goodsDescriptionCn: string
  originCountry: string
  originCountryCode: string
  dutyRate: number
  dutyRateType: string
  vatRate: number
  antiDumpingRate: number
  countervailingRate: number
  preferentialRate: number | null
  preferentialOrigin: string
  unitCode: string
  unitName: string
}

// 国家增值税率接口
interface CountryVatRate {
  countryCode: string
  countryName: string
  standardRate: number
  reducedRate: number
  isDefault?: boolean
}

export default function TariffCalculator() {
  const [tariffCalc, setTariffCalc] = useState({
    hsCode: '',
    goodsValue: '',
    currency: 'EUR',
    quantity: '',
    exportCountry: 'CN',
    importCountry: 'DE',
    weight: '',
    weightUnit: 'KG',
  })
  
  // 从税率表获取的数据
  const [selectedRate, setSelectedRate] = useState<TariffRate | null>(null)
  const [searchResults, setSearchResults] = useState<TariffRate[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 进口国家的增值税率
  const [countryVatRate, setCountryVatRate] = useState<CountryVatRate | null>(null)
  const [loadingVatRate, setLoadingVatRate] = useState(false)
  
  // 国家列表数据
  const [countries, setCountries] = useState<CountryData[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  
  // 出口国家选择器状态
  const [exportCountrySearch, setExportCountrySearch] = useState('中国')
  const [showExportCountryDropdown, setShowExportCountryDropdown] = useState(false)
  const exportCountryRef = useRef<HTMLDivElement>(null)
  
  // 进口国家选择器状态
  const [importCountrySearch, setImportCountrySearch] = useState('德国')
  const [showImportCountryDropdown, setShowImportCountryDropdown] = useState(false)
  const importCountryRef = useRef<HTMLDivElement>(null)
  
  const [tariffResult, setTariffResult] = useState<{
    dutyAmount: number
    vatAmount: number
    antiDumpingAmount: number
    countervailingAmount: number
    totalTax: number
    totalCost: number
  } | null>(null)

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
      if (exportCountryRef.current && !exportCountryRef.current.contains(event.target as Node)) {
        setShowExportCountryDropdown(false)
      }
      if (importCountryRef.current && !importCountryRef.current.contains(event.target as Node)) {
        setShowImportCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 获取国家列表
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/countries?status=active`)
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setCountries(data.data)
          // 设置初始显示的国家名称
          const exportCountry = data.data.find((c: CountryData) => c.countryCode === tariffCalc.exportCountry)
          const importCountry = data.data.find((c: CountryData) => c.countryCode === tariffCalc.importCountry)
          if (exportCountry) setExportCountrySearch(exportCountry.countryNameCn)
          if (importCountry) setImportCountrySearch(importCountry.countryNameCn)
        }
      } catch (error) {
        console.error('获取国家列表失败:', error)
      } finally {
        setLoadingCountries(false)
      }
    }
    fetchCountries()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 获取进口国家的增值税率
  const fetchCountryVatRate = async (countryCode: string) => {
    setLoadingVatRate(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/vat-rates/by-country/${countryCode}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setCountryVatRate(data.data)
      }
    } catch (error) {
      console.error('获取增值税率失败:', error)
      // 使用默认税率
      setCountryVatRate({
        countryCode,
        countryName: '默认',
        standardRate: 19,
        reducedRate: 0,
        isDefault: true,
      })
    } finally {
      setLoadingVatRate(false)
    }
  }

  // 当进口国家变化时，获取对应的增值税率
   
  useEffect(() => {
    if (tariffCalc.importCountry) {
      fetchCountryVatRate(tariffCalc.importCountry)
    }
  }, [tariffCalc.importCountry])

  // 搜索HS编码
  const searchHsCode = async (keyword: string) => {
    if (!keyword || keyword.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setSearching(true)
    try {
      // 可选择性地按出口国家过滤
      let url = `${API_BASE_URL}/api/tariff-rates/search?hsCode=${encodeURIComponent(keyword)}`
      if (tariffCalc.exportCountry) {
        url += `&origin=${tariffCalc.exportCountry}`
      }
      const response = await fetch(url)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        const results = data.data as TariffRate[]
        setSearchResults(results)
        
        // 检查是否有精确匹配的HS编码（8位或10位）
        const exactMatch = results.find(
          (rate) => rate.hsCode === keyword || rate.hsCode10 === keyword
        )
        
        if (exactMatch) {
          // 精确匹配时自动选择
          setSelectedRate(exactMatch)
          setShowDropdown(false)
          setTariffResult(null) // 清除之前的计算结果
        } else if (results.length > 0) {
          // 有搜索结果但没有精确匹配，显示下拉框让用户选择
          setShowDropdown(true)
        } else {
          setShowDropdown(false)
        }
      }
    } catch (error) {
      console.error('搜索HS编码失败:', error)
    } finally {
      setSearching(false)
    }
  }

  // 防抖搜索
  const handleHsCodeChange = (value: string) => {
    setTariffCalc({ ...tariffCalc, hsCode: value })
    
    // 清除之前的超时
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // 设置新的搜索超时
    searchTimeoutRef.current = setTimeout(() => {
      searchHsCode(value)
    }, 300)
  }

  // 选择HS编码
  const handleSelectRate = (rate: TariffRate) => {
    setSelectedRate(rate)
    setTariffCalc({ ...tariffCalc, hsCode: rate.hsCode10 || rate.hsCode })
    setShowDropdown(false)
    setTariffResult(null)
  }

  // 清除选择
  const handleClearSelection = () => {
    setSelectedRate(null)
    setTariffCalc({ ...tariffCalc, hsCode: '' })
    setTariffResult(null)
  }

  // 关税计算
  const calculateTariff = () => {
    const goodsValue = parseFloat(tariffCalc.goodsValue) || 0
    if (goodsValue <= 0) {
      alert('请输入货物价值')
      return
    }
    
    // 如果选择了税率则使用选择的税率，否则使用默认值
    const dutyRate = selectedRate?.dutyRate || 0
    // 优先使用进口国家的增值税率，其次使用HS编码对应的税率，最后使用默认19%
    const vatRate = countryVatRate?.standardRate ?? selectedRate?.vatRate ?? 19
    const antiDumpingRate = selectedRate?.antiDumpingRate || 0
    const countervailingRate = selectedRate?.countervailingRate || 0
    
    // 关税 = 货值 * 关税税率
    const dutyAmount = goodsValue * (dutyRate / 100)
    
    // 反倾销税 = 货值 * 反倾销税率
    const antiDumpingAmount = goodsValue * (antiDumpingRate / 100)
    
    // 反补贴税 = 货值 * 反补贴税率
    const countervailingAmount = goodsValue * (countervailingRate / 100)
    
    // 增值税基数 = 货值 + 关税 + 反倾销税 + 反补贴税
    const vatBase = goodsValue + dutyAmount + antiDumpingAmount + countervailingAmount
    
    // 增值税 = 增值税基数 * 增值税率
    const vatAmount = vatBase * (vatRate / 100)
    
    // 总税费
    const totalTax = dutyAmount + antiDumpingAmount + countervailingAmount + vatAmount
    
    // 总成本 = 货值 + 总税费
    const totalCost = goodsValue + totalTax
    
    setTariffResult({
      dutyAmount: Math.round(dutyAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      antiDumpingAmount: Math.round(antiDumpingAmount * 100) / 100,
      countervailingAmount: Math.round(countervailingAmount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    })
  }

  // 过滤国家列表
  const filteredExportCountries = countries.filter(c => 
    c.countryNameCn.includes(exportCountrySearch) || 
    c.countryNameEn.toLowerCase().includes(exportCountrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(exportCountrySearch.toLowerCase())
  )
  
  const filteredImportCountries = countries.filter(c => 
    c.countryNameCn.includes(importCountrySearch) || 
    c.countryNameEn.toLowerCase().includes(importCountrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(importCountrySearch.toLowerCase())
  )

  // 选择出口国家
  const handleSelectExportCountry = (country: CountryData) => {
    setTariffCalc({ ...tariffCalc, exportCountry: country.countryCode })
    setExportCountrySearch(country.countryNameCn)
    setShowExportCountryDropdown(false)
  }

  // 选择进口国家
  const handleSelectImportCountry = (country: CountryData) => {
    setTariffCalc({ ...tariffCalc, importCountry: country.countryCode })
    setImportCountrySearch(country.countryNameCn)
    setShowImportCountryDropdown(false)
  }

  // 重置表单
  const resetForm = () => {
    setTariffCalc({
      hsCode: '',
      goodsValue: '',
      currency: 'EUR',
      quantity: '',
      exportCountry: 'CN',
      importCountry: 'DE',
      weight: '',
      weightUnit: 'KG',
    })
    setSelectedRate(null)
    setTariffResult(null)
    // 重置国家搜索框
    const defaultExport = countries.find(c => c.countryCode === 'CN')
    const defaultImport = countries.find(c => c.countryCode === 'DE')
    setExportCountrySearch(defaultExport?.countryNameCn || '中国')
    setImportCountrySearch(defaultImport?.countryNameCn || '德国')
    setSearchResults([])
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="关税计算"
        icon={<Calculator className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools' },
          { label: '关税计算' }
        ]}
      />
      
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="bg-white rounded border border-gray-200 shadow-sm p-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-3 h-3 text-primary-600" />
              货物关税计算器
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* 左侧：HS编码搜索 */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-700 border-b pb-1">海关编码查询</h3>
                
                {/* HS编码搜索 */}
                <div ref={searchRef} className="relative">
                  <label className="block text-xs text-gray-600 mb-1">
                    海关编码 (HS Code) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tariffCalc.hsCode}
                      onChange={(e) => handleHsCodeChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      className="w-full px-2 py-1 pr-8 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      placeholder="输入HS编码搜索..."
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {searching && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
                      {selectedRate && (
                        <button onClick={handleClearSelection} className="text-gray-400 hover:text-gray-600" title="清除选择">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {!selectedRate && !searching && <Search className="w-3 h-3 text-gray-400" />}
                    </div>
                  </div>
                  
                  {/* 搜索结果下拉 */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {searchResults.map((rate) => (
                        <button
                          key={rate.id}
                          onClick={() => handleSelectRate(rate)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900">{rate.hsCode10 || rate.hsCode}</span>
                            <span className="text-[10px] text-gray-500">{rate.originCountry || '通用'}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                            {rate.goodsDescriptionCn || rate.goodsDescription}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">关税 {rate.dutyRate}%</span>
                            <span className="text-[10px] px-1 py-0.5 bg-green-50 text-green-600 rounded">增值税 {rate.vatRate}%</span>
                            {rate.antiDumpingRate > 0 && (
                              <span className="text-[10px] px-1 py-0.5 bg-red-50 text-red-600 rounded">反倾销 {rate.antiDumpingRate}%</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 已选择的HS编码信息 */}
                {selectedRate && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-green-900">{selectedRate.hsCode10 || selectedRate.hsCode}</div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✓ 已匹配</span>
                    </div>
                    <div className="text-green-700 text-[10px] mt-0.5">
                      {selectedRate.goodsDescriptionCn || selectedRate.goodsDescription}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        关税 {selectedRate.dutyRate}%
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                        增值税 {selectedRate.vatRate}%
                      </span>
                      {selectedRate.antiDumpingRate > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                          反倾销 {selectedRate.antiDumpingRate}%
                        </span>
                      )}
                      {selectedRate.countervailingRate > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                          反补贴 {selectedRate.countervailingRate}%
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px]">
                      {selectedRate.originCountry && (
                        <span className="text-green-600">原产地: {selectedRate.originCountry}</span>
                      )}
                      {selectedRate.unitName && (
                        <span className="text-green-600">单位: {selectedRate.unitName}</span>
                      )}
                    </div>
                  </div>
                )}

                {!selectedRate && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
                    <Info className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-[10px] text-amber-700">
                      请输入HS编码搜索并选择，以获取准确的关税、反倾销税、反补贴税税率。增值税率根据进口国家自动获取。
                    </span>
                  </div>
                )}

                {/* 出口国家和进口国家 */}
                <div className="grid grid-cols-2 gap-2">
                  {/* 出口国家选择器 */}
                  <div ref={exportCountryRef} className="relative">
                    <label className="block text-xs text-gray-600 mb-1">出口国家</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={exportCountrySearch}
                        onChange={(e) => {
                          setExportCountrySearch(e.target.value)
                          setShowExportCountryDropdown(true)
                        }}
                        onFocus={() => setShowExportCountryDropdown(true)}
                        placeholder={loadingCountries ? '加载中...' : '搜索或选择国家'}
                        className="w-full px-2 py-1 pr-7 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowExportCountryDropdown(!showExportCountryDropdown)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                        title="展开/收起出口国家列表"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportCountryDropdown ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showExportCountryDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {filteredExportCountries.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500 text-center">
                            {loadingCountries ? '加载中...' : '未找到匹配的国家'}
                          </div>
                        ) : (
                          filteredExportCountries.map(country => (
                            <div
                              key={country.id}
                              onClick={() => handleSelectExportCountry(country)}
                              className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-primary-50 flex items-center justify-between ${
                                tariffCalc.exportCountry === country.countryCode ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                              }`}
                            >
                              <span>{country.countryNameCn}</span>
                              <span className="text-gray-400 text-[10px]">{country.countryCode}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 进口国家选择器 */}
                  <div ref={importCountryRef} className="relative">
                    <label className="block text-xs text-gray-600 mb-1">进口国家</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={importCountrySearch}
                        onChange={(e) => {
                          setImportCountrySearch(e.target.value)
                          setShowImportCountryDropdown(true)
                        }}
                        onFocus={() => setShowImportCountryDropdown(true)}
                        placeholder={loadingCountries ? '加载中...' : '搜索或选择国家'}
                        className="w-full px-2 py-1 pr-7 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImportCountryDropdown(!showImportCountryDropdown)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                        title="展开/收起进口国家列表"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showImportCountryDropdown ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showImportCountryDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {filteredImportCountries.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500 text-center">
                            {loadingCountries ? '加载中...' : '未找到匹配的国家'}
                          </div>
                        ) : (
                          filteredImportCountries.map(country => (
                            <div
                              key={country.id}
                              onClick={() => handleSelectImportCountry(country)}
                              className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-primary-50 flex items-center justify-between ${
                                tariffCalc.importCountry === country.countryCode ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                              }`}
                            >
                              <span>{country.countryNameCn}</span>
                              <span className="text-gray-400 text-[10px]">{country.countryCode}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧：税率信息 + 货物信息 */}
              <div className="space-y-3">
                {/* 税率信息（只读） */}
                <h3 className="text-xs font-medium text-gray-700 border-b pb-1">税率信息（自动获取）</h3>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">关税税率 (%)</label>
                      <input
                        type="text"
                        value={selectedRate ? `${selectedRate.dutyRate}%` : '-'}
                        disabled
                        title="关税税率"
                        className={`w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 ${
                          selectedRate ? 'text-blue-600 font-medium' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        增值税率 (%)
                        {countryVatRate && !countryVatRate.isDefault && (
                          <span className="ml-1 text-[10px] text-emerald-600">
                            ({countryVatRate.countryName})
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={loadingVatRate ? '加载中...' : countryVatRate ? `${countryVatRate.standardRate}%` : '19% (默认)'}
                          disabled
                          title="增值税率"
                          className={`w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 ${
                            countryVatRate && !countryVatRate.isDefault ? 'text-emerald-600 font-medium' : 'text-gray-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">反倾销税率 (%)</label>
                      <input
                        type="text"
                        value={selectedRate ? (selectedRate.antiDumpingRate > 0 ? `${selectedRate.antiDumpingRate}%` : '-') : '-'}
                        disabled
                        title="反倾销税率"
                        className={`w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 ${
                          selectedRate && selectedRate.antiDumpingRate > 0 ? 'text-red-600 font-medium' : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">反补贴税率 (%)</label>
                      <input
                        type="text"
                        value={selectedRate ? (selectedRate.countervailingRate > 0 ? `${selectedRate.countervailingRate}%` : '-') : '-'}
                        disabled
                        title="反补贴税率"
                        className={`w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 ${
                          selectedRate && selectedRate.countervailingRate > 0 ? 'text-red-600 font-medium' : 'text-gray-400'
                        }`}
                      />
                    </div>
                  </div>
                </div>


                {/* 增值税率来源提示 */}
                {countryVatRate && !countryVatRate.isDefault && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded flex items-start gap-2">
                    <Info className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-[10px] text-emerald-700">
                      增值税率 <span className="font-medium">{countryVatRate.standardRate}%</span> 来自基础数据管理-{countryVatRate.countryName}
                    </span>
                  </div>
                )}

                {/* 货物信息 */}
                <h3 className="text-xs font-medium text-gray-700 border-b pb-1 mt-4">货物信息</h3>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    货物价值 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={tariffCalc.goodsValue}
                      onChange={(e) => setTariffCalc({ ...tariffCalc, goodsValue: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      placeholder="输入货值"
                    />
                    <select
                      value={tariffCalc.currency}
                      onChange={(e) => setTariffCalc({ ...tariffCalc, currency: e.target.value })}
                      title="选择货币"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      {currencyOptions.map(cur => (
                        <option key={cur} value={cur}>{cur}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 数量和重量 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="block text-xs text-gray-600 mb-1">数量</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={tariffCalc.quantity}
                        onChange={(e) => {
                          // 限制数量最多4位数
                          const value = e.target.value.slice(0, 4)
                          setTariffCalc({ ...tariffCalc, quantity: value })
                        }}
                        className="flex-1 min-w-0 w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="数量"
                        maxLength={4}
                      />
                      {selectedRate?.unitName && (
                        <span className="flex-shrink-0 flex items-center px-1.5 text-[10px] text-gray-500 bg-gray-100 rounded whitespace-nowrap">
                          {selectedRate.unitName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs text-gray-600 mb-1">重量</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={tariffCalc.weight}
                        onChange={(e) => {
                          // 限制重量最多8位数
                          const value = e.target.value.slice(0, 8)
                          setTariffCalc({ ...tariffCalc, weight: value })
                        }}
                        className="flex-1 min-w-0 w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="重量"
                        maxLength={8}
                      />
                      <select
                        value={tariffCalc.weightUnit}
                        onChange={(e) => setTariffCalc({ ...tariffCalc, weightUnit: e.target.value })}
                        title="选择重量单位"
                        className="flex-shrink-0 w-12 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      >
                        {weightUnits.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={resetForm}
                className="flex items-center gap-1 px-3 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 text-xs font-medium"
              >
                重置
              </button>
              <button
                onClick={calculateTariff}
                disabled={!tariffCalc.goodsValue}
                className="flex items-center gap-1 px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator className="w-3 h-3" />
                计算税费
              </button>
            </div>

            {/* 计算结果 */}
            {tariffResult && (
              <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded border border-orange-200">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">税费明细</h3>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center p-2 bg-white rounded">
                    <div className="text-[10px] text-gray-500 mb-0.5">关税</div>
                    <div className="text-sm font-bold text-gray-900">{tariffCalc.currency} {tariffResult.dutyAmount}</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <div className="text-[10px] text-gray-500 mb-0.5">增值税</div>
                    <div className="text-sm font-bold text-gray-900">{tariffCalc.currency} {tariffResult.vatAmount}</div>
                  </div>
                  <div className={`text-center p-2 rounded ${
                    (tariffResult.antiDumpingAmount > 0 || tariffResult.countervailingAmount > 0) 
                      ? 'bg-red-50' 
                      : 'bg-white'
                  }`}>
                    <div className={`text-[10px] mb-0.5 ${
                      (tariffResult.antiDumpingAmount > 0 || tariffResult.countervailingAmount > 0)
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      其他税费
                    </div>
                    <div className={`text-sm font-bold ${
                      (tariffResult.antiDumpingAmount > 0 || tariffResult.countervailingAmount > 0)
                        ? 'text-red-700'
                        : 'text-gray-900'
                    }`}>
                      {tariffCalc.currency} {Math.round((tariffResult.antiDumpingAmount + tariffResult.countervailingAmount) * 100) / 100}
                    </div>
                    {(tariffResult.antiDumpingAmount > 0 || tariffResult.countervailingAmount > 0) && (
                      <div className="text-[9px] text-red-500 mt-0.5">
                        {tariffResult.antiDumpingAmount > 0 && (
                          <span>反倾销 {tariffResult.antiDumpingAmount}</span>
                        )}
                        {tariffResult.antiDumpingAmount > 0 && tariffResult.countervailingAmount > 0 && (
                          <span> + </span>
                        )}
                        {tariffResult.countervailingAmount > 0 && (
                          <span>反补贴 {tariffResult.countervailingAmount}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-white rounded border border-orange-200">
                    <div className="text-[10px] text-gray-500 mb-0.5">税费合计</div>
                    <div className="text-sm font-bold text-orange-600">{tariffCalc.currency} {tariffResult.totalTax}</div>
                  </div>
                  <div className="text-center p-2 bg-orange-500 rounded">
                    <div className="text-[10px] text-orange-100 mb-0.5">含税总成本</div>
                    <div className="text-base font-bold text-white">{tariffCalc.currency} {tariffResult.totalCost}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 计算说明 */}
          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <h4 className="text-xs font-medium text-amber-800 mb-1">计算说明</h4>
            <ul className="text-[10px] text-amber-700 space-y-0.5">
              <li>• 关税 = 货值 × 关税税率</li>
              <li>• 反倾销税 = 货值 × 反倾销税率（如适用）</li>
              <li>• 反补贴税 = 货值 × 反补贴税率（如适用）</li>
              <li>• 增值税 = (货值 + 关税 + 反倾销税 + 反补贴税) × 增值税率</li>
              <li>• 总税费 = 关税 + 反倾销税 + 反补贴税 + 增值税</li>
              <li>• 含税成本 = 货值 + 总税费</li>
              <li>• 税率数据来源于系统税率管理，如需更新请联系管理员</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
