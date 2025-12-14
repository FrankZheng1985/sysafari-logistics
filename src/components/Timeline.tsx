import { ReactNode } from 'react'
import clsx from 'clsx'

export type TimelineColor = 'blue' | 'green' | 'red' | 'gray' | string

export interface TimelineItemProps {
  children: ReactNode
  color?: TimelineColor
  dot?: ReactNode
  label?: ReactNode
  pending?: boolean
  className?: string
}

export interface TimelineProps {
  children: ReactNode
  mode?: 'left' | 'right' | 'alternate'
  pending?: boolean | ReactNode
  reverse?: boolean
  className?: string
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500 border-blue-500',
  green: 'bg-green-500 border-green-500',
  red: 'bg-red-500 border-red-500',
  gray: 'bg-gray-500 border-gray-500',
}

export function TimelineItem({
  children,
  color = 'blue',
  dot,
  label,
  pending = false,
  className,
}: TimelineItemProps) {
  const dotColor = colorMap[color] || `bg-${color} border-${color}`

  return (
    <li className={clsx('relative pb-4 last:pb-0', className)}>
      {/* Timeline line */}
      <div
        className={clsx(
          'absolute left-1.5 top-3 bottom-0 w-0.5',
          pending ? 'bg-gray-200' : 'bg-gray-300'
        )}
      />

      {/* Timeline dot */}
      <div className="relative flex items-start gap-3">
        <div
          className={clsx(
            'relative z-10 w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0',
            dot
              ? 'bg-white border-gray-300'
              : clsx(
                  dotColor,
                  'border-current',
                  pending && 'bg-gray-200 border-gray-300'
                )
          )}
        >
          {dot}
        </div>

        {/* Content */}
        <div className="flex-1 pt-0.5">
          {label && (
            <div className="text-xs text-gray-500 mb-0.5">{label}</div>
          )}
          <div className="text-xs text-gray-900">{children}</div>
        </div>
      </div>
    </li>
  )
}

export default function Timeline({
  children,
  mode,
  pending,
  reverse = false,
  className,
}: TimelineProps) {
  const childrenArray = Array.isArray(children) ? children : [children]
  const items = reverse ? [...childrenArray].reverse() : childrenArray

  return (
    <ul
      className={clsx(
        'relative pl-0 list-none',
        mode === 'alternate' && 'space-y-4',
        className
      )}
    >
      {items.map((item: any, index) => {
        if (!item || typeof item !== 'object') return null

        const key = item.key || `timeline-item-${index}`
        const position =
          mode === 'alternate' ? (index % 2 === 0 ? 'left' : 'right') : undefined

        return (
          <div key={key} className={mode === 'alternate' ? 'flex' : ''}>
            {mode === 'alternate' && position === 'right' && (
              <div className="flex-1" />
            )}
            <div className={mode === 'alternate' ? 'flex-1' : ''}>
              {item}
            </div>
            {mode === 'alternate' && position === 'left' && (
              <div className="flex-1" />
            )}
          </div>
        )
      })}
      {pending && (
        <TimelineItem pending={true} color="gray">
          {typeof pending === 'boolean' ? '加载中...' : pending}
        </TimelineItem>
      )}
    </ul>
  )
}

