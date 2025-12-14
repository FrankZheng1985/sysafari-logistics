/**
 * 基础数据管理模块 - 类型定义
 */

// Tab 类型
export type BasicDataTab = 
  | 'basic' 
  | 'container' 
  | 'port' 
  | 'destination' 
  | 'country' 
  | 'airport' 
  | 'fee-category' 
  | 'transport-method' 
  | 'vat'

// Tab 配置
export interface TabConfig {
  key: BasicDataTab
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

// 运输类型
export type TransportType = 'sea' | 'air' | 'rail' | 'truck' | ''

// 大洲类型
export type Continent = 'Asia' | 'Europe' | 'Africa' | 'North America' | 'South America' | 'Oceania' | ''

