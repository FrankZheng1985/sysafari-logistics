import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { 
  Search, 
  ChevronRight,
  Play,
  FileText,
  Lightbulb,
  HelpCircle,
  BookOpen,
  LayoutDashboard,
  Package,
  Truck,
  MapPin,
  Users,
  DollarSign,
  Building2,
  FileSignature,
  Wrench,
  Settings,
  CheckCircle2,
  ArrowLeft,
  Video,
  ExternalLink,
  Upload
} from 'lucide-react'
import VideoPlayer, { VideoThumbnail } from '../components/VideoPlayer'
import { 
  helpModules, 
  helpItems, 
  getHelpByModule, 
  searchHelp, 
  getModuleById,
  HelpItem,
  HelpModule
} from '../data/helpData'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Package,
  Search,
  Truck,
  MapPin,
  Users,
  DollarSign,
  Building2,
  FileText,
  FileSignature,
  Wrench,
  Settings
}

// 获取模块图标
function getModuleIcon(iconName: string) {
  return iconMap[iconName] || HelpCircle
}

export default function HelpCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedModule, setSelectedModule] = useState<string>(searchParams.get('module') || '')
  const [selectedHelp, setSelectedHelp] = useState<HelpItem | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({})

  // 从后端加载视频URL
  useEffect(() => {
    const loadVideoUrls = async () => {
      try {
        const helpItemIds = helpItems.map(item => item.id)
        const apiBase = getApiBaseUrl()
        const response = await fetch(`${apiBase}/api/help-videos/urls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ helpItemIds })
        })
        const data = await response.json()
        if (data.success) {
          setVideoUrls(data.data)
        }
      } catch (err) {
        console.error('加载视频URL失败:', err)
      }
    }
    loadVideoUrls()
  }, [])

  // 获取帮助项的视频URL（优先使用后端数据）
  const getVideoUrl = (helpItem: HelpItem): string | undefined => {
    return videoUrls[helpItem.id] || helpItem.videoUrl
  }

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return []
    return searchHelp(searchKeyword)
  }, [searchKeyword])

  // 当前模块的帮助列表
  const moduleHelpList = useMemo(() => {
    if (selectedModule) {
      return getHelpByModule(selectedModule)
    }
    return []
  }, [selectedModule])

  // 当前选中的模块信息
  const currentModule = useMemo(() => {
    if (selectedModule) {
      return getModuleById(selectedModule)
    }
    return null
  }, [selectedModule])

  // 选择模块
  const handleSelectModule = (moduleId: string) => {
    setSelectedModule(moduleId)
    setSelectedHelp(null)
    setSearchParams({ module: moduleId })
  }

  // 选择帮助项
  const handleSelectHelp = (help: HelpItem) => {
    setSelectedHelp(help)
    setExpandedFaq(null)
  }

  // 返回模块列表
  const handleBackToModules = () => {
    setSelectedModule('')
    setSelectedHelp(null)
    setSearchParams({})
  }

  // 返回帮助列表
  const handleBackToList = () => {
    setSelectedHelp(null)
  }

  // 跳转到对应页面
  const handleGoToPage = (path: string) => {
    navigate(path)
  }

  // 渲染搜索结果
  const renderSearchResults = () => {
    if (!searchKeyword.trim()) return null

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          搜索结果 ({searchResults.length})
        </h3>
        {searchResults.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">未找到相关帮助内容</p>
            <p className="text-sm text-gray-400 mt-1">请尝试其他关键词</p>
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map(help => {
              const module = getModuleById(help.module)
              return (
                <button
                  key={help.id}
                  onClick={() => {
                    setSelectedModule(help.module)
                    setSelectedHelp(help)
                    setSearchKeyword('')
                  }}
                  className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${module?.color || 'bg-gray-500'} flex items-center justify-center flex-shrink-0`}>
                      {(() => {
                        const Icon = getModuleIcon(help.moduleIcon)
                        return <Icon className="w-5 h-5 text-white" />
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 group-hover:text-primary-600">{help.title}</h4>
                        {getVideoUrl(help) && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">有视频</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{module?.name}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{help.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 flex-shrink-0" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // 渲染模块网格
  const renderModuleGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {helpModules.map(module => {
        const Icon = getModuleIcon(module.icon)
        const helpCount = getHelpByModule(module.id).length
        const videoCount = getHelpByModule(module.id).filter(h => getVideoUrl(h)).length
        
        return (
          <button
            key={module.id}
            onClick={() => handleSelectModule(module.id)}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all text-left group"
          >
            <div className={`w-12 h-12 rounded-xl ${module.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">{module.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{module.description}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {helpCount} 篇帮助
              </span>
              {videoCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Video className="w-3.5 h-3.5" />
                  {videoCount} 个视频
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )

  // 渲染模块帮助列表
  const renderModuleHelpList = () => {
    if (!currentModule) return null

    const Icon = getModuleIcon(currentModule.icon)

    return (
      <div>
        {/* 模块头部 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToModules}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className={`w-12 h-12 rounded-xl ${currentModule.color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{currentModule.name}</h2>
            <p className="text-sm text-gray-500">{currentModule.description}</p>
          </div>
        </div>

        {/* 帮助列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {moduleHelpList.map(help => (
            <button
              key={help.id}
              onClick={() => handleSelectHelp(help)}
              className="p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 group-hover:text-primary-600">{help.title}</h4>
                    {getVideoUrl(help) && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        视频
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{help.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 渲染帮助详情
  const renderHelpDetail = () => {
    if (!selectedHelp) return null

    return (
      <div>
        {/* 返回按钮和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{selectedHelp.title}</h2>
            <p className="text-sm text-gray-500">{currentModule?.name}</p>
          </div>
          <button
            onClick={() => handleGoToPage(selectedHelp.path)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            前往页面
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：视频和描述 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 视频播放器 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary-600" />
                  演示视频
                </h3>
              </div>
              <div className="p-4">
                <VideoPlayer 
                  videoUrl={getVideoUrl(selectedHelp)} 
                  title={selectedHelp.title}
                />
              </div>
            </div>

            {/* 功能描述 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-primary-600" />
                功能介绍
              </h3>
              <p className="text-gray-700 leading-relaxed">{selectedHelp.description}</p>
            </div>

            {/* 操作步骤 */}
            {selectedHelp.steps && selectedHelp.steps.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary-600" />
                  操作步骤
                </h3>
                <ol className="space-y-3">
                  {selectedHelp.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* 右侧：提示和FAQ */}
          <div className="space-y-6">
            {/* 使用技巧 */}
            {selectedHelp.tips && selectedHelp.tips.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                  使用技巧
                </h3>
                <ul className="space-y-2">
                  {selectedHelp.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-amber-800">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 常见问题 */}
            {selectedHelp.faq && selectedHelp.faq.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <HelpCircle className="w-5 h-5 text-primary-600" />
                  常见问题
                </h3>
                <div className="space-y-3">
                  {selectedHelp.faq.map((item, index) => (
                    <div key={index} className="border border-gray-100 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900">{item.q}</span>
                        <ChevronRight 
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedFaq === index ? 'rotate-90' : ''}`} 
                        />
                      </button>
                      {expandedFaq === index && (
                        <div className="px-3 pb-3 pt-0">
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{item.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 快速链接 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">快速链接</h3>
              <button
                onClick={() => handleGoToPage(selectedHelp.path)}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3 text-left"
              >
                <div className={`w-8 h-8 rounded-lg ${currentModule?.color || 'bg-gray-500'} flex items-center justify-center`}>
                  {(() => {
                    const Icon = getModuleIcon(selectedHelp.moduleIcon)
                    return <Icon className="w-4 h-4 text-white" />
                  })()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">前往 {selectedHelp.title}</p>
                  <p className="text-xs text-gray-500">{selectedHelp.path}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">帮助中心</h1>
              <p className="text-gray-500 mt-1">查看系统功能介绍和操作指南</p>
            </div>
            <Link
              to="/help/videos"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              管理视频
            </Link>
          </div>

          {/* 搜索框 */}
          <div className="mt-6 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索帮助内容..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 搜索结果 */}
        {renderSearchResults()}

        {/* 主内容区域 */}
        {!searchKeyword.trim() && (
          <>
            {/* 显示帮助详情 */}
            {selectedHelp && renderHelpDetail()}

            {/* 显示模块帮助列表 */}
            {!selectedHelp && selectedModule && renderModuleHelpList()}

            {/* 显示模块网格 */}
            {!selectedHelp && !selectedModule && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">选择功能模块</h2>
                {renderModuleGrid()}

                {/* 快速入门 */}
                <div className="mt-10">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">快速入门</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {helpItems.slice(0, 6).map(help => (
                      <VideoThumbnail
                        key={help.id}
                        videoUrl={getVideoUrl(help)}
                        title={help.title}
                        onClick={() => {
                          setSelectedModule(help.module)
                          setSelectedHelp(help)
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

