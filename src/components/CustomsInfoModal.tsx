import { useState } from 'react'
import { X, Check } from 'lucide-react'
import DataTable, { Column } from './DataTable'

interface CustomsDeclaration {
  id: string
  declarationId: string
  waybillPieces: number
  netWeight: number
  grossWeight: number
  netGrossRatio: number
}

interface CustomsInfoModalProps {
  visible: boolean
  onClose: () => void
  containerNumber: string
  billGrossWeight?: number
  billPieces?: number
}

export default function CustomsInfoModal({
  visible,
  onClose,
  containerNumber,
  billGrossWeight = 0,
  billPieces = 0,
}: CustomsInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'declared' | 'undeclared'>('declared')

  // 根据订单数据生成报关数据
  // 报关数据应该与订单数据完全匹配
  const generateDeclarations = (): CustomsDeclaration[] => {
    if (billPieces === 0 || billGrossWeight === 0) {
      return []
    }

    // 根据集装箱编号生成稳定的报关ID
    // 例如：EGHU9400490 -> CCLU940064 (使用集装箱编号的后6位数字，转换为类似格式)
    // 集装箱编号格式通常是：4个字母 + 6个数字
    // 我们取后6位数字，然后转换为报关ID格式
    let declarationId = 'CCLU'
    
    if (containerNumber.length >= 10) {
      // 取集装箱编号的后6位数字部分
      const numericPart = containerNumber.substring(4) // 从第4位开始到结尾，例如 "9400490"
      // 如果长度超过6位，取前6位；如果不足6位，前面补0
      const idSuffix = numericPart.length >= 6 
        ? numericPart.substring(0, 6) 
        : numericPart.padStart(6, '0')
      declarationId = `CCLU${idSuffix}`
    } else {
      // 如果格式不符合预期，使用简单的哈希方式生成稳定ID
      let hash = 0
      for (let i = 0; i < containerNumber.length; i++) {
        hash = ((hash << 5) - hash) + containerNumber.charCodeAt(i)
        hash = hash & hash // Convert to 32bit integer
      }
      const idSuffix = Math.abs(hash).toString().substring(0, 6).padStart(6, '0')
      declarationId = `CCLU${idSuffix}`
    }

    // 计算净重（根据实际业务，净重通常约为毛重的89-90%）
    // 使用与图片示例相似的比例：13569.81 / 15080 ≈ 0.89985
    const netWeightRatio = 0.89985
    const netWeight = billGrossWeight * netWeightRatio
    const netGrossRatio = (netWeight / billGrossWeight) * 100

    return [
      {
        id: '1',
        declarationId: declarationId,
        waybillPieces: billPieces, // 运单号件数 = 订单件数
        netWeight: Number(netWeight.toFixed(2)),
        grossWeight: billGrossWeight, // 毛重 = 订单毛重
        netGrossRatio: Number(netGrossRatio.toFixed(3)),
      },
    ]
  }

  const mockDeclarations: CustomsDeclaration[] = generateDeclarations()

  // 计算报关总毛重和总件数
  const totalDeclaredGrossWeight = mockDeclarations.reduce((sum, d) => sum + d.grossWeight, 0)
  const totalDeclaredPieces = mockDeclarations.reduce((sum, d) => sum + d.waybillPieces, 0)

  // 计算差值
  const weightDiff = billGrossWeight - totalDeclaredGrossWeight
  const piecesDiff = billPieces - totalDeclaredPieces

  const columns: Column<CustomsDeclaration>[] = [
    { key: 'id', label: '序号' },
    { key: 'declarationId', label: '报关 ID' },
    { key: 'waybillPieces', label: '运单号件数' },
    { key: 'netWeight', label: '净重' },
    { key: 'grossWeight', label: '毛重' },
    {
      key: 'netGrossRatio',
      label: '净毛重比',
      render: (item) => (
        <span className="text-green-600">{item.netGrossRatio.toFixed(3)}%</span>
      ),
    },
  ]

  // 早期返回必须在所有hooks之后
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {containerNumber} | 报关信息
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 验证信息框 */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                提单总毛重 - 报关总毛重 : {billGrossWeight} - {totalDeclaredGrossWeight.toFixed(8)} = {weightDiff.toFixed(8)}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                提单总件数 - 报关总件数: {billPieces} - {totalDeclaredPieces} = {piecesDiff}
              </span>
            </div>
          </div>

          {/* 标签页 */}
          <div className="mb-4 border-b border-gray-200">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('declared')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all relative ${
                  activeTab === 'declared'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                报关信息 1
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-[10px] rounded-full flex items-center justify-center">
                  1
                </span>
              </button>
              <button
                onClick={() => setActiveTab('undeclared')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                  activeTab === 'undeclared'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                未报关TK
              </button>
            </div>
          </div>

          {/* 表格内容 */}
          {activeTab === 'declared' && (
            <div>
              {mockDeclarations.length > 0 ? (
                <DataTable
                  columns={columns}
                  data={mockDeclarations}
                  compact={true}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无报关数据
                </div>
              )}
            </div>
          )}

          {activeTab === 'undeclared' && (
            <div className="text-center py-8 text-gray-500">
              暂无未报关数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

