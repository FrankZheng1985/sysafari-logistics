/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Database, Package, Anchor, MapPin, Globe, Plane, Tag, Truck, Percent } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import BasicDataModal from '../components/BasicDataModal'
import ContainerCodeModal from '../components/ContainerCodeModal'
import PortModal from '../components/PortModal'
import DestinationPortModal from '../components/DestinationPortModal'
import CountryModal from '../components/CountryModal'
import AirPortModal from '../components/AirPortModal'
import ShippingCompanyModal from '../components/ShippingCompanyModal'
import ServiceFeeCategoryModal from '../components/ServiceFeeCategoryModal'
import TransportMethodModal from '../components/TransportMethodModal'
import VatRateModal from '../components/VatRateModal'
import { 
  getServiceFeeCategories, 
  createServiceFeeCategory, 
  updateServiceFeeCategory, 
  deleteServiceFeeCategory,
  ServiceFeeCategory,
  getTransportMethods,
  updateTransportMethod,
  deleteTransportMethod,
  TransportMethod,
  getVatRates,
  updateVatRate,
  deleteVatRate,
  VatRate
} from '../utils/api'
import { 
  getBasicDataList, 
  deleteBasicData, 
  getBasicDataCategories,
  type BasicDataItem,
  getContainerCodesList,
  deleteContainerCode,
  getShippingCompanies,
  deleteShippingCompany,
  type ContainerCodeItem,
  type ShippingCompany,
  getPortsOfLoadingList,
  deletePortOfLoading,
  clearAllPortsOfLoading,
  updatePortOfLoading,
  getPortCountries,
  type PortOfLoadingItem,
  getDestinationPortsList,
  deleteDestinationPort,
  updateDestinationPort,
  getDestinationPortCountries,
  type DestinationPortItem,
  getCountriesList,
  deleteCountry,
  updateCountry,
  getCountryContinents,
  type CountryItem,
  updateBasicData,
  getAirPortsList,
  deleteAirPort,
  updateAirPort,
  getAirPortCountries,
  type AirPortItem
} from '../utils/api'

