import { useState, useEffect, useRef } from 'react'
import { X, Truck, Clock, MapPin, Package, CheckCircle, AlertTriangle, Calendar, ChevronDown } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 服务商类型
interface ServiceProvider {
  id: string
  providerCode: string
  providerName: string
  serviceType: string
  status: string
}

// 异常记录
export interface ExceptionRecord {
  id: string
  note: string
  time: string
  action: 'report' | 'followup' | 'resolve' | 'close'
  actionLabel: string
}

// CMR 详情数据
export interface CMRDetail {
  // 步骤1: 预计提货
  estimatedPickupTime?: string
  serviceProvider?: string
  pickupNote?: string
  // 步骤2: 预计到达
  deliveryAddress?: string
  estimatedArrivalTime?: string
  arrivalNote?: string
  // 步骤3: 送达时间
  actualArrivalTime?: string
  deliveryNote?: string
  // 步骤4: 卸货完成
  unloadingCompleteTime?: string
  unloadingNote?: string
  // 步骤5: 确认送达
  confirmedTime?: string
  confirmNote?: string
  // 异常信息
  hasException?: boolean
  exceptionNote?: string
  exceptionTime?: string
  exceptionStatus?: 'open' | 'following' | 'resolved' | 'closed'
  exceptionRecords?: ExceptionRecord[]
}

interface CMRModalProps {
  visible: boolean
  onClose: () => void
  billNumber: string
  currentStatus: string // 未派送, 派送中, 订单异常, 已送达
  cmrDetail?: CMRDetail
  onSubmit: (data: {
    status: string
    detail: CMRDetail
    hasException?: boolean
    exceptionAction?: 'report' | 'followup' | 'resolve' | 'continue' | 'close'
  }) => Promise<void>
}

// 步骤定义
type CMRStep = 'pickup' | 'arrival' | 'delivered' | 'unloading' | 'confirm'
type ModalMode = 'normal' | 'exception' | 'exception_handle'

