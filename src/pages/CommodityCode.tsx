import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Barcode, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function CommodityCode() {
  const navigate = useNavigate()

  // 3秒后自动跳转到税率管理页面
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/system/tariff-rates')
    }, 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="海关编码"
        icon={<Barcode className="w-5 h-5 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools' },
          { label: '海关编码' }
        ]}
      />
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Barcode className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            功能已迁移
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            海关编码管理功能已整合到"税率管理"模块中。
          </p>
          <p className="text-xs text-gray-500 mb-6">
            3秒后自动跳转，或点击下方按钮立即前往...
          </p>
          <button
            onClick={() => navigate('/system/tariff-rates')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm transition-colors"
          >
            前往税率管理
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
