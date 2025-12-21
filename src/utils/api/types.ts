/**
 * API 类型定义文件
 * 包含所有 API 相关的接口和类型
 */

// ==================== 通用类型 ====================

export interface ApiResponse<T = unknown> {
  errCode: number
  msg: string
  data?: T
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  stats?: Record<string, unknown>
}

// ==================== 用户管理类型 ====================

export interface User {
  id: string
  username: string
  name: string
  email: string
  phone?: string
  avatar?: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  roleName?: string
  status: 'active' | 'inactive'
  lastLoginTime?: string
  lastLoginIp?: string
  loginCount?: number
  createTime?: string
  updateTime?: string
  permissions?: string[]
}

export interface CreateUserRequest {
  username: string
  name: string
  email?: string
  phone?: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  status?: 'active' | 'inactive'
  password: string
}

export interface UpdateUserRequest {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: 'admin' | 'manager' | 'operator' | 'viewer'
  status?: 'active' | 'inactive'
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  permissions: string[]
  token: string
}

export interface Role {
  id: number
  roleCode: string
  roleName: string
  description: string
  isSystem: boolean
  status: string
}

export interface Permission {
  permissionCode: string
  permissionName: string
  module: string
  description?: string
  category?: string
}

// ==================== 订单管理类型 ====================

export interface BillOfLading {
  id: string
  orderSeq?: number       // 订单序号
  orderNumber?: string    // 订单号 (BP25XXXXX)
  billId?: string
  billNumber: string      // 提单号
  containerNumber?: string // 集装箱号
  vessel?: string
  eta?: string
  ata?: string
  pieces: number
  weight: number
  volume?: number
  inspection: string
  customsStats: string
  creator: string
  createTime: string
  status: string
  shipper?: string
  consignee?: string
  notifyParty?: string
  portOfLoading?: string
  portOfDischarge?: string
  placeOfDelivery?: string
  completeTime?: string
  deliveryStatus?: string
  transportMethod?: string
  companyName?: string
  orderSeq?: number
  isVoid?: boolean
  voidReason?: string
  voidTime?: string
  shipStatus?: '未到港' | '已到港' | '跳港'
  skipPort?: string
  skipPortTime?: string
  customsStatus?: '未放行' | '已放行'
  customsReleaseTime?: string
  // 查验相关字段
  inspectionDetail?: string
  inspectionEstimatedTime?: string
  inspectionStartTime?: string
  inspectionEndTime?: string
  inspectionResult?: string
  inspectionResultNote?: string
  inspectionReleaseTime?: string
  inspectionConfirmedTime?: string
  // 船舶相关字段
  shippingCompany?: string
  vesselName?: string
  voyage?: string
  destinationPort?: string
  // CMR相关字段
  cmrNotes?: string
  cmrEstimatedPickupTime?: string
  cmrServiceProvider?: string
  cmrDeliveryAddress?: string
  cmrEstimatedArrivalTime?: string
  cmrActualArrivalTime?: string
  cmrUnloadingCompleteTime?: string
  cmrConfirmedTime?: string
  // CMR异常相关字段
  cmrHasException?: number
  cmrExceptionNote?: string
  cmrExceptionTime?: string
  cmrExceptionStatus?: string
  cmrExceptionResolution?: string
  cmrExceptionResolvedTime?: string
  // 附加属性字段
  containerType?: 'cfs' | 'fcl' | string  // 箱型：拼箱/整箱
  billType?: 'master' | 'house' | string  // 提单类型：船东单/货代单
  transportArrangement?: 'entrust' | 'self' | string  // 运输：委托我司运输/自行运输
  consigneeType?: 'asl' | 'not-asl' | string  // 收货人：ASL为收货人/ASL不是提单收货人
  containerReturn?: 'off-site' | 'local' | string  // 异地还柜：异地还柜/本地还柜
  fullContainerTransport?: 'must-full' | 'can-split' | string  // 全程整柜运输：必须整柜派送/可拆柜后托盘送货
  lastMileTransport?: 'truck' | 'train' | 'air' | string  // 末端运输方式：卡车派送/铁路运输/空运
  devanning?: 'required' | 'not-required' | string  // 拆柜：需要拆柜分货服务/不需要拆柜
  t1Declaration?: 'yes' | 'no' | string  // 海关经停报关服务(T1报关)：是/否
}

export interface GetBillsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  type?: 'schedule' | 'draft' | 'history' | 'void'
  includeVoid?: boolean
}

export interface BillStats {
  currentTypeCount: number
  scheduleCount: number
  draftCount: number
  historyCount: number
  voidCount: number
  allTotal: number
  validCount: number
}

export interface OperationLog {
  id: number
  billId: string
  operationType: string
  operationDetail: string
  operatorId: string
  operatorName: string
  createTime: string
}

export interface BillFile {
  id: number
  billId: string
  fileName: string
  fileSize: number
  fileType: string
  uploaderId: string
  uploaderName: string
  uploadTime: string
}

// ==================== 序号管理类型 ====================

export type BusinessType = 'package' | 'bill' | 'declaration' | 'label' | 'last_mile'

export interface SequenceStats {
  businessType: string
  prefix: string
  description: string
  currentSeq: number
  lastGenerated: string
  todayCount: number
  thisMonthCount: number
}

export interface SequenceInfo {
  businessType: string
  prefix: string
  description: string
  currentSeq: number
  nextNumber: string
  lastUpdated: string
}

// ==================== 查验相关类型 ====================

export interface GetInspectionsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  shipStatus?: string
  customsStatus?: string
  type?: 'pending' | 'released' | 'all'
}

