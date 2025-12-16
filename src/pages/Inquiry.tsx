import { useState, useEffect } from 'react'
import { DollarSign, Plus, Trash2, Edit2, Save, X, Truck, FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import TransportPriceModal from '../components/TransportPriceModal'
import { PageContainer, ContentCard } from '../components/ui'
import {
  getServiceFeeCategoryNames,
  getServiceFees,
  createServiceFee,
  updateServiceFee,
  deleteServiceFee,
  getTransportPrices,
  createTransportPrice,
  updateTransportPrice,
  deleteTransportPrice,
  ServiceFeeItem as ApiServiceFeeItem,
  TransportPriceItem as ApiTransportPriceItem,
} from '../utils/api'

// 服务费项目类型
type ServiceFeeItem = ApiServiceFeeItem

// 运输价格项目类型
type TransportPriceItem = ApiTransportPriceItem

// 默认服务费类别（API 加载前的占位）
const defaultFeeCategories = ['报关服务', '仓储服务', '运输服务', '其他服务']
const unitOptions = ['票', 'CBM', 'KG', 'CBM/天', '件', '柜', '次']
const currencyOptions = ['EUR', 'USD', 'CNY', 'GBP']
// 运输类型选项（可用于扩展功能）
// const transportTypes = ['卡车', '空运', '海运', '铁路', '快递']

export default function Inquiry() {
  const [activeTab, setActiveTab] = useState<'service-fees' | 'transport-price' | 'tariff-calc'>('service-fees')
  
  // 服务费类别（从基础数据管理读取）
  const [feeCategories, setFeeCategories] = useState<string[]>(defaultFeeCategories)
  
  // 服务费管理状态
  const [serviceFees, setServiceFees] = useState<ServiceFeeItem[]>([])
  const [editingFee, setEditingFee] = useState<ServiceFeeItem | null>(null)
  const [isAddingFee, setIsAddingFee] = useState(false)
  const [newFee, setNewFee] = useState<Partial<ServiceFeeItem>>({
    name: '',
    category: '报关服务',
    unit: '票',
    price: 0,
    currency: 'EUR',
    description: '',
    isActive: true,
  })
  
  // 运输价格管理状态
  const [transportPrices, setTransportPrices] = useState<TransportPriceItem[]>([])
  const [transportModalVisible, setTransportModalVisible] = useState(false)
  const [editingTransport, setEditingTransport] = useState<TransportPriceItem | null>(null)
  

  // 加载服务费类别
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await getServiceFeeCategoryNames()
        if (response.errCode === 200 && response.data && response.data.length > 0) {
          setFeeCategories(response.data)
        }
      } catch (error) {
        console.error('加载服务费类别失败:', error)
      }
    }
    loadCategories()
  }, [])

  // 加载服务费数据
  useEffect(() => {
    const loadFees = async () => {
      try {
        const response = await getServiceFees()
        if (response.errCode === 200 && response.data) {
          setServiceFees(response.data)
        }
      } catch (error) {
        console.error('加载服务费项目失败:', error)
      }
    }
    loadFees()
  }, [])

  // 加载运输价格数据
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const response = await getTransportPrices()
        if (response.errCode === 200 && response.data) {
          setTransportPrices(response.data)
        }
      } catch (error) {
        console.error('加载运输价格失败:', error)
      }
    }
    loadPrices()
  }, [])

  // 重新加载服务费数据
  const reloadServiceFees = async () => {
    try {
      const response = await getServiceFees()
      if (response.errCode === 200 && response.data) {
        setServiceFees(response.data)
      }
    } catch (error) {
      console.error('重新加载服务费项目失败:', error)
    }
  }

  // 重新加载运输价格数据
  const reloadTransportPrices = async () => {
    try {
      const response = await getTransportPrices()
      if (response.errCode === 200 && response.data) {
        setTransportPrices(response.data)
      }
    } catch (error) {
      console.error('重新加载运输价格失败:', error)
    }
  }

  // 添加服务费
  const handleAddFee = async () => {
    if (!newFee.name || !newFee.price) {
      alert('请填写名称和价格')
      return
    }
    try {
      const response = await createServiceFee({
        name: newFee.name || '',
        category: newFee.category || '其他服务',
        unit: newFee.unit || '票',
        price: Number(newFee.price) || 0,
        currency: newFee.currency || 'EUR',
        description: newFee.description || '',
        isActive: true,
      })
      if (response.errCode === 200) {
        await reloadServiceFees()
        setIsAddingFee(false)
        setNewFee({
          name: '',
          category: '报关服务',
          unit: '票',
          price: 0,
          currency: 'EUR',
          description: '',
          isActive: true,
        })
      } else {
        alert(response.msg || '添加失败')
      }
    } catch (error: any) {
      console.error('添加服务费失败:', error)
      alert(error.message || '添加失败，请稍后重试')
    }
  }

  // 更新服务费
  const handleUpdateFee = async () => {
    if (!editingFee) return
    try {
      const response = await updateServiceFee(editingFee.id, editingFee)
      if (response.errCode === 200) {
        await reloadServiceFees()
        setEditingFee(null)
      } else {
        alert(response.msg || '更新失败')
      }
    } catch (error: any) {
      console.error('更新服务费失败:', error)
      alert(error.message || '更新失败，请稍后重试')
    }
  }

  // 删除服务费
  const handleDeleteFee = async (id: string) => {
    if (confirm('确定要删除这个收费项目吗？')) {
      try {
        const response = await deleteServiceFee(id)
        if (response.errCode === 200) {
          await reloadServiceFees()
        } else {
          alert(response.msg || '删除失败')
        }
      } catch (error: any) {
        console.error('删除服务费失败:', error)
        alert(error.message || '删除失败，请稍后重试')
      }
    }
  }

  // 切换服务费状态
  const toggleFeeStatus = async (id: string) => {
    const fee = serviceFees.find(f => f.id === id)
    if (!fee) return
    try {
      const response = await updateServiceFee(id, { ...fee, isActive: !fee.isActive })
      if (response.errCode === 200) {
        await reloadServiceFees()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (error: any) {
      console.error('更新服务费状态失败:', error)
      alert(error.message || '更新状态失败，请稍后重试')
    }
  }

  // 保存运输价格（新增或编辑）
  const handleSaveTransport = async (data: TransportPriceItem) => {
    try {
      if (editingTransport) {
        // 编辑模式
        const response = await updateTransportPrice(data.id, data)
        if (response.errCode !== 200) {
          alert(response.msg || '更新失败')
          return
        }
      } else {
        // 新增模式 - 不传 id，后端会自动生成
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataWithoutId } = data
        const response = await createTransportPrice(dataWithoutId as Omit<TransportPriceItem, 'id'>)
        if (response.errCode !== 200) {
          alert(response.msg || '创建失败')
          return
        }
      }
      await reloadTransportPrices()
      setEditingTransport(null)
      setTransportModalVisible(false)
    } catch (error: any) {
      console.error('保存运输价格失败:', error)
      alert(error.message || '保存失败，请稍后重试')
    }
  }

  // 打开新增模态框
  const handleOpenAddModal = () => {
    setEditingTransport(null)
    setTransportModalVisible(true)
  }

  // 打开编辑模态框
  const handleOpenEditModal = (price: TransportPriceItem) => {
    setEditingTransport(price)
    setTransportModalVisible(true)
  }

  // 删除运输价格
  const handleDeleteTransport = async (id: string) => {
    if (confirm('确定要删除这个运输价格吗？')) {
      try {
        const response = await deleteTransportPrice(id)
        if (response.errCode === 200) {
          await reloadTransportPrices()
        } else {
          alert(response.msg || '删除失败')
        }
      } catch (error: any) {
        console.error('删除运输价格失败:', error)
        alert(error.message || '删除失败，请稍后重试')
      }
    }
  }

  // 切换运输价格状态
  const toggleTransportStatus = async (id: string) => {
    const price = transportPrices.find(p => p.id === id)
    if (!price) return
    try {
      const response = await updateTransportPrice(id, { ...price, isActive: !price.isActive })
      if (response.errCode === 200) {
        await reloadTransportPrices()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (error: any) {
      console.error('更新运输价格状态失败:', error)
      alert(error.message || '更新状态失败，请稍后重试')
    }
  }


  // 按类别分组服务费
  const groupedFees = feeCategories.reduce((acc, category) => {
    acc[category] = serviceFees.filter(fee => fee.category === category)
    return acc
  }, {} as Record<string, ServiceFeeItem[]>)

  return (
    <PageContainer>
      <PageHeader
        title="报价管理"
        icon={<DollarSign className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '报价管理' }
        ]}
      />
      
      {/* 自定义 Tab 导航 */}
      <ContentCard noPadding>
        <div className="border-b border-gray-200 px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('service-fees')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'service-fees'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              服务费项目
            </button>
            <button
              onClick={() => setActiveTab('transport-price')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'transport-price'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              运输价格
            </button>
          </div>
        </div>

        <div className="p-4">
        {/* 服务费项目管理 */}
        {activeTab === 'service-fees' && (
          <div className="space-y-3">
            {/* 添加按钮 */}
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-900">服务费收费项目</h2>
              <button
                onClick={() => setIsAddingFee(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                <Plus className="w-3 h-3" />
                新增项目
              </button>
            </div>

            {/* 新增表单 */}
            {isAddingFee && (
              <div className="bg-white rounded border border-gray-200 p-3 shadow-sm">
                <h3 className="text-xs font-medium text-gray-900 mb-3">新增收费项目</h3>
                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">项目名称 *</label>
                    <input
                      type="text"
                      value={newFee.name || ''}
                      onChange={(e) => setNewFee({ ...newFee, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      placeholder="如：报关费"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">类别</label>
                    <select
                      value={newFee.category || '报关服务'}
                      onChange={(e) => setNewFee({ ...newFee, category: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      {feeCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">单位</label>
                    <select
                      value={newFee.unit || '票'}
                      onChange={(e) => setNewFee({ ...newFee, unit: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      {unitOptions.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">价格 *</label>
                    <input
                      type="number"
                      value={newFee.price || ''}
                      onChange={(e) => setNewFee({ ...newFee, price: parseFloat(e.target.value) })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">币种</label>
                    <select
                      value={newFee.currency || 'EUR'}
                      onChange={(e) => setNewFee({ ...newFee, currency: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      {currencyOptions.map(cur => (
                        <option key={cur} value={cur}>{cur}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">说明</label>
                    <input
                      type="text"
                      value={newFee.description || ''}
                      onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      placeholder="费用说明"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setIsAddingFee(false)}
                    className="px-2 py-1 text-gray-600 hover:text-gray-800 text-xs"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddFee}
                    className="px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}

            {/* 服务费列表 - 按类别分组 */}
            {feeCategories.map(category => {
              const categoryFees = groupedFees[category] || []
              if (categoryFees.length === 0) return null
              
              return (
                <div key={category} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-900">{category}</h3>
                  </div>
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[180px]" />
                      <col className="w-[80px]" />
                      <col className="w-[120px]" />
                      <col className="w-auto" />
                      <col className="w-[80px]" />
                      <col className="w-[80px]" />
                    </colgroup>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">项目名称</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">单位</th>
                        <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">价格</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">说明</th>
                        <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500">状态</th>
                        <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categoryFees.map(fee => (
                        <tr key={fee.id} className={`hover:bg-gray-50 ${!fee.isActive ? 'opacity-50' : ''}`}>
                          {editingFee?.id === fee.id ? (
                            <>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={editingFee.name}
                                  onChange={(e) => setEditingFee({ ...editingFee, name: e.target.value })}
                                  className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <select
                                  value={editingFee.unit}
                                  onChange={(e) => setEditingFee({ ...editingFee, unit: e.target.value })}
                                  className="px-2 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                >
                                  {unitOptions.map(unit => (
                                    <option key={unit} value={unit}>{unit}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    value={editingFee.price}
                                    onChange={(e) => setEditingFee({ ...editingFee, price: parseFloat(e.target.value) })}
                                    className="w-16 px-2 py-0.5 border border-gray-300 rounded text-xs text-right bg-white"
                                  />
                                  <select
                                    value={editingFee.currency}
                                    onChange={(e) => setEditingFee({ ...editingFee, currency: e.target.value })}
                                    className="px-2 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                  >
                                    {currencyOptions.map(cur => (
                                      <option key={cur} value={cur}>{cur}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={editingFee.description}
                                  onChange={(e) => setEditingFee({ ...editingFee, description: e.target.value })}
                                  className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs ${
                                  editingFee.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {editingFee.isActive ? '启用' : '禁用'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={handleUpdateFee}
                                    className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                    title="保存"
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditingFee(null)}
                                    className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"
                                    title="取消"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-xs text-gray-900 font-medium">{fee.name}</td>
                              <td className="px-3 py-1.5 text-xs text-gray-600">{fee.unit}</td>
                              <td className="px-3 py-1.5 text-xs text-gray-900 text-right font-medium">
                                {Number(fee.price || 0).toFixed(2)} {fee.currency}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-gray-500">{fee.description}</td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  onClick={() => toggleFeeStatus(fee.id)}
                                  className={`inline-flex px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                                    fee.isActive 
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {fee.isActive ? '启用' : '禁用'}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => setEditingFee(fee)}
                                    className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                                    title="编辑"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFee(fee.id)}
                                    className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                    title="删除"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}

        {/* 运输价格管理 */}
        {activeTab === 'transport-price' && (
          <div className="space-y-3">
            {/* 添加按钮 */}
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-900">运输价格管理</h2>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                <Plus className="w-3 h-3" />
                新增价格
              </button>
            </div>

            {/* 运输价格列表 */}
            <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-[70px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col className="w-auto" />
                  <col className="w-[70px]" />
                  <col className="w-[70px]" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">价格名称</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">起运地</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">目的地</th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500">方式</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">公里数</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">公里单价</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">运输总价</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">说明</th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500">状态</th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transportPrices.map(price => (
                    <tr key={price.id} className={`hover:bg-gray-50 ${!price.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-1.5 text-xs text-gray-900 font-medium">{price.name}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{price.origin}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{price.destination}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600 text-center">
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                          {price.transportType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-900 text-right font-medium">
                        {Number(price.distance || 0).toFixed(0)} KM
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-900 text-right font-medium">
                        {Number(price.pricePerKm || 0).toFixed(2)} {price.currency}/KM
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-900 text-right font-medium text-green-600">
                        {Number(price.totalPrice || 0).toFixed(2)} {price.currency}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{price.description}</td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={() => toggleTransportStatus(price.id)}
                          className={`inline-flex px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                            price.isActive 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {price.isActive ? '启用' : '禁用'}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(price)}
                            className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransport(price.id)}
                            className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 计费说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <h4 className="text-xs font-medium text-blue-800 mb-1">计费说明</h4>
              <ul className="text-xs text-blue-700 space-y-0.5">
                <li>• 公里数：从起运地到目的地的运输距离</li>
                <li>• 公里单价：每公里的运输费用</li>
                <li>• 运输总价 = 公里数 × 公里单价</li>
                <li>• 如果输入总价和公里数，系统会自动反推公里单价</li>
              </ul>
            </div>
          </div>
        )}
        </div>
      </ContentCard>

      {/* 运输价格编辑模态框 */}
      <TransportPriceModal
        visible={transportModalVisible}
        onClose={() => {
          setTransportModalVisible(false)
          setEditingTransport(null)
        }}
        onSave={handleSaveTransport}
        editData={editingTransport}
      />
    </PageContainer>
  )
}
