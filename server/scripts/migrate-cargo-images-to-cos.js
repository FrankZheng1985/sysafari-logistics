/**
 * 货物图片迁移脚本
 * 将本地 uploads/cargo-images 目录下的图片迁移到腾讯云 COS
 * 
 * 使用方法:
 *   node scripts/migrate-cargo-images-to-cos.js [--dry-run] [--delete-local]
 * 
 * 参数:
 *   --dry-run      模拟运行，不实际上传和修改数据库
 *   --delete-local 迁移成功后删除本地文件
 *   --limit=N      限制处理的图片数量（用于测试）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

import { query } from '../config/database.js'
import * as cosService from '../utils/cosService.js'

// 本地图片目录
const UPLOAD_DIR = path.join(__dirname, '../uploads/cargo-images')

// 解析命令行参数
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const DELETE_LOCAL = args.includes('--delete-local')
const limitArg = args.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null

/**
 * 获取环境前缀
 */
function getEnvPrefix() {
  if (process.env.COS_PATH_PREFIX) {
    return process.env.COS_PATH_PREFIX
  }
  const isProduction = process.env.NODE_ENV === 'production'
  return isProduction ? 'prod' : 'dev'
}

/**
 * 上传图片到 COS
 */
async function uploadToCos(localPath, fileName, containerNo) {
  const envPrefix = getEnvPrefix()
  const safeContainerNo = (containerNo || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_')
  const cosKey = `${envPrefix}/cargo-images/${safeContainerNo}/${fileName}`
  
  const ext = path.extname(fileName).toLowerCase()
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  }
  const contentType = mimeTypes[ext] || 'image/jpeg'
  
  const fileBuffer = fs.readFileSync(localPath)
  
  const result = await cosService.uploadDocument({
    body: fileBuffer,
    fileName: fileName,
    customKey: cosKey,
    contentType: contentType
  })
  
  return {
    success: result.success,
    url: result.url,
    key: cosKey
  }
}

/**
 * 获取所有需要迁移的图片记录
 */
async function getImagesToMigrate() {
  // 查询有本地图片路径的 cargo_items，关联 cargo_imports 获取集装箱号
  const sql = `
    SELECT 
      ci.id as item_id,
      ci.product_image,
      ci.import_id,
      imp.container_no,
      imp.import_no
    FROM cargo_items ci
    LEFT JOIN cargo_imports imp ON ci.import_id = imp.id
    WHERE ci.product_image IS NOT NULL 
      AND ci.product_image != ''
      AND ci.product_image LIKE '/uploads/cargo-images/%'
    ORDER BY ci.id
  `
  
  const rows = await query(sql)
  return rows.rows || rows
}

/**
 * 更新数据库中的图片路径
 */
async function updateImagePath(itemId, newUrl) {
  const sql = `UPDATE cargo_items SET product_image = $1 WHERE id = $2`
  await query(sql, [newUrl, itemId])
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('========================================')
  console.log('   货物图片迁移到 COS')
  console.log('========================================')
  console.log(`模式: ${DRY_RUN ? '模拟运行 (不实际执行)' : '正式迁移'}`)
  console.log(`迁移后删除本地: ${DELETE_LOCAL ? '是' : '否'}`)
  if (LIMIT) console.log(`限制数量: ${LIMIT}`)
  console.log('')
  
  // 检查 COS 配置
  const cosConfig = cosService.checkCosConfig()
  if (!cosConfig.configured) {
    console.error('❌ COS 未配置！请检查环境变量:')
    console.error('   - COS_SECRET_ID / TENCENT_SECRET_ID')
    console.error('   - COS_SECRET_KEY / TENCENT_SECRET_KEY')
    console.error('   - COS_BUCKET / TENCENT_COS_BUCKET')
    console.error('   - COS_REGION / TENCENT_COS_REGION')
    process.exit(1)
  }
  console.log('✓ COS 配置已就绪')
  console.log(`  Bucket: ${cosService.getCosConfig().bucket}`)
  console.log(`  Region: ${cosService.getCosConfig().region}`)
  console.log(`  环境前缀: ${getEnvPrefix()}`)
  console.log('')
  
  // 获取需要迁移的图片
  console.log('正在查询需要迁移的图片...')
  let images = await getImagesToMigrate()
  console.log(`找到 ${images.length} 条图片记录`)
  
  if (LIMIT && images.length > LIMIT) {
    images = images.slice(0, LIMIT)
    console.log(`限制处理前 ${LIMIT} 条`)
  }
  
  if (images.length === 0) {
    console.log('没有需要迁移的图片')
    return
  }
  
  // 统计信息
  const stats = {
    total: images.length,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }
  
  // 按集装箱号分组统计
  const containerStats = {}
  
  console.log('')
  console.log('开始迁移...')
  console.log('----------------------------------------')
  
  for (let i = 0; i < images.length; i++) {
    const item = images[i]
    const progress = `[${i + 1}/${images.length}]`
    
    // 解析本地路径
    const localImagePath = item.product_image
    const fileName = path.basename(localImagePath)
    const fullLocalPath = path.join(__dirname, '..', localImagePath)
    const containerNo = item.container_no || 'unknown'
    
    // 检查本地文件是否存在
    if (!fs.existsSync(fullLocalPath)) {
      console.log(`${progress} ⚠ 跳过: ${fileName} (本地文件不存在)`)
      stats.skipped++
      continue
    }
    
    if (DRY_RUN) {
      console.log(`${progress} [模拟] ${fileName} -> COS/${containerNo}/`)
      stats.success++
      containerStats[containerNo] = (containerStats[containerNo] || 0) + 1
      continue
    }
    
    try {
      // 上传到 COS
      const result = await uploadToCos(fullLocalPath, fileName, containerNo)
      
      if (result.success) {
        // 更新数据库
        await updateImagePath(item.item_id, result.url)
        
        console.log(`${progress} ✓ ${fileName} -> ${containerNo}/`)
        stats.success++
        containerStats[containerNo] = (containerStats[containerNo] || 0) + 1
        
        // 删除本地文件
        if (DELETE_LOCAL) {
          fs.unlinkSync(fullLocalPath)
        }
      } else {
        console.log(`${progress} ✗ ${fileName} 上传失败`)
        stats.failed++
        stats.errors.push({ file: fileName, error: '上传失败' })
      }
    } catch (err) {
      console.log(`${progress} ✗ ${fileName} 错误: ${err.message}`)
      stats.failed++
      stats.errors.push({ file: fileName, error: err.message })
    }
  }
  
  // 输出统计结果
  console.log('')
  console.log('========================================')
  console.log('   迁移完成')
  console.log('========================================')
  console.log(`总计: ${stats.total}`)
  console.log(`成功: ${stats.success}`)
  console.log(`跳过: ${stats.skipped}`)
  console.log(`失败: ${stats.failed}`)
  console.log('')
  
  if (Object.keys(containerStats).length > 0) {
    console.log('按集装箱号统计:')
    for (const [container, count] of Object.entries(containerStats)) {
      console.log(`  ${container}: ${count} 张`)
    }
  }
  
  if (stats.errors.length > 0) {
    console.log('')
    console.log('失败记录:')
    stats.errors.forEach(e => {
      console.log(`  - ${e.file}: ${e.error}`)
    })
  }
  
  if (DRY_RUN) {
    console.log('')
    console.log('💡 这是模拟运行，实际迁移请去掉 --dry-run 参数')
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('')
    console.log('脚本执行完毕')
    process.exit(0)
  })
  .catch(err => {
    console.error('迁移失败:', err)
    process.exit(1)
  })
