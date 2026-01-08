import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Edit2, Trash2, Building2, CheckCircle, 
  X, Star, CreditCard
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface BankAccount {
  id: number
  accountName: string
  accountNumber: string
  bankName: string
  bankBranch: string
  swiftCode: string
  iban: string
  currency: string
  accountType: string
  isDefault: boolean
  isActive: boolean
  notes: string
}

const ACCOUNT_TYPES = [
  { value: 'current', label: '活期账户' },
  { value: 'savings', label: '储蓄账户' },
  { value: 'business', label: '对公账户' }
]

const CURRENCIES = [
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'USD', label: 'USD - 美元' },
  { value: 'CNY', label: 'CNY - 人民币' },
  { value: 'GBP', label: 'GBP - 英镑' }
]

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    bankBranch: '',
    swiftCode: '',
    iban: '',
    currency: 'EUR',
    accountType: 'current',
    isDefault: false,
    isActive: true,
    notes: ''
  })

  const navigate = useNavigate()
  
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
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/bank-accounts`)
      const data = await res.json()
      if (data.errCode === 200) {
        setAccounts(data.data || [])
      }
    } catch (error) {
      console.error('加载银行账户失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        bankBranch: account.bankBranch || '',
        swiftCode: account.swiftCode || '',
        iban: account.iban || '',
        currency: account.currency || 'EUR',
        accountType: account.accountType || 'current',
        isDefault: account.isDefault,
        isActive: account.isActive,
        notes: account.notes || ''
      })
    } else {
      setEditingAccount(null)
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: '',
        bankBranch: '',
        swiftCode: '',
        iban: '',
        currency: 'EUR',
        accountType: 'current',
        isDefault: false,
        isActive: true,
        notes: ''
      })
    }
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!formData.accountName || !formData.accountNumber || !formData.bankName) {
      alert('请填写账户名称、账号和银行名称')
      return
    }

    setSaving(true)
    try {
      const url = editingAccount
        ? `${API_BASE}/api/bank-accounts/${editingAccount.id}`
        : `${API_BASE}/api/bank-accounts`
      
      const res = await fetch(url, {
        method: editingAccount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (data.errCode === 200) {
        setModalVisible(false)
        loadAccounts()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (account: BankAccount) => {
    if (!confirm(`确定要删除银行账户 "${account.accountName}" 吗？`)) return

    try {
      const res = await fetch(`${API_BASE}/api/bank-accounts/${account.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadAccounts()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/bank-accounts"
        onTabChange={(path) => navigate(path)}
      />

      <div className="p-4 space-y-4">
        {/* 工具栏 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">银行账户管理</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            添加账户
          </button>
        </div>

        {/* 账户列表 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">加载中...</div>
          ) : accounts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>暂无银行账户</p>
              <p className="text-sm mt-1">点击"添加账户"创建第一个银行账户</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">账户名称</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">银行/账号</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">SWIFT/IBAN</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">币种</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">状态</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {account.accountName}
                            {account.isDefault && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {ACCOUNT_TYPES.find(t => t.value === account.accountType)?.label}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900">{account.bankName}</div>
                      <div className="text-xs text-gray-500 font-mono">{account.accountNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-600">
                        {account.swiftCode && <div>SWIFT: {account.swiftCode}</div>}
                        {account.iban && <div className="font-mono">{account.iban}</div>}
                        {!account.swiftCode && !account.iban && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {account.currency}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        account.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {account.isActive ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(account)}
                          className="p-1 text-gray-400 hover:text-primary-600 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalVisible(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingAccount ? '编辑银行账户' : '添加银行账户'}
              </h3>
              <button onClick={() => setModalVisible(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 账户名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  账户名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={e => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="如：公司欧元账户"
                />
              </div>

              {/* 银行名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  银行名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="如：中国银行法兰克福分行"
                />
              </div>

              {/* 银行账号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  银行账号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="请输入银行账号"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* SWIFT Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Code</label>
                  <input
                    type="text"
                    value={formData.swiftCode}
                    onChange={e => setFormData({ ...formData, swiftCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                    placeholder="如：BKCHDEFX"
                  />
                </div>

                {/* 币种 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* IBAN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={e => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="如：DE89370400440532013000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 账户类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">账户类型</label>
                  <select
                    value={formData.accountType}
                    onChange={e => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {ACCOUNT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* 开户支行 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开户支行</label>
                  <input
                    type="text"
                    value={formData.bankBranch}
                    onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="支行名称"
                  />
                </div>
              </div>

              {/* 状态选项 */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">设为默认账户</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">启用</span>
                </label>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="备注信息"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setModalVisible(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
