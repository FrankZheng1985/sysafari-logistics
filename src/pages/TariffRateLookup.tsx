/**
 * 关税税率实时查询页面
 * 支持 EU TARIC 和 UK Trade Tariff 数据源
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Globe,
  Zap,
  RefreshCw,
  AlertCircle,
  FileWarning,
  Shield,
  Ban,
  X,
  ArrowLeft,
  Search,
  Database,
  ExternalLink,
  Check,
  FileText,
  Hash
} from 'lucide-react'
import {
  lookupTaricRealtime,
  lookupTaricV2,
  lookupUkTaricRealtime,
  getTaricCountryCodes,
  TaricRealtimeResult,
  UkTaricRealtimeResult,
  TaricLookupV2Result,
  CountryCode,
  TaricDataSource,
  UkRegion
} from '../utils/api'

// 格式化日期时间
function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TariffRateLookup() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // 从 URL 参数获取初始值
  const initialHsCode = searchParams.get('code') || ''
  const initialCountry = searchParams.get('country') || ''
  const initialDataSource = (searchParams.get('source') as TaricDataSource) || 'eu'
  
  const [hsCode, setHsCode] = useState(initialHsCode)
  const [originCountry, setOriginCountry] = useState(initialCountry)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TaricRealtimeResult | UkTaricRealtimeResult | null>(null)
  const [resultV2, setResultV2] = useState<TaricLookupV2Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState<CountryCode[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  
  // 数据源选择
  const [dataSource, setDataSource] = useState<TaricDataSource>(initialDataSource)
  const [ukRegion, setUkRegion] = useState<UkRegion>('uk')
  // 使用 V2 API（智能查询）
  const [useV2Api, setUseV2Api] = useState(true)
  // 国家搜索
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const countryInputRef = useRef<HTMLInputElement>(null)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  // 标记是否已执行初始查询
  const initialQueryDone = useRef(false)
  // 搜索模式：code=按编码查询, name=按品名搜索
  const [searchMode, setSearchMode] = useState<'code' | 'name'>('code')
  // 品名搜索关键词
  const [productName, setProductName] = useState('')

  // 更新 URL 参数（不触发页面跳转，只替换当前历史记录）
  const updateUrlParams = useCallback((code: string, country: string, source: string) => {
    const params = new URLSearchParams()
    if (code) params.set('code', code)
    if (country) params.set('country', country)
    if (source !== 'eu') params.set('source', source)
    setSearchParams(params, { replace: true })
  }, [setSearchParams])

  // 加载国家代码
  useEffect(() => {
    loadCountries()
  }, [])
  
  // 国家列表加载完成后，设置初始国家显示
  useEffect(() => {
    if (countries.length > 0 && initialCountry && !countrySearch) {
      const country = countries.find(c => c.code === initialCountry)
      if (country) {
        setCountrySearch(`${country.code} - ${country.name}`)
      }
    }
  }, [countries, initialCountry])
  
  // 如果有初始 HS 编码，自动查询（只执行一次）
  useEffect(() => {
    if (initialHsCode && initialHsCode.length >= 4 && !initialQueryDone.current) {
      initialQueryDone.current = true
      handleLookupWithCode(initialHsCode, initialCountry)
    }
  }, [initialHsCode, initialCountry])

  // 切换数据源时清除结果
  useEffect(() => {
    setResult(null)
    setResultV2(null)
    setError(null)
  }, [dataSource, ukRegion, useV2Api])

  // 点击外部关闭国家下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 过滤国家列表
  const filteredCountries = countries.filter((c) => {
    if (!countrySearch) return true
    const search = countrySearch.toUpperCase()
    return c.code.toUpperCase().includes(search) || c.name.toUpperCase().includes(search)
  })

  // 选择国家
  const handleSelectCountry = (code: string, name: string) => {
    setOriginCountry(code)
    setCountrySearch(code ? `${code} - ${name}` : '')
    setShowCountryDropdown(false)
  }

  // 清除国家选择
  const handleClearCountry = () => {
    setOriginCountry('')
    setCountrySearch('')
  }

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

  // 带参数的查询函数（用于初始化和子编码点击）
  const handleLookupWithCode = async (code: string, country: string) => {
    if (!code || code.length < 4) {
      setError('请输入至少4位的 HS 编码')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setResultV2(null)
    
    // 更新 URL 参数
    updateUrlParams(code, country, dataSource)

    try {
      if (dataSource === 'uk') {
        const response = await lookupUkTaricRealtime(code, country || undefined, ukRegion, true)
        if (response.errCode === 200 && response.data) {
          setResult(response.data)
        } else {
          setError(response.msg || '查询失败')
        }
      } else if (useV2Api) {
        const response = await lookupTaricV2(code, country || undefined, true)
        if (response.errCode === 200 && response.data) {
          setResultV2(response.data)
        } else {
          setError(response.msg || '查询失败')
        }
      } else {
        const response = await lookupTaricRealtime(code, country || undefined, true)
        if (response.errCode === 200 && response.data) {
          setResult(response.data)
        } else {
          setError(response.msg || '查询失败')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLookup = async () => {
    await handleLookupWithCode(hsCode, originCountry)
  }

  // 获取数据源显示名称
  const getDataSourceLabel = () => {
    if (dataSource === 'uk') {
      return ukRegion === 'xi' ? 'UK Trade Tariff (北爱尔兰/EU规则)' : 'UK Trade Tariff (英国)'
    }
    return 'EU TARIC (欧盟)'
  }

  // 返回上一页
  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate('/system/tariff-rates')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回</span>
              </button>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  dataSource === 'uk' ? 'bg-red-600' : 'bg-blue-600'
                }`}>
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">关税税率实时查询</h1>
                  <p className="text-sm text-gray-500">{getDataSourceLabel()}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/system/tariff-rates')}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <Database className="w-4 h-4" />
                税率数据库
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 数据源选择 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">数据源:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDataSource('eu')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dataSource === 'eu'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🇪🇺 EU TARIC
              </button>
              <button
                onClick={() => setDataSource('uk')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dataSource === 'uk'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                🇬🇧 UK Trade Tariff
              </button>
            </div>
            
            {dataSource === 'uk' && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                <span className="text-sm text-gray-500">地区:</span>
                <select
                  value={ukRegion}
                  onChange={(e) => setUkRegion(e.target.value as UkRegion)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="uk">英国本土</option>
                  <option value="xi">北爱尔兰 (EU规则)</option>
                </select>
              </div>
            )}
            
            {dataSource === 'eu' && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useV2Api}
                    onChange={(e) => setUseV2Api(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">智能验证模式</span>
                </label>
                <span className="text-xs text-gray-400" title="智能验证模式会检查编码有效性，显示层级结构和候选编码">(?)</span>
              </div>
            )}
          </div>
        </div>

        {/* 查询表单 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* 搜索模式切换 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-600">查询方式:</span>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSearchMode('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  searchMode === 'code'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Hash className="w-4 h-4" />
                按编码查询
              </button>
              <button
                onClick={() => setSearchMode('name')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  searchMode === 'name'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                按品名搜索
              </button>
            </div>
          </div>

          {/* 按编码查询 */}
          {searchMode === 'code' && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-700 font-medium mb-2">HS 编码 (8-10位)</label>
                <input
                  type="text"
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="如: 6109100010"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-64 relative">
                <label className="block text-sm text-gray-700 font-medium mb-2">原产国 (可选)</label>
              <div className="relative">
                <input
                  ref={countryInputRef}
                  type="text"
                  value={countrySearch}
                  onChange={(e) => {
                    setCountrySearch(e.target.value)
                    setShowCountryDropdown(true)
                    if (!e.target.value) {
                      setOriginCountry('')
                    }
                  }}
                  onFocus={() => setShowCountryDropdown(true)}
                  placeholder={loadingCountries ? '加载中...' : '输入国家代码或名称'}
                  disabled={loadingCountries}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {countrySearch && (
                  <button
                    type="button"
                    onClick={handleClearCountry}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {/* 国家下拉列表 */}
              {showCountryDropdown && !loadingCountries && (
                <div
                  ref={countryDropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                >
                  <div
                    className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-sm text-gray-500 border-b"
                    onClick={() => handleSelectCountry('', '')}
                  >
                    全部国家
                  </div>
                  {filteredCountries.length > 0 ? (
                    filteredCountries.slice(0, 50).map((c) => (
                      <div
                        key={c.code}
                        className={`px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm ${
                          originCountry === c.code ? 'bg-blue-100 text-blue-700' : ''
                        }`}
                        onClick={() => handleSelectCountry(c.code, c.name)}
                      >
                        <span className="font-medium">{c.code}</span>
                        <span className="text-gray-500 ml-2">- {c.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-400">无匹配结果</div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleLookup}
              disabled={loading || !hsCode}
              className={`px-6 py-3 text-white rounded-lg text-base font-medium disabled:opacity-50 flex items-center gap-2 transition-all ${
                dataSource === 'uk' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {loading ? '查询中...' : '实时查询'}
            </button>
          </div>
          )}

          {/* 按品名搜索 */}
          {searchMode === 'name' && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-700 font-medium mb-2">商品名称 / 品名描述</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && productName.trim()) {
                      navigate(`/hs/search?q=${encodeURIComponent(productName.trim())}`)
                    }
                  }}
                  placeholder="如: 挖掘机、T恤、手机壳..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  if (productName.trim()) {
                    navigate(`/hs/search?q=${encodeURIComponent(productName.trim())}`)
                  }
                }}
                disabled={!productName.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium disabled:opacity-50 flex items-center gap-2 hover:bg-blue-700 transition-all"
              >
                <Search className="w-5 h-5" />
                搜索 HS 编码
              </button>
            </div>
          )}

          {/* 快捷提示 */}
          {searchMode === 'name' && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-1">💡 搜索提示</p>
              <ul className="text-xs space-y-0.5 text-gray-500">
                <li>• 输入商品名称或描述关键词，系统将搜索匹配的 HS 编码</li>
                <li>• 支持中英文搜索，建议使用具体的商品描述</li>
                <li>• 搜索结果会按章节分类展示，方便快速定位</li>
              </ul>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* V2 智能查询结果 */}
        {resultV2 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-base font-medium text-gray-900">智能查询结果</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  resultV2.matchStatus === 'exact' ? 'bg-green-100 text-green-700' :
                  resultV2.matchStatus === 'parent_node' ? 'bg-blue-100 text-blue-700' :
                  resultV2.matchStatus === 'not_found' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {resultV2.matchStatus === 'exact' ? '✓ 精确匹配' :
                   resultV2.matchStatus === 'parent_node' ? '📂 分类编码' :
                   resultV2.matchStatus === 'not_found' ? '✗ 编码不存在' :
                   resultV2.matchStatus}
                </span>
                {resultV2.savedToDb && (
                  <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    resultV2.savedToDb === 'inserted' ? 'bg-green-100 text-green-700' :
                    resultV2.savedToDb === 'updated' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <Check className="w-3 h-3" />
                    {resultV2.savedToDb === 'inserted' ? '已保存到数据库' :
                     resultV2.savedToDb === 'updated' ? '已更新数据库' : '保存失败'}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                查询时间: {formatDateTime(resultV2.queryTime)}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* 建议和警告 */}
              {resultV2.suggestion && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  resultV2.matchStatus === 'exact' ? 'bg-green-50 text-green-700 border border-green-200' :
                  resultV2.matchStatus === 'parent_node' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className="text-xl">{resultV2.matchStatus === 'exact' ? '✓' : resultV2.matchStatus === 'parent_node' ? 'ℹ️' : '⚠️'}</span>
                  <div>
                    <p className="text-sm">{resultV2.suggestion}</p>
                    {resultV2.warning && <p className="mt-2 font-medium text-sm">{resultV2.warning}</p>}
                  </div>
                </div>
              )}

              {/* 编码验证信息 */}
              {resultV2.validation && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">输入编码</p>
                    <p className="font-mono text-lg font-medium">{resultV2.inputCode}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">层级</p>
                    <p className="text-lg font-medium">
                      {resultV2.validation.level === 'chapter' ? '章 (Chapter)' :
                       resultV2.validation.level === 'heading' ? '品目 (Heading)' :
                       resultV2.validation.level === 'subheading' ? '子目 (Subheading)' :
                       resultV2.validation.level === 'cn' ? 'CN编码' :
                       resultV2.validation.level === 'taric' ? 'TARIC编码' : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">是否有效</p>
                    <p className={`text-lg font-medium ${resultV2.validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {resultV2.validation.isValid ? '✓ 有效' : '✗ 无效'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">可申报</p>
                    <p className={`text-lg font-medium ${resultV2.validation.isDeclarable ? 'text-green-600' : 'text-amber-600'}`}>
                      {resultV2.validation.isDeclarable ? '✓ 可申报' : '需选择子编码'}
                    </p>
                  </div>
                </div>
              )}

              {/* 面包屑导航 */}
              {resultV2.validation?.breadcrumb && resultV2.validation.breadcrumb.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-4 rounded-lg">
                  <span className="text-sm text-gray-500">层级路径:</span>
                  {resultV2.validation.breadcrumb.map((item, idx) => (
                    <span key={idx} className="flex items-center">
                      {idx > 0 && <span className="text-gray-400 mx-2">→</span>}
                      <button
                        onClick={() => navigate(`/hs/${item.code}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      >
                        {item.descriptionCn || item.description || item.code}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* 精确匹配结果 - 显示税率 */}
              {resultV2.exactMatch && (
                <>
                  {/* 商品描述 */}
                  {resultV2.exactMatch.goodsDescription && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <p className="text-xs text-gray-500 mb-2">商品描述</p>
                      <p className="text-gray-800">{resultV2.exactMatch.goodsDescription}</p>
                      {resultV2.exactMatch.goodsDescriptionCn && (
                        <p className="text-blue-600 mt-2 pt-2 border-t border-blue-200">{resultV2.exactMatch.goodsDescriptionCn}</p>
                      )}
                    </div>
                  )}

                  {/* 税率信息 */}
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                      <p className="text-xs text-gray-500 mb-2">第三国关税</p>
                      <p className="text-2xl font-bold text-green-700">
                        {typeof resultV2.exactMatch.thirdCountryDuty === 'number' ? `${resultV2.exactMatch.thirdCountryDuty}%` : '-'}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                      <p className="text-xs text-gray-500 mb-2">适用关税</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {typeof resultV2.exactMatch.dutyRate === 'number' ? `${resultV2.exactMatch.dutyRate}%` : '-'}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                      <p className="text-xs text-gray-500 mb-2">VAT</p>
                      <p className="text-2xl font-bold text-purple-700">19%</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-100">
                      <p className="text-xs text-gray-500 mb-2">反倾销税</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {typeof resultV2.exactMatch.antiDumpingRate === 'number' ? `${resultV2.exactMatch.antiDumpingRate}%` : '-'}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                      <p className="text-xs text-gray-500 mb-2">反补贴税</p>
                      <p className="text-2xl font-bold text-red-700">
                        {typeof resultV2.exactMatch.countervailingRate === 'number' ? `${resultV2.exactMatch.countervailingRate}%` : '-'}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* 层级树 - 分类编码情况下显示子编码选择 */}
              {resultV2.matchStatus === 'parent_node' && resultV2.hierarchy && (
                <div className="border border-blue-200 rounded-lg bg-blue-50/50">
                  <div className="px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                    <span className="font-medium text-blue-800">
                      请选择具体的可申报编码 ({resultV2.hierarchy.totalChildren} 个)
                    </span>
                    <button
                      onClick={() => navigate(`/hs/${hsCode}`)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      查看完整层级树 <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 max-h-80 overflow-auto">
                    {resultV2.hierarchy.childGroups?.slice(0, 5).map((group, gIdx) => (
                      <div key={gIdx} className="mb-4 last:mb-0">
                        <p className="text-sm text-gray-600 font-medium mb-2">{group.groupTitleCn || group.groupTitle}</p>
                        <div className="space-y-2">
                          {group.children.slice(0, 8).map((child) => (
                            <button
                              key={child.code}
                              onClick={() => {
                                setHsCode(child.code)
                                handleLookupWithCode(child.code, originCountry)
                              }}
                              className="w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono text-blue-600 font-medium">{child.code}</span>
                                <span className="text-gray-600 ml-3">{child.descriptionCn || child.description}</span>
                              </div>
                              {child.thirdCountryDuty && (
                                <span className="text-green-600 font-medium">{child.thirdCountryDuty}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 候选编码 - 编码不存在时显示建议 */}
              {resultV2.matchStatus === 'not_found' && resultV2.candidates && resultV2.candidates.length > 0 && (
                <div className="border border-amber-200 rounded-lg bg-amber-50/50">
                  <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between">
                    <span className="font-medium text-amber-800">
                      推荐的可申报编码 ({resultV2.candidates.length} 个)
                    </span>
                    <button
                      onClick={() => navigate(`/hs/search?q=${hsCode.substring(0, 6)}`)}
                      className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1"
                    >
                      搜索更多 <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 max-h-64 overflow-auto space-y-2">
                    {resultV2.candidates.slice(0, 10).map((candidate) => (
                      <button
                        key={candidate.code}
                        onClick={() => {
                          setHsCode(candidate.code)
                          handleLookupWithCode(candidate.code, originCountry)
                        }}
                        className="w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-amber-600 font-medium">{candidate.code}</span>
                          <span className="text-gray-600 ml-3">{candidate.description}</span>
                        </div>
                        <span className="text-gray-400 text-sm">匹配度: {candidate.matchScore}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 快捷操作 */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => navigate(`/hs/${hsCode}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  查看编码详情页 <ExternalLink className="w-4 h-4" />
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => navigate(`/hs/search?q=${hsCode}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  搜索相关编码 <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 传统查询结果 */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-base font-medium text-gray-900">查询结果</span>
                {'dataSource' in result && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.dataSource?.includes('uk_api') 
                      ? 'bg-red-100 text-red-700' 
                      : result.dataSource === 'xi_api'
                      ? 'bg-blue-100 text-blue-700'
                      : result.dataSource === 'local_database'
                      ? 'bg-gray-100 text-gray-700'
                      : result.dataSource === 'china_anti_dumping_database'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {result.dataSource?.includes('uk_api') ? '🇬🇧 UK API' :
                     result.dataSource === 'xi_api' ? '🇪🇺 EU TARIC' :
                     result.dataSource === 'local_database' ? '📦 本地数据库' :
                     result.dataSource === 'china_anti_dumping_database' ? '🇨🇳 反倾销数据' :
                     '🇪🇺 EU TARIC'}
                  </span>
                )}
                {result.fromCache && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                    来自缓存
                  </span>
                )}
                {result.savedToDb && (
                  <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    result.savedToDb === 'inserted' ? 'bg-green-100 text-green-700' :
                    result.savedToDb === 'updated' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <Check className="w-3 h-3" />
                    {result.savedToDb === 'inserted' ? '已保存到数据库' :
                     result.savedToDb === 'updated' ? '已更新数据库' : '保存失败'}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                查询时间: {formatDateTime(result.queryTime)}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* 编码匹配提示 */}
              {'exactMatch' in result && result.exactMatch === false && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="font-medium text-amber-700">⚠️ 编码匹配提示</p>
                  <p className="mt-2 text-sm text-amber-600">
                    系统未找到精确编码 <code className="bg-amber-100 px-1 rounded">{(result as any).originalHsCode}</code>，
                    已使用最接近的编码 <code className="bg-amber-100 px-1 rounded">{result.hsCode10}</code> 进行查询。
                  </p>
                </div>
              )}

              {/* 基本信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">HS 编码 (8位)</p>
                  <p className="text-lg font-medium text-gray-900">{result.hsCode}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">TARIC 编码 (10位)</p>
                  <p className="text-lg font-medium text-gray-900">{result.hsCode10}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">原产国</p>
                  <p className="text-lg font-medium text-gray-900">
                    {result.originCountryCode || '全部'}
                  </p>
                </div>
              </div>

              {/* 商品描述 */}
              {result.goodsDescription && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-xs text-gray-500 mb-2">商品描述</p>
                  <p className="text-gray-800">{result.goodsDescription}</p>
                  {result.goodsDescriptionCn && (
                    <p className="text-blue-600 mt-2 pt-2 border-t border-blue-200">{result.goodsDescriptionCn}</p>
                  )}
                </div>
              )}

              {/* 税率信息 */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                  <p className="text-xs text-gray-500 mb-2">第三国关税</p>
                  <p className="text-2xl font-bold text-green-700">
                    {typeof result.thirdCountryDuty === 'number' ? `${result.thirdCountryDuty}%` : '-'}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-xs text-gray-500 mb-2">适用关税</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {typeof result.dutyRate === 'number' ? `${result.dutyRate}%` : '-'}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                  <p className="text-xs text-gray-500 mb-2">VAT</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {typeof (result as any).vatRate === 'number' ? `${(result as any).vatRate}%` : '-'}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-100">
                  <p className="text-xs text-gray-500 mb-2">反倾销税</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {typeof result.antiDumpingRate === 'number' ? `${result.antiDumpingRate}%` : 
                     result.hasAntiDumping ? '有' : '-'}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                  <p className="text-xs text-gray-500 mb-2">反补贴税</p>
                  <p className="text-2xl font-bold text-red-700">
                    {typeof result.countervailingRate === 'number' ? `${result.countervailingRate}%` :
                     result.hasCountervailing ? '有' : '-'}
                  </p>
                </div>
              </div>

              {/* 贸易限制标志 */}
              <div className="flex items-center gap-4">
                {result.hasQuota && (
                  <span className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg">
                    <FileWarning className="w-4 h-4" />
                    有配额限制
                  </span>
                )}
                {result.requiresLicense && (
                  <span className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg">
                    <Shield className="w-4 h-4" />
                    需要许可证
                  </span>
                )}
                {result.requiresSPS && (
                  <span className="flex items-center gap-2 px-3 py-2 bg-cyan-100 text-cyan-700 rounded-lg">
                    <Ban className="w-4 h-4" />
                    需要 SPS 检验
                  </span>
                )}
                {result.totalMeasures && result.totalMeasures > 0 && (
                  <span className="text-sm text-gray-500">
                    共 {result.totalMeasures} 项贸易措施
                  </span>
                )}
              </div>

              {/* 措施列表 */}
              {result.measures && result.measures.length > 0 && (
                <div className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="font-medium text-gray-700">贸易措施详情</p>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-auto">
                    {result.measures.slice(0, 15).map((measure, idx) => (
                      <div key={idx} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-700">{measure.type || '措施'}</div>
                            {measure.typeCn && (
                              <div className="text-xs text-gray-500 mt-0.5">{measure.typeCn}</div>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 font-medium shrink-0">
                            {measure.rate !== undefined ? `${measure.rate}%` : '-'}
                          </span>
                        </div>
                        {measure.geographicalArea && (
                          <div className="mt-2 text-xs">
                            <div className="text-gray-500">{measure.geographicalArea}</div>
                            {measure.geographicalAreaCn && (
                              <div className="text-gray-400 mt-0.5">{measure.geographicalAreaCn}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className={`rounded-lg p-6 ${
          dataSource === 'uk' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`font-medium mb-3 ${dataSource === 'uk' ? 'text-red-700' : 'text-blue-700'}`}>💡 使用说明</p>
          <ul className={`space-y-2 text-sm ${dataSource === 'uk' ? 'text-red-600' : 'text-blue-600'}`}>
            <li>• 输入 HS 编码（8-10位）进行实时查询</li>
            <li>• 选择原产国可获取针对特定国家的税率（如反倾销税）</li>
            <li>• 查询结果会缓存24小时，避免重复请求</li>
            <li>• <strong>查询结果会自动保存到本地税率库</strong></li>
            {dataSource === 'uk' ? (
              <>
                <li>• <strong>🇬🇧 UK Trade Tariff</strong>: 免费官方 API，脱欧后英国独立关税数据</li>
                <li>• <strong>北爱尔兰</strong>: 选择"北爱尔兰"地区可查询适用 EU 规则的税率</li>
              </>
            ) : (
              <>
                <li>• <strong>🇪🇺 EU TARIC</strong>: 欧盟官方关税数据（通过网页解析获取）</li>
                <li>• 对于中国原产商品，会自动查询反倾销税</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
