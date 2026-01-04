/**
 * 地址缓存模型
 * 用于缓存 HERE API 返回的地址数据，减少重复 API 调用
 */

import db from '../../config/database.js'

/**
 * 标准化查询关键词
 * - 转小写
 * - 去除多余空格
 * - 去除首尾空格
 */
export function normalizeQuery(query) {
  if (!query) return ''
  return query.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * 从缓存中查找地址（自动补全）
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise<Array>} 匹配的地址列表
 */
export async function findAutosuggestCache(query, limit = 5) {
  const normalizedQuery = normalizeQuery(query)
  
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return []
  }
  
  try {
    // 使用 LIKE 进行模糊匹配，支持部分匹配
    const result = await db.query(`
      SELECT 
        id, title, address, city, country, country_code, postal_code, lat, lng, hit_count
      FROM address_cache
      WHERE cache_type = 'autosuggest'
        AND is_active = true
        AND (
          query_normalized LIKE $1
          OR query_normalized LIKE $2
          OR postal_code LIKE $3
          OR LOWER(city) LIKE $2
        )
      ORDER BY 
        CASE WHEN query_normalized = $4 THEN 0 ELSE 1 END,
        hit_count DESC,
        created_at DESC
      LIMIT $5
    `, [
      normalizedQuery,           // 完全匹配前缀
      `%${normalizedQuery}%`,    // 包含匹配
      `${normalizedQuery}%`,     // 邮编前缀匹配
      normalizedQuery,           // 完全匹配
      limit
    ])
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      address: row.address,
      city: row.city,
      country: row.country,
      countryCode: row.country_code,
      postalCode: row.postal_code,
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null,
      fromCache: true
    }))
  } catch (error) {
    console.error('[AddressCache] 查询缓存失败:', error)
    return []
  }
}

/**
 * 从缓存中查找地理编码结果
 * @param {string} address - 地址
 * @returns {Promise<Object|null>} 地理编码结果
 */
export async function findGeocodeCache(address) {
  const normalizedQuery = normalizeQuery(address)
  
  if (!normalizedQuery) {
    return null
  }
  
  try {
    const result = await db.query(`
      SELECT 
        id, address, city, country, country_code, postal_code, lat, lng, hit_count
      FROM address_cache
      WHERE cache_type = 'geocode'
        AND is_active = true
        AND (
          query_normalized = $1
          OR LOWER(address) = $2
        )
      ORDER BY hit_count DESC
      LIMIT 1
    `, [normalizedQuery, normalizedQuery])
    
    if (result.rows.length > 0) {
      const row = result.rows[0]
      return {
        id: row.id,
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
        address: row.address,
        country: row.country_code,
        city: row.city,
        postalCode: row.postal_code,
        fromCache: true
      }
    }
    
    return null
  } catch (error) {
    console.error('[AddressCache] 查询地理编码缓存失败:', error)
    return null
  }
}

/**
 * 保存自动补全结果到缓存
 * @param {string} query - 原始搜索关键词
 * @param {Array} suggestions - HERE API 返回的建议列表
 */
