/**
 * 企查查API服务
 * 
 * 提供企业工商信息查询功能
 * 文档: https://openapi.qichacha.com/
 */

import 'dotenv/config'  // 确保环境变量已加载
import crypto from 'crypto'
import * as model from './model.js'

// 企查查API配置
const QICHACHA_API_URL = 'https://api.qichacha.com'
const QICHACHA_KEY = process.env.QICHACHA_KEY || ''
const QICHACHA_SECRET = process.env.QICHACHA_SECRET || ''

/**
 * 生成企查查API认证头
 * @param {string} path - API路径
 */
function generateAuthHeaders(path) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  
  // 签名算法：MD5(Key + Timestamp + Secret)
  const signStr = QICHACHA_KEY + timestamp + QICHACHA_SECRET
  const token = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase()
  
  return {
    'Token': token,
    'Timespan': timestamp,
    'Content-Type': 'application/json'
  }
}

/**
 * 检查企查查API配置
 */
export function checkConfig() {
  return {
    configured: !!(QICHACHA_KEY && QICHACHA_SECRET),
    hasKey: !!QICHACHA_KEY,
    hasSecret: !!QICHACHA_SECRET
  }
}

/**
 * 企业关键字搜索
 * 根据公司名称搜索企业列表
 * 
 * @param {string} keyword - 搜索关键字（公司名称）
 * @param {number} pageIndex - 页码（从1开始）
 * @param {number} pageSize - 每页数量（默认10，最大20）
 * @returns {Promise<Object>} 搜索结果
 */
export async function searchCompany(keyword, pageIndex = 1, pageSize = 10) {
  // 首先检查本地缓存
  const localResults = await model.searchLocalBusinessInfo(keyword, pageSize)
  
  // 如果本地有足够的结果，直接返回
  if (localResults.length >= pageSize) {
    return {
      success: true,
      source: 'local',
      data: {
        list: localResults,
        total: localResults.length
      }
    }
  }
  
  // 检查API配置
  if (!QICHACHA_KEY || !QICHACHA_SECRET) {
    // API未配置，只返回本地结果
    return {
      success: true,
      source: 'local',
      data: {
        list: localResults,
        total: localResults.length
      },
      warning: '企查查API未配置，仅显示本地数据'
    }
  }
  
  try {
    const path = '/ECIV4/Search/SearchMulti'
    const headers = generateAuthHeaders(path)
    
    const params = new URLSearchParams({
      key: QICHACHA_KEY,
      searchKey: keyword,
      pageIndex: pageIndex.toString(),
      pageSize: pageSize.toString()
    })
    
    const response = await fetch(`${QICHACHA_API_URL}${path}?${params}`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.Status !== '200') {
      throw new Error(result.Message || 'API返回错误')
    }
    
    // 解析并转换结果
    const apiList = (result.Result || []).map(item => ({
      creditCode: item.CreditCode || item.KeyNo,
      companyName: item.Name,
      legalPerson: item.OperName,
      registeredCapital: item.RegistCapi,
      establishmentDate: item.StartDate,
      operatingStatus: item.Status,
      address: item.Address,
      sourceId: item.KeyNo,
      source: 'qichacha'
    }))
    
    // 合并本地结果和API结果（去重）
    const existingCodes = new Set(localResults.map(r => r.creditCode))
    const newResults = apiList.filter(item => !existingCodes.has(item.creditCode))
    const mergedList = [...localResults, ...newResults].slice(0, pageSize)
    
    return {
      success: true,
      source: 'api',
      data: {
        list: mergedList,
        total: result.Paging?.TotalRecords || mergedList.length
      }
    }
    
  } catch (error) {
    console.error('[企查查API] 搜索失败:', error.message)
    
    // API失败时返回本地结果
    return {
      success: true,
      source: 'local',
      data: {
        list: localResults,
        total: localResults.length
      },
      warning: `企查查API调用失败: ${error.message}`
    }
  }
}

/**
 * 获取企业详情
 * 根据企业ID或名称获取完整工商信息
 * 
 * @param {string} identifier - 企业名称或统一社会信用代码
 * @returns {Promise<Object>} 企业详情
 */
