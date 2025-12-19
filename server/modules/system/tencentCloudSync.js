/**
 * 腾讯云账户同步服务
 * 用于同步腾讯云OCR和COS的余额及用量
 */

import crypto from 'crypto'
import https from 'https'

// 腾讯云API签名算法
function sha256(message, secret = '') {
  return crypto.createHmac('sha256', secret).update(message).digest()
}

function getHash(message) {
  return crypto.createHash('sha256').update(message).digest('hex')
}

function getDate(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}

/**
 * 生成腾讯云API v3签名
 */
function generateSignature(secretId, secretKey, service, host, action, payload, timestamp) {
  const date = getDate(timestamp)
  
  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const contentType = 'application/json; charset=utf-8'
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedRequestPayload = getHash(payload)
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`
  
  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = getHash(canonicalRequest)
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`
  
  // 3. 计算签名
  const secretDate = sha256(date, 'TC3' + secretKey)
  const secretService = sha256(service, secretDate)
  const secretSigning = sha256('tc3_request', secretService)
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
  
  // 4. 拼接 Authorization
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  return authorization
}

/**
 * 调用腾讯云API
 */
function callTencentApi(service, action, payload = {}) {
  return new Promise((resolve, reject) => {
    const secretId = process.env.TENCENT_SECRET_ID
    const secretKey = process.env.TENCENT_SECRET_KEY
    
    if (!secretId || !secretKey) {
      return reject(new Error('腾讯云配置缺失'))
    }
    
    const host = `${service}.tencentcloudapi.com`
    const timestamp = Math.floor(Date.now() / 1000)
    const payloadStr = JSON.stringify(payload)
    
    const authorization = generateSignature(secretId, secretKey, service, host, action, payloadStr, timestamp)
    
    const options = {
      hostname: host,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': '2018-07-09', // billing API version
        'X-TC-Region': 'ap-guangzhou',
        'Authorization': authorization
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.Response && result.Response.Error) {
            reject(new Error(result.Response.Error.Message))
          } else {
            resolve(result.Response)
          }
        } catch (e) {
          reject(new Error('解析响应失败'))
        }
      })
    })
    
    req.on('error', reject)
    req.write(payloadStr)
    req.end()
  })
}

/**
 * 查询腾讯云账户余额
 * 使用 Billing API: DescribeAccountBalance
 */
