import { useState, useRef, useEffect } from 'react'
import { Play, Pause, ExternalLink, Video, AlertCircle, Maximize2, Volume2, VolumeX, RotateCcw } from 'lucide-react'

interface VideoPlayerProps {
  videoUrl?: string
  title?: string
  className?: string
  aspectRatio?: '16/9' | '4/3'
  autoPlay?: boolean
}

// 视频类型
type VideoType = 'youtube' | 'bilibili' | 'direct' | 'other' | 'invalid'

// 解析视频URL
function parseVideoUrl(url: string): { type: VideoType; embedUrl: string } {
  if (!url) {
    return { type: 'invalid', embedUrl: '' }
  }

  // 检测是否为直接视频文件链接（MP4, WebM, MOV等）
  const directVideoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogg']
  const lowerUrl = url.toLowerCase()
  const isDirectVideo = directVideoExtensions.some(ext => 
    lowerUrl.includes(ext) || lowerUrl.includes('cos.')  // COS链接
  )
  if (isDirectVideo) {
    return { type: 'direct', embedUrl: url }
  }

  // YouTube 支持多种格式
  const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const youtubeMatch = url.match(youtubeRegex)
  if (youtubeMatch) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1`
    }
  }

  // Bilibili 支持格式
  const bilibiliRegex = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/
  const bilibiliMatch = url.match(bilibiliRegex)
  if (bilibiliMatch) {
    return {
      type: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${bilibiliMatch[1]}&high_quality=1&danmaku=0`
    }
  }

  // Bilibili 播放器直链
  const bilibiliPlayerRegex = /player\.bilibili\.com\/player\.html\?bvid=(BV[a-zA-Z0-9]+)/
  const bilibiliPlayerMatch = url.match(bilibiliPlayerRegex)
  if (bilibiliPlayerMatch) {
    return {
      type: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${bilibiliPlayerMatch[1]}&high_quality=1&danmaku=0`
    }
  }

  // 其他直接嵌入的URL
  if (url.includes('embed') || url.includes('player')) {
    return { type: 'other', embedUrl: url }
  }

  return { type: 'other', embedUrl: url }
}

// 格式化时间
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function VideoPlayer({ 
  videoUrl, 
  title = '演示视频',
  className = '',
  aspectRatio = '16/9',
  autoPlay = false
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // 自动隐藏控制条
  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying, showControls])

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  // 如果没有视频URL，显示占位符
  if (!videoUrl) {
    return (
      <div 
        className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <Video className="w-16 h-16 mb-3 opacity-50" />
          <p className="text-sm font-medium">演示视频待添加</p>
          <p className="text-xs mt-1 text-gray-400">录制完成后将在此处显示</p>
        </div>
      </div>
    )
  }

  const { type, embedUrl } = parseVideoUrl(videoUrl)

  // 无效的视频URL
  if (type === 'invalid' || !embedUrl) {
    return (
      <div 
        className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}
        style={{ aspectRatio }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <AlertCircle className="w-12 h-12 mb-2 text-amber-500" />
          <p className="text-sm">视频链接无效</p>
        </div>
      </div>
    )
  }

  // 直接视频文件播放器（使用HTML5 video标签）
  if (type === 'direct') {
    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause()
        } else {
          videoRef.current.play()
        }
      }
    }

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime)
      }
    }

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration)
      }
      setIsLoading(false)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      if (videoRef.current) {
        videoRef.current.currentTime = time
        setCurrentTime(time)
      }
    }

    const handleFullscreen = () => {
      if (videoRef.current) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen()
        }
      }
    }

    const handleRestart = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play()
      }
    }

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted
        setIsMuted(!isMuted)
      }
    }

    return (
      <div 
        className={`relative bg-black rounded-lg overflow-hidden shadow-lg ${className}`}
        style={{ aspectRatio }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-gray-400">加载视频中...</p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
            <AlertCircle className="w-12 h-12 mb-2 text-red-500" />
            <p className="text-sm text-gray-300">视频加载失败</p>
            <a 
              href={videoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
            >
              <ExternalLink className="w-4 h-4" />
              在新窗口打开
            </a>
          </div>
        )}

        {/* HTML5 视频播放器 */}
        <video
          ref={videoRef}
          src={embedUrl}
          className="absolute inset-0 w-full h-full object-contain"
          autoPlay={autoPlay}
          onClick={handlePlayPause}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
          onEnded={() => setIsPlaying(false)}
        />

        {/* 中央播放按钮（暂停时显示） */}
        {!isPlaying && !isLoading && !hasError && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-transform hover:scale-110">
              <Play className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" />
            </div>
          </button>
        )}

        {/* 自定义控制条 */}
        {!isLoading && !hasError && (
          <div className={`
            absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent
            transition-opacity duration-300 z-30
            ${showControls ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* 进度条 */}
            <div className="mb-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="p-1 text-white hover:text-primary-400 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleRestart}
                  className="p-1 text-white hover:text-primary-400 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleMute}
                  className="p-1 text-white hover:text-primary-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <span className="text-xs text-white/80">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFullscreen}
                  className="p-1 text-white hover:text-primary-400 transition-colors"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COS视频标识 */}
        <div className="absolute top-2 right-2 z-20">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-600 text-white">
            高清视频
          </span>
        </div>
      </div>
    )
  }

  // iframe 嵌入式播放器（YouTube、Bilibili等）
  return (
    <div 
      className={`relative bg-black rounded-lg overflow-hidden shadow-lg ${className}`}
      style={{ aspectRatio }}
    >
      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-gray-400">加载视频中...</p>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <AlertCircle className="w-12 h-12 mb-2 text-red-500" />
          <p className="text-sm text-gray-300">视频加载失败</p>
          <a 
            href={videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
          >
            <ExternalLink className="w-4 h-4" />
            在新窗口打开
          </a>
        </div>
      )}

      {/* 视频播放器 */}
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
      />

      {/* 视频平台标识 */}
      {type !== 'other' && (
        <div className="absolute top-2 right-2 z-20">
          <span className={`
            px-2 py-0.5 rounded text-xs font-medium
            ${type === 'youtube' ? 'bg-red-600 text-white' : ''}
            ${type === 'bilibili' ? 'bg-pink-500 text-white' : ''}
          `}>
            {type === 'youtube' ? 'YouTube' : 'Bilibili'}
          </span>
        </div>
      )}
    </div>
  )
}

