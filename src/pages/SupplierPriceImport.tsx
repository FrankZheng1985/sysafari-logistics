import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, 
  Edit2, Trash2, Plus, ChevronDown, ChevronRight, X, Loader2, Download
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
}

interface ParsedSheet {
  name: string
  headers: string[]
  fieldMapping: Record<string, { columnIndex: number; originalHeader: string }>
  rowCount: number
  preview: any[][]
  data: any[]
}

interface ParsedItem {
  feeName: string
  feeNameEn: string
  unit: string
  price: number
  currency: string
  routeFrom: string
  country: string       // 国家（从邮编国家代码自动识别）
  routeTo: string       // 目的地邮编
  city: string          // 城市（从邮编自动识别）
  returnPoint: string   // 还柜点
  remark: string
  _rowIndex?: number
  _warnings?: string[]
  _sheetName?: string
  _selected?: boolean
}

interface ParseResult {
  fileType: string
  sheetCount?: number
  sheets?: ParsedSheet[]
  data?: ParsedItem[]
  totalRecords: number
  validCount?: number
  warningCount?: number
}

const FEE_CATEGORIES = [
  { value: 'freight', label: '运费' },
  { value: 'customs', label: '关税' },
  { value: 'warehouse', label: '仓储' },
  { value: 'handling', label: '操作' },
  { value: 'documentation', label: '文件' },
  { value: 'other', label: '其他' }
]

// 费用名称中英文翻译映射表
const FEE_NAME_TRANSLATIONS: Record<string, string> = {
  // 运输相关
  '提柜送仓费': 'Container Pickup & Delivery',
  '送仓费': 'Warehouse Delivery Fee',
  '提柜费': 'Container Pickup Fee',
  '拖车费': 'Trucking Fee',
  '卡车运输费': 'Truck Transport Fee',
  '铁路运输费': 'Rail Transport Fee',
  '运输费': 'Transport Fee',
  '运费': 'Freight',
  // 港口相关
  '码头费': 'Terminal Fee',
  '港杂费': 'Terminal Handling Charge',
  '堆存费': 'Storage Fee',
  '港口费': 'Port Fee',
  // 清关相关
  '清关费': 'Customs Clearance Fee',
  '报关费': 'Declaration Fee',
  '查验费': 'Inspection Fee',
  // 文件相关
  '文件费': 'Documentation Fee',
  '换单费': 'B/L Release Fee',
  // 仓储相关
  '仓储费': 'Warehousing Fee',
  '装卸费': 'Loading/Unloading Fee',
  // 其他
  '保险费': 'Insurance Fee',
  '代理费': 'Agency Fee',
  '码头送仓费': 'Terminal & Delivery Fee'
}

// 自动翻译费用名称
function translateFeeName(chineseName: string): string {
  // 直接匹配
  if (FEE_NAME_TRANSLATIONS[chineseName]) {
    return FEE_NAME_TRANSLATIONS[chineseName]
  }
  
  // 部分匹配
  for (const [cn, en] of Object.entries(FEE_NAME_TRANSLATIONS)) {
    if (chineseName.includes(cn)) {
      return en
    }
  }
  
  // 默认返回通用英文名
  return 'Service Fee'
}

// 国家代码到国家名称映射
const COUNTRY_CODE_MAP: Record<string, string> = {
  'DE': '德国',
  'FR': '法国',
  'NL': '荷兰',
  'BE': '比利时',
  'AT': '奥地利',
  'CH': '瑞士',
  'PL': '波兰',
  'CZ': '捷克',
  'IT': '意大利',
  'ES': '西班牙',
  'PT': '葡萄牙',
  'GB': '英国',
  'UK': '英国',
  'DK': '丹麦',
  'SE': '瑞典',
  'NO': '挪威',
  'FI': '芬兰',
  'HU': '匈牙利',
  'SK': '斯洛伐克',
  'SI': '斯洛文尼亚',
  'HR': '克罗地亚',
  'RO': '罗马尼亚',
  'BG': '保加利亚',
  'GR': '希腊',
  'LU': '卢森堡',
  'IE': '爱尔兰',
  'LT': '立陶宛',
  'LV': '拉脱维亚',
  'EE': '爱沙尼亚'
}

