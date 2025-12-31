import { useState, useEffect, useRef } from 'react'
import { 
  Upload, 
  Video, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  HardDrive,
  Film
} from 'lucide-react'
import { helpModules, helpItems, HelpItem, HelpModule } from '../data/helpData'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface VideoRecord {
  id: number
  helpItemId: string
  title: string
  module: string
  videoUrl: string
  videoKey: string
  thumbnailUrl?: string
  duration?: number
  fileSize: number
  description?: string
  createdAt: string
  updatedAt: string
}

interface CosStatus {
  configured: boolean
  bucket: string
  region: string
  supportedFormats: string[]
  maxFileSize: number
  maxFileSizeMB: number
}

export default function HelpVideoManage() {
  // 状态
  const [cosStatus, setCosStatus] = useState<CosStatus | null>(null)
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // 上传表单
  const [selectedHelpItem, setSelectedHelpItem] = useState<HelpItem | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoDescription, setVideoDescription] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载COS状态和视频列表
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 并行加载COS状态和视频列表
      const [statusRes, videosRes] = await Promise.all([
        fetch(`${API_BASE}/api/help-videos/status`).then(r => r.json()),
        fetch(`${API_BASE}/api/help-videos`).then(r => r.json())
      ])
      
      if (statusRes.success) {
        setCosStatus(statusRes.data)
      }
      
      if (videosRes.success) {
        setVideos(videosRes.data)
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 获取当前模块的帮助项（排除已上传视频的）
  const getAvailableHelpItems = () => {
    const uploadedIds = new Set(videos.map(v => v.helpItemId))
    return helpItems.filter(item => {
      // 筛选模块
      if (selectedModule && item.module !== selectedModule) return false
      // 排除已上传的
      if (uploadedIds.has(item.id)) return false
      // 搜索过滤
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        return item.title.toLowerCase().includes(keyword) ||
               item.description.toLowerCase().includes(keyword)
      }
      return true
    })
  }

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 验证文件类型
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
      if (!validTypes.includes(file.type)) {
        setError('不支持的视频格式，请选择 MP4、WebM、MOV 格式')
        return
      }
      
      // 验证文件大小
      if (cosStatus && file.size > cosStatus.maxFileSize) {
        setError(`视频文件过大，最大支持 ${cosStatus.maxFileSizeMB}MB`)
        return
      }
      
      setSelectedFile(file)
      setError(null)
    }
  }

  // 上传视频
  const handleUpload = async () => {
    if (!selectedHelpItem || !selectedFile) {
      setError('请选择帮助项和视频文件')
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('helpItemId', selectedHelpItem.id)
      formData.append('title', selectedHelpItem.title)
      formData.append('module', selectedHelpItem.module)
      formData.append('description', videoDescription || selectedHelpItem.description)
      
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90))
      }, 200)
      
      const response = await fetch(`${API_BASE}/api/help-videos/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      if (data.success) {
        setSuccessMessage(`视频 "${selectedHelpItem.title}" 上传成功！`)
        // 重置表单
        setSelectedHelpItem(null)
        setSelectedFile(null)
        setVideoDescription('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // 刷新列表
        loadData()
      } else {
        throw new Error(data.error || '上传失败')
      }
    } catch (err: any) {
      setError(err.message || '上传视频失败')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // 删除视频
  const handleDelete = async (video: VideoRecord) => {
    if (!confirm(`确定要删除 "${video.title}" 的演示视频吗？`)) {
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/help-videos/${video.helpItemId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setSuccessMessage('视频删除成功')
        loadData()
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message || '删除视频失败')
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // 获取模块颜色
  const getModuleColor = (moduleId: string) => {
    const module = helpModules.find(m => m.id === moduleId)
    return module?.color || 'bg-gray-500'
  }

  // 获取模块名称
  const getModuleName = (moduleId: string) => {
    const module = helpModules.find(m => m.id === moduleId)
    return module?.name || moduleId
  }

  // 过滤视频列表
  const filteredVideos = videos.filter(video => {
    if (selectedModule && video.module !== selectedModule) return false
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      return video.title.toLowerCase().includes(keyword)
    }
    return true
  })

  // 统计信息
  const stats = {
    totalVideos: videos.length,
    totalSize: videos.reduce((sum, v) => sum + (v.fileSize || 0), 0),
    totalHelpItems: helpItems.length,
    coverage: videos.length > 0 ? Math.round((videos.length / helpItems.length) * 100) : 0
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">帮助视频管理</h1>
          <p className="text-gray-500 mt-1">上传和管理系统帮助演示视频</p>
        </div>

        {/* 消息提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700">×</button>
          </div>
        )}

        {/* COS状态检查 */}
        {!cosStatus?.configured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-800">腾讯云 COS 未配置</p>
                <p className="text-sm text-amber-700 mt-1">
                  请在服务器环境变量中配置 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Film className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVideos}</p>
                <p className="text-xs text-gray-500">已上传视频</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.totalSize)}</p>
                <p className="text-xs text-gray-500">存储空间</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalHelpItems}</p>
                <p className="text-xs text-gray-500">帮助项总数</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.coverage}%</p>
                <p className="text-xs text-gray-500">视频覆盖率</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：上传区域 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary-600" />
                上传演示视频
              </h2>

              {/* 选择帮助项 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择帮助项 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedHelpItem?.id || ''}
                  onChange={(e) => {
                    const item = helpItems.find(i => i.id === e.target.value)
                    setSelectedHelpItem(item || null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">请选择...</option>
                  {helpModules.map(module => {
                    const items = getAvailableHelpItems().filter(i => i.module === module.id)
                    if (items.length === 0) return null
                    return (
                      <optgroup key={module.id} label={module.name}>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>

              {/* 显示选中的帮助项信息 */}
              {selectedHelpItem && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{selectedHelpItem.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedHelpItem.description}</p>
                </div>
              )}

              {/* 视频描述 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  视频描述（可选）
                </label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  placeholder="为这个演示视频添加说明..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                />
              </div>

              {/* 文件选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择视频文件 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 transition-colors"
                >
                  {selectedFile ? (
                    <div className="text-center">
                      <Video className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">点击选择视频文件</p>
                      <p className="text-xs mt-1">支持 MP4、WebM、MOV 格式，最大 {cosStatus?.maxFileSizeMB || 500}MB</p>
                    </div>
                  )}
                </button>
              </div>

              {/* 上传进度 */}
              {isUploading && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">上传中...</span>
                    <span className="text-primary-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 上传按钮 */}
              <button
                onClick={handleUpload}
                disabled={!selectedHelpItem || !selectedFile || isUploading || !cosStatus?.configured}
                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    上传视频
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 右侧：视频列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              {/* 筛选栏 */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索视频..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadData()}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">全部模块</option>
                    {helpModules.map(module => (
                      <option key={module.id} value={module.id}>{module.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadData}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="刷新"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* 视频列表 */}
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {filteredVideos.length === 0 ? (
                  <div className="p-12 text-center">
                    <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">暂无视频</p>
                    <p className="text-sm text-gray-400 mt-1">上传演示视频后会显示在这里</p>
                  </div>
                ) : (
                  filteredVideos.map(video => (
                    <div key={video.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* 视频预览 */}
                        <div className="w-32 h-20 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 relative group">
                          {video.videoUrl ? (
                            <>
                              <video
                                src={video.videoUrl}
                                className="w-full h-full object-cover"
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-8 h-8 text-white" fill="white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-gray-600" />
                            </div>
                          )}
                        </div>

                        {/* 视频信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium text-gray-900">{video.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-xs text-white ${getModuleColor(video.module)}`}>
                                  {getModuleName(video.module)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatFileSize(video.fileSize)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(video)}
                              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {video.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{video.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            上传于 {new Date(video.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 录制提示 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">📹 如何录制演示视频？</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>1. 使用屏幕录制软件（推荐：OBS Studio、腾讯会议、Loom）</p>
            <p>2. 录制系统操作过程，分辨率建议 1920×1080</p>
            <p>3. 导出为 MP4 格式，保持较高画质</p>
            <p>4. 在本页面选择对应帮助项并上传视频</p>
            <p>5. 上传后视频会自动关联到帮助中心</p>
          </div>
        </div>
      </div>
    </div>
  )
}

