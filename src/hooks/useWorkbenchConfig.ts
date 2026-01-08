import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 卡片ID类型
export type CardId = 
  | 'pending_tasks'
  | 'order_stats'
  | 'finance_stats'
  | 'finance_overview'
  | 'tms_stats'
  | 'inspection_stats'
  | 'crm_stats'
  | 'document_stats'
  | 'stagnant_orders'
  | 'recent_activity'
  | 'notifications'
  | 'quick_links'
  | 'calendar'
  | 'team_overview'
  | 'company_overview'

// 卡片定义接口
export interface CardDefinition {
  id: CardId
  name: string
  description: string
  icon: string
  requiredPermission?: string
  requiredRole?: 'manager' | 'boss' | 'finance_director'
  size?: 'small' | 'medium' | 'large'
}

// 所有卡片定义
export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: 'pending_tasks',
    name: '待办任务',
    description: '需要处理的任务数量和列表',
    icon: '📋',
    size: 'medium',
  },
  {
    id: 'order_stats',
    name: '订单统计',
    description: '订单数量、状态分布等',
    icon: '📦',
    requiredPermission: 'bill:view',
    size: 'small',
  },
  {
    id: 'finance_stats',
    name: '财务统计',
    description: '应收应付、现金流、收款率等',
    icon: '💰',
    requiredPermission: 'finance:view',
    size: 'small',
  },
  {
    id: 'finance_overview',
    name: '财务概览',
    description: '高级财务指标、利润、资产负债概要',
    icon: '📊',
    requiredRole: 'finance_director',
    size: 'large',
  },
  {
    id: 'tms_stats',
    name: '运输统计',
    description: '派送中、已送达、异常订单等',
    icon: '🚚',
    requiredPermission: 'tms:view',
    size: 'small',
  },
  {
    id: 'inspection_stats',
    name: '查验统计',
    description: '待查验、已放行等',
    icon: '🔍',
    requiredPermission: 'inspection:view',
    size: 'small',
  },
  {
    id: 'crm_stats',
    name: '客户统计',
    description: '客户数、订单分布、商机数等',
    icon: '👥',
    requiredPermission: 'crm:view',
    size: 'small',
  },
  {
    id: 'document_stats',
    name: '单证统计',
    description: '待匹配、待补充、匹配成功率等',
    icon: '📄',
    requiredPermission: 'document:view',
    size: 'small',
  },
  {
    id: 'stagnant_orders',
    name: '滞留订单预警',
    description: '已到港很久但未结束的订单',
    icon: '⚠️',
    requiredPermission: 'finance:view',
    size: 'medium',
  },
  {
    id: 'recent_activity',
    name: '最近动态',
    description: '最近操作的订单/任务',
    icon: '📝',
    size: 'medium',
  },
  {
    id: 'notifications',
    name: '消息通知',
    description: '系统通知和预警',
    icon: '🔔',
    size: 'medium',
  },
  {
    id: 'quick_links',
    name: '快捷入口',
    description: '常用功能快速访问',
    icon: '🔗',
    size: 'medium',
  },
  {
    id: 'calendar',
    name: '日程日历',
    description: '今日/本周安排',
    icon: '📅',
    size: 'medium',
  },
  {
    id: 'team_overview',
    name: '团队概览',
    description: '团队成员工作状态',
    icon: '👨‍👩‍👧‍👦',
    requiredRole: 'manager',
    size: 'large',
  },
  {
    id: 'company_overview',
    name: '公司概览',
    description: 'KPI、业绩指标、部门对比',
    icon: '🏢',
    requiredRole: 'boss',
    size: 'large',
  },
]

// 工作台配置接口
export interface WorkbenchConfig {
  cardOrder: CardId[]
  hiddenCards: CardId[]
}

