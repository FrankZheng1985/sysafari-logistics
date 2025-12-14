import { useState } from 'react'
import { FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EditableTable, { EditableColumn } from '../components/EditableTable'

interface Product {
  id: string
  name: string
  code: string
  price: number
  stock: number
  category: string
  description?: string
}

const initialData: Product[] = [
  {
    id: '1',
    name: '产品A',
    code: 'PROD-001',
    price: 99.99,
    stock: 100,
    category: '电子产品',
    description: '这是一个示例产品',
  },
  {
    id: '2',
    name: '产品B',
    code: 'PROD-002',
    price: 199.99,
    stock: 50,
    category: '家居用品',
    description: '另一个示例产品',
  },
]

export default function EditableTableDemo() {
  const [data, setData] = useState<Product[]>(initialData)

  const columns: EditableColumn<Product>[] = [
    {
      key: 'name',
      label: '产品名称',
      editable: true,
      rules: [
        { required: true, message: '产品名称不能为空' },
        {
          validator: (value) => {
            if (value && value.length < 2) {
              return '产品名称至少需要2个字符'
            }
            return true
          },
        },
      ],
    },
    {
      key: 'code',
      label: '产品编码',
      editable: true,
      rules: [
        { required: true, message: '产品编码不能为空' },
        {
          validator: (value, record) => {
            const duplicate = data.find(
              (item) => item.code === value && item.id !== record.id
            )
            if (duplicate) {
              return '产品编码已存在'
            }
            return true
          },
        },
      ],
    },
    {
      key: 'price',
      label: '价格',
      editable: true,
      render: (value) => `¥${Number(value || 0).toFixed(2)}`,
      renderEdit: (value, _record, _index, onChange) => (
        <input
          type="number"
          step="0.01"
          min="0"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          title="输入价格"
          aria-label="价格"
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
        />
      ),
      rules: [
        { required: true, message: '价格不能为空' },
        {
          validator: (value) => {
            if (value !== undefined && value < 0) {
              return '价格不能为负数'
            }
            return true
          },
        },
      ],
    },
    {
      key: 'stock',
      label: '库存',
      editable: true,
      renderEdit: (value, _record, _index, onChange) => (
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          title="输入库存数量"
          aria-label="库存"
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
        />
      ),
      rules: [
        { required: true, message: '库存不能为空' },
        {
          validator: (value) => {
            if (value !== undefined && value < 0) {
              return '库存不能为负数'
            }
            return true
          },
        },
      ],
    },
    {
      key: 'category',
      label: '分类',
      editable: true,
      renderEdit: (value, _record, _index, onChange) => (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          title="选择分类"
          aria-label="分类"
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
        >
          <option value="">请选择</option>
          <option value="电子产品">电子产品</option>
          <option value="家居用品">家居用品</option>
          <option value="服装">服装</option>
          <option value="食品">食品</option>
        </select>
      ),
      rules: [{ required: true, message: '分类不能为空' }],
    },
    {
      key: 'description',
      label: '描述',
      editable: true,
      renderEdit: (value, _record, _index, onChange) => (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          title="输入描述"
          aria-label="描述"
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
        />
      ),
    },
  ]

  const handleChange = (newData: Product[]) => {
    setData(newData)
  }

  const handleSave = async (_record: Product, _index: number) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 300))
    // 这里可以调用实际的 API
  }

  const handleDelete = async (_record: Product, _index: number) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 300))
    // 这里可以调用实际的 API
  }

  const handleAdd = async (newRecord: Product) => {
    // 为新记录生成 ID
    newRecord.id = `new-${Date.now()}`
    await new Promise((resolve) => setTimeout(resolve, 300))
    // 这里可以调用实际的 API
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="可编辑表格示例"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '可编辑表格' }
        ]}
        summary={<div>共 {data.length} 条记录</div>}
      />
      <div className="flex-1 overflow-auto p-6">
        <EditableTable
          columns={columns}
          data={data}
          rowKey="id"
          onChange={handleChange}
          onSave={handleSave}
          onDelete={handleDelete}
          onAdd={handleAdd}
          showAddButton={true}
          addButtonText="添加新产品"
          addButtonPosition="top"
        />
      </div>
    </div>
  )
}

