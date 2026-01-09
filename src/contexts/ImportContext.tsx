import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { getApiBaseUrl, type BillOfLading } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 预览项类型
interface PreviewItem {
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

// 导入状态类型
interface ImportState {
  // 上传状态
  uploading: boolean
  uploadProgress: string
  // 预览数据
  showPreview: boolean
  previewData: PreviewItem[]
  previewFileName: string
  previewFile: File | null  // 保存文件对象
  // 选中的提单信息（保存完整对象）
  selectedBill: BillOfLading | null
}

// Context 类型
interface ImportContextType {
  state: ImportState
  // 开始解析文件
  startParsing: (file: File) => Promise<void>
  // 设置预览数据
  setPreviewData: (data: PreviewItem[]) => void
  // 显示/隐藏预览
  setShowPreview: (show: boolean) => void
  // 设置文件
  setPreviewFile: (file: File | null) => void
  // 设置选中的提单（完整对象）
  setSelectedBill: (bill: BillOfLading | null) => void
  // 重置状态
  resetState: () => void
  // 清除上传状态
  clearUploading: () => void
}

// 初始状态
const initialState: ImportState = {
  uploading: false,
  uploadProgress: '',
  showPreview: false,
  previewData: [],
  previewFileName: '',
  previewFile: null,
  selectedBill: null,
}

const ImportContext = createContext<ImportContextType | undefined>(undefined)

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportState>(initialState)

  // 开始解析文件
  const startParsing = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      uploading: true,
      uploadProgress: '正在解析文件...',
      previewFileName: file.name,
      previewFile: file,  // 保存文件对象
    }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('preview', 'true')

    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/preview`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setState(prev => ({
          ...prev,
          uploading: false,
          uploadProgress: '',
          previewData: data.data?.items || [],
          showPreview: true,
        }))
      } else {
        setState(prev => ({
          ...prev,
          uploading: false,
          uploadProgress: '',
        }))
        alert(data.msg || '解析文件失败')
      }
    } catch (error) {
      console.error('解析文件失败:', error)
      setState(prev => ({
        ...prev,
        uploading: false,
        uploadProgress: '',
      }))
      alert('解析文件失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }, [])

  // 设置预览数据
  const setPreviewData = useCallback((data: PreviewItem[]) => {
    setState(prev => ({ ...prev, previewData: data }))
  }, [])

  // 显示/隐藏预览
  const setShowPreview = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showPreview: show }))
  }, [])

  // 设置文件
  const setPreviewFile = useCallback((file: File | null) => {
    setState(prev => ({ 
      ...prev, 
      previewFile: file,
      previewFileName: file?.name || ''
    }))
  }, [])

  // 设置选中的提单（完整对象）
  const setSelectedBill = useCallback((bill: BillOfLading | null) => {
    setState(prev => ({
      ...prev,
      selectedBill: bill,
    }))
  }, [])

  // 重置状态
  const resetState = useCallback(() => {
    setState(initialState)
  }, [])

  // 清除上传状态
  const clearUploading = useCallback(() => {
    setState(prev => ({
      ...prev,
      uploading: false,
      uploadProgress: '',
    }))
  }, [])

  return (
    <ImportContext.Provider
      value={{
        state,
        startParsing,
        setPreviewData,
        setShowPreview,
        setPreviewFile,
        setSelectedBill,
        resetState,
        clearUploading,
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