// 从邮编提取国家代码并返回国家名称
function getCountryFromPostalCode(postalCode: string): string {
  if (!postalCode) return ''
  // 匹配邮编开头的国家代码 (如 DE-41751, FR-80700, NL-5928)
  const match = postalCode.match(/^([A-Z]{2})-?/)
  if (match) {
    const code = match[1].toUpperCase()
    return COUNTRY_CODE_MAP[code] || code
  }
  return ''
}

// 德国邮编前缀到城市的映射 (前2-3位)
const DE_POSTAL_CITY_MAP: Record<string, string> = {
  '10': 'Berlin', '12': 'Berlin', '13': 'Berlin', '14': 'Berlin',
  '20': 'Hamburg', '21': 'Hamburg', '22': 'Hamburg', '23': 'Lübeck', '24': 'Kiel', '25': 'Itzehoe',
  '26': 'Oldenburg', '27': 'Bremen', '28': 'Bremen', '29': 'Celle',
  '30': 'Hannover', '31': 'Hannover', '32': 'Herford', '33': 'Bielefeld', '34': 'Kassel',
  '35': 'Gießen', '36': 'Fulda', '37': 'Göttingen', '38': 'Braunschweig', '39': 'Magdeburg',
  // 40-41 北莱茵-威斯特法伦州 (杜塞尔多夫地区)
  '40': 'Düsseldorf', '401': 'Düsseldorf', '402': 'Düsseldorf', '403': 'Düsseldorf',
  '404': 'Neuss', '405': 'Neuss', '406': 'Erkrath', '407': 'Ratingen', '408': 'Ratingen', '409': 'Hilden',
  '41': 'Mönchengladbach', '410': 'Mönchengladbach', '411': 'Duisburg', '412': 'Duisburg',
  '413': 'Schwalmtal', '414': 'Viersen', '415': 'Krefeld', '416': 'Krefeld',
  '417': 'Mönchengladbach', '418': 'Mönchengladbach', '419': 'Nettetal',
  '42': 'Wuppertal', '420': 'Wuppertal', '421': 'Wuppertal', '422': 'Solingen',
  '43': 'Hagen', '44': 'Dortmund', '445': 'Lünen', '447': 'Bochum', '449': 'Herne',
  '45': 'Essen', '453': 'Essen', '456': 'Recklinghausen', '458': 'Witten',
  '46': 'Oberhausen', '462': 'Oberhausen', '463': 'Bottrop', '464': 'Marl', '465': 'Gelsenkirchen',
  '47': 'Duisburg', '470': 'Moers', '471': 'Moers', '472': 'Krefeld', '473': 'Kleve', '474': 'Wesel',
  '48': 'Münster', '49': 'Osnabrück',
  '50': 'Köln', '501': 'Bergheim', '502': 'Frechen', '503': 'Köln',
  '51': 'Köln', '510': 'Bergisch Gladbach', '52': 'Aachen',
  '53': 'Bonn', '54': 'Trier', '55': 'Mainz', '554': 'Langenlonsheim', '555': 'Bad Kreuznach',
  '56': 'Koblenz', '57': 'Siegen', '58': 'Hagen', '59': 'Hamm',
  '60': 'Frankfurt', '61': 'Frankfurt', '62': 'Wiesbaden', '63': 'Offenbach', '64': 'Darmstadt', '65': 'Wiesbaden',
  '66': 'Saarbrücken', '67': 'Ludwigshafen', '68': 'Mannheim', '69': 'Heidelberg',
  '70': 'Stuttgart', '71': 'Stuttgart', '72': 'Tübingen', '73': 'Esslingen',
  '74': 'Heilbronn', '75': 'Pforzheim', '76': 'Karlsruhe', '77': 'Offenburg',
  '78': 'Konstanz', '79': 'Freiburg',
  '80': 'München', '81': 'München', '82': 'München', '83': 'Rosenheim',
  '84': 'Landshut', '85': 'Ingolstadt', '86': 'Augsburg', '87': 'Kempten',
  '88': 'Ravensburg', '89': 'Ulm',
  '90': 'Nürnberg', '91': 'Nürnberg', '92': 'Amberg', '93': 'Regensburg',
  '94': 'Passau', '95': 'Bayreuth', '96': 'Bamberg', '97': 'Würzburg',
  '98': 'Suhl', '99': 'Erfurt',
  '01': 'Dresden', '02': 'Görlitz', '03': 'Cottbus', '04': 'Leipzig',
  '06': 'Halle', '07': 'Gera', '08': 'Zwickau', '09': 'Chemnitz'
}

