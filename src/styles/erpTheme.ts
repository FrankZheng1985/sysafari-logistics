/**
 * ERP 系统统一样式主题
 * 所有页面必须遵循此主题规范
 */

// 字体大小规范
export const fontSize = {
  // 超小号文字（徽标、时间等辅助信息）
  xxs: 'text-[10px]',
  // 小号文字（表格内容、次要信息）
  xs: 'text-xs',         // 12px
  // 标准文字（正文内容）
  sm: 'text-sm',         // 14px
  // 中等文字（小标题）
  base: 'text-base',     // 16px
  // 大号文字（模块标题）
  lg: 'text-lg',         // 18px
  // 特大号文字（页面标题）
  xl: 'text-xl',         // 20px
  // 超大号文字（数字统计）
  '2xl': 'text-2xl',     // 24px
  '3xl': 'text-3xl',     // 30px
}

// 间距规范
export const spacing = {
  // 页面内边距
  page: 'p-4',
  // 页面内容间距
  section: 'space-y-4',
  // 卡片内边距
  card: 'p-4',
  // 紧凑卡片内边距
  cardCompact: 'p-3',
  // 网格间距
  grid: 'gap-4',
  // 紧凑网格间距
  gridCompact: 'gap-3',
  // 行内元素间距
  inline: 'gap-2',
  // 小间距
  tight: 'gap-1',
}

// 卡片样式
export const card = {
  // 标准卡片
  base: 'bg-white rounded-lg border border-gray-200',
  // 带阴影的卡片
  shadow: 'bg-white rounded-lg border border-gray-200 shadow-sm',
  // 悬浮效果
  hover: 'hover:shadow-lg transition-shadow cursor-pointer',
}

// 统计卡片渐变色
export const gradient = {
  primary: 'bg-gradient-to-br from-primary-500 to-primary-600',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
  green: 'bg-gradient-to-br from-green-500 to-green-600',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-600',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
  red: 'bg-gradient-to-br from-red-500 to-red-600',
  cyan: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  pink: 'bg-gradient-to-br from-pink-500 to-pink-600',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600',
  gray: 'bg-gradient-to-br from-gray-500 to-gray-600',
}

// 输入框样式
export const input = {
  // 标准输入框
  base: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  // 紧凑输入框
  compact: 'px-2 py-1.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-500',
  // 搜索框
  search: 'px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 pl-9',
  // 选择框
  select: 'px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer',
  // 日期选择
  date: 'px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-500',
}

// 按钮样式
export const button = {
  // 主要按钮
  primary: 'px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
  // 主要按钮（紧凑）
  primaryCompact: 'px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
  // 次要按钮
  secondary: 'px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors',
  // 次要按钮（紧凑）
  secondaryCompact: 'px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors',
  // 轮廓按钮
  outline: 'px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
  // 轮廓按钮（紧凑）
  outlineCompact: 'px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-600 rounded hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
  // 危险按钮
  danger: 'px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors',
  // 危险按钮（紧凑）
  dangerCompact: 'px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors',
  // 成功按钮
  success: 'px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors',
  // 成功按钮（紧凑）
  successCompact: 'px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors',
  // 图标按钮
  icon: 'p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors',
  // 链接按钮
  link: 'text-primary-600 hover:text-primary-700 hover:underline text-sm cursor-pointer',
}

// 表格样式
export const table = {
  // 表格容器
  container: 'bg-white rounded-lg border border-gray-200 overflow-hidden',
  // 表头
  header: 'bg-gray-50 text-gray-600 text-xs font-medium uppercase tracking-wider',
  // 表格单元格
  cell: 'px-3 py-2 text-xs text-gray-900',
  // 表格行悬浮
  rowHover: 'hover:bg-gray-50 transition-colors',
}

// 状态标签样式
export const status = {
  // 成功/完成
  success: 'px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 rounded-full',
  // 警告/处理中
  warning: 'px-2 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full',
  // 错误/失败
  error: 'px-2 py-0.5 text-[10px] font-medium text-red-700 bg-red-100 rounded-full',
  // 信息/待处理
  info: 'px-2 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded-full',
  // 默认/草稿
  default: 'px-2 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full',
}

// 模态框样式
export const modal = {
  // 遮罩层
  overlay: 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center',
  // 模态框容器
  container: 'bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden',
  // 标准宽度
  widthSm: 'max-w-md',
  widthMd: 'max-w-lg',
  widthLg: 'max-w-2xl',
  widthXl: 'max-w-4xl',
  // 标题区域
  header: 'px-4 py-3 border-b border-gray-200 flex items-center justify-between',
  // 内容区域
  body: 'p-4 overflow-y-auto',
  // 底部按钮区域
  footer: 'px-4 py-3 border-t border-gray-200 flex justify-end gap-2',
}

// PageHeader 标签页样式
export const tab = {
  // 容器
  container: 'flex gap-0.5 mb-1 border-b border-gray-200',
  // 标签项
  item: 'px-3 py-1.5 text-xs font-medium rounded-t transition-colors cursor-pointer',
  // 激活状态
  active: 'text-primary-600 bg-primary-50 border-b-2 border-primary-600',
  // 非激活状态
  inactive: 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
}

// 图标大小
export const iconSize = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
  '2xl': 'w-10 h-10',
}

// 统计卡片通用样式
export const statsCard = {
  // 基础样式
  base: 'rounded-lg p-4 text-white relative overflow-hidden',
  // 标题
  title: 'text-xs font-medium opacity-90 mb-1',
  // 数值
  value: 'text-2xl font-bold',
  // 次要数值
  subValue: 'text-xl font-bold',
  // 图标容器
  iconContainer: 'absolute top-3 right-3 opacity-80',
  // 图标
  icon: 'w-8 h-8',
  // 详情文字
  detail: 'text-xs opacity-80 mt-1',
}

// 页面布局
export const layout = {
  // 页面容器
  page: 'p-4 space-y-4',
  // 内容区域
  content: 'space-y-4',
  // 网格布局
  grid2: 'grid grid-cols-2 gap-4',
  grid3: 'grid grid-cols-3 gap-4',
  grid4: 'grid grid-cols-4 gap-4',
  grid5: 'grid grid-cols-5 gap-4',
  // 弹性布局
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexStart: 'flex items-center',
  flexEnd: 'flex items-center justify-end',
}

// 导出统一主题对象
const erpTheme = {
  fontSize,
  spacing,
  card,
  gradient,
  input,
  button,
  table,
  status,
  modal,
  tab,
  iconSize,
  statsCard,
  layout,
}

export default erpTheme

