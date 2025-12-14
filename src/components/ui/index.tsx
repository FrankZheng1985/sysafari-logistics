/**
 * ERP 系统 UI 组件库
 * 统一的样式组件，确保全系统风格一致
 */

import React from 'react'

// ============================================
// 统计卡片组件
// ============================================
interface StatsCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  gradient?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan' | 'amber' | 'indigo' | 'pink' | 'teal' | 'gray'
  detail?: React.ReactNode
  onClick?: () => void
  className?: string
}

const gradientMap = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600',
  red: 'from-red-500 to-red-600',
  cyan: 'from-cyan-500 to-cyan-600',
  amber: 'from-amber-500 to-amber-600',
  indigo: 'from-indigo-500 to-indigo-600',
  pink: 'from-pink-500 to-pink-600',
  teal: 'from-teal-500 to-teal-600',
  gray: 'from-gray-500 to-gray-600',
}

export function StatsCard({ 
  title, 
  value, 
  icon, 
  gradient = 'blue', 
  detail,
  onClick,
  className = ''
}: StatsCardProps) {
  const baseClass = `bg-gradient-to-br ${gradientMap[gradient]} rounded-lg p-4 text-white relative overflow-hidden`
  const clickableClass = onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
  
  return (
    <div className={`${baseClass} ${clickableClass} ${className}`} onClick={onClick}>
      <div className="text-xs font-medium opacity-90 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {detail && <div className="text-xs opacity-80 mt-1">{detail}</div>}
      {icon && (
        <div className="absolute top-3 right-3 opacity-80">
          {icon}
        </div>
      )}
    </div>
  )
}

// ============================================
// 页面容器组件
// ============================================
interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`p-4 space-y-4 ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// 内容卡片组件
// ============================================
interface ContentCardProps {
  children: React.ReactNode
  title?: string
  extra?: React.ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
}

export function ContentCard({ 
  children, 
  title, 
  extra, 
  className = '',
  bodyClassName = '',
  noPadding = false
}: ContentCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {(title || extra) && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          {title && <h3 className="text-sm font-medium text-gray-900">{title}</h3>}
          {extra}
        </div>
      )}
      <div className={noPadding ? '' : `p-4 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}

// ============================================
// 状态标签组件
// ============================================
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'default'
  children: React.ReactNode
  className?: string
}

const statusStyles = {
  success: 'text-green-700 bg-green-100',
  warning: 'text-amber-700 bg-amber-100',
  error: 'text-red-700 bg-red-100',
  info: 'text-blue-700 bg-blue-100',
  default: 'text-gray-700 bg-gray-100',
}

export function StatusBadge({ status, children, className = '' }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusStyles[status]} ${className}`}>
      {children}
    </span>
  )
}

// ============================================
// 按钮组件
// ============================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

const buttonVariants = {
  primary: 'text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500',
  outline: 'text-primary-600 border border-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  danger: 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
  success: 'text-white bg-green-600 hover:bg-green-700 focus:ring-green-500',
  ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
}

const buttonSizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  icon,
  children, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${buttonVariants[variant]}
        ${buttonSizes[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
}

// ============================================
// 输入框组件
// ============================================
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const inputSizes = {
  sm: 'px-2 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
}

export function Input({ 
  label, 
  error, 
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  ...props 
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          className={`
            w-full border border-gray-200 rounded-lg bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            ${inputSizes[size]}
            ${leftIcon ? 'pl-9' : ''}
            ${rightIcon ? 'pr-9' : ''}
            ${error ? 'border-red-300 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

// ============================================
// 选择框组件
// ============================================
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  options: Array<{ value: string | number; label: string }>
}

export function Select({ 
  label, 
  error, 
  size = 'md',
  options,
  className = '',
  ...props 
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      )}
      <select
        className={`
          w-full border border-gray-200 rounded-lg bg-white cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${inputSizes[size]}
          ${error ? 'border-red-300 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

// ============================================
// 空状态组件
// ============================================
interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ 
  icon, 
  title = '暂无数据', 
  description,
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      {icon && <div className="mb-3">{icon}</div>}
      <div className="text-sm font-medium text-gray-500">{title}</div>
      {description && <div className="text-xs text-gray-400 mt-1">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ============================================
// 加载状态组件
// ============================================
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const spinnerSizes = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`animate-spin rounded-full border-b-2 border-primary-600 ${spinnerSizes[size]} ${className}`} />
  )
}

// ============================================
// 加载容器组件
// ============================================
interface LoadingContainerProps {
  loading: boolean
  children: React.ReactNode
  height?: string
}

export function LoadingContainer({ loading, children, height = 'h-64' }: LoadingContainerProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <LoadingSpinner />
      </div>
    )
  }
  return <>{children}</>
}

// ============================================
// 标签页组件
// ============================================
interface Tab {
  key: string
  label: string
  badge?: number | string
}

interface TabsProps {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ tabs, activeKey, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-0.5 border-b border-gray-200 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-t transition-colors
            ${activeKey === tab.key 
              ? 'text-primary-600 bg-primary-50 border-b-2 border-primary-600' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${
              activeKey === tab.key ? 'bg-primary-200 text-primary-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================
// 描述列表组件
// ============================================
interface DescriptionItem {
  label: string
  value: React.ReactNode
  span?: number
}

interface DescriptionListProps {
  items: DescriptionItem[]
  columns?: 2 | 3 | 4
  className?: string
}

export function DescriptionList({ items, columns = 2, className = '' }: DescriptionListProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }
  
  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className={item.span ? `col-span-${item.span}` : ''}>
          <div className="text-xs text-gray-500 mb-1">{item.label}</div>
          <div className="text-sm text-gray-900">{item.value || '-'}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// 网格容器组件
// ============================================
interface GridProps {
  cols?: 2 | 3 | 4 | 5
  gap?: 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
  className?: string
}

export function Grid({ cols = 4, gap = 4, children, className = '' }: GridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }
  const gapSize = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
  }
  
  return (
    <div className={`grid ${gridCols[cols]} ${gapSize[gap]} ${className}`}>
      {children}
    </div>
  )
}

// 导出所有组件
export default {
  StatsCard,
  PageContainer,
  ContentCard,
  StatusBadge,
  Button,
  Input,
  Select,
  EmptyState,
  LoadingSpinner,
  LoadingContainer,
  Tabs,
  DescriptionList,
  Grid,
}

