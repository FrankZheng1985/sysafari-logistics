import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Upload, Download, Save, X, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface BatchLabelItem {
  id: string
  orderNumber: string
  recipient: string
  phone: string
  address: string
  city: string
  postalCode: string
  country: string
  weight: string
  transferMethod: string
  remarks: string
}

export default function LabelCreateBatch() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<BatchLabelItem[]>([
    {
      id: '1',
      orderNumber: '',
      recipient: '',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'NL',
      weight: '',
      transferMethod: 'DECLARATION ONLY',
      remarks: '',
    },
  ])

  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({})

  const handleItemChange = (id: string, field: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
    // 清除该字段的错误
    if (errors[id]?.[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        if (newErrors[id]) {
          const itemErrors = { ...newErrors[id] }
          delete itemErrors[field]
          newErrors[id] = itemErrors
        }
        return newErrors
      })
    }
  }

  const handleAddRow = () => {
    const newId = String(Date.now())
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        orderNumber: '',
        recipient: '',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
        country: 'NL',
        weight: '',
        transferMethod: 'DECLARATION ONLY',
        remarks: '',
      },
    ])
  }

  const handleDeleteRow = (id: string) => {
    if (items.length === 1) {
      alert('至少需要保留一行数据')
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
    // 清除该行的错误
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[id]
      return newErrors
    })
  }

  const validate = (): boolean => {
    const newErrors: Record<string, Record<string, string>> = {}

    items.forEach((item) => {
      const itemErrors: Record<string, string> = {}

      if (!item.orderNumber.trim()) {
        itemErrors.orderNumber = '订单号不能为空'
      }
      if (!item.recipient.trim()) {
        itemErrors.recipient = '收件人不能为空'
      }
      if (!item.phone.trim()) {
        itemErrors.phone = '电话不能为空'
      }
      if (!item.address.trim()) {
        itemErrors.address = '地址不能为空'
      }
      if (!item.city.trim()) {
        itemErrors.city = '城市不能为空'
      }
      if (!item.postalCode.trim()) {
        itemErrors.postalCode = '邮编不能为空'
      }
      if (!item.weight.trim()) {
        itemErrors.weight = '重量不能为空'
      } else if (isNaN(Number(item.weight)) || Number(item.weight) <= 0) {
        itemErrors.weight = '请输入有效的重量'
      }

      if (Object.keys(itemErrors).length > 0) {
        newErrors[item.id] = itemErrors
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      alert('请检查表单数据，确保所有必填项都已填写')
      return
    }

    setLoading(true)
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      alert(`成功创建 ${items.length} 个标签！`)
      navigate('/bookings/labels')
    } catch (error) {
      console.error('批量创建失败:', error)
      alert('批量创建失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/bookings/labels')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 这里应该解析 Excel/CSV 文件
    // 目前只是提示
    alert('文件上传功能开发中，请手动输入数据')
    e.target.value = ''
  }

  const handleDownloadTemplate = () => {
    // 创建模板 CSV 内容
    const template = [
      ['订单号', '收件人', '电话', '地址', '城市', '邮编', '国家', '重量(KG)', '转运方式', '备注'],
      ['COSU123456789', 'John Doe', '+31 20 123 4567', '123 Main St', 'Amsterdam', '1000 AA', 'NL', '2.5', 'DECLARATION ONLY', ''],
    ].map((row) => row.join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '标签批量创建模板.csv'
    link.click()
  }

  const columns: Column<BatchLabelItem>[] = [
    {
      key: 'orderNumber',
      label: '订单号',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="text"
            value={item.orderNumber}
            onChange={(e) => handleItemChange(item.id, 'orderNumber', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.orderNumber ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="订单号"
          />
          {errors[item.id]?.orderNumber && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].orderNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'recipient',
      label: '收件人',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="text"
            value={item.recipient}
            onChange={(e) => handleItemChange(item.id, 'recipient', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.recipient ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="收件人"
          />
          {errors[item.id]?.recipient && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].recipient}</p>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      label: '电话',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="tel"
            value={item.phone}
            onChange={(e) => handleItemChange(item.id, 'phone', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.phone ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="电话"
          />
          {errors[item.id]?.phone && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].phone}</p>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      label: '地址',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="text"
            value={item.address}
            onChange={(e) => handleItemChange(item.id, 'address', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="地址"
          />
          {errors[item.id]?.address && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].address}</p>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      label: '城市',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="text"
            value={item.city}
            onChange={(e) => handleItemChange(item.id, 'city', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.city ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="城市"
          />
          {errors[item.id]?.city && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].city}</p>
          )}
        </div>
      ),
    },
    {
      key: 'postalCode',
      label: '邮编',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="text"
            value={item.postalCode}
            onChange={(e) => handleItemChange(item.id, 'postalCode', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.postalCode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="邮编"
          />
          {errors[item.id]?.postalCode && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].postalCode}</p>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      label: '国家',
      render: (item: BatchLabelItem) => (
        <select
          value={item.country}
          onChange={(e) => handleItemChange(item.id, 'country', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
        >
          <option value="NL">NL</option>
          <option value="BE">BE</option>
          <option value="DE">DE</option>
          <option value="FR">FR</option>
        </select>
      ),
    },
    {
      key: 'weight',
      label: '重量(KG)',
      render: (item: BatchLabelItem) => (
        <div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.weight}
            onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
              errors[item.id]?.weight ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="重量"
          />
          {errors[item.id]?.weight && (
            <p className="text-xs text-red-500 mt-1">{errors[item.id].weight}</p>
          )}
        </div>
      ),
    },
    {
      key: 'transferMethod',
      label: '转运方式',
      render: (item: BatchLabelItem) => (
        <select
          value={item.transferMethod}
          onChange={(e) => handleItemChange(item.id, 'transferMethod', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
        >
          <option value="DECLARATION ONLY">DECLARATION ONLY</option>
          <option value="FULL CONTAINER">FULL CONTAINER</option>
          <option value="LCL">LCL</option>
        </select>
      ),
    },
    {
      key: 'remarks',
      label: '备注',
      render: (item: BatchLabelItem) => (
        <input
          type="text"
          value={item.remarks}
          onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
          placeholder="备注（可选）"
        />
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: BatchLabelItem) => (
        <button
          onClick={() => handleDeleteRow(item.id)}
          className="text-red-600 hover:text-red-700 p-1 transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="批量创建标签"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单', path: '/bookings/labels' },
          { label: '批量创建' }
        ]}
        actionButtons={
          <button
            onClick={handleCancel}
            className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-full mx-auto">
          {/* 操作提示 */}
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="text-xs font-medium text-blue-900 mb-2">批量创建说明</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>可以手动输入多行数据，或上传 Excel/CSV 文件</li>
                  <li>点击"添加一行"按钮可以增加新的数据行</li>
                  <li>点击"下载模板"可以下载 CSV 模板文件</li>
                  <li>所有标记为必填的字段都需要填写</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 文件操作 */}
          <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-3">
            <div className="flex items-center gap-3">
              <label className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer flex items-center gap-1 transition-colors">
                <Upload className="w-4 h-4" />
                <span>上传文件</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleDownloadTemplate}
                className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>下载模板</span>
              </button>
              <button
                onClick={handleAddRow}
                className="px-1.5 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>添加一行</span>
              </button>
              <div className="ml-auto text-xs text-gray-600 font-medium">
                共 {items.length} 条数据
              </div>
            </div>
          </div>

          {/* 数据表格 */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <DataTable
                  columns={columns}
                  data={items}
                  rowKey="id"
                  compact={true}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>取消</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? '创建中...' : `批量创建 (${items.length}条)`}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

