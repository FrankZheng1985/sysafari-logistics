// 统一的订单数据源
// 所有页面都使用这个数据文件，确保数据一致性

export interface BillOfLading {
  id: string
  billNumber: string
  containerNumber: string
  vessel: string
  eta: string
  ata?: string
  pieces: number
  weight: number
  volume?: number
  inspection: string
  customsStats: string
  creator: string
  createTime: string
  status: string
  // 详情页额外字段
  shipper?: string
  consignee?: string
  notifyParty?: string
  portOfLoading?: string
  portOfDischarge?: string
  placeOfDelivery?: string
  // 历史记录额外字段
  completeTime?: string
  deliveryStatus?: string
  // 草稿页面额外字段
  billId?: string // 提单ID（用于草稿页面）
  transportMethod?: string // 运输方式（空运/海运/铁路/卡车）
  companyName?: string // 公司名
}

// 当前进行中的提单数据（SCHEDULE）
export const scheduleBills: BillOfLading[] = [
  {
    id: '1',
    billNumber: 'EGLV010501130029',
    containerNumber: 'EGHU9400490',
    vessel: 'EVER GLORIOUS V.001W',
    eta: '2025-12-18',
    ata: '2025-12-19',
    pieces: 33,
    weight: 9009,
    volume: 45.2,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'danzheng1',
    createTime: '2025-11-19 14:18',
    status: '已到港',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '2',
    billNumber: 'EGLV010501130030',
    containerNumber: 'EGHU9400491',
    vessel: 'EVER GIVEN V.002E',
    eta: '2025-12-19',
    ata: '2025-12-20',
    pieces: 45,
    weight: 12000,
    volume: 52.5,
    inspection: '-',
    customsStats: '0/1',
    creator: 'danzheng2',
    createTime: '2025-11-20 10:30',
    status: '船未到港',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '3',
    billNumber: 'EGLV010501130031',
    containerNumber: 'EGHU9400492',
    vessel: 'EVER ACE V.003N',
    eta: '2025-12-20',
    pieces: 28,
    weight: 8000,
    volume: 38.5,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'op1@xianfenghk.com',
    createTime: '2025-11-21 09:15',
    status: '船未到港',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '4',
    billNumber: 'EGLV010501130032',
    containerNumber: 'EGHU9400493',
    vessel: 'EVER ALP V.004S',
    eta: '2025-12-21',
    pieces: 60,
    weight: 15000,
    volume: 68.0,
    inspection: '-',
    customsStats: '0/2',
    creator: 'danzheng1',
    createTime: '2025-11-22 11:20',
    status: '船未到港',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '5',
    billNumber: 'EGLV010501130033',
    containerNumber: 'EGHU9400494',
    vessel: 'EVER ART V.005W',
    eta: '2025-12-22',
    ata: '2025-12-23',
    pieces: 42,
    weight: 11000,
    volume: 48.5,
    inspection: '已查验',
    customsStats: '2/2',
    creator: 'danzheng2',
    createTime: '2025-11-23 15:45',
    status: '已到港',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
]

// 历史完结的提单数据（HISTORY）- 用于草稿页面
export const historyBills: BillOfLading[] = [
  {
    id: '1',
    billId: 'BL-2025-001',
    billNumber: 'EGLV010501120001',
    containerNumber: 'EGHU9400400',
    vessel: 'EVER GLORIOUS V.001W',
    eta: '2025-11-15',
    ata: '2025-11-16',
    pieces: 50,
    weight: 12000,
    volume: 55.0,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'danzheng1',
    createTime: '2025-10-20 10:00',
    completeTime: '2025-11-25 16:30',
    status: '已完成',
    deliveryStatus: '已送达',
    transportMethod: '海运',
    companyName: 'SHIPPER COMPANY LTD',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '2',
    billId: 'BL-2025-002',
    billNumber: 'EGLV010501120002',
    containerNumber: 'EGHU9400401',
    vessel: 'EVER GIVEN V.002E',
    eta: '2025-11-18',
    ata: '2025-11-19',
    pieces: 35,
    weight: 9500,
    volume: 42.0,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'danzheng2',
    createTime: '2025-10-22 14:20',
    completeTime: '2025-11-28 10:15',
    status: '已完成',
    deliveryStatus: '已送达',
    transportMethod: '空运',
    companyName: 'CONSIGNEE COMPANY LTD',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '3',
    billId: 'BL-2025-003',
    billNumber: 'EGLV010501120003',
    containerNumber: 'EGHU9400402',
    vessel: 'EVER ACE V.003N',
    eta: '2025-11-20',
    ata: '2025-11-21',
    pieces: 42,
    weight: 11000,
    volume: 48.5,
    inspection: '-',
    customsStats: '1/1',
    creator: 'danzheng1',
    createTime: '2025-10-25 09:30',
    completeTime: '2025-11-30 14:45',
    status: '已归档',
    deliveryStatus: '已送达',
    transportMethod: '海运',
    companyName: 'SHIPPER COMPANY LTD',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '4',
    billId: 'BL-2025-004',
    billNumber: 'EGLV010501120004',
    containerNumber: 'EGHU9400403',
    vessel: 'EVER ALP V.004S',
    eta: '2025-11-22',
    ata: '2025-11-23',
    pieces: 28,
    weight: 7500,
    volume: 35.0,
    inspection: '已查验',
    customsStats: '1/1',
    creator: 'op1@xianfenghk.com',
    createTime: '2025-10-28 11:15',
    completeTime: '2025-12-02 09:20',
    status: '已完成',
    deliveryStatus: '已送达',
    transportMethod: '铁路',
    companyName: 'NOTIFY PARTY LTD',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
  {
    id: '5',
    billId: 'BL-2025-005',
    billNumber: 'EGLV010501120005',
    containerNumber: 'EGHU9400404',
    vessel: 'EVER ART V.005W',
    eta: '2025-11-25',
    ata: '2025-11-26',
    pieces: 60,
    weight: 15000,
    volume: 68.0,
    inspection: '已查验',
    customsStats: '2/2',
    creator: 'danzheng2',
    createTime: '2025-11-01 15:45',
    completeTime: '2025-12-05 16:00',
    status: '已归档',
    deliveryStatus: '已送达',
    transportMethod: '卡车',
    companyName: 'SHIPPER COMPANY LTD',
    shipper: 'SHIPPER COMPANY LTD',
    consignee: 'CONSIGNEE COMPANY LTD',
    notifyParty: 'NOTIFY PARTY LTD',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Rotterdam, Netherlands',
    placeOfDelivery: 'Amsterdam, Netherlands',
  },
]

// 根据ID获取提单详情
export function getBillById(id: string): BillOfLading | undefined {
  const allBills = [...scheduleBills, ...historyBills]
  return allBills.find((bill) => bill.id === id)
}

// 获取所有提单（用于搜索等场景）
export function getAllBills(): BillOfLading[] {
  return [...scheduleBills, ...historyBills]
}