export async function saveAutosuggestCache(query, suggestions) {
  if (!query || !Array.isArray(suggestions) || suggestions.length === 0) {
    return
  }
  
  const normalizedQuery = normalizeQuery(query)
  
  try {
    for (const suggestion of suggestions) {
      // 使用 upsert 避免重复
      await db.query(`
        INSERT INTO address_cache (
          query_text, query_normalized, title, address, city, 
          country, country_code, postal_code, lat, lng, 
          cache_type, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'autosuggest', 'here')
        ON CONFLICT (query_normalized, cache_type, COALESCE(address, ''))
        DO UPDATE SET
          hit_count = address_cache.hit_count + 1,
          last_hit_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [
        query,
        normalizedQuery,
        suggestion.title || null,
        suggestion.address || null,
        suggestion.city || null,
        suggestion.country || null,
        suggestion.countryCode || null,
        suggestion.postalCode || null,
        suggestion.lat || null,
        suggestion.lng || null
      ])
    }
    
    console.log(`[AddressCache] 保存 ${suggestions.length} 条自动补全缓存: "${query}"`)
  } catch (error) {
    // 缓存保存失败不影响主流程
    console.error('[AddressCache] 保存自动补全缓存失败:', error)
  }
}

/**
 * 保存地理编码结果到缓存
 * @param {string} address - 原始地址
 * @param {Object} result - HERE API 返回的结果
 */
export async function saveGeocodeCache(address, result) {
  if (!address || !result) {
    return
  }
  
  const normalizedQuery = normalizeQuery(address)
  
  try {
    await db.query(`
      INSERT INTO address_cache (
        query_text, query_normalized, address, city, 
        country, country_code, postal_code, lat, lng, 
        cache_type, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'geocode', 'here')
      ON CONFLICT (query_normalized, cache_type, COALESCE(address, ''))
      DO UPDATE SET
        hit_count = address_cache.hit_count + 1,
        last_hit_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [
      address,
      normalizedQuery,
      result.address || null,
      result.city || null,
      result.country || null,
      result.country || null,  // country 作为 countryCode
      result.postalCode || null,
      result.lat || null,
      result.lng || null
    ])
    
    console.log(`[AddressCache] 保存地理编码缓存: "${address}"`)
  } catch (error) {
    console.error('[AddressCache] 保存地理编码缓存失败:', error)
  }
}

/**
 * 更新缓存命中统计
 * @param {number} id - 缓存记录 ID
 */
export async function updateHitCount(id) {
  try {
    await db.query(`
      UPDATE address_cache 
      SET hit_count = hit_count + 1, last_hit_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id])
  } catch (error) {
    console.error('[AddressCache] 更新命中统计失败:', error)
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats() {
  try {
    const result = await db.query(`
      SELECT 
        cache_type,
        COUNT(*) as total_count,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits,
        MAX(last_hit_at) as last_hit
      FROM address_cache
      WHERE is_active = true
      GROUP BY cache_type
    `)
    
    return result.rows
  } catch (error) {
    console.error('[AddressCache] 获取缓存统计失败:', error)
    return []
  }
}

/**
 * 获取热门地址列表
 * @param {number} limit - 返回数量
 */
export async function getTopAddresses(limit = 20) {
  try {
    const result = await db.query(`
      SELECT 
        id, query_text, title, address, city, country_code, postal_code,
        hit_count, last_hit_at, cache_type
      FROM address_cache
      WHERE is_active = true
      ORDER BY hit_count DESC
      LIMIT $1
    `, [limit])
    
    return result.rows
  } catch (error) {
    console.error('[AddressCache] 获取热门地址失败:', error)
    return []
  }
}

/**
 * 搜索缓存的地址
 * @param {Object} params - 搜索参数
 */
export async function searchCachedAddresses(params) {
  const { keyword, countryCode, cacheType, page = 1, pageSize = 20 } = params
  const offset = (page - 1) * pageSize
  
  let whereClause = 'WHERE is_active = true'
  const queryParams = []
  let paramIndex = 1
  
  if (keyword) {
    whereClause += ` AND (
      query_normalized LIKE $${paramIndex}
      OR LOWER(address) LIKE $${paramIndex}
      OR LOWER(city) LIKE $${paramIndex}
      OR postal_code LIKE $${paramIndex}
    )`
    queryParams.push(`%${keyword.toLowerCase()}%`)
    paramIndex++
  }
  
  if (countryCode) {
    whereClause += ` AND country_code = $${paramIndex}`
    queryParams.push(countryCode.toUpperCase())
    paramIndex++
  }
  
  if (cacheType) {
    whereClause += ` AND cache_type = $${paramIndex}`
    queryParams.push(cacheType)
    paramIndex++
  }
  
  try {
    // 查询总数
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM address_cache ${whereClause}
    `, queryParams)
    
    // 查询列表
    const listResult = await db.query(`
      SELECT 
        id, query_text, title, address, city, country, country_code, 
        postal_code, lat, lng, cache_type, source, hit_count, 
        last_hit_at, created_at
      FROM address_cache
      ${whereClause}
      ORDER BY hit_count DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, pageSize, offset])
    
    return {
      list: listResult.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      pageSize
    }
  } catch (error) {
    console.error('[AddressCache] 搜索缓存地址失败:', error)
    return { list: [], total: 0, page, pageSize }
  }
}

/**
 * 手动添加地址到缓存
 * @param {Object} addressData - 地址数据
 */
export async function addManualAddress(addressData) {
  const {
    queryText, title, address, city, country, countryCode, postalCode, lat, lng, cacheType = 'autosuggest'
  } = addressData
  
  const normalizedQuery = normalizeQuery(queryText || address)
  
  try {
    const result = await db.query(`
      INSERT INTO address_cache (
        query_text, query_normalized, title, address, city, 
        country, country_code, postal_code, lat, lng, 
        cache_type, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual')
      RETURNING *
    `, [
      queryText || address,
      normalizedQuery,
      title || null,
      address || null,
      city || null,
      country || null,
      countryCode || null,
      postalCode || null,
      lat || null,
      lng || null,
      cacheType
    ])
    
    return result.rows[0]
  } catch (error) {
    console.error('[AddressCache] 手动添加地址失败:', error)
    throw error
  }
}

/**
 * 删除缓存记录
 * @param {number} id - 记录 ID
 */
export async function deleteCache(id) {
  try {
    await db.query(`
      UPDATE address_cache SET is_active = false WHERE id = $1
    `, [id])
    return true
  } catch (error) {
    console.error('[AddressCache] 删除缓存失败:', error)
    return false
  }
}

/**
 * 清理过期缓存（超过指定天数未命中的记录）
 * @param {number} days - 过期天数
 */
export async function cleanupOldCache(days = 90) {
  try {
    const result = await db.query(`
      UPDATE address_cache 
      SET is_active = false 
      WHERE is_active = true
        AND (
          last_hit_at IS NULL AND created_at < NOW() - INTERVAL '${days} days'
          OR last_hit_at < NOW() - INTERVAL '${days} days'
        )
        AND hit_count < 3
    `)
    
    console.log(`[AddressCache] 清理了 ${result.rowCount} 条过期缓存`)
    return result.rowCount
  } catch (error) {
    console.error('[AddressCache] 清理过期缓存失败:', error)
    return 0
  }
}

export default {
  normalizeQuery,
  findAutosuggestCache,
  findGeocodeCache,
  saveAutosuggestCache,
  saveGeocodeCache,
  updateHitCount,
  getCacheStats,
  getTopAddresses,
  searchCachedAddresses,
  addManualAddress,
  deleteCache,
  cleanupOldCache
}

