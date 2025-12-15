/**
 * 批量修复所有模块的 model.js 文件
 * 将同步数据库调用改为 async/await
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const modulesDir = path.join(__dirname, '../modules')

// 不需要修改的函数（纯转换函数，不含数据库调用）
const skipFunctions = [
  'convertCustomerToCamelCase',
  'convertContactToCamelCase',
  'convertFollowUpToCamelCase',
  'convertOpportunityToCamelCase',
  'convertQuotationToCamelCase',
  'convertContractToCamelCase',
  'convertFeedbackToCamelCase',
  'convertCountryToCamelCase',
  'convertPortToCamelCase',
  'convertShippingCompanyToCamelCase',
  'convertVatRateToCamelCase',
  'convertUserToCamelCase',
  'convertRoleToCamelCase',
  'convertPermissionToCamelCase',
  'convertLoginLogToCamelCase',
  'convertBillToCamelCase',
  'convertDocumentToCamelCase',
  'convertTemplateToCamelCase',
  'convertInvoiceToCamelCase',
  'convertPaymentToCamelCase',
  'convertFeeToCamelCase',
  'convertSupplierToCamelCase',
  'hashPassword',
  'generateVerificationCode',
  'ensureUploadDir',
  'generateUniqueFileName',
  'getFilePath',
  'CUSTOMER_TYPE',
  'CUSTOMER_LEVEL',
  'CUSTOMER_STATUS',
  'FOLLOW_UP_TYPE'
]

function fixModelFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const fileName = path.basename(filePath)
  let changes = 0
  
  // 1. 将 export function xxx 改为 export async function xxx
  // 但跳过已经是 async 的函数和转换函数
  content = content.replace(
    /export function (\w+)\(/g,
    (match, funcName) => {
      if (skipFunctions.includes(funcName)) {
        return match
      }
      changes++
      return `export async function ${funcName}(`
    }
  )
  
  // 2. 在 db.prepare(...).get/all/run(...) 前添加 await
  // 处理单行情况
  content = content.replace(
    /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
    '$1await $2'
  )
  
  // 处理多行的模板字符串情况
  content = content.replace(
    /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*(?:get|all|run)\s*\([^)]*\))/g,
    '$1await $2'
  )
  
  // 3. 处理直接调用（不赋值给变量）的情况
  // 如: db.prepare(...).run(...)
  content = content.replace(
    /^(\s+)(?!.*(?:const|let|var|await|return))(\s*)(db\.prepare\s*\([^)]+\)\s*\.\s*run\s*\([^)]*\))/gm,
    '$1await $3'
  )
  
  content = content.replace(
    /^(\s+)(?!.*(?:const|let|var|await|return))(\s*)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*run\s*\([^)]*\))/gm,
    '$1await $3'
  )
  
  // 4. 处理有返回值的链式调用
  // 如: return db.prepare(...).get(...)
  content = content.replace(
    /(\breturn\s+)(?!await\s+)(db\.prepare\s*\([^)]+\)\s*\.\s*(?:get|all)\s*\([^)]*\))/g,
    '$1await $2'
  )
  
  content = content.replace(
    /(\breturn\s+)(?!await\s+)(db\.prepare\s*\(`[\s\S]*?`\)\s*\.\s*(?:get|all)\s*\([^)]*\))/g,
    '$1await $2'
  )
  
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`✅ ${fileName}: ${changes} 函数已修改为 async`)
  
  return changes
}

function fixControllerFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${path.basename(filePath)} 不存在，跳过`)
    return 0
  }
  
  let content = fs.readFileSync(filePath, 'utf8')
  const fileName = path.basename(filePath)
  let changes = 0
  
  // 在 model.xxx() 调用前添加 await
  // 匹配: model.functionName(
  // 但不匹配已经有 await 的
  const modelCallRegex = /(\b(?:const|let|var)\s+\w+\s*=\s*)(?!await\s+)(model\.\w+\s*\([^)]*\))/g
  
  content = content.replace(modelCallRegex, (match, prefix, call) => {
    // 检查是否是常量或转换函数
    if (skipFunctions.some(f => call.includes(f))) {
      return match
    }
    changes++
    return `${prefix}await ${call}`
  })
  
  // 处理直接调用（无赋值）的情况
  content = content.replace(
    /^(\s+)(?!.*(?:const|let|var|await|return))(model\.\w+\s*\([^)]*\))/gm,
    (match, indent, call) => {
      if (skipFunctions.some(f => call.includes(f))) {
        return match
      }
      changes++
      return `${indent}await ${call}`
    }
  )
  
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`✅ ${fileName}: ${changes} 处调用已添加 await`)
  
  return changes
}

// 主函数
async function main() {
  console.log('🔧 开始修复所有模块的 async/await...\n')
  
  const modules = fs.readdirSync(modulesDir).filter(f => {
    const stat = fs.statSync(path.join(modulesDir, f))
    return stat.isDirectory()
  })
  
  let totalModelChanges = 0
  let totalControllerChanges = 0
  
  for (const mod of modules) {
    console.log(`\n📦 处理模块: ${mod}`)
    
    const modelPath = path.join(modulesDir, mod, 'model.js')
    const controllerPath = path.join(modulesDir, mod, 'controller.js')
    
    if (fs.existsSync(modelPath)) {
      totalModelChanges += fixModelFile(modelPath)
    }
    
    if (fs.existsSync(controllerPath)) {
      totalControllerChanges += fixControllerFile(controllerPath)
    }
  }
  
  console.log('\n' + '═'.repeat(50))
  console.log(`✅ 完成！共修改 ${totalModelChanges} 个函数，${totalControllerChanges} 处调用`)
  console.log('═'.repeat(50))
}

main().catch(console.error)
