import { useState, useEffect, useMemo } from 'react'
import { X, Play, Plane, Ship, Train, Truck, Upload, Download, HelpCircle, Plus, Trash2, FileText, ChevronDown, Loader2, Users, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import DatePicker from './DatePicker'
import { createBill, updateBill, getShippingCompanyByContainerCode, searchContainerCodes, parseBillFile, getPortsOfLoadingList, getDestinationPortsList, getCustomers, parseTransportDocument, getTrackingSupplementInfo, getCustomerTaxNumbers, getCustomerAddresses, type ContainerCode, type PortOfLoadingItem, type DestinationPortItem, type Customer, type ParsedTransportData, type TrackingSupplementInfo, type CustomerTaxNumber, type CustomerAddress } from '../utils/api'

// 编辑模式下传入的提单数据类型
interface EditBillData {
  id: string
  billNumber?: string
  containerNumber?: string  // 集装箱号
  shippingCompany?: string
  origin?: string
  destination?: string
  portOfLoading?: string
  portOfDischarge?: string
  pieces?: number
  weight?: number
  volume?: number
  eta?: string
  etd?: string
  transportMethod?: string
  // 航程信息
  vessel?: string
  voyage?: string
  groundHandling?: string
  terminal?: string
  // 集装箱信息
  sealNumber?: string
  containerSize?: string
  // 发货人信息
  shipper?: string
  // Reference List
  referenceList?: Array<{
    referenceNumber: string
    pieces: string
    grossWeight: string
    shipper: string
    shipperDetails: string
    consigneeAddress: string
    consigneeAddressDetails: string
  }>
  // 附加属性
  containerType?: string
  billType?: string
  consigneeType?: string
  containerReturn?: string
  fullContainerTransport?: string
  lastMileTransport?: string
  devanning?: string
  t1Declaration?: string
  transportArrangement?: string
  customerId?: string
  customerName?: string
  status?: string
}

interface CreateBillModalProps {
  visible: boolean
  onClose: () => void
  onSubmit?: (type: 'official' | 'temporary') => void
  onSuccess?: () => void // 成功回调，用于刷新列表
  mode?: 'create' | 'edit' // 模式：创建或编辑
  editData?: EditBillData | null // 编辑模式下的提单数据
}

export default function CreateBillModal({
  visible,
  onClose,
  onSubmit,
  onSuccess,
  mode = 'create',
  editData = null,
}: CreateBillModalProps) {
  const isEditMode = mode === 'edit' && editData !== null
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(isEditMode ? 3 : 1) // 编辑模式直接跳到第三步
  const [selectedType, setSelectedType] = useState<'official' | 'temporary' | null>(null)
  const [selectedTransport, setSelectedTransport] = useState<'air' | 'sea' | 'rail' | 'truck' | null>(null)
  const [easyBill, setEasyBill] = useState(true)
  
  // OCR解析相关状态
  const [ocrParsing, setOcrParsing] = useState(false)
  const [ocrResult, setOcrResult] = useState<ParsedTransportData | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [showOcrPreview, setShowOcrPreview] = useState(false)
  
  // 提单发货人信息（用于 Reference List 自动填充）
  const [billShipper, setBillShipper] = useState('')
  
  // 第三步表单数据
  const [formData, setFormData] = useState({
    masterBillFile: null as File | null,
    containerCodePrefix: '', // 集装箱代码前缀（如 EMCU）
    masterBillNumberSuffix: '', // 主单号后缀（如 1234567）
    masterBillNumber: '', // 完整主单号（自动拼接）
    shippingCompany: '', // 船公司
    origin: '',
    destination: '',
    pieces: '',
    volume: '',
    volumeUnit: 'CBM',
    freightRate: '',
    freightRateUnit: 'CNY',
    isT1Customs: 'no' as 'yes' | 'no',
    flightNumber: '',
    groundHandling: '',
    estimatedDeparture: '',
    estimatedArrival: '',
    grossWeight: '',
    grossWeightUnit: 'KGS',
    delivery: 'After Clearance',
    transportation: '' as 'entrust' | 'self' | '',
    // 海运特有字段
    containerType: '' as 'cfs' | 'fcl' | '', // 箱型
    billType: '' as 'master' | 'house' | '', // 提单类型
    consigneeType: '', // 收货人（ASL/税号）
    containerReturn: '' as 'off-site' | 'local' | '', // 异地还柜
    fullContainerTransport: '' as 'must-full' | 'can-split' | '', // 全程整柜运输
    lastMileTransport: 'truck', // 末端运输方式
    devanning: '' as 'required' | 'not-required' | '', // 拆柜
    // 新增字段：从追踪API获取
    containerNumber: '', // 集装箱号（完整柜号）
    sealNumber: '', // 封号
    containerSize: '', // 柜型（如 20GP, 40GP, 40HQ）
  })
  const [bindResourceTab, setBindResourceTab] = useState<'general' | 'pallet'>('general')
  const [resourceFile, setResourceFile] = useState<File | null>(null)
  
  // 参考号相关信息
  const [referenceTab, setReferenceTab] = useState<'form' | 'upload'>('form')
  const [referenceList, setReferenceList] = useState<Array<{
    id: string
    referenceNumber: string
    pieces: string
    grossWeight: string
    shipper: string
    shipperDetails: string
    consigneeAddress: string
    consigneeAddressDetails: string
  }>>([])
  const [referenceTemplateFile, setReferenceTemplateFile] = useState<File | null>(null)
  const [showEasyBillWarning, setShowEasyBillWarning] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [containerCodes, setContainerCodes] = useState<ContainerCode[]>([])
  const [showContainerCodeDropdown, setShowContainerCodeDropdown] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)
  const [portsOfLoading, setPortsOfLoading] = useState<PortOfLoadingItem[]>([])
  const [showPortOfLoadingDropdown, setShowPortOfLoadingDropdown] = useState(false)
  const [portOfLoadingSearch, setPortOfLoadingSearch] = useState('')
  const [destinationPorts, setDestinationPorts] = useState<DestinationPortItem[]>([])
  const [showDestinationPortDropdown, setShowDestinationPortDropdown] = useState(false)
  const [destinationPortSearch, setDestinationPortSearch] = useState('')
  
  // 客户选择相关状态
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  // 客户税号列表（用于收货人下拉选择）
  const [customerTaxNumbers, setCustomerTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [loadingTaxNumbers, setLoadingTaxNumbers] = useState(false)
  
  // 客户地址列表（用于收货地址下拉选择）
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  
  // 船公司来源追踪：'container' = 集装箱代码匹配, 'file' = 文件解析, 'manual' = 手动输入
  const [shippingCompanySource, setShippingCompanySource] = useState<'container' | 'file' | 'manual' | ''>('')

  // 加载集装箱代码列表（仅海运时）
  useEffect(() => {
    if (visible && selectedTransport === 'sea') {
      const loadContainerCodes = async () => {
        try {
          // 加载所有集装箱代码（通过搜索空字符串获取所有）
          const response = await searchContainerCodes('')
          if (response.errCode === 200 && response.data) {
            // 确保数据格式正确，转换字段名
            const codes = response.data.map((item: any) => ({
              containerCode: item.container_code || item.containerCode || '',
              companyName: item.company_name || item.companyName || '',
              companyCode: item.company_code || item.companyCode || '',
              description: item.description || '',
            })).filter((item: any) => item.containerCode) // 过滤掉没有 containerCode 的项
            setContainerCodes(codes)
          } else {
            console.warn('集装箱代码API返回异常:', response)
            setContainerCodes([])
          }
        } catch (error) {
          console.error('加载集装箱代码列表失败:', error)
          setContainerCodes([])
        }
      }
      loadContainerCodes()
    } else {
      // 如果不是海运，清空代码列表
      setContainerCodes([])
    }
  }, [visible, selectedTransport])

  // 当打开下拉菜单时，如果数据为空，尝试加载（不依赖 selectedTransport，因为可能在选择运输方式之前就打开了）
  useEffect(() => {
    if (showContainerCodeDropdown && containerCodes.length === 0 && visible) {
      const loadContainerCodes = async () => {
        try {
          const response = await searchContainerCodes('')
          if (response.errCode === 200 && response.data) {
            const codes = response.data.map((item: any) => ({
              containerCode: item.container_code || item.containerCode || '',
              companyName: item.company_name || item.companyName || '',
              companyCode: item.company_code || item.companyCode || '',
              description: item.description || '',
            })).filter((item: any) => item.containerCode)
            setContainerCodes(codes)
          } else {
            console.warn('下拉菜单加载API返回异常:', response)
          }
        } catch (error) {
          console.error('下拉菜单重新加载集装箱代码列表失败:', error)
        }
      }
      loadContainerCodes()
    }
  }, [showContainerCodeDropdown, containerCodes.length, visible, selectedTransport])

  // 过滤集装箱代码（模糊搜索）- 使用主输入框的值进行实时筛选
  // 使用 useMemo 确保在 formData.containerCodePrefix 变化时重新计算
  // 必须在早期返回之前调用，因为 useMemo 是 hook
  const filteredContainerCodes = useMemo(() => {
    if (!containerCodes || containerCodes.length === 0) return []
    
    // 使用主输入框的值进行实时过滤
    const searchTerm = formData.containerCodePrefix
    
    // 如果输入框为空，显示所有结果
    if (!searchTerm || searchTerm.trim() === '') {
      return containerCodes.filter(code => code && code.containerCode)
    }
    
    const searchLower = searchTerm.toLowerCase().trim()
    
    // 实时过滤：检查搜索词是否匹配
    return containerCodes.filter(code => {
      if (!code || !code.containerCode) return false
      
      const containerCode = (code.containerCode || '').toLowerCase()
      const companyName = (code.companyName || '').toLowerCase()
      const companyCode = (code.companyCode || '').toLowerCase()
      
      // 模糊匹配：检查搜索词是否包含在任一字段中
      return (
        containerCode.includes(searchLower) ||
        companyName.includes(searchLower) ||
        companyCode.includes(searchLower)
      )
    })
  }, [containerCodes, formData.containerCodePrefix])

  // 加载起运港列表 - 根据选择的运输方式加载对应数据
  useEffect(() => {
    if (visible && selectedTransport) {
      const loadPortsOfLoading = async () => {
        try {
          console.log('加载起运港列表，运输方式:', selectedTransport)
          // 根据运输方式加载对应的起运港数据
          const response = await getPortsOfLoadingList({
            transportType: selectedTransport,
            status: 'active'
          })
          console.log('起运港API响应:', response)
          if (response.errCode === 200 && response.data) {
            // 只显示启用的港口
            const activePorts = response.data.filter((port: PortOfLoadingItem) => port.status === 'active')
            console.log('过滤后的起运港数量:', activePorts.length)
            setPortsOfLoading(activePorts)
          } else {
            console.warn('起运港API返回异常:', response)
            setPortsOfLoading([])
          }
        } catch (error) {
          console.error('加载起运港列表失败:', error)
          setPortsOfLoading([])
        }
      }
      loadPortsOfLoading()
    } else {
      console.log('未选择运输方式或弹窗未打开，清空起运港列表')
      setPortsOfLoading([])
    }
  }, [visible, selectedTransport])

  // 加载目的港列表 - 根据选择的运输方式加载对应数据
  useEffect(() => {
    if (visible && selectedTransport) {
      const loadDestinationPorts = async () => {
        try {
          // 根据运输方式加载对应的目的港数据
          const response = await getDestinationPortsList({
            transportType: selectedTransport,
            status: 'active'
          })
          if (response.errCode === 200 && response.data) {
            // 只显示启用的港口
            const activePorts = response.data.filter((port: DestinationPortItem) => port.status === 'active')
            setDestinationPorts(activePorts)
          } else {
            setDestinationPorts([])
          }
        } catch (error) {
          console.error('加载目的港列表失败:', error)
          setDestinationPorts([])
        }
      }
      loadDestinationPorts()
    } else {
      setDestinationPorts([])
    }
  }, [visible, selectedTransport])

  // 加载客户列表
  useEffect(() => {
    if (visible) {
      const loadCustomers = async () => {
        try {
          const response = await getCustomers({ status: 'active', pageSize: 1000 })
          if (response.errCode === 200 && response.data) {
            setCustomers(response.data.list || [])
          } else {
            setCustomers([])
          }
        } catch (error) {
          console.error('加载客户列表失败:', error)
          setCustomers([])
        }
      }
      loadCustomers()
    } else {
      setCustomers([])
      setSelectedCustomer(null)
      setCustomerSearch('')
      setShippingCompanySource('')
    }
  }, [visible])

  // 当选择客户后，加载该客户的税号列表（用于收货人下拉选择）
  useEffect(() => {
    if (selectedCustomer?.id) {
      const loadTaxNumbers = async () => {
        setLoadingTaxNumbers(true)
        try {
          const response = await getCustomerTaxNumbers(selectedCustomer.id)
          if (response.errCode === 200 && response.data) {
            setCustomerTaxNumbers(response.data)
          } else {
            setCustomerTaxNumbers([])
          }
        } catch (error) {
          console.error('加载客户税号失败:', error)
          setCustomerTaxNumbers([])
        } finally {
          setLoadingTaxNumbers(false)
        }
      }
      loadTaxNumbers()
    } else {
      setCustomerTaxNumbers([])
    }
  }, [selectedCustomer?.id])

  // 当选择客户后，加载该客户的地址列表（用于收货地址下拉选择）
  useEffect(() => {
    if (selectedCustomer?.id) {
      const loadAddresses = async () => {
        setLoadingAddresses(true)
        try {
          const response = await getCustomerAddresses(selectedCustomer.id)
          if (response.errCode === 200 && response.data) {
            setCustomerAddresses(response.data)
          } else {
            setCustomerAddresses([])
          }
        } catch (error) {
          console.error('加载客户地址失败:', error)
          setCustomerAddresses([])
        } finally {
          setLoadingAddresses(false)
        }
      }
      loadAddresses()
    } else {
      setCustomerAddresses([])
    }
  }, [selectedCustomer?.id])

  // 编辑模式初始化：当打开编辑模式时，用现有数据填充表单
  useEffect(() => {
    if (visible && mode === 'edit' && editData) {
      // 调试日志：打印编辑数据中的附加属性字段
      console.log('编辑模式初始化 - editData 附加属性字段:', {
        containerType: editData.containerType,
        billType: editData.billType,
        consigneeType: editData.consigneeType,
        containerReturn: editData.containerReturn,
        fullContainerTransport: editData.fullContainerTransport,
        lastMileTransport: editData.lastMileTransport,
        devanning: editData.devanning,
        t1Declaration: editData.t1Declaration,
        transportArrangement: editData.transportArrangement,
        transportMethod: editData.transportMethod,
      })
      
      // 设置运输方式
      const transport = editData.transportMethod as 'air' | 'sea' | 'rail' | 'truck' | null
      if (transport) {
        setSelectedTransport(transport)
      }
      // 设置提单类型（正式单/临时单）
      setSelectedType(editData.status === 'draft' ? 'temporary' : 'official')
      // 直接跳到第三步
      setCurrentStep(3)
      
      // 解析主单号前缀和后缀
      let containerCodePrefix = ''
      let masterBillNumberSuffix = ''
      if (editData.masterBillNumber && editData.masterBillNumber.length > 4) {
        containerCodePrefix = editData.masterBillNumber.substring(0, 4)
        masterBillNumberSuffix = editData.masterBillNumber.substring(4)
      }
      
      // 合并 vessel 和 voyage 为 flightNumber
      const flightNumber = editData.vessel 
        ? (editData.voyage ? `${editData.vessel} ${editData.voyage}` : editData.vessel)
        : ''
      
      // 填充表单数据
      setFormData(prev => ({
        ...prev,
        containerCodePrefix,
        masterBillNumberSuffix,
        masterBillNumber: editData.masterBillNumber || '',
        shippingCompany: editData.shippingCompany || '',
        origin: editData.portOfLoading || editData.origin || '',
        destination: editData.portOfDischarge || editData.destination || '',
        pieces: editData.pieces?.toString() || '',
        grossWeight: editData.weight?.toString() || '',
        volume: editData.volume?.toString() || '',
        estimatedDeparture: editData.etd || '',
        estimatedArrival: editData.eta || '',
        flightNumber: flightNumber, // 航班号/船名航次
        groundHandling: editData.groundHandling || editData.terminal || '', // 地勤（码头）
        // 集装箱信息
        containerNumber: editData.containerNumber || '', // 集装箱号
        sealNumber: editData.sealNumber || '', // 封号
        containerSize: editData.containerSize || '', // 柜型
        // 附加属性
        containerType: (editData.containerType || '') as 'cfs' | 'fcl' | '',
        billType: (editData.billType || '') as 'master' | 'house' | '',
        consigneeType: editData.consigneeType || '',
        containerReturn: (editData.containerReturn || '') as 'off-site' | 'local' | '',
        fullContainerTransport: (editData.fullContainerTransport || '') as 'must-full' | 'can-split' | '',
        lastMileTransport: editData.lastMileTransport || 'truck',
        devanning: (editData.devanning || '') as 'required' | 'not-required' | '',
        isT1Customs: editData.t1Declaration === 'yes' ? 'yes' : 'no',
        transportation: (editData.transportArrangement || '') as 'entrust' | 'self' | '',
      }))
      
      // 设置发货人信息（用于 Reference List 自动填充）
      if (editData.shipper) {
        setBillShipper(editData.shipper)
      }
      
      // 设置客户
      if (editData.customerId) {
        setSelectedCustomer({
          id: editData.customerId,
          customerCode: '',
          customerName: editData.customerName || '',
          companyName: editData.customerName || '',
          customerType: 'both',
          customerLevel: 'normal',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          address: '',
          countryCode: '',
          status: 'active',
          creditLimit: 0,
          paymentTerms: '',
          notes: '',
          assignedTo: 0,
          assignedName: '',
          createTime: '',
          updateTime: '',
        } as Customer)
        setCustomerSearch(editData.customerName || '')
      }
      
      // 加载 Reference List
      if (editData.referenceList && editData.referenceList.length > 0) {
        setReferenceList(editData.referenceList.map((item, idx) => ({
          id: `edit-${idx}-${Date.now()}`,
          referenceNumber: item.referenceNumber || '',
          pieces: item.pieces || '',
          grossWeight: item.grossWeight || '',
          shipper: item.shipper || '',
          shipperDetails: item.shipperDetails || '',
          consigneeAddress: item.consigneeAddress || '',
          consigneeAddressDetails: item.consigneeAddressDetails || '',
        })))
      }
    }
  }, [visible, mode, editData])

  // 早期返回必须在所有hooks之后
  if (!visible) return null

  // 处理集装箱代码前缀变化
  const handleContainerCodePrefixChange = async (code: string) => {
    handleInputChange('containerCodePrefix', code)
    // 更新完整主单号
    const fullNumber = code + formData.masterBillNumberSuffix
    handleInputChange('masterBillNumber', fullNumber)
    setShowContainerCodeDropdown(false)
    
    // 自动识别船公司
    if (code.length === 4 && selectedTransport === 'sea') {
      try {
        const response = await getShippingCompanyByContainerCode(code)
        if (response.errCode === 200 && response.data) {
          handleInputChange('shippingCompany', response.data.companyCode)
          setShippingCompanySource('container')
          console.log('船公司识别来源: 集装箱代码匹配', response.data.companyCode)
        }
      } catch (error) {
        handleInputChange('shippingCompany', '')
        setShippingCompanySource('')
      }
    }
    
    if (errors.masterBillNumber) {
      setErrors(prev => ({ ...prev, masterBillNumber: '' }))
    }
  }

  // 处理主单号后缀变化 - 保留用于自定义提单号功能
  const handleMasterBillNumberSuffixChange = (value: string) => {
    handleInputChange('masterBillNumberSuffix', value)
    // 更新完整主单号
    const fullNumber = formData.containerCodePrefix + value
    handleInputChange('masterBillNumber', fullNumber)
    
    if (errors.masterBillNumber) {
      setErrors(prev => ({ ...prev, masterBillNumber: '' }))
    }
  }

  // 根据主单号自动识别船公司（兼容旧的手动输入方式）
  const handleMasterBillNumberChange = async (value: string) => {
    handleInputChange('masterBillNumber', value)
    
    // 如果输入的是集装箱代码（4位大写字母），尝试识别船公司
    if (value.length >= 4 && selectedTransport === 'sea') {
      const code = value.substring(0, 4).toUpperCase()
      // 如果前4位匹配某个集装箱代码，自动设置前缀
      const matchedCode = containerCodes.find(c => c && c.containerCode === code)
      if (matchedCode) {
        handleInputChange('containerCodePrefix', code)
        handleInputChange('masterBillNumberSuffix', value.substring(4))
      }
      
      try {
        const response = await getShippingCompanyByContainerCode(code)
        if (response.errCode === 200 && response.data) {
          handleInputChange('shippingCompany', response.data.companyCode)
          setShippingCompanySource('container')
          console.log('船公司识别来源: 集装箱代码匹配', response.data.companyCode)
        }
      } catch (error) {
        if (value.length === 4) {
          handleInputChange('shippingCompany', '')
          setShippingCompanySource('')
        }
      }
    }
    
    if (errors.masterBillNumber) {
      setErrors(prev => ({ ...prev, masterBillNumber: '' }))
    }
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedType) {
        alert('请选择提单类型')
        return
      }
      // 选择类型后自动进入下一步
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (!selectedTransport) {
        alert('请选择运输方式')
        return
      }
      setCurrentStep(3)
    } else {
      // 完成
      onSubmit?.(selectedType!)
      onClose()
    }
  }


  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3)
    }
  }

  const handleCancel = () => {
    setCurrentStep(1)
    setSelectedType(null)
    setSelectedTransport(null)
    setEasyBill(true)
    onClose()
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 处理运输方式变化 - 清空起运港和目的港
  const handleTransportChange = (transport: 'air' | 'sea' | 'rail' | 'truck') => {
    if (transport !== selectedTransport) {
      // 切换运输方式时，清空之前选择的起运港和目的港
      handleInputChange('origin', '')
      handleInputChange('destination', '')
      setPortOfLoadingSearch('')
      setDestinationPortSearch('')
    }
    setSelectedTransport(transport)
  }

  // 解析提单文件（优先使用本地PDF解析，OCR作为增强）
  // 支持直接传入文件参数，解决React状态更新异步问题
  const handleParseFile = async (fileParam?: File) => {
    const fileToProcess = fileParam || formData.masterBillFile
    
    if (!fileToProcess) {
      alert('请先选择文件')
      return
    }

    setParsingFile(true)
    setOcrParsing(true)
    setOcrError(null)
    setOcrResult(null)
    
    try {
      // 优先使用本地PDF解析API（已证实可工作）
      const response = await parseBillFile(fileToProcess)
      
      if (response.errCode === 200 && response.data) {
        const data = response.data
        console.log('PDF解析结果:', data)
        
        // 自动填充表单字段
        if (data.masterBillNumber) {
          const billNumber = data.masterBillNumber.toUpperCase()
          // 海运：尝试匹配格式：4个字母+数字（如 EMCU1608836）
          if (selectedTransport === 'sea') {
            const match = billNumber.match(/^([A-Z]{4})(\d+)$/)
            if (match) {
              handleInputChange('containerCodePrefix', match[1])
              handleInputChange('masterBillNumberSuffix', match[2])
            }
          }
          handleInputChange('masterBillNumber', billNumber)
        }
        
        if (data.shippingCompany) {
          handleInputChange('shippingCompany', data.shippingCompany)
        }
        
        if (data.origin) {
          handleInputChange('origin', data.origin)
        }
        
        if (data.destination) {
          handleInputChange('destination', data.destination)
        }
        
        if (data.pieces) {
          handleInputChange('pieces', data.pieces)
        }
        
        if (data.weight) {
          handleInputChange('grossWeight', data.weight)
        }
        
        if (data.volume) {
          handleInputChange('volume', data.volume)
        }
        
        if (data.vessel) {
          handleInputChange('flightNumber', data.vessel)
        }
        
        if (data.estimatedDeparture) {
          handleInputChange('estimatedDeparture', data.estimatedDeparture)
        }
        
        // 如果提取到集装箱代码，尝试获取船公司信息
        if (data.containerNumber && selectedTransport === 'sea') {
          const containerCode = data.containerNumber.substring(0, 4).toUpperCase()
          if (containerCode) {
            try {
              const companyResponse = await getShippingCompanyByContainerCode(containerCode)
              if (companyResponse.errCode === 200 && companyResponse.data) {
                handleInputChange('shippingCompany', companyResponse.data.companyCode || companyResponse.data.companyName)
              }
            } catch (err) {
              console.error('获取船公司信息失败:', err)
            }
          }
        }
        
        // 检查是否提取到有效数据
        const hasData = data.masterBillNumber || data.origin || data.destination || data.pieces || data.weight
        if (hasData) {
          // 异步获取追踪补充信息（码头、船名航次等）
          // 不阻塞主流程
          fetchSupplementInfo(data.masterBillNumber, data.containerNumber)
          alert('提单信息已自动提取并填充到表单中')
        } else {
          alert('解析完成，但未识别到有效信息，请手动填写')
        }
      } else {
        console.warn('解析返回异常:', response)
        alert('解析文件完成，但未提取到有效信息，请手动填写')
      }
    } catch (error: any) {
      console.error('解析提单文件失败:', error)
      alert('解析文件失败: ' + (error.message || '未知错误') + '\n请手动填写表单信息')
    } finally {
      setParsingFile(false)
      setOcrParsing(false)
    }
  }
  
  // 将OCR结果应用到表单
  const applyOcrResultToForm = (data: ParsedTransportData) => {
    // 主单号/提单号
    if (data.billNumber) {
      const billNumber = String(data.billNumber).toUpperCase()
      // 海运：尝试匹配格式：4个字母+数字（如 EMCU1608836）
      if (selectedTransport === 'sea') {
        const match = billNumber.match(/^([A-Z]{4})(\d+)$/)
        if (match) {
          handleInputChange('containerCodePrefix', match[1])
          handleInputChange('masterBillNumberSuffix', match[2])
        }
      }
      handleInputChange('masterBillNumber', billNumber)
    }
    
    // 集装箱号 - 优先使用集装箱代码匹配船公司
    if (data.containerNumber) {
      const containerCode = String(data.containerNumber).substring(0, 4).toUpperCase()
      if (containerCode && selectedTransport === 'sea') {
        handleInputChange('containerCodePrefix', containerCode)
        // 异步获取船公司信息 - 集装箱代码匹配优先级最高
        getShippingCompanyByContainerCode(containerCode).then(companyResponse => {
          if (companyResponse.errCode === 200 && companyResponse.data) {
            handleInputChange('shippingCompany', companyResponse.data.companyCode || companyResponse.data.companyName)
            setShippingCompanySource('container')
            console.log('船公司识别来源: 集装箱代码匹配', companyResponse.data.companyCode)
          }
        }).catch(console.error)
      }
    }
    
    // 航班号/船名航次/列车号
    if (data.vessel) {
      handleInputChange('flightNumber', data.vessel)
    } else if (data.flightNumber) {
      handleInputChange('flightNumber', data.flightNumber)
    } else if (data.trainNumber) {
      handleInputChange('flightNumber', data.trainNumber)
    }
    
    // 起运港
    if (data.portOfLoading) {
      handleInputChange('origin', data.portOfLoading)
    }
    
    // 目的港
    if (data.portOfDischarge) {
      handleInputChange('destination', data.portOfDischarge)
    }
    
    // 件数
    if (data.pieces) {
      handleInputChange('pieces', String(data.pieces))
    }
    
    // 毛重
    if (data.grossWeight) {
      handleInputChange('grossWeight', String(data.grossWeight))
    }
    
    // 体积
    if (data.volume) {
      handleInputChange('volume', String(data.volume))
    }
    
    // 船公司/航空公司 - 只有在没有集装箱号时才使用文件解析的结果
    // 如果有集装箱号，优先使用集装箱代码匹配的船公司（在上面已处理）
    if (!data.containerNumber) {
      if (data.shippingCompany) {
        handleInputChange('shippingCompany', data.shippingCompany)
        setShippingCompanySource('file')
        console.log('船公司识别来源: 文件解析', data.shippingCompany)
      } else if (data.airline) {
        handleInputChange('shippingCompany', data.airline)
        setShippingCompanySource('file')
        console.log('航空公司识别来源: 文件解析', data.airline)
      }
    }
    
    // ETA
    if (data.eta) {
      handleInputChange('estimatedArrival', data.eta)
    }
  }
  
  // 获取追踪补充信息（码头、船名航次、件数、毛重等）
  // 用于填充提单解析未提取到的字段
  // 重要：只填充真实数据，不填充虚拟数据。如果字段已有值，不覆盖。
  const fetchSupplementInfo = async (billNumber?: string, containerNumber?: string) => {
    if (!billNumber && !containerNumber) return
    
    try {
      console.log('获取追踪补充信息...', { billNumber, containerNumber })
      const response = await getTrackingSupplementInfo({
        trackingNumber: billNumber,
        containerNumber: containerNumber,
        transportType: selectedTransport || 'sea',
      })
      
      // 如果API返回null或没有数据，说明没有真实数据，不填充
      if (response.errCode === 200 && response.data) {
        const info = response.data
        
        // 检查是否是虚拟数据（这些值正好是mock数据中的值）
        const isMockData = (
          (info.pieces === 120 && info.grossWeight === 2500.5 && info.volume === 45.8) ||
          (info.vessel === 'COSCO TAURUS' && info.voyage === 'V.025E')
        )
        
        if (isMockData) {
          console.warn('⚠️ 检测到虚拟数据，跳过填充。保留已提取的真实数据。')
          return
        }
        
        console.log('追踪补充信息（真实数据）:', info)
        
        // 自动填充码头/地勤信息（只在字段为空时填充）
        if (info.terminal && !formData.groundHandling) {
          handleInputChange('groundHandling', info.terminal)
        }
        
        // 自动填充船名航次（只在字段为空时填充）
        if (info.vessel && !formData.flightNumber) {
          const vesselInfo = info.voyage ? `${info.vessel} ${info.voyage}` : info.vessel
          handleInputChange('flightNumber', vesselInfo)
        }
        
        // 自动填充 ETA（只在字段为空时填充）
        if (info.eta && !formData.estimatedArrival) {
          handleInputChange('estimatedArrival', info.eta)
        }
        
        // 自动填充 ETD（只在字段为空时填充）
        if (info.etd && !formData.estimatedDeparture) {
          handleInputChange('estimatedDeparture', info.etd)
        }
        
        // 自动填充件数（只在字段为空时填充）
        if (info.pieces && !formData.pieces) {
          handleInputChange('pieces', String(info.pieces))
        }
        
        // 自动填充毛重（只在字段为空时填充）
        if (info.grossWeight && !formData.grossWeight) {
          handleInputChange('grossWeight', String(info.grossWeight))
        }
        
        // 自动填充体积（只在字段为空时填充）
        if (info.volume && !formData.volume) {
          handleInputChange('volume', String(info.volume))
        }
        
        // 自动填充集装箱号（只在字段为空时填充）
        if (info.containerNumber && !formData.containerNumber) {
          handleInputChange('containerNumber', info.containerNumber)
        }
        
        // 自动填充封号（只在字段为空时填充）
        if (info.sealNumber && !formData.sealNumber) {
          handleInputChange('sealNumber', info.sealNumber)
        }
        
        // 自动填充柜型（只在字段为空时填充）
        if (info.containerType && !formData.containerSize) {
          handleInputChange('containerSize', info.containerType)
        }
        
        // 显示获取到的补充信息
        const supplementFields: string[] = []
        if (info.terminal) supplementFields.push(`码头: ${info.terminal}`)
        if (info.vessel) supplementFields.push(`船名: ${info.vessel}`)
        if (info.voyage) supplementFields.push(`航次: ${info.voyage}`)
        if (info.eta) supplementFields.push(`ETA: ${info.eta}`)
        if (info.pieces) supplementFields.push(`件数: ${info.pieces}`)
        if (info.grossWeight) supplementFields.push(`毛重: ${info.grossWeight}KG`)
        if (info.containerNumber) supplementFields.push(`柜号: ${info.containerNumber}`)
        if (info.sealNumber) supplementFields.push(`封号: ${info.sealNumber}`)
        if (info.containerType) supplementFields.push(`柜型: ${info.containerType}`)
        
        if (supplementFields.length > 0) {
          console.log('已自动填充补充信息（真实数据）:', supplementFields.join(', '))
        }
      } else if (response.errCode === 200 && !response.data) {
        // API返回成功但没有数据，说明没有获取到真实数据（可能是未配置API或API失败）
        console.log('⚠️ 未获取到真实跟踪数据，保留已提取的数据')
      }
    } catch (error) {
      console.error('获取追踪补充信息失败:', error)
      // 不影响主流程，静默失败
    }
  }
  
  // 回退到旧的解析方法
  const fallbackParseBillFile = async () => {
    if (!formData.masterBillFile) return
    
    try {
      const response = await parseBillFile(formData.masterBillFile)
      if (response.errCode === 200 && response.data) {
        const data = response.data
        let containerCodeFromBill = ''
        
        if (data.masterBillNumber) {
          const billNumber = data.masterBillNumber.toUpperCase()
          const match = billNumber.match(/^([A-Z]{4})(\d+)$/)
          if (match) {
            containerCodeFromBill = match[1]
            handleInputChange('containerCodePrefix', match[1])
            handleInputChange('masterBillNumberSuffix', match[2])
            handleInputChange('masterBillNumber', billNumber)
          } else {
            handleInputChange('masterBillNumber', billNumber)
          }
        }
        
        // 船公司识别：优先使用集装箱代码匹配
        if (containerCodeFromBill && selectedTransport === 'sea') {
          try {
            const companyResponse = await getShippingCompanyByContainerCode(containerCodeFromBill)
            if (companyResponse.errCode === 200 && companyResponse.data) {
              handleInputChange('shippingCompany', companyResponse.data.companyCode || companyResponse.data.companyName)
              setShippingCompanySource('container')
              console.log('船公司识别来源: 集装箱代码匹配', companyResponse.data.companyCode)
            } else if (data.shippingCompany) {
              // 集装箱代码匹配失败，回退到文件解析
              handleInputChange('shippingCompany', data.shippingCompany)
              setShippingCompanySource('file')
            }
          } catch {
            // 集装箱代码匹配失败，回退到文件解析
            if (data.shippingCompany) {
              handleInputChange('shippingCompany', data.shippingCompany)
              setShippingCompanySource('file')
            }
          }
        } else if (data.shippingCompany) {
          handleInputChange('shippingCompany', data.shippingCompany)
          setShippingCompanySource('file')
        }
        
        if (data.origin) handleInputChange('origin', data.origin)
        if (data.destination) handleInputChange('destination', data.destination)
        if (data.pieces) handleInputChange('pieces', data.pieces)
        if (data.weight) handleInputChange('grossWeight', data.weight)
        if (data.volume) handleInputChange('volume', data.volume)
        if (data.vessel) handleInputChange('flightNumber', data.vessel)
        if (data.estimatedDeparture) handleInputChange('estimatedDeparture', data.estimatedDeparture)
        
        alert('提单信息已自动提取并填充到表单中')
      }
    } catch (error) {
      console.error('回退解析失败:', error)
      alert('解析文件失败，请手动填写表单信息')
    }
  }

  const handleFileUpload = (field: 'masterBillFile' | 'resourceFile', file: File | null) => {
    if (field === 'masterBillFile') {
      // 只更新文件状态，不立即解析
      setFormData(prev => ({ ...prev, masterBillFile: file }))
    } else {
      setResourceFile(file)
    }
  }

  const handleDownloadTemplate = () => {
    // 创建提单信息模板 CSV
    const templateHeaders = [
      '主单号', '起运港', '目的港', '船公司', '船名/航次', 
      '件数', '毛重(KG)', '体积(CBM)', '货物描述', '发货人', '收货人'
    ]
    const sampleRow = [
      'COSU1234567890', 'CNSHA', 'NLRTM', 'COSCO', 'COSCO TAURUS / V.001E',
      '100', '2500', '45.5', '电子产品', 'ABC贸易公司', 'XYZ进口商'
    ]
    const csvContent = '\uFEFF' + templateHeaders.join(',') + '\n' + sampleRow.join(',')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '提单信息模板.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleDownloadReferenceTemplate = () => {
    // 创建参考号模板 CSV
    const templateHeaders = [
      '参考号', '件数', '毛重(KG)', '发货人', '发货人详情', '收货地址', '收货地址详情'
    ]
    const sampleRow = [
      'REF001', '10', '250', '发货公司A', '联系人: 张三, 电话: 13800138000', 
      '荷兰阿姆斯特丹', 'Keizersgracht 123, 1015 CJ Amsterdam'
    ]
    const csvContent = '\uFEFF' + templateHeaders.join(',') + '\n' + sampleRow.join(',')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '参考号模板.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleReferenceTemplateUpload = (file: File | null) => {
    setReferenceTemplateFile(file)
  }

  const handleAddReferenceRow = () => {
    // 自动生成参考号：REF-{序号}，序号基于当前列表长度+1，补零到3位
    const nextNumber = (referenceList.length + 1).toString().padStart(3, '0')
    const autoReferenceNumber = `REF-${nextNumber}`
    
    // 件数：优先从OCR解析结果获取，否则从表单件数获取，无数据显示 -
    const autoPieces = ocrResult?.pieces?.toString() || formData.pieces || '-'
    
    // 毛重：优先从OCR解析结果获取，否则从表单毛重获取，无数据显示 -
    const autoGrossWeight = ocrResult?.grossWeight?.toString() || formData.grossWeight || '-'
    
    // 发货人信息：从OCR解析结果、billShipper state 或提单数据获取
    // shipper 第一行是公司名，后续行是详情地址
    const shipperText = ocrResult?.shipper || billShipper || editData?.shipper || ''
    const shipperLines = shipperText.split('\n').filter((line: string) => line.trim())
    const autoShipper = shipperLines[0] || '-' // 第一行：公司名，无数据显示 -
    const autoShipperDetails = shipperLines.slice(1).join(', ') || '-' // 后续行：详情地址，无数据显示 -
    
    // 收货地址：默认选择第一个地址（如果有），无数据显示 -
    let autoConsigneeAddress = '-'
    let autoConsigneeAddressDetails = '-'
    if (customerAddresses.length > 0) {
      const firstAddr = customerAddresses[0]
      autoConsigneeAddress = firstAddr.companyName || firstAddr.address || '-'
      autoConsigneeAddressDetails = [
        firstAddr.address,
        firstAddr.city,
        firstAddr.postalCode,
        firstAddr.country
      ].filter(Boolean).join(', ') || '-'
    }
    
    const newRow = {
      id: Date.now().toString(),
      referenceNumber: autoReferenceNumber,
      pieces: autoPieces,
      grossWeight: autoGrossWeight,
      shipper: autoShipper,
      shipperDetails: autoShipperDetails,
      consigneeAddress: autoConsigneeAddress,
      consigneeAddressDetails: autoConsigneeAddressDetails,
    }
    setReferenceList([...referenceList, newRow])
  }

  const handleDeleteReferenceRow = (id: string) => {
    setReferenceList(referenceList.filter(row => row.id !== id))
  }

  const handleReferenceChange = (id: string, field: string, value: string) => {
    setReferenceList(referenceList.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  const handleSaveReference = () => {
    // 验证参考号数据
    if (referenceList.length === 0) {
      alert('请至少添加一条参考号记录')
      return
    }
    
    const emptyRows = referenceList.filter(row => !row.referenceNumber.trim())
    if (emptyRows.length > 0) {
      alert('参考号不能为空，请填写完整')
      return
    }
    
    // 保存到 localStorage（临时存储，后续可对接后台）
    const storageKey = `bill_references_${formData.masterBillNumber || 'draft'}`
    localStorage.setItem(storageKey, JSON.stringify(referenceList))
    
    alert(`已保存 ${referenceList.length} 条参考号记录`)
  }

  // 验证必填字段
  const validateForm = (): { valid: boolean; errors: Record<string, string> } => {
    const newErrors: Record<string, string> = {}
    
    // 基本信息必填字段验证
    if (!formData.masterBillNumber) {
      newErrors.masterBillNumber = '主单号为必填项'
    }
    if (!formData.origin) {
      newErrors.origin = '起运港为必填项'
    }
    if (!formData.destination) {
      newErrors.destination = '目的港为必填项'
    }
    if (!formData.pieces || parseInt(formData.pieces) <= 0) {
      newErrors.pieces = '件数为必填项且必须大于0'
    }
    if (!formData.grossWeight || parseFloat(formData.grossWeight) <= 0) {
      newErrors.grossWeight = '毛重为必填项且必须大于0'
    }
    if (!formData.flightNumber) {
      newErrors.flightNumber = '航班号/船名航次为必填项'
    }
    if (!formData.estimatedArrival) {
      newErrors.estimatedArrival = '预计到达时间为必填项'
    }
    
    // 海运特有字段验证
    if (selectedTransport === 'sea') {
      if (!formData.containerType) {
        newErrors.containerType = '箱型为必填项'
      }
      if (!formData.billType) {
        newErrors.billType = '提单类型为必填项'
      }
      if (!formData.consigneeType) {
        newErrors.consigneeType = '请选择收货人'
      }
    }
    
    // 简易创建时，需要验证参考号
    if (easyBill && selectedType === 'official') {
      if (referenceList.length === 0) {
        newErrors.referenceList = '请至少添加一条参考号信息'
      } else {
        referenceList.forEach((ref, index) => {
          if (!ref.referenceNumber) {
            newErrors[`reference_${index}_number`] = '参考号为必填项'
          }
          if (!ref.pieces || parseInt(ref.pieces) <= 0) {
            newErrors[`reference_${index}_pieces`] = '件数为必填项且必须大于0'
          }
          if (!ref.grossWeight || parseFloat(ref.grossWeight) <= 0) {
            newErrors[`reference_${index}_weight`] = '毛重为必填项且必须大于0'
          }
        })
      }
    }
    
    setErrors(newErrors)
    return { valid: Object.keys(newErrors).length === 0, errors: newErrors }
  }

  const handleSubmit = async () => {
    const validation = validateForm()
    if (!validation.valid) {
      // 获取具体的错误信息
      const errorMessages = Object.values(validation.errors).filter(Boolean)
      if (errorMessages.length > 0) {
        alert(`请填写以下必填项：\n${errorMessages.slice(0, 5).join('\n')}${errorMessages.length > 5 ? `\n... 还有 ${errorMessages.length - 5} 项` : ''}`)
      } else {
        alert('请填写所有必填项')
      }
      return
    }
    
    setSubmitting(true)
    try {
      // 转换运输方式
      const transportMethodMap: Record<string, string> = {
        air: '空运',
        sea: '海运',
        rail: '铁路货运',
        truck: '卡车派送'
      }
      
      // 构建提交数据
      // 注意：billNumber 由后端自动生成（格式：BP2500001）
      // masterBillNumber 保存为 containerNumber（运单号/集装箱号）
      // 解析船名和航次（格式可能是 "EVER ACME 1375-011W" 或 "EVER ACME V.011W"）
      let vesselName = formData.flightNumber
      let voyageNo = ''
      
      // 尝试解析航次（常见格式：V.xxx, xxx-xxxW, xxxE, xxxW）
      const voyageMatch = formData.flightNumber.match(/\s+(V\.?\d+[A-Z]?|\d+[-]?\d*[EW]?)$/i)
      if (voyageMatch) {
        voyageNo = voyageMatch[1]
        vesselName = formData.flightNumber.substring(0, voyageMatch.index).trim()
      }
      
      const billData = {
        // billNumber 不传，由后端自动生成
        containerNumber: formData.containerNumber || formData.masterBillNumber, // 集装箱号
        transportMethod: transportMethodMap[selectedTransport || ''],
        vessel: vesselName,
        voyage: voyageNo, // 新增航次字段
        groundHandling: formData.groundHandling || '', // 地勤（码头）
        // 集装箱信息
        sealNumber: formData.sealNumber || '', // 封号
        containerSize: formData.containerSize || '', // 柜型
        etd: formData.estimatedDeparture || '', // 装船日期 (Date Laden on Board)
        eta: formData.estimatedArrival,
        ata: '', // 实际到港时间，创建时为空
        pieces: parseInt(formData.pieces),
        weight: parseFloat(formData.grossWeight),
        volume: parseFloat(formData.volume),
        inspection: '-',
        customsStats: '0/0',
        creator: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email || 'system' : 'system',
        createTime: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
        status: selectedType === 'official' ? '船未到港' : '已完成',
        shipper: '',
        consignee: '',
        notifyParty: '',
        portOfLoading: formData.origin,
        portOfDischarge: formData.destination,
        placeOfDelivery: formData.destination,
        // 草稿相关字段
        billId: `BL-${Date.now()}`,
        companyName: '',
        // 客户关联信息
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.customerName || '',
        customerCode: selectedCustomer?.customerCode || '',
        // 附加属性字段
        containerType: formData.containerType,
        billType: formData.billType,
        transportArrangement: formData.transportation,
        consigneeType: formData.consigneeType,
        containerReturn: formData.containerReturn,
        fullContainerTransport: formData.fullContainerTransport,
        lastMileTransport: formData.lastMileTransport,
        devanning: formData.devanning,
        t1Declaration: formData.isT1Customs === 'yes' ? 'yes' : 'no',
        // Reference List
        referenceList: JSON.stringify(referenceList),
      }

      // 根据模式决定是创建还是更新
      let response
      if (isEditMode && editData?.id) {
        response = await updateBill(editData.id, billData)
      } else {
        response = await createBill(billData)
      }
      
      if (response.errCode === 200) {
        alert(isEditMode ? '提单更新成功' : '提单创建成功')
        onSubmit?.(selectedType!)
        onSuccess?.() // 刷新列表
        // 重置表单
        setCurrentStep(1)
        setSelectedType(null)
        setSelectedTransport(null)
        setEasyBill(true)
        setFormData({
          masterBillFile: null,
          containerCodePrefix: '',
          masterBillNumberSuffix: '',
          masterBillNumber: '',
          shippingCompany: '',
          origin: '',
          destination: '',
          pieces: '',
          volume: '',
          volumeUnit: 'CBM',
          freightRate: '',
          freightRateUnit: 'CNY',
          isT1Customs: 'yes',
          flightNumber: '',
          groundHandling: '',
          estimatedDeparture: '',
          estimatedArrival: '',
          grossWeight: '',
          grossWeightUnit: 'KGS',
          delivery: 'After Clearance',
          transportation: '',
          containerType: '',
          billType: '',
          consigneeType: '',
          containerReturn: '',
          fullContainerTransport: '',
          lastMileTransport: 'truck',
          devanning: '',
          containerNumber: '',
          sealNumber: '',
          containerSize: '',
        })
        setShippingCompanySource('')
        setReferenceList([])
        setErrors({})
        onClose()
      } else {
        alert(`创建失败: ${response.msg}`)
      }
    } catch (error) {
      console.error(isEditMode ? '更新提单失败:' : '创建提单失败:', error)
      alert(isEditMode ? '更新提单失败，请稍后重试' : '创建提单失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 保存草稿（不验证必填字段）
  const handleSaveDraft = async () => {
    // 草稿只需要有主单号即可
    if (!formData.masterBillNumber) {
      alert('请至少填写主单号')
      return
    }
    
    setSubmitting(true)
    try {
      // 转换运输方式
      const transportMethodMap: Record<string, string> = {
        air: '空运',
        sea: '海运',
        rail: '铁路货运',
        truck: '卡车派送'
      }
      
      // 构建草稿数据
      // 注意：billNumber 由后端自动生成（格式：BP2500001）
      // masterBillNumber 保存为 containerNumber（运单号/集装箱号）
      // 解析船名和航次
      let draftVesselName = formData.flightNumber || ''
      let draftVoyageNo = ''
      
      if (formData.flightNumber) {
        const draftVoyageMatch = formData.flightNumber.match(/\s+(V\.?\d+[A-Z]?|\d+[-]?\d*[EW]?)$/i)
        if (draftVoyageMatch) {
          draftVoyageNo = draftVoyageMatch[1]
          draftVesselName = formData.flightNumber.substring(0, draftVoyageMatch.index).trim()
        }
      }
      
      const draftData = {
        // billNumber 不传，由后端自动生成
        containerNumber: formData.containerNumber || formData.masterBillNumber || '', // 集装箱号
        transportMethod: transportMethodMap[selectedTransport || ''] || '',
        vessel: draftVesselName,
        voyage: draftVoyageNo, // 新增航次字段
        groundHandling: formData.groundHandling || '', // 地勤（码头）
        // 集装箱信息
        sealNumber: formData.sealNumber || '', // 封号
        containerSize: formData.containerSize || '', // 柜型
        etd: formData.estimatedDeparture || '', // 装船日期 (Date Laden on Board)
        eta: formData.estimatedArrival || '',
        ata: '',
        pieces: formData.pieces ? parseInt(formData.pieces) : 0,
        weight: formData.grossWeight ? parseFloat(formData.grossWeight) : 0,
        volume: formData.volume ? parseFloat(formData.volume) : 0,
        inspection: '-',
        customsStats: '0/0',
        creator: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email || 'system' : 'system',
        createTime: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
        status: '草稿', // 草稿状态
        shipper: '',
        consignee: '',
        notifyParty: '',
        portOfLoading: formData.origin || '',
        portOfDischarge: formData.destination || '',
        placeOfDelivery: formData.destination || '',
        billId: `DRAFT-${Date.now()}`,
        companyName: formData.shippingCompany || '',
        // 客户关联信息
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.customerName || '',
        customerCode: selectedCustomer?.customerCode || '',
        // 附加属性字段（草稿也保存，即使可能为空）
        containerType: formData.containerType || '',
        billType: formData.billType || '',
        transportArrangement: formData.transportation || '',
        consigneeType: formData.consigneeType || '',
        containerReturn: formData.containerReturn || '',
        fullContainerTransport: formData.fullContainerTransport || '',
        lastMileTransport: formData.lastMileTransport || 'truck',
        devanning: formData.devanning || '',
        t1Declaration: formData.isT1Customs === 'yes' ? 'yes' : 'no',
        // Reference List
        referenceList: JSON.stringify(referenceList),
      }

      console.log('准备保存草稿，数据:', draftData)
      const response = await createBill(draftData)
      console.log('保存草稿API响应:', response)
      
      if (response.errCode === 200) {
        alert('草稿保存成功')
        onSubmit?.(selectedType!)
        onSuccess?.() // 刷新列表
        // 重置表单
        setCurrentStep(1)
        setSelectedType(null)
        setSelectedTransport(null)
        setEasyBill(true)
        setFormData({
          masterBillFile: null,
          containerCodePrefix: '',
          masterBillNumberSuffix: '',
          masterBillNumber: '',
          shippingCompany: '',
          origin: '',
          destination: '',
          pieces: '',
          volume: '',
          volumeUnit: 'CBM',
          freightRate: '',
          freightRateUnit: 'CNY',
          isT1Customs: 'yes',
          flightNumber: '',
          groundHandling: '',
          estimatedDeparture: '',
          estimatedArrival: '',
          grossWeight: '',
          grossWeightUnit: 'KGS',
          delivery: 'After Clearance',
          transportation: '',
          containerType: '',
          billType: '',
          consigneeType: '',
          containerReturn: '',
          fullContainerTransport: '',
          lastMileTransport: 'truck',
          devanning: '',
          containerNumber: '',
          sealNumber: '',
          containerSize: '',
        })
        setShippingCompanySource('')
        setReferenceList([])
        setErrors({})
        onClose()
      } else {
        alert(`保存失败: ${response.msg}`)
      }
    } catch (error: any) {
      console.error('保存草稿失败:', error)
      console.error('错误详情:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response
      })
      const errorMsg = error?.response?.data?.msg || error?.message || '保存草稿失败，请稍后重试'
      alert(`保存草稿失败: ${errorMsg}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 获取运输方式显示文本
  const getTransportText = () => {
    const map: Record<string, string> = {
      air: '空运',
      sea: '海运',
      rail: '铁路货运',
      truck: '卡车派送'
    }
    return selectedTransport ? map[selectedTransport] : ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black bg-opacity-50 overflow-y-auto">
      <div className={`bg-white rounded-lg shadow-xl w-full ${currentStep === 3 ? 'max-w-5xl' : 'max-w-2xl'} max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{isEditMode ? '编辑提单' : '创建提单'}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center">
            {/* Step 1 */}
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  currentStep === 1
                    ? 'bg-primary-600 text-white'
                    : currentStep > 1
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span
                className={`ml-2 text-xs ${
                  currentStep === 1
                    ? 'text-primary-600 font-medium'
                    : currentStep > 1
                    ? 'text-primary-600'
                    : 'text-gray-500'
                }`}
              >
                选择提单类型
              </span>
            </div>

            {/* Connector 1 */}
            <div
              className={`flex-1 h-0.5 mx-3 transition-all ${
                currentStep > 1 ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />

            {/* Step 2 */}
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  currentStep === 2
                    ? 'bg-primary-600 text-white'
                    : currentStep > 2
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span
                className={`ml-2 text-xs ${
                  currentStep === 2
                    ? 'text-primary-600 font-medium'
                    : currentStep > 2
                    ? 'text-primary-600'
                    : 'text-gray-500'
                }`}
              >
                运输方式 + 上传运输单
              </span>
            </div>

            {/* Connector 2 */}
            <div
              className={`flex-1 h-0.5 mx-3 transition-all ${
                currentStep > 2 ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />

            {/* Step 3 */}
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  currentStep === 3
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                3
              </div>
              <span
                className={`ml-2 text-xs ${
                  currentStep === 3
                    ? 'text-primary-600 font-medium'
                    : 'text-gray-500'
                }`}
              >
                确认信息 + 补录
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {currentStep === 1 && (
            <div className="flex items-center justify-center gap-6 min-h-[300px]">
              {/* 正式提单 */}
              <div
                onClick={() => setSelectedType('official')}
                className={`flex-1 max-w-xs h-32 border-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  selectedType === 'official'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span
                  className={`text-lg font-medium ${
                    selectedType === 'official'
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}
                >
                  正式提单
                </span>
              </div>

              {/* 临时提单 */}
              <div
                onClick={() => setSelectedType('temporary')}
                className={`flex-1 max-w-xs h-32 border-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  selectedType === 'temporary'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span
                  className={`text-lg font-medium ${
                    selectedType === 'temporary'
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}
                >
                  临时提单
                </span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="min-h-[300px]">
              {/* 运输方式选择 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {/* 空运 */}
                <div
                  onClick={() => handleTransportChange('air')}
                  className={`flex flex-col items-center justify-center gap-2 h-24 border-2 rounded-lg transition-all cursor-pointer ${
                    selectedTransport === 'air'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <Plane className={`w-6 h-6 ${selectedTransport === 'air' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${selectedTransport === 'air' ? 'text-green-600' : 'text-gray-700'}`}>
                    空运
                  </span>
                </div>

                {/* 海运 */}
                <div
                  onClick={() => handleTransportChange('sea')}
                  className={`flex flex-col items-center justify-center gap-2 h-24 border-2 rounded-lg transition-all cursor-pointer ${
                    selectedTransport === 'sea'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <Ship className={`w-6 h-6 ${selectedTransport === 'sea' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${selectedTransport === 'sea' ? 'text-green-600' : 'text-gray-700'}`}>
                    海运
                  </span>
                </div>

                {/* 铁路货运 */}
                <div
                  onClick={() => handleTransportChange('rail')}
                  className={`flex flex-col items-center justify-center gap-2 h-24 border-2 rounded-lg transition-all cursor-pointer ${
                    selectedTransport === 'rail'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <Train className={`w-6 h-6 ${selectedTransport === 'rail' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${selectedTransport === 'rail' ? 'text-green-600' : 'text-gray-700'}`}>
                    铁路货运
                  </span>
                </div>

                {/* 卡车派送 */}
                <div
                  onClick={() => handleTransportChange('truck')}
                  className={`flex flex-col items-center justify-center gap-2 h-24 border-2 rounded-lg transition-all cursor-pointer ${
                    selectedTransport === 'truck'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <Truck className={`w-6 h-6 ${selectedTransport === 'truck' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${selectedTransport === 'truck' ? 'text-green-600' : 'text-gray-700'}`}>
                    卡车派送
                  </span>
                </div>
              </div>

              {/* 简易创建提单选项 - 仅正式提单显示 */}
              {selectedType === 'official' && (
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="easyBill"
                    checked={easyBill}
                    onChange={(e) => setEasyBill(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="easyBill" className="text-sm text-gray-700 cursor-pointer">
                    简易创建提单(Easy Bill)请勾选
                  </label>
                </div>
              )}
              
              {/* 上传运输单 - 选择运输方式后显示 */}
              {selectedTransport && (
                <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    上传运输单（可选，支持OCR智能识别）
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    支持 PDF、图片(JPG/PNG)、Excel 格式，系统将自动识别并填充表单字段
                  </p>
                  <div className="flex items-center gap-3">
                    <label className={`px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer text-xs flex items-center gap-1.5 transition-colors ${ocrParsing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>选择文件</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          setFormData(prev => ({ ...prev, masterBillFile: file }))
                          // 自动开始解析 - 直接传入文件参数，避免状态更新异步问题
                          if (file) {
                            handleParseFile(file)
                          }
                        }}
                        className="hidden"
                        disabled={ocrParsing}
                      />
                    </label>
                    {formData.masterBillFile && (
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {formData.masterBillFile.name}
                      </span>
                    )}
                    {ocrParsing && (
                      <span className="text-xs text-primary-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        正在智能识别...
                      </span>
                    )}
                  </div>
                  
                  {/* OCR识别结果预览 */}
                  {showOcrPreview && ocrResult && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          OCR识别成功，已自动填充以下字段
                        </span>
                        <button
                          onClick={() => setShowOcrPreview(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {ocrResult.billNumber && (
                          <div><span className="text-gray-500">单号:</span> <span className="font-medium">{ocrResult.billNumber}</span></div>
                        )}
                        {ocrResult.portOfLoading && (
                          <div><span className="text-gray-500">起运:</span> <span className="font-medium">{ocrResult.portOfLoading}</span></div>
                        )}
                        {ocrResult.portOfDischarge && (
                          <div><span className="text-gray-500">目的:</span> <span className="font-medium">{ocrResult.portOfDischarge}</span></div>
                        )}
                        {ocrResult.pieces && (
                          <div><span className="text-gray-500">件数:</span> <span className="font-medium">{ocrResult.pieces}</span></div>
                        )}
                        {ocrResult.grossWeight && (
                          <div><span className="text-gray-500">毛重:</span> <span className="font-medium">{ocrResult.grossWeight} KG</span></div>
                        )}
                        {(ocrResult.vessel || ocrResult.flightNumber) && (
                          <div><span className="text-gray-500">航次:</span> <span className="font-medium">{ocrResult.vessel || ocrResult.flightNumber}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* OCR识别错误 */}
                  {ocrError && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <span className="text-xs text-yellow-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {ocrError}，您可以继续手动填写
                      </span>
                    </div>
                  )}
                  
                  <p className="mt-3 text-[10px] text-gray-400">
                    提示：如果识别结果不准确，可在下一步手动修改
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              {/* 简易创建提示横幅 - 仅当勾选了简易创建时显示 */}
              {easyBill && selectedType === 'official' && showEasyBillWarning && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-center justify-between">
                  <p className="text-xs text-yellow-800">
                    简易创建限制99999件,其报关资料请使用参考号制作
                  </p>
                  <button
                    onClick={() => setShowEasyBillWarning(false)}
                    className="text-yellow-600 hover:text-yellow-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ===== 基本信息 ===== */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">基本信息</h3>
                <div className="space-y-4">
                  {/* 第一行：运输方式 + 主单文件 */}
                  <div className="grid grid-cols-2 gap-x-6">
                    {/* 运输方式 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        运输方式 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={getTransportText()}
                        disabled
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 text-gray-500"
                      >
                        <option>{getTransportText()}</option>
                      </select>
                    </div>

                    {/* 主单文件 - 显示已上传的文件名 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        主单文件 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formData.masterBillFile?.name || ''}
                        placeholder="请在上方OCR区域上传文件"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* 第二行：关联客户（占整行） */}
                  <div className="grid grid-cols-2 gap-x-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        关联客户
                      </label>
                      <div className="relative customer-dropdown">
                        <input
                          type="text"
                          value={selectedCustomer ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}` : customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setSelectedCustomer(null)
                            setShowCustomerDropdown(true)
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          onKeyUp={(e) => {
                            if (e.key === 'Escape') {
                              setShowCustomerDropdown(false)
                            }
                          }}
                          className="w-full px-2 py-1.5 pr-6 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 border-gray-300 focus:ring-primary-500"
                          placeholder="搜索或选择客户（可选）"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        >
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showCustomerDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showCustomerDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                            {/* 清除选择选项 */}
                            {selectedCustomer && (
                              <div
                                className="px-2 py-1.5 text-xs hover:bg-gray-100 cursor-pointer text-gray-500 border-b"
                                onClick={() => {
                                  setSelectedCustomer(null)
                                  setCustomerSearch('')
                                  setShowCustomerDropdown(false)
                                }}
                              >
                                清除选择
                              </div>
                            )}
                            {customers
                              .filter((customer) => {
                                if (!customerSearch) return true
                                const search = customerSearch.toLowerCase()
                                return (
                                  (customer.customerCode || '').toLowerCase().includes(search) ||
                                  (customer.customerName || '').toLowerCase().includes(search) ||
                                  (customer.companyName || '').toLowerCase().includes(search)
                                )
                              })
                              .map((customer) => (
                                <div
                                  key={customer.id}
                                  className="px-2 py-1.5 text-xs hover:bg-primary-50 cursor-pointer"
                                  onClick={() => {
                                    setSelectedCustomer(customer)
                                    setCustomerSearch('')
                                    setShowCustomerDropdown(false)
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{customer.customerCode}</span>
                                    <span className={`px-1 py-0.5 text-[10px] rounded ${
                                      customer.customerLevel === 'vip' ? 'bg-yellow-100 text-yellow-700' :
                                      customer.customerLevel === 'important' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {customer.customerLevel === 'vip' ? 'VIP' : 
                                       customer.customerLevel === 'important' ? '重要' : '普通'}
                                    </span>
                                  </div>
                                  <div className="text-gray-600">{customer.customerName}</div>
                                  {customer.companyName && (
                                    <div className="text-gray-400 truncate">{customer.companyName}</div>
                                  )}
                                </div>
                              ))}
                            {customers.filter((customer) => {
                              if (!customerSearch) return true
                              const search = customerSearch.toLowerCase()
                              return (
                                (customer.customerCode || '').toLowerCase().includes(search) ||
                                (customer.customerName || '').toLowerCase().includes(search) ||
                                (customer.companyName || '').toLowerCase().includes(search)
                              )
                            }).length === 0 && (
                              <div className="px-2 py-3 text-xs text-gray-400 text-center">
                                未找到匹配的客户
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-gray-400">选择后可在CRM中查看该客户的所有订单</p>
                    </div>

                    {/* 主单号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        主单号 <span className="text-red-500">*</span>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                      </label>
                      {selectedTransport === 'sea' ? (
                        // 海运：使用下拉菜单选择集装箱代码前缀
                        <div className="relative">
                          <div className="flex gap-1">
                            {/* 集装箱代码下拉菜单 */}
                            <div className="relative flex-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={formData.containerCodePrefix}
                                  onChange={(e) => {
                                    const value = e.target.value.toUpperCase()
                                    handleInputChange('containerCodePrefix', value)
                                    // 打开下拉菜单，实时显示筛选结果
                                    setShowContainerCodeDropdown(true)
                                    // 更新完整主单号
                                    const fullNumber = value + formData.masterBillNumberSuffix
                                    handleInputChange('masterBillNumber', fullNumber)
                                  }}
                                  onFocus={() => {
                                    // 打开下拉菜单，显示筛选结果
                                    setShowContainerCodeDropdown(true)
                                    // 如果数据为空，立即加载（不依赖 selectedTransport）
                                    if (containerCodes.length === 0) {
                                      const loadContainerCodes = async () => {
                                        try {
                                          const response = await searchContainerCodes('')
                                          if (response.errCode === 200 && response.data) {
                                            const codes = response.data.map((item: any) => ({
                                              containerCode: item.container_code || item.containerCode || '',
                                              companyName: item.company_name || item.companyName || '',
                                              companyCode: item.company_code || item.companyCode || '',
                                              description: item.description || '',
                                            })).filter((item: any) => item.containerCode)
                                            setContainerCodes(codes)
                                          } else {
                                            console.warn('输入框焦点加载API返回异常:', response)
                                          }
                                        } catch (error) {
                                          console.error('输入框焦点加载集装箱代码列表失败:', error)
                                        }
                                      }
                                      loadContainerCodes()
                                    }
                                  }}
                                  placeholder="代码"
                                  className={`w-full px-2 py-1.5 pr-6 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                                    errors.masterBillNumber
                                      ? 'border-red-500 focus:ring-red-500'
                                      : 'border-gray-300 focus:ring-primary-500'
                                  }`}
                                />
                                {/* 下拉箭头按钮 */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newState = !showContainerCodeDropdown
                                    setShowContainerCodeDropdown(newState)
                                    // 如果打开下拉菜单且数据为空，立即加载（不依赖 selectedTransport）
                                    if (newState && containerCodes.length === 0) {
                                      const loadContainerCodes = async () => {
                                        try {
                                          const response = await searchContainerCodes('')
                                          if (response.errCode === 200 && response.data) {
                                            const codes = response.data.map((item: any) => ({
                                              containerCode: item.container_code || item.containerCode || '',
                                              companyName: item.company_name || item.companyName || '',
                                              companyCode: item.company_code || item.companyCode || '',
                                              description: item.description || '',
                                            })).filter((item: any) => item.containerCode)
                                            setContainerCodes(codes)
                                          } else {
                                            console.warn('下拉箭头加载API返回异常:', response)
                                          }
                                        } catch (error) {
                                          console.error('下拉箭头加载集装箱代码列表失败:', error)
                                        }
                                      }
                                      loadContainerCodes()
                                    }
                                  }}
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                  title="打开/关闭下拉菜单"
                                  aria-label="打开/关闭下拉菜单"
                                >
                                  <ChevronDown className={`w-3 h-3 transition-transform ${showContainerCodeDropdown ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                              {/* 下拉菜单 - 直接显示筛选结果 */}
                              {showContainerCodeDropdown && (
                                <>
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                                    {/* 代码列表 */}
                                    <div className="max-h-48 overflow-y-auto">
                                      {containerCodes.length === 0 ? (
                                        <div className="px-2 py-1 text-xs text-gray-500 text-center">
                                          加载中...
                                        </div>
                                      ) : filteredContainerCodes.length > 0 ? (
                                        filteredContainerCodes
                                          .slice(0, 100) // 限制显示前100条
                                          .map((code) => (
                                            <div
                                              key={code.containerCode}
                                              onClick={() => {
                                                handleContainerCodePrefixChange(code.containerCode)
                                                setShowContainerCodeDropdown(false) // 关闭下拉菜单
                                              }}
                                              className="px-2 py-1.5 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                                            >
                                              <div className="font-medium text-gray-900">{code.containerCode || ''}</div>
                                              {code.companyName && (
                                                <div className="text-[10px] text-gray-500 mt-0.5">{code.companyName}</div>
                                              )}
                                            </div>
                                          ))
                                      ) : (
                                        <div className="px-2 py-1 text-xs text-gray-500 text-center">
                                          {formData.containerCodePrefix ? '未找到匹配的代码' : '暂无数据'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* 点击外部关闭下拉菜单 */}
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowContainerCodeDropdown(false)}
                                  />
                                </>
                              )}
                            </div>
                            {/* 主单号后缀输入 */}
                            <input
                              type="text"
                              value={formData.masterBillNumberSuffix}
                              onChange={(e) => handleMasterBillNumberSuffixChange(e.target.value)}
                              placeholder="1234567"
                              className={`flex-1 px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                                errors.masterBillNumber
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 focus:ring-primary-500'
                              }`}
                            />
                          </div>
                        </div>
                      ) : (
                        // 非海运：普通输入框
                        <input
                          type="text"
                          value={formData.masterBillNumber}
                          onChange={(e) => handleMasterBillNumberChange(e.target.value)}
                          className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                            errors.masterBillNumber
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-primary-500'
                          }`}
                        />
                      )}
                      {formData.masterBillNumber && formData.shippingCompany && (
                        <p className="mt-1 text-xs text-gray-500">
                          船公司: {formData.shippingCompany}
                          {shippingCompanySource && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                              shippingCompanySource === 'container' 
                                ? 'bg-green-100 text-green-700' 
                                : shippingCompanySource === 'file'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {shippingCompanySource === 'container' ? '集装箱代码匹配' : 
                               shippingCompanySource === 'file' ? '文件解析' : '手动输入'}
                            </span>
                          )}
                          <span className="ml-2">BLNo: {formData.masterBillNumber}</span>
                        </p>
                      )}
                      {errors.masterBillNumber && (
                        <p className="mt-1 text-xs text-red-500">{errors.masterBillNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* 第三行：起运港 + 目的港 */}
                  <div className="grid grid-cols-2 gap-x-6">
                    {/* 起运港 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        起运港 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative port-of-loading-dropdown">
                        <input
                          type="text"
                          value={formData.origin}
                          onChange={(e) => {
                            handleInputChange('origin', e.target.value)
                            setPortOfLoadingSearch(e.target.value)
                            setShowPortOfLoadingDropdown(true)
                            if (errors.origin) {
                              setErrors(prev => ({ ...prev, origin: '' }))
                            }
                          }}
                          onFocus={() => {
                            setShowPortOfLoadingDropdown(true)
                            if (portsOfLoading.length === 0) {
                              const loadPorts = async () => {
                                try {
                                  const response = await getPortsOfLoadingList()
                                  if (response.errCode === 200 && response.data) {
                                    const activePorts = response.data.filter((port: PortOfLoadingItem) => port.status === 'active')
                                    setPortsOfLoading(activePorts)
                                  }
                                } catch (error) {
                                  console.error('加载起运港列表失败:', error)
                                }
                              }
                              loadPorts()
                            }
                          }}
                          onKeyUp={(e) => {
                            if (e.key === 'Escape') {
                              setShowPortOfLoadingDropdown(false)
                            }
                          }}
                          className={`w-full px-2 py-1.5 pr-6 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                            errors.origin
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-primary-500'
                          }`}
                          placeholder="搜索或选择起运港"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowPortOfLoadingDropdown(!showPortOfLoadingDropdown)
                            if (!showPortOfLoadingDropdown && portsOfLoading.length === 0) {
                              const loadPorts = async () => {
                                try {
                                  const response = await getPortsOfLoadingList()
                                  if (response.errCode === 200 && response.data) {
                                    const activePorts = response.data.filter((port: PortOfLoadingItem) => port.status === 'active')
                                    setPortsOfLoading(activePorts)
                                  }
                                } catch (error) {
                                  console.error('加载起运港列表失败:', error)
                                }
                              }
                              loadPorts()
                            }
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-auto"
                        >
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showPortOfLoadingDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {/* 下拉菜单 */}
                        {showPortOfLoadingDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                            {portsOfLoading
                              .filter((port) => {
                                if (!portOfLoadingSearch && !formData.origin) return true
                                const search = (portOfLoadingSearch || formData.origin || '').toLowerCase()
                                return (
                                  (port.portCode || '').toLowerCase().includes(search) ||
                                  (port.portNameCn || '').toLowerCase().includes(search) ||
                                  (port.portNameEn || '').toLowerCase().includes(search) ||
                                  (port.city || '').toLowerCase().includes(search) ||
                                  (port.country || '').toLowerCase().includes(search)
                                )
                              })
                              .map((port) => (
                                <div
                                  key={port.id}
                                  onClick={() => {
                                    const displayName = `${port.portNameCn || port.portNameEn || port.portCode} (${port.portCode})`
                                    handleInputChange('origin', displayName)
                                    setPortOfLoadingSearch('')
                                    setShowPortOfLoadingDropdown(false)
                                    if (errors.origin) {
                                      setErrors(prev => ({ ...prev, origin: '' }))
                                    }
                                  }}
                                  className="px-2 py-1.5 text-xs hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">
                                    {port.portNameCn || port.portNameEn || port.portCode}
                                  </div>
                                  <div className="text-gray-500 text-[10px] mt-0.5">
                                    {port.portCode} {port.city && `· ${port.city}`} {port.country && `· ${port.country}`}
                                  </div>
                                </div>
                              ))}
                            {portsOfLoading.filter((port) => {
                              if (!portOfLoadingSearch && !formData.origin) return true
                              const search = (portOfLoadingSearch || formData.origin || '').toLowerCase()
                              return (
                                (port.portCode || '').toLowerCase().includes(search) ||
                                (port.portNameCn || '').toLowerCase().includes(search) ||
                                (port.portNameEn || '').toLowerCase().includes(search) ||
                                (port.city || '').toLowerCase().includes(search) ||
                                (port.country || '').toLowerCase().includes(search)
                              )
                            }).length === 0 && (
                              <div className="px-2 py-2 text-xs text-gray-500 text-center">暂无数据</div>
                            )}
                          </div>
                        )}
                      </div>
                      {errors.origin && (
                        <p className="mt-1 text-xs text-red-500">{errors.origin}</p>
                      )}
                    </div>

                    {/* 目的港 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        目的港 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative destination-port-dropdown">
                        <input
                          type="text"
                          value={formData.destination}
                          onChange={(e) => {
                            handleInputChange('destination', e.target.value)
                            setDestinationPortSearch(e.target.value)
                            setShowDestinationPortDropdown(true)
                            if (errors.destination) {
                              setErrors(prev => ({ ...prev, destination: '' }))
                            }
                          }}
                          onFocus={() => {
                            setShowDestinationPortDropdown(true)
                            if (destinationPorts.length === 0) {
                              const loadPorts = async () => {
                                try {
                                  const response = await getDestinationPortsList()
                                  if (response.errCode === 200 && response.data) {
                                    const activePorts = response.data.filter((port: DestinationPortItem) => port.status === 'active')
                                    setDestinationPorts(activePorts)
                                  }
                                } catch (error) {
                                  console.error('加载目的港列表失败:', error)
                                }
                              }
                              loadPorts()
                            }
                          }}
                          onKeyUp={(e) => {
                            if (e.key === 'Escape') {
                              setShowDestinationPortDropdown(false)
                            }
                          }}
                          className={`w-full px-2 py-1.5 pr-6 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                            errors.destination
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-primary-500'
                          }`}
                          placeholder="搜索或选择目的港"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowDestinationPortDropdown(!showDestinationPortDropdown)
                            if (!showDestinationPortDropdown && destinationPorts.length === 0) {
                              const loadPorts = async () => {
                                try {
                                  const response = await getDestinationPortsList()
                                  if (response.errCode === 200 && response.data) {
                                    const activePorts = response.data.filter((port: DestinationPortItem) => port.status === 'active')
                                    setDestinationPorts(activePorts)
                                  }
                                } catch (error) {
                                  console.error('加载目的港列表失败:', error)
                                }
                              }
                              loadPorts()
                            }
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-auto"
                        >
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showDestinationPortDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {/* 下拉菜单 */}
                        {showDestinationPortDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                            {destinationPorts
                              .filter((port) => {
                                if (!destinationPortSearch && !formData.destination) return true
                                const search = (destinationPortSearch || formData.destination || '').toLowerCase()
                                return (
                                  (port.portCode || '').toLowerCase().includes(search) ||
                                  (port.portNameCn || '').toLowerCase().includes(search) ||
                                  (port.portNameEn || '').toLowerCase().includes(search) ||
                                  (port.city || '').toLowerCase().includes(search) ||
                                  (port.country || '').toLowerCase().includes(search)
                                )
                              })
                              .map((port) => (
                                <div
                                  key={port.id}
                                  onClick={() => {
                                    const displayName = `${port.portNameCn || port.portNameEn || port.portCode} (${port.portCode})`
                                    handleInputChange('destination', displayName)
                                    setDestinationPortSearch('')
                                    setShowDestinationPortDropdown(false)
                                    if (errors.destination) {
                                      setErrors(prev => ({ ...prev, destination: '' }))
                                    }
                                  }}
                                  className="px-2 py-1.5 text-xs hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">
                                    {port.portNameCn || port.portNameEn || port.portCode}
                                  </div>
                                  <div className="text-gray-500 text-[10px] mt-0.5">
                                    {port.portCode} {port.city && `· ${port.city}`} {port.country && `· ${port.country}`}
                                  </div>
                                </div>
                              ))}
                            {destinationPorts.filter((port) => {
                              if (!destinationPortSearch && !formData.destination) return true
                              const search = (destinationPortSearch || formData.destination || '').toLowerCase()
                              return (
                                (port.portCode || '').toLowerCase().includes(search) ||
                                (port.portNameCn || '').toLowerCase().includes(search) ||
                                (port.portNameEn || '').toLowerCase().includes(search) ||
                                (port.city || '').toLowerCase().includes(search) ||
                                (port.country || '').toLowerCase().includes(search)
                              )
                            }).length === 0 && (
                              <div className="px-2 py-2 text-xs text-gray-500 text-center">暂无数据</div>
                            )}
                          </div>
                        )}
                      </div>
                      {errors.destination && (
                        <p className="mt-1 text-xs text-red-500">{errors.destination}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== 航程信息 ===== */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">航程信息</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* 航班号/船名航次 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      航班号/船名航次 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.flightNumber}
                      onChange={(e) => {
                        handleInputChange('flightNumber', e.target.value)
                        if (errors.flightNumber) {
                          setErrors(prev => ({ ...prev, flightNumber: '' }))
                        }
                      }}
                      className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                        errors.flightNumber
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-primary-500'
                      }`}
                    />
                    {errors.flightNumber && (
                      <p className="mt-1 text-xs text-red-500">{errors.flightNumber}</p>
                    )}
                  </div>

                  {/* 地勤（码头） */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      地勤（码头） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.groundHandling}
                      onChange={(e) => handleInputChange('groundHandling', e.target.value)}
                      placeholder="集装箱落在哪个码头"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                    />
                  </div>

                  {/* 预计离开时间 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      预计离开时间 <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      id="estimatedDeparture"
                      value={formData.estimatedDeparture}
                      onChange={(value) => handleInputChange('estimatedDeparture', value)}
                      placeholder="请选择日期"
                      className="w-full"
                    />
                  </div>

                  {/* 预计到达时间 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      预计到达时间 <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      id="estimatedArrival"
                      value={formData.estimatedArrival}
                      onChange={(value) => handleInputChange('estimatedArrival', value)}
                      placeholder="请选择日期"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* ===== 货物信息 ===== */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">货物信息</h3>
                <div className="space-y-4">
                  {/* 第一行：件数 + 毛重 */}
                  <div className="grid grid-cols-2 gap-x-6">
                    {/* 件数 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        件数 <span className="text-red-500">*</span>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                      </label>
                      <input
                        type="number"
                        value={formData.pieces}
                        onChange={(e) => handleInputChange('pieces', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      />
                    </div>

                    {/* 毛重 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        毛重 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.grossWeight}
                          onChange={(e) => handleInputChange('grossWeight', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                        />
                        <select
                          value={formData.grossWeightUnit}
                          onChange={(e) => handleInputChange('grossWeightUnit', e.target.value)}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
                        >
                          <option value="KGS">KGS</option>
                          <option value="LBS">LBS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 第二行：体积 + 每公斤运费单价 */}
                  <div className="grid grid-cols-2 gap-x-6">
                    {/* 体积 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        体积 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.volume}
                          onChange={(e) => handleInputChange('volume', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                        />
                        <select
                          value={formData.volumeUnit}
                          onChange={(e) => handleInputChange('volumeUnit', e.target.value)}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
                        >
                          <option value="CBM">CBM</option>
                        </select>
                      </div>
                    </div>

                    {/* 每公斤运费单价 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        每公斤运费单价 <span className="text-red-500">*</span>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={formData.freightRate}
                          onChange={(e) => handleInputChange('freightRate', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                        />
                        <select
                          value={formData.freightRateUnit}
                          onChange={(e) => handleInputChange('freightRateUnit', e.target.value)}
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
                        >
                          <option value="CNY">CNY</option>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 第三行：派送 */}
                  <div className="grid grid-cols-2 gap-x-6">
                    {/* 派送 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        派送 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.delivery}
                        onChange={(e) => handleInputChange('delivery', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      >
                        <option value="After Bill">After Bill</option>
                        <option value="After Clearance">After Clearance</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 海运特有字段 - 集装箱信息 */}
              {selectedTransport === 'sea' && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">集装箱信息</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* 集装箱号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        集装箱号
                      </label>
                      <input
                        type="text"
                        value={formData.containerNumber}
                        onChange={(e) => handleInputChange('containerNumber', e.target.value.toUpperCase())}
                        placeholder="如 COSU1234567"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      />
                    </div>
                    
                    {/* 柜型 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        柜型
                      </label>
                      <select
                        value={formData.containerSize}
                        onChange={(e) => handleInputChange('containerSize', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      >
                        <option value="">请选择</option>
                        <option value="20GP">20GP</option>
                        <option value="40GP">40GP</option>
                        <option value="40HQ">40HQ</option>
                        <option value="45HQ">45HQ</option>
                        <option value="20RF">20RF (冷柜)</option>
                        <option value="40RF">40RF (冷柜)</option>
                        <option value="20OT">20OT (开顶)</option>
                        <option value="40OT">40OT (开顶)</option>
                        <option value="20FR">20FR (框架)</option>
                        <option value="40FR">40FR (框架)</option>
                      </select>
                    </div>
                    
                    {/* 封号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        封号
                      </label>
                      <input
                        type="text"
                        value={formData.sealNumber}
                        onChange={(e) => handleInputChange('sealNumber', e.target.value.toUpperCase())}
                        placeholder="铅封号"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 海运特有字段 - 附加属性 */}
              {selectedTransport === 'sea' && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">附加属性</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* 箱型 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        箱型 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="containerType"
                            value="cfs"
                            checked={formData.containerType === 'cfs'}
                            onChange={(e) => handleInputChange('containerType', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">拼箱(CFS)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="containerType"
                            value="fcl"
                            checked={formData.containerType === 'fcl'}
                            onChange={(e) => handleInputChange('containerType', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">整箱(FCL)</span>
                        </label>
                      </div>
                    </div>

                    {/* 运输 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        运输 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="transportation"
                            value="entrust"
                            checked={formData.transportation === 'entrust'}
                            onChange={(e) => handleInputChange('transportation', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">委托我司运输</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer bg-white">
                          <input
                            type="radio"
                            name="transportation"
                            value="self"
                            checked={formData.transportation === 'self'}
                            onChange={(e) => handleInputChange('transportation', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">自行运输</span>
                        </label>
                      </div>
                    </div>

                    {/* 提单 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        提单 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="billType"
                            value="master"
                            checked={formData.billType === 'master'}
                            onChange={(e) => handleInputChange('billType', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">船东单(Master Bill)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="billType"
                            value="house"
                            checked={formData.billType === 'house'}
                            onChange={(e) => handleInputChange('billType', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">货代单(House Bill)</span>
                        </label>
                      </div>
                    </div>

                    {/* 收货人（关联客户税号） */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        收货人 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.consigneeType}
                        onChange={(e) => handleInputChange('consigneeType', e.target.value)}
                        className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
                          errors.consigneeType ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
                        }`}
                        disabled={loadingTaxNumbers || !selectedCustomer}
                      >
                        <option value="">请选择收货人</option>
                        {/* 按公司名称分组显示，每个公司一行 */}
                        {selectedCustomer && customerTaxNumbers.length > 0 && (() => {
                          // 按公司名称分组
                          const grouped = customerTaxNumbers.reduce((acc, tax) => {
                            const key = tax.companyName || '未知公司'
                            if (!acc[key]) {
                              acc[key] = { companyName: key, taxNumbers: [], firstTaxNumber: tax.taxNumber }
                            }
                            acc[key].taxNumbers.push(`${tax.taxType === 'vat' ? 'VAT' : tax.taxType === 'eori' ? 'EORI' : '其他'}: ${tax.taxNumber}`)
                            return acc
                          }, {} as Record<string, { companyName: string; taxNumbers: string[]; firstTaxNumber: string }>)
                          
                          return Object.values(grouped).map((group) => (
                            <option key={group.companyName} value={group.firstTaxNumber}>
                              {group.companyName}
                            </option>
                          ))
                        })()}
                      </select>
                      {loadingTaxNumbers && (
                        <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          正在加载客户税号...
                        </p>
                      )}
                      {!loadingTaxNumbers && selectedCustomer && customerTaxNumbers.length === 0 && (
                        <p className="mt-1 text-[10px] text-amber-500">
                          该客户暂无税号，请先在CRM客户管理中添加税号
                        </p>
                      )}
                      {!selectedCustomer && (
                        <p className="mt-1 text-[10px] text-amber-500">
                          请先选择关联客户
                        </p>
                      )}
                      {errors.consigneeType && (
                        <p className="mt-1 text-[10px] text-red-500">{errors.consigneeType}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 海运特有字段 - 额外服务 */}
              {selectedTransport === 'sea' && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">额外服务</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* 异地还柜 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        异地还柜 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="containerReturn"
                            value="off-site"
                            checked={formData.containerReturn === 'off-site'}
                            onChange={(e) => handleInputChange('containerReturn', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">异地还柜(非Rotterdam)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="containerReturn"
                            value="local"
                            checked={formData.containerReturn === 'local'}
                            onChange={(e) => handleInputChange('containerReturn', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">本地还柜</span>
                        </label>
                      </div>
                    </div>

                    {/* 全程整柜运输 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        全程整柜运输 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="fullContainerTransport"
                            value="must-full"
                            checked={formData.fullContainerTransport === 'must-full'}
                            onChange={(e) => handleInputChange('fullContainerTransport', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">必须整柜派送</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="fullContainerTransport"
                            value="can-split"
                            checked={formData.fullContainerTransport === 'can-split'}
                            onChange={(e) => handleInputChange('fullContainerTransport', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">可拆柜后托盘送货</span>
                        </label>
                      </div>
                    </div>

                    {/* 末端运输方式 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        末端运输方式 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.lastMileTransport}
                        onChange={(e) => handleInputChange('lastMileTransport', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                      >
                        <option value="truck">卡车派送</option>
                        <option value="train">铁路运输</option>
                        <option value="air">空运</option>
                      </select>
                    </div>

                    {/* 拆柜 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        拆柜 <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="devanning"
                            value="required"
                            checked={formData.devanning === 'required'}
                            onChange={(e) => handleInputChange('devanning', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">需要拆柜分货服务</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="devanning"
                            value="not-required"
                            checked={formData.devanning === 'not-required'}
                            onChange={(e) => handleInputChange('devanning', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">不需要拆柜</span>
                        </label>
                      </div>
                    </div>

                    {/* 海关经停报关服务(T1报关) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        海关经停报关服务(T1报关) <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="isT1Customs"
                            value="yes"
                            checked={formData.isT1Customs === 'yes'}
                            onChange={(e) => handleInputChange('isT1Customs', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">是</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="isT1Customs"
                            value="no"
                            checked={formData.isT1Customs === 'no'}
                            onChange={(e) => handleInputChange('isT1Customs', e.target.value)}
                            className="w-3 h-3 text-primary-600 bg-white border-gray-300"
                          />
                          <span className="text-xs text-gray-700">否</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 根据是否勾选简易创建显示不同内容 */}
              {!easyBill || selectedType !== 'official' ? (
                /* 绑定资源 - 未勾选简易创建时显示 */
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">绑定资源</h3>
                  
                  {/* 标签页 */}
                  <div className="border-b border-gray-200 mb-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setBindResourceTab('general')}
                        className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                          bindResourceTab === 'general'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        普通运输
                      </button>
                      <button
                        onClick={() => setBindResourceTab('pallet')}
                        className={`px-2 py-1 text-xs font-medium border-b-2 transition-all flex items-center gap-1 ${
                          bindResourceTab === 'pallet'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        托盘运输
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 文件上传区域 */}
                  <div className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadTemplate}
                        className="text-green-600 hover:text-green-700 text-xs flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>下载模板文件</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600">
                      请上传Excel文件,文件大小不超过200KB
                    </p>
                    <label className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer text-xs">
                      <Upload className="w-3 h-3" />
                      <span>点击选择文件</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => handleFileUpload('resourceFile', e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {resourceFile && (
                      <p className="text-xs text-gray-600">已选择: {resourceFile.name}</p>
                    )}
                  </div>

                  {/* 注意提示 */}
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-600">
                      注意: 若是您上传的文件数据有问题,该提单会成为临时提单,您可以在草稿列表查看错误原因并且重新绑定
                    </p>
                  </div>
                </div>
              ) : (
                /* 参考号相关信息 - 勾选了简易创建时显示 */
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">参考号相关信息</h3>
                  
                  {/* 标签页 */}
                  <div className="border-b border-gray-200 mb-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setReferenceTab('form')}
                        className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                          referenceTab === 'form'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        表单创建
                      </button>
                      <button
                        onClick={() => setReferenceTab('upload')}
                        className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                          referenceTab === 'upload'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        上传模板创建
                      </button>
                    </div>
                  </div>

                  {/* 参考号列表 - 根据标签页显示不同内容 */}
                  {referenceTab === 'form' ? (
                    /* 表单创建 - 显示表格 */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-gray-900">Reference List</h4>
                        <button
                          onClick={handleSaveReference}
                          className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
                        >
                          点击此处保存
                        </button>
                      </div>

                      {/* 表格 */}
                      <div className="border border-gray-200 rounded overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">参考号</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">件数</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">毛重</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                <div className="flex items-center gap-1">
                                  发货人
                                  <HelpCircle className="w-3 h-3 text-gray-400" />
                                </div>
                              </th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">发件人详情</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">
                                <div className="flex items-center gap-1">
                                  收货地址
                                  <HelpCircle className="w-3 h-3 text-gray-400" />
                                </div>
                              </th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">收货地址详情</th>
                              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase">操作</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {referenceList.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-4 py-8 text-center">
                                  <div className="flex flex-col items-center gap-2 text-gray-400">
                                    <FileText className="w-8 h-8" />
                                    <span className="text-xs">暂无数据</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              referenceList.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={row.referenceNumber}
                                      onChange={(e) => handleReferenceChange(row.id, 'referenceNumber', e.target.value)}
                                      className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                                      placeholder="参考号"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <input
                                      type="number"
                                      value={row.pieces}
                                      onChange={(e) => handleReferenceChange(row.id, 'pieces', e.target.value)}
                                      className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                                      placeholder="件数"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <input
                                      type="number"
                                      value={row.grossWeight}
                                      onChange={(e) => handleReferenceChange(row.id, 'grossWeight', e.target.value)}
                                      className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                                      placeholder="毛重"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    {/* 发货人：从提单 Shipper 自动获取第一行，只读 */}
                                    <input
                                      type="text"
                                      value={row.shipper}
                                      readOnly
                                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-600 cursor-not-allowed"
                                      placeholder="从提单自动获取"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    {/* 发货人详情：从提单 Shipper 自动获取后续行，只读 */}
                                    <input
                                      type="text"
                                      value={row.shipperDetails}
                                      readOnly
                                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-600 cursor-not-allowed"
                                      placeholder="从提单自动获取"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <select
                                      value={row.consigneeAddress}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        handleReferenceChange(row.id, 'consigneeAddress', value)
                                        // 自动填充详细地址
                                        const selectedAddr = customerAddresses.find(
                                          addr => (addr.companyName || addr.address) === value
                                        )
                                        if (selectedAddr) {
                                          const details = [
                                            selectedAddr.address,
                                            selectedAddr.city,
                                            selectedAddr.postalCode,
                                            selectedAddr.country
                                          ].filter(Boolean).join(', ')
                                          handleReferenceChange(row.id, 'consigneeAddressDetails', details)
                                        } else {
                                          handleReferenceChange(row.id, 'consigneeAddressDetails', '')
                                        }
                                      }}
                                      className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                                      disabled={!selectedCustomer || loadingAddresses}
                                    >
                                      <option value="">
                                        {!selectedCustomer ? '请先选择客户' : loadingAddresses ? '加载中...' : customerAddresses.length === 0 ? '暂无地址' : '选择收货地址'}
                                      </option>
                                      {/* 如果当前值不在选项中，显示当前值 */}
                                      {row.consigneeAddress && !customerAddresses.some(addr => (addr.companyName || addr.address) === row.consigneeAddress) && (
                                        <option value={row.consigneeAddress}>{row.consigneeAddress}</option>
                                      )}
                                      {customerAddresses.map((addr) => (
                                        <option key={addr.id} value={addr.companyName || addr.address}>
                                          {addr.companyName || addr.contactPerson || addr.address}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    {/* 收货地址详情：自动填充，只读显示 */}
                                    <input
                                      type="text"
                                      value={row.consigneeAddressDetails}
                                      readOnly
                                      className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-600 cursor-not-allowed"
                                      placeholder="选择收货地址后自动填充"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <button
                                      onClick={() => handleDeleteReferenceRow(row.id)}
                                      className="text-red-600 hover:text-red-700 text-xs"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 添加一行按钮 */}
                      <button
                        onClick={handleAddReferenceRow}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>添加一行数据</span>
                      </button>
                    </div>
                  ) : (
                    /* 上传模板创建 - 显示上传界面 */
                    <div className="space-y-4">
                      {/* 下载模板链接 */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={handleDownloadReferenceTemplate}
                          className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1"
                        >
                          <span>请下载最新模板文件</span>
                          <Download className="w-3 h-3" />
                        </button>
                      </div>

                      {/* 说明文字 */}
                      <p className="text-xs text-gray-500 text-center">
                        请上传Excel文件,大小不超过200kb
                      </p>

                      {/* 文件上传按钮 */}
                      <div className="flex justify-center">
                        <label className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 cursor-pointer text-xs flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>点击选择文件</span>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleReferenceTemplateUpload(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* 显示已选择的文件 */}
                      {referenceTemplateFile && (
                        <p className="text-xs text-gray-600 text-center">
                          已选择: {referenceTemplateFile.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            {currentStep === 3 && (
              <button
                onClick={handleSaveDraft}
                disabled={submitting}
                className="px-2 py-1 border border-orange-300 text-orange-600 rounded hover:bg-orange-50 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '保存中...' : '保存草稿'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-1.5 py-0.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors text-xs"
            >
              取消
            </button>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-1.5 py-0.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors text-xs"
              >
                上一步
              </button>
            )}
            <button
              onClick={currentStep === 3 ? handleSubmit : handleNext}
              disabled={submitting}
              className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '提交中...' : currentStep === 3 ? '提交' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

