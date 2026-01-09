import { X, RotateCcw, Save, Check, Lock } from 'lucide-react'
import { CARD_DEFINITIONS, type CardId, type WorkbenchConfig } from '../../hooks/useWorkbenchConfig'

interface WorkbenchSettingsModalProps {
  visible: boolean
  onClose: () => void
  config: WorkbenchConfig
  onToggleCard: (cardId: CardId) => void
  onResetDefault: () => void
  onSave: () => void
  hasCardPermission: (cardId: CardId) => boolean
}

export default function WorkbenchSettingsModal({
  visible,
  onClose,
  config,
  onToggleCard,
  onResetDefault,
  onSave,
  hasCardPermission,
}: WorkbenchSettingsModalProps) {
  if (!visible) return null

  const handleSaveAndClose = () => {
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">自定义工作台</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-gray-500 mb-4">
            选择要在工作台显示的卡片，拖拽卡片可调整位置顺序。
          </p>

          <div className="space-y-2">
            {CARD_DEFINITIONS.map(card => {
              const hasPermission = hasCardPermission(card.id)
              const isVisible = !config.hiddenCards.includes(card.id)
              const isEnabled = hasPermission && isVisible

              return (
                <div
                  key={card.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-colors
                    ${!hasPermission 
                      ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                      : isVisible
                        ? 'bg-primary-50 border-primary-200 cursor-pointer hover:bg-primary-100'
                        : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50'
                    }
                  `}
                  onClick={() => hasPermission && onToggleCard(card.id)}
                >
                  {/* 选择框 */}
                  <div
                    className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                      ${!hasPermission 
                        ? 'border-gray-300 bg-gray-200' 
                        : isVisible
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }
                    `}
                  >
                    {!hasPermission ? (
                      <Lock className="w-3 h-3 text-gray-400" />
                    ) : isVisible ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : null}
                  </div>

                  {/* 卡片信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{card.icon}</span>
                      <span className={`text-sm font-medium ${hasPermission ? 'text-gray-900' : 'text-gray-400'}`}>
                        {card.name}
                      </span>
                      {card.size === 'large' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
                          大卡片
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${hasPermission ? 'text-gray-500' : 'text-gray-400'}`}>
                      {card.description}
                    </p>
                    {!hasPermission && (
                      <p className="text-xs text-amber-600 mt-1">
                        无权限查看此卡片
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onResetDefault}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            恢复默认
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveAndClose}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
