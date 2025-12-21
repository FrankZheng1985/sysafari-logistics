/**
 * 下载工具 Hook
 * 提供统一的下载功能，包含成功/失败提示
 */

import { useCallback } from 'react'
import { useToast } from '../components/Toast'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

export function useDownload() {
  const { showToast, showDownloadSuccess } = useToast()

  /**
   * 通过URL下载文件（新窗口打开）
   */
  const downloadByUrl = useCallback((url: string, fileName?: string) => {
    window.open(url, '_blank')
    showDownloadSuccess(fileName)
  }, [showDownloadSuccess])

  /**
   * 下载文件（fetch方式，触发浏览器下载）
   */
  const downloadFile = useCallback(async (
    url: string, 
    fileName: string,
    options?: { onError?: (error: Error) => void }
  ) => {
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`)
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      showDownloadSuccess(fileName)
    } catch (error) {
      console.error('下载文件失败:', error)
      showToast('error', `下载失败: ${fileName}`)
      options?.onError?.(error as Error)
    }
  }, [showDownloadSuccess, showToast])

  /**
   * 下载提单附件
   */
  const downloadBillFile = useCallback(async (
    billId: string, 
    fileId: string | number, 
    fileName: string
  ) => {
    const url = `${API_BASE}/api/bills/${billId}/files/${fileId}/download`
    await downloadFile(url, fileName)
  }, [downloadFile])

  /**
   * 下载发票PDF
   */
  const downloadInvoicePdf = useCallback(async (
    invoiceId: string | number, 
    invoiceNo: string
  ) => {
    const url = `${API_BASE}/api/finance/invoices/${invoiceId}/pdf`
    const fileName = `发票_${invoiceNo}.pdf`
    downloadByUrl(url, fileName)
  }, [downloadByUrl])

  /**
   * 下载税费确认单PDF
   */
  const downloadTaxConfirmPdf = useCallback(async (
    importId: string | number, 
    importNo: string
  ) => {
    const url = `${API_BASE}/api/cargo/documents/tax-calc/${importId}/pdf/download`
    const fileName = `税费确认单_${importNo}.pdf`
    downloadByUrl(url, fileName)
  }, [downloadByUrl])

  /**
   * 下载Excel模板
   */
  const downloadTemplate = useCallback((templateName: string, fileName: string) => {
    const url = `${API_BASE}/api/templates/${templateName}`
    downloadByUrl(url, fileName)
  }, [downloadByUrl])

  /**
   * 导出数据为Excel
   */
  const exportToExcel = useCallback(async (
    endpoint: string, 
    fileName: string,
    params?: Record<string, string | number>
  ) => {
    try {
      let url = `${API_BASE}${endpoint}`
      if (params) {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
          searchParams.append(key, String(value))
        })
        url += `?${searchParams.toString()}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`导出失败: ${response.status}`)
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      showDownloadSuccess(fileName)
    } catch (error) {
      console.error('导出失败:', error)
      showToast('error', `导出失败: ${fileName}`)
    }
  }, [showDownloadSuccess, showToast])

  return {
    downloadByUrl,
    downloadFile,
    downloadBillFile,
    downloadInvoicePdf,
    downloadTaxConfirmPdf,
    downloadTemplate,
    exportToExcel
  }
}

export default useDownload