export async function getCompanyDetail(identifier) {
  // 先检查本地缓存
  let localData = await model.getBusinessInfoByCreditCode(identifier)
  if (!localData) {
    localData = await model.getBusinessInfoByCompanyName(identifier)
  }
  
  // 如果本地有完整数据，直接返回
  if (localData && localData.businessScope) {
    // 增加使用次数
    await model.incrementUsageCount(localData.id)
    return {
      success: true,
      source: 'local',
      data: localData
    }
  }
  
  // 检查API配置
  if (!QICHACHA_KEY || !QICHACHA_SECRET) {
    if (localData) {
      return {
        success: true,
        source: 'local',
        data: localData,
        warning: '企查查API未配置，返回本地缓存数据'
      }
    }
    return {
      success: false,
      error: '企查查API未配置，且本地无缓存数据'
    }
  }
  
  try {
    const path = '/ECIV4/GetDetailsByName'
    const headers = generateAuthHeaders(path)
    
    const params = new URLSearchParams({
      key: QICHACHA_KEY,
      searchKey: identifier
    })
    
    const response = await fetch(`${QICHACHA_API_URL}${path}?${params}`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const result = await response.json()
    
    if (result.Status !== '200') {
      throw new Error(result.Message || 'API返回错误')
    }
    
    const item = result.Result
    if (!item) {
      throw new Error('未找到企业信息')
    }
    
    // 解析API返回数据
    const companyData = {
      creditCode: item.CreditCode,
      companyName: item.Name,
      legalPerson: item.OperName,
      registeredCapital: item.RegistCapi,
      paidCapital: item.RecCap,
      establishmentDate: item.StartDate,
      businessScope: item.Scope,
      address: item.Address,
      province: item.Province,
      city: item.City,
      district: item.District,
      companyType: item.EconKind,
      operatingStatus: item.Status,
      industry: item.Industry?.Industry,
      registrationAuthority: item.BelongOrg,
      approvalDate: item.CheckDate,
      businessTermStart: item.TermStart,
      businessTermEnd: item.TeamEnd,
      formerNames: item.OriginalName ? item.OriginalName.split(';').filter(Boolean) : [],
      phone: item.ContactNumber,
      email: item.Email,
      website: item.WebSite,
      source: 'qichacha',
      sourceId: item.KeyNo,
      rawData: item
    }
    
    // 保存到本地缓存
    const saveResult = await model.upsertBusinessInfo(companyData)
    companyData.id = saveResult.id
    
    return {
      success: true,
      source: 'api',
      data: companyData,
      cached: saveResult.isNew ? '已缓存到本地' : '已更新本地缓存'
    }
    
  } catch (error) {
    console.error('[企查查API] 获取详情失败:', error.message)
    
    // API失败时返回本地数据（如果有）
    if (localData) {
      return {
        success: true,
        source: 'local',
        data: localData,
        warning: `企查查API调用失败: ${error.message}，返回本地缓存数据`
      }
    }
    
    return {
      success: false,
      error: `获取企业详情失败: ${error.message}`
    }
  }
}

/**
 * 验证统一社会信用代码格式
 * @param {string} code - 信用代码
 */
export function validateCreditCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: '信用代码不能为空' }
  }
  
  // 统一社会信用代码为18位
  const cleanCode = code.replace(/[\s\-]/g, '').toUpperCase()
  
  if (cleanCode.length !== 18) {
    return { valid: false, error: '统一社会信用代码应为18位' }
  }
  
  // 格式：登记管理部门代码(1位) + 机构类别代码(1位) + 登记管理机关行政区划码(6位) + 主体标识码(9位) + 校验码(1位)
  const pattern = /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/
  
  if (!pattern.test(cleanCode)) {
    return { valid: false, error: '统一社会信用代码格式不正确' }
  }
  
  return { valid: true, code: cleanCode }
}

export default {
  checkConfig,
  searchCompany,
  getCompanyDetail,
  validateCreditCode
}