// 法国邮编前缀到城市的映射
const FR_POSTAL_CITY_MAP: Record<string, string> = {
  // 巴黎大区
  '75': 'Paris', '77': 'Melun', '78': 'Versailles', '91': 'Évry', '92': 'Nanterre',
  '93': 'Bobigny', '94': 'Créteil', '95': 'Pontoise',
  // 主要城市
  '13': 'Marseille', '69': 'Lyon', '31': 'Toulouse', '06': 'Nice',
  '44': 'Nantes', '33': 'Bordeaux', '59': 'Lille', '67': 'Strasbourg',
  '35': 'Rennes', '34': 'Montpellier', '62': 'Arras', '622': 'Calais',
  // 皮卡第地区 (Picardie)
  '60': 'Beauvais', '604': 'Nanteuil-le-Haudouin', '600': 'Beauvais', '602': 'Compiègne',
  '80': 'Amiens', '807': 'Roye', '800': 'Amiens', '802': 'Péronne',
  '02': 'Laon', '020': 'Laon', '023': 'Saint-Quentin',
  // 阿尔萨斯地区 (Alsace)
  '68': 'Mulhouse', '682': 'Dannemarie', '680': 'Mulhouse', '681': 'Colmar',
  '670': 'Strasbourg', '672': 'Haguenau',
  // 其他地区
  '57': 'Metz', '54': 'Nancy', '51': 'Reims', '45': 'Orléans', '37': 'Tours',
  '49': 'Angers', '72': 'Le Mans', '76': 'Rouen', '14': 'Caen', '29': 'Brest',
  '56': 'Vannes', '22': 'Saint-Brieuc', '50': 'Cherbourg', '61': 'Alençon',
  '03': 'Moulins', '63': 'Clermont-Ferrand', '42': 'Saint-Étienne', '38': 'Grenoble', '381': 'Saint-Égrève',
  '73': 'Chambéry', '74': 'Annecy', '01': 'Bourg-en-Bresse', '39': 'Lons-le-Saunier',
  '25': 'Besançon', '70': 'Vesoul', '90': 'Belfort', '88': 'Épinal', '52': 'Chaumont',
  '10': 'Troyes', '89': 'Auxerre', '21': 'Dijon', '58': 'Nevers', '71': 'Mâcon',
  '18': 'Bourges', '36': 'Châteauroux', '41': 'Blois', '28': 'Chartres', '27': 'Évreux',
  '17': 'La Rochelle', '79': 'Niort', '86': 'Poitiers', '87': 'Limoges', '23': 'Guéret',
  '19': 'Tulle', '24': 'Périgueux', '46': 'Cahors', '47': 'Agen', '40': 'Mont-de-Marsan',
  '64': 'Pau', '65': 'Tarbes', '32': 'Auch', '82': 'Montauban', '81': 'Albi',
  '12': 'Rodez', '48': 'Mende', '30': 'Nîmes', '84': 'Avignon', '83': 'Toulon',
  '04': 'Digne', '05': 'Gap', '26': 'Valence', '07': 'Privas', '43': 'Le Puy',
  '15': 'Aurillac', '16': 'Angoulême', '85': 'La Roche-sur-Yon', '53': 'Laval', '55': 'Bar-le-Duc'
}

// 荷兰邮编前缀到城市的映射
const NL_POSTAL_CITY_MAP: Record<string, string> = {
  '10': 'Amsterdam', '11': 'Amsterdam', '30': 'Rotterdam', '31': 'Rotterdam',
  '25': 'Den Haag', '35': 'Utrecht', '50': 'Eindhoven', '59': 'Breda',
  '64': 'Nijmegen', '68': 'Arnhem', '75': 'Enschede', '97': 'Groningen'
}

