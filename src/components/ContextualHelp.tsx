import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  HelpCircle, 
  X, 
  Play, 
  FileText, 
  Lightbulb, 
  ChevronRight,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react'
import VideoPlayer from './VideoPlayer'
import { getHelpByPath, HelpItem } from '../data/helpData'

interface ContextualHelpProps {
  className?: string
}

// localStorage key
const HELP_BUTTON_HIDDEN_KEY = 'help-button-hidden'

export default function ContextualHelp({ className = '' }: ContextualHelpProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [currentHelp, setCurrentHelp] = useState<HelpItem | null>(null)
  const [activeTab, setActiveTab] = useState<'video' | 'steps' | 'tips'>('video')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [isHidden, setIsHidden] = useState(() => {
    // 从 localStorage 读取隐藏状态
    const stored = localStorage.getItem(HELP_BUTTON_HIDDEN_KEY)
    return stored === 'true'
  })

  // 隐藏/显示按钮的处理函数
  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsHidden(true)
    localStorage.setItem(HELP_BUTTON_HIDDEN_KEY, 'true')
  }

  const handleShow = () => {
    setIsHidden(false)
    localStorage.setItem(HELP_BUTTON_HIDDEN_KEY, 'false')
  }

  // 当路由变化时，更新当前帮助内容
  useEffect(() => {
    const help = getHelpByPath(location.pathname)
    setCurrentHelp(help || null)
    // 切换页面时关闭帮助面板
    setIsOpen(false)
    setActiveTab('video')
    setExpandedFaq(null)
  }, [location.pathname])

  // 打开帮助中心
  const handleOpenHelpCenter = () => {
    setIsOpen(false)
    if (currentHelp) {
      navigate(`/help?module=${currentHelp.module}`)
    } else {
      navigate('/help')
    }
  }

  // 如果没有当前页面的帮助内容，显示简化的帮助按钮
  if (!currentHelp) {
    return (
      <>
        {/* 隐藏状态下的边缘触发器 */}
        {isHidden && (
          <button
            onClick={handleShow}
            className={`
              fixed bottom-6 right-0 z-50
              w-6 h-12 rounded-l-lg
              bg-primary-600 hover:bg-primary-700 hover:w-8
              text-white shadow-lg
              flex items-center justify-center
              transition-all duration-200
              ${className}
            `}
            title="显示帮助按钮"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        
        {/* 帮助按钮 */}
        {!isHidden && (
          <div className="fixed bottom-6 right-6 z-50 group">
            <button
              onClick={handleOpenHelpCenter}
              className={`
                w-14 h-14 rounded-full
                bg-primary-600 hover:bg-primary-700
                text-white shadow-lg hover:shadow-xl
                flex items-center justify-center
                transition-all duration-200
                ${className}
              `}
              title="帮助中心"
            >
              <HelpCircle className="w-6 h-6" />
            </button>
            {/* 隐藏按钮 */}
            <button
              onClick={handleHide}
              className="
                absolute -top-1 -right-1
                w-5 h-5 rounded-full
                bg-gray-500 hover:bg-gray-600
                text-white shadow
                flex items-center justify-center
                opacity-0 group-hover:opacity-100
                transition-all duration-200
                transform scale-75 group-hover:scale-100
              "
              title="隐藏帮助按钮"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* 隐藏状态下的边缘触发器 */}
      {isHidden && !isOpen && (
        <button
          onClick={handleShow}
          className={`
            fixed bottom-6 right-0 z-50
            w-6 h-12 rounded-l-lg
            bg-primary-600 hover:bg-primary-700 hover:w-8
            text-white shadow-lg
            flex items-center justify-center
            transition-all duration-200
            ${className}
          `}
          title="显示帮助按钮"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* 帮助按钮 */}
      {!isHidden && (
        <div className={`fixed bottom-6 right-6 z-50 group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} transition-all duration-200`}>
          <button
            onClick={() => setIsOpen(true)}
            className={`
              w-14 h-14 rounded-full
              bg-primary-600 hover:bg-primary-700
              text-white shadow-lg hover:shadow-xl
              flex items-center justify-center
              transition-all duration-200
              ${className}
            `}
            title={`${currentHelp.title} - 帮助`}
          >
            <HelpCircle className="w-6 h-6" />
            {/* 提示点 - 如果有视频则显示 */}
            {currentHelp.videoUrl && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <Play className="w-2 h-2 text-white" fill="white" />
              </span>
            )}
          </button>
          {/* 隐藏按钮 */}
          <button
            onClick={handleHide}
            className="
              absolute -top-1 -right-1
              w-5 h-5 rounded-full
              bg-gray-500 hover:bg-gray-600
              text-white shadow
              flex items-center justify-center
              opacity-0 group-hover:opacity-100
              transition-all duration-200
              transform scale-75 group-hover:scale-100
            "
            title="隐藏帮助按钮"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 帮助面板遮罩 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 帮助抽屉面板 */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full max-w-md
          bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* 面板头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="text-white">
            <h2 className="font-semibold text-lg">{currentHelp.title}</h2>
            <p className="text-sm text-primary-100">页面帮助</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('video')}
            className={`
              flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'video' 
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
            `}
          >
            <Play className="w-4 h-4" />
            视频教程
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`
              flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'steps' 
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
            `}
          >
            <FileText className="w-4 h-4" />
            操作步骤
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`
              flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'tips' 
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
            `}
          >
            <Lightbulb className="w-4 h-4" />
            技巧 & FAQ
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {/* 视频标签页 */}
          {activeTab === 'video' && (
            <div className="p-4 space-y-4">
              {/* 视频播放器 */}
              <VideoPlayer 
                videoUrl={currentHelp.videoUrl}
                title={currentHelp.title}
              />
              
              {/* 功能描述 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                  功能介绍
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {currentHelp.description}
                </p>
              </div>
            </div>
          )}

          {/* 操作步骤标签页 */}
          {activeTab === 'steps' && (
            <div className="p-4">
              {currentHelp.steps && currentHelp.steps.length > 0 ? (
                <div className="space-y-3">
                  {currentHelp.steps.map((step, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-700 pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无操作步骤说明</p>
                </div>
              )}
            </div>
          )}

          {/* 技巧和FAQ标签页 */}
          {activeTab === 'tips' && (
            <div className="p-4 space-y-6">
              {/* 使用技巧 */}
              {currentHelp.tips && currentHelp.tips.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    使用技巧
                  </h3>
                  <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                    {currentHelp.tips.map((tip, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-amber-800">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 常见问题 */}
              {currentHelp.faq && currentHelp.faq.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-primary-600" />
                    常见问题
                  </h3>
                  <div className="space-y-2">
                    {currentHelp.faq.map((item, index) => (
                      <div 
                        key={index}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                          className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-900 pr-4">{item.q}</span>
                          <ChevronRight 
                            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expandedFaq === index ? 'rotate-90' : ''}`} 
                          />
                        </button>
                        {expandedFaq === index && (
                          <div className="px-3 pb-3">
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{item.a}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 没有任何内容时的占位 */}
              {(!currentHelp.tips || currentHelp.tips.length === 0) && 
               (!currentHelp.faq || currentHelp.faq.length === 0) && (
                <div className="text-center py-12 text-gray-400">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无技巧和常见问题</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 面板底部 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleOpenHelpCenter}
            className="w-full py-2.5 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-700"
          >
            <ExternalLink className="w-4 h-4" />
            前往帮助中心查看更多
          </button>
        </div>
      </div>
    </>
  )
}