export default function BasicDataManage() {
  const location = useLocation()
  
  // 根据URL路径初始化activeTab
  const getInitialTab = (): 'basic' | 'container' | 'port' | 'destination' | 'country' | 'airport' | 'fee-category' | 'transport-method' | 'vat' => {
    const path = location.pathname
    if (path.includes('/container')) return 'container'
    if (path.includes('/port')) return 'port'
    if (path.includes('/destination')) return 'destination'
    if (path.includes('/country')) return 'country'
    if (path.includes('/fee-category')) return 'fee-category'
    if (path.includes('/transport-method')) return 'transport-method'
    if (path.includes('/vat')) return 'vat'
    return 'basic'
  }
  
  const [activeTab, setActiveTab] = useState<'basic' | 'container' | 'port' | 'destination' | 'country' | 'airport' | 'fee-category' | 'transport-method' | 'vat'>(getInitialTab())
  const [searchValue, setSearchValue] = useState('')
  const [portTransportType, setPortTransportType] = useState<'air' | 'sea' | 'rail' | 'truck'>('sea')
  const [selectedContinent, setSelectedContinent] = useState<string>('') // 选择的洲：'亚洲' | '欧洲' | '非洲' | '美洲' | '大洋洲' | ''
  // 目的地筛选状态
  const [destinationTransportType, setDestinationTransportType] = useState<'air' | 'sea' | 'rail' | 'truck'>('sea')
  const [destinationSelectedContinent, setDestinationSelectedContinent] = useState<string>('')
  
  // 当URL变化时更新activeTab
  useEffect(() => {
    setActiveTab(getInitialTab())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  
  // 服务费类别相关状态
  const [feeCategoryData, setFeeCategoryData] = useState<ServiceFeeCategory[]>([])
  const [feeCategoryLoading, setFeeCategoryLoading] = useState(false)
  const [feeCategoryModalVisible, setFeeCategoryModalVisible] = useState(false)
  const [editingFeeCategoryData, setEditingFeeCategoryData] = useState<ServiceFeeCategory | null>(null)
  
  // 运输方式相关状态
  const [transportMethodData, setTransportMethodData] = useState<TransportMethod[]>([])
  const [transportMethodLoading, setTransportMethodLoading] = useState(false)
  const [transportMethodModalVisible, setTransportMethodModalVisible] = useState(false)
  const [editingTransportMethodData, setEditingTransportMethodData] = useState<TransportMethod | null>(null)
  
  // 增值税率相关状态
  const [vatRateData, setVatRateData] = useState<VatRate[]>([])
  const [vatRateLoading, setVatRateLoading] = useState(false)
  const [vatRateModalVisible, setVatRateModalVisible] = useState(false)
  const [editingVatRateData, setEditingVatRateData] = useState<VatRate | null>(null)
  
  // 船公司相关状态
  const [shippingCompanyData, setShippingCompanyData] = useState<ShippingCompany[]>([])
  const [shippingCompanyLoading, setShippingCompanyLoading] = useState(false)
  const [shippingCompanyError, setShippingCompanyError] = useState<string | null>(null)
  const [shippingCompanyModalVisible, setShippingCompanyModalVisible] = useState(false)
  const [editingShippingCompany, setEditingShippingCompany] = useState<ShippingCompany | null>(null)
  
  // 基础数据相关状态（保留用于其他用途）
  const [basicData, setBasicData] = useState<BasicDataItem[]>([])
  const [basicLoading, setBasicLoading] = useState(false)
  const [basicError, setBasicError] = useState<string | null>(null)
  const [basicModalVisible, setBasicModalVisible] = useState(false)
  const [editingBasicData, setEditingBasicData] = useState<BasicDataItem | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  
  // 集装箱代码相关状态
  const [containerData, setContainerData] = useState<ContainerCodeItem[]>([])
  const [containerLoading, setContainerLoading] = useState(false)
  const [containerError, setContainerError] = useState<string | null>(null)
  const [containerModalVisible, setContainerModalVisible] = useState(false)
  const [editingContainerData, setEditingContainerData] = useState<ContainerCodeItem | null>(null)
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([])
  
  // 起运地相关状态
  const [portData, setPortData] = useState<PortOfLoadingItem[]>([])
  const [portLoading, setPortLoading] = useState(false)
  const [portError, setPortError] = useState<string | null>(null)
  const [portModalVisible, setPortModalVisible] = useState(false)
  const [editingPortData, setEditingPortData] = useState<PortOfLoadingItem | null>(null)
  const [countries, setCountries] = useState<Array<{ country: string; countryCode: string }>>([])
  
  // 目的地相关状态
  const [destinationPortData, setDestinationPortData] = useState<DestinationPortItem[]>([])
  const [destinationPortLoading, setDestinationPortLoading] = useState(false)
  const [destinationPortError, setDestinationPortError] = useState<string | null>(null)
  const [destinationPortModalVisible, setDestinationPortModalVisible] = useState(false)
  const [editingDestinationPortData, setEditingDestinationPortData] = useState<DestinationPortItem | null>(null)
  const [destinationCountries, setDestinationCountries] = useState<Array<{ country: string; countryCode: string }>>([])
  
  // 空运港相关状态
  const [airPortData, setAirPortData] = useState<AirPortItem[]>([])
  const [airPortLoading, setAirPortLoading] = useState(false)
  const [airPortError, setAirPortError] = useState<string | null>(null)
  const [airPortModalVisible, setAirPortModalVisible] = useState(false)
  const [editingAirPortData, setEditingAirPortData] = useState<AirPortItem | null>(null)
  const [airPortCountries, setAirPortCountries] = useState<Array<{ country: string; countryCode: string }>>([])
  
  // 国家相关状态
  const [countryData, setCountryData] = useState<CountryItem[]>([])
  const [countryLoading, setCountryLoading] = useState(false)
  const [countryError, setCountryError] = useState<string | null>(null)
  const [countryModalVisible, setCountryModalVisible] = useState(false)
  const [editingCountryData, setEditingCountryData] = useState<CountryItem | null>(null)
  const [continents, setContinents] = useState<string[]>([])

  // 加载船公司数据
  const loadShippingCompanyData = async () => {
    setShippingCompanyLoading(true)
    setShippingCompanyError(null)
    try {
      const response = await getShippingCompanies(
        activeTab === 'basic' && searchValue ? searchValue : undefined
      )
      if (response.errCode === 200 && response.data) {
        setShippingCompanyData(response.data)
      } else {
        setShippingCompanyError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载船公司数据失败:', err)
      setShippingCompanyError(err.message || '加载数据失败')
    } finally {
      setShippingCompanyLoading(false)
    }
  }

  // 加载基础数据（保留用于其他用途）
  const loadBasicData = async () => {
    setBasicLoading(true)
    setBasicError(null)
    try {
      const response = await getBasicDataList({
        search: activeTab === 'basic' && searchValue ? searchValue : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setBasicData(response.data)
      } else {
        setBasicError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载基础数据失败:', err)
      setBasicError(err.message || '加载数据失败')
    } finally {
      setBasicLoading(false)
    }
  }

  // 加载集装箱代码数据
  const loadContainerData = async () => {
    setContainerLoading(true)
    setContainerError(null)
    try {
      const response = await getContainerCodesList({
        search: activeTab === 'container' && searchValue ? searchValue : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setContainerData(response.data)
      } else {
        setContainerError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载集装箱代码失败:', err)
      setContainerError(err.message || '加载数据失败')
    } finally {
      setContainerLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await getBasicDataCategories()
      if (response.errCode === 200 && response.data) {
        setCategories(response.data)
      }
    } catch (err) {
      console.error('加载分类列表失败:', err)
    }
  }

  const loadShippingCompanies = async () => {
    try {
      const response = await getShippingCompanies()
      if (response.errCode === 200 && response.data) {
        setShippingCompanies(response.data)
      }
    } catch (err) {
      console.error('加载海运公司列表失败:', err)
    }
  }

  // 加载起运地数据（统一从 ports_of_loading 表加载，包括空运）
  const loadPortData = async () => {
    setPortLoading(true)
    setPortError(null)
    try {
      const response = await getPortsOfLoadingList({
        search: activeTab === 'port' && searchValue ? searchValue : undefined,
        transportType: portTransportType,
        continent: selectedContinent || undefined,
      })
      if (response.errCode === 200 && response.data) {
        setPortData(response.data)
      } else {
        setPortError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载起运地数据失败:', err)
      setPortError(err.message || '加载数据失败')
    } finally {
      setPortLoading(false)
    }
  }

  const loadCountries = async () => {
    try {
      const response = await getPortCountries()
      if (response.errCode === 200 && response.data) {
        setCountries(response.data)
      }
    } catch (err) {
      console.error('加载国家列表失败:', err)
    }
  }

  // 加载目的地数据
  const loadDestinationPortData = async () => {
    setDestinationPortLoading(true)
    setDestinationPortError(null)
    try {
      const response = await getDestinationPortsList({
        search: activeTab === 'destination' && searchValue ? searchValue : undefined,
        transportType: activeTab === 'destination' ? destinationTransportType : undefined,
        continent: activeTab === 'destination' && destinationSelectedContinent ? destinationSelectedContinent : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setDestinationPortData(response.data)
      } else {
        setDestinationPortError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载目的地数据失败:', err)
      setDestinationPortError(err.message || '加载数据失败')
    } finally {
      setDestinationPortLoading(false)
    }
  }

  const loadDestinationCountries = async () => {
    try {
      const response = await getDestinationPortCountries()
      if (response.errCode === 200 && response.data) {
        setDestinationCountries(response.data)
      }
    } catch (err) {
      console.error('加载目的地国家列表失败:', err)
    }
  }

  // 加载国家数据
  const loadCountryData = async () => {
    setCountryLoading(true)
    setCountryError(null)
    try {
      const response = await getCountriesList({
        search: activeTab === 'country' && searchValue ? searchValue : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setCountryData(response.data)
      } else {
        setCountryError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载国家数据失败:', err)
      setCountryError(err.message || '加载数据失败')
    } finally {
      setCountryLoading(false)
    }
  }

  const loadContinents = async () => {
    try {
      const response = await getCountryContinents()
      if (response.errCode === 200 && response.data) {
        setContinents(response.data)
      }
    } catch (err) {
      console.error('加载大洲列表失败:', err)
    }
  }

  // 加载空运港数据
  const loadAirPortData = async () => {
    setAirPortLoading(true)
    setAirPortError(null)
    try {
      // 在"起运地"标签页下的"空运"子分类，或者在"空运港"标签页，都需要加载空运港数据
      const shouldSearch = (activeTab === 'port' && portTransportType === 'air') || activeTab === 'airport'
      const response = await getAirPortsList({
        search: shouldSearch && searchValue ? searchValue : undefined,
        continent: activeTab === 'port' && selectedContinent ? selectedContinent : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setAirPortData(response.data)
      } else {
        setAirPortError('加载数据失败')
      }
    } catch (err: any) {
      console.error('加载空运港数据失败:', err)
      setAirPortError(err.message || '加载数据失败')
    } finally {
      setAirPortLoading(false)
    }
  }

  const loadAirPortCountries = async () => {
    try {
      const response = await getAirPortCountries()
      if (response.errCode === 200 && response.data) {
        setAirPortCountries(response.data)
      }
    } catch (err) {
      console.error('加载空运港国家列表失败:', err)
    }
  }

  // 加载服务费类别数据
  const loadFeeCategoryData = async () => {
    setFeeCategoryLoading(true)
    try {
      const response = await getServiceFeeCategories()
      if (response.errCode === 200 && response.data) {
        setFeeCategoryData(response.data)
      } else {
        console.error('加载服务费类别失败:', response.msg)
      }
    } catch (err) {
      console.error('加载服务费类别失败:', err)
    } finally {
      setFeeCategoryLoading(false)
    }
  }

  // 加载运输方式数据
  const loadTransportMethodData = async () => {
    setTransportMethodLoading(true)
    try {
      const response = await getTransportMethods()
      if (response.errCode === 200 && response.data) {
        setTransportMethodData(response.data)
      } else {
        console.error('加载运输方式失败:', response.msg)
      }
    } catch (err) {
      console.error('加载运输方式失败:', err)
    } finally {
      setTransportMethodLoading(false)
    }
  }

  // 加载增值税率数据
  const loadVatRateData = async () => {
    setVatRateLoading(true)
    try {
      const response = await getVatRates()
      if (response.errCode === 200 && response.data) {
        setVatRateData(response.data)
      } else {
        console.error('加载增值税率失败:', response.msg)
      }
    } catch (err) {
      console.error('加载增值税率失败:', err)
    } finally {
      setVatRateLoading(false)
    }
  }

  // 加载数据
  useEffect(() => {
    loadShippingCompanyData()
    loadContainerData()
    loadPortData()
    loadDestinationPortData()
    loadCountryData()
    loadAirPortData() // 初始加载空运港数据
    loadFeeCategoryData() // 初始加载服务费类别数据
    loadTransportMethodData() // 初始加载运输方式数据
    loadVatRateData() // 初始加载增值税率数据
    loadCategories()
    loadShippingCompanies()
    loadCountries()
    loadDestinationCountries()
    loadContinents()
    loadAirPortCountries() // 初始加载空运港国家列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当标签页切换时重新加载数据
  useEffect(() => {
    if (activeTab === 'basic') {
      loadShippingCompanyData()
    } else if (activeTab === 'container') {
      loadContainerData()
    } else if (activeTab === 'port') {
      loadPortData()
    } else if (activeTab === 'destination') {
      loadDestinationPortData()
    } else if (activeTab === 'country') {
      loadCountryData()
    } else if (activeTab === 'airport') {
      loadAirPortData()
    } else if (activeTab === 'fee-category') {
      loadFeeCategoryData()
    } else if (activeTab === 'transport-method') {
      loadTransportMethodData()
    } else if (activeTab === 'vat') {
      loadVatRateData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // 当起运地运输方式子分类切换时重新加载数据
  useEffect(() => {
    if (activeTab === 'port') {
      loadPortData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portTransportType, selectedContinent])

  // 当目的地运输方式子分类切换时重新加载数据
  useEffect(() => {
    if (activeTab === 'destination') {
      loadDestinationPortData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationTransportType, destinationSelectedContinent])

  // 当搜索值变化时重新加载数据
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'basic') {
        loadShippingCompanyData()
      } else if (activeTab === 'container') {
        loadContainerData()
      } else if (activeTab === 'port') {
        loadPortData()
      } else if (activeTab === 'destination') {
        loadDestinationPortData()
      } else if (activeTab === 'country') {
        loadCountryData()
      } else if (activeTab === 'airport') {
        loadAirPortData()
      }
    }, 300) // 防抖：300ms后执行

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, activeTab])

  // 船公司表格列
  const shippingCompanyColumns: Column<ShippingCompany>[] = [
    {
      key: 'companyName',
      label: '公司名称',
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
    },
    {
      key: 'companyCode',
      label: '公司代码',
      sorter: (a, b) => a.companyCode.localeCompare(b.companyCode),
    },
    {
      key: 'country',
      label: '国家',
      sorter: (a, b) => (a.country || '').localeCompare(b.country || ''),
    },
    {
      key: 'website',
      label: '网站',
      render: (item: ShippingCompany) => (
        item.website ? (
          <a 
            href={item.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary-600 hover:underline"
          >
            {item.website}
          </a>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => {
        const timeA = a.createTime ? new Date(a.createTime).getTime() : 0
        const timeB = b.createTime ? new Date(b.createTime).getTime() : 0
        return timeA - timeB
      },
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ShippingCompany) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleShippingCompanyEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleShippingCompanyDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 船公司操作
  const handleShippingCompanyEdit = (record: ShippingCompany) => {
    setEditingShippingCompany(record)
    setShippingCompanyModalVisible(true)
  }

  const handleShippingCompanyDelete = async (id: string) => {
    if (!confirm('确定要删除这条船公司数据吗？')) {
      return
    }

    try {
      const response = await deleteShippingCompany(id)
      if (response.errCode === 200) {
        loadShippingCompanyData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除船公司失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleShippingCompanyAdd = () => {
    setEditingShippingCompany(null)
    setShippingCompanyModalVisible(true)
  }

  const handleShippingCompanyModalSuccess = () => {
    loadShippingCompanyData()
  }

  const handleShippingCompanyModalClose = () => {
    setShippingCompanyModalVisible(false)
    setEditingShippingCompany(null)
  }

  // 集装箱代码表格列
  const containerColumns: Column<ContainerCodeItem>[] = [
    {
      key: 'containerCode',
      label: '集装箱代码',
      sorter: (a, b) => a.containerCode.localeCompare(b.containerCode),
    },
    {
      key: 'companyName',
      label: '海运公司',
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
      filters: shippingCompanies.map(company => ({ 
        text: company.companyName, 
        value: company.companyCode 
      })),
      onFilter: (value, record) => record.companyCode === value,
    },
    {
      key: 'companyCode',
      label: '公司代码',
      sorter: (a, b) => a.companyCode.localeCompare(b.companyCode),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ContainerCodeItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleContainerEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleContainerDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 起运地表格列
  const portColumns: Column<PortOfLoadingItem>[] = [
    {
      key: 'portCode',
      label: '港口代码',
      sorter: (a, b) => a.portCode.localeCompare(b.portCode),
    },
    {
      key: 'portNameCn',
      label: '港口/码头名称',
      sorter: (a, b) => a.portNameCn.localeCompare(b.portNameCn),
      render: (item: PortOfLoadingItem) => (
        <div className="flex items-center gap-1">
          {item.portType === 'terminal' && (
            <span className="text-xs text-gray-400">└─</span>
          )}
          <span>{item.portNameCn}</span>
          {item.portType === 'terminal' && (
            <span className="text-xs text-gray-500">(码头)</span>
          )}
        </div>
      ),
    },
    {
      key: 'portNameEn',
      label: '英文名称',
      sorter: (a, b) => (a.portNameEn || '').localeCompare(b.portNameEn || ''),
    },
    {
      key: 'country',
      label: '国家',
      sorter: (a, b) => (a.country || '').localeCompare(b.country || ''),
      filters: countries.map(item => ({ 
        text: item.country, 
        value: item.country 
      })),
      onFilter: (value, record) => record.country === value,
    },
    {
      key: 'city',
      label: '城市',
      sorter: (a, b) => (a.city || '').localeCompare(b.city || ''),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: PortOfLoadingItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleTogglePortStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: PortOfLoadingItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePortEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handlePortDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 目的地表格列
  const destinationPortColumns: Column<DestinationPortItem>[] = [
    {
      key: 'portCode',
      label: '代码',
      sorter: (a, b) => a.portCode.localeCompare(b.portCode),
    },
    {
      key: 'portNameCn',
      label: '中文名称',
      sorter: (a, b) => a.portNameCn.localeCompare(b.portNameCn),
    },
    {
      key: 'portNameEn',
      label: '英文名称',
      sorter: (a, b) => (a.portNameEn || '').localeCompare(b.portNameEn || ''),
    },
    {
      key: 'transportType',
      label: '运输类型',
      render: (item: DestinationPortItem) => {
        const typeMap: Record<string, string> = {
          'air': '空运',
          'sea': '海运',
          'rail': '铁运',
          'truck': '卡车运输',
        }
        return <span className="text-xs">{typeMap[item.transportType] || item.transportType}</span>
      },
      filters: [
        { text: '空运', value: 'air' },
        { text: '海运', value: 'sea' },
        { text: '铁运', value: 'rail' },
        { text: '卡车运输', value: 'truck' },
      ],
      onFilter: (value, record) => record.transportType === value,
    },
    {
      key: 'continent',
      label: '大洲',
      sorter: (a, b) => (a.continent || '').localeCompare(b.continent || ''),
      filters: [
        { text: '亚洲', value: '亚洲' },
        { text: '欧洲', value: '欧洲' },
        { text: '北美洲', value: '北美洲' },
        { text: '南美洲', value: '南美洲' },
        { text: '非洲', value: '非洲' },
        { text: '大洋洲', value: '大洋洲' },
      ],
      onFilter: (value, record) => record.continent === value,
    },
    {
      key: 'country',
      label: '国家',
      sorter: (a, b) => (a.country || '').localeCompare(b.country || ''),
      filters: destinationCountries.map(item => ({ 
        text: item.country, 
        value: item.country 
      })),
      onFilter: (value, record) => record.country === value,
    },
    {
      key: 'city',
      label: '城市',
      sorter: (a, b) => (a.city || '').localeCompare(b.city || ''),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: DestinationPortItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleDestinationPortStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: DestinationPortItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleDestinationPortEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleDestinationPortDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 空运港表格列
  const airPortColumns: Column<AirPortItem>[] = [
    {
      key: 'portCode',
      label: '机场代码',
      sorter: (a, b) => a.portCode.localeCompare(b.portCode),
    },
    {
      key: 'portNameCn',
      label: '中文名称',
      sorter: (a, b) => a.portNameCn.localeCompare(b.portNameCn),
    },
    {
      key: 'portNameEn',
      label: '英文名称',
      sorter: (a, b) => (a.portNameEn || '').localeCompare(b.portNameEn || ''),
    },
    {
      key: 'country',
      label: '国家',
      sorter: (a, b) => (a.country || '').localeCompare(b.country || ''),
      filters: airPortCountries.map(item => ({ 
        text: item.country, 
        value: item.country 
      })),
      onFilter: (value, record) => record.country === value,
    },
    {
      key: 'city',
      label: '城市',
      sorter: (a, b) => (a.city || '').localeCompare(b.city || ''),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: AirPortItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleAirPortStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: AirPortItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAirPortEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleAirPortDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 国家表格列
  const countryColumns: Column<CountryItem>[] = [
    {
      key: 'countryCode',
      label: '国家代码',
      sorter: (a, b) => a.countryCode.localeCompare(b.countryCode),
    },
    {
      key: 'countryNameCn',
      label: '中文名称',
      sorter: (a, b) => a.countryNameCn.localeCompare(b.countryNameCn),
    },
    {
      key: 'countryNameEn',
      label: '英文名称',
      sorter: (a, b) => a.countryNameEn.localeCompare(b.countryNameEn),
    },
    {
      key: 'continent',
      label: '大洲',
      sorter: (a, b) => (a.continent || '').localeCompare(b.continent || ''),
      filters: continents.map(continent => ({ 
        text: continent, 
        value: continent 
      })),
      onFilter: (value, record) => record.continent === value,
    },
    {
      key: 'capital',
      label: '首都',
      sorter: (a, b) => (a.capital || '').localeCompare(b.capital || ''),
    },
    {
      key: 'currencyCode',
      label: '货币代码',
      sorter: (a, b) => (a.currencyCode || '').localeCompare(b.currencyCode || ''),
    },
    {
      key: 'phoneCode',
      label: '电话区号',
      sorter: (a, b) => (a.phoneCode || '').localeCompare(b.phoneCode || ''),
    },
    {
      key: 'status',
      label: '状态',
      render: (item: CountryItem) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleCountryStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: CountryItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCountryEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleCountryDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 服务费类别表格列
  const feeCategoryColumns: Column<ServiceFeeCategory>[] = [
    {
      key: 'name',
      label: '类别名称',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'code',
      label: '类别代码',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      key: 'sortOrder',
      label: '排序',
      sorter: (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'status',
      label: '状态',
      render: (item: ServiceFeeCategory) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleFeeCategoryStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ServiceFeeCategory) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFeeCategoryEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleFeeCategoryDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 运输方式表格列
  const transportMethodColumns: Column<TransportMethod>[] = [
    {
      key: 'name',
      label: '运输方式名称',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'code',
      label: '运输方式代码',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      key: 'sortOrder',
      label: '排序',
      sorter: (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'status',
      label: '状态',
      render: (item: TransportMethod) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleTransportMethodStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: TransportMethod) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTransportMethodEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleTransportMethodDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 增值税率表格列
  const vatRateColumns: Column<VatRate>[] = [
    {
      key: 'countryCode',
      label: '国家代码',
      sorter: (a, b) => a.countryCode.localeCompare(b.countryCode),
    },
    {
      key: 'countryName',
      label: '国家名称',
      sorter: (a, b) => a.countryName.localeCompare(b.countryName),
    },
    {
      key: 'standardRate',
      label: '标准税率 (%)',
      sorter: (a, b) => a.standardRate - b.standardRate,
      render: (item: VatRate) => (
        <span className="text-xs font-medium text-blue-600">{item.standardRate}%</span>
      ),
    },
    {
      key: 'reducedRate',
      label: '优惠税率 (%)',
      sorter: (a, b) => a.reducedRate - b.reducedRate,
      render: (item: VatRate) => (
        <span className="text-xs">{item.reducedRate > 0 ? `${item.reducedRate}%` : '-'}</span>
      ),
    },
    {
      key: 'description',
      label: '描述',
    },
    {
      key: 'status',
      label: '状态',
      render: (item: VatRate) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleVatRateStatus(item)
          }}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          }`}
          title={item.status === 'active' ? '点击禁用' : '点击启用'}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
      filters: [
        { text: '启用', value: 'active' },
        { text: '禁用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: VatRate) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVatRateEdit(item)}
            className="px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleVatRateDelete(item.id)}
            className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  // 增值税率操作
  const handleVatRateEdit = (record: VatRate) => {
    setEditingVatRateData(record)
    setVatRateModalVisible(true)
  }

  const handleVatRateDelete = async (id: string) => {
    if (!confirm('确定要删除这个增值税率吗？')) {
      return
    }

    try {
      const response = await deleteVatRate(id)
      if (response.errCode === 200) {
        loadVatRateData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除增值税率失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleVatRateAdd = () => {
    setEditingVatRateData(null)
    setVatRateModalVisible(true)
  }

  const handleVatRateModalSuccess = () => {
    loadVatRateData()
  }

  const handleVatRateModalClose = () => {
    setVatRateModalVisible(false)
    setEditingVatRateData(null)
  }

  const handleToggleVatRateStatus = async (item: VatRate) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateVatRate(item.id, {
        countryCode: item.countryCode,
        countryName: item.countryName,
        standardRate: item.standardRate,
        reducedRate: item.reducedRate,
        superReducedRate: item.superReducedRate,
        parkingRate: item.parkingRate,
        description: item.description,
        effectiveDate: item.effectiveDate,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadVatRateData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 运输方式操作
  const handleTransportMethodEdit = (record: TransportMethod) => {
    setEditingTransportMethodData(record)
    setTransportMethodModalVisible(true)
  }

  const handleTransportMethodDelete = async (id: string) => {
    if (!confirm('确定要删除这个运输方式吗？')) {
      return
    }

    try {
      const response = await deleteTransportMethod(id)
      if (response.errCode === 200) {
        loadTransportMethodData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除运输方式失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleTransportMethodAdd = () => {
    setEditingTransportMethodData(null)
    setTransportMethodModalVisible(true)
  }

  const handleTransportMethodModalSuccess = () => {
    loadTransportMethodData()
  }

  const handleTransportMethodModalClose = () => {
    setTransportMethodModalVisible(false)
    setEditingTransportMethodData(null)
  }

  const handleToggleTransportMethodStatus = async (item: TransportMethod) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateTransportMethod(item.id, {
        name: item.name,
        code: item.code,
        description: item.description,
        icon: item.icon,
        sortOrder: item.sortOrder,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadTransportMethodData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 服务费类别操作
  const handleFeeCategoryEdit = (record: ServiceFeeCategory) => {
    setEditingFeeCategoryData(record)
    setFeeCategoryModalVisible(true)
  }

  const handleFeeCategoryDelete = async (id: string) => {
    if (!confirm('确定要删除这个类别吗？')) {
      return
    }

    try {
      const response = await deleteServiceFeeCategory(id)
      if (response.errCode === 200) {
        loadFeeCategoryData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除类别失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleFeeCategoryAdd = () => {
    setEditingFeeCategoryData(null)
    setFeeCategoryModalVisible(true)
  }

  const handleFeeCategoryModalSuccess = () => {
    loadFeeCategoryData()
  }

  const handleFeeCategoryModalClose = () => {
    setFeeCategoryModalVisible(false)
    setEditingFeeCategoryData(null)
  }

  const handleToggleFeeCategoryStatus = async (item: ServiceFeeCategory) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateServiceFeeCategory(item.id, {
        name: item.name,
        code: item.code,
        description: item.description,
        sortOrder: item.sortOrder,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadFeeCategoryData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 基础数据操作
  const handleBasicEdit = (record: BasicDataItem) => {
    setEditingBasicData(record)
    setBasicModalVisible(true)
  }

  const handleBasicDelete = async (id: string) => {
    if (!confirm('确定要删除这条基础数据吗？')) {
      return
    }

    try {
      const response = await deleteBasicData(id)
      if (response.errCode === 200) {
        loadBasicData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除基础数据失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleBasicModalSuccess = () => {
    loadBasicData()
    loadCategories()
  }

  const handleBasicModalClose = () => {
    setBasicModalVisible(false)
    setEditingBasicData(null)
  }

  // 切换基础数据状态
  const handleToggleBasicDataStatus = async (item: BasicDataItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateBasicData(item.id, {
        name: item.name,
        code: item.code,
        category: item.category,
        description: item.description,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadBasicData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 集装箱代码操作
  const handleContainerEdit = (record: ContainerCodeItem) => {
    setEditingContainerData(record)
    setContainerModalVisible(true)
  }

  const handleContainerDelete = async (id: string) => {
    if (!confirm('确定要删除这条集装箱代码吗？')) {
      return
    }

    try {
      const response = await deleteContainerCode(id)
      if (response.errCode === 200) {
        loadContainerData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除集装箱代码失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleContainerAdd = () => {
    setEditingContainerData(null)
    setContainerModalVisible(true)
  }

  const handleContainerModalSuccess = () => {
    loadContainerData()
  }

  const handleContainerModalClose = () => {
    setContainerModalVisible(false)
    setEditingContainerData(null)
  }

  // 起运地操作（已在上面定义，这里删除重复定义）

  const handlePortAdd = () => {
    // 如果选择的是空运港，使用空运港模态框
    if (portTransportType === 'air') {
      setEditingAirPortData(null)
      setAirPortModalVisible(true)
      return
    }
    
    setEditingPortData(null)
    setPortModalVisible(true)
  }

  const handlePortEdit = (record: PortOfLoadingItem | AirPortItem) => {
    // 如果选择的是空运港，使用空运港模态框
    if (portTransportType === 'air') {
      setEditingAirPortData(record as AirPortItem)
      setAirPortModalVisible(true)
      return
    }
    
    setEditingPortData(record as PortOfLoadingItem)
    setPortModalVisible(true)
  }

  const handlePortDelete = async (id: string) => {
    if (!confirm('确定要删除这条数据吗？')) {
      return
    }

    try {
      // 如果选择的是空运港，删除空运港数据
      if (portTransportType === 'air') {
        const response = await deleteAirPort(id)
        if (response.errCode === 200) {
          loadAirPortData()
        } else {
          alert(response.msg || '删除失败')
        }
        return
      }
      
      // 否则删除起运地数据
      const response = await deletePortOfLoading(id)
      if (response.errCode === 200) {
        loadPortData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handlePortModalSuccess = () => {
    if (portTransportType === 'air') {
      loadAirPortData()
      loadAirPortCountries()
    } else {
      loadPortData()
      loadCountries()
    }
  }

  const handlePortModalClose = () => {
    if (portTransportType === 'air') {
      setAirPortModalVisible(false)
      setEditingAirPortData(null)
    } else {
      setPortModalVisible(false)
      setEditingPortData(null)
    }
  }

  // 清空所有起运地数据
  const handleClearAllPorts = async () => {
    if (!confirm('确定要清空所有起运地数据吗？此操作不可恢复！')) {
      return
    }

    try {
      const response = await clearAllPortsOfLoading()
      if (response.errCode === 200) {
        alert(`清空成功，共删除 ${response.data?.deletedCount || 0} 条记录`)
        loadPortData()
      } else {
        alert(response.msg || '清空失败')
      }
    } catch (err: any) {
      console.error('清空起运地数据失败:', err)
      alert(err.message || '清空失败，请稍后重试')
    }
  }

  // 切换起运地状态
  const handleTogglePortStatus = async (item: PortOfLoadingItem | AirPortItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      
      // 如果选择的是空运港，更新空运港状态
      if (portTransportType === 'air') {
        const airPortItem = item as AirPortItem
        const response = await updateAirPort(airPortItem.id, {
          portCode: airPortItem.portCode,
          portNameCn: airPortItem.portNameCn,
          portNameEn: airPortItem.portNameEn,
          country: airPortItem.country,
          countryCode: airPortItem.countryCode,
          city: airPortItem.city,
          description: airPortItem.description,
          status: newStatus,
        })
        if (response.errCode === 200) {
          loadAirPortData()
        } else {
          alert(response.msg || '更新状态失败')
        }
        return
      }
      
      // 否则更新起运地状态
      const portItem = item as PortOfLoadingItem
      const response = await updatePortOfLoading(portItem.id, {
        portCode: portItem.portCode,
        portNameCn: portItem.portNameCn,
        portNameEn: portItem.portNameEn,
        country: portItem.country,
        countryCode: portItem.countryCode,
        city: portItem.city,
        description: portItem.description,
        transportType: portItem.transportType || 'sea',
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadPortData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 目的地操作
  const handleDestinationPortEdit = (record: DestinationPortItem) => {
    setEditingDestinationPortData(record)
    setDestinationPortModalVisible(true)
  }

  const handleDestinationPortDelete = async (id: string) => {
    if (!confirm('确定要删除这条目的地数据吗？')) {
      return
    }

    try {
      const response = await deleteDestinationPort(id)
      if (response.errCode === 200) {
        loadDestinationPortData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除目的地失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleDestinationPortAdd = () => {
    setEditingDestinationPortData(null)
    setDestinationPortModalVisible(true)
  }

  const handleDestinationPortModalSuccess = () => {
    loadDestinationPortData()
    loadDestinationCountries()
  }

  const handleDestinationPortModalClose = () => {
    setDestinationPortModalVisible(false)
    setEditingDestinationPortData(null)
  }

  // 空运港操作
  const handleAirPortEdit = (record: AirPortItem) => {
    setEditingAirPortData(record)
    setAirPortModalVisible(true)
  }

  const handleAirPortDelete = async (id: string) => {
    if (!confirm('确定要删除这条空运港数据吗？')) {
      return
    }

    try {
      const response = await deleteAirPort(id)
      if (response.errCode === 200) {
        loadAirPortData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除空运港失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleAirPortAdd = () => {
    setEditingAirPortData(null)
    setAirPortModalVisible(true)
  }

  const handleAirPortModalSuccess = () => {
    loadAirPortData()
    loadAirPortCountries()
  }

  const handleAirPortModalClose = () => {
    setAirPortModalVisible(false)
    setEditingAirPortData(null)
  }

  // 切换空运港状态
  const handleToggleAirPortStatus = async (item: AirPortItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateAirPort(item.id, {
        portCode: item.portCode,
        portNameCn: item.portNameCn,
        portNameEn: item.portNameEn,
        country: item.country,
        countryCode: item.countryCode,
        city: item.city,
        description: item.description,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadAirPortData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 切换目的地状态
  const handleToggleDestinationPortStatus = async (item: DestinationPortItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateDestinationPort(item.id, {
        portCode: item.portCode,
        portNameCn: item.portNameCn,
        portNameEn: item.portNameEn,
        country: item.country,
        countryCode: item.countryCode,
        city: item.city,
        description: item.description,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadDestinationPortData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  // 国家操作
  const handleCountryEdit = (record: CountryItem) => {
    setEditingCountryData(record)
    setCountryModalVisible(true)
  }

  const handleCountryDelete = async (id: string) => {
    if (!confirm('确定要删除这条国家数据吗？')) {
      return
    }

    try {
      const response = await deleteCountry(id)
      if (response.errCode === 200) {
        loadCountryData()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (err: any) {
      console.error('删除国家失败:', err)
      alert(err.message || '删除失败，请稍后重试')
    }
  }

  const handleCountryAdd = () => {
    setEditingCountryData(null)
    setCountryModalVisible(true)
  }

  const handleCountryModalSuccess = () => {
    loadCountryData()
    loadContinents()
  }

  const handleCountryModalClose = () => {
    setCountryModalVisible(false)
    setEditingCountryData(null)
  }

  // 切换国家状态
  const handleToggleCountryStatus = async (item: CountryItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active'
      const response = await updateCountry(item.id, {
        countryCode: item.countryCode,
        countryNameCn: item.countryNameCn,
        countryNameEn: item.countryNameEn,
        continent: item.continent,
        region: item.region,
        capital: item.capital,
        currencyCode: item.currencyCode,
        currencyName: item.currencyName,
        phoneCode: item.phoneCode,
        timezone: item.timezone,
        description: item.description,
        status: newStatus,
      })
      if (response.errCode === 200) {
        loadCountryData()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (err: any) {
      console.error('更新状态失败:', err)
      alert(err.message || '更新状态失败，请稍后重试')
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="基础数据管理"
        icon={<Database className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: '基础数据管理' }
        ]}
        tabs={[
          { label: '船公司名称', path: '/system/basic-data' },
          { label: '集装箱代码', path: '/system/basic-data/container' },
          { label: '起运地', path: '/system/basic-data/port' },
          { label: '目的地', path: '/system/basic-data/destination' },
          { label: '国家', path: '/system/basic-data/country' },
          { label: '服务费类别', path: '/system/basic-data/fee-category' },
          { label: '运输方式', path: '/system/basic-data/transport-method' },
          { label: '增值税', path: '/system/basic-data/vat' },
        ]}
        activeTab={
          activeTab === 'basic' 
            ? '/system/basic-data' 
            : activeTab === 'container'
            ? '/system/basic-data/container'
            : activeTab === 'port'
            ? '/system/basic-data/port'
            : activeTab === 'airport'
            ? '/system/basic-data/airport'
            : activeTab === 'destination'
            ? '/system/basic-data/destination'
            : activeTab === 'country'
            ? '/system/basic-data/country'
            : activeTab === 'fee-category'
            ? '/system/basic-data/fee-category'
            : activeTab === 'transport-method'
            ? '/system/basic-data/transport-method'
            : activeTab === 'vat'
            ? '/system/basic-data/vat'
            : '/system/basic-data'
        }
        onTabChange={(path) => {
          if (path === '/system/basic-data') {
            setActiveTab('basic')
          } else if (path === '/system/basic-data/container') {
            setActiveTab('container')
          } else if (path === '/system/basic-data/port') {
            setActiveTab('port')
          } else if (path === '/system/basic-data/airport') {
            setActiveTab('airport')
          } else if (path === '/system/basic-data/destination') {
            setActiveTab('destination')
          } else if (path === '/system/basic-data/country') {
            setActiveTab('country')
          } else if (path === '/system/basic-data/fee-category') {
            setActiveTab('fee-category')
          } else if (path === '/system/basic-data/transport-method') {
            setActiveTab('transport-method')
          } else if (path === '/system/basic-data/vat') {
            setActiveTab('vat')
          }
          setSearchValue('') // 切换标签时清空搜索
        }}
        searchPlaceholder={
          activeTab === 'basic' 
            ? '搜索公司名称、代码或国家...' 
            : activeTab === 'container'
            ? '搜索集装箱代码、公司名称...'
            : activeTab === 'port'
            ? '搜索港口代码、名称、国家或城市...'
            : activeTab === 'destination'
            ? '搜索港口代码、名称、国家或城市...'
            : activeTab === 'fee-category'
            ? '搜索类别名称或代码...'
            : activeTab === 'transport-method'
            ? '搜索运输方式名称或代码...'
            : activeTab === 'vat'
            ? '搜索国家代码或名称...'
            : '搜索国家代码、名称、首都或货币...'
        }
        onSearch={setSearchValue}
        actionButtons={
          <button
            onClick={
              activeTab === 'basic' 
                ? handleShippingCompanyAdd 
                : activeTab === 'container'
                ? handleContainerAdd
                : activeTab === 'port'
                ? handlePortAdd
                : activeTab === 'airport'
                ? handleAirPortAdd
                : activeTab === 'destination'
                ? handleDestinationPortAdd
                : activeTab === 'fee-category'
                ? handleFeeCategoryAdd
                : activeTab === 'transport-method'
                ? handleTransportMethodAdd
                : activeTab === 'vat'
                ? handleVatRateAdd
                : handleCountryAdd
            }
            className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
          >
            + 新增
          </button>
        }
        summary={
          <div className="flex gap-4 text-xs">
            {activeTab === 'basic' ? (
              <span>总数: {shippingCompanyData.length}</span>
            ) : activeTab === 'container' ? (
              <span>总数: {containerData.length}</span>
            ) : activeTab === 'port' ? (
              <>
                <span>总数: {portData.length}</span>
                <span>启用: {portData.filter(d => d.status === 'active').length}</span>
                <span>禁用: {portData.filter(d => d.status === 'inactive').length}</span>
              </>
            ) : activeTab === 'destination' ? (
              <>
                <span>总数: {destinationPortData.length}</span>
                <span>启用: {destinationPortData.filter(d => d.status === 'active').length}</span>
                <span>禁用: {destinationPortData.filter((d: DestinationPortItem) => d.status === 'inactive').length}</span>
              </>
            ) : activeTab === 'fee-category' ? (
              <>
                <span>总数: {feeCategoryData.length}</span>
                <span>启用: {feeCategoryData.filter((d: ServiceFeeCategory) => d.status === 'active').length}</span>
                <span>禁用: {feeCategoryData.filter((d: ServiceFeeCategory) => d.status === 'inactive').length}</span>
              </>
            ) : activeTab === 'transport-method' ? (
              <>
                <span>总数: {transportMethodData.length}</span>
                <span>启用: {transportMethodData.filter((d: TransportMethod) => d.status === 'active').length}</span>
                <span>禁用: {transportMethodData.filter((d: TransportMethod) => d.status === 'inactive').length}</span>
              </>
            ) : activeTab === 'vat' ? (
              <>
                <span>总数: {vatRateData.length}</span>
                <span>启用: {vatRateData.filter((d: VatRate) => d.status === 'active').length}</span>
                <span>禁用: {vatRateData.filter((d: VatRate) => d.status === 'inactive').length}</span>
              </>
            ) : (
              <>
                <span>总数: {countryData.length}</span>
                <span>启用: {countryData.filter((d: CountryItem) => d.status === 'active').length}</span>
                <span>禁用: {countryData.filter((d: CountryItem) => d.status === 'inactive').length}</span>
              </>
            )}
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6 bg-white">
        {activeTab === 'basic' ? (
          // 船公司表格
          shippingCompanyError ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <Database className="w-12 h-12 mb-2" />
              <span className="text-xs">{shippingCompanyError}</span>
              <button
                onClick={loadShippingCompanyData}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                重试
              </button>
            </div>
          ) : shippingCompanyData.length === 0 && !shippingCompanyLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Database className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={shippingCompanyColumns}
              data={shippingCompanyData}
              loading={shippingCompanyLoading}
              searchValue={searchValue}
              searchableColumns={['companyName', 'companyCode', 'country', 'website']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'container' ? (
          // 集装箱代码表格
          containerError ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <Package className="w-12 h-12 mb-2" />
              <span className="text-xs">{containerError}</span>
              <button
                onClick={loadContainerData}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                重试
              </button>
            </div>
          ) : containerData.length === 0 && !containerLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Package className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={containerColumns}
              data={containerData}
              loading={containerLoading}
              searchValue={searchValue}
              searchableColumns={['containerCode', 'companyName', 'companyCode', 'description']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'port' ? (
          // 起运地表格
          <>
            {/* 运输方式子分类标签 */}
            <div className="mb-4">
              <div className="border-b border-gray-200 mb-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setPortTransportType('air')
                      setSelectedContinent('') // 切换运输方式时重置洲选择
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      portTransportType === 'air'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="空运港"
                    aria-label="空运港"
                  >
                    空运港
                  </button>
                  <button
                    onClick={() => {
                      setPortTransportType('sea')
                      setSelectedContinent('') // 切换运输方式时重置洲选择
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      portTransportType === 'sea'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="海运港"
                    aria-label="海运港"
                  >
                    海运港
                  </button>
                  <button
                    onClick={() => {
                      setPortTransportType('rail')
                      setSelectedContinent('') // 切换运输方式时重置洲选择
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      portTransportType === 'rail'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="铁运港"
                    aria-label="铁运港"
                  >
                    铁运港
                  </button>
                  <button
                    onClick={() => {
                      setPortTransportType('truck')
                      setSelectedContinent('') // 切换运输方式时重置洲选择
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      portTransportType === 'truck'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="卡车运输港"
                    aria-label="卡车运输港"
                  >
                    卡车运输港
                  </button>
                </div>
              </div>
              {/* 大洲子分类标签 */}
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedContinent('')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === ''
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="全部"
                  aria-label="全部"
                >
                  全部
                </button>
                <button
                  onClick={() => setSelectedContinent('亚洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === '亚洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="亚洲"
                  aria-label="亚洲"
                >
                  亚洲
                </button>
                <button
                  onClick={() => setSelectedContinent('欧洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === '欧洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="欧洲"
                  aria-label="欧洲"
                >
                  欧洲
                </button>
                <button
                  onClick={() => setSelectedContinent('非洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === '非洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="非洲"
                  aria-label="非洲"
                >
                  非洲
                </button>
                <button
                  onClick={() => setSelectedContinent('美洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === '美洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="美洲"
                  aria-label="美洲"
                >
                  美洲
                </button>
                <button
                  onClick={() => setSelectedContinent('大洋洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedContinent === '大洋洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="大洋洲"
                  aria-label="大洋洲"
                >
                  大洋洲
                </button>
              </div>
            </div>
            {/* 所有运输方式统一从 ports_of_loading 表加载数据 */}
            {portError ? (
              <div className="flex flex-col items-center justify-center h-64 text-red-500">
                {portTransportType === 'air' ? <Plane className="w-12 h-12 mb-2" /> : <Anchor className="w-12 h-12 mb-2" />}
                <span className="text-xs">{portError}</span>
                <button
                  onClick={loadPortData}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
                >
                  重试
                </button>
              </div>
            ) : portData.length === 0 && !portLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                {portTransportType === 'air' ? <Plane className="w-12 h-12 mb-2" /> : <Anchor className="w-12 h-12 mb-2" />}
                <span className="text-xs">暂无数据</span>
              </div>
            ) : (
              <DataTable
                columns={portColumns}
                data={portData}
                loading={portLoading}
                searchValue={searchValue}
                searchableColumns={['portCode', 'portNameCn', 'portNameEn', 'country', 'city', 'description']}
                compact={true}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
              />
            )}
          </>
        ) : activeTab === 'airport' ? (
          // 空运港表格
          airPortError ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <Plane className="w-12 h-12 mb-2" />
              <span className="text-xs">{airPortError}</span>
              <button
                onClick={loadAirPortData}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                重试
              </button>
            </div>
          ) : airPortData.length === 0 && !airPortLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Plane className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={airPortColumns}
              data={airPortData}
              loading={airPortLoading}
              searchValue={searchValue}
              searchableColumns={['portCode', 'portNameCn', 'portNameEn', 'country', 'city']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'destination' ? (
          // 目的地表格
          <>
            {/* 运输方式子分类标签 */}
            <div className="mb-4">
              <div className="border-b border-gray-200 mb-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setDestinationTransportType('air')
                      setDestinationSelectedContinent('')
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      destinationTransportType === 'air'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="空运"
                    aria-label="空运"
                  >
                    空运
                  </button>
                  <button
                    onClick={() => {
                      setDestinationTransportType('sea')
                      setDestinationSelectedContinent('')
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      destinationTransportType === 'sea'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="海运"
                    aria-label="海运"
                  >
                    海运
                  </button>
                  <button
                    onClick={() => {
                      setDestinationTransportType('rail')
                      setDestinationSelectedContinent('')
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      destinationTransportType === 'rail'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="铁运"
                    aria-label="铁运"
                  >
                    铁运
                  </button>
                  <button
                    onClick={() => {
                      setDestinationTransportType('truck')
                      setDestinationSelectedContinent('')
                    }}
                    className={`px-2 py-1 text-xs font-medium border-b-2 transition-all ${
                      destinationTransportType === 'truck'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title="卡车运输"
                    aria-label="卡车运输"
                  >
                    卡车运输
                  </button>
                </div>
              </div>
              {/* 大洲子分类标签 */}
              <div className="flex gap-1">
                <button
                  onClick={() => setDestinationSelectedContinent('')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === ''
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="全部"
                  aria-label="全部"
                >
                  全部
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('亚洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '亚洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="亚洲"
                  aria-label="亚洲"
                >
                  亚洲
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('欧洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '欧洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="欧洲"
                  aria-label="欧洲"
                >
                  欧洲
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('北美洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '北美洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="北美洲"
                  aria-label="北美洲"
                >
                  北美洲
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('南美洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '南美洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="南美洲"
                  aria-label="南美洲"
                >
                  南美洲
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('非洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '非洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="非洲"
                  aria-label="非洲"
                >
                  非洲
                </button>
                <button
                  onClick={() => setDestinationSelectedContinent('大洋洲')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    destinationSelectedContinent === '大洋洲'
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                  title="大洋洲"
                  aria-label="大洋洲"
                >
                  大洋洲
                </button>
              </div>
            </div>
            {/* 数据表格 */}
            {destinationPortError ? (
              <div className="flex flex-col items-center justify-center h-64 text-red-500">
                <MapPin className="w-12 h-12 mb-2" />
                <span className="text-xs">{destinationPortError}</span>
                <button
                  onClick={loadDestinationPortData}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
                >
                  重试
                </button>
              </div>
            ) : destinationPortData.length === 0 && !destinationPortLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <MapPin className="w-12 h-12 mb-2" />
                <span className="text-xs">暂无数据</span>
              </div>
            ) : (
              <DataTable
                columns={destinationPortColumns}
                data={destinationPortData}
                loading={destinationPortLoading}
                searchValue={searchValue}
                searchableColumns={['portCode', 'portNameCn', 'portNameEn', 'country', 'city', 'description']}
                compact={true}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
              />
            )}
          </>
        ) : activeTab === 'country' ? (
          // 国家表格
          countryError ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <Globe className="w-12 h-12 mb-2" />
              <span className="text-xs">{countryError}</span>
              <button
                onClick={loadCountryData}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs"
              >
                重试
              </button>
            </div>
          ) : countryData.length === 0 && !countryLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Globe className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={countryColumns}
              data={countryData}
              loading={countryLoading}
              searchValue={searchValue}
              searchableColumns={['countryCode', 'countryNameCn', 'countryNameEn', 'capital', 'currencyCode', 'phoneCode', 'description']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'fee-category' ? (
          // 服务费类别表格
          feeCategoryData.length === 0 && !feeCategoryLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Tag className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={feeCategoryColumns}
              data={feeCategoryData}
              loading={feeCategoryLoading}
              searchValue={searchValue}
              searchableColumns={['name', 'code', 'description']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'transport-method' ? (
          // 运输方式表格
          transportMethodData.length === 0 && !transportMethodLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Truck className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={transportMethodColumns}
              data={transportMethodData}
              loading={transportMethodLoading}
              searchValue={searchValue}
              searchableColumns={['name', 'code', 'description']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : activeTab === 'vat' ? (
          // 增值税率表格
          vatRateData.length === 0 && !vatRateLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Percent className="w-12 h-12 mb-2" />
              <span className="text-xs">暂无数据</span>
            </div>
          ) : (
            <DataTable
              columns={vatRateColumns}
              data={vatRateData}
              loading={vatRateLoading}
              searchValue={searchValue}
              searchableColumns={['countryCode', 'countryName', 'description']}
              compact={true}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          )
        ) : null}
      </div>

      {/* 船公司弹出页面 */}
      <ShippingCompanyModal
        visible={shippingCompanyModalVisible}
        onClose={handleShippingCompanyModalClose}
        onSuccess={handleShippingCompanyModalSuccess}
        data={editingShippingCompany}
      />

      {/* 基础数据弹出页面（保留用于其他用途） */}
      <BasicDataModal
        visible={basicModalVisible}
        onClose={handleBasicModalClose}
        onSuccess={handleBasicModalSuccess}
        data={editingBasicData}
      />

      {/* 集装箱代码弹出页面 */}
      <ContainerCodeModal
        visible={containerModalVisible}
        onClose={handleContainerModalClose}
        onSuccess={handleContainerModalSuccess}
        data={editingContainerData}
      />

      {/* 起运地弹出页面 */}
      {portTransportType !== 'air' && (
        <PortModal
          visible={portModalVisible}
          onClose={handlePortModalClose}
          onSuccess={handlePortModalSuccess}
          data={editingPortData}
          transportType={portTransportType}
        />
      )}

      {/* 空运港弹出页面（在起运地标签页下的空运子分类中使用） */}
      {portTransportType === 'air' && (
        <AirPortModal
          visible={portModalVisible}
          onClose={handlePortModalClose}
          onSuccess={handlePortModalSuccess}
          data={editingAirPortData}
        />
      )}

      {/* 目的地弹出页面 */}
      <DestinationPortModal
        visible={destinationPortModalVisible}
        onClose={handleDestinationPortModalClose}
        onSuccess={handleDestinationPortModalSuccess}
        data={editingDestinationPortData}
      />

      {/* 国家弹出页面 */}
      <CountryModal
        visible={countryModalVisible}
        onClose={handleCountryModalClose}
        onSuccess={handleCountryModalSuccess}
        data={editingCountryData}
      />

      {/* 服务费类别弹出页面 */}
      <ServiceFeeCategoryModal
        visible={feeCategoryModalVisible}
        onClose={handleFeeCategoryModalClose}
        onSuccess={handleFeeCategoryModalSuccess}
        data={editingFeeCategoryData}
      />

      {/* 运输方式弹出页面 */}
      <TransportMethodModal
        visible={transportMethodModalVisible}
        onClose={handleTransportMethodModalClose}
        onSuccess={handleTransportMethodModalSuccess}
        data={editingTransportMethodData}
      />

      {/* 增值税率弹出页面 */}
      <VatRateModal
        visible={vatRateModalVisible}
        onClose={handleVatRateModalClose}
        onSuccess={handleVatRateModalSuccess}
        data={editingVatRateData}
      />
    </div>
  )
}