export default function CMRModal({
  visible,
  onClose,
  billNumber,
  currentStatus,
  cmrDetail,
  onSubmit,
}: CMRModalProps) {
  // 模态框模式
  const [mode, setMode] = useState<ModalMode>('normal')
  
  // 当前步骤
  const [step, setStep] = useState<CMRStep>('pickup')
  const [loading, setLoading] = useState(false)
  
  // 步骤1: 预计提货
  const [estimatedPickupTime, setEstimatedPickupTime] = useState('')
  const [serviceProvider, setServiceProvider] = useState('')
  const [pickupNote, setPickupNote] = useState('')
  
  // 服务商下拉选择
  const [serviceProviderList, setServiceProviderList] = useState<ServiceProvider[]>([])
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const [providerSearchText, setProviderSearchText] = useState('')
  const providerDropdownRef = useRef<HTMLDivElement>(null)
  
  // 步骤2: 预计到达
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('')
  const [arrivalNote, setArrivalNote] = useState('')
  
  // 步骤3: 送达时间
  const [actualArrivalTime, setActualArrivalTime] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  
  // 步骤4: 卸货完成
  const [unloadingCompleteTime, setUnloadingCompleteTime] = useState('')
  const [unloadingNote, setUnloadingNote] = useState('')
  
  // 步骤5: 确认送达
  const [confirmNote, setConfirmNote] = useState('')
  
  // 异常状态
  const [exceptionNote, setExceptionNote] = useState('')
  const [exceptionAction, setExceptionAction] = useState<'followup' | 'resolve' | 'continue' | 'close'>('followup')

  // 初始化数据
  useEffect(() => {
    if (visible && cmrDetail) {
      setEstimatedPickupTime(cmrDetail.estimatedPickupTime || '')
      setServiceProvider(cmrDetail.serviceProvider || '')
      setPickupNote(cmrDetail.pickupNote || '')
      setDeliveryAddress(cmrDetail.deliveryAddress || '')
      setEstimatedArrivalTime(cmrDetail.estimatedArrivalTime || '')
      setArrivalNote(cmrDetail.arrivalNote || '')
      setActualArrivalTime(cmrDetail.actualArrivalTime || '')
      setDeliveryNote(cmrDetail.deliveryNote || '')
      setUnloadingCompleteTime(cmrDetail.unloadingCompleteTime || '')
      setUnloadingNote(cmrDetail.unloadingNote || '')
      setConfirmNote(cmrDetail.confirmNote || '')
    }
    
    // 根据当前状态设置模式和步骤
    if (currentStatus === '订单异常') {
      setMode('exception_handle')
    } else {
      setMode('normal')
      // 根据当前状态和已填写的数据设置初始步骤
      if (currentStatus === '未派送') {
        setStep('pickup')
      } else if (currentStatus === '派送中') {
        // 根据已完成的数据判断下一步
        if (cmrDetail?.unloadingCompleteTime) {
          // 卸货已完成，进入确认步骤
          setStep('confirm')
        } else if (cmrDetail?.actualArrivalTime) {
          // 已送达，进入卸货步骤
          setStep('unloading')
        } else if (cmrDetail?.deliveryAddress && cmrDetail?.estimatedArrivalTime) {
          // 已有到达信息，进入送达步骤
          setStep('delivered')
        } else {
          // 刚开始派送，进入到达步骤
          setStep('arrival')
        }
      } else if (currentStatus === '已送达') {
        // 已完成
        setStep('confirm')
      }
    }
  }, [visible, cmrDetail, currentStatus])

  // 获取服务商列表
  useEffect(() => {
    const fetchServiceProviders = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/service-providers?status=active&pageSize=100`)
        const data = await response.json()
        if (data.errCode === 200 && data.data?.list) {
          setServiceProviderList(data.data.list)
        }
      } catch (error) {
        console.error('获取服务商列表失败:', error)
      }
    }
    if (visible) {
      fetchServiceProviders()
    }
  }, [visible])

  // 点击外部关闭服务商下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setShowProviderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 重置表单
  useEffect(() => {
    if (!visible) {
      setEstimatedPickupTime('')
      setServiceProvider('')
      setPickupNote('')
      setDeliveryAddress('')
      setEstimatedArrivalTime('')
      setArrivalNote('')
      setActualArrivalTime('')
      setDeliveryNote('')
      setUnloadingCompleteTime('')
      setUnloadingNote('')
      setConfirmNote('')
      setExceptionNote('')
      setExceptionAction('followup')
      setLoading(false)
      setMode('normal')
      setProviderSearchText('')
      setShowProviderDropdown(false)
    }
  }, [visible])

  // 获取步骤标题
  const getStepTitle = () => {
    if (mode === 'exception') return '标记订单异常'
    if (mode === 'exception_handle') return '处理订单异常'
    
    switch (step) {
      case 'pickup': return '第一步：预计提货时间'
      case 'arrival': return '第二步：预计到达时间'
      case 'delivered': return '第三步：送达时间'
      case 'unloading': return '第四步：卸货完成'
      case 'confirm': return '第五步：确认送达'
      default: return '派送'
    }
  }

  // 获取步骤状态
  const getStepStatus = (s: CMRStep) => {
    const steps: CMRStep[] = ['pickup', 'arrival', 'delivered', 'unloading', 'confirm']
    const currentIndex = steps.indexOf(step)
    const stepIndex = steps.indexOf(s)
    
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'active'
    return 'pending'
  }

  // 处理异常提交
  const handleExceptionSubmit = async () => {
    if (!exceptionNote.trim()) {
      alert('请填写异常说明')
      return
    }
    
    setLoading(true)
    try {
      const newRecord: ExceptionRecord = {
        id: `exc_${Date.now()}`,
        note: exceptionNote,
        time: new Date().toISOString(),
        action: 'report',
        actionLabel: '报告异常',
      }
      
      const detail: CMRDetail = {
        estimatedPickupTime,
        serviceProvider,
        pickupNote,
        deliveryAddress,
        estimatedArrivalTime,
        arrivalNote,
        actualArrivalTime,
        deliveryNote,
        unloadingCompleteTime,
        unloadingNote,
        confirmNote,
        hasException: true,
        exceptionNote,
        exceptionTime: new Date().toISOString(),
        exceptionStatus: 'open',
        exceptionRecords: [...(cmrDetail?.exceptionRecords || []), newRecord],
      }
      
      await onSubmit({
        status: '订单异常',
        detail,
        hasException: true,
        exceptionAction: 'report',
      })
      onClose()
    } catch (error) {
      console.error('提交异常失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理异常处理操作
  const handleExceptionAction = async () => {
    if (!exceptionNote.trim()) {
      alert('请填写处理说明')
      return
    }
    
    setLoading(true)
    try {
      const actionLabels = {
        followup: '跟进异常',
        resolve: '解决异常',
        continue: '继续派送',
        close: '关闭订单',
      }
      
      const newRecord: ExceptionRecord = {
        id: `exc_${Date.now()}`,
        note: exceptionNote,
        time: new Date().toISOString(),
        action: exceptionAction === 'continue' ? 'resolve' : exceptionAction,
        actionLabel: actionLabels[exceptionAction],
      }
      
      let newStatus = currentStatus
      let newExceptionStatus: 'open' | 'following' | 'resolved' | 'closed' = cmrDetail?.exceptionStatus || 'open'
      
      if (exceptionAction === 'followup') {
        newExceptionStatus = 'following'
      } else if (exceptionAction === 'resolve' || exceptionAction === 'continue') {
        newExceptionStatus = 'resolved'
        if (exceptionAction === 'continue') {
          // 继续派送，恢复到派送中状态
          newStatus = '派送中'
        }
      } else if (exceptionAction === 'close') {
        newExceptionStatus = 'closed'
        newStatus = '异常关闭'
      }
      
      const detail: CMRDetail = {
        ...cmrDetail,
        exceptionStatus: newExceptionStatus,
        exceptionRecords: [...(cmrDetail?.exceptionRecords || []), newRecord],
      }
      
      await onSubmit({
        status: newStatus,
        detail,
        hasException: exceptionAction !== 'continue',
        exceptionAction,
      })
      onClose()
    } catch (error) {
      console.error('处理异常失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理正常提交
  const handleSubmit = async () => {
    // 验证
    if (step === 'pickup') {
      if (!estimatedPickupTime) {
        alert('请选择预计提货时间')
        return
      }
      if (!serviceProvider.trim()) {
        alert('请填写服务商')
        return
      }
    }
    
    if (step === 'arrival') {
      if (!deliveryAddress.trim()) {
        alert('请填写送达地址')
        return
      }
      if (!estimatedArrivalTime) {
        alert('请选择预计到达时间')
        return
      }
    }
    
    if (step === 'delivered' && !actualArrivalTime) {
      alert('请选择实际送达时间')
      return
    }
    
    if (step === 'unloading' && !unloadingCompleteTime) {
      alert('请选择卸货完成时间')
      return
    }

    // 步骤1: 预计提货 → 步骤2: 预计到达（不保存，只切换步骤）
    if (step === 'pickup') {
      setStep('arrival')
      return
    }

    // 计算新状态 - 每个关键步骤都保存并关闭
    let newStatus = currentStatus
    if (step === 'arrival') {
      newStatus = '派送中'  // 开始派送
    } else if (step === 'delivered') {
      newStatus = '派送中'  // 送达后仍是派送中，等待卸货
    } else if (step === 'unloading') {
      newStatus = '派送中'  // 卸货完成后仍是派送中，等待确认
    } else if (step === 'confirm') {
      newStatus = '已送达'  // 最终确认送达
    }

    setLoading(true)
    try {
      const detail: CMRDetail = {
        estimatedPickupTime,
        serviceProvider,
        pickupNote,
        deliveryAddress,
        estimatedArrivalTime,
        arrivalNote,
        actualArrivalTime,
        deliveryNote,
        unloadingCompleteTime,
        unloadingNote,
        confirmedTime: step === 'confirm' ? new Date().toISOString() : cmrDetail?.confirmedTime,
        confirmNote,
        // 保留异常记录
        hasException: cmrDetail?.hasException,
        exceptionNote: cmrDetail?.exceptionNote,
        exceptionTime: cmrDetail?.exceptionTime,
        exceptionStatus: cmrDetail?.exceptionStatus,
        exceptionRecords: cmrDetail?.exceptionRecords,
      }
      
      await onSubmit({
        status: newStatus,
        detail,
      })
      
      // 每个步骤完成后都关闭模态框
      onClose()
    } catch (error) {
      console.error('提交失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 获取下一步按钮文字
  const getSubmitButtonText = () => {
    switch (step) {
      case 'pickup': return '下一步'
      case 'arrival': return '开始派送'
      case 'delivered': return '确认送达'
      case 'unloading': return '确认卸货完成'
      case 'confirm': return '完成派送'
      default: return '提交'
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              {mode === 'exception' || mode === 'exception_handle' ? (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              ) : (
                <Truck className="w-4 h-4 text-primary-600" />
              )}
              {mode === 'exception' ? '标记异常' : mode === 'exception_handle' ? '异常处理' : '派送操作'} - {billNumber}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{getStepTitle()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 步骤指示器 - 仅在正常模式显示 */}
        {mode === 'normal' && (
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center">
              {(['pickup', 'arrival', 'delivered', 'unloading', 'confirm'] as CMRStep[]).map((s, index) => {
                const stepLabels = ['提货', '到达', '送达', '卸货', '确认']
                const status = getStepStatus(s)
                const isLastStep = index === 4
                return (
                  <div key={s} className={`flex items-center ${isLastStep ? '' : 'flex-1'}`}>
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                      status === 'active' ? 'bg-primary-600 text-white' :
                      status === 'completed' ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {status === 'completed' ? '✓' : index + 1}
                    </div>
                    <span className={`ml-1 text-[10px] flex-shrink-0 ${status === 'active' ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                      {stepLabels[index]}
                    </span>
                    {!isLastStep && (
                      <div className={`flex-1 h-0.5 mx-2 min-w-[20px] ${status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* 异常报告模式 */}
          {mode === 'exception' && (
            <div className="space-y-3">
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  标记订单异常
                </div>
                <p className="text-[10px] text-red-600">
                  标记异常后，订单将转移到"订单异常"列表，需要进行异常处理。
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  异常说明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={exceptionNote}
                  onChange={(e) => setExceptionNote(e.target.value)}
                  placeholder="请详细描述异常情况..."
                  rows={4}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* 异常处理模式 */}
          {mode === 'exception_handle' && (
            <div className="space-y-3">
              {/* 异常记录历史 */}
              {cmrDetail?.exceptionRecords && cmrDetail.exceptionRecords.length > 0 && (
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs font-medium text-gray-700 mb-2">异常处理记录</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {cmrDetail.exceptionRecords.map((record) => (
                      <div key={record.id} className="flex items-start gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          record.action === 'report' ? 'bg-red-100 text-red-600' :
                          record.action === 'followup' ? 'bg-orange-100 text-orange-600' :
                          record.action === 'resolve' ? 'bg-green-100 text-green-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {record.actionLabel}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-700">{record.note}</p>
                          <p className="text-[10px] text-gray-400">{new Date(record.time).toLocaleString('zh-CN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 当前异常状态 */}
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    当前异常状态
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    cmrDetail?.exceptionStatus === 'open' ? 'bg-red-100 text-red-600' :
                    cmrDetail?.exceptionStatus === 'following' ? 'bg-orange-100 text-orange-600' :
                    cmrDetail?.exceptionStatus === 'resolved' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {cmrDetail?.exceptionStatus === 'open' ? '待处理' :
                     cmrDetail?.exceptionStatus === 'following' ? '跟进中' :
                     cmrDetail?.exceptionStatus === 'resolved' ? '已解决' : '已关闭'}
                  </span>
                </div>
                {cmrDetail?.exceptionNote && (
                  <p className="text-xs text-red-600 mt-1">{cmrDetail.exceptionNote}</p>
                )}
              </div>

              {/* 处理操作选择 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">选择处理方式</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exceptionAction"
                      value="followup"
                      checked={exceptionAction === 'followup'}
                      onChange={() => setExceptionAction('followup')}
                      className="w-3.5 h-3.5 text-orange-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-orange-600">继续跟进</span>
                      <p className="text-[10px] text-gray-500">记录跟进情况，继续处理异常</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exceptionAction"
                      value="continue"
                      checked={exceptionAction === 'continue'}
                      onChange={() => setExceptionAction('continue')}
                      className="w-3.5 h-3.5 text-green-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-green-600">解决并继续派送</span>
                      <p className="text-[10px] text-gray-500">异常已解决，恢复正常派送流程</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exceptionAction"
                      value="resolve"
                      checked={exceptionAction === 'resolve'}
                      onChange={() => setExceptionAction('resolve')}
                      className="w-3.5 h-3.5 text-blue-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-blue-600">标记已解决</span>
                      <p className="text-[10px] text-gray-500">异常已解决但不继续派送</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exceptionAction"
                      value="close"
                      checked={exceptionAction === 'close'}
                      onChange={() => setExceptionAction('close')}
                      className="w-3.5 h-3.5 text-gray-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-gray-600">关闭订单</span>
                      <p className="text-[10px] text-gray-500">无法处理，直接关闭订单</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 处理说明 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  处理说明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={exceptionNote}
                  onChange={(e) => setExceptionNote(e.target.value)}
                  placeholder="请填写处理说明..."
                  rows={3}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* 正常派送模式 */}
          {mode === 'normal' && (
            <>
              {/* 步骤1: 预计提货 */}
              {step === 'pickup' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      预计提货时间 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={estimatedPickupTime}
                        onChange={(e) => setEstimatedPickupTime(e.target.value)}
                        className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Truck className="w-3 h-3 inline mr-1" />
                      服务商 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative" ref={providerDropdownRef}>
                      <div className="relative">
                        <input
                          type="text"
                          value={showProviderDropdown ? providerSearchText : serviceProvider}
                          onChange={(e) => {
                            setProviderSearchText(e.target.value)
                            setServiceProvider(e.target.value)
                            setShowProviderDropdown(true)
                          }}
                          onFocus={() => {
                            setProviderSearchText(serviceProvider)
                            setShowProviderDropdown(true)
                          }}
                          placeholder="输入或选择服务商"
                          className="w-full px-2 py-1 pr-7 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {showProviderDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
                          {serviceProviderList
                            .filter(p => 
                              !providerSearchText || 
                              p.providerName.toLowerCase().includes(providerSearchText.toLowerCase()) ||
                              p.providerCode.toLowerCase().includes(providerSearchText.toLowerCase())
                            )
                            .map(provider => (
                              <div
                                key={provider.id}
                                className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-primary-50 ${
                                  serviceProvider === provider.providerName ? 'bg-primary-100 text-primary-700' : 'text-gray-700'
                                }`}
                                onClick={() => {
                                  setServiceProvider(provider.providerName)
                                  setProviderSearchText('')
                                  setShowProviderDropdown(false)
                                }}
                              >
                                <div className="font-medium">{provider.providerName}</div>
                                <div className="text-gray-400 text-[10px]">{provider.providerCode} · {provider.serviceType}</div>
                              </div>
                            ))
                          }
                          {serviceProviderList.filter(p => 
                            !providerSearchText || 
                            p.providerName.toLowerCase().includes(providerSearchText.toLowerCase()) ||
                            p.providerCode.toLowerCase().includes(providerSearchText.toLowerCase())
                          ).length === 0 && (
                            <div className="px-2 py-2 text-xs text-gray-400 text-center">
                              {providerSearchText ? '无匹配结果，可直接使用输入的名称' : '暂无服务商数据'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                    <textarea
                      value={pickupNote}
                      onChange={(e) => setPickupNote(e.target.value)}
                      placeholder="可选填写备注信息..."
                      rows={2}
                      className="w-full px-2 py-10 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 步骤2: 预计到达 */}
              {step === 'arrival' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      送达地址 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="请输入完整送达地址..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      预计到达时间 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={estimatedArrivalTime}
                        onChange={(e) => setEstimatedArrivalTime(e.target.value)}
                        className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                    <textarea
                      value={arrivalNote}
                      onChange={(e) => setArrivalNote(e.target.value)}
                      placeholder="可选填写备注信息..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 步骤3: 送达时间 */}
              {step === 'delivered' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      实际送达时间 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={actualArrivalTime}
                        onChange={(e) => setActualArrivalTime(e.target.value)}
                        className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  {(estimatedArrivalTime || deliveryAddress) && (
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-[10px] text-gray-500 mb-1">预计信息</p>
                      {deliveryAddress && (
                        <p className="text-xs text-gray-700 mb-0.5">
                          <MapPin className="w-3 h-3 inline mr-1 text-gray-400" />
                          {deliveryAddress}
                        </p>
                      )}
                      {estimatedArrivalTime && (
                        <p className="text-xs text-gray-700">
                          <Calendar className="w-3 h-3 inline mr-1 text-gray-400" />
                          预计: {new Date(estimatedArrivalTime).toLocaleString('zh-CN')}
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                    <textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="可选填写备注信息..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 步骤4: 卸货完成 */}
              {step === 'unloading' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      <Package className="w-3 h-3 inline mr-1" />
                      卸货完成时间 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={unloadingCompleteTime}
                        onChange={(e) => setUnloadingCompleteTime(e.target.value)}
                        className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                      <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  {actualArrivalTime && (
                    <div className="p-2 bg-green-50 rounded">
                      <p className="text-[10px] text-green-600 mb-0.5">已送达</p>
                      <p className="text-xs text-green-700">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(actualArrivalTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                    <textarea
                      value={unloadingNote}
                      onChange={(e) => setUnloadingNote(e.target.value)}
                      placeholder="可选填写备注信息..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 步骤5: 确认送达 */}
              {step === 'confirm' && (
                <div className="space-y-3">
                  <div className="p-2 bg-blue-50 rounded">
                    <div className="flex items-center gap-1.5 text-blue-700 font-medium text-xs mb-2">
                      <CheckCircle className="w-3 h-3" />
                      派送流程摘要
                    </div>
                    <div className="space-y-1 text-xs">
                      {serviceProvider && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">服务商：</span>
                          <span className="font-medium">{serviceProvider}</span>
                        </div>
                      )}
                      {estimatedPickupTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">预计提货：</span>
                          <span className="font-medium">{new Date(estimatedPickupTime).toLocaleString('zh-CN')}</span>
                        </div>
                      )}
                      {deliveryAddress && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">送达地址：</span>
                          <span className="font-medium text-right max-w-[200px] truncate">{deliveryAddress}</span>
                        </div>
                      )}
                      {actualArrivalTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">实际送达：</span>
                          <span className="font-medium text-green-600">{new Date(actualArrivalTime).toLocaleString('zh-CN')}</span>
                        </div>
                      )}
                      {unloadingCompleteTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">卸货完成：</span>
                          <span className="font-medium">{new Date(unloadingCompleteTime).toLocaleString('zh-CN')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">确认备注</label>
                    <textarea
                      value={confirmNote}
                      onChange={(e) => setConfirmNote(e.target.value)}
                      placeholder="可选填写最终确认备注..."
                      rows={2}
                      className="w-full px-2 py-10 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                  
                  <div className="p-2 bg-yellow-50 rounded">
                    <p className="text-[10px] text-yellow-700">
                      <strong>注意：</strong>确认送达后，订单将移至归档，派送流程完成。
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          {mode === 'exception' ? (
            <>
              <button
                onClick={() => setMode('normal')}
                className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleExceptionSubmit}
                disabled={loading}
                className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认异常'}
              </button>
            </>
          ) : mode === 'exception_handle' ? (
            <>
              <button
                onClick={onClose}
                className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleExceptionAction}
                disabled={loading}
                className={`px-2 py-1 text-xs text-white rounded disabled:opacity-50 ${
                  exceptionAction === 'close' ? 'bg-gray-600 hover:bg-gray-700' :
                  exceptionAction === 'continue' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {loading ? '处理中...' : 
                  exceptionAction === 'followup' ? '提交跟进' :
                  exceptionAction === 'continue' ? '继续派送' :
                  exceptionAction === 'resolve' ? '标记解决' : '关闭订单'
                }
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => setMode('exception')}
                  className="px-2 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  异常
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {step !== 'pickup' && (
                  <button
                    onClick={() => {
                      const steps: CMRStep[] = ['pickup', 'arrival', 'delivered', 'unloading', 'confirm']
                      const currentIndex = steps.indexOf(step)
                      if (currentIndex > 0) {
                        setStep(steps[currentIndex - 1])
                      }
                    }}
                    className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    上一步
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-2 py-1 text-xs text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '处理中...' : getSubmitButtonText()}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
