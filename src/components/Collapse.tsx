import { ReactNode, useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export interface CollapsePanelProps {
  key: string
  header: ReactNode
  children: ReactNode
  disabled?: boolean
  showArrow?: boolean
  extra?: ReactNode
  className?: string
}

export interface CollapseProps {
  children: ReactNode
  activeKey?: string | string[]
  defaultActiveKey?: string | string[]
  onChange?: (keys: string | string[]) => void
  accordion?: boolean
  bordered?: boolean
  className?: string
}

// CollapsePanel is used as a child component, not rendered directly
export function CollapsePanel(_props: CollapsePanelProps) {
  return null
}

export default function Collapse({
  children,
  activeKey,
  defaultActiveKey,
  onChange,
  accordion = false,
  bordered = true,
  className,
}: CollapseProps) {
  const [internalActiveKeys, setInternalActiveKeys] = useState<string[]>(() => {
    const initial = activeKey !== undefined ? activeKey : defaultActiveKey
    if (initial === undefined) return []
    return Array.isArray(initial) ? initial : [initial]
  })

  const activeKeys = activeKey !== undefined
    ? (Array.isArray(activeKey) ? activeKey : [activeKey])
    : internalActiveKeys

  const handleToggle = (key: string) => {
    const keyStr = String(key)
    if (accordion) {
      const newKeys = activeKeys.includes(keyStr) ? [] : [keyStr]
      setInternalActiveKeys(newKeys)
      onChange?.(newKeys.length > 0 ? newKeys[0] : '')
    } else {
      const newKeys = activeKeys.includes(keyStr)
        ? activeKeys.filter((k) => k !== keyStr)
        : [...activeKeys, keyStr]
      setInternalActiveKeys(newKeys)
      onChange?.(newKeys)
    }
  }

  const panels = useMemo(() => {
    const childrenArray = Array.isArray(children) ? children : [children]
    return childrenArray
      .filter((child) => child && typeof child === 'object' && 'props' in child)
      .map((child: any, index: number) => {
        // Get key from child.key (React key) or props.key
        const key = child.key || child.props?.key || `panel-${index}`
        const isActive = activeKeys.includes(String(key))
        const {
          header,
          children: panelChildren,
          disabled = false,
          showArrow = true,
          extra,
          className: panelClassName,
        } = child.props || {}

        return (
          <div
            key={key}
            className={clsx(
              'border-b border-gray-200 last:border-b-0 transition-colors',
              isActive && 'bg-gray-50',
              disabled && 'opacity-50 cursor-not-allowed',
              panelClassName
            )}
          >
            <div
              onClick={() => !disabled && handleToggle(key)}
              className={clsx(
                'flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                disabled && 'cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2 flex-1">
                {showArrow !== false && (
                  <ChevronDown
                    className={clsx(
                      'w-4 h-4 text-gray-500 transition-transform duration-200',
                      isActive && 'transform rotate-180'
                    )}
                  />
                )}
                <div className="flex-1 font-medium text-gray-900">{header}</div>
              </div>
              {extra && <div className="ml-4">{extra}</div>}
            </div>
            {isActive && (
              <div className="px-4 pb-4 text-gray-700 animate-in fade-in duration-200">
                {panelChildren}
              </div>
            )}
          </div>
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, activeKeys, accordion])

  return (
    <div
      className={clsx(
        'bg-white rounded-lg overflow-hidden',
        bordered && 'border border-gray-200',
        className
      )}
    >
      {panels}
    </div>
  )
}

