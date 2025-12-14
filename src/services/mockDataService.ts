/**
 * 模拟数据服务
 * 测试模式下使用的模拟数据，完全隔离于真实数据
 */

// ==================== 模拟订单数据 ====================

export const mockOrders = [
  {
    id: 'DEMO-001',
    billNumber: 'DEMO-BL-2025-001',
    containerNumber: 'DEMO-CTN-001',
    vessel: 'DEMO VESSEL ALPHA',
    eta: '2025-12-20',
    ata: '2025-12-21',
    pieces: 35,
    weight: 9500,
    volume: 42.5,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'demo_admin',
    createTime: '2025-12-01 10:00',
    status: '已到港',
    shipStatus: '已到港',
    docSwapStatus: '已换单',
    customsStatus: '已放行',
    deliveryStatus: '派送中',
    shipper: 'DEMO SHIPPER CO., LTD',
    consignee: 'DEMO CONSIGNEE GmbH',
    notifyParty: 'DEMO NOTIFY PARTY',
    portOfLoading: '上海港',
    portOfDischarge: '鹿特丹港',
    placeOfDelivery: '阿姆斯特丹',
    companyName: 'DEMO SHIPPER CO., LTD',
    transportMethod: '海运',
  },
  {
    id: 'DEMO-002',
    billNumber: 'DEMO-BL-2025-002',
    containerNumber: 'DEMO-CTN-002',
    vessel: 'DEMO VESSEL BETA',
    eta: '2025-12-22',
    pieces: 48,
    weight: 12000,
    volume: 55.0,
    inspection: '-',
    customsStats: '0/1',
    creator: 'demo_operator',
    createTime: '2025-12-02 14:30',
    status: '船未到港',
    shipStatus: '未到港',
    docSwapStatus: '未换单',
    customsStatus: '未放行',
    deliveryStatus: '-',
    shipper: 'DEMO SHIPPER B',
    consignee: 'DEMO CONSIGNEE B',
    notifyParty: 'DEMO NOTIFY B',
    portOfLoading: '宁波港',
    portOfDischarge: '汉堡港',
    placeOfDelivery: '柏林',
    companyName: 'DEMO SHIPPER B',
    transportMethod: '海运',
  },
  {
    id: 'DEMO-003',
    billNumber: 'DEMO-BL-2025-003',
    containerNumber: 'DEMO-CTN-003',
    vessel: 'DEMO VESSEL GAMMA',
    eta: '2025-12-18',
    ata: '2025-12-18',
    pieces: 28,
    weight: 7200,
    volume: 32.0,
    inspection: '待查验',
    customsStats: '0/2',
    creator: 'demo_admin',
    createTime: '2025-12-03 09:15',
    status: '已到港',
    shipStatus: '已到港',
    docSwapStatus: '已换单',
    customsStatus: '未放行',
    deliveryStatus: '-',
    shipper: 'DEMO SHIPPER C',
    consignee: 'DEMO CONSIGNEE C',
    notifyParty: 'DEMO NOTIFY C',
    portOfLoading: '深圳港',
    portOfDischarge: '安特卫普港',
    placeOfDelivery: '布鲁塞尔',
    companyName: 'DEMO SHIPPER C',
    transportMethod: '海运',
  },
  {
    id: 'DEMO-004',
    billNumber: 'DEMO-BL-2025-004',
    containerNumber: 'DEMO-CTN-004',
    vessel: 'DEMO VESSEL DELTA',
    eta: '2025-12-25',
    pieces: 60,
    weight: 15000,
    volume: 68.0,
    inspection: '-',
    customsStats: '0/1',
    creator: 'demo_operator',
    createTime: '2025-12-04 16:45',
    status: '船未到港',
    shipStatus: '未到港',
    docSwapStatus: '未换单',
    customsStatus: '未放行',
    deliveryStatus: '-',
    shipper: 'DEMO SHIPPER D',
    consignee: 'DEMO CONSIGNEE D',
    notifyParty: 'DEMO NOTIFY D',
    portOfLoading: '青岛港',
    portOfDischarge: '鹿特丹港',
    placeOfDelivery: '巴黎',
    companyName: 'DEMO SHIPPER D',
    transportMethod: '海运',
  },
  {
    id: 'DEMO-005',
    billNumber: 'DEMO-BL-2025-005',
    containerNumber: 'DEMO-CTN-005',
    vessel: 'DEMO VESSEL EPSILON',
    eta: '2025-12-15',
    ata: '2025-12-15',
    pieces: 42,
    weight: 11000,
    volume: 48.5,
    inspection: '已查验',
    customsStats: '2/2',
    creator: 'demo_admin',
    createTime: '2025-12-05 11:20',
    status: '已完成',
    shipStatus: '已到港',
    docSwapStatus: '已换单',
    customsStatus: '已放行',
    deliveryStatus: '已送达',
    completeTime: '2025-12-16 14:30',
    shipper: 'DEMO SHIPPER E',
    consignee: 'DEMO CONSIGNEE E',
    notifyParty: 'DEMO NOTIFY E',
    portOfLoading: '上海港',
    portOfDischarge: '勒阿弗尔港',
    placeOfDelivery: '里昂',
    companyName: 'DEMO SHIPPER E',
    transportMethod: '海运',
  },
]

