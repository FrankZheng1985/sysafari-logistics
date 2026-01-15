import { useState, useEffect, useCallback } from 'react'
import { Settings, RefreshCw, Loader2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useAuth } from '../contexts/AuthContext'
import WorkbenchSettingsModal from '../components/workbench/WorkbenchSettingsModal'
import WorkbenchCard from '../components/workbench/WorkbenchCard'
import PendingTasksCard from '../components/workbench/cards/PendingTasksCard'
import OrderStatsCard from '../components/workbench/cards/OrderStatsCard'
import FinanceStatsCard from '../components/workbench/cards/FinanceStatsCard'
import FinanceOverviewCard from '../components/workbench/cards/FinanceOverviewCard'
import TmsStatsCard from '../components/workbench/cards/TmsStatsCard'
import InspectionStatsCard from '../components/workbench/cards/InspectionStatsCard'
import CrmStatsCard from '../components/workbench/cards/CrmStatsCard'
import DocumentStatsCard from '../components/workbench/cards/DocumentStatsCard'
import StagnantOrdersCard from '../components/workbench/cards/StagnantOrdersCard'
import RecentActivityCard from '../components/workbench/cards/RecentActivityCard'
import NotificationsCard from '../components/workbench/cards/NotificationsCard'
import QuickLinksCard from '../components/workbench/cards/QuickLinksCard'
import CalendarCard from '../components/workbench/cards/CalendarCard'
import TeamOverviewCard from '../components/workbench/cards/TeamOverviewCard'
import CompanyOverviewCard from '../components/workbench/cards/CompanyOverviewCard'
import { useWorkbenchConfig, CARD_DEFINITIONS, type CardId } from '../hooks/useWorkbenchConfig'

// 格式化中文日期
const formatChineseDate = (date: Date) => {
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekDay = weekDays[date.getDay()]
  return `${year}年${month}月${day}日 ${weekDay}`
}

// 卡片组件映射
const CARD_COMPONENTS: Record<CardId, React.ComponentType<{ refreshKey?: number }>> = {
  pending_tasks: PendingTasksCard,
  order_stats: OrderStatsCard,
  finance_stats: FinanceStatsCard,
  finance_overview: FinanceOverviewCard,
  tms_stats: TmsStatsCard,
  inspection_stats: InspectionStatsCard,
  crm_stats: CrmStatsCard,
  document_stats: DocumentStatsCard,
  stagnant_orders: StagnantOrdersCard,
  recent_activity: RecentActivityCard,
  notifications: NotificationsCard,
  quick_links: QuickLinksCard,
  calendar: CalendarCard,
  team_overview: TeamOverviewCard,
  company_overview: CompanyOverviewCard,
}

export default function Workbench() {
  const { user, hasPermission, isAdmin, isManager } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const {
    config,
    loading: configLoading,
    updateCardOrder,
    toggleCardVisibility,
    resetToDefault,
    saveConfig,
  } = useWorkbenchConfig()

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = config.cardOrder.indexOf(active.id as CardId)
      const newIndex = config.cardOrder.indexOf(over.id as CardId)
      const newOrder = arrayMove(config.cardOrder, oldIndex, newIndex)
      updateCardOrder(newOrder)
    }
  }, [config.cardOrder, updateCardOrder])

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshKey(prev => prev + 1)
    // 模拟刷新延迟
    setTimeout(() => setRefreshing(false), 1000)
  }, [])

  // 检查卡片是否有权限显示
  const hasCardPermission = useCallback((cardId: CardId): boolean => {
    const cardDef = CARD_DEFINITIONS.find(c => c.id === cardId)
    if (!cardDef) return false

    // 管理员有所有权限
    if (isAdmin()) return true

    // 检查角色要求
    if (cardDef.requiredRole) {
      const userRole = user?.role || ''
      // manager 级别的卡片，boss 也可以看到（老板可以看到整个公司的团队）
      if (cardDef.requiredRole === 'manager' && !isManager() && userRole !== 'boss') return false
      if (cardDef.requiredRole === 'boss' && !['boss', 'admin'].includes(userRole)) return false
      if (cardDef.requiredRole === 'finance_director' && !['finance_director', 'boss', 'admin'].includes(userRole)) return false
    }

    // 检查权限要求
    if (cardDef.requiredPermission) {
      return hasPermission(cardDef.requiredPermission)
    }

    return true
  }, [user?.role, isAdmin, isManager, hasPermission])

  // 获取可见的卡片列表
  const visibleCards = config.cardOrder.filter(cardId => {
    // 检查是否被隐藏
    if (config.hiddenCards.includes(cardId)) return false
    // 检查是否有权限
    if (!hasCardPermission(cardId)) return false
    return true
  })

  // 获取当前时间的问候语
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 9) return '早上好'
    if (hour < 12) return '上午好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    if (hour < 22) return '晚上好'
    return '夜深了'
  }

  if (configLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="ml-2 text-gray-600">加载工作台...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部欢迎栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {getGreeting()}，{user?.name || '用户'}！
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatChineseDate(new Date())}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              自定义工作台
            </button>
          </div>
        </div>
      </div>

      {/* 卡片区域 */}
      <div className="flex-1 overflow-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleCards} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleCards.map(cardId => {
                const CardComponent = CARD_COMPONENTS[cardId]
                const cardDef = CARD_DEFINITIONS.find(c => c.id === cardId)
                
                if (!CardComponent || !cardDef) return null

                return (
                  <WorkbenchCard
                    key={cardId}
                    id={cardId}
                    title={cardDef.name}
                    icon={cardDef.icon}
                    size={cardDef.size}
                  >
                    <CardComponent refreshKey={refreshKey} />
                  </WorkbenchCard>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {visibleCards.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Settings className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">暂无显示的卡片</p>
            <p className="text-sm mt-1">点击"自定义工作台"添加卡片</p>
          </div>
        )}
      </div>

      {/* 设置弹窗 */}
      <WorkbenchSettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onToggleCard={toggleCardVisibility}
        onResetDefault={resetToDefault}
        onSave={saveConfig}
        hasCardPermission={hasCardPermission}
      />
    </div>
  )
}
