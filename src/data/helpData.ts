// 帮助数据配置文件
// 定义所有模块的帮助内容结构

export interface FAQ {
  q: string
  a: string
}

export interface HelpItem {
  id: string
  title: string           // 功能标题
  module: string          // 所属模块
  moduleIcon: string      // 模块图标名称
  path: string            // 对应路由
  videoUrl?: string       // 视频链接（YouTube/Bilibili嵌入链接）
  description: string     // 功能描述
  steps?: string[]        // 操作步骤
  tips?: string[]         // 使用技巧
  faq?: FAQ[]             // 常见问题
}

export interface HelpModule {
  id: string
  name: string
  icon: string
  description: string
  color: string
}

// 模块定义
export const helpModules: HelpModule[] = [
  {
    id: 'dashboard',
    name: '系统概览',
    icon: 'LayoutDashboard',
    description: '系统首页和数据概览',
    color: 'bg-blue-500'
  },
  {
    id: 'bookings',
    name: '订单管理',
    icon: 'Package',
    description: '提单、标签、包裹、报关单管理',
    color: 'bg-emerald-500'
  },
  {
    id: 'inspection',
    name: '查验管理',
    icon: 'Search',
    description: '海关查验流程管理',
    color: 'bg-orange-500'
  },
  {
    id: 'tms',
    name: 'TMS运输',
    icon: 'Truck',
    description: '运输管理系统',
    color: 'bg-indigo-500'
  },
  {
    id: 'lastmile',
    name: '最后一公里',
    icon: 'MapPin',
    description: '末端配送管理',
    color: 'bg-pink-500'
  },
  {
    id: 'crm',
    name: 'CRM客户关系',
    icon: 'Users',
    description: '客户关系和销售管理',
    color: 'bg-purple-500'
  },
  {
    id: 'finance',
    name: '财务管理',
    icon: 'DollarSign',
    description: '发票、付款、报表管理',
    color: 'bg-green-500'
  },
  {
    id: 'suppliers',
    name: '供应商管理',
    icon: 'Building2',
    description: '供应商和价格管理',
    color: 'bg-cyan-500'
  },
  {
    id: 'documents',
    name: '单证管理',
    icon: 'FileText',
    description: '单证导入和匹配',
    color: 'bg-amber-500'
  },
  {
    id: 'contracts',
    name: '合同管理',
    icon: 'FileSignature',
    description: '合同模板和管理',
    color: 'bg-rose-500'
  },
  {
    id: 'tools',
    name: '工具中心',
    icon: 'Wrench',
    description: '关税计算器等实用工具',
    color: 'bg-slate-500'
  },
  {
    id: 'system',
    name: '系统管理',
    icon: 'Settings',
    description: '用户、权限、系统设置',
    color: 'bg-gray-600'
  }
]