// ==================== 模拟客户数据 ====================

export const mockCustomers = [
  {
    id: 'CUST-DEMO-001',
    customerCode: 'DEMO-C001',
    customerName: 'DEMO 客户 A',
    companyName: 'DEMO COMPANY A GmbH',
    customerType: 'both',
    customerLevel: 'vip',
    contactPerson: '张三',
    contactPhone: '+49 123 456789',
    contactEmail: 'demo_a@example.com',
    address: 'Demo Street 1, 10115 Berlin, Germany',
    countryCode: 'DE',
    status: 'active',
    creditLimit: 100000,
    paymentTerms: 'NET30',
    notes: '演示 VIP 客户',
    assignedTo: 1,
    assignedName: 'demo_admin',
    createTime: '2025-01-01 10:00',
    updateTime: '2025-12-01 15:30',
  },
  {
    id: 'CUST-DEMO-002',
    customerCode: 'DEMO-C002',
    customerName: 'DEMO 客户 B',
    companyName: 'DEMO COMPANY B B.V.',
    customerType: 'consignee',
    customerLevel: 'important',
    contactPerson: '李四',
    contactPhone: '+31 20 1234567',
    contactEmail: 'demo_b@example.com',
    address: 'Demo Lane 2, 1012 JS Amsterdam, Netherlands',
    countryCode: 'NL',
    status: 'active',
    creditLimit: 50000,
    paymentTerms: 'NET15',
    notes: '演示重要客户',
    assignedTo: 2,
    assignedName: 'demo_operator',
    createTime: '2025-02-15 09:00',
    updateTime: '2025-11-20 11:45',
  },
  {
    id: 'CUST-DEMO-003',
    customerCode: 'DEMO-C003',
    customerName: 'DEMO 客户 C',
    companyName: 'DEMO COMPANY C S.A.',
    customerType: 'shipper',
    customerLevel: 'normal',
    contactPerson: '王五',
    contactPhone: '+33 1 23456789',
    contactEmail: 'demo_c@example.com',
    address: 'Rue Demo 3, 75001 Paris, France',
    countryCode: 'FR',
    status: 'active',
    creditLimit: 30000,
    paymentTerms: 'COD',
    notes: '演示普通客户',
    assignedTo: 1,
    assignedName: 'demo_admin',
    createTime: '2025-03-20 14:00',
    updateTime: '2025-10-15 16:20',
  },
  {
    id: 'CUST-DEMO-004',
    customerCode: 'DEMO-C004',
    customerName: 'DEMO 客户 D',
    companyName: 'DEMO COMPANY D Ltd',
    customerType: 'both',
    customerLevel: 'potential',
    contactPerson: '赵六',
    contactPhone: '+44 20 12345678',
    contactEmail: 'demo_d@example.com',
    address: 'Demo Road 4, London EC1A 1BB, UK',
    countryCode: 'GB',
    status: 'active',
    creditLimit: 20000,
    paymentTerms: 'NET30',
    notes: '演示潜在客户',
    assignedTo: 2,
    assignedName: 'demo_operator',
    createTime: '2025-04-10 11:30',
    updateTime: '2025-09-05 10:00',
  },
  {
    id: 'CUST-DEMO-005',
    customerCode: 'DEMO-C005',
    customerName: 'DEMO 客户 E',
    companyName: 'DEMO COMPANY E S.r.l.',
    customerType: 'consignee',
    customerLevel: 'vip',
    contactPerson: '孙七',
    contactPhone: '+39 02 12345678',
    contactEmail: 'demo_e@example.com',
    address: 'Via Demo 5, 20121 Milano, Italy',
    countryCode: 'IT',
    status: 'active',
    creditLimit: 80000,
    paymentTerms: 'NET45',
    notes: '演示意大利 VIP 客户',
    assignedTo: 1,
    assignedName: 'demo_admin',
    createTime: '2025-05-01 08:00',
    updateTime: '2025-08-20 09:15',
  },
]

