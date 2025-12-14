/**
 * 基础数据管理模块 - 表格列定义
 * 
 * 将所有表格列定义提取到此文件，减少主组件代码量
 */
/* eslint-disable react-refresh/only-export-components */
import { Column } from '../../components/DataTable'
import { 
  ShippingCompany, 
  ServiceFeeCategory, 
  TransportMethod, 
  VatRate 
} from '../../utils/api'

// 内部类型定义
export interface ContainerCodeItem {
  id: string
  containerCode: string
  companyCode: string
  companyName: string
  description?: string
  status: 'active' | 'inactive'
  createTime: string
}

export interface PortOfLoadingItem {
  id: string
  portCode: string
  portName: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  transportType?: string
  status: 'active' | 'inactive'
  isMainPort?: boolean
  createTime: string
}

export interface DestinationPortItem {
  id: string
  portCode: string
  portName: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  transportType?: string
  status: 'active' | 'inactive'
  isMainPort?: boolean
  createTime: string
}

export interface AirPortItem {
  id: string
  airportCode: string
  airportName: string
  city?: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  status: 'active' | 'inactive'
  createTime: string
}

export interface CountryItem {
  id: string
  countryCode: string
  countryName: string
  continent: string
  status: 'active' | 'inactive'
  createTime: string
}

// 状态标签组件
export const StatusToggle = ({ 
  status, 
  onToggle 
}: { 
  status: 'active' | 'inactive'
  onToggle: (e: React.MouseEvent) => void 
}) => (
  <button
    onClick={onToggle}
    className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
      status === 'active' ? 'bg-green-500' : 'bg-gray-300'
    }`}
    title={status === 'active' ? '点击禁用' : '点击启用'}
  >
    <span
      className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
        status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
)

// 操作按钮组件
export const ActionButtons = ({ 
  onEdit, 
  onDelete 
}: { 
  onEdit: () => void
  onDelete: () => void 
}) => (
  <div className="flex items-center gap-1">
    <button
      onClick={onEdit}
      className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
    >
      编辑
    </button>
    <button
      onClick={onDelete}
      className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
    >
      删除
    </button>
  </div>
)

// 运输类型标签
export const TransportTypeTag = ({ type }: { type?: string }) => {
  const typeConfig: Record<string, { label: string; color: string }> = {
    sea: { label: '海运', color: 'bg-blue-100 text-blue-700' },
    air: { label: '空运', color: 'bg-purple-100 text-purple-700' },
    rail: { label: '铁路', color: 'bg-orange-100 text-orange-700' },
    truck: { label: '卡车', color: 'bg-green-100 text-green-700' },
  }
  const config = typeConfig[type || ''] || { label: type || '-', color: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded ${config.color}`}>
      {config.label}
    </span>
  )
}

// 大洲标签
export const ContinentTag = ({ continent }: { continent?: string }) => {
  if (!continent) return <span className="text-gray-400">-</span>
  return (
    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
      {continent}
    </span>
  )
}

// 创建船公司列定义
export function createShippingCompanyColumns(
  onEdit: (record: ShippingCompany) => void,
  onDelete: (id: string) => void
): Column<ShippingCompany>[] {
  return [
    {
      key: 'companyCode',
      label: '公司代码',
      sorter: (a, b) => a.companyCode.localeCompare(b.companyCode),
    },
    {
      key: 'companyName',
      label: '公司名称',
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
    },
    {
      key: 'country',
      label: '国家',
      filters: [
        { text: '中国', value: 'CN' },
        { text: '美国', value: 'US' },
        { text: '欧洲', value: 'EU' },
      ],
      onFilter: (value, record) => record.country === value,
    },
    {
      key: 'website',
      label: '网站',
      render: (item: ShippingCompany) => item.website || '-',
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime || '').getTime() - new Date(b.createTime || '').getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ShippingCompany) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ]
}

// 创建服务费类别列定义
export function createFeeCategoryColumns(
  onEdit: (record: ServiceFeeCategory) => void,
  onDelete: (id: string) => void,
  onToggleStatus: (item: ServiceFeeCategory) => void
): Column<ServiceFeeCategory>[] {
  return [
    {
      key: 'code',
      label: '类别代码',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      key: 'name',
      label: '类别名称',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'status',
      label: '状态',
      render: (item: ServiceFeeCategory) => (
        <StatusToggle
          status={item.status}
          onToggle={(e) => {
            e.stopPropagation()
            onToggleStatus(item)
          }}
        />
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime || '').getTime() - new Date(b.createTime || '').getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ServiceFeeCategory) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ]
}

// 创建运输方式列定义
export function createTransportMethodColumns(
  onEdit: (record: TransportMethod) => void,
  onDelete: (id: string) => void,
  onToggleStatus: (item: TransportMethod) => void
): Column<TransportMethod>[] {
  return [
    {
      key: 'code',
      label: '代码',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      key: 'name',
      label: '名称',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'status',
      label: '状态',
      render: (item: TransportMethod) => (
        <StatusToggle
          status={item.status}
          onToggle={(e) => {
            e.stopPropagation()
            onToggleStatus(item)
          }}
        />
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime || '').getTime() - new Date(b.createTime || '').getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: TransportMethod) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ]
}

// 创建增值税率列定义
export function createVatRateColumns(
  onEdit: (record: VatRate) => void,
  onDelete: (id: string) => void,
  onToggleStatus: (item: VatRate) => void
): Column<VatRate>[] {
  return [
    {
      key: 'countryCode',
      label: '国家代码',
      sorter: (a, b) => a.countryCode.localeCompare(b.countryCode),
    },
    {
      key: 'countryName',
      label: '国家名称',
      sorter: (a, b) => a.countryName.localeCompare(b.countryName),
    },
    {
      key: 'standardRate',
      label: '标准税率',
      render: (item: VatRate) => `${item.standardRate}%`,
      sorter: (a, b) => a.standardRate - b.standardRate,
    },
    {
      key: 'reducedRate',
      label: '优惠税率',
      render: (item: VatRate) => item.reducedRate ? `${item.reducedRate}%` : '-',
    },
    {
      key: 'effectiveDate',
      label: '生效日期',
      sorter: (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: VatRate) => (
        <StatusToggle
          status={item.status}
          onToggle={(e) => {
            e.stopPropagation()
            onToggleStatus(item)
          }}
        />
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: VatRate) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ]
}

