import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Package, Calendar, ClipboardCheck, CheckCircle } from 'lucide-react'

// 查验货物项
export interface InspectionItem {
  id: string
  hsCode: string
  productName: string
  quantity?: number
  unit?: string
}

// 查验详情
export interface InspectionDetail {
  items: InspectionItem[]
  estimatedTime?: string
  actualStartTime?: string
  actualEndTime?: string
  result?: 'pass' | 'second_inspection' | 'fail'
  resultNote?: string
  releaseTime?: string
  confirmedTime?: string
}

interface InspectionModalProps {
  visible: boolean
  onClose: () => void
  billNumber: string
  currentStatus: string
  inspectionDetail?: InspectionDetail
  onSubmit: (data: {
    status: string
    detail: InspectionDetail
  }) => Promise<void>
}

// 生成唯一ID
const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export default function InspectionModal({
  visible,
  onClose,
  billNumber,
  currentStatus,
  inspectionDetail,
  onSubmit,
}: InspectionModalProps) {
  // 当前步骤
  const [step, setStep] = useState<'items' | 'schedule' | 'result' | 'release' | 'confirm'>('items')
  const [loading, setLoading] = useState(false)
  
  // 查验货物列表
  const [items, setItems] = useState<InspectionItem[]>([
    { id: generateId(), hsCode: '', productName: '' }
  ])
  
  // 预计查验时间
  const [estimatedTime, setEstimatedTime] = useState('')
  
  // 查验结果
  const [result, setResult] = useState<'pass' | 'second_inspection' | 'fail'>('pass')
  const [resultNote, setResultNote] = useState('')
  
  // 放行时间
  const [releaseTime, setReleaseTime] = useState('')

  // 初始化数据
  useEffect(() => {
    if (visible && inspectionDetail) {
      if (inspectionDetail.items?.length > 0) {
        setItems(inspectionDetail.items)
      }
      if (inspectionDetail.estimatedTime) {
        setEstimatedTime(inspectionDetail.estimatedTime)
      }
      if (inspectionDetail.result) {
        setResult(inspectionDetail.result)
      }
      if (inspectionDetail.resultNote) {
        setResultNote(inspectionDetail.resultNote)
      }
      if (inspectionDetail.releaseTime) {
        setReleaseTime(inspectionDetail.releaseTime)
      }
    }
    
    // 根据当前状态设置初始步骤
    if (currentStatus === '待查验') {
      setStep('items')
    } else if (currentStatus === '查验中') {
      setStep('result')
    } else if (currentStatus === '已查验') {
      setStep('release')
    } else if (currentStatus === '查验放行') {
      setStep('confirm')
    }
  }, [visible, inspectionDetail, currentStatus])

  // 重置表单
  useEffect(() => {
    if (!visible) {
      setItems([{ id: generateId(), hsCode: '', productName: '' }])
      setEstimatedTime('')
      setResult('pass')
      setResultNote('')
      setReleaseTime('')
      setLoading(false)
    }
  }, [visible])

  // 添加货物项
  const addItem = () => {
    setItems([...items, { id: generateId(), hsCode: '', productName: '' }])
  }

  // 删除货物项
  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  // 更新货物项
  const updateItem = (id: string, field: keyof InspectionItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // 获取步骤标题
  const getStepTitle = () => {
    switch (step) {
      case 'items': return '第一步：选择查验货物'
      case 'schedule': return '第二步：设置预计查验时间'
      case 'result': return '第三步：录入查验结果'
      case 'release': return '第四步：查验放行'
      case 'confirm': return '第五步：确认放行'
      default: return '查验'
    }
  }

  // 获取下一步操作
  const getNextAction = () => {
    switch (step) {
      case 'items': return { label: '下一步', nextStep: 'schedule' as const }
      case 'schedule': return { label: '开始查验', nextStep: null, status: '查验中' }
      case 'result': return { label: '提交结果', nextStep: null, status: result === 'second_inspection' ? '待查验' : '已查验' }
      case 'release': return { label: '查验放行', nextStep: null, status: '查验放行' }
      case 'confirm': return { label: '确认放行', nextStep: null, status: '已放行' }
      default: return null
    }
  }

  // 处理提交
  const handleSubmit = async () => {
    const action = getNextAction()
    if (!action) return

    // 验证
    if (step === 'items') {
      const validItems = items.filter(item => item.hsCode.trim() && item.productName.trim())
      if (validItems.length === 0) {
        alert('请至少填写一个查验货物')
        return
      }
    }

    if (step === 'schedule' && !estimatedTime) {
      alert('请选择预计查验时间')
      return
    }

    if (step === 'result' && result === 'second_inspection' && !resultNote) {
      alert('请填写需要二次查验的原因')
      return
    }

    if (step === 'release' && !releaseTime) {
      alert('请选择查验放行时间')
      return
    }

    // 如果是下一步，直接切换
    if (action.nextStep) {
      setStep(action.nextStep)
      return
    }

    // 提交到服务器
    setLoading(true)
    try {
      const detail: InspectionDetail = {
        items: items.filter(item => item.hsCode.trim() && item.productName.trim()),
        estimatedTime,
        actualStartTime: step === 'schedule' ? new Date().toISOString() : inspectionDetail?.actualStartTime,
        actualEndTime: step === 'result' ? new Date().toISOString() : inspectionDetail?.actualEndTime,
        result: step === 'result' ? result : inspectionDetail?.result,
        resultNote: step === 'result' ? resultNote : inspectionDetail?.resultNote,
        releaseTime: step === 'release' ? releaseTime : inspectionDetail?.releaseTime,
        confirmedTime: step === 'confirm' ? new Date().toISOString() : inspectionDetail?.confirmedTime,
      }

      await onSubmit({
        status: action.status!,
        detail,
      })
      onClose()
    } catch (error) {
      console.error('提交失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setLoading(false)
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
              <ClipboardCheck className="w-4 h-4 text-primary-600" />
              查验操作 - {billNumber}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{getStepTitle()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center">
            {['items', 'schedule', 'result', 'release', 'confirm'].map((s, index) => {
              const stepLabels = ['货物', '时间', '结果', '放行', '确认']
              const isActive = step === s
              const isPast = ['items', 'schedule', 'result', 'release', 'confirm'].indexOf(step) > index
              const isLastStep = index === 4
              return (
                <div key={s} className={`flex items-center ${isLastStep ? '' : 'flex-1'}`}>
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                    isActive ? 'bg-primary-600 text-white' :
                    isPast ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {isPast ? '✓' : index + 1}
                  </div>
                  <span className={`ml-1 text-[10px] flex-shrink-0 ${isActive ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                    {stepLabels[index]}
                  </span>
                  {!isLastStep && (
                    <div className={`flex-1 h-0.5 mx-1 ${isPast ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* 第一步：查验货物 */}
          {step === 'items' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">
                  查验货物列表 <span className="text-red-500">*</span>
                </label>
                <button
                  onClick={addItem}
                  className="flex items-center gap-0.5 text-xs text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-3 h-3" />
                  添加
                </button>
              </div>
              
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                    <div className="flex-shrink-0 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[10px] text-gray-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">HS Code</label>
                        <input
                          type="text"
                          value={item.hsCode}
                          onChange={(e) => updateItem(item.id, 'hsCode', e.target.value)}
                          placeholder="输入HS编码"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">品名</label>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                          placeholder="输入品名"
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        />
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex-shrink-0 p-1 text-red-500 hover:bg-red-50 rounded"
                        title="删除货物"
                        aria-label="删除货物"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 第二步：预计查验时间 */}
          {step === 'schedule' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  预计查验时间 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="estimatedTimeInput"
                    type="datetime-local"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                    title="选择预计查验时间"
                    aria-label="预计查验时间"
                    className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar 
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer hover:text-primary-600 transition-colors" 
                    onClick={() => (document.getElementById('estimatedTimeInput') as HTMLInputElement)?.showPicker?.()}
                  />
                </div>
              </div>
              
              {/* 显示已选择的货物 */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Package className="w-3 h-3 inline mr-1" />
                  待查验货物
                </label>
                <div className="bg-gray-50 rounded p-2 space-y-1">
                  {items.filter(item => item.hsCode && item.productName).map((item, index) => (
                    <div key={item.id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500">{index + 1}.</span>
                      <span className="font-mono text-primary-600">{item.hsCode}</span>
                      <span className="text-gray-400">-</span>
                      <span>{item.productName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 第三步：查验结果 */}
          {step === 'result' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  查验结果 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="result"
                      value="pass"
                      checked={result === 'pass'}
                      onChange={() => setResult('pass')}
                      className="w-3.5 h-3.5 text-green-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-green-600">查验通过</span>
                      <p className="text-[10px] text-gray-500">货物查验合格，可以进入放行流程</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="result"
                      value="second_inspection"
                      checked={result === 'second_inspection'}
                      onChange={() => setResult('second_inspection')}
                      className="w-3.5 h-3.5 text-orange-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-orange-600">需要二次查验</span>
                      <p className="text-[10px] text-gray-500">存在问题需要再次查验</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="result"
                      value="fail"
                      checked={result === 'fail'}
                      onChange={() => setResult('fail')}
                      className="w-3.5 h-3.5 text-red-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-red-600">查验不通过</span>
                      <p className="text-[10px] text-gray-500">货物查验不合格</p>
                    </div>
                  </label>
                </div>
              </div>

              {(result === 'second_inspection' || result === 'fail') && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {result === 'second_inspection' ? '二次查验原因' : '不通过原因'} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    placeholder={result === 'second_inspection' ? '请说明需要二次查验的原因...' : '请说明查验不通过的原因...'}
                    rows={3}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* 第四步：查验放行 */}
          {step === 'release' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  查验放行时间 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="releaseTimeInput"
                    type="datetime-local"
                    value={releaseTime}
                    onChange={(e) => setReleaseTime(e.target.value)}
                    title="选择查验放行时间"
                    aria-label="查验放行时间"
                    className="w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar 
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer hover:text-primary-600 transition-colors" 
                    onClick={() => (document.getElementById('releaseTimeInput') as HTMLInputElement)?.showPicker?.()}
                  />
                </div>
              </div>
              
              {/* 显示查验结果摘要 */}
              <div className="p-2 bg-green-50 rounded">
                <div className="flex items-center gap-1.5 text-green-700 font-medium text-xs mb-1">
                  <CheckCircle className="w-3 h-3" />
                  查验已通过
                </div>
                <p className="text-[10px] text-green-600">
                  货物查验合格，请设置放行时间。
                </p>
              </div>
            </div>
          )}

          {/* 第五步：确认放行 */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="p-2 bg-blue-50 rounded">
                <div className="flex items-center gap-1.5 text-blue-700 font-medium text-xs mb-2">
                  <ClipboardCheck className="w-3 h-3" />
                  查验流程摘要
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">查验货物数量：</span>
                    <span className="font-medium">{items.filter(i => i.hsCode && i.productName).length} 项</span>
                  </div>
                  {estimatedTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">预计查验时间：</span>
                      <span className="font-medium">{new Date(estimatedTime).toLocaleString('zh-CN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">查验结果：</span>
                    <span className="font-medium text-green-600">通过</span>
                  </div>
                  {releaseTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">放行时间：</span>
                      <span className="font-medium">{new Date(releaseTime).toLocaleString('zh-CN')}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-2 bg-yellow-50 rounded">
                <p className="text-[10px] text-yellow-700">
                  <strong>注意：</strong>确认放行后，查验流程将完成，状态变更为"已放行"。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          
          <div className="flex items-center gap-2">
            {step !== 'items' && (
              <button
                onClick={() => {
                  const steps: Array<'items' | 'schedule' | 'result' | 'release' | 'confirm'> = ['items', 'schedule', 'result', 'release', 'confirm']
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
              {loading ? '处理中...' : getNextAction()?.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