// 帮助内容数据
export const helpItems: HelpItem[] = [
  // ==================== 系统概览 ====================
  {
    id: 'dashboard-overview',
    title: '系统仪表盘',
    module: 'dashboard',
    moduleIcon: 'LayoutDashboard',
    path: '/',
    videoUrl: '', // 待填充视频链接
    description: '系统首页展示关键业务指标和待办事项概览，帮助您快速了解业务运营状态。',
    steps: [
      '登录系统后自动进入仪表盘页面',
      '查看今日订单数、待处理任务等关键指标',
      '点击各模块卡片可快速跳转到对应功能',
      '右侧显示最近的系统消息和预警'
    ],
    tips: [
      '仪表盘数据每5分钟自动刷新',
      '点击指标卡片可查看详细数据',
      '可以通过系统设置自定义仪表盘显示内容'
    ],
    faq: [
      { q: '仪表盘数据不更新怎么办？', a: '请检查网络连接，或手动刷新页面。如问题持续，请联系系统管理员。' },
      { q: '如何自定义仪表盘？', a: '目前仪表盘布局为系统预设，后续版本将支持自定义配置。' }
    ]
  },

  // ==================== 订单管理 ====================
  {
    id: 'bp-view',
    title: 'BP视图 - 提单总览',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bp-view',
    videoUrl: '',
    description: 'BP视图是提单管理的核心页面，展示所有进行中的提单信息，支持多维度筛选和批量操作。',
    steps: [
      '进入BP视图页面查看所有提单列表',
      '使用顶部筛选条件过滤提单（按状态、日期、船名等）',
      '点击提单号可进入详情页查看完整信息',
      '使用批量操作功能处理多个提单'
    ],
    tips: [
      '可以按 ETA（预计到港时间）排序查看即将到港的货物',
      '状态栏显示报关进度，便于跟踪清关状态',
      '支持导出当前筛选结果到 Excel'
    ],
    faq: [
      { q: '如何快速找到某个提单？', a: '使用顶部搜索框输入提单号或集装箱号进行搜索。' },
      { q: '提单状态有哪些？', a: '主要状态包括：待到港、已到港、清关中、已放行、已提货等。' }
    ]
  },
  {
    id: 'bp-history',
    title: '历史提单',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bp-view/history',
    videoUrl: '',
    description: '查看和管理已完成的历史提单记录，支持按时间范围查询历史数据。',
    steps: [
      '选择日期范围筛选历史提单',
      '查看已完成提单的完整信息',
      '可下载历史提单的相关文档'
    ],
    tips: [
      '历史数据保留期限为两年',
      '可导出历史数据用于统计分析'
    ]
  },
  {
    id: 'order-labels',
    title: '标签管理',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/labels',
    videoUrl: '',
    description: '管理货物标签，支持单个创建和批量创建，可打印标签用于货物标识。',
    steps: [
      '进入标签管理页面',
      '选择单个创建或批量创建',
      '填写标签信息（收件人、地址等）',
      '预览并打印标签'
    ],
    tips: [
      '批量创建时可使用 Excel 模板导入',
      '支持多种标签尺寸格式',
      '打印前请确保打印机设置正确'
    ],
    faq: [
      { q: '如何批量打印标签？', a: '在标签列表中勾选需要打印的标签，点击批量打印按钮。' }
    ]
  },
  {
    id: 'label-create-single',
    title: '单个创建标签',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/labels/create-single',
    videoUrl: '',
    description: '手动创建单个货物标签，适用于零散货物。',
    steps: [
      '填写收件人信息',
      '填写货物信息（件数、重量等）',
      '选择运输方式',
      '确认并创建标签'
    ]
  },
  {
    id: 'label-create-batch',
    title: '批量创建标签',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/labels/create-batch',
    videoUrl: '',
    description: '通过 Excel 文件批量导入标签数据，适用于大量货物。',
    steps: [
      '下载 Excel 模板',
      '按模板格式填写标签数据',
      '上传填写好的 Excel 文件',
      '系统自动校验并创建标签'
    ],
    tips: [
      '请严格按照模板格式填写，否则可能导入失败',
      '一次最多支持导入 500 条标签'
    ]
  },
  {
    id: 'order-packages',
    title: '包裹管理',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/packages',
    videoUrl: '',
    description: '管理订单包裹信息，跟踪包裹状态和配送进度。',
    steps: [
      '查看包裹列表',
      '点击包裹查看详细信息',
      '跟踪包裹配送状态',
      '处理异常包裹'
    ]
  },
  {
    id: 'order-bills',
    title: '账单管理',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/bill',
    videoUrl: '',
    description: '管理订单相关账单，包括运费、报关费等各项费用。',
    steps: [
      '查看账单列表',
      '筛选不同状态的账单（待付款、已付款等）',
      '点击账单查看费用明细',
      '确认并支付账单'
    ],
    faq: [
      { q: '账单有误怎么办？', a: '请联系财务部门核实，确认后可申请账单调整。' }
    ]
  },
  {
    id: 'order-declarations',
    title: '报关单管理',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/declarations',
    videoUrl: '',
    description: '管理进出口报关单据，跟踪报关进度。',
    steps: [
      '查看报关单列表',
      '上传报关所需文件',
      '跟踪报关审批进度',
      '下载报关完成单据'
    ],
    tips: [
      '请确保上传的文件清晰完整',
      '报关资料需提前准备，避免延误'
    ]
  },
  {
    id: 'clearance-documents',
    title: '清关文件',
    module: 'bookings',
    moduleIcon: 'Package',
    path: '/bookings/clearance',
    videoUrl: '',
    description: '管理清关所需的各类文件，支持上传、下载和预览。',
    steps: [
      '选择需要处理的提单',
      '上传清关所需文件',
      '系统自动匹配和校验',
      '提交清关申请'
    ]
  },

  // ==================== 查验管理 ====================
  {
    id: 'inspection-dashboard',
    title: '查验仪表盘',
    module: 'inspection',
    moduleIcon: 'Search',
    path: '/inspection',
    videoUrl: '',
    description: '海关查验管理总览，显示待查验、查验中、已放行等状态的货物统计。',
    steps: [
      '查看查验任务概览',
      '按状态筛选查验任务',
      '点击任务查看详情',
      '更新查验结果'
    ],
    tips: [
      '收到查验通知后请及时处理',
      '查验费用会自动计入账单'
    ]
  },
  {
    id: 'inspection-pending',
    title: '待查验列表',
    module: 'inspection',
    moduleIcon: 'Search',
    path: '/inspection/pending',
    videoUrl: '',
    description: '显示所有待查验的货物列表，支持安排查验时间。',
    steps: [
      '查看待查验货物',
      '安排查验时间',
      '准备查验资料',
      '跟进查验进度'
    ]
  },
  {
    id: 'inspection-released',
    title: '已放行列表',
    module: 'inspection',
    moduleIcon: 'Search',
    path: '/inspection/released',
    videoUrl: '',
    description: '显示查验通过并已放行的货物列表。',
    steps: [
      '查看已放行货物',
      '下载放行证明',
      '安排后续提货'
    ]
  },

  // ==================== TMS运输管理 ====================
  {
    id: 'tms-dashboard',
    title: 'TMS仪表盘',
    module: 'tms',
    moduleIcon: 'Truck',
    path: '/tms',
    videoUrl: '',
    description: '运输管理系统总览，展示运输任务状态和车辆调度情况。',
    steps: [
      '查看运输任务概览',
      '监控在途货物',
      '查看车辆调度状态',
      '处理运输异常'
    ]
  },
  {
    id: 'tms-pricing',
    title: '运输定价',
    module: 'tms',
    moduleIcon: 'Truck',
    path: '/tms/pricing',
    videoUrl: '',
    description: '管理运输价格，设置不同线路和运输方式的费率。',
    steps: [
      '查看现有价格方案',
      '添加或修改价格',
      '设置价格生效时间',
      '发布新价格方案'
    ],
    tips: [
      '价格修改会在下一个结算周期生效',
      '可设置特殊客户的优惠价格'
    ]
  },
  {
    id: 'tms-exceptions',
    title: 'CMR异常管理',
    module: 'tms',
    moduleIcon: 'Truck',
    path: '/tms/exceptions',
    videoUrl: '',
    description: '处理运输过程中的异常情况，如延误、破损等。',
    steps: [
      '查看异常列表',
      '了解异常详情',
      '处理异常并记录',
      '关闭已解决的异常'
    ]
  },
  {
    id: 'tms-conditions',
    title: '运输条件',
    module: 'tms',
    moduleIcon: 'Truck',
    path: '/tms/conditions',
    videoUrl: '',
    description: '设置运输条件和约束，如温控要求、危险品标识等。',
    steps: [
      '定义运输条件',
      '关联到具体货物类型',
      '设置条件提醒规则'
    ]
  },
  {
    id: 'cmr-manage',
    title: 'CMR管理',
    module: 'tms',
    moduleIcon: 'Truck',
    path: '/cmr-manage',
    videoUrl: '',
    description: '管理 CMR（国际公路货物运输合同）单据，跟踪运输状态。',
    steps: [
      '创建或导入 CMR',
      '跟踪运输进度',
      '更新运输状态',
      '归档完成的 CMR'
    ]
  },

  // ==================== 最后一公里 ====================
  {
    id: 'lastmile-dashboard',
    title: '最后一公里仪表盘',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile',
    videoUrl: '',
    description: '末端配送管理总览，展示配送任务状态和承运商绩效。',
    steps: [
      '查看配送任务概览',
      '监控配送进度',
      '查看承运商绩效',
      '处理配送异常'
    ]
  },
  {
    id: 'lastmile-carriers',
    title: '承运商管理',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/carriers',
    videoUrl: '',
    description: '管理最后一公里配送承运商，包括 DPD、GLS、Hermes 等。',
    steps: [
      '查看承运商列表',
      '添加新承运商',
      '配置承运商 API 接口',
      '设置承运商优先级'
    ],
    tips: [
      '添加承运商前需先获取 API 密钥',
      '可设置多个承运商进行比价'
    ]
  },
  {
    id: 'lastmile-zones',
    title: '配送区域',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/zones',
    videoUrl: '',
    description: '管理配送区域划分，设置不同区域的配送规则。',
    steps: [
      '查看区域划分',
      '添加或修改区域',
      '设置区域配送规则',
      '关联承运商到区域'
    ]
  },
  {
    id: 'lastmile-rates',
    title: '配送费率',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/rates',
    videoUrl: '',
    description: '管理不同承运商和区域的配送费率。',
    steps: [
      '查看费率列表',
      '按承运商/区域筛选',
      '添加或修改费率',
      '设置费率生效时间'
    ]
  },
  {
    id: 'lastmile-import',
    title: '费率导入',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/import',
    videoUrl: '',
    description: '批量导入承运商费率数据。',
    steps: [
      '下载费率模板',
      '填写费率数据',
      '上传费率文件',
      '确认并导入'
    ]
  },
  {
    id: 'lastmile-shipments',
    title: '配送任务',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/shipments',
    videoUrl: '',
    description: '管理最后一公里配送任务，跟踪配送状态。',
    steps: [
      '查看配送任务列表',
      '创建配送任务',
      '跟踪配送进度',
      '处理配送异常'
    ]
  },
  {
    id: 'lastmile-quote',
    title: '快速报价',
    module: 'lastmile',
    moduleIcon: 'MapPin',
    path: '/last-mile/quote',
    videoUrl: '',
    description: '快速获取不同承运商的配送报价。',
    steps: [
      '输入配送地址',
      '输入包裹信息',
      '获取多家承运商报价',
      '选择最优方案'
    ],
    tips: [
      '报价会实时调用承运商 API',
      '可保存常用地址加快报价速度'
    ]
  },

  // ==================== CRM客户关系 ====================
  {
    id: 'crm-dashboard',
    title: 'CRM仪表盘',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm',
    videoUrl: '',
    description: '客户关系管理总览，展示客户统计、销售漏斗和业绩指标。',
    steps: [
      '查看客户统计数据',
      '了解销售漏斗状态',
      '查看业绩指标',
      '跟进待办事项'
    ]
  },
  {
    id: 'crm-customers',
    title: '客户管理',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/customers',
    videoUrl: '',
    description: '管理客户信息，包括基本资料、联系人、交易历史等。',
    steps: [
      '查看客户列表',
      '添加新客户',
      '完善客户资料',
      '查看客户交易历史'
    ],
    tips: [
      '完整的客户资料有助于提升服务质量',
      '可设置客户等级和信用额度'
    ],
    faq: [
      { q: '如何导入现有客户数据？', a: '进入客户管理页面，点击导入按钮，下载模板后填写数据并上传。' }
    ]
  },
  {
    id: 'crm-opportunities',
    title: '商机管理',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/opportunities',
    videoUrl: '',
    description: '管理销售商机，跟踪商机进展和转化率。',
    steps: [
      '创建新商机',
      '设置商机阶段',
      '更新商机进展',
      '转化为订单'
    ]
  },
  {
    id: 'crm-quotations',
    title: '报价管理',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/quotations',
    videoUrl: '',
    description: '创建和管理客户报价单。',
    steps: [
      '创建新报价',
      '添加报价项目',
      '设置有效期',
      '发送给客户'
    ]
  },
  {
    id: 'crm-contracts',
    title: 'CRM合同',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/contracts',
    videoUrl: '',
    description: '管理客户合同，跟踪合同状态和到期提醒。',
    steps: [
      '查看合同列表',
      '创建新合同',
      '上传合同附件',
      '设置到期提醒'
    ]
  },
  {
    id: 'crm-feedbacks',
    title: '客户反馈',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/feedbacks',
    videoUrl: '',
    description: '收集和管理客户反馈，提升服务质量。',
    steps: [
      '查看反馈列表',
      '处理客户反馈',
      '记录处理结果',
      '分析反馈趋势'
    ]
  },
  {
    id: 'crm-commission-rules',
    title: '佣金规则',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/commission/rules',
    videoUrl: '',
    description: '设置销售佣金计算规则。',
    steps: [
      '查看现有佣金规则',
      '添加新规则',
      '设置计算公式',
      '关联到销售人员'
    ]
  },
  {
    id: 'crm-commission-records',
    title: '佣金记录',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/commission/records',
    videoUrl: '',
    description: '查看销售佣金计算记录。',
    steps: [
      '按时间段筛选',
      '查看佣金明细',
      '导出佣金报表'
    ]
  },
  {
    id: 'crm-commission-settlements',
    title: '佣金结算',
    module: 'crm',
    moduleIcon: 'Users',
    path: '/crm/commission/settlements',
    videoUrl: '',
    description: '处理销售佣金结算。',
    steps: [
      '选择结算周期',
      '核对佣金数据',
      '提交结算申请',
      '完成结算'
    ]
  },

  // ==================== 财务管理 ====================
  {
    id: 'finance-dashboard',
    title: '财务仪表盘',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance',
    videoUrl: '',
    description: '财务管理总览，展示收入、支出、应收应付等关键指标。',
    steps: [
      '查看财务概览',
      '了解收支情况',
      '查看应收应付',
      '跟进待处理事项'
    ]
  },
  {
    id: 'finance-invoices',
    title: '发票管理',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/invoices',
    videoUrl: '',
    description: '管理销售发票，支持创建、编辑、发送和打印。',
    steps: [
      '查看发票列表',
      '创建新发票',
      '编辑发票内容',
      '发送或打印发票'
    ],
    tips: [
      '发票编号自动生成',
      '可设置发票模板',
      '支持多币种发票'
    ],
    faq: [
      { q: '如何作废已开发票？', a: '在发票详情页点击作废按钮，填写作废原因后提交。' }
    ]
  },
  {
    id: 'finance-create-invoice',
    title: '创建发票',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/invoices/create',
    videoUrl: '',
    description: '创建新的销售发票。',
    steps: [
      '选择客户',
      '添加发票项目',
      '设置付款条款',
      '预览并保存'
    ]
  },
  {
    id: 'finance-payments',
    title: '付款管理',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/payments',
    videoUrl: '',
    description: '管理收款和付款记录。',
    steps: [
      '查看付款记录',
      '登记新收款',
      '核销应收款项',
      '处理付款异常'
    ]
  },
  {
    id: 'finance-fees',
    title: '费用管理',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/fees',
    videoUrl: '',
    description: '管理各类费用项目和费用记录。',
    steps: [
      '查看费用列表',
      '添加费用记录',
      '审核费用',
      '生成费用报表'
    ]
  },
  {
    id: 'finance-reports',
    title: '财务报表',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/reports',
    videoUrl: '',
    description: '查看和导出各类财务报表。',
    steps: [
      '选择报表类型',
      '设置时间范围',
      '生成报表',
      '导出或打印'
    ]
  },
  {
    id: 'finance-statements',
    title: '财务报表明细',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/statements',
    videoUrl: '',
    description: '查看详细的财务报表数据。',
    steps: [
      '选择报表周期',
      '查看明细数据',
      '对比历史数据',
      '导出报表'
    ]
  },
  {
    id: 'finance-bank-accounts',
    title: '银行账户',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/bank-accounts',
    videoUrl: '',
    description: '管理公司银行账户信息。',
    steps: [
      '查看银行账户列表',
      '添加新账户',
      '设置默认收款账户',
      '查看账户流水'
    ]
  },
  {
    id: 'finance-carrier-settlement',
    title: '承运商结算',
    module: 'finance',
    moduleIcon: 'DollarSign',
    path: '/finance/carrier-settlement',
    videoUrl: '',
    description: '与承运商进行费用结算。',
    steps: [
      '选择结算周期',
      '核对运费数据',
      '生成结算单',
      '提交结算'
    ]
  },

  // ==================== 供应商管理 ====================
  {
    id: 'suppliers-dashboard',
    title: '供应商仪表盘',
    module: 'suppliers',
    moduleIcon: 'Building2',
    path: '/suppliers',
    videoUrl: '',
    description: '供应商管理总览，展示供应商统计和价格对比。',
    steps: [
      '查看供应商概览',
      '了解价格趋势',
      '查看供应商绩效'
    ]
  },
  {
    id: 'suppliers-manage',
    title: '供应商列表',
    module: 'suppliers',
    moduleIcon: 'Building2',
    path: '/suppliers/manage',
    videoUrl: '',
    description: '管理供应商基本信息和联系方式。',
    steps: [
      '查看供应商列表',
      '添加新供应商',
      '编辑供应商信息',
      '评估供应商'
    ]
  },
  {
    id: 'suppliers-prices',
    title: '供应商价格',
    module: 'suppliers',
    moduleIcon: 'Building2',
    path: '/suppliers/prices',
    videoUrl: '',
    description: '管理供应商报价和价格对比。',
    steps: [
      '查看价格列表',
      '比较不同供应商价格',
      '更新价格信息',
      '设置价格预警'
    ]
  },
  {
    id: 'suppliers-import',
    title: '价格导入',
    module: 'suppliers',
    moduleIcon: 'Building2',
    path: '/suppliers/import',
    videoUrl: '',
    description: '批量导入供应商价格数据。',
    steps: [
      '下载价格模板',
      '填写价格数据',
      '上传价格文件',
      '确认并导入'
    ]
  },

  // ==================== 单证管理 ====================
  {
    id: 'documents-dashboard',
    title: '单证仪表盘',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents',
    videoUrl: '',
    description: '单证管理总览，展示单证处理状态和待办事项。',
    steps: [
      '查看单证概览',
      '了解处理进度',
      '跟进待办事项'
    ]
  },
  {
    id: 'documents-import',
    title: '单证导入',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents/import',
    videoUrl: '',
    description: '导入各类单证文件，支持 PDF、图片等格式。',
    steps: [
      '选择单证类型',
      '上传单证文件',
      '系统自动识别',
      '确认识别结果'
    ],
    tips: [
      '支持 OCR 自动识别',
      '上传清晰的扫描件效果更好'
    ]
  },
  {
    id: 'documents-matching',
    title: '单证匹配',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents/matching',
    videoUrl: '',
    description: '将单证与订单进行匹配关联。',
    steps: [
      '查看待匹配单证',
      '选择匹配订单',
      '确认匹配关系',
      '处理匹配异常'
    ]
  },
  {
    id: 'documents-tax-calc',
    title: '税费计算',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents/tax-calc',
    videoUrl: '',
    description: '根据单证信息计算进口税费。',
    steps: [
      '选择单证',
      '确认货物信息',
      '系统计算税费',
      '查看计算结果'
    ]
  },
  {
    id: 'documents-supplement',
    title: '单证补充',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents/supplement',
    videoUrl: '',
    description: '补充缺失的单证信息。',
    steps: [
      '查看缺失单证',
      '上传补充文件',
      '完善单证信息',
      '提交审核'
    ]
  },
  {
    id: 'documents-match-records',
    title: 'HS编码匹配记录',
    module: 'documents',
    moduleIcon: 'FileText',
    path: '/documents/match-records',
    videoUrl: '',
    description: '查看 HS 编码匹配历史记录。',
    steps: [
      '查看匹配记录',
      '筛选特定时间段',
      '导出匹配数据'
    ]
  },

  // ==================== 合同管理 ====================
  {
    id: 'contracts-list',
    title: '合同列表',
    module: 'contracts',
    moduleIcon: 'FileSignature',
    path: '/contracts',
    videoUrl: '',
    description: '管理海关代理合同和其他业务合同。',
    steps: [
      '查看合同列表',
      '创建新合同',
      '编辑合同内容',
      '跟踪合同状态'
    ]
  },
  {
    id: 'contracts-config',
    title: '合同模板配置',
    module: 'contracts',
    moduleIcon: 'FileSignature',
    path: '/contracts/config',
    videoUrl: '',
    description: '配置合同模板，设置合同条款和格式。',
    steps: [
      '选择模板类型',
      '编辑模板内容',
      '设置变量字段',
      '保存模板'
    ],
    tips: [
      '模板支持变量替换',
      '可设置多语言版本'
    ]
  },

  // ==================== 工具中心 ====================
  {
    id: 'tools-dashboard',
    title: '工具仪表盘',
    module: 'tools',
    moduleIcon: 'Wrench',
    path: '/tools',
    videoUrl: '',
    description: '各类实用工具入口。',
    steps: [
      '选择需要的工具',
      '进入工具页面',
      '使用工具功能'
    ]
  },
  {
    id: 'tools-inquiry',
    title: '询价工具',
    module: 'tools',
    moduleIcon: 'Wrench',
    path: '/tools/inquiry',
    videoUrl: '',
    description: '快速获取运输报价。',
    steps: [
      '输入起始地和目的地',
      '填写货物信息',
      '选择运输方式',
      '获取报价结果'
    ]
  },
  {
    id: 'tools-tariff-calculator',
    title: '关税计算器',
    module: 'tools',
    moduleIcon: 'Wrench',
    path: '/tools/tariff-calculator',
    videoUrl: '',
    description: '计算进口关税和增值税。',
    steps: [
      '输入 HS 编码',
      '输入货值',
      '选择原产地',
      '查看计算结果'
    ],
    tips: [
      'HS 编码需输入完整 10 位',
      '支持多种货币换算'
    ],
    faq: [
      { q: 'HS编码在哪里查询？', a: '可以使用系统的 HS 编码查询功能，或参考海关官网。' }
    ]
  },
  {
    id: 'tools-shared-tax',
    title: '共享税务',
    module: 'tools',
    moduleIcon: 'Wrench',
    path: '/tools/shared-tax',
    videoUrl: '',
    description: '管理共享税务信息。',
    steps: [
      '查看税务信息',
      '更新税率数据',
      '设置税务规则'
    ]
  },
  {
    id: 'tools-product-pricing',
    title: '产品定价',
    module: 'tools',
    moduleIcon: 'Wrench',
    path: '/tools/product-pricing',
    videoUrl: '',
    description: '管理产品价格和定价策略。',
    steps: [
      '查看产品价格',
      '设置定价规则',
      '批量调整价格'
    ]
  },

  // ==================== 系统管理 ====================
  {
    id: 'system-dashboard',
    title: '系统管理仪表盘',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system',
    videoUrl: '',
    description: '系统管理总览，提供各管理功能入口。',
    steps: [
      '查看系统状态',
      '进入各管理模块',
      '处理系统任务'
    ]
  },
  {
    id: 'system-user-manage',
    title: '用户管理',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/user-manage',
    videoUrl: '',
    description: '管理系统用户，包括添加、编辑、禁用用户。',
    steps: [
      '查看用户列表',
      '添加新用户',
      '设置用户角色',
      '管理用户状态'
    ],
    tips: [
      '新用户需要设置初始密码',
      '可批量导入用户'
    ]
  },
  {
    id: 'system-role-permissions',
    title: '权限管理',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/user-manage/permissions',
    videoUrl: '',
    description: '管理角色和权限，控制用户访问范围。',
    steps: [
      '查看角色列表',
      '创建新角色',
      '配置角色权限',
      '分配角色给用户'
    ],
    faq: [
      { q: '如何限制用户只能查看特定模块？', a: '创建一个新角色，只勾选需要的模块权限，然后将该角色分配给用户。' }
    ]
  },
  {
    id: 'system-menu-settings',
    title: '菜单设置',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/menu-settings',
    videoUrl: '',
    description: '自定义系统菜单显示。',
    steps: [
      '查看菜单结构',
      '调整菜单顺序',
      '隐藏/显示菜单项',
      '保存菜单设置'
    ]
  },
  {
    id: 'system-basic-data',
    title: '基础数据',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/basic-data',
    videoUrl: '',
    description: '管理系统基础数据，如港口、国家、费用类别等。',
    steps: [
      '选择数据类型',
      '查看数据列表',
      '添加或编辑数据',
      '导入批量数据'
    ]
  },
  {
    id: 'system-tariff-rates',
    title: '关税税率',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/tariff-rates',
    videoUrl: '',
    description: '管理关税税率数据。',
    steps: [
      '查看税率列表',
      '搜索 HS 编码',
      '更新税率数据',
      '导入税率文件'
    ]
  },
  {
    id: 'system-security-settings',
    title: '安全设置',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/security-settings',
    videoUrl: '',
    description: '配置系统安全选项。',
    steps: [
      '设置密码策略',
      '配置登录规则',
      '管理 API 密钥',
      '查看安全日志'
    ]
  },
  {
    id: 'system-activity-logs',
    title: '操作日志',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/activity-logs',
    videoUrl: '',
    description: '查看系统操作日志，追踪用户行为。',
    steps: [
      '设置时间范围',
      '筛选用户/操作类型',
      '查看日志详情',
      '导出日志'
    ]
  },
  {
    id: 'system-api-integrations',
    title: 'API集成',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/api-integrations',
    videoUrl: '',
    description: '管理第三方 API 集成。',
    steps: [
      '查看已集成 API',
      '添加新集成',
      '配置 API 参数',
      '测试 API 连接'
    ]
  },
  {
    id: 'system-data-import',
    title: '数据导入中心',
    module: 'system',
    moduleIcon: 'Settings',
    path: '/system/data-import',
    videoUrl: '',
    description: '批量导入各类系统数据。',
    steps: [
      '选择导入类型',
      '下载导入模板',
      '填写数据',
      '上传并导入'
    ]
  }
]

