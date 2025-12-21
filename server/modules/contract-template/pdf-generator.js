/**
 * 清关合同 PDF 生成器
 * 使用 pdfkit 生成带中文支持的PDF合同
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as model from './model.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// PDF存储目录
const PDF_DIR = path.join(__dirname, '../../uploads/contracts')

// 确保目录存在
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true })
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 格式化金额
 */
function formatMoney(amount, currency = '€') {
  if (!amount) return `${currency}0`
  return `${currency}${Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
}

/**
 * 生成合同PDF
 */
export async function generateContractPdf(req, res) {
  try {
    const { id } = req.params
    
    // 获取合同详情
    const contract = await model.getContract(id)
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    // 获取模板配置
    const config = await model.getTemplateConfig()
    
    // 解析JSON字段
    let compensationRules = []
    let insuranceConfig = []
    let peakSeasons = []
    let disclaimerClauses = []
    
    try {
      compensationRules = contract.compensation_snapshot ? JSON.parse(contract.compensation_snapshot) : []
      insuranceConfig = contract.insurance_snapshot ? JSON.parse(contract.insurance_snapshot) : []
      peakSeasons = contract.peak_seasons_snapshot ? JSON.parse(contract.peak_seasons_snapshot) : []
      disclaimerClauses = contract.disclaimer_clauses ? JSON.parse(contract.disclaimer_clauses) : []
    } catch (e) {
      console.error('解析合同配置失败:', e)
    }
    
    // 生成PDF文件名
    const filename = `${contract.contract_no}.pdf`
    const filepath = path.join(PDF_DIR, filename)
    
    // 创建PDF文档
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `清关合同 - ${contract.contract_no}`,
        Author: 'Xianfeng International Logistics Limited',
        Subject: '清关服务合同'
      }
    })
    
    // 写入文件流
    const stream = fs.createWriteStream(filepath)
    doc.pipe(stream)
    
    // 页码变量
    let pageNumber = 1
    const totalPages = 5
    
    // 添加页眉页脚的函数
    const addHeaderFooter = () => {
      // 页眉 - 合同编号
      doc.fontSize(10)
        .text(`合同编号：${contract.contract_no}`, doc.page.margins.left, 30, { align: 'right' })
      
      // 页脚 - 页码
      doc.fontSize(10)
        .text(`第 ${pageNumber} 页 共 ${totalPages} 页`, 0, doc.page.height - 40, { align: 'center' })
    }
    
    // 注册字体（如果有中文字体文件）
    // 注意：实际部署时需要添加中文字体文件
    // doc.registerFont('SimSun', 'path/to/simsun.ttf')
    
    // =====================================================
    // 第一页 - 合同标题和基本条款
    // =====================================================
    addHeaderFooter()
    
    // 公司名称标题
    doc.fontSize(22)
      .text('先锋国际物流有限公司', { align: 'center' })
      .moveDown(0.5)
    
    doc.fontSize(20)
      .text('清关合同', { align: 'center' })
      .moveDown(1.5)
    
    // 甲乙方信息
    doc.fontSize(12)
      .text(`甲方：${contract.customer_company || contract.customer_name}`)
      .moveDown(0.5)
      .text(`乙方：${config.company_name_cn?.value || '先锋国际物流有限公司'}`)
      .moveDown(1)
    
    doc.text('双方经友好协商，就甲方委托乙方货物运输代理事宜，达成如下协议：')
      .moveDown(1)
    
    // 一、目的地
    doc.fontSize(12)
      .text('一、目的地：', { continued: false })
      .moveDown(0.3)
      .text('    甲方交运的货物清关目的地在欧洲港口')
      .moveDown(0.5)
    
    // 支付方式
    doc.text('支付方式：')
      .moveDown(0.3)
      .text(`1. 整箱：货到后 ${contract.payment_days || 7} 天内付款；若无后续货柜，则付款送货。付款条例：国内收款直接以银行转账打款方式收取人民币运费；国内收款以甲方货柜清关日中国银行欧元汇率牌价（现汇与现钞中间价）折算人民币支付运费。`)
      .moveDown(0.3)
      .text(`2. 超期：货柜按甲乙双方约定正常到达甲方指定仓库起，甲方如果没有按时付清所有费用，乙方有权收取甲方超期运费 ${contract.late_fee_rate || 0.2}%/天 违约金，超过约定时间 ${contract.max_overdue_days || 15} 天不付运费，乙方有权滞留或扣押甲方委托乙方的货物，直至结清所有的费用，由此产生的一切责任和费用由甲方承担。`)
      .moveDown(1)
    
    // 二、权利与义务
    doc.fontSize(12)
      .text('二、权利与义务')
      .moveDown(0.5)
    
    doc.text('1. 甲方的权利与义务')
      .moveDown(0.3)
      .text('   (1) 甲方提供欧盟收货人公司需要满足如下要求')
      .text('   (2) 甲方必须提供在目的地所在国家注册的真实有效且拥有欧盟税号的公司作为运输货物的收货人，并需要保证该收货人公司不被列入政府部门的黑名单。若在运输过程中，被查到收货公司信息不真实或被列入政府部门的黑名单的，由此引起的被扣货以及罚款等责任乙方不予承担。')
      .text('   (3) 如发生政府部门对货物进行路检、交通事故、盗窃等情况时，甲方应保证收货人可以接受被查货物的销售发票，不得以任何理由拒绝。')
      .text('   (4) 如政府部门扣留被查货物，甲方应保证收货人公司可以出具律师委托函，以便办理相关提货手续或者法律诉讼手续。')
      .moveDown(0.5)
    
    // 新页
    doc.addPage()
    pageNumber++
    addHeaderFooter()
    
    // =====================================================
    // 第二页 - 甲方义务续
    // =====================================================
    doc.fontSize(12)
      .text('2. 甲方委托运输货物必须满足要求')
      .moveDown(0.3)
      .text('   (1) 甲方应自行保证货物在知识产权方面（包含商标和产品专利等）符合欧盟进口的各项要求，乙方对运输货物无知识产权审查的能力和责任，由此导致海关罚款、扣押、没收货物等一切风险和责任均由甲方自行承担。货物是否存在知识产权问题，以欧盟政府的最终认定为准。')
      .text('   (2) 甲方不得发运烟、酒、毒品等违法及限制类产品。由此导致海关罚款、货物扣押、没收等一切风险和责任由甲方自行承担。')
      .text('   (3) 甲方应保证货物的成份标签必须和实际货物相符。')
      .text('   (4) 甲方应保证货物质量符合欧盟的进口标准。')
      .text('   (5) 甲方应保证货物上没有价格标签。')
      .text('   (6) 甲方应保证货物的产地标签必须和实际产地相符。')
      .text('   (7) 甲方货物包装须符合进出口货物包装要求，否则乙方有权拒绝接受货物运输。')
      .text('   (8) 甲方应提前通知乙方相关货物委托运输事宜，以便乙方做好相应的安排。')
      .text('   (9) 甲方应根据乙方的要求及时、准确地向乙方提供货物真实资料信息，包括但不限于品名、数量、图片或样品等。如果是海运集装箱的实际箱数与提单箱数不符，甲方必须明确标示。如乙方在报关过程中发现实际箱数与提单、货物清单不符的，由此导致的海关罚款、货物扣押、没收等一切风险和责任均由甲方自行承担。')
      .text('   (10) 针对海运业务，若甲方自行装柜的，甲方必须在集装箱到港前至少10天将正本提单、物清单及甲方仓库地址和欧洲收货人公司、联系方式等寄到乙方；若因提单需电放，也必须货柜到达前3天电放给乙方，但货物其他资料必需在到港前至少10天给予乙方，以便乙方安排及时清关。空运和拼箱在货物进仓当日提供。若甲方不能及时将清关文件交至乙方，则由此产生的滞港、滞箱费用由甲方自行承担；若甲方不能及时将清关文件交至乙方，从而乙方送柜延迟的，乙方不承担相应天数的延误赔偿责任。')
      .text('   (11) 针对铁路业务，若甲方自行装柜的，甲方必须在集装箱到港前至少10天将随车资料、货物清单及甲方仓库地址和欧洲收货人公司、联系方式等给到乙方，到站前三天甲方需要提前通知乙方，到站当天需要提供dsk及其他提柜相关信息给到乙方，以便乙方安排及时清关。若甲方不能及时将清关文件交至乙方，则由此产生的滞港、滞箱费用由甲方自行承担；若甲方不能及时将清关文件交至乙方，从而乙方送柜延迟的，乙方不承担相应天数的延误赔偿责任。')
      .moveDown(0.5)
    
    doc.text('3. 乙方的权利和义务')
      .moveDown(0.3)
      .text('   (1) 乙方在接到甲方委托后应积极、谨慎、安全地办理甲方所要求的相应业务。若因故未能达到甲方办理要求的，乙方应及时通知甲方有关情况。')
      .text('   (2) 乙方应及时向甲方通报委托货物的运输情况，并接受甲方的查询和跟踪要求。')
      .text('   (3) 乙方应及时向甲方提供相关运输费用结算单据，以便甲方了解相关费用产生情况。')
      .moveDown(1)
    
    // 新页
    doc.addPage()
    pageNumber++
    addHeaderFooter()
    
    // =====================================================
    // 第三页 - 赔偿标准
    // =====================================================
    doc.fontSize(12)
      .text('三、赔偿标准：')
      .moveDown(0.3)
      .text('甲方委托乙方在目的港清关的货物出现货损、货差、灭失等情况，本着长期合作、平等互利的原则，乙方愿与甲方分担损失。')
      .moveDown(0.5)
    
    doc.text('1. 赔偿：')
      .moveDown(0.3)
      .text('   (1) 整柜赔偿最高不超过以下限定金额：超大件/百货/服装/鞋子/：40GP、40HQ、45HC、45HQ等箱型，按照：')
    
    // 赔偿标准表格
    if (compensationRules && compensationRules.length > 0) {
      for (const rule of compensationRules) {
        doc.text(`       ${rule.category_name}：${formatMoney(rule.max_compensation)}`)
      }
    } else {
      doc.text('       超大件：€30,000')
        .text('       百货：€30,000')
        .text('       服装：€80,000')
        .text('       鞋子：€60,000')
    }
    doc.text('       另外电子产品/电动自行车滑板车/电池如因质量问题导致货柜自燃，所有的损失由甲方承担。')
      .moveDown(0.3)
    
    doc.text('   (2) 赔偿原则：')
      .text('       ① 货物实际货值低于最高赔偿金额，按照实际金额索赔')
      .text('       ② 货物实际货值高于最高赔偿金额，按照最高限定金额赔偿')
      .text('       ③ 客户在下单业务指令时，需预报告知货物实际价值')
      .moveDown(0.3)
    
    doc.text('   (3) 零散货物灭失，规定赔偿总额÷总立方数×缺失货物立方数')
      .text('   (4) 易损易碎物品损坏我司概不负责。')
      .text('   (5) 若出现包装箱内少条数情况，乙方不承担货物灭失赔偿责任。')
      .moveDown(1)
    
    // 四、保险
    doc.text('四、保险：')
      .moveDown(0.3)
      .text(`1. 甲方认为真实货值超过赔偿额，需要对货柜进行额外投保，按每10000.00欧元的货值，增收${formatMoney(config.insurance_premium_per_10k?.value || 500)}欧元作为保险费。`)
    
    // 保险封顶说明
    doc.text('   （封顶保额：')
    if (insuranceConfig && insuranceConfig.length > 0) {
      const insuranceText = insuranceConfig.map(i => `${i.category_name}${formatMoney(i.insured_cap)}`).join('，')
      doc.text(`   ${insuranceText}）`)
    } else {
      doc.text('   超大件50000欧元，百货50000欧元，服装100000欧元，鞋子80000欧元）')
    }
    doc.text('   保险金必须在货物开航日之前付清，方能生效。补偿给甲方。')
      .moveDown(1)
    
    // 五、补充
    doc.text('五、补充：')
      .moveDown(0.3)
      .text('若甲方提供的货物违反目的国的法律规定或与货物清单不符或产品质量问题或清关中产品被估价，导致有关部门罚款、扣押、没收以及产生其他费用，由甲方自行承担。甲方仍需承担乙方的相关费用。')
      .moveDown(1)
    
    // 新页
    doc.addPage()
    pageNumber++
    addHeaderFooter()
    
    // =====================================================
    // 第四页 - 延误标准和免责条款
    // =====================================================
    doc.fontSize(12)
      .text('六、延误标准')
      .moveDown(0.3)
      .text(`1. 从到港卸柜日起至货物清关完成为止，乙方承诺的正常时间为 ${contract.clearance_days || 15} 个工作日。（国内外重大节假日期除外）`)
      .moveDown(0.3)
      .text('2. 接货时先检查封条是否和我司提供一致，如果没有封条或者数据跟我司提供不一致，请先别卸货，等我司调查清楚再卸。如果发现少货情况，必须要司机在的时候，当场通知我司，我们会让司机协助点货，司机确认后和司机一起在路单上签上实际收货数量。如司机走后再通知，我司不予以承担。')
      .moveDown(0.3)
    
    // 高峰期说明
    doc.text('3. 海运高峰期免责时段：')
    if (peakSeasons && peakSeasons.length > 0) {
      for (const season of peakSeasons) {
        doc.text(`   ${season.start_month}月${season.start_day}号到${season.end_month}月${season.end_day}号期间：${season.notes || '因国外司机放假等原因造成柜子无法正常送货，这期间到港的柜子乙方不承担晚送赔偿。'}`)
      }
    } else {
      doc.text('   8月15号到9月15号和12月15号到1月15号到港期间，这两个周期内到港的柜子，因国外司机放假等原因造成柜子无法正常送货，这期间到港的柜子乙方不承担晚送赔偿。')
    }
    doc.moveDown(1)
    
    // 七、免责条款
    doc.text('七、免责条款')
      .moveDown(0.3)
    
    if (disclaimerClauses && disclaimerClauses.length > 0) {
      disclaimerClauses.forEach((clause, index) => {
        doc.text(`${index + 1}. ${clause}`)
          .moveDown(0.2)
      })
    } else {
      doc.text('1. 若出现自然灾害、战争、工人罢工（包括港口、机场、铁路货站等）等不可抗力因素导致货物灭失或者运输延误的，乙方不承担货物灭失的赔偿责任及延误的赔偿责任。')
        .text('2. 如货物在国际段运输中发生灭失的，乙方不承担货物灭失的赔偿责任。乙方有义务代甲方为向承运人申请索赔，但不对申请结果负责。')
        .text('3. 若因货物的知识产权原因被欧盟政府的执法部门查扣，由此引起的一切责任、费用与风险由甲方承担。')
        .text('4. 若因货物不符合欧盟要求等因素导致货物被扣留或者灭失的，货代不承担货物灭失的赔偿责任。')
        .text('5. 如因甲方提供的货物单据和实际货物情况不符而引起执法部门查扣，货代不承担货物灭失的赔偿责任及延误的赔偿责任。')
        .text('6. 若因甲方提供的收货人公司不能接受销售发票、不能办理律师委托函或被政府列入黑名单，货代不承担货物灭失和运输延误的赔偿责任。')
        .text('7. 如果甲方当期运费没有按照双方约定时间支付，则该时间段货代发生到货延误也将免于赔偿。')
    }
    doc.moveDown(1)
    
    // 八、保密条款与争议处理
    doc.text('八、保密条款与争议处理')
      .moveDown(0.3)
      .text('1. 甲、乙双方非经过对方同意，不得以任何方式将双方合作的情况告之其他一方，否则任何一方有权单方面提前解除本协议，违约方应赔偿对方相应损失。')
      .text('2. 双方同意适用中华人民共和国法律解决双方争议。本协议在履行中发生争议，应由双方协商解决，若协商不成，任何一方有权向仲裁委员会申请仲裁。')
      .moveDown(1)
    
    // 新页
    doc.addPage()
    pageNumber++
    addHeaderFooter()
    
    // =====================================================
    // 第五页 - 协议生效与签章
    // =====================================================
    doc.fontSize(12)
      .text('九、协议生效与终止')
      .moveDown(0.3)
      .text('1. 本协议壹式贰份，双方各执壹份，具有同等法律效力')
      .text('2. 本合同自双方签署之日起生效，有效期一年。协议有效期满后，如果甲乙双方均未提出异议，则本协议自动顺延，每次续展一年，以此类推。')
      .text(`3. 在合同执行期间，任何一方如提出修改或终止本合同，应提前 ${config.delay_notice_days?.value || 30} 日以书面形式通知对方。`)
      .text('4. 合同的提前终止，不影响双方于合同终止前已产生的权利和义务。')
      .text('5. 本合同未尽事宜，由双方协商一致签订书面补充协议，补充协议与本合同具有同等效力。')
      .moveDown(1)
    
    // 十、其他补充条款
    doc.text('十、其他补充条款')
      .moveDown(2)
    
    // 付款账户信息
    doc.text('付款账户：')
      .moveDown(0.3)
      .text(`Account Holder's Name: ${config.bank_account_name?.value || 'Xianfeng International Logistics'}`)
      .text(`Account Number: ${config.bank_account_number?.value || '015-150-68-100225'}`)
      .text(`Bank's Name: ${config.bank_name?.value || 'The Bank of East Asia, Limited'}`)
      .text(`Bank's Address: ${config.bank_address?.value || '10 Des Voeux Road, Central, Hong Kong'}`)
      .text(`SWIFT Code: ${config.swift_code?.value || 'BEASHKHH'}`)
      .text(`Clearing No.: ${config.clearing_no?.value || '015'} (for local interbank transfers)`)
      .moveDown(2)
    
    // 签章区域
    const signY = doc.y + 20
    
    // 甲方签章
    doc.text('甲方：', 60, signY)
      .text('经办人：（签字盖章）', 60, signY + 30)
      .text('时间：', 60, signY + 60)
    
    // 乙方签章
    doc.text('乙方：', 350, signY)
      .text('经办人：（签字盖章）', 350, signY + 30)
      .text('时间：', 350, signY + 60)
    
    // 结束文档
    doc.end()
    
    // 等待写入完成
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', reject)
    })
    
    // 更新数据库中的PDF路径
    await model.updateContractPdfPath(id, `/uploads/contracts/${filename}`)
    
    res.json({
      success: true,
      message: 'PDF生成成功',
      data: {
        filename,
        path: `/uploads/contracts/${filename}`
      }
    })
  } catch (error) {
    console.error('生成PDF失败:', error)
    res.status(500).json({ success: false, message: '生成PDF失败', error: error.message })
  }
}

/**
 * 获取合同PDF文件
 */
export async function getContractPdf(req, res) {
  try {
    const { id } = req.params
    
    // 获取合同信息
    const contract = await model.getContract(id)
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    // 检查PDF是否存在
    const filename = `${contract.contract_no}.pdf`
    const filepath = path.join(PDF_DIR, filename)
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: 'PDF文件不存在，请先生成' })
    }
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    // 发送文件
    const fileStream = fs.createReadStream(filepath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('获取PDF失败:', error)
    res.status(500).json({ success: false, message: '获取PDF失败', error: error.message })
  }
}

export default {
  generateContractPdf,
  getContractPdf
}
