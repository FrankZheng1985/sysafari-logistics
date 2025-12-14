import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight } from 'lucide-react'

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
  const pickerRef = useRef<HTMLDivElement>(null)

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

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
    const firstDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay() // 周一为1
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
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handlePrevYear = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1))
  }

  const handleNextYear = () => {
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
    <div ref={pickerRef} className="relative">
      {/* 输入框 */}
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          value={formatDisplayDate(selectedDate)}
          placeholder={placeholder}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-2 py-1 pr-6 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900 cursor-pointer ${className}`}
        />
        <label
          htmlFor={id}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer"
        >
          <Calendar className="w-3 h-3 text-gray-400 hover:text-primary-600 transition-colors" />
        </label>
      </div>

      {/* 日期选择器弹窗 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-64">
          {/* 输入框区域 */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                readOnly
                value={formatDisplayDate(selectedDate)}
                placeholder={placeholder}
                className="w-full px-2 py-1 pr-6 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              />
              <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 日历头部 */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevYear}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="上一年"
                >
                  <ChevronsLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
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
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="下一月"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
                <button
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
                  className="text-center text-xs font-medium text-gray-600 py-1"
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
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleToday}
              className="w-full px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

