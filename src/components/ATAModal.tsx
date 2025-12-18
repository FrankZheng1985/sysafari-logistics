import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import DatePicker from './DatePicker'

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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ATA <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={ata}
              onChange={(value) => setAta(value)}
              placeholder="选择 ATA 日期"
            />
          </div>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
