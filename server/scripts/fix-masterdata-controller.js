/**
 * 修复 masterdata/controller.js 中的 async/await
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const filePath = path.join(__dirname, '../modules/masterdata/controller.js')

let content = fs.readFileSync(filePath, 'utf8')
let changes = 0

// 修复 db.prepare().get/all/run() 调用
// 模式1: const xxx = db.prepare(...).get/all/run(...)
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
  (match, prefix, call) => {
    changes++
    return `${prefix}await ${call}`
  }
)

// 模式2: 多行模板字符串
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
  (match, prefix, call) => {
    changes++
    return `${prefix}await ${call}`
  }
)

// 模式3: 直接调用（不赋值），单行
content = content.replace(
  /^(\s+)(?!.*(?:const|let|var|await|return))(\s*)(db\.prepare\s*\([^)]+\)\s*\.\s*run\s*\([^)]*\))/gm,
  (match, indent, space, call) => {
    changes++
    return `${indent}await ${call}`
  }
)

// 模式4: 带链式调用的 .all().map()
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*all\s*\([^)]*\))\s*\.\s*map\s*\(/g,
  (match, prefix, call) => {
    changes++
    return `${prefix}(await ${call}).map(`
  }
)

// 模式5: 多行模板字符串带 .all().map()
content = content.replace(
  /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*all\s*\([^)]*\))\s*\.\s*map\s*\(/g,
  (match, prefix, call) => {
    changes++
    return `${prefix}(await ${call}).map(`
  }
)

fs.writeFileSync(filePath, content, 'utf8')
console.log(`✅ masterdata/controller.js: ${changes} 处修复完成`)
