/**
 * 将 index.js 中的同步数据库调用转换为异步调用
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const indexPath = path.join(__dirname, '../index.js')

let content = fs.readFileSync(indexPath, 'utf8')

// 1. 将 API 路由处理函数改为 async
// 匹配: app.get('/api/...', (req, res) => {
// 替换为: app.get('/api/...', async (req, res) => {
content = content.replace(
  /app\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\//g,
  (match) => match
)

// 更精确的替换：找到 /api/ 路由后面的 (req, res) => 改为 async (req, res) =>
content = content.replace(
  /(app\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\/[^'"`]*['"`]\s*,\s*)\(req,\s*res\)\s*=>\s*\{/g,
  '$1async (req, res) => {'
)

// 也处理带中间件的情况: app.get('/api/...', middleware, (req, res) => {
content = content.replace(
  /(app\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\/[^'"`]*['"`]\s*,\s*\w+\s*,\s*)\(req,\s*res\)\s*=>\s*\{/g,
  '$1async (req, res) => {'
)

// 2. 在 db.prepare(...).get/all/run(...) 调用前添加 await
// 但只在非 await 的情况下添加
// 匹配: const/let/var xxx = db.prepare(...).get/all/run(...)
// 替换为: const/let/var xxx = await db.prepare(...).get/all/run(...)
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
  '$1await $2'
)

// 处理多行的情况：db.prepare(` ... `).get/all/run(...)
// 这个正则更复杂，需要处理模板字符串
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
  '$1await $2'
)

// 3. 处理直接调用的情况（不是赋值）
// 如: db.prepare(...).run(...)
content = content.replace(
  /^(\s*)(?!.*(?:const|let|var|await))(\s*)(db\.prepare\s*\([^)]+\)\s*\.\s*run\s*\([^)]*\))/gm,
  '$1$2await $3'
)

// 处理模板字符串的直接调用
content = content.replace(
  /^(\s*)(?!.*(?:const|let|var|await))(\s*)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*run\s*\([^)]*\))/gm,
  '$1$2await $3'
)

// 4. 处理 .map() 链式调用的情况
// 如: db.prepare(...).all(...).map(...)
// 需要改成: (await db.prepare(...).all(...)).map(...)
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*all\s*\([^)]*\))\s*\.map/g,
  '$1(await $2).map'
)

content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*all\s*\([^)]*\))\s*\.map/g,
  '$1(await $2).map'
)

// 写回文件
fs.writeFileSync(indexPath, content, 'utf8')

console.log('✅ 转换完成！')
console.log('请检查 index.js 文件确认修改正确')