// 根据路由获取帮助内容
export function getHelpByPath(path: string): HelpItem | undefined {
  // 精确匹配
  let help = helpItems.find(item => item.path === path)
  if (help) return help

  // 移除末尾斜杠后匹配
  const normalizedPath = path.replace(/\/$/, '')
  help = helpItems.find(item => item.path === normalizedPath)
  if (help) return help

  // 移除动态参数后匹配（如 /crm/customers/123 -> /crm/customers）
  const basePath = normalizedPath.split('/').slice(0, -1).join('/')
  if (basePath) {
    help = helpItems.find(item => item.path === basePath)
    if (help) return help
  }

  // 前缀匹配（找最接近的父路由）
  const matches = helpItems.filter(item => normalizedPath.startsWith(item.path))
  if (matches.length > 0) {
    return matches.sort((a, b) => b.path.length - a.path.length)[0]
  }

  return undefined
}

// 根据模块ID获取帮助内容列表
export function getHelpByModule(moduleId: string): HelpItem[] {
  return helpItems.filter(item => item.module === moduleId)
}

// 搜索帮助内容
export function searchHelp(keyword: string): HelpItem[] {
  const lowerKeyword = keyword.toLowerCase()
  return helpItems.filter(item => 
    item.title.toLowerCase().includes(lowerKeyword) ||
    item.description.toLowerCase().includes(lowerKeyword) ||
    item.steps?.some(step => step.toLowerCase().includes(lowerKeyword)) ||
    item.tips?.some(tip => tip.toLowerCase().includes(lowerKeyword)) ||
    item.faq?.some(f => f.q.toLowerCase().includes(lowerKeyword) || f.a.toLowerCase().includes(lowerKeyword))
  )
}

// 获取模块信息
export function getModuleById(moduleId: string): HelpModule | undefined {
  return helpModules.find(m => m.id === moduleId)
}

