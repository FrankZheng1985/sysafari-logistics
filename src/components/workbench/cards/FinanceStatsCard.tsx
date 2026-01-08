import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface FinanceStats {
  receivable: number
  payable: number
  overdueReceivable: number
  overduePayable: number
  collectionRate: number
}

interface FinanceStatsCardProps {
  refreshKey?: number
}

export default function FinanceStatsCard({ refreshKey }: FinanceStatsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [stats, setStats] = useState<FinanceStats>({
    receivable: 0,
    payable: 0,
    overdueReceivable: 0,
    overduePayable: 0,
    collectionRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      // 使用工作台专用API
      const response = await fetch(`${API_BASE}/api/workbench/finance-stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setStats({
            receivable: data.data.receivable || 0,
            payable: data.data.payable || 0,
            overdueReceivable: data.data.overdueReceivableCount || 0,
            overduePayable: data.data.overduePayableCount || 0,
            collectionRate: data.data.collectionRate || 0,
          })
        } else {
          setStats({ receivable: 0, payable: 0, overdueReceivable: 0, overduePayable: 0, collectionRate: 0 })
        }
      } else {
        setStats({ receivable: 0, payable: 0, overdueReceivable: 0, overduePayable: 0, collectionRate: 0 })
      }
    } catch (error) {
      console.error('加载财务统计失败:', error)
      setStats({ receivable: 0, payable: 0, overdueReceivable: 0, overduePayable: 0, collectionRate: 0 })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 应收应付 */}
      <div className="grid grid-cols-2 gap-2">
        <div 
          className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/finance/invoices?type=sales')}
        >
          <div className="flex items-center gap-1 text-blue-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">应收账款</span>
          </div>
          <div className="text-lg font-bold text-blue-700">{formatCurrency(stats.receivable)}</div>
          {stats.overdueReceivable > 0 && (
            <div className="flex items-center gap-1 mt-1 text-red-500">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-xs">{stats.overdueReceivable}笔逾期</span>
            </div>
          )}
        </div>
        <div 
          className="p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => navigate('/finance/invoices?type=purchase')}
        >
          <div className="flex items-center gap-1 text-orange-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs">应付账款</span>
          </div>
          <div className="text-lg font-bold text-orange-700">{formatCurrency(stats.payable)}</div>
          {stats.overduePayable > 0 && (
            <div className="flex items-center gap-1 mt-1 text-red-500">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-xs">{stats.overduePayable}笔逾期</span>
            </div>
          )}
        </div>
      </div>

      {/* 收款率 */}
      <div className="p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">收款率</span>
          <span className="text-sm font-medium text-gray-900">{stats.collectionRate}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              stats.collectionRate >= 80 ? 'bg-green-500' :
              stats.collectionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${stats.collectionRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}