// ==================== 模拟供应商数据 ====================

export const mockSuppliers = [
  {
    id: 'SUPP-DEMO-001',
    supplierCode: 'DEMO-S001',
    supplierName: 'DEMO 物流服务商 A',
    companyName: 'DEMO LOGISTICS A GmbH',
    supplierType: 'transport',
    contactPerson: '物流张',
    contactPhone: '+49 30 11111111',
    contactEmail: 'logistics_a@demo.com',
    address: 'Logistics Street 1, Berlin',
    countryCode: 'DE',
    status: 'active',
    bankAccount: 'DE89370400440532013000',
    paymentTerms: 'NET30',
    notes: '演示运输服务商',
    createTime: '2025-01-01',
    updateTime: '2025-12-01',
  },
  {
    id: 'SUPP-DEMO-002',
    supplierCode: 'DEMO-S002',
    supplierName: 'DEMO 报关行 B',
    companyName: 'DEMO CUSTOMS B B.V.',
    supplierType: 'customs',
    contactPerson: '报关李',
    contactPhone: '+31 20 22222222',
    contactEmail: 'customs_b@demo.com',
    address: 'Customs Lane 2, Rotterdam',
    countryCode: 'NL',
    status: 'active',
    bankAccount: 'NL91ABNA0417164300',
    paymentTerms: 'NET15',
    notes: '演示报关服务商',
    createTime: '2025-02-01',
    updateTime: '2025-11-15',
  },
  {
    id: 'SUPP-DEMO-003',
    supplierCode: 'DEMO-S003',
    supplierName: 'DEMO 仓储 C',
    companyName: 'DEMO WAREHOUSE C S.A.',
    supplierType: 'warehouse',
    contactPerson: '仓储王',
    contactPhone: '+33 1 33333333',
    contactEmail: 'warehouse_c@demo.com',
    address: 'Warehouse Avenue 3, Paris',
    countryCode: 'FR',
    status: 'active',
    bankAccount: 'FR7630006000011234567890189',
    paymentTerms: 'NET30',
    notes: '演示仓储服务商',
    createTime: '2025-03-01',
    updateTime: '2025-10-20',
  },
]

// ==================== 模拟财务数据 ====================

export const mockFees = [
  {
    id: 'FEE-DEMO-001',
    billId: 'DEMO-001',
    billNumber: 'DEMO-BL-2025-001',
    customerId: 'CUST-DEMO-001',
    customerName: 'DEMO 客户 A',
    category: '运输费',
    feeName: '海运费',
    amount: 2500.00,
    currency: 'EUR',
    exchangeRate: 1.0,
    feeDate: '2025-12-01',
    description: '海运运输费用',
    notes: '演示费用',
    createdBy: 1,
    createdAt: '2025-12-01 10:00',
    updatedAt: '2025-12-01 10:00',
  },
  {
    id: 'FEE-DEMO-002',
    billId: 'DEMO-001',
    billNumber: 'DEMO-BL-2025-001',
    customerId: 'CUST-DEMO-001',
    customerName: 'DEMO 客户 A',
    category: '清关费',
    feeName: '报关费',
    amount: 350.00,
    currency: 'EUR',
    exchangeRate: 1.0,
    feeDate: '2025-12-02',
    description: '清关报关费用',
    notes: '演示费用',
    createdBy: 1,
    createdAt: '2025-12-02 14:00',
    updatedAt: '2025-12-02 14:00',
  },
  {
    id: 'FEE-DEMO-003',
    billId: 'DEMO-002',
    billNumber: 'DEMO-BL-2025-002',
    customerId: 'CUST-DEMO-002',
    customerName: 'DEMO 客户 B',
    category: '运输费',
    feeName: '陆运费',
    amount: 800.00,
    currency: 'EUR',
    exchangeRate: 1.0,
    feeDate: '2025-12-05',
    description: '陆路运输费用',
    notes: '演示费用',
    createdBy: 2,
    createdAt: '2025-12-05 09:00',
    updatedAt: '2025-12-05 09:00',
  },
  {
    id: 'FEE-DEMO-004',
    billId: 'DEMO-003',
    billNumber: 'DEMO-BL-2025-003',
    customerId: 'CUST-DEMO-003',
    customerName: 'DEMO 客户 C',
    category: '仓储费',
    feeName: '仓库租赁',
    amount: 450.00,
    currency: 'EUR',
    exchangeRate: 1.0,
    feeDate: '2025-12-08',
    description: '仓储租赁费用',
    notes: '演示费用',
    createdBy: 1,
    createdAt: '2025-12-08 11:30',
    updatedAt: '2025-12-08 11:30',
  },
  {
    id: 'FEE-DEMO-005',
    billId: 'DEMO-005',
    billNumber: 'DEMO-BL-2025-005',
    customerId: 'CUST-DEMO-005',
    customerName: 'DEMO 客户 E',
    category: '其他费用',
    feeName: '查验费',
    amount: 200.00,
    currency: 'EUR',
    exchangeRate: 1.0,
    feeDate: '2025-12-10',
    description: '海关查验费用',
    notes: '演示费用',
    createdBy: 1,
    createdAt: '2025-12-10 15:00',
    updatedAt: '2025-12-10 15:00',
  },
]