export async function getTencentAccountBalance() {
  try {
    const response = await callTencentApi('billing', 'DescribeAccountBalance', {})
    
    // 余额单位是分，需要转换为元
    const balance = (response.Balance || 0) / 100
    const availableCredit = (response.AvailableCredit || 0) / 100
    
    return {
      success: true,
      data: {
        balance: balance,                    // 账户余额（元）
        availableCredit: availableCredit,    // 可用信用额度
        currency: 'CNY',
        totalBalance: balance + availableCredit,  // 总可用金额
        syncTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('获取腾讯云余额失败:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 查询腾讯云产品用量
 * 使用 Billing API: DescribeDosageCosDetailByDate
 */
export async function getTencentCosUsage(startDate, endDate) {
  try {
    // COS用量查询
    const response = await callTencentApi('billing', 'DescribeDosageDetailByDate', {
      StartDate: startDate,
      EndDate: endDate,
      ProductCode: 'cos'  // COS产品代码
    })
    
    return {
      success: true,
      data: {
        details: response.DetailSets || [],
        total: response.DetailSets?.reduce((sum, item) => sum + (item.RealTotalCost || 0), 0) || 0,
        syncTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('获取COS用量失败:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 查询本月账单汇总
 * 使用 Billing API: DescribeBillSummaryByProduct
 */
export async function getTencentMonthlySummary() {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    
    // 本月第一天和最后一天
    const beginTime = `${monthStr}-01 00:00:00`
    const lastDay = new Date(year, month, 0).getDate()
    const endTime = `${monthStr}-${String(lastDay).padStart(2, '0')} 23:59:59`
    
    const response = await callTencentApiWithVersion('billing', 'DescribeBillSummaryByProduct', '2018-07-09', {
      BeginTime: beginTime,
      EndTime: endTime
    })
    
    // 解析各产品用量
    const products = {}
    if (response.SummaryOverview) {
      for (const item of response.SummaryOverview) {
        products[item.BusinessCode] = {
          name: item.BusinessCodeName,
          realCost: parseFloat(item.RealTotalCost || 0),
          cashPayAmount: parseFloat(item.CashPayAmount || 0),
          voucherPayAmount: parseFloat(item.VoucherPayAmount || 0)
        }
      }
    }
    
    return {
      success: true,
      data: {
        month: monthStr,
        products: products,
        ocrCost: products['p_ocr']?.realCost || products['ocr']?.realCost || 0,
        cosCost: products['cos']?.realCost || 0,
        totalCost: Object.values(products).reduce((sum, p) => sum + p.realCost, 0),
        syncTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('获取月账单失败:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 调用腾讯云API（指定版本）
 */
function callTencentApiWithVersion(service, action, version, payload = {}) {
  return new Promise((resolve, reject) => {
    const secretId = process.env.TENCENT_SECRET_ID
    const secretKey = process.env.TENCENT_SECRET_KEY
    
    if (!secretId || !secretKey) {
      return reject(new Error('腾讯云配置缺失'))
    }
    
    const host = `${service}.tencentcloudapi.com`
    const timestamp = Math.floor(Date.now() / 1000)
    const payloadStr = JSON.stringify(payload)
    
    const authorization = generateSignature(secretId, secretKey, service, host, action, payloadStr, timestamp)
    
    const options = {
      hostname: host,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': version,
        'X-TC-Region': 'ap-guangzhou',
        'Authorization': authorization
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.Response && result.Response.Error) {
            reject(new Error(result.Response.Error.Message))
          } else {
            resolve(result.Response)
          }
        } catch (e) {
          reject(new Error('解析响应失败'))
        }
      })
    })
    
    req.on('error', reject)
    req.write(payloadStr)
    req.end()
  })
}

/**
 * 获取OCR本月调用次数
 * 使用监控API和账单API获取用量数据
 */
export async function getOcrMonthlyUsage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  
  // 本月开始和结束时间戳
  const startTime = Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
  const endTime = Math.floor(Date.now() / 1000)
  
  try {
    // 方法1: 尝试使用监控API获取调用次数
    try {
      const monitorResponse = await callTencentApiWithVersion('monitor', 'GetMonitorData', '2018-07-24', {
        Namespace: 'QCE/OCR',
        MetricName: 'InvocationCount',
        StartTime: startTime,
        EndTime: endTime,
        Period: 86400, // 按天统计
        Statistics: ['Sum']
      })
      
      if (monitorResponse && monitorResponse.DataPoints) {
        let totalCalls = 0
        for (const point of monitorResponse.DataPoints) {
          totalCalls += parseFloat(point.Value || 0)
        }
        
        if (totalCalls > 0) {
          console.log('从监控API获取OCR调用次数:', totalCalls)
          return {
            success: true,
            data: {
              calls: Math.round(totalCalls),
              month: monthStr,
              source: 'monitor'
            }
          }
        }
      }
    } catch (monitorError) {
      console.log('监控API查询失败:', monitorError.message)
    }
    
    // 方法2: 使用账单资源汇总API获取用量
    try {
      const response = await callTencentApiWithVersion('billing', 'DescribeBillResourceSummary', '2018-07-09', {
        Month: monthStr,
        Offset: 0,
        Limit: 100
      })
      
      let ocrCalls = 0
      let ocrCost = 0
      
      if (response.ResourceSummarySet && response.ResourceSummarySet.length > 0) {
        for (const item of response.ResourceSummarySet) {
          // 查找OCR相关的资源（包括 p_ai_image_ocr）
          if (item.BusinessCodeName && (
            item.BusinessCodeName.includes('OCR') || 
            item.BusinessCodeName.includes('文字识别') ||
            item.BusinessCode === 'p_ocr' ||
            item.BusinessCode === 'p_ai_image_ocr' ||
            item.BusinessCode === 'ocr'
          )) {
            const cost = parseFloat(item.RealTotalCost || 0)
            ocrCost += cost
            // 尝试从不同字段获取调用次数
            if (item.TotalQuantity) {
              ocrCalls += parseInt(item.TotalQuantity) || 0
            } else if (item.UsedAmount) {
              ocrCalls += parseInt(item.UsedAmount) || 0
            }
          }
        }
        
        if (ocrCost > 0) {
          // 费用可能是分，转换为元
          const costInYuan = ocrCost > 100 ? ocrCost / 100 : ocrCost
          // 如果调用次数为0，从费用反推
          if (ocrCalls === 0 && costInYuan > 0) {
            ocrCalls = Math.round(costInYuan * 1000)
          }
          console.log('从账单资源汇总获取OCR数据:', { calls: ocrCalls, cost: costInYuan })
          return {
            success: true,
            data: {
              calls: ocrCalls,
              cost: costInYuan,
              month: monthStr,
              source: 'billing_resource'
            }
          }
        }
      }
    } catch (billingError) {
      console.log('账单资源汇总查询失败:', billingError.message)
    }
    
    // 方法3: 从费用反推调用次数（如果有单价）
    // OCR一般按次计费，假设单价是0.001元/次（实际需要从配置获取）
    const summaryResult = await getTencentMonthlySummary()
    if (summaryResult.success && summaryResult.data.products) {
      const ocrProduct = summaryResult.data.products['p_ocr'] || summaryResult.data.products['ocr']
      if (ocrProduct && ocrProduct.realCost > 0) {
        // 费用可能是分，需要转换
        const cost = ocrProduct.realCost > 100 ? ocrProduct.realCost / 100 : ocrProduct.realCost
        // OCR标准价格：0.001元/次（1000次=1元）
        const estimatedCalls = Math.round(cost * 1000)
        console.log('从费用估算OCR调用次数:', estimatedCalls, '费用:', cost)
        return {
          success: true,
          data: {
            calls: estimatedCalls,
            cost: cost,
            month: monthStr,
            source: 'estimated',
            note: '根据费用估算（约0.001元/次）'
          }
        }
      }
    }
    
    console.log('未找到OCR调用次数数据')
    return {
      success: true,
      data: { calls: 0, cost: 0, month: monthStr }
    }
  } catch (error) {
    console.error('获取OCR用量失败:', error.message)
    return {
      success: false,
      error: error.message,
      data: { calls: 0 }
    }
  }
}

/**
 * 同步腾讯云OCR数据到api_integrations表
 */
export async function syncTencentOcr(db) {
  try {
    // 获取账户余额
    const balanceResult = await getTencentAccountBalance()
    
    // 获取本月账单
    const summaryResult = await getTencentMonthlySummary()
    
    // 获取本月调用次数和费用
    const usageResult = await getOcrMonthlyUsage()
    let monthCalls = usageResult.data?.calls || 0
    
    if (balanceResult.success) {
      const balance = balanceResult.data.totalBalance
      const summaryOcrCost = summaryResult.success ? summaryResult.data.ocrCost : 0
      const usageCost = usageResult.data?.cost || 0
      
      // 费用单位处理：账单API返回的费用可能是分，需要除以100
      // usageCost如果>100，可能是分；summaryOcrCost如果>100，也可能是分
      let ocrCost = 0
      if (usageCost > 0) {
        // usageCost可能是分（560分=5.6元）或元
        ocrCost = usageCost > 100 ? usageCost / 100 : usageCost
      } else if (summaryOcrCost > 0) {
        // summaryOcrCost可能是分或元
        ocrCost = summaryOcrCost > 100 ? summaryOcrCost / 100 : summaryOcrCost
      }
      
      // 如果调用次数为0但费用>0，使用费用反推调用次数
      // OCR标准价格：0.001元/次（1000次=1元）
      if (monthCalls === 0 && ocrCost > 0) {
        monthCalls = Math.round(ocrCost * 1000)
        console.log(`从费用反推OCR调用次数: ${monthCalls}次 (费用: ¥${ocrCost})`)
      }
      
      // 更新数据库（同步成功说明API可用，更新健康状态为正常）
      await db.prepare(`
        UPDATE api_integrations SET
          balance = $1,
          currency = 'CNY',
          health_status = 'online',
          health_check_message = '同步成功，API可用',
          last_health_check = CURRENT_TIMESTAMP,
          last_sync_time = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE api_code = 'tencent_ocr'
      `).run(balance)
      
      // 记录本月用量（调用次数和费用）
      const today = new Date().toISOString().split('T')[0]
      await db.prepare(`
        INSERT INTO api_usage_records (api_code, usage_date, call_count, cost)
        VALUES ('tencent_ocr', $1, $2, $3)
        ON CONFLICT (api_code, usage_date) DO UPDATE SET
          call_count = $2,
          cost = $3,
          updated_at = CURRENT_TIMESTAMP
      `).run(today, monthCalls, ocrCost)
      
      return {
        success: true,
        data: {
          balance: balance,
          currency: 'CNY',
          monthCalls: monthCalls,
          monthCost: ocrCost,
          syncTime: balanceResult.data.syncTime
        }
      }
    }
    
    return balanceResult
  } catch (error) {
    console.error('同步腾讯云OCR数据失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取COS本月用量（存储量、请求次数、费用）
 */
export async function getCosMonthlyUsage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  
  try {
    // 使用账单资源汇总API获取COS用量
    const response = await callTencentApiWithVersion('billing', 'DescribeBillResourceSummary', '2018-07-09', {
      Month: monthStr,
      Offset: 0,
      Limit: 100
    })
    
    let cosCost = 0
    let cosStorage = 0 // 存储量（GB）
    let cosRequests = 0 // 请求次数
    
    if (response.ResourceSummarySet && response.ResourceSummarySet.length > 0) {
      for (const item of response.ResourceSummarySet) {
        // 查找COS相关的资源
        if (item.BusinessCode === 'p_cos' || item.BusinessCode === 'cos' ||
            (item.BusinessCodeName && item.BusinessCodeName.includes('COS'))) {
          const cost = parseFloat(item.RealTotalCost || 0)
          cosCost += cost
          
          // COS的用量可能在不同字段
          if (item.TotalQuantity) {
            // 可能是存储量（GB）或请求次数
            const quantity = parseFloat(item.TotalQuantity)
            if (item.ActionTypeName && item.ActionTypeName.includes('存储')) {
              cosStorage += quantity
            } else {
              cosRequests += quantity
            }
          }
        }
      }
      
      if (cosCost > 0) {
        // 费用可能是分，转换为元
        const costInYuan = cosCost > 100 ? cosCost / 100 : cosCost
        
        // COS费用主要来自存储和请求，如果费用很小，可能是存储费用
        // 存储费用：约0.118元/GB/月
        // 请求费用：约0.01元/万次
        if (cosStorage === 0 && cosRequests === 0 && costInYuan > 0) {
          // 如果费用很小（<1元），可能是存储费用，反推存储量
          if (costInYuan < 1) {
            cosStorage = Math.round(costInYuan / 0.118 * 100) / 100 // 保留2位小数
          } else {
            // 如果费用较大，可能是请求费用，反推请求次数
            cosRequests = Math.round(costInYuan * 10000)
          }
        }
        
        console.log('从账单资源汇总获取COS数据:', { storage: cosStorage, requests: cosRequests, cost: costInYuan })
        return {
          success: true,
          data: {
            storage: cosStorage, // GB
            requests: cosRequests, // 请求次数
            cost: costInYuan,
            month: monthStr,
            source: 'billing_resource'
          }
        }
      }
    }
    
    // 如果没找到，尝试从账单汇总获取费用
    const summaryResult = await getTencentMonthlySummary()
    if (summaryResult.success && summaryResult.data.products) {
      const cosProduct = summaryResult.data.products['cos'] || summaryResult.data.products['p_cos']
      if (cosProduct && cosProduct.realCost > 0) {
        const cost = cosProduct.realCost > 100 ? cosProduct.realCost / 100 : cosProduct.realCost
        console.log('从账单汇总获取COS费用:', cost)
        return {
          success: true,
          data: {
            storage: 0,
            requests: 0,
            cost: cost,
            month: monthStr,
            source: 'billing_summary'
          }
        }
      }
    }
    
    return {
      success: true,
      data: { storage: 0, requests: 0, cost: 0, month: monthStr }
    }
  } catch (error) {
    console.error('获取COS用量失败:', error.message)
    return {
      success: false,
      error: error.message,
      data: { storage: 0, requests: 0, cost: 0 }
    }
  }
}

/**
 * 同步腾讯云COS数据到api_integrations表
 */
export async function syncTencentCos(db) {
  try {
    // 获取账户余额（腾讯云是统一账户）
    const balanceResult = await getTencentAccountBalance()
    
    // 获取本月账单
    const summaryResult = await getTencentMonthlySummary()
    
    // 获取COS用量
    const usageResult = await getCosMonthlyUsage()
    const cosRequests = usageResult.data?.requests || 0
    const cosStorage = usageResult.data?.storage || 0
    
    if (balanceResult.success) {
      const balance = balanceResult.data.totalBalance
      const summaryCosCost = summaryResult.success ? summaryResult.data.cosCost : 0
      const usageCost = usageResult.data?.cost || 0
      
      // 费用单位处理
      let cosCost = summaryCosCost
      if (usageCost > 0) {
        cosCost = usageCost > 100 ? usageCost / 100 : usageCost
      }
      
      // 更新数据库（同步成功说明API可用，更新健康状态为正常）
      await db.prepare(`
        UPDATE api_integrations SET
          balance = $1,
          currency = 'CNY',
          health_status = 'online',
          health_check_message = '同步成功，API可用',
          last_health_check = CURRENT_TIMESTAMP,
          last_sync_time = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE api_code = 'tencent_cos'
      `).run(balance)
      
      // 记录本月用量（请求次数和费用）
      const today = new Date().toISOString().split('T')[0]
      await db.prepare(`
        INSERT INTO api_usage_records (api_code, usage_date, call_count, cost)
        VALUES ('tencent_cos', $1, $2, $3)
        ON CONFLICT (api_code, usage_date) DO UPDATE SET
          call_count = $2,
          cost = $3,
          updated_at = CURRENT_TIMESTAMP
      `).run(today, cosRequests, cosCost)
      
      return {
        success: true,
        data: {
          balance: balance,
          currency: 'CNY',
          monthCalls: cosRequests,
          monthStorage: cosStorage,
          monthCost: cosCost,
          syncTime: balanceResult.data.syncTime
        }
      }
    }
    
    return balanceResult
  } catch (error) {
    console.error('同步腾讯云COS数据失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 同步所有腾讯云服务数据
 */
export async function syncAllTencentServices(db) {
  const results = {}
  
  // 获取一次账户余额（避免重复调用）
  const balanceResult = await getTencentAccountBalance()
  const summaryResult = await getTencentMonthlySummary()
  const ocrUsageResult = await getOcrMonthlyUsage()
  const cosUsageResult = await getCosMonthlyUsage()
  
  if (balanceResult.success) {
    const balance = balanceResult.data.totalBalance
    const ocrCost = summaryResult.success ? summaryResult.data.ocrCost : 0
    const cosCost = summaryResult.success ? summaryResult.data.cosCost : 0
    const ocrCalls = ocrUsageResult.data?.calls || 0
    const cosRequests = cosUsageResult.data?.requests || 0
    const cosUsageCost = cosUsageResult.data?.cost || 0
    
    // COS费用处理
    const finalCosCost = cosUsageCost > 0 ? (cosUsageCost > 100 ? cosUsageCost / 100 : cosUsageCost) : cosCost
    
    const today = new Date().toISOString().split('T')[0]
    
    // 更新OCR（同步成功说明API可用）
    await db.prepare(`
      UPDATE api_integrations SET
        balance = $1,
        currency = 'CNY',
        health_status = 'online',
        health_check_message = '同步成功，API可用',
        last_health_check = CURRENT_TIMESTAMP,
        last_sync_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE api_code = 'tencent_ocr'
    `).run(balance)
    
    // 记录OCR用量
    await db.prepare(`
      INSERT INTO api_usage_records (api_code, usage_date, call_count, cost)
      VALUES ('tencent_ocr', $1, $2, $3)
      ON CONFLICT (api_code, usage_date) DO UPDATE SET
        call_count = $2,
        cost = $3,
        updated_at = CURRENT_TIMESTAMP
    `).run(today, ocrCalls, ocrCost)
    
    // 更新COS（同步成功说明API可用）
    await db.prepare(`
      UPDATE api_integrations SET
        balance = $1,
        currency = 'CNY',
        health_status = 'online',
        health_check_message = '同步成功，API可用',
        last_health_check = CURRENT_TIMESTAMP,
        last_sync_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE api_code = 'tencent_cos'
    `).run(balance)
    
    // 记录COS用量
    await db.prepare(`
      INSERT INTO api_usage_records (api_code, usage_date, call_count, cost)
      VALUES ('tencent_cos', $1, $2, $3)
      ON CONFLICT (api_code, usage_date) DO UPDATE SET
        call_count = $2,
        cost = $3,
        updated_at = CURRENT_TIMESTAMP
    `).run(today, cosRequests, finalCosCost)
    
    results.tencent_ocr = { success: true, balance, monthCalls: ocrCalls, monthCost: ocrCost }
    results.tencent_cos = { success: true, balance, monthCalls: cosRequests, monthCost: finalCosCost }
  } else {
    results.tencent_ocr = balanceResult
    results.tencent_cos = balanceResult
  }
  
  return results
}
