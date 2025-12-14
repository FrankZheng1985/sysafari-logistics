import { Shield, Check, X, Edit2, Save, Loader2, Info, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import RoleModal from '../components/RoleModal'
import { 
  getRoleList, 
  getPermissionList,
  getRolePermissions,
  updateRolePermissions,
  type Role,
  type Permission
} from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

// 权限分组配置
const permissionGroups = [
  { 
    key: 'order', 
    label: '订单管理', 
    icon: '📦',
    description: '提单的查看、创建、编辑、删除等权限'
  },
  { 
    key: 'inspection', 
    label: '查验管理', 
    icon: '🔍',
    description: '查验流程的查看和操作权限'
  },
  { 
    key: 'cmr', 
    label: 'CMR管理', 
    icon: '🚚',
    description: 'CMR派送的查看和操作权限'
  },
  { 
    key: 'tool', 
    label: '工具箱', 
    icon: '🔧',
    description: '报价、关税计算、海关编码等工具的访问权限'
  },
  { 
    key: 'system', 
    label: '系统管理', 
    icon: '⚙️',
    description: '用户管理、基础数据、系统设置等管理权限'
  },
]

export default function RolePermissions() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [tempPermissions, setTempPermissions] = useState<string[]>([])
  const [roleModalVisible, setRoleModalVisible] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      // 并行加载角色和权限列表
      const [rolesRes, permissionsRes] = await Promise.all([
        getRoleList(),
        getPermissionList()
      ])

      if (rolesRes.errCode === 200 && rolesRes.data) {
        setRoles(rolesRes.data)
        
        // 加载每个角色的权限
        const permMap: Record<string, string[]> = {}
        for (const role of rolesRes.data) {
          const permRes = await getRolePermissions(role.roleCode)
          if (permRes.errCode === 200 && permRes.data) {
            permMap[role.roleCode] = permRes.data.map((p: Permission) => p.permissionCode)
          }
        }
        setRolePermissions(permMap)
      }

      if (permissionsRes.errCode === 200 && permissionsRes.data) {
        setPermissions(permissionsRes.data.list || [])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleEdit = (roleCode: string) => {
    setEditingRole(roleCode)
    setTempPermissions([...(rolePermissions[roleCode] || [])])
  }

  const handleCancel = () => {
    setEditingRole(null)
    setTempPermissions([])
  }

  const handleSave = async () => {
    if (!editingRole) return

    setSaving(true)
    try {
      const response = await updateRolePermissions(editingRole, tempPermissions)
      if (response.errCode === 200) {
        setRolePermissions(prev => ({
          ...prev,
          [editingRole]: tempPermissions
        }))
        setEditingRole(null)
        setTempPermissions([])
      } else {
        alert(response.msg || '保存失败')
      }
    } catch (error: any) {
      console.error('保存权限失败:', error)
      alert(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (permissionCode: string) => {
    setTempPermissions(prev => 
      prev.includes(permissionCode)
        ? prev.filter(p => p !== permissionCode)
        : [...prev, permissionCode]
    )
  }

  const toggleGroupPermissions = (groupKey: string, checked: boolean) => {
    const groupPerms = permissions.filter(p => p.category === groupKey).map(p => p.permissionCode)
    if (checked) {
      setTempPermissions(prev => [...new Set([...prev, ...groupPerms])])
    } else {
      setTempPermissions(prev => prev.filter(p => !groupPerms.includes(p)))
    }
  }

  const getGroupPermissions = (groupKey: string) => {
    return permissions.filter(p => p.category === groupKey)
  }

  const isGroupChecked = (roleCode: string, groupKey: string) => {
    const groupPerms = getGroupPermissions(groupKey)
    const rolePerms = editingRole === roleCode ? tempPermissions : (rolePermissions[roleCode] || [])
    return groupPerms.length > 0 && groupPerms.every(p => rolePerms.includes(p.permissionCode))
  }

  const isGroupPartialChecked = (roleCode: string, groupKey: string) => {
    const groupPerms = getGroupPermissions(groupKey)
    const rolePerms = editingRole === roleCode ? tempPermissions : (rolePermissions[roleCode] || [])
    const checkedCount = groupPerms.filter(p => rolePerms.includes(p.permissionCode)).length
    return checkedCount > 0 && checkedCount < groupPerms.length
  }

  const hasPermissionCheck = (roleCode: string, permissionCode: string) => {
    const rolePerms = editingRole === roleCode ? tempPermissions : (rolePermissions[roleCode] || [])
    return rolePerms.includes(permissionCode)
  }

  const getRoleColor = (roleCode: string) => {
    switch (roleCode) {
      case 'admin': return 'bg-red-100 text-red-700 border-red-200'
      case 'manager': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'operator': return 'bg-green-100 text-green-700 border-green-200'
      case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader
          title="用户管理"
          icon={<Shield className="w-4 h-4 text-primary-600" />}
          breadcrumbs={[
            { label: '系统管理', path: '/system/menu-settings' },
            { label: '用户管理' }
          ]}
          tabs={[
            { label: '用户列表', path: '/system/user-manage' },
            { label: '角色权限', path: '/system/user-manage/permissions' },
          ]}
          activeTab="/system/user-manage/permissions"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
          <span className="ml-2 text-xs text-gray-600">加载中...</span>
        </div>
      </div>
    )
  }

  // 添加角色
  const handleAddRole = () => {
    setRoleModalVisible(true)
  }

  // 角色添加成功后刷新数据
  const handleRoleSuccess = () => {
    loadData()
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="用户管理"
        icon={<Shield className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: '用户管理' }
        ]}
        tabs={[
          { label: '用户列表', path: '/system/user-manage' },
          { label: '角色权限', path: '/system/user-manage/permissions' },
        ]}
        activeTab="/system/user-manage/permissions"
        onTabChange={(path) => navigate(path)}
        actionButtons={
          hasPermission('system:user') && (
            <button
              onClick={handleAddRole}
              className="px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加角色
            </button>
          )
        }
      />

      <div className="flex-1 overflow-auto p-4">
        {/* 说明信息 */}
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-0.5">角色权限说明</p>
            <p>• 系统管理员(admin): 拥有所有权限，不可修改</p>
            <p>• 业务经理(manager): 可查看所有订单，管理团队成员</p>
            <p>• 操作员(operator): 处理分配的订单，执行日常操作</p>
            <p>• 查看者(viewer): 只能查看分配的订单，无法操作</p>
          </div>
        </div>

        {/* 角色权限矩阵 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* 表格头部 - 带编辑按钮 */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-700">角色权限配置</span>
            {hasPermission('system:user') && (
              editingRole ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-1.5 py-0.5 text-xs text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-1.5 py-0.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleEdit('manager')}
                  className="px-1.5 py-0.5 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  编辑权限
                </button>
              )
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* 表头 - 角色名称 */}
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200">
                  <th className="text-left px-3 py-1.5 text-xs font-semibold text-gray-700 w-44 sticky left-0 bg-gray-50/50 z-10">
                    权限 / 角色
                  </th>
                  {roles.map(role => (
                    <th key={role.roleCode} className="text-center px-3 py-1.5 min-w-24">
                      {editingRole && role.roleCode !== 'admin' ? (
                        <button
                          onClick={() => handleEdit(role.roleCode)}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium border transition-all ${
                            editingRole === role.roleCode 
                              ? 'ring-2 ring-primary-500 ring-offset-1 ' + getRoleColor(role.roleCode)
                              : getRoleColor(role.roleCode) + ' opacity-60 hover:opacity-100'
                          }`}
                          title={editingRole === role.roleCode ? '正在编辑' : '点击切换编辑此角色'}
                        >
                          {role.roleName}
                        </button>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getRoleColor(role.roleCode)}`}>
                          {role.roleName}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {permissionGroups.map(group => {
                  const groupPerms = getGroupPermissions(group.key)
                  if (groupPerms.length === 0) return null

                  return (
                    <>
                      {/* 分组标题行 */}
                      <tr key={`group-${group.key}`} className="bg-gray-50/50">
                        <td className="px-3 py-1.5 sticky left-0 bg-gray-50/50 z-10">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{group.icon}</span>
                            <div>
                              <div className="text-xs font-semibold text-gray-800">{group.label}</div>
                              <div className="text-[10px] text-gray-500">{group.description}</div>
                            </div>
                          </div>
                        </td>
                        {roles.map(role => {
                          const isChecked = isGroupChecked(role.roleCode, group.key)
                          const isPartial = isGroupPartialChecked(role.roleCode, group.key)
                          const isEditing = editingRole === role.roleCode
                          const isAdmin = role.roleCode === 'admin'

                          return (
                            <td key={`${group.key}-${role.roleCode}`} className="px-3 py-1.5">
                              <div className="flex items-center justify-center">
                                {isEditing && !isAdmin ? (
                                  <button
                                    onClick={() => toggleGroupPermissions(group.key, !isChecked)}
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                      isChecked 
                                        ? 'bg-primary-600 border-primary-600' 
                                        : isPartial
                                          ? 'bg-primary-200 border-primary-400'
                                          : 'border-gray-300 hover:border-primary-400'
                                    }`}
                                    title={isChecked ? '取消全选' : '全选'}
                                  >
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                    {isPartial && !isChecked && <div className="w-1.5 h-0.5 bg-primary-600" />}
                                  </button>
                                ) : (
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    isChecked 
                                      ? 'bg-primary-600 border-primary-600' 
                                      : isPartial
                                        ? 'bg-primary-200 border-primary-400'
                                        : 'border-gray-200'
                                  }`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                    {isPartial && !isChecked && <div className="w-1.5 h-0.5 bg-primary-600" />}
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>

                      {/* 具体权限行 */}
                      {groupPerms.map(perm => (
                        <tr key={perm.permissionCode} className="border-t border-gray-100 hover:bg-gray-50/30">
                          <td className="px-3 py-1 pl-8 sticky left-0 bg-white z-10">
                            <div className="text-xs text-gray-700">{perm.permissionName}</div>
                            <div className="text-[10px] text-gray-400">{perm.permissionCode}</div>
                          </td>
                          {roles.map(role => {
                            const hasPerm = hasPermissionCheck(role.roleCode, perm.permissionCode)
                            const isEditing = editingRole === role.roleCode
                            const isAdmin = role.roleCode === 'admin'

                            return (
                              <td key={`${perm.permissionCode}-${role.roleCode}`} className="px-3 py-1">
                                <div className="flex items-center justify-center">
                                  {isEditing && !isAdmin ? (
                                    <button
                                      onClick={() => togglePermission(perm.permissionCode)}
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                        hasPerm 
                                          ? 'bg-green-500 border-green-500' 
                                          : 'border-gray-300 hover:border-green-400'
                                      }`}
                                    >
                                      {hasPerm && <Check className="w-2 h-2 text-white" />}
                                    </button>
                                  ) : (
                                    hasPerm ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <X className="w-3.5 h-3.5 text-gray-300" />
                                    )
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部统计 */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {roles.map(role => {
            const permCount = (rolePermissions[role.roleCode] || []).length
            const totalPerms = permissions.length
            const percentage = totalPerms > 0 ? Math.round((permCount / totalPerms) * 100) : 0

            return (
              <div key={role.roleCode} className="bg-white rounded-lg border border-gray-200 p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getRoleColor(role.roleCode)}`}>
                    {role.roleName}
                  </span>
                  <span className="text-[10px] text-gray-500">{permCount}/{totalPerms}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full transition-all ${
                      role.roleCode === 'admin' ? 'bg-red-500' :
                      role.roleCode === 'manager' ? 'bg-blue-500' :
                      role.roleCode === 'operator' ? 'bg-green-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 text-right">{percentage}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 添加角色模态框 */}
      <RoleModal
        visible={roleModalVisible}
        onClose={() => setRoleModalVisible(false)}
        onSuccess={handleRoleSuccess}
      />
    </div>
  )
}

