/**
 * Tariff Rates 路由模块
 * 处理 HS Code 税率的查询、新增、修改、删除接口
 */

import express from 'express'
import { getDatabase, generateId } from '../../config/database.js'
import { success, successWithPagination, badRequest, serverError, notFound } from '../../utils/response.js'

const router = express.Router()

// ==================== 税率查询 ====================

/**
 * 获取税率列表（支持分页和筛选）
 * GET /api/tariff-rates
 */
router.get('/', async (req, res) => {
  try {
    const db = getDatabase()
    const {
      search,
      hsCode,
      origin,
      dataSource,
      status,
      dutyRateMin,
      dutyRateMax,
      page = 1,
      pageSize = 20
    } = req.query
    
    let query = `
      SELECT 
        id, hs_code, hs_code_10, taric_code, 
        goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area,
        duty_rate, third_country_duty, vat_rate,
        preferential_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, measure_type, measure_code,
        start_date, end_date, regulation_id,
        data_source, taric_version, is_active,
        last_sync_time, created_at, updated_at
      FROM tariff_rates 
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1
    
    // 关键词搜索（商品描述、HS编码）
    if (search) {
      query += ` AND (goods_description ILIKE $${paramIndex} OR goods_description_cn ILIKE $${paramIndex} OR hs_code ILIKE $${paramIndex + 1})`
      params.push(`%${search}%`, `%${search}%`)
      paramIndex += 2
    }
    
    // HS编码前缀筛选
    if (hsCode) {
      query += ` AND hs_code LIKE $${paramIndex}`
      params.push(`${hsCode}%`)
      paramIndex++
    }
    
    // 原产国筛选（支持大小写不敏感和模糊匹配）
    if (origin) {
      query += ` AND (UPPER(origin_country_code) = UPPER($${paramIndex}) OR UPPER(geographical_area) = UPPER($${paramIndex}) OR UPPER(origin_country) LIKE UPPER($${paramIndex + 1}))`
      params.push(origin, `%${origin}%`)
      paramIndex += 2
    }
    
    // 数据来源筛选
    if (dataSource) {
      query += ` AND data_source = $${paramIndex}`
      params.push(dataSource)
      paramIndex++
    }
    
    // 状态筛选
    if (status === 'active') {
      query += ` AND is_active = 1`
    } else if (status === 'inactive') {
      query += ` AND is_active = 0`
    }
    
    // 关税率范围筛选
    if (dutyRateMin !== undefined && dutyRateMin !== '') {
      query += ` AND duty_rate >= $${paramIndex}`
      params.push(parseFloat(dutyRateMin))
      paramIndex++
    }
    if (dutyRateMax !== undefined && dutyRateMax !== '') {
      query += ` AND duty_rate <= $${paramIndex}`
      params.push(parseFloat(dutyRateMax))
      paramIndex++
    }
    
    // 获取总数
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
    const countResult = await db.prepare(countQuery).get(...params)
    const total = parseInt(countResult?.total || 0)
    
    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    query += ` ORDER BY hs_code ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(pageSize), offset)
    
    const rates = await db.prepare(query).all(...params)
    
    // 转换为驼峰命名
    const data = rates.map(r => ({
      id: r.id,
      hsCode: r.hs_code,
      hsCode10: r.hs_code_10,
      taricCode: r.taric_code,
      goodsDescription: r.goods_description,
      goodsDescriptionCn: r.goods_description_cn,
      originCountry: r.origin_country,
      originCountryCode: r.origin_country_code,
      geographicalArea: r.geographical_area,
      dutyRate: r.duty_rate,
      thirdCountryDuty: r.third_country_duty,
      vatRate: r.vat_rate,
      preferentialRate: r.preferential_rate,
      antiDumpingRate: r.anti_dumping_rate,
      countervailingRate: r.countervailing_rate,
      unitCode: r.unit_code,
      unitName: r.unit_name,
      measureType: r.measure_type,
      measureCode: r.measure_code,
      startDate: r.start_date,
      endDate: r.end_date,
      regulationId: r.regulation_id,
      dataSource: r.data_source,
      taricVersion: r.taric_version,
      isActive: r.is_active === 1,
      lastSyncTime: r.last_sync_time,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
    
    // 前端期望: data 直接是数组, total/page/pageSize 在顶层
    return res.json({
      errCode: 200,
      msg: 'success',
      data,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取税率列表失败:', error)
    return serverError(res, '获取税率列表失败')
  }
})

/**
 * 根据HS编码搜索税率（用于下拉搜索）
 * GET /api/tariff-rates/search
 */
router.get('/search', async (req, res) => {
  try {
    const db = getDatabase()
    const { hsCode, origin, limit = 20 } = req.query
    
    if (!hsCode || hsCode.length < 2) {
      return badRequest(res, 'HS编码至少需要2个字符')
    }
    
    let query = `
      SELECT 
        id, hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, duty_rate, vat_rate,
        anti_dumping_rate, countervailing_rate, preferential_rate
      FROM tariff_rates 
      WHERE is_active = 1
        AND (hs_code LIKE $1 OR hs_code_10 LIKE $1)
    `
    const params = [`${hsCode}%`]
    let paramIndex = 2
    
    if (origin) {
      query += ` AND (origin_country_code = $${paramIndex} OR geographical_area = $${paramIndex})`
      params.push(origin)
      paramIndex++
    }
    
    query += ` ORDER BY hs_code ASC LIMIT $${paramIndex}`
    params.push(parseInt(limit))
    
    const rates = await db.prepare(query).all(...params)
    
    const data = rates.map(r => ({
      id: r.id,
      hsCode: r.hs_code,
      hsCode10: r.hs_code_10,
      goodsDescription: r.goods_description,
      goodsDescriptionCn: r.goods_description_cn,
      originCountry: r.origin_country,
      originCountryCode: r.origin_country_code,
      dutyRate: parseFloat(r.duty_rate) || 0,
      vatRate: parseFloat(r.vat_rate) || 19,
      antiDumpingRate: parseFloat(r.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(r.countervailing_rate) || 0,
      preferentialRate: r.preferential_rate
    }))
    
    return success(res, data)
  } catch (error) {
    console.error('搜索税率失败:', error)
    return serverError(res, '搜索税率失败')
  }
})

/**
 * 根据HS编码精确查询税率
 * GET /api/tariff-rates/query
 */
router.get('/query', async (req, res) => {
  try {
    const db = getDatabase()
    const { hsCode, origin } = req.query
    
    if (!hsCode) {
      return badRequest(res, '请提供HS编码')
    }
    
    let query = `
      SELECT 
        id, hs_code, hs_code_10, taric_code, 
        goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area,
        duty_rate, third_country_duty, vat_rate,
        preferential_rate, anti_dumping_rate, countervailing_rate,
        measure_type, data_source
      FROM tariff_rates 
      WHERE is_active = 1
        AND (hs_code = $1 OR hs_code_10 = $1 OR hs_code LIKE $2)
    `
    const params = [hsCode, `${hsCode}%`]
    let paramIndex = 3
    
    if (origin) {
      query += ` AND (origin_country_code = $${paramIndex} OR geographical_area = $${paramIndex})`
      params.push(origin)
      paramIndex++
    }
    
    query += ' ORDER BY hs_code ASC LIMIT 50'
    
    const rates = await db.prepare(query).all(...params)
    
    const data = rates.map(r => ({
      id: r.id,
      hsCode: r.hs_code,
      hsCode10: r.hs_code_10,
      taricCode: r.taric_code,
      goodsDescription: r.goods_description,
      goodsDescriptionCn: r.goods_description_cn,
      originCountry: r.origin_country,
      originCountryCode: r.origin_country_code,
      geographicalArea: r.geographical_area,
      dutyRate: parseFloat(r.duty_rate) || 0,
      thirdCountryDuty: r.third_country_duty,
      vatRate: parseFloat(r.vat_rate) || 19,
      preferentialRate: r.preferential_rate,
      antiDumpingRate: parseFloat(r.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(r.countervailing_rate) || 0,
      measureType: r.measure_type,
      dataSource: r.data_source
    }))
    
    return success(res, data)
  } catch (error) {
    console.error('查询税率失败:', error)
    return serverError(res, '查询税率失败')
  }
})

// ==================== 税率统计 ====================

/**
 * 获取税率统计信息
 * GET /api/tariff-rates/stats
 * 注意: 此路由必须在 /:id 之前定义
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase()
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN data_source = 'taric' THEN 1 ELSE 0 END) as from_taric,
        SUM(CASE WHEN data_source = 'manual' THEN 1 ELSE 0 END) as manual,
        SUM(CASE WHEN goods_description_cn IS NOT NULL AND goods_description_cn != '' THEN 1 ELSE 0 END) as translated,
        MAX(last_sync_time) as last_sync_time
      FROM tariff_rates
    `).get()
    
    return success(res, {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      inactive: parseInt(stats.inactive) || 0,
      fromTaric: parseInt(stats.from_taric) || 0,
      manual: parseInt(stats.manual) || 0,
      translated: parseInt(stats.translated) || 0,
      lastSyncTime: stats.last_sync_time
    })
  } catch (error) {
    console.error('获取税率统计失败:', error)
    return serverError(res, '获取税率统计失败')
  }
})

/**
 * 获取单个税率详情
 * GET /api/tariff-rates/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const rate = await db.prepare(`
      SELECT * FROM tariff_rates WHERE id = $1
    `).get(id)
    
    if (!rate) {
      return notFound(res, '税率记录不存在')
    }
    
    const data = {
      id: rate.id,
      hsCode: rate.hs_code,
      hsCode10: rate.hs_code_10,
      taricCode: rate.taric_code,
      goodsDescription: rate.goods_description,
      goodsDescriptionCn: rate.goods_description_cn,
      originCountry: rate.origin_country,
      originCountryCode: rate.origin_country_code,
      geographicalArea: rate.geographical_area,
      dutyRate: rate.duty_rate,
      thirdCountryDuty: rate.third_country_duty,
      vatRate: rate.vat_rate,
      preferentialRate: rate.preferential_rate,
      antiDumpingRate: rate.anti_dumping_rate,
      countervailingRate: rate.countervailing_rate,
      unitCode: rate.unit_code,
      unitName: rate.unit_name,
      measureType: rate.measure_type,
      measureCode: rate.measure_code,
      startDate: rate.start_date,
      endDate: rate.end_date,
      regulationId: rate.regulation_id,
      regulationUrl: rate.regulation_url,
      dataSource: rate.data_source,
      taricVersion: rate.taric_version,
      isActive: rate.is_active === 1,
      lastSyncTime: rate.last_sync_time,
      createdAt: rate.created_at,
      updatedAt: rate.updated_at
    }
    
    return success(res, data)
  } catch (error) {
    console.error('获取税率详情失败:', error)
    return serverError(res, '获取税率详情失败')
  }
})

// ==================== 税率管理 ====================

/**
 * 创建新税率
 * POST /api/tariff-rates
 */
router.post('/', async (req, res) => {
  try {
    const db = getDatabase()
    const data = req.body
    
    if (!data.hsCode) {
      return badRequest(res, 'HS编码不能为空')
    }
    
    // 检查是否已存在
    const existing = await db.prepare(`
      SELECT id FROM tariff_rates 
      WHERE hs_code = $1 
        AND COALESCE(origin_country_code, '') = COALESCE($2, '')
    `).get(data.hsCode, data.originCountryCode || '')
    
    if (existing) {
      return badRequest(res, '该HS编码和原产国组合已存在')
    }
    
    // 插入新记录
    await db.prepare(`
      INSERT INTO tariff_rates (
        hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, duty_rate, vat_rate,
        anti_dumping_rate, countervailing_rate, preferential_rate,
        unit_code, unit_name, measure_type,
        start_date, end_date, data_source, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'manual', 1
      )
    `).run(
      data.hsCode,
      data.hsCode10 || null,
      data.goodsDescription || '',
      data.goodsDescriptionCn || null,
      data.originCountry || null,
      data.originCountryCode || null,
      data.dutyRate ?? 0,
      data.vatRate ?? 19,
      data.antiDumpingRate ?? 0,
      data.countervailingRate ?? 0,
      data.preferentialRate ?? null,
      data.unitCode || null,
      data.unitName || null,
      data.measureType || null,
      data.startDate || null,
      data.endDate || null
    )
    
    return success(res, { message: '创建成功' })
  } catch (error) {
    console.error('创建税率失败:', error)
    return serverError(res, '创建税率失败')
  }
})

/**
 * 更新税率
 * PUT /api/tariff-rates/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const data = req.body
    
    // 检查记录是否存在
    const existing = await db.prepare('SELECT id FROM tariff_rates WHERE id = $1').get(id)
    if (!existing) {
      return notFound(res, '税率记录不存在')
    }
    
    await db.prepare(`
      UPDATE tariff_rates SET
        hs_code = COALESCE($1, hs_code),
        hs_code_10 = $2,
        goods_description = COALESCE($3, goods_description),
        goods_description_cn = $4,
        origin_country = $5,
        origin_country_code = $6,
        duty_rate = COALESCE($7, duty_rate),
        vat_rate = COALESCE($8, vat_rate),
        anti_dumping_rate = $9,
        countervailing_rate = $10,
        preferential_rate = $11,
        unit_code = $12,
        unit_name = $13,
        measure_type = $14,
        start_date = $15,
        end_date = $16,
        is_active = $17,
        updated_at = NOW()
      WHERE id = $18
    `).run(
      data.hsCode,
      data.hsCode10 || null,
      data.goodsDescription,
      data.goodsDescriptionCn || null,
      data.originCountry || null,
      data.originCountryCode || null,
      data.dutyRate,
      data.vatRate,
      data.antiDumpingRate ?? null,
      data.countervailingRate ?? null,
      data.preferentialRate ?? null,
      data.unitCode || null,
      data.unitName || null,
      data.measureType || null,
      data.startDate || null,
      data.endDate || null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      id
    )
    
    return success(res, { message: '更新成功' })
  } catch (error) {
    console.error('更新税率失败:', error)
    return serverError(res, '更新税率失败')
  }
})

/**
 * 删除税率
 * DELETE /api/tariff-rates/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    // 检查记录是否存在
    const existing = await db.prepare('SELECT id FROM tariff_rates WHERE id = $1').get(id)
    if (!existing) {
      return notFound(res, '税率记录不存在')
    }
    
    await db.prepare('DELETE FROM tariff_rates WHERE id = $1').run(id)
    
    return success(res, { message: '删除成功' })
  } catch (error) {
    console.error('删除税率失败:', error)
    return serverError(res, '删除税率失败')
  }
})

/**
 * 批量删除税率
 * POST /api/tariff-rates/batch-delete
 */
router.post('/batch-delete', async (req, res) => {
  try {
    const db = getDatabase()
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请提供要删除的ID列表')
    }
    
    // 构建参数占位符
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    await db.prepare(`DELETE FROM tariff_rates WHERE id IN (${placeholders})`).run(...ids)
    
    return success(res, { message: `成功删除 ${ids.length} 条记录` })
  } catch (error) {
    console.error('批量删除失败:', error)
    return serverError(res, '批量删除失败')
  }
})

/**
 * 批量更新状态
 * POST /api/tariff-rates/batch-status
 */
router.post('/batch-status', async (req, res) => {
  try {
    const db = getDatabase()
    const { ids, isActive } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请提供要更新的ID列表')
    }
    
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
    await db.prepare(`
      UPDATE tariff_rates 
      SET is_active = $1, updated_at = NOW() 
      WHERE id IN (${placeholders})
    `).run(isActive ? 1 : 0, ...ids)
    
    return success(res, { message: `成功更新 ${ids.length} 条记录` })
  } catch (error) {
    console.error('批量更新状态失败:', error)
    return serverError(res, '批量更新状态失败')
  }
})

export default router

