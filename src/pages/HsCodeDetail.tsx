/**
 * HS 编码详情页面
 * 显示编码层级面包屑、分组子编码表格
 * 参考北爱尔兰在线关税系统界面设计
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Search,
  Info,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import { getHsCodeHierarchy, HsCodeHierarchy } from '../utils/api'

export default function HsCodeDetail() {
  const { hsCode } = useParams<{ hsCode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 原产国参数，默认为中国（CN），因为大部分查询是中国进口商品
  const originCountry = searchParams.get('originCountry') || 'CN'
  // 获取来源页面，用于返回按钮
  const fromPage = searchParams.get('from') || ''
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<HsCodeHierarchy | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [searchCode, setSearchCode] = useState(hsCode || '')
  
  // 数据源选择（EU TARIC / UK）
  const [dataSource, setDataSource] = useState<'eu' | 'uk'>('eu')
  
  // 返回上一页 - 使用明确的路径导航避免 DOM 冲突
  const handleGoBack = useCallback(() => {
    // 优先使用 from 参数指定的来源页面
    if (fromPage) {
      navigate(fromPage)
    } else if (originCountry) {
      // 如果有原产国参数，返回到税率查询页面
      navigate(`/system/tariff-lookup?code=${hsCode}&country=${originCountry}`)
    } else {
      // 默认返回 HS Code 数据库页面
      navigate('/system/tariff-rates')
    }
  }, [navigate, fromPage, originCountry, hsCode])

  // 加载数据
  useEffect(() => {
    if (!hsCode) return
    
    async function loadData() {
      setLoading(true)
      setError(null)
      
      try {
        const response = await getHsCodeHierarchy(hsCode, originCountry)
        if (response.errCode === 200 && response.data) {
          setData(response.data)
          // 默认展开所有分组
          const allGroups = new Set(response.data.childGroups?.map(g => g.groupCode) || [])
          setExpandedGroups(allGroups)
        } else {
          setError(response.msg || '获取编码信息失败')
        }
      } catch (err: any) {
        setError(err.message || '请求失败')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [hsCode, originCountry])

  // 切换分组展开/折叠
  const toggleGroup = (groupCode: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupCode)) {
        newSet.delete(groupCode)
      } else {
        newSet.add(groupCode)
      }
      return newSet
    })
  }

  // 展开/折叠所有分组
  const expandAll = () => {
    const allGroups = new Set(data?.childGroups?.map(g => g.groupCode) || [])
    setExpandedGroups(allGroups)
  }

  const collapseAll = () => {
    setExpandedGroups(new Set())
  }

  // 复制编码
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // 构建导航 URL 参数
  const buildNavParams = (targetCode: string) => {
    const params = new URLSearchParams()
    if (originCountry) params.set('originCountry', originCountry)
    // 记录当前页面作为来源，支持返回
    params.set('from', `/hs/${hsCode}${originCountry ? `?originCountry=${originCountry}` : ''}`)
    return params.toString() ? `?${params.toString()}` : ''
  }

  // 处理搜索
  const handleSearch = () => {
    if (searchCode && searchCode !== hsCode) {
      navigate(`/hs/${searchCode}${buildNavParams(searchCode)}`)
    }
  }

  // 格式化编码显示（不同部分用不同颜色，添加空格分隔）
  const formatCodeDisplay = (code: string, withSpaces = false) => {
    if (!code || code.length < 4) return <span className="font-mono">{code}</span>
    
    // 移除末尾的0以获取有效长度
    const effectiveCode = code.replace(/0+$/, '')
    
    if (withSpaces) {
      // 带空格的格式化显示：9401 69 00 00
      const parts = []
      if (code.length >= 4) parts.push(code.substring(0, 4))
      if (code.length >= 6) parts.push(code.substring(4, 6))
      if (code.length >= 8) parts.push(code.substring(6, 8))
      if (code.length >= 10) parts.push(code.substring(8, 10))
      return <span className="font-mono">{parts.join(' ')}</span>
    }
    
    return (
      <span className="font-mono">
        <span className="text-gray-600">{code.substring(0, 4)}</span>
        <span className="text-primary-600 font-semibold">{code.substring(4, 6)}</span>
        <span className="text-primary-500">{code.substring(6, 8)}</span>
        <span className="text-gray-400">{code.substring(8)}</span>
      </span>
    )
  }

  // 获取层级名称
  const getLevelName = (level: string) => {
    const levelMap: Record<string, string> = {
      'section': '类',
      'chapter': '章',
      'heading': '品目',
      'subheading': '子目',
      'cn': 'CN编码',
      'taric': 'TARIC编码'
    }
    return levelMap[level] || level
  }

  // 翻译补充单位
  const translateUnit = (unit: string) => {
    const unitMap: Record<string, string> = {
      'Number of items': '件',
      'Number of pairs': '双',
      'Kilogram': '千克',
      'Litre': '升',
      'Square metre': '平方米',
      'Cubic metre': '立方米',
      'Metre': '米',
      'Piece': '件',
      'Gram': '克',
      '100 items': '百件',
      '1000 items': '千件',
      '1000 litres': '千升',
      'Terajoule': '太焦耳'
    }
    return unitMap[unit] || unit
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 顶部导航和搜索 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          
          {/* 快速搜索框 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入 HS 编码查询"
              className="w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
          </div>
        </div>
        
        {/* 数据源切换 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">数据源:</span>
          <button
            onClick={() => setDataSource('eu')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              dataSource === 'eu' 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            EU TARIC
          </button>
          <button
            onClick={() => setDataSource('uk')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              dataSource === 'uk' 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            UK Trade Tariff
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">加载失败</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            重试
          </button>
        </div>
      )}

      {/* 主要内容 */}
      {data && !loading && (
        <>
          {/* 标题区域 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <h1 className="text-xl font-bold text-gray-900 mb-4">
              {getLevelName(data.level || '')} {formatCodeDisplay(data.code, true)} - {data.descriptionCn || data.description}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">编码:</span>
                <span className="ml-2 font-mono font-medium">{formatCodeDisplay(data.code, true)}</span>
              </div>
              <div>
                <span className="text-gray-500">层级:</span>
                <span className="ml-2">
                  {getLevelName(data.level || '')} ({data.level})
                </span>
              </div>
              <div>
                <span className="text-gray-500">贸易日期:</span>
                <span className="ml-2">{new Date().toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            {data.description && data.descriptionCn && data.description !== data.descriptionCn && (
              <div className="mt-3 text-sm text-gray-500 italic">
                {data.description}
              </div>
            )}
            {/* Section 信息 */}
            {data.section && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                <span className="text-gray-500">所属分类:</span>
                <span className="ml-2 text-primary-600">
                  第{data.section.number}类 - {data.section.titleCn || data.section.title}
                </span>
              </div>
            )}
          </div>

          {/* 可申报状态提示 */}
          {data.isDeclarable && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">该编码是可申报编码</p>
                <p className="mt-1">
                  编码 <span className="font-mono font-medium">{formatCodeDisplay(data.code, true)}</span> 是最细分级别的编码，可以直接用于报关申报。
                </p>
              </div>
            </div>
          )}

          {/* 子编码提示信息 */}
          {!data.isDeclarable && data.totalChildren > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">该编码不能直接用于报关申报</p>
                <p className="mt-1">
                  该类别共有 <strong>{data.totalChildren} 个商品编码</strong>
                  {data.declarableCount > 0 && (
                    <>，其中 <strong>{data.declarableCount} 个可申报编码</strong></>
                  )}
                  。请选择最符合您商品的具体编码。
                </p>
              </div>
            </div>
          )}

          {/* 层级面包屑 - 垂直树形结构 */}
          {data.breadcrumb && data.breadcrumb.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="text-sm mb-3 text-gray-500">层级路径:</div>
              <div className="space-y-1">
                {data.breadcrumb.map((item, index) => {
                  const isSection = item.level === 'section'
                  const isLast = index === data.breadcrumb.length - 1
                  // 检查是否是当前页面的编码（即使不是最后一个也应该禁用）
                  const currentFullCode = hsCode?.padEnd(10, '0') || ''
                  const isSameAsCurrentPage = item.code === currentFullCode || item.code === hsCode
                  const isDisabled = isLast || isSameAsCurrentPage
                  // 计算缩进：每级增加 24px
                  const indentLevel = index
                  
                  return (
                    <div 
                      key={`${item.code}-${index}`} 
                      className="flex items-center"
                      style={{ paddingLeft: `${indentLevel * 24}px` }}
                    >
                      {/* 树形连接线 */}
                      {index > 0 && (
                        <div className="flex items-center mr-2">
                          <div className="w-4 h-px bg-gray-300"></div>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                      
                      {/* 层级内容 */}
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md ${
                        isLast 
                          ? 'bg-primary-50 border border-primary-200' 
                          : isSameAsCurrentPage
                            ? 'bg-gray-100 border border-gray-200'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}>
                        {/* 层级标签 */}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          isSection ? 'bg-purple-100 text-purple-700' :
                          item.level === 'chapter' ? 'bg-blue-100 text-blue-700' :
                          item.level === 'heading' ? 'bg-green-100 text-green-700' :
                          item.level === 'subheading' ? 'bg-amber-100 text-amber-700' :
                          'bg-primary-100 text-primary-700'
                        }`}>
                          {getLevelName(item.level)}
                        </span>
                        
                        {/* 可点击的描述 */}
                        {isSection ? (
                          <span className="text-sm text-gray-700">
                            {item.descriptionCn || item.description}
                          </span>
                        ) : isDisabled ? (
                          <span className={`text-sm text-left ${isLast ? 'text-primary-700 font-medium' : 'text-gray-500'}`}>
                            {item.descriptionCn || item.description || item.code}
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate(`/hs/${item.code}${buildNavParams(item.code)}`)}
                            className="text-sm text-left text-gray-700 hover:text-primary-600 hover:underline"
                          >
                            {item.descriptionCn || item.description || item.code}
                          </button>
                        )}
                        
                        {/* 编码 */}
                        {!isSection && (
                          <span className="text-xs text-gray-400 font-mono ml-1">
                            ({item.code.length > 6 ? formatCodeDisplay(item.code, true) : item.code})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 子编码分组表格 */}
          {data.childGroups && data.childGroups.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* 表格头部操作 */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900">子编码列表</h3>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    展开全部
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    折叠全部
                  </button>
                </div>
              </div>

              {/* 分组内容 */}
              {data.childGroups.map((group) => (
                <div key={group.groupCode} className="border-b last:border-b-0">
                  {/* 分组标题 */}
                  <button
                    onClick={() => toggleGroup(group.groupCode)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups.has(group.groupCode) ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <span className="font-medium text-gray-900">
                        {group.groupTitleCn || group.groupTitle}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({group.children.length} 个编码)
                      </span>
                    </div>
                    <span className="text-sm text-gray-400 font-mono">{group.groupCode}</span>
                  </button>

                  {/* 子编码表格 */}
                  {expandedGroups.has(group.groupCode) && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-y">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">描述</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 w-24">增值税</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 w-32">第三国关税</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 w-24">补充单位</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-600 w-36">商品代码</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600 w-20">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.children.map((child, idx) => (
                            <tr 
                              key={child.code}
                              className={`border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                              }`}
                              onClick={() => navigate(`/hs/${child.code}${buildNavParams(child.code)}`)}
                            >
                              <td className="px-4 py-3">
                                <div className="text-gray-900">
                                  {child.descriptionCn || child.description}
                                </div>
                                {child.description && child.descriptionCn && child.description !== child.descriptionCn && (
                                  <div className="text-xs text-gray-400 mt-1 italic">
                                    {child.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">
                                {child.vatRate != null ? `${child.vatRate}%` : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={child.thirdCountryDuty && child.thirdCountryDuty !== '0%' && child.thirdCountryDuty !== '0.00%' ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                                  {child.thirdCountryDuty || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">
                                {child.supplementaryUnit ? (
                                  typeof child.supplementaryUnit === 'object' 
                                    ? `${child.supplementaryUnit.code} (${translateUnit(child.supplementaryUnit.description)})`
                                    : child.supplementaryUnit
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCodeDisplay(child.code)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyCode(child.code)
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title="复制编码"
                                >
                                  {copiedCode === child.code ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 简单子编码列表（非分组） */}
          {data.children && data.children.length > 0 && !data.childGroups?.length && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900">子编码列表</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">编码</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">描述</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-600">层级</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.children.map((child, idx) => (
                    <tr 
                      key={child.code}
                      className={`border-b last:border-b-0 hover:bg-blue-50 cursor-pointer ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                      onClick={() => navigate(`/hs/${child.code}${buildNavParams(child.code)}`)}
                    >
                      <td className="px-4 py-3 font-mono">{child.code}</td>
                      <td className="px-4 py-3 text-gray-900">{child.description}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {child.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {child.hasChildren && (
                          <ExternalLink className="w-4 h-4 text-gray-400 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 无子编码提示 - 只有在不可申报且无子编码时显示 */}
          {!data.isDeclarable && !data.childGroups?.length && !data.children?.length && (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Info className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">暂无子编码数据</h3>
              <p className="text-gray-500">
                未能获取编码 <span className="font-mono font-medium">{data.code}</span> 的子编码列表，请稍后重试。
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
