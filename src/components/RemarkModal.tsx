import { useState, useEffect } from 'react'
import { Tag } from 'lucide-react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'

interface Remark {
  id: string
  remark: string
  createUserName: string
  createTime: string
  isAsl?: boolean
}

interface RemarkModalProps {
  visible: boolean
  onClose: () => void
  billNo: string
  billId: string
  remarks?: Remark[]
  role?: 'asl' | 'normal'
  onSubmit?: (remark: string) => Promise<void>
}

const quickTags = [
  { label: '港清', color: 'green' },
  { label: '资料已发', color: 'magenta' },
  { label: '已开票', color: 'volcano' },
  { label: '自提', color: 'gold' },
  { label: '仅清关', color: 'green' },
  { label: '已到账', color: 'red' },
  { label: '越南', color: 'orange' },
]

export default function RemarkModal({
  visible,
  onClose,
  billNo,
  billId: _billId,
  remarks = [],
  role = 'normal',
  onSubmit,
}: RemarkModalProps) {
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const [filteredRemarks, setFilteredRemarks] = useState<Remark[]>([])

  useEffect(() => {
    if (role === 'asl') {
      setFilteredRemarks(remarks)
    } else {
      setFilteredRemarks(remarks.filter((r) => !r.isAsl))
    }
  }, [remarks, role])

  useEffect(() => {
    if (!visible) {
      setRemark('')
      setLoading(false)
    }
  }, [visible])

  const handleSubmit = async () => {
    if (!remark.trim()) {
      return
    }

    if (remark.length > 255) {
      alert('备注信息长度不要超过255位字符')
      return
    }

    if (onSubmit) {
      setLoading(true)
      try {
        await onSubmit(remark)
        setRemark('')
        onClose()
      } catch (error) {
        console.error('提交备注失败:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleQuickTag = (tag: string) => {
    setRemark(tag)
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={`${billNo} | 备注`}
      width="max-w-2xl"
      footer={
        <>
          <ModalButton onClick={onClose}>
            取消
          </ModalButton>
          <ModalButton 
            onClick={handleSubmit} 
            variant="primary" 
            disabled={!remark.trim() || loading}
            loading={loading}
          >
            提交
          </ModalButton>
        </>
      }
    >
      <ModalContent>
        {/* Remarks History */}
        {filteredRemarks.length > 0 && (
          <div className="mb-6">
            <div className="space-y-4">
              {filteredRemarks.map((item, index) => (
                <div
                  key={`${item.createTime}_${item.remark}_${index}`}
                  className="flex gap-4 pb-4 border-b border-gray-100 last:border-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      item.isAsl ? 'bg-green-500' : 'bg-primary-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      {item.remark}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{item.createUserName}</span>
                      <span className="text-gray-400">{item.createTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Remark */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              添加备注
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入备注信息"
              maxLength={255}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none bg-white text-gray-900"
            />
            <div className="mt-1 text-right text-xs text-gray-500">
              {remark.length}/255
            </div>
          </div>

          {/* Quick Tags */}
          {role === 'asl' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">快速标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickTags.map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => handleQuickTag(tag.label)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      tag.color === 'green'
                        ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                        : tag.color === 'magenta'
                        ? 'border-pink-300 text-pink-700 bg-pink-50 hover:bg-pink-100'
                        : tag.color === 'volcano'
                        ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
                        : tag.color === 'gold'
                        ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                        : tag.color === 'red'
                        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                        : 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