// 各角色默认配置
const DEFAULT_CONFIGS: Record<string, WorkbenchConfig> = {
  // 操作员/跟单员
  operator: {
    cardOrder: [
      'pending_tasks', 'order_stats', 'tms_stats',
      'recent_activity', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'finance_stats', 'finance_overview', 'inspection_stats',
      'crm_stats', 'document_stats', 'stagnant_orders',
      'calendar', 'team_overview', 'company_overview',
    ],
  },
  doc_clerk: {
    cardOrder: [
      'pending_tasks', 'order_stats', 'tms_stats', 'inspection_stats',
      'recent_activity', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'finance_stats', 'finance_overview', 'crm_stats',
      'document_stats', 'stagnant_orders', 'calendar',
      'team_overview', 'company_overview',
    ],
  },
  // 单证员
  doc_officer: {
    cardOrder: [
      'pending_tasks', 'document_stats', 'order_stats',
      'recent_activity', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'finance_stats', 'finance_overview', 'tms_stats',
      'inspection_stats', 'crm_stats', 'stagnant_orders',
      'calendar', 'team_overview', 'company_overview',
    ],
  },
  // 运营经理
  manager: {
    cardOrder: [
      'pending_tasks', 'team_overview', 'order_stats', 'tms_stats',
      'inspection_stats', 'calendar', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'finance_stats', 'finance_overview', 'crm_stats',
      'document_stats', 'stagnant_orders', 'recent_activity',
      'company_overview',
    ],
  },
  // 财务助理
  finance_assistant: {
    cardOrder: [
      'pending_tasks', 'finance_stats', 'stagnant_orders',
      'recent_activity', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'finance_overview', 'order_stats', 'tms_stats',
      'inspection_stats', 'crm_stats', 'document_stats',
      'calendar', 'team_overview', 'company_overview',
    ],
  },
  // 财务经理/主管
  finance_director: {
    cardOrder: [
      'finance_overview', 'finance_stats', 'pending_tasks',
      'stagnant_orders', 'order_stats', 'quick_links', 'notifications',
    ],
    hiddenCards: [
      'tms_stats', 'inspection_stats', 'crm_stats',
      'document_stats', 'recent_activity', 'calendar',
      'team_overview', 'company_overview',
    ],
  },
  // 老板
  boss: {
    cardOrder: [
      'company_overview', 'order_stats', 'crm_stats', 'finance_stats',
      'pending_tasks', 'team_overview', 'notifications',
    ],
    hiddenCards: [
      'finance_overview', 'tms_stats', 'inspection_stats',
      'document_stats', 'stagnant_orders', 'recent_activity',
      'quick_links', 'calendar',
    ],
  },
  // 管理员
  admin: {
    cardOrder: [
      'company_overview', 'pending_tasks', 'order_stats', 'finance_stats',
      'tms_stats', 'crm_stats', 'team_overview', 'notifications',
      'quick_links', 'recent_activity',
    ],
    hiddenCards: [
      'finance_overview', 'inspection_stats', 'document_stats',
      'stagnant_orders', 'calendar',
    ],
  },
  // 查看者
  viewer: {
    cardOrder: [
      'order_stats', 'notifications', 'recent_activity',
    ],
    hiddenCards: [
      'pending_tasks', 'finance_stats', 'finance_overview',
      'tms_stats', 'inspection_stats', 'crm_stats',
      'document_stats', 'stagnant_orders', 'quick_links',
      'calendar', 'team_overview', 'company_overview',
    ],
  },
}

// 本地存储键
const LOCAL_STORAGE_KEY = 'bp_logistics_workbench_config'

// 获取默认配置
function getDefaultConfig(role: string): WorkbenchConfig {
  return DEFAULT_CONFIGS[role] || DEFAULT_CONFIGS.operator
}

// Hook 导出
export function useWorkbenchConfig() {
  const { user, getAccessToken } = useAuth()
  const [config, setConfig] = useState<WorkbenchConfig>(() => {
    // 先尝试从本地存储获取
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        // 解析失败，使用默认配置
      }
    }
    return getDefaultConfig(user?.role || 'operator')
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 从服务器加载配置
  const loadConfig = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          const serverConfig = data.data
          setConfig(serverConfig)
          // 同步到本地存储
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverConfig))
        }
      }
    } catch (error) {
      console.error('加载工作台配置失败:', error)
      // 使用本地缓存或默认配置
    } finally {
      setLoading(false)
    }
  }, [user?.id, getAccessToken])

  // 初始化加载
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // 当用户角色改变时，重置为默认配置（如果没有自定义配置）
  useEffect(() => {
    if (user?.role && !localStorage.getItem(LOCAL_STORAGE_KEY)) {
      setConfig(getDefaultConfig(user.role))
    }
  }, [user?.role])

  // 更新卡片顺序
  const updateCardOrder = useCallback((newOrder: CardId[]) => {
    setConfig(prev => {
      const newConfig = { ...prev, cardOrder: newOrder }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig))
      return newConfig
    })
  }, [])

  // 切换卡片显示/隐藏
  const toggleCardVisibility = useCallback((cardId: CardId) => {
    setConfig(prev => {
      const isHidden = prev.hiddenCards.includes(cardId)
      let newHiddenCards: CardId[]
      let newCardOrder: CardId[]

      if (isHidden) {
        // 显示卡片
        newHiddenCards = prev.hiddenCards.filter(id => id !== cardId)
        // 如果卡片不在顺序中，添加到末尾
        if (!prev.cardOrder.includes(cardId)) {
          newCardOrder = [...prev.cardOrder, cardId]
        } else {
          newCardOrder = prev.cardOrder
        }
      } else {
        // 隐藏卡片
        newHiddenCards = [...prev.hiddenCards, cardId]
        newCardOrder = prev.cardOrder
      }

      const newConfig = {
        cardOrder: newCardOrder,
        hiddenCards: newHiddenCards,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig))
      return newConfig
    })
  }, [])

  // 重置为默认配置
  const resetToDefault = useCallback(() => {
    const defaultConfig = getDefaultConfig(user?.role || 'operator')
    setConfig(defaultConfig)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultConfig))
  }, [user?.role])

  // 保存配置到服务器
  const saveConfig = useCallback(async () => {
    if (!user?.id) return

    setSaving(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200) {
          console.log('工作台配置保存成功')
        }
      }
    } catch (error) {
      console.error('保存工作台配置失败:', error)
    } finally {
      setSaving(false)
    }
  }, [user?.id, config, getAccessToken])

  return {
    config,
    loading,
    saving,
    updateCardOrder,
    toggleCardVisibility,
    resetToDefault,
    saveConfig,
  }
}
