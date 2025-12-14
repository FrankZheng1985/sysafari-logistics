import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// TARIC数据文件URL（需要用户手动访问并下载）
// 由于CIRCABC需要登录，无法直接下载
const TARIC_BASE_URL = 'https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa'

console.log('📥 TARIC文件下载助手')
console.log('='.repeat(60))
console.log('\n由于TARIC文件托管在CIRCABC平台，需要登录访问，')
console.log('无法直接通过脚本下载。')
console.log('\n📋 请按照以下步骤手动下载:')
console.log('\n1. 访问TARIC数据页面:')
console.log(`   ${TARIC_BASE_URL}`)
console.log('\n2. 登录CIRCABC账户（如果需要）')
console.log('\n3. 下载以下文件:')
console.log('   - Nomenclature EN.xlsx (英文商品分类编码)')
console.log('   - Duties Import 01-99(1).xlsx (进口关税数据，可选)')
console.log('\n4. 将下载的文件保存到项目目录:')
console.log(`   ${join(__dirname, '..', 'data', 'taric')}`)
console.log('\n5. 运行导入命令:')
console.log('   npm run import-taric <文件路径>')
console.log('\n示例:')
console.log('   npm run import-taric data/taric/Nomenclature\\ EN.xlsx')
console.log('\n' + '='.repeat(60))

// 创建目录
const taricDir = join(__dirname, '..', 'data', 'taric')
if (!existsSync(taricDir)) {
  mkdirSync(taricDir, { recursive: true })
  console.log(`\n✅ 已创建目录: ${taricDir}`)
}

console.log('\n💡 提示:')
console.log('   如果文件已下载，可以直接运行导入命令')
console.log('   导入脚本会自动识别Excel文件的列结构')

