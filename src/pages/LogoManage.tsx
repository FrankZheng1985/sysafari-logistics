import { useState, useEffect } from 'react'
import { Image, Upload, X, Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

export default function LogoManage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 加载已保存的 Logo
  useEffect(() => {
    const loadLogo = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/system-settings?key=systemLogo`)
        const data = await res.json()
        if (data.errCode === 200 && data.data?.systemLogo) {
          setLogoUrl(data.data.systemLogo)
          setPreviewUrl(data.data.systemLogo)
        }
      } catch (error) {
        console.error('加载Logo失败:', error)
      } finally {
        setLoading(false)
      }
    }
    loadLogo()
  }, [])

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（限制为 2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB')
      return
    }

    // 读取文件并转换为 base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setPreviewUrl(base64)
    }
    reader.readAsDataURL(file)
  }

  // 保存 Logo
  const handleSave = async () => {
    if (!previewUrl) {
      alert('请先选择图片')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/system-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'systemLogo',
          value: previewUrl,
          type: 'string',
          description: '系统Logo'
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setLogoUrl(previewUrl)
        // 触发事件通知 Sidebar 更新
        window.dispatchEvent(new Event('logoChanged'))
        alert('Logo 保存成功')
      } else {
        alert('保存失败: ' + data.msg)
      }
    } catch (error) {
      console.error('保存Logo失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 删除 Logo
  const handleDelete = async () => {
    if (!confirm('确定要删除 Logo 吗？')) return

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/system-settings/systemLogo`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setLogoUrl(null)
        setPreviewUrl(null)
        // 触发事件通知 Sidebar 更新
        window.dispatchEvent(new Event('logoChanged'))
        alert('Logo 已删除')
      } else {
        alert('删除失败: ' + data.msg)
      }
    } catch (error) {
      console.error('删除Logo失败:', error)
      alert('删除失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Logo 管理"
        icon={<Image className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: 'Logo 管理' }
        ]}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-900 mb-3">上传 Logo</h2>
            
            {/* 当前 Logo 预览 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                当前 Logo
              </label>
              <div className="border border-gray-200 rounded p-2 bg-gray-50 flex items-center justify-center min-h-[80px]">
                {loading ? (
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                ) : logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="系统 Logo"
                    className="max-w-full max-h-20 object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-xs">暂无 Logo</div>
                )}
              </div>
            </div>

            {/* 预览区域 */}
            {previewUrl && previewUrl !== logoUrl && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  预览
                </label>
                <div className="border border-gray-200 rounded p-2 bg-gray-50 flex items-center justify-center min-h-[80px]">
                  <img
                    src={previewUrl}
                    alt="Logo 预览"
                    className="max-w-full max-h-20 object-contain"
                  />
                </div>
              </div>
            )}

            {/* 文件上传 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                选择图片文件
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer transition-colors text-xs">
                  <Upload className="w-3 h-3" />
                  <span>选择文件</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500">
                  支持 JPG、PNG、GIF 格式，最大 2MB
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!previewUrl || previewUrl === logoUrl || saving}
                className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs flex items-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                保存
              </button>
              {logoUrl && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors text-xs flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>删除 Logo</span>
                </button>
              )}
              {previewUrl && previewUrl !== logoUrl && (
                <button
                  onClick={() => setPreviewUrl(logoUrl)}
                  disabled={saving}
                  className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100 transition-colors text-xs"
                >
                  取消
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