// ==================== 模拟用户数据 ====================

export const mockUsers = [
  {
    id: '1',
    username: 'demo_admin',
    name: '演示管理员',
    email: 'demo_admin@example.com',
    phone: '+86 138 0000 0001',
    role: 'admin',
    roleName: '管理员',
    status: 'active',
    lastLoginTime: '2025-12-14 10:00',
    lastLoginIp: '127.0.0.1',
    loginCount: 100,
    createTime: '2025-01-01',
    updateTime: '2025-12-14',
  },
  {
    id: '2',
    username: 'demo_operator',
    name: '演示操作员',
    email: 'demo_operator@example.com',
    phone: '+86 138 0000 0002',
    role: 'operator',
    roleName: '操作员',
    status: 'active',
    lastLoginTime: '2025-12-13 15:30',
    lastLoginIp: '127.0.0.1',
    loginCount: 50,
    createTime: '2025-02-01',
    updateTime: '2025-12-13',
  },
]

// ==================== 模拟查验数据 ====================

export const mockInspections = mockOrders.filter(o => 
  o.inspection === '待查验' || o.inspection === '已查验'
).map(o => ({
  ...o,
  inspectionDetail: [
    { hsCode: '8471300000', productName: '便携式计算机', quantity: 100, unit: '台' },
    { hsCode: '8517620000', productName: '无线通信设备', quantity: 50, unit: '台' },
  ],
  inspectionEstimatedTime: '2025-12-20 10:00',
  inspectionStartTime: o.inspection === '已查验' ? '2025-12-20 10:30' : undefined,
  inspectionEndTime: o.inspection === '已查验' ? '2025-12-20 14:00' : undefined,
  inspectionResult: o.inspection === '已查验' ? 'pass' : undefined,
  inspectionResultNote: o.inspection === '已查验' ? '查验通过，货物与申报一致' : undefined,
}))

// ==================== 模拟CMR数据 ====================

export const mockCMR = mockOrders.filter(o => 
  o.deliveryStatus && o.deliveryStatus !== '-'
).map(o => ({
  ...o,
  cmrNotes: '演示 CMR 备注',
  cmrEstimatedPickupTime: '2025-12-18 08:00',
  cmrServiceProvider: 'DEMO 物流服务商 A',
  cmrDeliveryAddress: 'Demo Street 1, Berlin',
  cmrEstimatedArrivalTime: '2025-12-19 14:00',
  cmrActualArrivalTime: o.deliveryStatus === '已送达' ? '2025-12-19 13:45' : undefined,
  cmrUnloadingCompleteTime: o.deliveryStatus === '已送达' ? '2025-12-19 15:30' : undefined,
}))

// ==================== 测试模式状态管理 ====================

const TEST_MODE_KEY = 'bp_logistics_test_mode'

/**
 * 检查是否处于测试模式
 */
export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false
  const testData = localStorage.getItem(TEST_MODE_KEY)
  return !!testData
}

/**
 * 获取测试模式通知消息
 */
export function getTestModeMessage(): string {
  return '🧪 测试模式 - 当前操作仅作演示，数据不会被保存'
}

// ==================== 模拟API响应 ====================

/**
 * 创建模拟API成功响应
 */