// 捷克邮编前缀到城市的映射
const CZ_POSTAL_CITY_MAP: Record<string, string> = {
  '1': 'Praha', '10': 'Praha', '11': 'Praha', '12': 'Praha', '13': 'Praha',
  '14': 'Praha', '15': 'Praha', '16': 'Praha', '17': 'Praha', '18': 'Praha', '19': 'Praha',
  '25': 'Praha', '252': 'Lysá nad Labem',
  '60': 'Brno', '61': 'Brno', '62': 'Brno',
  '30': 'Plzeň', '31': 'Plzeň',
  '40': 'Ústí nad Labem', '46': 'Liberec',
  '70': 'Ostrava', '71': 'Ostrava'
}

// 从邮编提取城市名
function getCityFromPostalCode(postalCode: string): string {
  if (!postalCode) return ''
  
  // 先检查邮编后是否已有城市名 (如 "DE-41366 Schwalmtal")
  const cityMatch = postalCode.match(/^[A-Z]{2}-[\d]+\s+(.+)$/)
  if (cityMatch) {
    return cityMatch[1].trim()
  }
  
  // 提取国家代码和数字部分
  const match = postalCode.match(/^([A-Z]{2})-?(\d+)/)
  if (!match) return ''
  
  const countryCode = match[1]
  const numericPart = match[2]
  
  // 根据国家选择对应的映射表
  let cityMap: Record<string, string> = {}
  switch (countryCode) {
    case 'DE': cityMap = DE_POSTAL_CITY_MAP; break
    case 'FR': cityMap = FR_POSTAL_CITY_MAP; break
    case 'NL': cityMap = NL_POSTAL_CITY_MAP; break
    case 'CZ': cityMap = CZ_POSTAL_CITY_MAP; break
    default: return ''
  }
  
  // 尝试匹配前3位、前2位
  for (const len of [3, 2]) {
    const prefix = numericPart.substring(0, len)
    if (cityMap[prefix]) {
      return cityMap[prefix]
    }
  }
  
  return ''
}

