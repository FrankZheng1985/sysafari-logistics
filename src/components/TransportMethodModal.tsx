import { useState, useEffect } from 'react'
import { Truck, Plane, Ship, TrainFront, Package } from 'lucide-react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import { 
  createTransportMethod, 
  updateTransportMethod, 
  type TransportMethod 
} from '../utils/api'

interface TransportMethodModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data: TransportMethod | null
}

// 图标选项
const iconOptions = [
  { value: 'truck', label: '卡车', icon: Truck },
  { value: 'plane', label: '飞机', icon: Plane },
  { value: 'ship', label: '轮船', icon: Ship },
  { value: 'train', label: '火车', icon: TrainFront },
  { value: 'package', label: '包裹', icon: Package },
]

export default function TransportMethodModal({ 
  visible, 
  onClose, 
  onSuccess,
  data 
}: TransportMethodModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    icon: 'truck',
    sortOrder: 0,
    status: 'active' as 'active' | 'inactive',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 编辑模式时填充数据
  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        code: data.code || '',
        description: data.description || '',
        icon: data.icon || 'truck',
        sortOrder: data.sortOrder || 0,
        status: data.status || 'active',
      })
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        icon: 'truck',
        sortOrder: 0,
        status: 'active',
      })
    }
    setErrors({})
  }, [data, visible])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '请输入运输方式名称'
    }

    if (!formData.code.trim()) {
      newErrors.code = '请输入运输方式代码'
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.code)) {
      newErrors.code = '代码只能包含字母、数字、下划线和横线'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      if (data) {
        // 编辑模式
        await updateTransportMethod(data.id, formData)
      } else {
        // 新增模式
        await createTransportMethod(formData)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('保存运输方式失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const getIconComponent = (iconName: string) => {
    const option = iconOptions.find(opt => opt.value === iconName)
    if (option) {
      const IconComponent = option.icon
      return <IconComponent className="w-3.5 h-3.5" />
    }
    return <Truck className="w-3.5 h-3.5" />
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={data ? '编辑运输方式' : '新增运输方式'}
      width="max-w-md"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            取消
          </ModalButton>
          <ModalButton 
            onClick={handleSubmit} 
            variant="primary" 
            disabled={loading}
            loading={loading}
          >
            {data ? '保存修改' : '确认添加'}
          </ModalButton>
        </>
      }
    >
      <ModalContent className="space-y-3">
        {/* 运输方式名称 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            运输方式名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="如：卡车、空运、海运"
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name}</p>
          )}
        </div>

        {/* 运输方式代码 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            运输方式代码 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              errors.code ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="如：TRUCK, AIR, SEA"
          />
          {errors.code && (
            <p className="text-xs text-red-500 mt-1">{errors.code}</p>
          )}
        </div>

        {/* 图标和排序 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 图标选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              图标
            </label>
            <div className="flex gap-1">
              {iconOptions.map((option) => {
                const IconComponent = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, icon: option.value }))}
                    className={`w-8 h-8 flex items-center justify-center rounded border bg-white transition-all ${
                      formData.icon === option.value
                        ? 'border-primary-500 text-primary-600'
                        : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
                    }`}
                    title={option.label}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* 排序 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              排序号
            </label>
            <input
              type="number"
              name="sortOrder"
              value={formData.sortOrder}
              onChange={handleInputChange}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            描述
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            rows={3}
            placeholder="运输方式的描述信息..."
          />
        </div>

        {/* 状态开关 */}
        <div className="flex items-center justify-between px-2 py-2 bg-gray-50 rounded border border-gray-200">
          <div>
            <span className="text-xs font-medium text-gray-700">启用状态</span>
            <p className="text-xs text-gray-500">关闭后此运输方式将不在下拉选项中显示</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ 
              ...prev, 
              status: prev.status === 'active' ? 'inactive' : 'active' 
            }))}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              formData.status === 'active' ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                formData.status === 'active' ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* 预览 */}
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <div className="text-xs font-medium text-blue-700 mb-1">预览效果</div>
          <div className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-blue-200">
            {getIconComponent(formData.icon)}
            <span className="text-xs font-medium text-gray-700">
              {formData.name || '运输方式名称'}
            </span>
            <span className="text-xs text-gray-400">
              ({formData.code || 'CODE'})
            </span>
          </div>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
