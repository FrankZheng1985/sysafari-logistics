import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Package, Ship, Anchor, FileText, 
  MapPin, Calendar, Weight, Box, RefreshCw,
  ExternalLink, User, Building, Truck, Copy
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getBillById } from '../utils/api'
import { copyToClipboard } from '../components/Toast'

interface BillDetail {
  id: string
  orderNumber?: string
  orderSeq?: number
  billNumber: string
  containerNumber: string
  vessel: string
  voyage: string
  shipper: string
  consignee: string
  notifyParty: string
  portOfLoading: string
  portOfDischarge: string
  placeOfDelivery: string
  etd: string
  eta: string
  ata: string
  pieces: number
  weight: number
  volume: number
  description: string
  status: string
  shipStatus: string
  customsStatus: string
  deliveryStatus: string
  inspection: string
  customerName: string
  customerId: string
  createdAt: string
}

export default function CRMBillDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const crmTabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  useEffect(() => {
    if (id) {
      loadBillDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadBillDetail = async () => {
    setLoading(true)
    try {
      const response = await getBillById(id!)
      if (response.errCode === 200 && response.data) {
        setBill(response.data as any)
      }
    } catch (error) {
      console.error('加载提单详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 生成订单号显示
  const getOrderNumber = () => {
    if (bill?.orderNumber) return bill.orderNumber
    if (bill?.orderSeq) {
      const createDate = bill.createdAt ? new Date(bill.createdAt) : new Date()
      const year = createDate.getFullYear().toString().slice(-2)
      return `BP${year}${String(bill.orderSeq).padStart(5, '0')}`
    }
    return '-'
  }

  const getStatusBadge = (status: string, type: 'ship' | 'customs' | 'delivery' | 'inspection') => {
    const styleMap: Record<string, Record<string, string>> = {
      ship: {
        '已到港': 'bg-green-100 text-green-700',
        '未到港': 'bg-gray-100 text-gray-600',
        '跳港': 'bg-amber-100 text-amber-700',
      },
      customs: {
        '已放行': 'bg-green-100 text-green-700',
        '未放行': 'bg-gray-100 text-gray-600',
        '查验中': 'bg-amber-100 text-amber-700',
      },
      delivery: {
        '已送达': 'bg-green-100 text-green-700',
        '派送中': 'bg-blue-100 text-blue-700',
        '待派送': 'bg-gray-100 text-gray-600',
      },
      inspection: {
        '无查验': 'bg-gray-100 text-gray-600',
        '待查验': 'bg-amber-100 text-amber-700',
        '查验中': 'bg-blue-100 text-blue-700',
        '已放行': 'bg-green-100 text-green-700',
      },
    }
    const style = styleMap[type]?.[status] || 'bg-gray-100 text-gray-600'
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${style}`}>
        {status || '-'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <p className="text-gray-500">提单不存在或已被删除</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            返回上一页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户管理"
        description="提单详情"
        tabs={crmTabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">订单号: {getOrderNumber()}</h2>
              {getOrderNumber() && getOrderNumber() !== '-' && (
                <button
                  onClick={(e) => copyToClipboard(getOrderNumber(), e)}
                  className="text-gray-400 hover:text-gray-600"
                  title="复制订单号"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              提单号: {bill.billNumber}
              {bill.billNumber && (
                <button
                  onClick={(e) => copyToClipboard(bill.billNumber, e)}
                  className="text-gray-400 hover:text-gray-600"
                  title="复制提单号"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/bookings/bill/${id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50"
        >
          <ExternalLink className="w-4 h-4" />
          查看完整详情
        </button>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ship className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">船运状态</span>
          </div>
          {getStatusBadge(bill.shipStatus, 'ship')}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Anchor className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">清关状态</span>
          </div>
          {getStatusBadge(bill.customsStatus, 'customs')}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500">查验状态</span>
          </div>
          {getStatusBadge(bill.inspection, 'inspection')}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">派送状态</span>
          </div>
          {getStatusBadge(bill.deliveryStatus, 'delivery')}
        </div>
      </div>

      {/* 详情信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 基本信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            基本信息
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">订单号</span>
              <p className="text-gray-900 font-medium mt-1 flex items-center gap-1">
                {getOrderNumber()}
                {getOrderNumber() && getOrderNumber() !== '-' && (
                  <button
                    onClick={(e) => copyToClipboard(getOrderNumber(), e)}
                    className="text-gray-400 hover:text-gray-600"
                    title="复制订单号"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">提单号</span>
              <p className="text-gray-900 font-medium mt-1 flex items-center gap-1">
                {bill.billNumber}
                {bill.billNumber && (
                  <button
                    onClick={(e) => copyToClipboard(bill.billNumber, e)}
                    className="text-gray-400 hover:text-gray-600"
                    title="复制提单号"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">集装箱号</span>
              <p className="text-gray-900 mt-1 flex items-center gap-1">
                {bill.containerNumber || '-'}
                {bill.containerNumber && (
                  <button
                    onClick={(e) => copyToClipboard(bill.containerNumber, e)}
                    className="text-gray-400 hover:text-gray-600"
                    title="复制集装箱号"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">船名/航次</span>
              <p className="text-gray-900 mt-1">{bill.vessel || '-'} / {bill.voyage || '-'}</p>
            </div>
          </div>
        </div>

        {/* 港口信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            港口信息
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">起运港</span>
              <p className="text-gray-900 mt-1">{bill.portOfLoading || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">目的港</span>
              <p className="text-gray-900 mt-1">{bill.portOfDischarge || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">交货地</span>
              <p className="text-gray-900 mt-1">{bill.placeOfDelivery || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">实际到港</span>
              <p className="text-gray-900 mt-1">{bill.ata ? bill.ata.split('T')[0] : '-'}</p>
            </div>
          </div>
        </div>

        {/* 时间信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            时间信息
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">ETD（预计离港）</span>
              <p className="text-gray-900 mt-1">{bill.etd ? bill.etd.split('T')[0] : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">ETA（预计到港）</span>
              <p className="text-gray-900 mt-1">{bill.eta ? bill.eta.split('T')[0] : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">ATA（实际到港）</span>
              <p className="text-gray-900 mt-1">{bill.ata ? bill.ata.split('T')[0] : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">创建时间</span>
              <p className="text-gray-900 mt-1">{bill.createdAt ? bill.createdAt.split('T')[0] : '-'}</p>
            </div>
          </div>
        </div>

        {/* 货物信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Box className="w-4 h-4 text-gray-400" />
            货物信息
          </h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-500">件数</span>
              <p className="text-gray-900 font-medium mt-1">{bill.pieces || 0} 件</p>
            </div>
            <div>
              <span className="text-gray-500">重量</span>
              <p className="text-gray-900 font-medium mt-1">{bill.weight ? Number(bill.weight).toFixed(2) : '0'} KG</p>
            </div>
            <div>
              <span className="text-gray-500">体积</span>
              <p className="text-gray-900 font-medium mt-1">{bill.volume ? Number(bill.volume).toFixed(2) : '0'} CBM</p>
            </div>
          </div>
          {bill.description && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-gray-500 text-xs">货物描述</span>
              <p className="text-gray-900 text-xs mt-1">{bill.description}</p>
            </div>
          )}
        </div>

        {/* 发货人/收货人信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            发货人/收货人信息
          </h3>
          <div className="grid grid-cols-3 gap-6 text-xs">
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-2">
                <Building className="w-3 h-3" />
                发货人
              </div>
              <p className="text-gray-900">{bill.shipper || '-'}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-2">
                <Building className="w-3 h-3" />
                收货人
              </div>
              <p className="text-gray-900">{bill.consignee || '-'}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-2">
                <User className="w-3 h-3" />
                通知方
              </div>
              <p className="text-gray-900">{bill.notifyParty || '-'}</p>
            </div>
          </div>
          {bill.customerName && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">关联客户:</span>
                <button
                  onClick={() => bill.customerId && navigate(`/crm/customers/${bill.customerId}`)}
                  className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                >
                  {bill.customerName}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
