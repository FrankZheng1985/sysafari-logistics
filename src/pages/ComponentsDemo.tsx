import { useState } from 'react'
import { FileText, Calculator, Link, Image, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Collapse, { CollapsePanel } from '../components/Collapse'
import Timeline, { TimelineItem } from '../components/Timeline'

export default function ComponentsDemo() {
  const [activeKey, setActiveKey] = useState<string | string[]>(['1'])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="组件示例"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '组件示例' }
        ]}
      />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Collapse Example */}
        <div>
          <h2 className="text-xs font-semibold text-gray-900 mb-2">折叠面板 (Collapse)</h2>
          <Collapse
            activeKey={activeKey}
            onChange={setActiveKey}
            accordion={false}
          >
            <CollapsePanel
              key="1"
              header="这是第一个面板"
              extra={<span className="text-xs text-gray-500">额外信息</span>}
            >
              <div className="text-xs text-gray-700">
                <p>这是第一个面板的内容。可以包含任何内容，包括文本、图片、表格等。</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>列表项 1</li>
                  <li>列表项 2</li>
                  <li>列表项 3</li>
                </ul>
              </div>
            </CollapsePanel>
            <CollapsePanel key="2" header="这是第二个面板">
              <div className="text-xs text-gray-700">
                <p>这是第二个面板的内容。</p>
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs">可以嵌套其他组件</p>
                </div>
              </div>
            </CollapsePanel>
            <CollapsePanel key="3" header="这是第三个面板（禁用）" disabled>
              <div className="text-xs text-gray-700">这个面板被禁用了</div>
            </CollapsePanel>
          </Collapse>
        </div>

        {/* Accordion Example */}
        <div>
          <h2 className="text-xs font-semibold text-gray-900 mb-2">手风琴模式 (Accordion)</h2>
          <Collapse accordion={true} defaultActiveKey="1">
            <CollapsePanel key="1" header="手风琴面板 1">
              <div className="text-xs text-gray-700">
                在手风琴模式下，同时只能展开一个面板。
              </div>
            </CollapsePanel>
            <CollapsePanel key="2" header="手风琴面板 2">
              <div className="text-xs text-gray-700">
                展开这个面板时，其他面板会自动收起。
              </div>
            </CollapsePanel>
            <CollapsePanel key="3" header="手风琴面板 3">
              <div className="text-xs text-gray-700">
                这是第三个手风琴面板。
              </div>
            </CollapsePanel>
          </Collapse>
        </div>

        {/* Timeline Example */}
        <div>
          <h2 className="text-xs font-semibold text-gray-900 mb-2">时间线 (Timeline)</h2>
          <Timeline>
            <TimelineItem
              color="blue"
              label="2024-01-15 10:00"
            >
              <div className="text-xs font-medium">订单已创建</div>
              <div className="text-xs text-gray-500 mt-1">
                订单号: ORD-2024-001
              </div>
            </TimelineItem>
            <TimelineItem
              color="green"
              label="2024-01-15 14:30"
            >
              <div className="text-xs font-medium">订单已确认</div>
              <div className="text-xs text-gray-500 mt-1">
                客户已确认订单信息
              </div>
            </TimelineItem>
            <TimelineItem
              color="blue"
              label="2024-01-16 09:00"
            >
              <div className="text-xs font-medium">开始处理</div>
              <div className="text-xs text-gray-500 mt-1">
                仓库开始准备货物
              </div>
            </TimelineItem>
            <TimelineItem
              color="green"
              label="2024-01-16 16:00"
            >
              <div className="text-xs font-medium">已发货</div>
              <div className="text-xs text-gray-500 mt-1">
                物流单号: LOG-2024-001
              </div>
            </TimelineItem>
            <TimelineItem
              color="gray"
              pending={true}
            >
              <div className="text-xs font-medium">运输中</div>
              <div className="text-xs text-gray-500 mt-1">
                预计到达时间: 2024-01-18
              </div>
            </TimelineItem>
          </Timeline>
        </div>

        {/* Timeline with Custom Dot */}
        <div>
          <h2 className="text-xs font-semibold text-gray-900 mb-2">自定义时间线</h2>
          <Timeline>
            <TimelineItem
              color="blue"
              dot={<Calculator className="w-3 h-3 text-blue-600" />}
              label="2024-01-15"
            >
              <div className="text-xs font-medium">计算完成</div>
              <div className="text-xs text-gray-500 mt-1">
                费用计算已完成
              </div>
            </TimelineItem>
            <TimelineItem
              color="green"
              dot={<Link className="w-3 h-3 text-green-600" />}
              label="2024-01-16"
            >
              <div className="text-xs font-medium">链接已生成</div>
              <div className="text-xs text-gray-500 mt-1">
                跟踪链接已创建
              </div>
            </TimelineItem>
            <TimelineItem
              color="red"
              dot={<Image className="w-3 h-3 text-red-600" />}
              label="2024-01-17"
            >
              <div className="text-xs font-medium">图片已上传</div>
              <div className="text-xs text-gray-500 mt-1">
                相关图片已上传到系统
              </div>
            </TimelineItem>
            <TimelineItem
              color="gray"
              dot={<AlertTriangle className="w-3 h-3 text-yellow-600" />}
              label="2024-01-18"
            >
              <div className="text-xs font-medium">警告信息</div>
              <div className="text-xs text-gray-500 mt-1">
                请注意检查货物状态
              </div>
            </TimelineItem>
          </Timeline>
        </div>

        {/* Timeline Alternate Mode */}
        <div>
          <h2 className="text-xs font-semibold text-gray-900 mb-2">交替模式时间线</h2>
          <Timeline mode="alternate">
            <TimelineItem color="blue" label="2024-01-15">
              <div className="text-xs font-medium">开始</div>
              <div className="text-xs text-gray-500 mt-1">项目启动</div>
            </TimelineItem>
            <TimelineItem color="green" label="2024-01-16">
              <div className="text-xs font-medium">进行中</div>
              <div className="text-xs text-gray-500 mt-1">项目进行中</div>
            </TimelineItem>
            <TimelineItem color="blue" label="2024-01-17">
              <div className="text-xs font-medium">检查</div>
              <div className="text-xs text-gray-500 mt-1">质量检查</div>
            </TimelineItem>
            <TimelineItem color="green" label="2024-01-18">
              <div className="text-xs font-medium">完成</div>
              <div className="text-xs text-gray-500 mt-1">项目完成</div>
            </TimelineItem>
          </Timeline>
        </div>
      </div>
    </div>
  )
}

