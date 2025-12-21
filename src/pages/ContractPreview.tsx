/**
 * 合同预览/打印页面
 * 按照原合同样式渲染，支持打印
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download, FileText, Send, CheckCircle } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Contract {
  id: number
  contract_no: string
  customer_id: number
  customer_name: string
  customer_company: string
  payment_days: number
  late_fee_rate: number
  max_overdue_days: number
  clearance_days: number
  compensation_snapshot: any[]
  insurance_snapshot: any[]
  peak_seasons_snapshot: any[]
  disclaimer_clauses: string[]
  status: string
  created_at: string
  pdf_path: string
}

interface TemplateConfig {
  [key: string]: {
    value: any
    type: string
    description: string
  }
}

export default function ContractPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<Contract | null>(null)
  const [config, setConfig] = useState<TemplateConfig>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadContract()
      loadConfig()
    }
  }, [id])

  const loadContract = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${id}`)
      const data = await res.json()
      if (data.success) {
        setContract(data.data)
      }
    } catch (error) {
      console.error('加载合同失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/config`)
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!contract) return
    
    // 先生成PDF
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${contract.id}/pdf`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        // 下载PDF
        window.open(`${API_BASE}/api/contract-template/contracts/${contract.id}/pdf`, '_blank')
      } else {
        alert('生成PDF失败: ' + data.message)
      }
    } catch (error) {
      console.error('生成PDF失败:', error)
      alert('生成PDF失败')
    }
  }

  const handleSubmit = async () => {
    if (!contract || contract.status !== 'draft') return
    if (!confirm('确定要提交该合同进行审批吗？')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/contract-template/contracts/${contract.id}/submit`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.success) {
        alert('合同已提交审批')
        loadContract()
      } else {
        alert('提交失败: ' + data.message)
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">合同不存在</p>
        <button
          onClick={() => navigate('/contracts')}
          className="mt-4 text-primary-600 hover:underline"
        >
          返回列表
        </button>
      </div>
    )
  }

  const compensationRules = contract.compensation_snapshot || []
  const insuranceConfig = contract.insurance_snapshot || []
  const peakSeasons = contract.peak_seasons_snapshot || []
  const disclaimerClauses = contract.disclaimer_clauses || []

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 工具栏 - 打印时隐藏 */}
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/contracts')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-sm rounded-full ${
              contract.status === 'draft' ? 'bg-gray-100 text-gray-800' :
              contract.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              contract.status === 'approved' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {contract.status === 'draft' ? '草稿' :
               contract.status === 'pending' ? '待审批' :
               contract.status === 'approved' ? '已生效' : '已驳回'}
            </span>
            {contract.status === 'draft' && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                <Send className="w-4 h-4" />
                提交审批
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Printer className="w-4 h-4" />
              打印
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Download className="w-4 h-4" />
              导出PDF
            </button>
          </div>
        </div>
      </div>

      {/* 合同内容 */}
      <div className="max-w-4xl mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none">
        <div className="bg-white shadow-lg print:shadow-none">
          {/* 第一页 */}
          <div className="p-12 print:p-8 contract-page">
            {/* 页眉 */}
            <div className="text-right text-sm text-gray-500 mb-8">
              合同编号：{contract.contract_no}
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-bold text-center mb-2">先锋国际物流有限公司</h1>
            <h2 className="text-xl font-bold text-center mb-8">清关合同</h2>

            {/* 甲乙方 */}
            <div className="mb-6 text-base">
              <p className="mb-2"><strong>甲方：</strong>{contract.customer_company || contract.customer_name}</p>
              <p><strong>乙方：</strong>{config.company_name_cn?.value || '先锋国际物流有限公司'}</p>
            </div>

            <p className="mb-6">双方经友好协商，就甲方委托乙方货物运输代理事宜，达成如下协议：</p>

            {/* 一、目的地 */}
            <h3 className="font-bold mb-2">一、目的地：</h3>
            <p className="mb-2 ml-4">甲方交运的货物清关目的地在欧洲港口</p>
            
            <p className="mb-2"><strong>支付方式：</strong></p>
            <ol className="list-decimal ml-8 mb-4 space-y-2">
              <li>整箱：货到后 <span className="font-medium text-primary-600">{contract.payment_days}</span> 天内付款；若无后续货柜，则付款送货。付款条例：国内收款直接以银行转账打款方式收取人民币运费；国内收款以甲方货柜清关日中国银行欧元汇率牌价（现汇与现钞中间价）折算人民币支付运费。</li>
              <li>超期：货柜按甲乙双方约定正常到达甲方指定仓库起，甲方如果没有按时付清所有费用，乙方有权收取甲方超期运费 <span className="font-medium text-primary-600">{contract.late_fee_rate}%/天</span> 违约金，超过约定时间 <span className="font-medium text-primary-600">{contract.max_overdue_days}</span> 天不付运费，乙方有权滞留或扣押甲方委托乙方的货物，直至结清所有的费用，由此产生的一切责任和费用由甲方承担。</li>
            </ol>

            {/* 二、权利与义务 */}
            <h3 className="font-bold mb-2">二、权利与义务</h3>
            <p className="mb-2 ml-4"><strong>1. 甲方的权利与义务</strong></p>
            <ul className="ml-8 mb-4 space-y-1 text-sm">
              <li>(1) 甲方提供欧盟收货人公司需要满足如下要求</li>
              <li>(2) 甲方必须提供在目的地所在国家注册的真实有效且拥有欧盟税号的公司作为运输货物的收货人，并需要保证该收货人公司不被列入政府部门的黑名单。</li>
              <li>(3) 如发生政府部门对货物进行路检、交通事故、盗窃等情况时，甲方应保证收货人可以接受被查货物的销售发票，不得以任何理由拒绝。</li>
              <li>(4) 如政府部门扣留被查货物，甲方应保证收货人公司可以出具律师委托函，以便办理相关提货手续或者法律诉讼手续。</li>
            </ul>

            <p className="mb-2 ml-4"><strong>2. 甲方委托运输货物必须满足要求</strong></p>
            <ul className="ml-8 mb-4 space-y-1 text-sm">
              <li>(1) 甲方应自行保证货物在知识产权方面（包含商标和产品专利等）符合欧盟进口的各项要求。</li>
              <li>(2) 甲方不得发运烟、酒、毒品等违法及限制类产品。</li>
              <li>(3) 甲方应保证货物的成份标签必须和实际货物相符。</li>
              <li>(4) 甲方应保证货物质量符合欧盟的进口标准。</li>
              <li>(5) 甲方应保证货物上没有价格标签。</li>
              <li>(6) 甲方应保证货物的产地标签必须和实际产地相符。</li>
              <li>(7) 甲方货物包装须符合进出口货物包装要求。</li>
              <li>(8) 甲方应提前通知乙方相关货物委托运输事宜。</li>
              <li>(9) 甲方应根据乙方的要求及时、准确地向乙方提供货物真实资料信息。</li>
              <li>(10) 针对海运业务，若甲方自行装柜的，甲方必须在集装箱到港前至少10天将正本提单、货物清单及甲方仓库地址等寄到乙方。</li>
              <li>(11) 针对铁路业务，若甲方自行装柜的，甲方必须在集装箱到港前至少10天将随车资料、货物清单等给到乙方。</li>
            </ul>

            <p className="mb-2 ml-4"><strong>3. 乙方的权利和义务</strong></p>
            <ul className="ml-8 mb-4 space-y-1 text-sm">
              <li>(1) 乙方在接到甲方委托后应积极、谨慎、安全地办理甲方所要求的相应业务。</li>
              <li>(2) 乙方应及时向甲方通报委托货物的运输情况。</li>
              <li>(3) 乙方应及时向甲方提供相关运输费用结算单据。</li>
            </ul>
          </div>

          {/* 第二页 - 赔偿标准 */}
          <div className="p-12 print:p-8 contract-page border-t print:border-t-0 print:break-before-page">
            <h3 className="font-bold mb-2">三、赔偿标准：</h3>
            <p className="mb-4 text-sm">甲方委托乙方在目的港清关的货物出现货损、货差、灭失等情况，本着长期合作、平等互利的原则，乙方愿与甲方分担损失。</p>

            <p className="mb-2 ml-4"><strong>1. 赔偿：</strong></p>
            <p className="ml-8 mb-2 text-sm">(1) 整柜赔偿最高不超过以下限定金额：</p>
            
            {/* 赔偿标准表格 */}
            <table className="ml-8 mb-4 border-collapse border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-4 py-2 text-left">货物类型</th>
                  <th className="border px-4 py-2 text-right">最高赔偿（€）</th>
                </tr>
              </thead>
              <tbody>
                {compensationRules.length > 0 ? compensationRules.map((rule: any, index: number) => (
                  <tr key={index}>
                    <td className="border px-4 py-2">{rule.category_name}</td>
                    <td className="border px-4 py-2 text-right font-medium">€{Number(rule.max_compensation).toLocaleString()}</td>
                  </tr>
                )) : (
                  <>
                    <tr><td className="border px-4 py-2">超大件</td><td className="border px-4 py-2 text-right">€30,000</td></tr>
                    <tr><td className="border px-4 py-2">百货</td><td className="border px-4 py-2 text-right">€30,000</td></tr>
                    <tr><td className="border px-4 py-2">服装</td><td className="border px-4 py-2 text-right">€80,000</td></tr>
                    <tr><td className="border px-4 py-2">鞋子</td><td className="border px-4 py-2 text-right">€60,000</td></tr>
                  </>
                )}
              </tbody>
            </table>

            <p className="ml-8 mb-2 text-sm">另外电子产品/电动自行车滑板车/电池如因质量问题导致货柜自燃，所有的损失由甲方承担。</p>

            <p className="ml-8 mb-1 text-sm">(2) 赔偿原则：</p>
            <ul className="ml-12 mb-4 space-y-1 text-sm">
              <li>① 货物实际货值低于最高赔偿金额，按照实际金额索赔</li>
              <li>② 货物实际货值高于最高赔偿金额，按照最高限定金额赔偿</li>
              <li>③ 客户在下单业务指令时，需预报告知货物实际价值</li>
            </ul>

            <p className="ml-8 mb-1 text-sm">(3) 零散货物灭失，规定赔偿总额÷总立方数×缺失货物立方数</p>
            <p className="ml-8 mb-1 text-sm">(4) 易损易碎物品损坏我司概不负责。</p>
            <p className="ml-8 mb-4 text-sm">(5) 若出现包装箱内少条数情况，乙方不承担货物灭失赔偿责任。</p>

            {/* 四、保险 */}
            <h3 className="font-bold mb-2">四、保险：</h3>
            <p className="ml-4 mb-2 text-sm">
              1. 甲方认为真实货值超过赔偿额，需要对货柜进行额外投保，按每10000.00欧元的货值，增收
              <span className="font-medium text-primary-600">{config.insurance_premium_per_10k?.value || 500}</span>欧元作为保险费。
            </p>
            {insuranceConfig.length > 0 && (
              <p className="ml-4 mb-4 text-sm">
                （封顶保额：{insuranceConfig.map((i: any) => `${i.category_name}€${Number(i.insured_cap).toLocaleString()}`).join('，')}）
              </p>
            )}
            <p className="ml-4 mb-4 text-sm">保险金必须在货物开航日之前付清，方能生效。补偿给甲方。</p>

            {/* 五、补充 */}
            <h3 className="font-bold mb-2">五、补充：</h3>
            <p className="ml-4 mb-4 text-sm">若甲方提供的货物违反目的国的法律规定或与货物清单不符或产品质量问题或清关中产品被估价，导致有关部门罚款、扣押、没收以及产生其他费用，由甲方自行承担。甲方仍需承担乙方的相关费用。</p>

            {/* 六、延误标准 */}
            <h3 className="font-bold mb-2">六、延误标准</h3>
            <p className="ml-4 mb-2 text-sm">
              1. 从到港卸柜日起至货物清关完成为止，乙方承诺的正常时间为 
              <span className="font-medium text-primary-600">{contract.clearance_days}</span> 个工作日。（国内外重大节假日期除外）
            </p>
            <p className="ml-4 mb-2 text-sm">2. 接货时先检查封条是否和我司提供一致，如果没有封条或者数据跟我司提供不一致，请先别卸货，等我司调查清楚再卸。</p>
            <p className="ml-4 mb-2 text-sm">3. 海运高峰期免责时段：</p>
            {peakSeasons.length > 0 ? (
              <ul className="ml-8 mb-4 text-sm">
                {peakSeasons.map((season: any, index: number) => (
                  <li key={index}>
                    {season.start_month}月{season.start_day}号到{season.end_month}月{season.end_day}号期间：{season.notes || '因国外司机放假等原因造成柜子无法正常送货，这期间到港的柜子乙方不承担晚送赔偿。'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ml-8 mb-4 text-sm">8月15号到9月15号和12月15号到1月15号到港期间，这两个周期内到港的柜子，因国外司机放假等原因造成柜子无法正常送货，这期间到港的柜子乙方不承担晚送赔偿。</p>
            )}
          </div>

          {/* 第三页 - 免责条款和签章 */}
          <div className="p-12 print:p-8 contract-page border-t print:border-t-0 print:break-before-page">
            {/* 七、免责条款 */}
            <h3 className="font-bold mb-2">七、免责条款</h3>
            <ol className="ml-4 mb-6 space-y-2 text-sm list-decimal">
              {disclaimerClauses.length > 0 ? disclaimerClauses.map((clause: string, index: number) => (
                <li key={index}>{clause}</li>
              )) : (
                <>
                  <li>若出现自然灾害、战争、工人罢工（包括港口、机场、铁路货站等）等不可抗力因素导致货物灭失或者运输延误的，乙方不承担货物灭失的赔偿责任及延误的赔偿责任。</li>
                  <li>如货物在国际段运输中发生灭失的，乙方不承担货物灭失的赔偿责任。乙方有义务代甲方为向承运人申请索赔，但不对申请结果负责。</li>
                  <li>若因货物的知识产权原因被欧盟政府的执法部门查扣，由此引起的一切责任、费用与风险由甲方承担。</li>
                  <li>若因货物不符合欧盟要求等因素导致货物被扣留或者灭失的，货代不承担货物灭失的赔偿责任。</li>
                  <li>如因甲方提供的货物单据和实际货物情况不符而引起执法部门查扣，货代不承担货物灭失的赔偿责任及延误的赔偿责任。</li>
                  <li>若因甲方提供的收货人公司不能接受销售发票、不能办理律师委托函或被政府列入黑名单，货代不承担货物灭失和运输延误的赔偿责任。</li>
                  <li>如果甲方当期运费没有按照双方约定时间支付，则该时间段货代发生到货延误也将免于赔偿。</li>
                </>
              )}
            </ol>

            {/* 八、保密条款与争议处理 */}
            <h3 className="font-bold mb-2">八、保密条款与争议处理</h3>
            <ol className="ml-4 mb-6 space-y-2 text-sm list-decimal">
              <li>甲、乙双方非经过对方同意，不得以任何方式将双方合作的情况告之其他一方，否则任何一方有权单方面提前解除本协议，违约方应赔偿对方相应损失。</li>
              <li>双方同意适用中华人民共和国法律解决双方争议。本协议在履行中发生争议，应由双方协商解决，若协商不成，任何一方有权向仲裁委员会申请仲裁。</li>
            </ol>

            {/* 九、协议生效与终止 */}
            <h3 className="font-bold mb-2">九、协议生效与终止</h3>
            <ol className="ml-4 mb-6 space-y-2 text-sm list-decimal">
              <li>本协议壹式贰份，双方各执壹份，具有同等法律效力</li>
              <li>本合同自双方签署之日起生效，有效期一年。协议有效期满后，如果甲乙双方均未提出异议，则本协议自动顺延，每次续展一年，以此类推。</li>
              <li>在合同执行期间，任何一方如提出修改或终止本合同，应提前 {config.delay_notice_days?.value || 30} 日以书面形式通知对方。</li>
              <li>合同的提前终止，不影响双方于合同终止前已产生的权利和义务。</li>
              <li>本合同未尽事宜，由双方协商一致签订书面补充协议，补充协议与本合同具有同等效力。</li>
            </ol>

            {/* 十、其他补充条款 */}
            <h3 className="font-bold mb-4">十、其他补充条款</h3>

            {/* 付款账户 */}
            <div className="mb-8 text-sm">
              <p className="font-medium mb-2">付款账户：</p>
              <p>Account Holder's Name: {config.bank_account_name?.value || 'Xianfeng International Logistics'}</p>
              <p>Account Number: {config.bank_account_number?.value || '015-150-68-100225'}</p>
              <p>Bank's Name: {config.bank_name?.value || 'The Bank of East Asia, Limited'}</p>
              <p>Bank's Address: {config.bank_address?.value || '10 Des Voeux Road, Central, Hong Kong'}</p>
              <p>SWIFT Code: {config.swift_code?.value || 'BEASHKHH'}</p>
              <p>Clearing No.: {config.clearing_no?.value || '015'} (for local interbank transfers)</p>
            </div>

            {/* 签章区域 */}
            <div className="grid grid-cols-2 gap-8 mt-16">
              <div>
                <p className="mb-8">甲方：</p>
                <p className="mb-8">经办人：（签字盖章）</p>
                <p>时间：</p>
              </div>
              <div>
                <p className="mb-8">乙方：</p>
                <p className="mb-8">经办人：（签字盖章）</p>
                <p>时间：</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 打印样式 */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .contract-page {
            page-break-after: always;
          }
          .contract-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}
