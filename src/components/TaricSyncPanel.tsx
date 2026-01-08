/**
 * TARIC 同步状态面板
 * 显示 TARIC 数据同步状态，支持上传文件和手动触发同步
 */

import { useState, useEffect, useRef } from 'react'
import {
  RefreshCw,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react'
import { formatDateTime } from '../utils/dateFormat'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface SyncStatus {
  lastSync: {
    id: string
    syncType: string
    status: string
    totalRecords: number
    insertedCount: number
    updatedCount: number
    failedCount: number
    taricVersion: string
    completedAt: string
  } | null
  currentSync: {
    id: string
    startTime: number
  } | null
  tariffStats: {
    total: number
    active: number
    fromTaric: number
    lastSyncTime: string
  }
  files: {
    nomenclature: FileStatus
    duties: FileStatus
  }
  taricVersion: string
}

interface FileStatus {
  name: string
  description: string
  localFile: string
  exists: boolean
  fileInfo: {
    size: number
    sizeFormatted: string
    modifiedTime: string
    modifiedTimeFormatted: string
  } | null
  manualDownloadUrl: string
}

export default function TaricSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  
  const nomenclatureInputRef = useRef<HTMLInputElement>(null)
  const dutiesInputRef = useRef<HTMLInputElement>(null)

  // 加载同步状态
  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/taric/status`)
      const json = await res.json()
      if (json.errCode === 200 && json.data) {
        setStatus(json.data)
        // 如果有正在运行的同步，定时刷新
        if (json.data.currentSync) {
          setSyncing(true)
          setTimeout(loadStatus, 3000)
        } else {
          setSyncing(false)
        }
      }
    } catch (error) {
      console.error('获取 TARIC 状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  // 手动触发同步
  const handleSync = async () => {
    if (syncing) return
    
    setSyncing(true)
    setMessage(null)
    
    try {
      const res = await fetch(`${API_BASE}/api/taric/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ syncType: 'full' })
      })
      const json = await res.json()
      
      if (json.errCode === 200) {
        setMessage({ type: 'info', text: '同步任务已启动，请稍候...' })
        // 开始定时刷新状态
        setTimeout(loadStatus, 2000)
      } else {
        setMessage({ type: 'error', text: json.msg || '启动同步失败' })
        setSyncing(false)
      }
    } catch (error) {
      console.error('触发同步失败:', error)
      setMessage({ type: 'error', text: '触发同步失败' })
      setSyncing(false)
    }
  }

  // 上传文件并同步
  const handleUploadAndSync = async (files: { nomenclature?: File; duties?: File }) => {
    if (uploading || syncing) return
    
    setUploading(true)
    setMessage(null)
    
    try {
      const formData = new FormData()
      if (files.nomenclature) {
        formData.append('nomenclature', files.nomenclature)
      }
      if (files.duties) {
        formData.append('duties', files.duties)
      }
      formData.append('syncType', 'full')
      
      const res = await fetch(`${API_BASE}/api/taric/upload-sync`, {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      
      if (json.errCode === 200) {
        setMessage({ type: 'info', text: '文件已上传，同步任务已启动...' })
        setSyncing(true)
        setTimeout(loadStatus, 2000)
      } else {
        setMessage({ type: 'error', text: json.msg || '上传失败' })
      }
    } catch (error) {
      console.error('上传同步失败:', error)
      setMessage({ type: 'error', text: '上传同步失败' })
    } finally {
      setUploading(false)
    }
  }

  // 处理文件选择
  const handleFileSelect = (type: 'nomenclature' | 'duties', file: File | null) => {
    if (!file) return
    handleUploadAndSync({ [type]: file })
  }

  // 格式化时间
  const formatTime = (timeStr: string) => {
    return formatDateTime(timeStr)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 面板头部 */}
      <div
        className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 text-white ${syncing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">TARIC 欧盟税率同步</h3>
            <p className="text-xs text-gray-500">
              {status?.lastSync
                ? `上次同步: ${formatTime(status.lastSync.completedAt)}`
                : '尚未同步'}
              {status?.tariffStats && ` · ${status.tariffStats.fromTaric} 条 TARIC 数据`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              同步中...
            </span>
          )}
          {status?.lastSync?.status === 'completed' && !syncing && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
              <CheckCircle className="w-3 h-3" />
              已同步
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* 消息提示 */}
          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
              message.type === 'success' ? 'bg-green-50 text-green-700' :
              message.type === 'error' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {message.type === 'success' && <CheckCircle className="w-4 h-4" />}
              {message.type === 'error' && <XCircle className="w-4 h-4" />}
              {message.type === 'info' && <Clock className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-800">{status?.tariffStats?.total || 0}</p>
              <p className="text-xs text-gray-500">总税率数</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{status?.tariffStats?.fromTaric || 0}</p>
              <p className="text-xs text-gray-500">TARIC 数据</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{status?.lastSync?.insertedCount || 0}</p>
              <p className="text-xs text-gray-500">上次新增</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-orange-700">{status?.lastSync?.updatedCount || 0}</p>
              <p className="text-xs text-gray-500">上次更新</p>
            </div>
          </div>

          {/* 数据文件状态 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <h4 className="text-xs font-medium text-gray-700">本地数据文件</h4>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Nomenclature 文件 */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">商品分类编码 (Nomenclature)</p>
                    {status?.files?.nomenclature?.exists ? (
                      <p className="text-xs text-green-600">
                        已上传 · {status.files.nomenclature.fileInfo?.sizeFormatted} · {status.files.nomenclature.fileInfo?.modifiedTimeFormatted}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">未上传</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={nomenclatureInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileSelect('nomenclature', e.target.files?.[0] || null)}
                  />
                  <button
                    onClick={() => nomenclatureInputRef.current?.click()}
                    disabled={uploading || syncing}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    上传
                  </button>
                  <a
                    href={status?.files?.nomenclature?.manualDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="从欧盟官方下载"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Duties 文件 */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">关税税率 (Duties)</p>
                    {status?.files?.duties?.exists ? (
                      <p className="text-xs text-green-600">
                        已上传 · {status.files.duties.fileInfo?.sizeFormatted} · {status.files.duties.fileInfo?.modifiedTimeFormatted}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">未上传</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={dutiesInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileSelect('duties', e.target.files?.[0] || null)}
                  />
                  <button
                    onClick={() => dutiesInputRef.current?.click()}
                    disabled={uploading || syncing}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    上传
                  </button>
                  <a
                    href={status?.files?.duties?.manualDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="从欧盟官方下载"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              TARIC 数据每天自动同步一次（凌晨3点）
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadStatus}
                disabled={loading}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || !status?.files?.nomenclature?.exists}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {syncing ? '同步中...' : '立即同步'}
              </button>
            </div>
          </div>

          {/* 数据来源说明 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <p className="font-medium mb-1">数据来源</p>
            <p>TARIC (Integrated Tariff of the European Union) 是欧盟综合关税数据库，包含商品分类编码、关税税率、贸易措施等。</p>
            <p className="mt-1">
              <a
                href="https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                访问欧盟 TARIC 官方数据下载页面 →
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
