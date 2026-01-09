import { useState, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface ScheduleItem {
  id: string
  title: string
  time: string
  type: 'meeting' | 'task' | 'deadline' | 'reminder'
}

interface CalendarCardProps {
  refreshKey?: number
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function CalendarCard({ refreshKey }: CalendarCardProps) {
  const { getAccessToken } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)

  // 获取当月日历数据
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days: (number | null)[] = []
    
    // 前置空白
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    
    // 当月日期
    for (let i = 1; i <= totalDays; i++) {
      days.push(i)
    }

    return days
  }

  // 加载日程
  useEffect(() => {
    loadSchedules()
  }, [selectedDate, refreshKey])

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await fetch(`${API_BASE}/api/workbench/schedule?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setSchedules(data.data)
        } else {
          setSchedules(getMockSchedules())
        }
      } else {
        setSchedules(getMockSchedules())
      }
    } catch (error) {
      console.error('加载日程失败:', error)
      setSchedules(getMockSchedules())
    } finally {
      setLoading(false)
    }
  }

  const getMockSchedules = (): ScheduleItem[] => {
    const today = new Date()
    if (selectedDate.toDateString() === today.toDateString()) {
      return [
        { id: '1', title: '客户跟进会议', time: '10:00', type: 'meeting' },
        { id: '2', title: '订单审核截止', time: '14:00', type: 'deadline' },
        { id: '3', title: '发票到期提醒', time: '17:00', type: 'reminder' },
      ]
    }
    return []
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear()
  }

  const isSelected = (day: number) => {
    return day === selectedDate.getDate() && 
           currentDate.getMonth() === selectedDate.getMonth() && 
           currentDate.getFullYear() === selectedDate.getFullYear()
  }

  const selectDay = (day: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
  }

  const days = getCalendarDays()

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-600'
      case 'task': return 'bg-green-100 text-green-600'
      case 'deadline': return 'bg-red-100 text-red-600'
      case 'reminder': return 'bg-amber-100 text-amber-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="space-y-3">
      {/* 日历头部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="上个月"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
        </span>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="下个月"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* 星期头 */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-xs text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <button
            key={index}
            onClick={() => day && selectDay(day)}
            disabled={!day}
            className={`
              aspect-square flex items-center justify-center text-xs rounded-lg transition-colors
              ${!day ? 'invisible' : ''}
              ${isToday(day!) ? 'bg-primary-600 text-white font-medium' : ''}
              ${isSelected(day!) && !isToday(day!) ? 'bg-primary-100 text-primary-700 font-medium' : ''}
              ${!isToday(day!) && !isSelected(day!) ? 'hover:bg-gray-100 text-gray-700' : ''}
            `}
          >
            {day}
          </button>
        ))}
      </div>

      {/* 当日日程 */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-500">
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 日程
          </span>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
          </div>
        ) : schedules.length > 0 ? (
          <div className="space-y-1.5 max-h-24 overflow-y-auto">
            {schedules.map(schedule => (
              <div key={schedule.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <Clock className={`w-3 h-3 ${getTypeColor(schedule.type).split(' ')[1]}`} />
                <span className="text-xs text-gray-500">{schedule.time}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{schedule.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400 text-xs">
            暂无日程安排
          </div>
        )}
      </div>
    </div>
  )
}
