/**
 * 物流跟踪时间线组件
 * 
 * 展示物流跟踪节点的时间线视图
 */

import { CheckCircle, Circle, AlertCircle, Clock, MapPin, Truck, Ship, Plane, Train } from 'lucide-react'
import { TrackingRecord } from '../utils/api'

interface TrackingTimelineProps {
  records: TrackingRecord[]
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
  compact?: boolean
}

// 状态颜色映射
const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'text-gray-400' },
  in_transit: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'text-blue-500' },
  arrived: { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-500' },
  customs: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'text-yellow-500' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-600' },
  exception: { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-500' },
}

// 状态显示文本
const statusLabels: Record<string, string> = {
  pending: '待发运',
  in_transit: '运输中',
  arrived: '已到达',
  customs: '清关中',
  delivered: '已签收',
  exception: '异常',
}

// 获取运输方式图标
function getTransportIcon(transportType: string) {
  switch (transportType) {
    case 'sea':
      return Ship
    case 'air':
      return Plane
    case 'rail':
      return Train
    case 'truck':
      return Truck
    default:
      return Truck
  }
}

// 格式化时间
function formatTime(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffDays > 30) {
      return `${Math.floor(diffDays / 30)}个月前`
    } else if (diffDays > 0) {
      return `${diffDays}天前`
    } else if (diffHours > 0) {
      return `${diffHours}小时前`
    } else {
      return '刚刚'
    }
  } catch {
    return ''
  }
}

export default function TrackingTimeline({
  records,
  transportType = 'sea',
  compact = false,
}: TrackingTimelineProps) {
  const TransportIcon = getTransportIcon(transportType)
  
  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <TransportIcon className="w-12 h-12 mb-2" />
        <p className="text-sm">暂无跟踪记录</p>
      </div>
    )
  }
  
  // 按时间倒序排列
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
  )
  
  return (
    <div className={`relative ${compact ? 'space-y-3' : 'space-y-4'}`}>
      {sortedRecords.map((record, index) => {
        const colors = statusColors[record.status] || statusColors.in_transit
        const isFirst = index === 0
        const isLast = index === sortedRecords.length - 1
        
        // 获取节点图标
        const NodeIcon = record.status === 'delivered' 
          ? CheckCircle 
          : record.status === 'exception' 
          ? AlertCircle 
          : isFirst 
          ? Circle 
          : Circle
        
        return (
          <div key={record.id} className="relative flex gap-3">
            {/* 时间线 */}
            <div className="flex flex-col items-center">
              {/* 节点图标 */}
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${colors.bg}`}>
                <NodeIcon className={`w-4 h-4 ${colors.icon}`} />
              </div>
              {/* 连接线 */}
              {!isLast && (
                <div className="w-0.5 h-full min-h-[40px] bg-gray-200 -mt-1" />
              )}
            </div>
            
            {/* 内容 */}
            <div className={`flex-1 pb-4 ${compact ? 'pb-2' : 'pb-4'}`}>
              <div className="flex items-start justify-between">
                <div>
                  {/* 节点名称 */}
                  <h4 className={`font-medium ${isFirst ? 'text-gray-900' : 'text-gray-700'} ${compact ? 'text-xs' : 'text-sm'}`}>
                    {record.nodeName || record.nodeType}
                  </h4>
                  
                  {/* 位置 */}
                  {record.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-400`} />
                      <span className={`text-gray-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                        {record.location}
                      </span>
                    </div>
                  )}
                  
                  {/* 备注 */}
                  {record.remark && !compact && (
                    <p className="mt-1 text-xs text-gray-500">
                      {record.remark}
                    </p>
                  )}
                </div>
                
                {/* 时间和状态 */}
                <div className="text-right">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                    <span className={compact ? 'text-[10px]' : 'text-xs'}>
                      {formatRelativeTime(record.eventTime)}
                    </span>
                  </div>
                  <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-400 mt-0.5`}>
                    {formatTime(record.eventTime)}
                  </div>
                  {!compact && (
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] ${colors.bg} ${colors.text}`}>
                      {statusLabels[record.status] || record.status}
                    </span>
                  )}
                </div>
              </div>
              
              {/* 来源标识 */}
              {!compact && (
                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                  <span className={`px-1 py-0.5 rounded ${record.source === 'api' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {record.source === 'api' ? 'API' : '手动'}
                  </span>
                  {record.operator && (
                    <span>操作人: {record.operator}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
