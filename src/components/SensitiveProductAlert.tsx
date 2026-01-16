/**
 * 敏感产品预警组件
 * 用于查验时检查货物是否在敏感产品库中，并提供添加申请功能
 */

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, Shield, Plus, X, Check, Loader2, 
  AlertCircle, CheckCircle, Info
} from 'lucide-react'
import { 
  checkInspectionItemsForSensitive, 
  createSensitiveProductApproval,
  type SensitiveAlertItem,
  type SensitiveAlertCheckResult
} from '../utils/api'

interface SensitiveProductAlertProps {
  items: SensitiveAlertItem[]
  billId: string
  billNumber: string
  onApprovalCreated?: () => void
  className?: string
}

export default function SensitiveProductAlert({
  items,
  billId,
  billNumber,
  onApprovalCreated,
  className = ''
}: SensitiveProductAlertProps) {
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<SensitiveAlertCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 添加审批弹窗
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SensitiveAlertItem[]>([])

  // 当 items 变化时，检查敏感产品
  useEffect(() => {
    const validItems = items.filter(item => item.hsCode?.trim() || item.productName?.trim())
    if (validItems.length === 0) {
      setCheckResult(null)
      return
    }

    const checkItems = async () => {
      setChecking(true)
      setError(null)
      try {
        const response = await checkInspectionItemsForSensitive(validItems)
        if (response.errCode === 200 && response.data) {
          setCheckResult(response.data)
        } else {
          setError(response.msg || '检查失败')
        }
      } catch (err) {
        console.error('检查敏感产品失败:', err)
        setError('检查敏感产品失败')
      } finally {
        setChecking(false)
      }
    }

    // 防抖处理
    const timer = setTimeout(checkItems, 500)
    return () => clearTimeout(timer)
  }, [items])

  // 打开添加弹窗
  const handleOpenAddModal = () => {
    if (checkResult?.newItems) {
      setSelectedItems([...checkResult.newItems])
      setShowAddModal(true)
    }
  }

  // 切换选择
  const toggleSelectItem = (item: SensitiveAlertItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => 
        i.hsCode === item.hsCode && i.productName === item.productName
      )
      if (exists) {
        return prev.filter(i => 
          !(i.hsCode === item.hsCode && i.productName === item.productName)
        )
      } else {
        return [...prev, item]
      }
    })
  }

  // 提交审批申请
  const handleSubmitApproval = async () => {
    if (selectedItems.length === 0) {
      alert('请选择要添加的产品')
      return
    }

    setSubmitting(true)
    try {
      const response = await createSensitiveProductApproval({
        billId,
        billNumber,
        items: selectedItems
      })
      
      if (response.errCode === 200) {
        alert('审批申请已提交，等待审批')
        setShowAddModal(false)
        setSelectedItems([])
        onApprovalCreated?.()
      } else {
        alert(response.msg || '提交失败')
      }
    } catch (err) {
      console.error('提交审批失败:', err)
      alert('提交审批失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 如果没有数据，不显示
  if (!checkResult && !checking && !error) {
    return null
  }

  return (
    <div className={className}>
      {/* 检查中状态 */}
      {checking && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          正在检查敏感产品库...
        </div>
      )}

      {/* 错误状态 */}
      {error && !checking && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* 检查结果 */}
      {checkResult && !checking && (
        <div className="space-y-2">
          {/* 有新产品（不在敏感产品库中） */}
          {checkResult.hasNewProducts && (
            <div className="border border-amber-200 rounded-lg bg-amber-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-100">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    敏感产品库预警
                  </span>
                  <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded">
                    {checkResult.newItems.length} 个新产品
                  </span>
                </div>
                <button
                  onClick={handleOpenAddModal}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  申请添加
                </button>
              </div>
              <div className="px-3 py-2 text-xs text-amber-800">
                <p className="mb-1.5">以下查验货物不在敏感产品库中，建议添加：</p>
                <ul className="space-y-1">
                  {checkResult.newItems.map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-4 h-4 bg-amber-200 rounded-full flex items-center justify-center text-[10px] text-amber-700">
                        {index + 1}
                      </span>
                      <span className="font-mono text-amber-600">{item.hsCode || '-'}</span>
                      <span className="text-amber-800">{item.productName}</span>
                      {item.material && (
                        <span className="text-amber-600">({item.material})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 已存在的产品（在敏感产品库中） */}
          {checkResult.existingItems.length > 0 && (
            <div className="border border-green-200 rounded-lg bg-green-50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">
                  已匹配敏感产品
                </span>
                <span className="text-[10px] bg-green-200 px-1.5 py-0.5 rounded">
                  {checkResult.existingItems.length} 个
                </span>
              </div>
              <div className="px-3 py-2 text-xs">
                <ul className="space-y-1">
                  {checkResult.existingItems.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="font-mono text-green-600">{item.hsCode || '-'}</span>
                      <span>{item.productName}</span>
                      <span className="text-green-500">→</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        item.matchedProduct.risk_level === 'high' 
                          ? 'bg-red-100 text-red-600' 
                          : item.matchedProduct.risk_level === 'medium'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {item.matchedProduct.risk_level === 'high' ? '高风险' : 
                         item.matchedProduct.risk_level === 'medium' ? '中风险' : '低风险'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 全部都在库中 */}
          {!checkResult.hasNewProducts && checkResult.existingItems.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-600">
              <Info className="w-3.5 h-3.5" />
              所有查验货物都在敏感产品库中
            </div>
          )}
        </div>
      )}

      {/* 添加审批弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  申请添加到敏感产品库
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs text-gray-600">
                <p>提单号：<span className="font-medium text-gray-900">{billNumber}</span></p>
                <p className="mt-1">选择要添加到敏感产品库的产品：</p>
              </div>

              <div className="space-y-2">
                {checkResult?.newItems.map((item, index) => {
                  const isSelected = selectedItems.some(i => 
                    i.hsCode === item.hsCode && i.productName === item.productName
                  )
                  return (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary-600">
                            {item.hsCode || '-'}
                          </span>
                          <span className="text-xs text-gray-900">{item.productName}</span>
                        </div>
                        {item.material && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            材质：{item.material}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="p-2 bg-amber-50 rounded-lg text-[10px] text-amber-700">
                <p><strong>提示：</strong>提交后将发送审批给运营经理，审批通过后产品会自动添加到查验产品库，同时通知老板。</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">
                已选择 {selectedItems.length} 个产品
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitApproval}
                  disabled={submitting || selectedItems.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      提交审批
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
