/**
 * 物流跟踪面板组件
 * 
 * 包含跟踪时间线和手动添加节点功能
 */

import { useState, useEffect } from 'react'
import { RefreshCw, Plus, MapPin, Clock, X, Loader2, ChevronDown, Ship, Plane, Train, Truck, CheckCircle, AlertCircle } from 'lucide-react'
import TrackingTimeline from './TrackingTimeline'
import { 
  getBillTracking, 
  addTrackingNode, 
  getTrackingNodeTemplates,
  type TrackingRecord, 
  type TrackingInfo,
  type NodeTemplate 
} from '../utils/api'

interface TrackingPanelProps {
  billId: string
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
  trackingNumber?: string
  onClose?: () => void
  embedded?: boolean // 是否嵌入模式（不显示关闭按钮）
}

// 运输方式标签
const transportLabels: Record<string, { label: string; icon: React.ElementType }> = {
  sea: { label: '海运', icon: Ship },
  air: { label: '空运', icon: Plane },
  rail: { label: '铁路', icon: Train },
  truck: { label: '卡航', icon: Truck },
}

// 状态选项
const statusOptions = [
  { value: 'pending', label: '待发运' },
  { value: 'in_transit', label: '运输中' },
  { value: 'arrived', label: '已到达' },
  { value: 'customs', label: '清关中' },
  { value: 'delivered', label: '已签收' },
  { value: 'exception', label: '异常' },
]

export default function TrackingPanel({
  billId,
  transportType = 'sea',
  trackingNumber,
  onClose,
  embedded = false,
}: TrackingPanelProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 添加节点相关状态
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [nodeTemplates, setNodeTemplates] = useState<NodeTemplate[]>([])
  const [newNode, setNewNode] = useState({
    nodeType: '',
    nodeName: '',
    status: 'in_transit',
    location: '',
    eventTime: new Date().toISOString().slice(0, 16),
    remark: '',
  })
  
  const TransportIcon = transportLabels[transportType]?.icon || Truck
  
  // 加载跟踪数据
  const loadTrackingData = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const response = await getBillTracking(billId, {
        refresh,
        transportType,
      })
      
      if (response.errCode === 200 && response.data) {
        setTrackingInfo(response.data)
      } else {
        setError(response.msg || '获取跟踪数据失败')
      }
    } catch (err: any) {
      setError(err.message || '获取跟踪数据失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  // 加载节点模板
  const loadNodeTemplates = async () => {
    try {
      const response = await getTrackingNodeTemplates(transportType)
      if (response.errCode === 200 && response.data) {
        setNodeTemplates(response.data)
      }
    } catch (err) {
      console.error('加载节点模板失败:', err)
    }
  }
  
  // 初始加载
  useEffect(() => {
    loadTrackingData()
    loadNodeTemplates()
  }, [billId, transportType])
  
  // 刷新跟踪数据
  const handleRefresh = () => {
    loadTrackingData(true)
  }
  
  // 添加节点
  const handleAddNode = async () => {
    if (!newNode.nodeType || !newNode.nodeName) {
      alert('请选择节点类型并填写节点名称')
      return
    }
    
    setSubmitting(true)
    try {
      const response = await addTrackingNode(billId, {
        nodeType: newNode.nodeType,
        nodeName: newNode.nodeName,
        status: newNode.status,
        location: newNode.location,
        eventTime: newNode.eventTime ? new Date(newNode.eventTime).toISOString() : undefined,
        remark: newNode.remark,
      })
      
      if (response.errCode === 200) {
        // 重新加载数据
        await loadTrackingData()
        // 重置表单
        setNewNode({
          nodeType: '',
          nodeName: '',
          status: 'in_transit',
          location: '',
          eventTime: new Date().toISOString().slice(0, 16),
          remark: '',
        })
        setShowAddForm(false)
      } else {
        alert(response.msg || '添加节点失败')
      }
    } catch (err: any) {
      alert(err.message || '添加节点失败')
    } finally {
      setSubmitting(false)
    }
  }
  
  // 选择节点模板
  const handleSelectTemplate = (template: NodeTemplate) => {
    setNewNode(prev => ({
      ...prev,
      nodeType: template.nodeType,
      nodeName: template.nodeName,
    }))
  }
  
  return (
    <div className={`bg-white ${embedded ? '' : 'rounded-lg shadow-lg border border-gray-200'}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TransportIcon className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">物流跟踪</h3>
          <span className={`px-2 py-0.5 text-xs rounded ${
            transportType === 'sea' ? 'bg-blue-100 text-blue-700' :
            transportType === 'air' ? 'bg-purple-100 text-purple-700' :
            transportType === 'rail' ? 'bg-orange-100 text-orange-700' :
            'bg-green-100 text-green-700'
          }`}>
            {transportLabels[transportType]?.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="手动添加节点"
          >
            <Plus className="w-4 h-4" />
          </button>
          {!embedded && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* 跟踪号显示 */}
      {trackingNumber && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs text-gray-500">跟踪号：</span>
          <span className="text-xs font-medium text-gray-700 ml-1">{trackingNumber}</span>
        </div>
      )}
      
      {/* 内容区域 */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">{error}</p>
            <button
              onClick={() => loadTrackingData()}
              className="mt-2 text-xs text-primary-600 hover:underline"
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {/* 最新状态 */}
            {trackingInfo?.latestStatus && (
              <div className="mb-4 p-3 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    {trackingInfo.latestStatus.nodeName}
                  </span>
                </div>
                {trackingInfo.latestStatus.location && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-primary-600">
                    <MapPin className="w-3 h-3" />
                    <span>{trackingInfo.latestStatus.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-primary-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(trackingInfo.latestStatus.eventTime).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            )}
            
            {/* 时间线 */}
            <TrackingTimeline
              records={trackingInfo?.records || []}
              transportType={transportType}
            />
          </>
        )}
      </div>
      
      {/* 添加节点表单弹窗 */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* 表单头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">添加跟踪节点</h4>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 表单内容 */}
            <div className="p-4 space-y-4">
              {/* 快捷选择节点模板 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  快捷选择节点
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {nodeTemplates.map((template) => (
                    <button
                      key={template.nodeType}
                      onClick={() => handleSelectTemplate(template)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        newNode.nodeType === template.nodeType
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {template.nodeName}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 节点名称 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  节点名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newNode.nodeName}
                  onChange={(e) => setNewNode({ ...newNode, nodeName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="例如：船舶到港、清关放行"
                />
              </div>
              
              {/* 状态 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  状态
                </label>
                <select
                  value={newNode.status}
                  onChange={(e) => setNewNode({ ...newNode, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 位置 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  位置
                </label>
                <input
                  type="text"
                  value={newNode.location}
                  onChange={(e) => setNewNode({ ...newNode, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="例如：上海港、鹿特丹港"
                />
              </div>
              
              {/* 时间 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  事件时间
                </label>
                <input
                  type="datetime-local"
                  value={newNode.eventTime}
                  onChange={(e) => setNewNode({ ...newNode, eventTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              
              {/* 备注 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={newNode.remark}
                  onChange={(e) => setNewNode({ ...newNode, remark: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  rows={2}
                  placeholder="可选，添加额外说明"
                />
              </div>
            </div>
            
            {/* 表单底部 */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleAddNode}
                disabled={submitting || !newNode.nodeName}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? '添加中...' : '添加节点'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
