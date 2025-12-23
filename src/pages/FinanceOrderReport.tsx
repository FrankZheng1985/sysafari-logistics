import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Download, DollarSign, PieChart, BarChart3, 
  RefreshCw, Package, Copy
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import { copyToClipboard } from '../components/Toast'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 订单维度费用报表
interface OrderFeeReport {
  billId: string
  billNumber: string
  orderNumber?: string      // 订单号
  containerNumber?: string  // 集装箱号
  customerId: string
  customerName: string
  feeCount: number
  totalAmount: number
  // 各分类费用（应收/应付分开）
  freightReceivable: number
  freightPayable: number
  customsReceivable: number
  customsPayable: number
  warehouseReceivable: number
  warehousePayable: number
  handlingReceivable: number
  handlingPayable: number
  otherReceivable: number
  otherPayable: number
  firstFeeDate: string
  lastFeeDate: string
}

interface OrderReportData {
  list: OrderFeeReport[]
  total: number
  page: number
  pageSize: number
  summary: {
    orderCount: number
    feeCount: number
    totalAmount: number
  }
}

export default function FinanceOrderReport() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orderReportData, setOrderReportData] = useState<OrderReportData | null>(null)
  const [orderReportPage, setOrderReportPage] = useState(1)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '历史记录', path: '/finance/invoices/history' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

  useEffect(() => {
    fetchOrderReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, orderReportPage])

  const fetchOrderReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page: orderReportPage.toString(),
        pageSize: '20'
      })
      
      const response = await fetch(`${API_BASE}/api/finance/reports/orders?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setOrderReportData(data.data)
      }
    } catch (error) {
      console.error('获取订单费用报表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const handleExport = () => {
    // 导出功能
    alert('导出功能开发中...')
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="订单报表"
        description="按订单维度查看费用汇总"
        tabs={tabs}
        activeTab="/finance/order-report"
        onTabChange={(path) => navigate(path)}
      />

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">开始日期:</span>
              <DatePicker
                value={dateRange.startDate}
                onChange={(value) => setDateRange(prev => ({ ...prev, startDate: value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">结束日期:</span>
              <DatePicker
                value={dateRange.endDate}
                onChange={(value) => setDateRange(prev => ({ ...prev, endDate: value }))}
              />
            </div>
            <button
              onClick={fetchOrderReport}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 border border-primary-200 rounded hover:bg-primary-50"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-primary-600 rounded hover:bg-primary-700"
          >
            <Download className="w-4 h-4" />
            导出报表
          </button>
        </div>
      </div>

      {/* 汇总指标 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">有费用的订单</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {orderReportData?.summary.orderCount || 0}
          </div>
          <div className="text-xs text-blue-600 mt-1">共关联 {orderReportData?.summary.feeCount || 0} 笔费用</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">费用总额</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(orderReportData?.summary.totalAmount || 0)}
          </div>
          <div className="text-xs text-green-600 mt-1">选定日期范围内</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">平均单价</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {formatCurrency(
              orderReportData?.summary.orderCount 
                ? (orderReportData.summary.totalAmount / orderReportData.summary.orderCount)
                : 0
            )}
          </div>
          <div className="text-xs text-purple-600 mt-1">每单平均费用</div>
        </div>
      </div>

      {/* 订单费用明细表 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-500" />
          订单费用明细
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>订单号</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>提单号</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>集装箱号</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>客户</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>笔数</th>
                <th className="text-center py-1 px-1 font-medium text-blue-600 text-xs border-b border-gray-200" colSpan={2}>运费</th>
                <th className="text-center py-1 px-1 font-medium text-red-600 text-xs border-b border-gray-200" colSpan={2}>关税</th>
                <th className="text-center py-1 px-1 font-medium text-amber-600 text-xs border-b border-gray-200" colSpan={2}>仓储</th>
                <th className="text-center py-1 px-1 font-medium text-purple-600 text-xs border-b border-gray-200" colSpan={2}>操作费</th>
                <th className="text-center py-1 px-1 font-medium text-gray-500 text-xs border-b border-gray-200" colSpan={2}>其他</th>
                <th className="text-center py-2 px-2 font-medium text-gray-600 text-xs" rowSpan={2}>操作</th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-right py-1 px-1 font-medium text-green-600 text-xs">收</th>
                <th className="text-right py-1 px-1 font-medium text-orange-600 text-xs">付</th>
                <th className="text-right py-1 px-1 font-medium text-green-600 text-xs">收</th>
                <th className="text-right py-1 px-1 font-medium text-orange-600 text-xs">付</th>
                <th className="text-right py-1 px-1 font-medium text-green-600 text-xs">收</th>
                <th className="text-right py-1 px-1 font-medium text-orange-600 text-xs">付</th>
                <th className="text-right py-1 px-1 font-medium text-green-600 text-xs">收</th>
                <th className="text-right py-1 px-1 font-medium text-orange-600 text-xs">付</th>
                <th className="text-right py-1 px-1 font-medium text-green-600 text-xs">收</th>
                <th className="text-right py-1 px-1 font-medium text-orange-600 text-xs">付</th>
              </tr>
            </thead>
            <tbody>
              {orderReportData?.list && orderReportData.list.length > 0 ? (
                orderReportData.list.map((item) => {
                  const freightRec = Number(item.freightReceivable || 0)
                  const freightPay = Number(item.freightPayable || 0)
                  const customsRec = Number(item.customsReceivable || 0)
                  const customsPay = Number(item.customsPayable || 0)
                  const warehouseRec = Number(item.warehouseReceivable || 0)
                  const warehousePay = Number(item.warehousePayable || 0)
                  const handlingRec = Number(item.handlingReceivable || 0)
                  const handlingPay = Number(item.handlingPayable || 0)
                  const otherRec = Number(item.otherReceivable || 0)
                  const otherPay = Number(item.otherPayable || 0)
                  
                  return (
                    <tr key={item.billId + item.customerId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          {item.orderNumber ? (
                            <>
                              <span 
                                className="font-medium text-primary-600 hover:text-primary-700 hover:underline cursor-pointer text-xs"
                                onClick={() => navigate(`/finance/bill-details/${item.billId}`)}
                                title="点击查看提单详情"
                              >
                                {item.orderNumber}
                              </span>
                              <button
                                onClick={(e) => copyToClipboard(item.orderNumber || '', e)}
                                className="text-gray-400 hover:text-gray-600"
                                title="复制订单号"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {item.billNumber ? (
                          <div className="flex items-center gap-1">
                            <span 
                              className="text-gray-700 hover:underline cursor-pointer text-xs"
                              onClick={() => navigate(`/finance/bill-details/${item.billId}`)}
                            >
                              {item.billNumber}
                            </span>
                            <button
                              onClick={(e) => copyToClipboard(item.billNumber, e)}
                              className="text-gray-400 hover:text-gray-600"
                              title="复制提单号"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {item.containerNumber ? (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700 text-xs">{item.containerNumber}</span>
                            <button
                              onClick={(e) => copyToClipboard(item.containerNumber || '', e)}
                              className="text-gray-400 hover:text-gray-600"
                              title="复制集装箱号"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-600 text-xs">{item.customerName || '-'}</td>
                      <td className="py-2 px-2 text-right text-gray-900 text-xs">{item.feeCount}</td>
                      {/* 运费 */}
                      <td className="py-2 px-1 text-right text-green-600 text-xs">
                        {freightRec > 0 ? formatCurrency(freightRec) : '-'}
                      </td>
                      <td className="py-2 px-1 text-right text-orange-600 text-xs">
                        {freightPay > 0 ? formatCurrency(freightPay) : '-'}
                      </td>
                      {/* 关税 */}
                      <td className="py-2 px-1 text-right text-green-600 text-xs">
                        {customsRec > 0 ? formatCurrency(customsRec) : '-'}
                      </td>
                      <td className="py-2 px-1 text-right text-orange-600 text-xs">
                        {customsPay > 0 ? formatCurrency(customsPay) : '-'}
                      </td>
                      {/* 仓储 */}
                      <td className="py-2 px-1 text-right text-green-600 text-xs">
                        {warehouseRec > 0 ? formatCurrency(warehouseRec) : '-'}
                      </td>
                      <td className="py-2 px-1 text-right text-orange-600 text-xs">
                        {warehousePay > 0 ? formatCurrency(warehousePay) : '-'}
                      </td>
                      {/* 操作费 */}
                      <td className="py-2 px-1 text-right text-green-600 text-xs">
                        {handlingRec > 0 ? formatCurrency(handlingRec) : '-'}
                      </td>
                      <td className="py-2 px-1 text-right text-orange-600 text-xs">
                        {handlingPay > 0 ? formatCurrency(handlingPay) : '-'}
                      </td>
                      {/* 其他 */}
                      <td className="py-2 px-1 text-right text-green-600 text-xs">
                        {otherRec > 0 ? formatCurrency(otherRec) : '-'}
                      </td>
                      <td className="py-2 px-1 text-right text-orange-600 text-xs">
                        {otherPay > 0 ? formatCurrency(otherPay) : '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => navigate(`/finance/fees?billId=${item.billId}`)}
                          className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          明细
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-gray-400">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        加载中...
                      </div>
                    ) : (
                      '暂无订单费用数据'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
            {orderReportData?.list && orderReportData.list.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-medium border-t-2 border-gray-300 text-xs">
                  <td className="py-2 px-2 text-left text-gray-900">合计</td>
                  <td className="py-2 px-2 text-left text-gray-600">{orderReportData.total} 个订单</td>
                  <td className="py-2 px-2 text-left text-gray-600">-</td>
                  <td className="py-2 px-2 text-left text-gray-600">-</td>
                  <td className="py-2 px-2 text-right text-gray-900">{orderReportData.summary.feeCount}</td>
                  {/* 运费 */}
                  <td className="py-2 px-1 text-right text-green-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.freightReceivable || 0), 0))}
                  </td>
                  <td className="py-2 px-1 text-right text-orange-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.freightPayable || 0), 0))}
                  </td>
                  {/* 关税 */}
                  <td className="py-2 px-1 text-right text-green-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.customsReceivable || 0), 0))}
                  </td>
                  <td className="py-2 px-1 text-right text-orange-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.customsPayable || 0), 0))}
                  </td>
                  {/* 仓储 */}
                  <td className="py-2 px-1 text-right text-green-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.warehouseReceivable || 0), 0))}
                  </td>
                  <td className="py-2 px-1 text-right text-orange-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.warehousePayable || 0), 0))}
                  </td>
                  {/* 操作费 */}
                  <td className="py-2 px-1 text-right text-green-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.handlingReceivable || 0), 0))}
                  </td>
                  <td className="py-2 px-1 text-right text-orange-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.handlingPayable || 0), 0))}
                  </td>
                  {/* 其他 */}
                  <td className="py-2 px-1 text-right text-green-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.otherReceivable || 0), 0))}
                  </td>
                  <td className="py-2 px-1 text-right text-orange-600">
                    {formatCurrency(orderReportData.list.reduce((sum, i) => sum + Number(i.otherPayable || 0), 0))}
                  </td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        {/* 分页 */}
        {orderReportData && orderReportData.total > orderReportData.pageSize && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              共 {orderReportData.total} 个订单，第 {orderReportData.page} / {Math.ceil(orderReportData.total / orderReportData.pageSize)} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrderReportPage(p => Math.max(1, p - 1))}
                disabled={orderReportPage === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setOrderReportPage(p => p + 1)}
                disabled={orderReportPage >= Math.ceil(orderReportData.total / orderReportData.pageSize)}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 费用构成说明 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-gray-500" />
          费用类型说明
        </h3>
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500"></span>
            <span className="text-gray-600">运费 - 海运费、内陆运费等</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-500"></span>
            <span className="text-gray-600">关税 - 进口关税、增值税等</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-orange-500"></span>
            <span className="text-gray-600">仓储 - 仓储费、滞港费等</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-purple-500"></span>
            <span className="text-gray-600">操作费 - 报关费、查验费等</span>
          </div>
        </div>
      </div>
    </div>
  )
}
