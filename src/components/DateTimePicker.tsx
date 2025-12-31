import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, X, Clock } from 'lucide-react'

interface DateTimePickerProps {
  value: string // YYYY-MM-DD 或 YYYY-MM-DDTHH:mm 格式
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  title?: string
  showTime?: boolean // 是否显示时间选择，默认 true
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder,
  className = '',
  id,
  title,
  showTime = true,
}: DateTimePickerProps) {
  const defaultPlaceholder = showTime ? '请选择日期时间' : '请选择日期'
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState('12')
  const [selectedMinute, setSelectedMinute] = useState('00')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // 解析初始值
  useEffect(() => {
    if (value) {
      // 支持 YYYY-MM-DDTHH:mm 格式
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setSelectedDate(date)
        setCurrentMonth(date)
        setSelectedHour(String(date.getHours()).padStart(2, '0'))
        setSelectedMinute(String(date.getMinutes()).padStart(2, '0'))
      }
    } else {
      setSelectedDate(null)
      // 默认时间设为当前时间
      const now = new Date()
      setSelectedHour(String(now.getHours()).padStart(2, '0'))
      setSelectedMinute(String(now.getMinutes()).padStart(2, '0'))
    }
  }, [value])

  // 点击外部关闭
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Node
    const isInsideTrigger = triggerRef.current?.contains(target)
    const isInsidePopup = popupRef.current?.contains(target)
    
    if (!isInsideTrigger && !isInsidePopup) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
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

  // 格式化日期时间显示
  const formatDisplayDateTime = (): string => {
    if (!selectedDate) return ''
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    if (showTime) {
      return `${year}-${month}-${day} ${selectedHour}:${selectedMinute}`
    }
    return `${year}-${month}-${day}`
  }

  // 格式化为 datetime-local 或 date 格式
  const formatValue = (date: Date, hour: string, minute: string): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    if (showTime) {
      return `${year}-${month}-${day}T${hour}:${minute}`
    }
    return `${year}-${month}-${day}`
  }

  // 获取月份的日期
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
  }

  // 确认选择
  const handleConfirm = () => {
    if (selectedDate) {
      onChange(formatValue(selectedDate, selectedHour, selectedMinute))
      setIsOpen(false)
    }
  }

  // 选择当前时间
  const handleNow = () => {
    const now = new Date()
    setSelectedDate(now)
    setCurrentMonth(now)
    setSelectedHour(String(now.getHours()).padStart(2, '0'))
    setSelectedMinute(String(now.getMinutes()).padStart(2, '0'))
    onChange(formatValue(now, String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')))
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

  // 生成小时选项
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  // 生成分钟选项
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <span className="flex items-center gap-1.5 flex-1 text-left">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className={`${formatDisplayDateTime() ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatDisplayDateTime() || placeholder || defaultPlaceholder}
          </span>
        </span>
        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {/* 日期时间选择器弹窗 */}
      {isOpen && (
        <div 
          ref={popupRef}
          className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] w-72"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <span className="text-xs font-medium text-gray-600">选择日期和时间</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="关闭"
              aria-label="关闭日期时间选择器"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>

          {/* 日历头部 */}
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                  title="上一年"
                >
                  <ChevronsLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                  title="上一月"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
              <div className="text-xs font-medium text-gray-900">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                  title="下一月"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                  title="下一年"
                >
                  <ChevronsRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-medium text-gray-500 py-0.5"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-0.5">
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
                      w-7 h-7 text-[10px] rounded transition-colors
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

          {/* 时间选择 - 仅在 showTime 时显示 */}
          {showTime && (
            <div className="px-2 pb-2 border-t border-gray-100 pt-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-600">时间:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(e.target.value)}
                    title="选择小时"
                    aria-label="选择小时"
                    className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">:</span>
                  <select
                    value={selectedMinute}
                    onChange={(e) => setSelectedMinute(e.target.value)}
                    title="选择分钟"
                    aria-label="选择分钟"
                    className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center justify-between p-2 border-t border-gray-200 bg-gray-50 rounded-b-lg gap-2">
            <button
              type="button"
              onClick={handleNow}
              className="px-2 py-1 text-[10px] text-primary-600 border border-primary-300 rounded hover:bg-primary-50 transition-colors"
            >
              现在
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
