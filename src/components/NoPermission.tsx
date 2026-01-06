import { ShieldX, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface NoPermissionProps {
  title?: string
  message?: string
  redirectPath?: string
  redirectLabel?: string
}

/**
 * 无权限访问提示组件
 * 当用户尝试访问没有权限的页面时显示
 */
export default function NoPermission({ 
  title = '无访问权限',
  message = '您没有权限访问此页面，请联系管理员获取相应权限。',
  redirectPath = '/dashboard',
  redirectLabel = '返回首页'
}: NoPermissionProps) {
  const navigate = useNavigate()

  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button
          onClick={() => navigate(redirectPath)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {redirectLabel}
        </button>
      </div>
    </div>
  )
}