export default function SupplierPriceImport() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const supplierId = searchParams.get('supplierId')
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [step, setStep] = useState(1) // 1: 选择供应商, 2: 上传文件, 3: 预览编辑, 4: 确认导入
  
  // 文件上传状态
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  
  // 编辑状态
  const [editingItems, setEditingItems] = useState<ParsedItem[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [expandedSheets, setExpandedSheets] = useState<string[]>([])
  
  // 提交状态
  const [submitting, setSubmitting] = useState(false)

  const tabs = [
    { key: 'product-pricing', label: '产品定价', path: '/tools/product-pricing' },
    { key: 'supplier-pricing', label: '供应商报价', path: '/suppliers/prices' },
    { key: 'import', label: '智能导入', path: '/suppliers/import' }
  ]

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (supplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === supplierId)
      if (supplier) {
        setSelectedSupplier(supplier)
        setStep(2)
      }
    }
  }, [supplierId, suppliers])

  const loadSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers?status=active&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSuppliers(data.data?.list || [])
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setParseResult(null)
      setEditingItems([])
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setParseResult(null)
      setEditingItems([])
    }
  }, [])

  // 从 HERE API 批量获取邮编对应的城市（仅对本地映射无法识别的邮编）
  const fetchCitiesFromHere = async (postalCodes: string[]): Promise<Record<string, string>> => {
    // 先用本地映射处理，过滤出无法识别的邮编
    const unknownCodes = postalCodes.filter(code => code && !getCityFromPostalCode(code))
    
    // 如果所有邮编都能本地识别，直接返回空（不调用 API）
    if (unknownCodes.length === 0) {
      console.log('所有邮编已通过本地映射识别，无需调用 HERE API')
      return {}
    }
    
    console.log(`本地映射无法识别 ${unknownCodes.length} 个邮编，调用 HERE API...`)
    
    try {
      const response = await fetch(`${API_BASE}/api/inquiry/cities-by-postal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCodes: unknownCodes })
      })
      const data = await response.json()
      if (data.success && data.cities) {
        console.log(`HERE API 返回 ${Object.keys(data.cities).length} 个城市`)
        return data.cities
      }
    } catch (error) {
      console.error('从 HERE API 获取城市失败:', error)
    }
    return {}
  }

  const handleUploadAndParse = async () => {
    if (!file) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_BASE}/api/suppliers/import/parse`, {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setParseResult(data.data)
        
        let items: ParsedItem[] = []
        
        // 初始化编辑数据
        if (data.data.fileType === 'excel' && data.data.sheets) {
          // Excel 文件 - 选择所有 Sheet
          const sheetNames = data.data.sheets.map((s: ParsedSheet) => s.name)
          setSelectedSheets(sheetNames)
          setExpandedSheets([sheetNames[0]]) // 展开第一个
          
          // 合并所有 Sheet 的数据
          data.data.sheets.forEach((sheet: ParsedSheet) => {
            sheet.data.forEach((item: any) => {
              items.push({
                ...item,
                _sheetName: sheet.name,
                _selected: true
              })
            })
          })
        } else if (data.data.data) {
          // PDF 或其他格式
          items = data.data.data.map((item: any) => ({
            ...item,
            _selected: !item._warnings?.length
          }))
        }
        
        // 提取所有邮编，先用本地映射，找不到的再调 HERE API
        const postalCodes = items.map(item => item.routeTo).filter(Boolean)
        const hereCities = await fetchCitiesFromHere(postalCodes)
        
        // 更新城市信息：优先使用本地映射，其次使用 HERE API 结果
        items = items.map(item => ({
          ...item,
          city: getCityFromPostalCode(item.routeTo) || hereCities[item.routeTo] || item.city || ''
        }))
        
        setEditingItems(items)
        setStep(3)
      } else {
        alert(data.msg || '文件解析失败')
      }
    } catch (error) {
      console.error('上传解析失败:', error)
      alert('上传解析失败')
    } finally {
      setUploading(false)
    }
  }

  const handleItemChange = (index: number, field: keyof ParsedItem, value: any) => {
    setEditingItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleToggleItem = (index: number) => {
    setEditingItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], _selected: !newItems[index]._selected }
      return newItems
    })
  }

  const handleSelectAll = (selected: boolean) => {
    setEditingItems(prev => prev.map(item => ({ ...item, _selected: selected })))
  }

  const handleRemoveItem = (index: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddItem = () => {
    setEditingItems(prev => [...prev, {
      feeName: '',
      feeNameEn: '',
      unit: '票',
      price: 0,
      currency: 'EUR',
      routeFrom: '',
      country: '',
      routeTo: '',
      city: '',
      returnPoint: '',
      remark: '',
      _selected: true
    }])
  }

  const handleConfirmImport = async () => {
    const selectedItems = editingItems.filter(item => item._selected && item.feeName)
    
    if (selectedItems.length === 0) {
      alert('请选择要导入的数据')
      return
    }
    
    if (!selectedSupplier) {
      alert('请选择供应商')
      return
    }
    
    // 自动填充英文名称、国家、城市
    const itemsWithAutoFields = selectedItems.map(item => ({
      ...item,
      feeNameEn: translateFeeName(item.feeName),
      country: getCountryFromPostalCode(item.routeTo),
      city: getCityFromPostalCode(item.routeTo)
    }))
    
    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${selectedSupplier.id}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsWithAutoFields,
          fileName: file?.name
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`导入成功！共导入 ${data.data.successCount} 条记录`)
        navigate(`/suppliers/prices?supplierId=${selectedSupplier.id}`)
      } else {
        alert(data.msg || '导入失败')
      }
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCount = editingItems.filter(item => item._selected).length

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="报价管理"
        tabs={tabs}
        activeTab="/suppliers/import"
        onTabChange={(path) => navigate(path)}
      />

      {/* 步骤指示器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center">
          {[
            { num: 1, label: '选择供应商' },
            { num: 2, label: '上传文件' },
            { num: 3, label: '预览编辑' },
            { num: 4, label: '确认导入' }
          ].map((s, index) => (
            <div key={s.num} className="flex items-center">
              {index > 0 && (
                <div className={`w-16 h-0.5 ${step >= s.num ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s.num ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
                </div>
                <span className={`mt-1 text-xs ${step >= s.num ? 'text-primary-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 步骤1：选择供应商 */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">选择供应商</h3>
          <div className="max-w-md">
            <select
              value={selectedSupplier?.id || ''}
              onChange={(e) => {
                const supplier = suppliers.find(s => s.id === e.target.value)
                setSelectedSupplier(supplier || null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">请选择供应商</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <button
              onClick={() => selectedSupplier && setStep(2)}
              disabled={!selectedSupplier}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {/* 步骤2：上传文件 */}
      {step === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-medium text-gray-900">上传报价文件</h3>
              <p className="text-xs text-gray-500 mt-1">
                供应商：{selectedSupplier?.supplierName}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              更换供应商
            </button>
          </div>

          {/* 上传区域 */}
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                {file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? (
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                ) : (
                  <FileText className="w-10 h-10 text-red-500" />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-2">拖拽文件到此处，或</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg cursor-pointer hover:bg-primary-100">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  选择文件
                </label>
                <p className="text-xs text-gray-400 mt-3">
                  支持 Excel (.xlsx, .xls)、PDF 和图片格式 (.jpg, .png)
                </p>
                <p className="text-xs text-amber-500 mt-1">
                  💡 推荐使用Excel格式，PDF扫描件可截图为图片上传进行OCR识别
                </p>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleUploadAndParse}
              disabled={!file || uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  上传并解析
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 步骤3：预览编辑 */}
      {step === 3 && parseResult && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="text-base font-medium text-gray-900">预览并编辑</h3>
              <p className="text-xs text-gray-500 mt-1">
                解析到 {parseResult.totalRecords} 条记录，已选择 {selectedCount} 条
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-3 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
              >
                全选
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded"
              >
                取消全选
              </button>
              <button
                onClick={handleAddItem}
                className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加行
              </button>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-2 py-1.5 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCount === editingItems.length && editingItems.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-3.5 h-3.5 text-primary-600 rounded"
                    />
                  </th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">费用名称</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">英文名称</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">起运地</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">国家</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">目的地</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">城市</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">还柜点</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-600">价格</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-600">单位</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-600">备注</th>
                  <th className="w-10 px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {editingItems.map((item, index) => (
                  <tr key={index} className={`border-t border-gray-100 ${
                    item._warnings?.length ? 'bg-yellow-50' : ''
                  }`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={item._selected}
                        onChange={() => handleToggleItem(index)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.feeName}
                        onChange={(e) => handleItemChange(index, 'feeName', e.target.value)}
                        className="w-full px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="费用名称"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded block truncate max-w-[100px]" title={translateFeeName(item.feeName)}>
                        {translateFeeName(item.feeName)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.routeFrom}
                        onChange={(e) => handleItemChange(index, 'routeFrom', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="起运地"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] text-gray-600 bg-blue-50 px-1.5 py-0.5 rounded block truncate w-12" title={getCountryFromPostalCode(item.routeTo)}>
                        {getCountryFromPostalCode(item.routeTo) || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.routeTo}
                        onChange={(e) => handleItemChange(index, 'routeTo', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="邮编"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] text-gray-600 bg-green-50 px-1.5 py-0.5 rounded block truncate w-16" title={item.city || getCityFromPostalCode(item.routeTo)}>
                        {item.city || getCityFromPostalCode(item.routeTo) || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.returnPoint || ''}
                        onChange={(e) => handleItemChange(index, 'returnPoint', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="还柜点"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[10px] text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="0.00"
                        />
                        <select
                          value={item.currency}
                          onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                          className="px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-gray-50"
                        >
                          <option value="EUR">€</option>
                          <option value="USD">$</option>
                          <option value="CNY">¥</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-12 px-1.5 py-0.5 text-[10px] text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="单位"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.remark}
                        onChange={(e) => handleItemChange(index, 'remark', e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="备注"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        {item._warnings?.length ? (
                          <span className="text-yellow-500" title={item._warnings.join(', ')}>
                            <AlertCircle className="w-4 h-4" />
                          </span>
                        ) : null}
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              上一步
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              下一步：确认导入 ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* 步骤4：确认导入 */}
      {step === 4 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">确认导入</h3>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">供应商：</span>
                <span className="font-medium text-gray-900 ml-2">{selectedSupplier?.supplierName}</span>
              </div>
              <div>
                <span className="text-gray-500">文件名：</span>
                <span className="font-medium text-gray-900 ml-2">{file?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">导入数量：</span>
                <span className="font-medium text-primary-600 ml-2">{selectedCount} 条</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              返回编辑
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  确认导入
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
