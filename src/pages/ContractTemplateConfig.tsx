/**
 * 合同模板配置页面
 * 配置清关合同的各项参数、赔偿标准、保险费率、高峰期等
 */

import { useState, useEffect } from 'react'
import { 
  Settings, DollarSign, Shield, Calendar, FileText,
  Plus, Edit2, Trash2, Save, X, AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface TemplateConfig {
  [key: string]: {
    value: string | number | string[]
    type: string
    description: string
  }
}

interface CompensationRule {
  id: number
  category: string
  category_name: string
  max_compensation: number
  container_types: string
  notes: string
  is_active: number
}

interface InsuranceConfig {
  id: number
  category: string
  category_name: string
  normal_cap: number
  insured_cap: number
  premium_per_10k: number
  is_active: number
}

interface PeakSeason {
  id: number
  season_name: string
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  notes: string
  is_active: number
}

export default function ContractTemplateConfig() {
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 基础配置
  const [config, setConfig] = useState<TemplateConfig>({})
  const [basicConfig, setBasicConfig] = useState({
    payment_days: 7,
    late_fee_rate: 0.2,
    max_overdue_days: 15,
    clearance_days: 15,
    insurance_premium_per_10k: 500,
    delay_notice_days: 30
  })
  
  // 赔偿标准
  const [compensationRules, setCompensationRules] = useState<CompensationRule[]>([])
  const [showCompensationModal, setShowCompensationModal] = useState(false)
  const [editingCompensation, setEditingCompensation] = useState<CompensationRule | null>(null)
  
  // 保险配置
  const [insuranceConfig, setInsuranceConfig] = useState<InsuranceConfig[]>([])
  
  // 高峰期
  const [peakSeasons, setPeakSeasons] = useState<PeakSeason[]>([])
  const [showPeakSeasonModal, setShowPeakSeasonModal] = useState(false)
  const [editingPeakSeason, setEditingPeakSeason] = useState<PeakSeason | null>(null)
  
  // 免责条款
  const [disclaimerClauses, setDisclaimerClauses] = useState<string[]>([])
  const [newClause, setNewClause] = useState('')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadConfig(),
        loadCompensationRules(),
        loadInsuranceConfig(),
        loadPeakSeasons()
      ])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/config`)
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        setBasicConfig({
          payment_days: data.data.payment_days?.value || 7,
          late_fee_rate: data.data.late_fee_rate?.value || 0.2,
          max_overdue_days: data.data.max_overdue_days?.value || 15,
          clearance_days: data.data.clearance_days?.value || 15,
          insurance_premium_per_10k: data.data.insurance_premium_per_10k?.value || 500,
          delay_notice_days: data.data.delay_notice_days?.value || 30
        })
        if (data.data.disclaimer_clauses?.value) {
          setDisclaimerClauses(data.data.disclaimer_clauses.value)
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  const loadCompensationRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/compensation?active=false`)
      const data = await res.json()
      if (data.success) {
        setCompensationRules(data.data)
      }
    } catch (error) {
      console.error('加载赔偿标准失败:', error)
    }
  }

  const loadInsuranceConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/insurance?active=false`)
      const data = await res.json()
      if (data.success) {
        setInsuranceConfig(data.data)
      }
    } catch (error) {
      console.error('加载保险配置失败:', error)
    }
  }

  const loadPeakSeasons = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/peak-seasons?active=false`)
      const data = await res.json()
      if (data.success) {
        setPeakSeasons(data.data)
      }
    } catch (error) {
      console.error('加载高峰期配置失败:', error)
    }
  }

  // 保存基础配置
  const saveBasicConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: basicConfig })
      })
      const data = await res.json()
      if (data.success) {
        alert('配置保存成功')
      } else {
        alert('保存失败: ' + data.message)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存赔偿标准
  const saveCompensationRule = async (rule: Partial<CompensationRule>) => {
    try {
      // 修复：使用 editingCompensation 对象存在性判断
      const isEditing = Boolean(editingCompensation && editingCompensation.id)
      const url = isEditing 
        ? `${API_BASE}/api/contract-template/compensation/${editingCompensation!.id}`
        : `${API_BASE}/api/contract-template/compensation`
      
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      })
      const data = await res.json()
      if (data.success) {
        setShowCompensationModal(false)
        setEditingCompensation(null)
        loadCompensationRules()
      } else {
        alert('保存失败: ' + data.message)
      }
    } catch (error) {
      console.error('保存赔偿标准失败:', error)
      alert('保存失败')
    }
  }

  // 删除赔偿标准
  const deleteCompensationRule = async (id: number) => {
    if (!confirm('确定要删除该赔偿标准吗？')) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/compensation/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        loadCompensationRules()
      }
    } catch (error) {
      console.error('删除赔偿标准失败:', error)
    }
  }

  // 保存保险配置
  const saveInsuranceConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/insurance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: insuranceConfig })
      })
      const data = await res.json()
      if (data.success) {
        alert('保险配置保存成功')
      } else {
        alert('保存失败: ' + data.message)
      }
    } catch (error) {
      console.error('保存保险配置失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存高峰期
  const savePeakSeason = async (season: Partial<PeakSeason>) => {
    try {
      // 修复：使用 editingPeakSeason 对象存在性判断
      const isEditing = Boolean(editingPeakSeason && editingPeakSeason.id)
      const url = isEditing 
        ? `${API_BASE}/api/contract-template/peak-seasons/${editingPeakSeason!.id}`
        : `${API_BASE}/api/contract-template/peak-seasons`
      
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(season)
      })
      const data = await res.json()
      if (data.success) {
        setShowPeakSeasonModal(false)
        setEditingPeakSeason(null)
        loadPeakSeasons()
      } else {
        alert('保存失败: ' + data.message)
      }
    } catch (error) {
      console.error('保存高峰期失败:', error)
      alert('保存失败')
    }
  }

  // 删除高峰期
  const deletePeakSeason = async (id: number) => {
    if (!confirm('确定要删除该高峰期配置吗？')) return
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/peak-seasons/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        loadPeakSeasons()
      }
    } catch (error) {
      console.error('删除高峰期失败:', error)
    }
  }

  // 保存免责条款
  const saveDisclaimerClauses = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: { disclaimer_clauses: disclaimerClauses } })
      })
      const data = await res.json()
      if (data.success) {
        alert('免责条款保存成功')
      } else {
        alert('保存失败: ' + data.message)
      }
    } catch (error) {
      console.error('保存免责条款失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 添加免责条款
  const addClause = () => {
    if (newClause.trim()) {
      setDisclaimerClauses([...disclaimerClauses, newClause.trim()])
      setNewClause('')
    }
  }

  // 删除免责条款
  const removeClause = (index: number) => {
    setDisclaimerClauses(disclaimerClauses.filter((_, i) => i !== index))
  }

  const tabs = [
    { id: 'basic', label: '基础配置', icon: Settings },
    { id: 'compensation', label: '赔偿标准', icon: DollarSign },
    { id: 'insurance', label: '保险配置', icon: Shield },
    { id: 'peak-seasons', label: '高峰期', icon: Calendar },
    { id: 'disclaimer', label: '免责条款', icon: FileText }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="合同模板配置"
        description="配置清关合同的各项参数和条款"
      />

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* 基础配置 */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    货到后付款天数
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={basicConfig.payment_days}
                      onChange={e => setBasicConfig({ ...basicConfig, payment_days: parseInt(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">天</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    超期违约金比例
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={basicConfig.late_fee_rate}
                      onChange={e => setBasicConfig({ ...basicConfig, late_fee_rate: parseFloat(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">%/天</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大超期天数
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={basicConfig.max_overdue_days}
                      onChange={e => setBasicConfig({ ...basicConfig, max_overdue_days: parseInt(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">天</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">超过此天数可扣押货物</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    正常清关工作日
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={basicConfig.clearance_days}
                      onChange={e => setBasicConfig({ ...basicConfig, clearance_days: parseInt(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">工作日</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    保险费用（每万欧）
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={basicConfig.insurance_premium_per_10k}
                      onChange={e => setBasicConfig({ ...basicConfig, insurance_premium_per_10k: parseInt(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    合同修改提前通知
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={basicConfig.delay_notice_days}
                      onChange={e => setBasicConfig({ ...basicConfig, delay_notice_days: parseInt(e.target.value) })}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-gray-500">天</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveBasicConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          )}

          {/* 赔偿标准 */}
          {activeTab === 'compensation' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">配置不同货物类型的最高赔偿金额</p>
                <button
                  onClick={() => {
                    setEditingCompensation(null)
                    setShowCompensationModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  新增类型
                </button>
              </div>

              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">货物类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最高赔偿（€）</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">适用柜型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {compensationRules.map(rule => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium">{rule.category_name}</span>
                        <span className="text-gray-400 text-xs ml-2">({rule.category})</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-primary-600 font-medium">
                        €{Number(rule.max_compensation).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {rule.container_types}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {rule.notes}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.is_active ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCompensation(rule)
                              setShowCompensationModal(true)
                            }}
                            className="text-gray-400 hover:text-primary-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCompensationRule(rule.id)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 保险配置 */}
          {activeTab === 'insurance' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">配置不同货物类型的保险封顶金额</p>

              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">货物类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">正常封顶（€）</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">投保后封顶（€）</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">每万欧保费（€）</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {insuranceConfig.map((config, index) => (
                    <tr key={config.id}>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {config.category_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={config.normal_cap}
                          onChange={e => {
                            const newConfig = [...insuranceConfig]
                            newConfig[index].normal_cap = parseFloat(e.target.value)
                            setInsuranceConfig(newConfig)
                          }}
                          className="w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={config.insured_cap}
                          onChange={e => {
                            const newConfig = [...insuranceConfig]
                            newConfig[index].insured_cap = parseFloat(e.target.value)
                            setInsuranceConfig(newConfig)
                          }}
                          className="w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={config.premium_per_10k}
                          onChange={e => {
                            const newConfig = [...insuranceConfig]
                            newConfig[index].premium_per_10k = parseFloat(e.target.value)
                            setInsuranceConfig(newConfig)
                          }}
                          className="w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <button
                  onClick={saveInsuranceConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          )}

          {/* 高峰期 */}
          {activeTab === 'peak-seasons' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">配置海运高峰期免责时段</p>
                <button
                  onClick={() => {
                    setEditingPeakSeason(null)
                    setShowPeakSeasonModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  新增高峰期
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {peakSeasons.map(season => (
                  <div key={season.id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{season.season_name}</h4>
                        <p className="text-orange-600 font-medium mt-1">
                          {season.start_month}月{season.start_day}日 - {season.end_month}月{season.end_day}日
                        </p>
                        {season.notes && (
                          <p className="text-sm text-gray-600 mt-2">{season.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPeakSeason(season)
                            setShowPeakSeasonModal(true)
                          }}
                          className="text-gray-400 hover:text-primary-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePeakSeason(season.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 免责条款 */}
          {activeTab === 'disclaimer' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-700">免责条款将显示在合同的"七、免责条款"部分</p>
              </div>

              <div className="space-y-3">
                {disclaimerClauses.map((clause, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50">
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <p className="flex-1 text-sm text-gray-700">{clause}</p>
                    <button
                      onClick={() => removeClause(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <textarea
                  value={newClause}
                  onChange={e => setNewClause(e.target.value)}
                  placeholder="输入新的免责条款..."
                  rows={3}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <button
                  onClick={addClause}
                  disabled={!newClause.trim()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 self-end"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveDisclaimerClauses}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存免责条款'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 赔偿标准弹窗 */}
      {showCompensationModal && (
        <CompensationModal
          rule={editingCompensation}
          onSave={saveCompensationRule}
          onClose={() => {
            setShowCompensationModal(false)
            setEditingCompensation(null)
          }}
        />
      )}

      {/* 高峰期弹窗 */}
      {showPeakSeasonModal && (
        <PeakSeasonModal
          season={editingPeakSeason}
          onSave={savePeakSeason}
          onClose={() => {
            setShowPeakSeasonModal(false)
            setEditingPeakSeason(null)
          }}
        />
      )}
    </div>
  )
}

// 赔偿标准编辑弹窗
function CompensationModal({ rule, onSave, onClose }: {
  rule: CompensationRule | null
  onSave: (data: Partial<CompensationRule>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    category: rule?.category || '',
    category_name: rule?.category_name || '',
    max_compensation: rule?.max_compensation || 0,
    container_types: rule?.container_types || '40GP,40HQ,45HC,45HQ',
    notes: rule?.notes || '',
    is_active: rule?.is_active ?? 1
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-medium mb-4">{rule ? '编辑赔偿标准' : '新增赔偿标准'}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类型代码</label>
            <input
              type="text"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              placeholder="如: oversized, clothing"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类型名称</label>
            <input
              type="text"
              value={formData.category_name}
              onChange={e => setFormData({ ...formData, category_name: e.target.value })}
              placeholder="如: 超大件、服装"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">最高赔偿（€）</label>
            <input
              type="number"
              value={formData.max_compensation}
              onChange={e => setFormData({ ...formData, max_compensation: parseFloat(e.target.value) })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">适用柜型</label>
            <input
              type="text"
              value={formData.container_types}
              onChange={e => setFormData({ ...formData, container_types: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active === 1}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">启用</label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// 高峰期编辑弹窗
function PeakSeasonModal({ season, onSave, onClose }: {
  season: PeakSeason | null
  onSave: (data: Partial<PeakSeason>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    season_name: season?.season_name || '',
    start_month: season?.start_month || 8,
    start_day: season?.start_day || 15,
    end_month: season?.end_month || 9,
    end_day: season?.end_day || 15,
    notes: season?.notes || '',
    is_active: season?.is_active ?? 1
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-medium mb-4">{season ? '编辑高峰期' : '新增高峰期'}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">高峰期名称</label>
            <input
              type="text"
              value={formData.season_name}
              onChange={e => setFormData({ ...formData, season_name: e.target.value })}
              placeholder="如: 暑期高峰、圣诞新年高峰"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始月份</label>
              <select
                value={formData.start_month}
                onChange={e => setFormData({ ...formData, start_month: parseInt(e.target.value) })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="number"
                min={1}
                max={31}
                value={formData.start_day}
                onChange={e => setFormData({ ...formData, start_day: parseInt(e.target.value) })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束月份</label>
              <select
                value={formData.end_month}
                onChange={e => setFormData({ ...formData, end_month: parseInt(e.target.value) })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="number"
                min={1}
                max={31}
                value={formData.end_day}
                onChange={e => setFormData({ ...formData, end_day: parseInt(e.target.value) })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注说明</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="说明该高峰期的特殊情况..."
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