// 视频缩略图组件（用于列表展示）
interface VideoThumbnailProps {
  videoUrl?: string
  title: string
  onClick?: () => void
  className?: string
}

export function VideoThumbnail({ videoUrl, title, onClick, className = '' }: VideoThumbnailProps) {
  const hasVideo = !!videoUrl
  const { type } = videoUrl ? parseVideoUrl(videoUrl) : { type: 'invalid' }
  const isDirectVideo = type === 'direct'

  return (
    <button
      onClick={onClick}
      className={`
        relative group rounded-lg overflow-hidden bg-gray-100 
        hover:ring-2 hover:ring-primary-500 transition-all
        ${className}
      `}
      style={{ aspectRatio: '16/9' }}
    >
      {hasVideo ? (
        <>
          {/* 视频预览 */}
          {isDirectVideo ? (
            <video
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              preload="metadata"
              muted
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
          )}
          
          {/* 播放按钮 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg transition-all group-hover:scale-110">
              <Play className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" />
            </div>
          </div>

          {/* 标题 */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-sm text-white font-medium truncate">{title}</p>
          </div>

          {/* 平台标识 */}
          {type !== 'other' && type !== 'direct' && (
            <div className="absolute top-2 right-2">
              <span className={`
                px-1.5 py-0.5 rounded text-xs font-medium
                ${type === 'youtube' ? 'bg-red-600 text-white' : ''}
                ${type === 'bilibili' ? 'bg-pink-500 text-white' : ''}
              `}>
                {type === 'youtube' ? 'YT' : 'B站'}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <Video className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-xs">待添加视频</p>
        </div>
      )}
    </button>
  )
}