export interface InspectionItem {
  category: string
  description: string
  checked: boolean
  note?: string
}

export interface InspectionDetailData {
  items: InspectionItem[]
  estimatedTime?: string
  actualStartTime?: string
  actualEndTime?: string
  result?: 'pass' | 'second_inspection' | 'fail'
  resultNote?: string
  releaseTime?: string
  confirmedTime?: string
}

// ==================== CMR 管理类型 ====================

export interface GetCMRParams {
  type?: 'undelivered' | 'delivering' | 'archived' | 'exception' | 'all'
  search?: string
}

export interface CMRStats {
  undelivered: number
  delivering: number
  archived: number
}

export interface CMRResponse {
  list: BillOfLading[]
  total: number
  page: number
  pageSize: number
  stats?: {
    undelivered: number
    delivering: number
    archived: number
    exception: number
  }
}

export interface CMRDetailData {
  cmrNotes?: string
  cmrEstimatedPickupTime?: string
  cmrServiceProvider?: string
  cmrDeliveryAddress?: string
  cmrEstimatedArrivalTime?: string
  cmrActualArrivalTime?: string
  cmrUnloadingCompleteTime?: string
  cmrConfirmedTime?: string
}

// ==================== 海运公司类型 ====================

export interface ShippingCompany {
  id: string
  companyCode: string
  companyName: string
  country: string
  status: 'active' | 'inactive'
  containerCodes?: ContainerCode[]
  createTime?: string
}

export interface CreateShippingCompanyRequest {
  companyCode: string
  companyName: string
  country: string
  status?: 'active' | 'inactive'
}

export interface UpdateShippingCompanyRequest extends CreateShippingCompanyRequest {}

export interface ContainerCode {
  id: string
  containerCode: string
  companyCode: string
  companyName: string
  description?: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== 基础数据类型 ====================

export interface BasicDataItem {
  id: string
  name: string
  code: string
  category: string
  description?: string
  status: 'active' | 'inactive'
  createTime: string
}

export interface PortOfLoading {
  id: string
  portCode: string
  portName: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
  status: 'active' | 'inactive'
  isMainPort?: boolean
  createTime?: string
}

export interface DestinationPort {
  id: string
  portCode: string
  portName: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
  status: 'active' | 'inactive'
  isMainPort?: boolean
  createTime?: string
}

export interface Country {
  id: string
  countryCode: string
  countryName: string
  continent: string
  status: 'active' | 'inactive'
  createTime?: string
}

export interface AirPort {
  id: string
  airportCode: string
  airportName: string
  city?: string
  country: string
  countryCode?: string
  countryName?: string
  continent?: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== 运输方式和服务费类型 ====================

export interface TransportMethod {
  id: string
  code: string
  name: string
  description?: string
  status: 'active' | 'inactive'
  createTime?: string
}

export interface ServiceFeeCategory {
  id: string
  code: string
  name: string
  description?: string
  status: 'active' | 'inactive'
  createTime?: string
}

export interface ServiceFee {
  id: string
  name: string
  categoryId: string
  categoryName?: string
  amount: number
  currency: string
  description?: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== 增值税率类型 ====================

export interface VatRate {
  id: string
  countryCode: string
  countryName: string
  standardRate: number
  reducedRate?: number
  superReducedRate?: number
  parkingRate?: number
  effectiveDate: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== 运输价格类型 ====================

export interface TransportPrice {
  id: string
  transportType: string
  origin: string
  destination: string
  currency: string
  basePrice: number
  pricePerKg?: number
  pricePerCbm?: number
  minCharge?: number
  effectiveFrom: string
  effectiveTo?: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== TARIC 税率类型 ====================

export interface TariffRate {
  id: string
  hsCode: string
  description: string
  thirdCountryDuty: number
  preferentialDuty?: number
  vatRate: number
  unit?: string
  notes?: string
  effectiveDate: string
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== CRM 客户类型 ====================

export interface Customer {
  id: string
  customerCode: string
  customerName: string
  customerType: 'shipper' | 'consignee' | 'both'
  level: 'vip' | 'important' | 'normal' | 'potential'
  country: string
  countryCode?: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  status: 'active' | 'inactive'
  assignedTo?: string
  createTime?: string
}

// ==================== 财务费用类型 ====================

export interface Fee {
  id: string
  billId: string
  billNumber?: string
  feeType: 'income' | 'expense'
  category: string
  amount: number
  currency: string
  description?: string
  status: 'pending' | 'confirmed' | 'paid'
  customerId?: string
  customerName?: string
  createTime?: string
}

// ==================== 清关单证类型 ====================

export interface ClearanceDocument {
  id: string
  billId?: string
  billNumber?: string
  documentType: string
  documentNumber?: string
  shipperName?: string
  consigneeName?: string
  notifyPartyName?: string
  goodsDescription?: string
  hsCode?: string
  quantity?: number
  grossWeight?: number
  netWeight?: number
  volume?: number
  totalValue?: number
  currency?: string
  portOfLoading?: string
  portOfDischarge?: string
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'rejected'
  createTime?: string
  updateTime?: string
}

export interface ClearanceDocumentType {
  id: string
  code: string
  name: string
  description?: string
  requiredFields?: string[]
  status: 'active' | 'inactive'
  createTime?: string
}

// ==================== 提单文件解析类型 ====================

export interface ParsedBillData {
  masterBillNumber?: string
  shippingCompany?: string
  origin?: string
  destination?: string
  containerNumber?: string
  vessel?: string
  pieces?: string
  weight?: string
  volume?: string
  estimatedDeparture?: string
}

