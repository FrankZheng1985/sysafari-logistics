import { useState, useEffect } from 'react'
import { X, AlertTriangle, Plus, Trash2, Check, FileText, DollarSign, Clock, CheckCircle, Ship, FileCheck, Truck, Package, Edit, Ban } from 'lucide-react'

interface VoidApplyModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
  billId: string
  billNumber: string
}

interface Fee {
  id?: string
  category: string
  feeName: string
  amount: number
  currency: string
  isNew?: boolean
  selected?: boolean
}

interface ExistingFee {
  id: string
  feeName: string
  amount: number
  currency: string
  category: string
  feeDate: string
}

interface OperationLog {
  id: string
  operationType: string
  operationName: string
  oldValue: string
  newValue: string
  remark: string
  operator: string
  operationTime: string
}

// 关键节点配置
const KEY_MILESTONES: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; order: number }> = {
  '创建订单': { label: '创建订单', icon: Plus, color: 'text-green-600', bgColor: 'bg-green-100', order: 1 },
  '已到港': { label: '已到港', icon: Ship, color: 'text-cyan-600', bgColor: 'bg-cyan-100', order: 2 },
  '已放行': { label: '清关放行', icon: FileCheck, color: 'text-purple-600', bgColor: 'bg-purple-100', order: 3 },
  '换单': { label: '换单完成', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100', order: 4 },
  '查验': { label: '海关查验', icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-100', order: 5 },
  '已安排运输': { label: '已安排运输', icon: Truck, color: 'text-indigo-600', bgColor: 'bg-indigo-100', order: 6 },
  '派送中': { label: '派送中', icon: Truck, color: 'text-indigo-600', bgColor: 'bg-indigo-100', order: 7 },
  '已送达': { label: '已送达', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', order: 8 },
  '仓储': { label: '仓储中', icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100', order: 9 },
  '单据': { label: '单据制作', icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100', order: 10 },
}

// 从操作日志中提取关键节点
function extractKeyMilestones(logs: OperationLog[]): { key: string; label: string; icon: React.ElementType; color: string; bgColor: string; date: string; order: number }[] {
  const milestones: Map<string, { key: string; label: string; icon: React.ElementType; color: string; bgColor: string; date: string; order: number }> = new Map()
  
  // 按时间正序处理日志
  const sortedLogs = [...logs].reverse()
  
  for (const log of sortedLogs) {
    const operationName = log.operationName || ''
    const newValue = log.newValue || ''
    const operationType = log.operationType || ''
    
    // 创建订单
    if (operationType === 'create' || operationName.includes('创建')) {
      if (!milestones.has('创建订单')) {
        milestones.set('创建订单', {
          key: '创建订单',
          ...KEY_MILESTONES['创建订单'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 已到港
    if (newValue === '已到港' || operationName.includes('到港')) {
      if (!milestones.has('已到港')) {
        milestones.set('已到港', {
          key: '已到港',
          ...KEY_MILESTONES['已到港'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 清关放行
    if (newValue === '已放行' || operationName.includes('放行') || operationName.includes('清关')) {
      if (!milestones.has('已放行')) {
        milestones.set('已放行', {
          key: '已放行',
          ...KEY_MILESTONES['已放行'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 换单
    if (operationName.includes('换单') || newValue.includes('换单')) {
      if (!milestones.has('换单')) {
        milestones.set('换单', {
          key: '换单',
          ...KEY_MILESTONES['换单'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 查验
    if (operationName.includes('查验') || newValue.includes('查验')) {
      if (!milestones.has('查验')) {
        milestones.set('查验', {
          key: '查验',
          ...KEY_MILESTONES['查验'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 派送相关
    if (newValue === '派送中' || operationName.includes('派送')) {
      if (!milestones.has('派送中')) {
        milestones.set('派送中', {
          key: '派送中',
          ...KEY_MILESTONES['派送中'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 已送达
    if (newValue === '已送达' || operationName.includes('送达')) {
      if (!milestones.has('已送达')) {
        milestones.set('已送达', {
          key: '已送达',
          ...KEY_MILESTONES['已送达'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 仓储
    if (operationName.includes('仓储') || newValue.includes('仓储')) {
      if (!milestones.has('仓储')) {
        milestones.set('仓储', {
          key: '仓储',
          ...KEY_MILESTONES['仓储'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
    
    // 单据
    if (operationName.includes('单据') || operationName.includes('文件')) {
      if (!milestones.has('单据')) {
        milestones.set('单据', {
          key: '单据',
          ...KEY_MILESTONES['单据'],
          date: log.operationTime?.split(' ')[0] || ''
        })
      }
    }
  }
  
  // 按 order 排序返回
  return Array.from(milestones.values()).sort((a, b) => a.order - b.order)
}

const FEE_CATEGORIES = [
  { value: 'freight', label: '运费' },
  { value: 'customs', label: '关税' },
  { value: 'warehouse', label: '仓储费' },
  { value: 'insurance', label: '保险费' },
  { value: 'handling', label: '操作费' },
  { value: 'documentation', label: '文件费' },
  { value: 'other', label: '其他费用' },
]

export default function VoidApplyModal({
  visible,
  onClose,
  onSuccess,
  billId,
  billNumber
}: VoidApplyModalProps) {
  const [step, setStep] = useState(1) // 1: 填写原因, 2: 费用确认
  const [reason, setReason] = useState('')
  const [existingFees, setExistingFees] = useState<ExistingFee[]>([])
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([])
  const [newFees, setNewFees] = useState<Fee[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 操作日志
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // 新增费用表单
  const [newFeeForm, setNewFeeForm] = useState({
    category: 'handling',
    feeName: '',
    amount: '',
    currency: 'EUR'
  })

  // 重置状态
  useEffect(() => {
    if (visible) {
      setStep(1)
      setReason('')
      setSelectedFeeIds([])
      setNewFees([])
      loadOperationLogs()
      setError('')
      loadExistingFees()
    }
  }, [visible, billId])

  // 加载操作日志
  const loadOperationLogs = async () => {
    setLogsLoading(true)
    try {
      const response = await fetch(`/api/bills/${billId}/logs`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setOperationLogs(data.data)
      }
    } catch (err) {
      console.error('加载操作日志失败:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  // 加载已有费用
  const loadExistingFees = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/fees?billId=${billId}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        // API 返回 { list: [], total: ... } 格式
        const feesList = Array.isArray(data.data) ? data.data : (data.data.list || [])
        setExistingFees(feesList)
        // 默认全选已有费用
        setSelectedFeeIds(feesList.map((f: ExistingFee) => f.id))
      }
    } catch (err) {
      console.error('加载费用失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 下一步
  const handleNext = () => {
    if (!reason.trim()) {
      setError('请填写作废原因')
      return
    }
    setError('')
    setStep(2)
  }

  // 上一步
  const handleBack = () => {
    setStep(1)
    setError('')
  }

  // 切换费用选择
  const toggleFeeSelection = (feeId: string) => {
    setSelectedFeeIds(prev => 
      prev.includes(feeId) 
        ? prev.filter(id => id !== feeId)
        : [...prev, feeId]
    )
  }

  // 添加新费用
  const handleAddNewFee = () => {
    if (!newFeeForm.feeName.trim() || !newFeeForm.amount) {
      return
    }
    
    setNewFees(prev => [...prev, {
      category: newFeeForm.category,
      feeName: newFeeForm.feeName,
      amount: parseFloat(newFeeForm.amount),
      currency: newFeeForm.currency,
      isNew: true
    }])
    
    // 重置表单
    setNewFeeForm({
      category: 'handling',
      feeName: '',
      amount: '',
      currency: 'EUR'
    })
  }

  // 删除新费用
  const handleRemoveNewFee = (index: number) => {
    setNewFees(prev => prev.filter((_, i) => i !== index))
  }

  // 提交作废申请
  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    
    try {
      // 准备费用数据
      const selectedExistingFees = existingFees.filter(f => selectedFeeIds.includes(f.id))
      const allFees = [
        ...selectedExistingFees.map(f => ({ ...f, isExisting: true })),
        ...newFees.map(f => ({ ...f, isNew: true }))
      ]
      
      const response = await fetch(`/api/bills/${billId}/void-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          fees: allFees
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('作废申请已提交，等待审批')
        onSuccess?.()
        onClose()
      } else {
        setError(data.msg || '提交失败')
      }
    } catch (err) {
      console.error('提交作废申请失败:', err)
      setError('提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  const getCategoryLabel = (value: string) => {
    return FEE_CATEGORIES.find(c => c.value === value)?.label || value
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">作废申请</h3>
              <p className="text-sm text-gray-500">提单号: {billNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">填写原因</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="text-sm font-medium">确认费用</span>
            </div>
          </div>
          
          {/* 当前步骤说明 */}
          <div className="mt-3 p-3 rounded-lg bg-primary-50 border border-primary-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
              <span className="text-sm font-medium text-primary-700">
                当前步骤 {step}/2：{step === 1 ? '填写作废原因' : '确认相关费用'}
              </span>
            </div>
            <p className="mt-1 text-xs text-primary-600 ml-4">
              {step === 1 
                ? '请详细说明作废该提单的原因，以便审批人员审核。' 
                : '请确认与该提单相关的费用，选择已有费用或添加新的费用记录。'
              }
            </p>
          </div>
        </div>

        {/* 操作日志流程图 */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              订单操作历程
            </h4>
            <span className="text-xs text-gray-400">共 {operationLogs.length} 条操作记录</span>
          </div>
          
          {logsLoading ? (
            <div className="text-center py-3 text-gray-400 text-sm">加载中...</div>
          ) : operationLogs.length === 0 ? (
            <div className="text-center py-3 text-gray-400 text-sm">暂无操作记录</div>
          ) : (
            <div className="relative">
              {/* 横向流程图 - 归类后的关键节点 */}
              <div className="flex items-start gap-0 overflow-x-auto pb-2 scrollbar-thin">
                {extractKeyMilestones(operationLogs).map((milestone, index, arr) => {
                  const IconComponent = milestone.icon
                  const isLast = index === arr.length - 1
                  
                  return (
                    <div key={milestone.key} className="flex items-start flex-shrink-0">
                      {/* 节点 */}
                      <div className="flex flex-col items-center" style={{ minWidth: '90px' }}>
                        <div className={`w-9 h-9 rounded-full ${milestone.bgColor} flex items-center justify-center shadow-sm border-2 border-white`}>
                          <IconComponent className={`w-4 h-4 ${milestone.color}`} />
                        </div>
                        <div className="mt-2 text-center px-1">
                          <p className="text-xs font-medium text-gray-700 whitespace-nowrap">{milestone.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{milestone.date}</p>
                        </div>
                      </div>
                      
                      {/* 连接线 */}
                      {!isLast && (
                        <div className="flex items-center pt-4 px-1">
                          <div className="w-8 h-0.5 bg-gradient-to-r from-gray-300 to-gray-200"></div>
                          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300"></div>
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {/* 作废标记 - 当前进行中 */}
                <div className="flex items-start flex-shrink-0">
                  <div className="flex items-center pt-4 px-1">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-gray-300 to-red-300"></div>
                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-red-300"></div>
                  </div>
                  <div className="flex flex-col items-center" style={{ minWidth: '90px' }}>
                    <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shadow-sm border-2 border-red-300 border-dashed animate-pulse">
                      <Ban className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="mt-2 text-center px-1">
                      <p className="text-xs font-medium text-red-600 whitespace-nowrap">申请作废</p>
                      <p className="text-[10px] text-red-400 mt-0.5">进行中</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-380px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  作废原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请详细说明作废原因..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  rows={4}
                />
              </div>
              
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">注意事项</p>
                    <ul className="list-disc list-inside space-y-1 text-yellow-700">
                      <li>作废申请需要经过上级审批和财务审批</li>
                      <li>下一步需要确认相关费用</li>
                      <li>审批通过后提单将被正式作废</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* 已有费用 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  已有费用记录
                </h4>
                
                {loading ? (
                  <div className="text-center py-4 text-gray-500">加载中...</div>
                ) : existingFees.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无费用记录</div>
                ) : (
                  <div className="space-y-2">
                    {existingFees.map((fee) => (
                      <label
                        key={fee.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFeeIds.includes(fee.id)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedFeeIds.includes(fee.id)}
                            onChange={() => toggleFeeSelection(fee.id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                          <div>
                            <span className="font-medium text-gray-900">{fee.feeName}</span>
                            <span className="ml-2 text-xs text-gray-500">({getCategoryLabel(fee.category)})</span>
                          </div>
                        </div>
                        <span className="font-medium text-gray-900">
                          {fee.currency} {fee.amount.toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 新增费用 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  新增费用
                </h4>
                
                {/* 已添加的新费用 */}
                {newFees.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newFees.map((fee, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-900">{fee.feeName}</span>
                          <span className="ml-2 text-xs text-gray-500">({getCategoryLabel(fee.category)})</span>
                          <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">新增</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {fee.currency} {fee.amount.toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleRemoveNewFee(index)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 新增费用表单 */}
                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">费用类别</label>
                      <select
                        value={newFeeForm.category}
                        onChange={(e) => setNewFeeForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                      >
                        {FEE_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">费用名称</label>
                      <input
                        type="text"
                        value={newFeeForm.feeName}
                        onChange={(e) => setNewFeeForm(prev => ({ ...prev, feeName: e.target.value }))}
                        placeholder="如：查验费"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">金额</label>
                      <input
                        type="number"
                        value={newFeeForm.amount}
                        onChange={(e) => setNewFeeForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">币种</label>
                      <select
                        value={newFeeForm.currency}
                        onChange={(e) => setNewFeeForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="CNY">CNY</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddNewFee}
                    disabled={!newFeeForm.feeName.trim() || !newFeeForm.amount}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    添加费用
                  </button>
                </div>
              </div>

              {/* 费用汇总 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">已选费用: {selectedFeeIds.length} 项</span>
                  <span className="text-gray-600">新增费用: {newFees.length} 项</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {step === 2 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                上一步
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            {step === 1 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                下一步
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? '提交中...' : '提交作废申请'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
