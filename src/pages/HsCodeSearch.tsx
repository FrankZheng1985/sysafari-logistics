/**
 * HS 编码搜索页面
 * 左侧章节分类筛选 + 右侧搜索结果列表
 * 参考 HS 编码查询系统界面设计
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, 
  ChevronRight, 
  Loader2,
  Info,
  AlertTriangle,
  Tag,
  ExternalLink,
  FileText
} from 'lucide-react'
import { searchHsCodes, HsCodeSearchResult } from '../utils/api'

export default function HsCodeSearch() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const initialQuery = searchParams.get('q') || ''
  const initialChapter = searchParams.get('chapter') || ''
  
  const [query, setQuery] = useState(initialQuery)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedChapter, setSelectedChapter] = useState(initialChapter)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<HsCodeSearchResult | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // 执行搜索
  const doSearch = useCallback(async (q: string, chapter: string, pageNum: number) => {
    if (!q || q.length < 2) {
      setError('请输入至少2个字符的搜索关键词')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await searchHsCodes(q, {
        chapter: chapter || undefined,
        page: pageNum,
        pageSize
      })
      
      if (response.errCode === 200 && response.data) {
        setData(response.data)
      } else {
        setError(response.msg || '搜索失败')
      }
    } catch (err: any) {
      setError(err.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载和参数变化时搜索
  useEffect(() => {
    if (searchQuery) {
      doSearch(searchQuery, selectedChapter, page)
    }
  }, [searchQuery, selectedChapter, page, doSearch])

  // 处理搜索提交
  const handleSearch = () => {
    setSearchQuery(query)
    setSelectedChapter('')
    setPage(1)
    // 更新 URL 参数
    setSearchParams({ q: query })
  }

  // 处理章节筛选
  const handleChapterFilter = (chapter: string) => {
    setSelectedChapter(chapter === selectedChapter ? '' : chapter)
    setPage(1)
    // 更新 URL 参数
    const params: Record<string, string> = { q: searchQuery }
    if (chapter && chapter !== selectedChapter) {
      params.chapter = chapter
    }
    setSearchParams(params)
  }

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  // 构建当前页面 URL 作为返回地址
  const buildFromUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedChapter) params.set('chapter', selectedChapter)
    return `/hs/search${params.toString() ? `?${params.toString()}` : ''}`
  }, [searchQuery, selectedChapter])

  // 跳转到详情页
  const goToDetail = (hsCode: string) => {
    const params = new URLSearchParams()
    params.set('from', buildFromUrl())
    navigate(`/hs/${hsCode}?${params.toString()}`)
  }

  // 格式化章节显示
  const formatChapterName = (chapter: string, description: string | null) => {
    const chapterNum = parseInt(chapter, 10)
    return `第${chapterNum}章`
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 搜索框区域 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <span className="text-lg font-bold text-primary-600">HS编码查询</span>
          </div>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入商品名称或HS编码进行搜索"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              查询
            </button>
          </div>
        </div>
        
        {/* 搜索提示 */}
        <div className="mt-3 text-sm text-gray-500">
          <span className="text-gray-400">提示：</span>
          可以输入商品中文/英文名称、HS编码（4-10位）进行搜索
        </div>
      </div>

      {/* 面包屑导航 */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <button onClick={() => navigate('/')} className="hover:text-primary-600">首页</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900">搜索: {searchQuery}</span>
          {selectedChapter && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900">第{parseInt(selectedChapter, 10)}章</span>
            </>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* 主内容区域 */}
      {searchQuery && (
        <div className="flex gap-6">
          {/* 左侧：章节分类筛选 */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                分类筛选
              </h3>
              
              {loading && !data && (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin mx-auto" />
                </div>
              )}
              
              {data?.chapterStats && data.chapterStats.length > 0 ? (
                <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {/* 全部选项 */}
                  <button
                    onClick={() => handleChapterFilter('')}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                      !selectedChapter 
                        ? 'bg-primary-100 text-primary-700 font-medium' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">
                      全部 ({data.total})
                    </div>
                  </button>
                  
                  {data.chapterStats.map((chapter) => (
                    <button
                      key={chapter.chapter}
                      onClick={() => handleChapterFilter(chapter.chapter)}
                      className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                        selectedChapter === chapter.chapter 
                          ? 'bg-primary-100 text-primary-700' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium text-primary-600">
                        {formatChapterName(chapter.chapter, chapter.description)} ({chapter.count})
                      </div>
                      {chapter.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5" title={chapter.description}>
                          {chapter.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : !loading && (
                <div className="text-sm text-gray-500 text-center py-4">
                  暂无分类数据
                </div>
              )}
            </div>
          </div>

          {/* 右侧：搜索结果列表 */}
          <div className="flex-1">
            {/* 结果统计 */}
            {data && (
              <div className="mb-4 text-sm text-gray-600">
                共找到 <span className="font-medium text-gray-900">{data.total}</span> 个结果
                {selectedChapter && (
                  <span>，当前筛选：第{parseInt(selectedChapter, 10)}章</span>
                )}
              </div>
            )}

            {/* 加载中 */}
            {loading && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
                <p className="mt-3 text-gray-500">搜索中...</p>
              </div>
            )}

            {/* 搜索结果 */}
            {!loading && data?.results && data.results.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {data.results.map((item, index) => (
                  <div 
                    key={`${item.hsCode}-${index}`}
                    className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors ${
                      index > 0 ? 'border-t' : ''
                    }`}
                    onClick={() => goToDetail(item.hsCode)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* 编码 */}
                        <div className="font-mono text-lg font-medium text-gray-900">
                          {item.hsCode}
                          {item.declarable && (
                            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-normal">
                              可申报
                            </span>
                          )}
                        </div>
                        
                        {/* 描述 */}
                        <div className="text-gray-700 mt-1">
                          {item.descriptionCn || item.description}
                        </div>
                        {item.description && item.descriptionCn && item.description !== item.descriptionCn && (
                          <div className="text-sm text-gray-400 mt-0.5 italic">
                            {item.description}
                          </div>
                        )}
                        
                        {/* 快捷链接 */}
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              goToDetail(item.hsCode)
                            }}
                            className="text-primary-600 hover:text-primary-800 flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            详情
                          </button>
                          <span className="text-gray-300">|</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              goToDetail(item.hsCode)
                            }}
                            className="text-primary-600 hover:text-primary-800 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            层级树
                          </button>
                        </div>
                        
                        {/* 关键词标签 */}
                        {item.keywords && item.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.keywords.map((kw) => (
                              <span 
                                key={kw}
                                className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 税率（如果有） */}
                      {item.dutyRate !== null && item.dutyRate !== undefined && (
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-sm text-gray-500">第三国关税</div>
                          <div className={`text-lg font-medium ${item.dutyRate > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {item.dutyRate}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 无结果 */}
            {!loading && data?.results && data.results.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Info className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">未找到相关结果</h3>
                <p className="text-gray-500">
                  请尝试使用其他关键词搜索，或检查输入是否正确
                </p>
              </div>
            )}

            {/* 分页 */}
            {data && data.total > pageSize && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="px-4 py-2 text-gray-600">
                  第 {page} 页 / 共 {Math.ceil(data.total / pageSize)} 页
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!data.hasMore}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 未搜索时的默认提示 */}
      {!searchQuery && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-600 mb-2">开始搜索</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            在上方搜索框输入商品名称或 HS 编码，快速查找相关的关税编码和税率信息
          </p>
          
          {/* 热门搜索 */}
          <div className="mt-8">
            <div className="text-sm text-gray-500 mb-3">热门搜索</div>
            <div className="flex flex-wrap justify-center gap-2">
              {['家具', '电子产品', '服装', '机械', '塑料制品', '钢铁'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term)
                    setSearchQuery(term)
                    setSearchParams({ q: term })
                  }}
                  className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-primary-100 hover:text-primary-600 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
