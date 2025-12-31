/**
 * 手动跟踪节点录入组件
 * 
 * 用于卡航等需要手动录入跟踪节点的场景
 */

import { useState } from 'react'
import { Plus, MapPin, Clock, Camera, Loader2, Check, X, Navigation } from 'lucide-react'
import { addTrackingNode, type NodeTemplate } from '../utils/api'

interface ManualTrackingInputProps {
  billId: string
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
  nodeTemplates?: NodeTemplate[]
  onSuccess?: () => void
  onCancel?: () => void
}

// 预设的卡航节点类型
const defaultTruckNodes: NodeTemplate[] = [
  { nodeType: 'departure', nodeName: '发车', order: 1 },
  { nodeType: 'truck_departed', nodeName: '卡车出发', order: 2 },
  { nodeType: 'checkpoint', nodeName: '中转站', order: 3 },
  { nodeType: 'border_cross', nodeName: '过境', order: 4 },
  { nodeType: 'in_transit', nodeName: '运输中', order: 5 },
  { nodeType: 'truck_arrived', nodeName: '到达目的地', order: 6 },
  { nodeType: 'delivery', nodeName: '派送中', order: 7 },
  { nodeType: 'signed', nodeName: '签收', order: 8 },
]

// 状态选项
const statusOptions = [
  { value: 'pending', label: '待发运', color: 'bg-gray-100 text-gray-600' },
  { value: 'in_transit', label: '运输中', color: 'bg-blue-100 text-blue-600' },
  { value: 'arrived', label: '已到达', color: 'bg-green-100 text-green-600' },
  { value: 'customs', label: '清关中', color: 'bg-yellow-100 text-yellow-600' },
  { value: 'delivered', label: '已签收', color: 'bg-green-100 text-green-700' },
  { value: 'exception', label: '异常', color: 'bg-red-100 text-red-600' },
]

export default function ManualTrackingInput({
  billId,
  transportType = 'truck',
  nodeTemplates,
  onSuccess,
  onCancel,
}: ManualTrackingInputProps) {
  const [submitting, setSubmitting] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [formData, setFormData] = useState({
    selectedNodeType: '',
    nodeName: '',
    status: 'in_transit',
    location: '',
    eventTime: new Date().toISOString().slice(0, 16),
    remark: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  })
  
  // 使用的节点模板
  const templates = nodeTemplates || defaultTruckNodes
  
  // 选择节点类型
  const handleSelectNode = (template: NodeTemplate) => {
    setFormData(prev => ({
      ...prev,
      selectedNodeType: template.nodeType,
      nodeName: template.nodeName,
    }))
  }
  
  // 获取当前位置
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理定位')
      return
    }
    
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setGettingLocation(false)
      },
      (error) => {
        console.error('获取位置失败:', error)
        alert('获取位置失败，请手动输入')
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  
  // 提交
  const handleSubmit = async () => {
    if (!formData.nodeName) {
      alert('请选择或填写节点名称')
      return
    }
    
    setSubmitting(true)
    try {
      const response = await addTrackingNode(billId, {
        nodeType: formData.selectedNodeType || 'checkpoint',
        nodeName: formData.nodeName,
        status: formData.status,
        location: formData.location,
        eventTime: formData.eventTime ? new Date(formData.eventTime).toISOString() : undefined,
        remark: formData.remark,
        latitude: formData.latitude,
        longitude: formData.longitude,
      })
      
      if (response.errCode === 200) {
        onSuccess?.()
      } else {
        alert(response.msg || '添加失败')
      }
    } catch (err: any) {
      alert(err.message || '添加失败')
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">录入跟踪节点</h4>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* 内容 */}
      <div className="p-4 space-y-4">
        {/* 快捷节点选择 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">选择节点类型</label>
          <div className="grid grid-cols-4 gap-2">
            {templates.map((template) => (
              <button
                key={template.nodeType}
                onClick={() => handleSelectNode(template)}
                className={`px-2 py-2 text-xs rounded border transition-all ${
                  formData.selectedNodeType === template.nodeType
                    ? 'bg-primary-100 border-primary-400 text-primary-700 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                {template.nodeName}
              </button>
            ))}
          </div>
        </div>
        
        {/* 自定义节点名称 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            节点名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.nodeName}
            onChange={(e) => setFormData({ ...formData, nodeName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="可自定义或使用上方快捷选择"
          />
        </div>
        
        {/* 状态选择 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">当前状态</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFormData({ ...formData, status: option.value })}
                className={`px-2.5 py-1 text-xs rounded transition-all ${
                  formData.status === option.value
                    ? `${option.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 位置信息 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            位置
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="例如：上海、霍尔果斯口岸"
            />
            <button
              onClick={handleGetLocation}
              disabled={gettingLocation}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1 text-xs"
              title="获取当前位置"
            >
              {gettingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              定位
            </button>
          </div>
          {formData.latitude && formData.longitude && (
            <p className="mt-1 text-[10px] text-gray-400">
              坐标: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
            </p>
          )}
        </div>
        
        {/* 时间 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            事件时间
          </label>
          <input
            type="datetime-local"
            value={formData.eventTime}
            onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        
        {/* 备注 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
          <textarea
            value={formData.remark}
            onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            rows={2}
            placeholder="可选，添加额外说明（如车牌号、司机信息等）"
          />
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || !formData.nodeName}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              确认提交
            </>
          )}
        </button>
      </div>
    </div>
  )
}
