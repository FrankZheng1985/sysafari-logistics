import { useNavigate } from 'react-router-dom'
import { 
  Package, Receipt, Truck, FileText, Users, 
  ClipboardCheck, Settings, BarChart3, PlusCircle,
  Search, Upload, Calculator
} from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'

interface QuickLink {
  id: string
  label: string
  icon: typeof Package
  path: string
  permission?: string
  color: string
}

interface QuickLinksCardProps {
  refreshKey?: number
}

// 所有可用的快捷入口
const ALL_QUICK_LINKS: QuickLink[] = [
  { id: 'new-order', label: '新建订单', icon: PlusCircle, path: '/bookings/bill', permission: 'bill:create', color: 'bg-blue-100 text-blue-600' },
  { id: 'orders', label: '订单管理', icon: Package, path: '/bookings/bill', permission: 'bill:view', color: 'bg-blue-100 text-blue-600' },
  { id: 'invoices', label: '发票管理', icon: Receipt, path: '/finance/invoices', permission: 'finance:invoice_view', color: 'bg-green-100 text-green-600' },
  { id: 'create-invoice', label: '创建发票', icon: PlusCircle, path: '/finance/invoices/create', permission: 'finance:invoice_create', color: 'bg-green-100 text-green-600' },
  { id: 'tms', label: 'TMS管理', icon: Truck, path: '/cmr-manage', permission: 'tms:view', color: 'bg-orange-100 text-orange-600' },
  { id: 'documents', label: '单证管理', icon: FileText, path: '/documents', permission: 'document:view', color: 'bg-purple-100 text-purple-600' },
  { id: 'doc-import', label: '单证导入', icon: Upload, path: '/documents/import', permission: 'document:import', color: 'bg-purple-100 text-purple-600' },
  { id: 'doc-match', label: '单证匹配', icon: Search, path: '/documents/matching', permission: 'document:match', color: 'bg-purple-100 text-purple-600' },
  { id: 'tax-calc', label: '税费计算', icon: Calculator, path: '/documents/tax-calc', permission: 'document:tax_calc', color: 'bg-purple-100 text-purple-600' },
  { id: 'customers', label: '客户管理', icon: Users, path: '/crm/customers', permission: 'crm:view', color: 'bg-cyan-100 text-cyan-600' },
  { id: 'inspection', label: '查验管理', icon: ClipboardCheck, path: '/inspection', permission: 'inspection:view', color: 'bg-amber-100 text-amber-600' },
  { id: 'reports', label: '财务报表', icon: BarChart3, path: '/finance/reports', permission: 'finance:report_view', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'settings', label: '系统设置', icon: Settings, path: '/system', permission: 'system:menu', color: 'bg-gray-100 text-gray-600' },
]

// 各角色默认显示的快捷入口
const ROLE_DEFAULT_LINKS: Record<string, string[]> = {
  operator: ['orders', 'tms', 'create-invoice', 'inspection'],
  doc_clerk: ['orders', 'tms', 'inspection', 'documents'],
  doc_officer: ['doc-import', 'doc-match', 'tax-calc', 'documents'],
  finance_assistant: ['create-invoice', 'invoices', 'reports', 'orders'],
  finance_director: ['reports', 'invoices', 'customers', 'settings'],
  manager: ['orders', 'tms', 'customers', 'reports'],
  boss: ['reports', 'customers', 'orders', 'settings'],
  admin: ['orders', 'invoices', 'customers', 'settings'],
  viewer: ['orders', 'customers'],
}

export default function QuickLinksCard({ refreshKey }: QuickLinksCardProps) {
  const navigate = useNavigate()
  const { user, hasPermission, isAdmin } = useAuth()

  // 获取当前用户可用的快捷入口
  const getAvailableLinks = () => {
    const role = user?.role || 'operator'
    const defaultLinkIds = ROLE_DEFAULT_LINKS[role] || ROLE_DEFAULT_LINKS.operator

    // 过滤出用户有权限的链接
    return ALL_QUICK_LINKS.filter(link => {
      // 检查是否在默认列表中
      if (!defaultLinkIds.includes(link.id)) return false
      // 检查权限
      if (link.permission) {
        if (isAdmin()) return true
        return hasPermission(link.permission)
      }
      return true
    })
  }

  const links = getAvailableLinks()

  return (
    <div className="grid grid-cols-4 gap-2">
      {links.map(link => {
        const IconComponent = link.icon
        return (
          <button
            key={link.id}
            onClick={() => navigate(link.path)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className={`p-2 rounded-lg ${link.color} group-hover:scale-110 transition-transform`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <span className="text-xs text-gray-600 text-center">{link.label}</span>
          </button>
        )
      })}

      {links.length === 0 && (
        <div className="col-span-4 text-center py-6 text-gray-400">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无可用快捷入口</p>
        </div>
      )}
    </div>
  )
}
