import { User } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'

interface Account {
  id: string
  name: string
  email: string
  createTime: string
  active: boolean
}

const mockAccounts: Account[] = [
  {
    id: '1',
    name: 'op1@xianfenghk.com',
    email: 'op1@xianfenghk.com',
    createTime: '2025-05-22 12:29:30',
    active: true,
  },
  {
    id: '2',
    name: 'danzheng1',
    email: 'op3@xianfenghk.com',
    createTime: '2025-06-09 11:08:17',
    active: true,
  },
]

export default function UserProfile() {
  const columns = [
    { key: 'id', label: '序号' },
    { key: 'name', label: '姓名' },
    { key: 'email', label: '邮箱' },
    { key: 'createTime', label: '创建时间' },
    {
      key: 'active',
      label: '激活',
      render: (_value, record: Account) => (
        <div className={`w-12 h-6 rounded-full ${record.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="名片"
        icon={<User className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '名片' }
        ]}
        tabs={[
          { label: '公司账户信息', path: '/tools/user-profile' },
          { label: '开票信息', path: '/tools/user-profile/invoice' },
          { label: '邮件设置', path: '/tools/user-profile/email' },
        ]}
        activeTab="/tools/user-profile"
        actionButtons={
          <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs">
            + 新账户
          </button>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="text-xs font-semibold mb-2">公司基本信息</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">简称:</span> XIANFENGGUOJI
            </div>
            <div>
              <span className="text-gray-500">公司名(中):</span> 先鋒國際物流有限公司
            </div>
            <div>
              <span className="text-gray-500">公司名(英):</span> XIAN FENG INTERNATI...
            </div>
            <div>
              <span className="text-gray-500">地址 1:</span> CN
            </div>
            <div>
              <span className="text-gray-500">地址 2:</span> RM 725, 7/F., LIVEN H...
            </div>
            <div>
              <span className="text-gray-500">营业执照:</span> -
            </div>
            <div>
              <span className="text-gray-500">API KEY:</span> -
            </div>
            <div>
              <span className="text-gray-500">API SECRET:</span> -
            </div>
          </div>
        </div>
        <DataTable columns={columns} data={mockAccounts} compact={true} />
      </div>
    </div>
  )
}

