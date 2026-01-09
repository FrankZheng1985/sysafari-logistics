import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { getApiBaseUrl, getAuthHeaders, type BillOfLading, type Customer, type CustomerTaxInfo } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 预览项类型
export interface PreviewItem {
  rowNo: number
  containerNo: string
  billNumber?: string
  productCode?: string
  palletCount?: number
  referenceNo?: string
  customerOrderNo?: string
  productName: string
  productNameEn?: string
  hsCode?: string
  cartonCount?: number
  quantity: number
  unit: string
  unitPrice: number
  totalValue: number
  grossWeight: number
  netWeight?: number
  unitNetWeight?: number
  originCountry?: string
  material?: string
  materialEn?: string
  productImage?: string
  loadingPosition?: string
  dutyRate?: number
  estimatedDuty?: number
  error?: string
}

// 发货方信息类型
export interface ShipperInfo {
  name: string
  address: string
  contact: string
}

// 单个导入任务
export interface ImportTask {
  id: string                    // 任务唯一ID
  status: 'pending' | 'parsing' | 'preview' | 'importing' | 'completed' | 'error'
  selectedBill: BillOfLading | null
  file: File | null
  fileName: string
  progress: string              // 进度描述
  previewData: PreviewItem[]
  error?: string
  createdAt: Date
  // 发货方和进口商信息
  shipperInfo: ShipperInfo
  selectedCustomer: Customer | null
  selectedTaxNumber: CustomerTaxInfo | null
}

// 全局状态
interface ImportState {
  tasks: ImportTask[]           // 任务队列
  activeTaskId: string | null   // 当前查看的任务（用于预览弹窗）
}

// Context 类型
interface ImportContextType {
  state: ImportState
  // 任务管理
  addTask: () => string                                   // 添加新任务，返回任务ID
  updateTask: (taskId: string, updates: Partial<ImportTask>) => void  // 更新任务
  removeTask: (taskId: string) => void                    // 删除任务
  setActiveTask: (taskId: string | null) => void          // 设置当前活动任务
  getTask: (taskId: string) => ImportTask | undefined     // 获取任务
  // 解析文件
  startParsing: (taskId: string, file: File) => Promise<void>
  // 确认导入（支持并行）
  confirmImport: (taskId: string) => Promise<boolean>
  // 清空所有任务
  clearAllTasks: () => void
  // 获取正在处理的任务（解析中或导入中）
  getProcessingTasks: () => ImportTask[]
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// 初始状态
const initialState: ImportState = {
  tasks: [],
  activeTaskId: null,
}

// 创建新任务的默认值
const createEmptyTask = (): ImportTask => ({
  id: generateId(),
  status: 'pending',
  selectedBill: null,
  file: null,
  fileName: '',
  progress: '',
  previewData: [],
  createdAt: new Date(),
  shipperInfo: { name: '', address: '', contact: '' },
  selectedCustomer: null,
  selectedTaxNumber: null,
})

const ImportContext = createContext<ImportContextType | undefined>(undefined)

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportState>(initialState)

