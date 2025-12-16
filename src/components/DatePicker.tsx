import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, X } from 'lucide-react'

interface DatePickerProps {
  value: string // YYYY-MM-DD 格式
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export default function DatePicker({
  value,
  onChange,
  placeholder = '请选择日期',
  className = '',
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // 当外部value变化时更新selectedDate
  useEffect(() => {
    if (value) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setSelectedDate(date)
        setCurrentMonth(date)
      }
    } else {
      setSelectedDate(null)
    }
  }, [value])

  // 点击外部关闭 - 使用更可靠的方式
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Node
    
    // 检查点击是否在触发按钮或弹出层内
    const isInsideTrigger = triggerRef.current?.contains(target)
    const isInsidePopup = popupRef.current?.contains(target)
    
    if (!isInsideTrigger && !isInsidePopup) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      // 延迟添加事件监听，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
      
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, handleClickOutside])

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  // 格式化日期显示
  const formatDisplayDate = (date: Date | null): string => {
    if (!date) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 获取月份的第一天和最后一天
  const getMonthDates = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const firstDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const dates: (Date | null)[] = []

    // 上个月的日期
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = firstDayOfWeek - 1; i > 0; i--) {
      dates.push(new Date(year, month - 1, prevMonthLastDay - i + 1))
    }

    // 当前月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(new Date(year, month, i))
    }

    // 下个月的日期（填满6行）
    const remainingDays = 42 - dates.length
    for (let i = 1; i <= remainingDays; i++) {
      dates.push(new Date(year, month + 1, i))
    }

    return dates
  }

  // 选择日期
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    onChange(formatDisplayDate(date))
    setIsOpen(false)
  }

  // 选择今天
  const handleToday = () => {
    const today = new Date()
    setSelectedDate(today)
    setCurrentMonth(today)
    onChange(formatDisplayDate(today))
    setIsOpen(false)
  }

  // 月份导航
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1))
  }

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1))
  }

  // 判断是否为今天
  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  // 判断是否为选中日期
  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    )
  }

  // 判断是否为当前月份
  const isCurrentMonth = (date: Date): boolean => {
    return (
      date.getFullYear() === currentMonth.getFullYear() &&
      date.getMonth() === currentMonth.getMonth()
    )
  }

  const dates = getMonthDates()
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const weekDays = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div ref={containerRef} className="relative" style={{ display: 'inline-block' }}>
      {/* 触发按钮 - 只有点击这个按钮才会打开日期选择器 */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 ${className}`}
        style={{ minWidth: '110px' }}
      >
        <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {formatDisplayDate(selectedDate) || placeholder}
        </span>
      </button>

      {/* 日期选择器弹窗 */}
      {isOpen && (
        <div 
          ref={popupRef}
          className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] w-64"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 弹窗头部 - 带关闭按钮 */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <span className="text-xs font-medium text-gray-600">选择日期</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="关闭"
              aria-label="关闭日期选择器"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>

          {/* 日历头部 */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="上一年"
                >
                  <ChevronsLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="上一月"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="下一月"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="下一年"
                >
                  <ChevronsRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-1">
              {dates.map((date, index) => {
                if (!date) return <div key={index}></div>

                const isCurrentMonthDate = isCurrentMonth(date)
                const isSelectedDate = isSelected(date)
                const isTodayDate = isToday(date)

                return (
                  <button
                    type="button"
                    key={index}
                    onClick={() => handleDateSelect(date)}
                    className={`
                      w-8 h-8 text-xs rounded transition-colors
                      ${!isCurrentMonthDate ? 'text-gray-300' : 'text-gray-900'}
                      ${isSelectedDate
                        ? 'bg-primary-600 text-white font-medium'
                        : isTodayDate
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="p-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={handleToday}
              className="w-full px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
