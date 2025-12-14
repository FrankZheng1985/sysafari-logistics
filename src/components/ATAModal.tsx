import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'

interface ATAModalProps {
  visible: boolean
  onClose: () => void
  billNo: string
  oldAta?: string
  onSubmit?: (ata: string) => Promise<void>
}

export default function ATAModal({
  visible,
  onClose,
  billNo: _billNo,
  oldAta,
  onSubmit,
}: ATAModalProps) {
  const [ata, setAta] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && oldAta) {
      setAta(oldAta)
    } else if (visible) {
      setAta('')
    }
  }, [visible, oldAta])

  useEffect(() => {
    if (!visible) {
      setAta('')
      setLoading(false)
    }
  }, [visible])

  const handleSubmit = async () => {
    if (!ata) {
      alert('请选择 ATA 日期')
      return
    }

    if (onSubmit) {
      setLoading(true)
      try {
        await onSubmit(ata)
        onClose()
      } catch (error) {
        console.error('提交 ATA 失败:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title="添加或编辑 ATA"
      width="max-w-md"
      footer={
        <>
          <ModalButton onClick={onClose}>
            取消
          </ModalButton>
          <ModalButton 
            onClick={handleSubmit} 
            variant="primary" 
            disabled={!ata || loading}
            loading={loading}
          >
            提交
          </ModalButton>
        </>
      }
    >
      <ModalContent>
        <div className="space-y-4">
          <div>
            <label htmlFor="ata-date-input" className="block text-sm font-medium text-gray-700 mb-2">
              ATA <span className="text-red-500">*</span>
            </label>
            <input
              id="ata-date-input"
              type="date"
              value={ata}
              onChange={(e) => setAta(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              title="选择 ATA 日期"
              aria-label="ATA 日期"
              aria-required="true"
              required
            />
          </div>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