  // 添加新任务
  const addTask = useCallback(() => {
    const newTask = createEmptyTask()
    setState(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }))
    return newTask.id
  }, [])

  // 更新任务
  const updateTask = useCallback((taskId: string, updates: Partial<ImportTask>) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      ),
    }))
  }, [])

  // 删除任务
  const removeTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== taskId),
      activeTaskId: prev.activeTaskId === taskId ? null : prev.activeTaskId,
    }))
  }, [])

  // 设置当前活动任务
  const setActiveTask = useCallback((taskId: string | null) => {
    setState(prev => ({ ...prev, activeTaskId: taskId }))
  }, [])

  // 获取任务
  const getTask = useCallback((taskId: string) => {
    return state.tasks.find(task => task.id === taskId)
  }, [state.tasks])

  // 开始解析文件
  const startParsing = useCallback(async (taskId: string, file: File) => {
    // 更新任务状态为解析中
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'parsing' as const, file, fileName: file.name, progress: '正在解析文件...' }
          : task
      ),
    }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('preview', 'true')
    
    // 调试日志
    console.log('[ImportContext] 开始解析文件:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isFile: file instanceof File
    })

    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/preview`, {
        method: 'POST',
        body: formData
      })
      
      console.log('[ImportContext] 请求响应状态:', res.status)
      const data = await res.json()
      console.log('[ImportContext] 响应数据:', data)
      
      if (data.errCode === 200) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => 
            task.id === taskId 
              ? { 
                  ...task, 
                  status: 'preview' as const, 
                  progress: '',
                  previewData: data.data?.items || [],
                }
              : task
          ),
        }))
      } else {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => 
            task.id === taskId 
              ? { 
                  ...task, 
                  status: 'error' as const, 
                  progress: '',
                  error: data.msg || '解析文件失败',
                }
              : task
          ),
        }))
      }
    } catch (error) {
      console.error('[ImportContext] 解析文件失败:', error)
      console.error('[ImportContext] 文件信息:', {
        fileName: file?.name,
        fileSize: file?.size,
        isFile: file instanceof File
      })
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                status: 'error' as const, 
                progress: '',
                error: error instanceof Error ? error.message : '解析文件失败',
              }
            : task
        ),
      }))
    }
  }, [])

  // 确认导入（支持并行）
  const confirmImport = useCallback(async (taskId: string): Promise<boolean> => {
    const task = state.tasks.find(t => t.id === taskId)
    if (!task || !task.file || !task.selectedBill) {
      return false
    }

    // 更新状态为导入中
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => 
        t.id === taskId 
          ? { ...t, status: 'importing' as const, progress: '正在导入数据...' }
          : t
      ),
    }))

    const formData = new FormData()
    formData.append('file', task.file)
    formData.append('billId', task.selectedBill.id)
    formData.append('billNumber', task.selectedBill.billNumber || '')
    formData.append('containerNo', task.selectedBill.containerNumber || '')
    formData.append('customerName', task.selectedBill.companyName || task.selectedBill.customerName || '')

    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.errCode === 200) {
        const importId = data.data?.importId

        // 更新发货方和进口商信息
        if (importId && (task.shipperInfo.name || task.selectedCustomer)) {
          try {
            await fetch(`${API_BASE}/api/cargo/documents/imports/${importId}/shipper-importer`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                shipperName: task.shipperInfo.name || null,
                shipperAddress: task.shipperInfo.address || null,
                shipperContact: task.shipperInfo.contact || null,
                importerCustomerId: task.selectedCustomer?.id || null,
                importerName: task.selectedCustomer?.companyName || task.selectedCustomer?.customerName || null,
                importerTaxId: task.selectedTaxNumber?.id || null,
                importerEoriNumber: task.selectedTaxNumber?.eoriNumber || null,
                importerVatNumber: task.selectedTaxNumber?.vatNumber || null,
                importerCountry: task.selectedTaxNumber?.country || null,
                importerCompanyName: task.selectedTaxNumber?.companyName || null,
                importerAddress: task.selectedTaxNumber?.companyAddress || null
              })
            })
          } catch (updateError) {
            console.error('更新发货方和进口商信息失败:', updateError)
          }
        }

        // 更新状态为完成
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => 
            t.id === taskId 
              ? { 
                  ...t, 
                  status: 'completed' as const, 
                  progress: `导入成功！共导入 ${data.data?.importedCount || 0} 条记录`,
                }
              : t
          ),
        }))
        return true
      } else {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => 
            t.id === taskId 
              ? { 
                  ...t, 
                  status: 'error' as const, 
                  progress: '',
                  error: data.msg || '导入失败',
                }
              : t
          ),
        }))
        return false
      }
    } catch (error) {
      console.error('导入失败:', error)
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => 
          t.id === taskId 
            ? { 
                ...t, 
                status: 'error' as const, 
                progress: '',
                error: error instanceof Error ? error.message : '导入失败',
              }
            : t
        ),
      }))
      return false
    }
  }, [state.tasks])

  // 清空所有任务
  const clearAllTasks = useCallback(() => {
    setState(initialState)
  }, [])

  // 获取正在处理的任务
  const getProcessingTasks = useCallback(() => {
    return state.tasks.filter(task => task.status === 'parsing' || task.status === 'importing')
  }, [state.tasks])

  return (
    <ImportContext.Provider
      value={{
        state,
        addTask,
        updateTask,
        removeTask,
        setActiveTask,
        getTask,
        startParsing,
        confirmImport,
        clearAllTasks,
        getProcessingTasks,
      }}
    >
      {children}
    </ImportContext.Provider>
  )
}

export function useImport() {
  const context = useContext(ImportContext)
  if (context === undefined) {
    throw new Error('useImport must be used within an ImportProvider')
  }
  return context
}
