import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Package, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'
import { formatDate } from '../../../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface StagnantOrder {
  id: string
  billNumber: string
  customerName: string
  ataDate: string
  daysStagnant: number
  pendingAmount: number
  status: string
}

interface StagnantOrdersCardProps {
  refreshKey?: number
}

export default function StagnantOrdersCard({ refreshKey }: StagnantOrdersCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [orders, setOrders] = useState<StagnantOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStagnantOrders()
  }, [refreshKey])

  const loadStagnantOrders = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/stagnant-orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setOrders(data.data)
        } else {
          // 使用模拟数据
          setOrders(getMockData())
        }
      } else {
        setOrders(getMockData())
      }
    } catch (error) {
      console.error('加载滞留订单失败:', error)
      setOrders(getMockData())
    } finally {
      setLoading(false)
    }
  }

  const getMockData = (): StagnantOrder[] => [
    {
      id: '1',
      billNumber: 'BL2024010123',
      customerName: '客户A公司',
      ataDate: '2025-12-15',
      daysStagnant: 24,
      pendingAmount: 3500,
      status: '已到港',
    },
    {
      id: '2',
      billNumber: 'BL2024010089',
      customerName: '客户B公司',
      ataDate: '2025-12-10',
      daysStagnant: 29,
      pendingAmount: 5800,
      status: '清关中',
    },
    {
      id: '3',
      billNumber: 'BL2024010056',
      customerName: '客户C公司',
      ataDate: '2025-12-05',
      daysStagnant: 34,
      pendingAmount: 2200,
      status: '待派送',
    },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getDaysColor = (days: number) => {
    if (days >= 30) return 'text-red-600 bg-red-100'
    if (days >= 14) return 'text-amber-600 bg-amber-100'
    return 'text-gray-600 bg-gray-100'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  const totalPending = orders.reduce((sum, o) => sum + o.pendingAmount, 0)

  return (
    <div className="space-y-3">
      {/* 汇总信息 */}
      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <div className="text-sm font-medium text-amber-700">滞留订单预警</div>
            <div className="text-xs text-amber-600">{orders.length} 个订单超过14天未结束</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">待收金额</div>
          <div className="text-sm font-bold text-amber-700">{formatCurrency(totalPending)}</div>
        </div>
      </div>

      {/* 订单列表 */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {orders.map(order => (
          <div
            key={order.id}
            onClick={() => navigate(`/bookings/bill/${order.id}`)}
            className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-900">{order.billNumber}</div>
                <div className="text-xs text-gray-500">{order.customerName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${getDaysColor(order.daysStagnant)}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {order.daysStagnant}天
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{formatCurrency(order.pendingAmount)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无滞留订单</p>
        </div>
      )}

      {/* 查看全部 */}
      {orders.length > 0 && (
        <button
          onClick={() => navigate('/finance/order-report?filter=stagnant')}
          className="w-full py-2 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          查看全部滞留订单 →
        </button>
      )}
    </div>
  )
}