export function createMockResponse<T>(data: T, message: string = '操作成功'): {
  errCode: number
  msg: string
  data: T
} {
  return {
    errCode: 200,
    msg: `[演示] ${message}`,
    data,
  }
}

/**
 * 创建模拟分页响应
 */
export function createMockPaginatedResponse<T>(
  list: T[],
  page: number = 1,
  pageSize: number = 10
): {
  errCode: number
  msg: string
  data: { list: T[]; total: number; page: number; pageSize: number }
} {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paginatedList = list.slice(start, end)

  return {
    errCode: 200,
    msg: '[演示] 获取成功',
    data: {
      list: paginatedList,
      total: list.length,
      page,
      pageSize,
    },
  }
}

/**
 * 创建写操作被禁止的响应
 */
export function createWriteBlockedResponse(): {
  errCode: number
  msg: string
  data: null
} {
  return {
    errCode: 403,
    msg: '🧪 测试模式下不支持此操作',
    data: null,
  }
}

// ==================== 模拟数据API ====================

export const mockAPI = {
  // 获取订单列表
  getBills: (params?: { page?: number; pageSize?: number; type?: string; search?: string }) => {
    let filtered = [...mockOrders]
    
    if (params?.search) {
      const search = params.search.toLowerCase()
      filtered = filtered.filter(o => 
        o.billNumber.toLowerCase().includes(search) ||
        o.containerNumber.toLowerCase().includes(search) ||
        o.companyName?.toLowerCase().includes(search)
      )
    }
    
    if (params?.type === 'history') {
      filtered = filtered.filter(o => o.status === '已完成' || o.status === '已归档')
    } else if (params?.type === 'schedule') {
      filtered = filtered.filter(o => o.status !== '已完成' && o.status !== '已归档')
    }
    
    return createMockPaginatedResponse(filtered, params?.page, params?.pageSize)
  },

  // 获取订单详情
  getBillById: (id: string) => {
    const bill = mockOrders.find(o => o.id === id)
    if (bill) {
      return createMockResponse(bill)
    }
    return { errCode: 404, msg: '订单不存在', data: null }
  },

  // 获取客户列表
  getCustomers: (params?: { page?: number; pageSize?: number; search?: string }) => {
    let filtered = [...mockCustomers]
    
    if (params?.search) {
      const search = params.search.toLowerCase()
      filtered = filtered.filter(c => 
        c.customerName.toLowerCase().includes(search) ||
        c.companyName.toLowerCase().includes(search) ||
        c.contactPerson.toLowerCase().includes(search)
      )
    }
    
    return createMockPaginatedResponse(filtered, params?.page, params?.pageSize)
  },

  // 获取费用列表
  getFees: (params?: { page?: number; pageSize?: number; billId?: string }) => {
    let filtered = [...mockFees]
    
    if (params?.billId) {
      filtered = filtered.filter(f => f.billId === params.billId)
    }
    
    return createMockPaginatedResponse(filtered, params?.page, params?.pageSize)
  },

  // 获取查验列表
  getInspections: (params?: { type?: string }) => {
    let filtered = [...mockInspections]
    
    if (params?.type === 'pending') {
      filtered = filtered.filter(i => i.inspection === '待查验')
    } else if (params?.type === 'released') {
      filtered = filtered.filter(i => i.inspection === '已查验')
    }
    
    return createMockPaginatedResponse(filtered)
  },

  // 获取CMR列表
  getCMR: () => {
    return createMockResponse({
      list: mockCMR,
      total: mockCMR.length,
      stats: {
        undelivered: mockCMR.filter(c => !c.cmrActualArrivalTime).length,
        delivering: mockCMR.filter(c => c.cmrActualArrivalTime && !c.cmrUnloadingCompleteTime).length,
        archived: mockCMR.filter(c => c.cmrUnloadingCompleteTime).length,
      },
    })
  },

  // 获取用户列表
  getUsers: () => {
    return createMockPaginatedResponse(mockUsers)
  },

  // 写操作 - 全部返回阻止响应
  createBill: () => createWriteBlockedResponse(),
  updateBill: () => createWriteBlockedResponse(),
  deleteBill: () => createWriteBlockedResponse(),
  createCustomer: () => createWriteBlockedResponse(),
  updateCustomer: () => createWriteBlockedResponse(),
  deleteCustomer: () => createWriteBlockedResponse(),
  createFee: () => createWriteBlockedResponse(),
  updateFee: () => createWriteBlockedResponse(),
  deleteFee: () => createWriteBlockedResponse(),
}

export default mockAPI
