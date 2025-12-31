/**
 * 通知服务
 * 提供消息发送、审批创建等功能，供其他业务模块调用
 */

import * as messageModel from '../modules/message/model.js'

/**
 * 发送系统消息
 * @param {Object} params
 * @param {string} params.receiverId - 接收人ID
 * @param {string} params.receiverName - 接收人名称
 * @param {string} params.title - 消息标题
 * @param {string} params.content - 消息内容
 * @param {string} params.type - 消息类型 (system/approval/alert)
 * @param {string} params.relatedType - 关联类型 (order/invoice/supplier等)
 * @param {string} params.relatedId - 关联ID
 * @param {string} params.senderId - 发送人ID
 * @param {string} params.senderName - 发送人名称
 */
export async function sendMessage(params) {
  try {
    const result = await messageModel.createMessage({
      type: params.type || 'system',
      title: params.title,
      content: params.content || '',
      receiverId: params.receiverId,
      receiverName: params.receiverName,
      senderId: params.senderId,
      senderName: params.senderName,
      relatedType: params.relatedType,
      relatedId: params.relatedId
    })
    return { success: true, messageId: result.id }
  } catch (error) {
    console.error('发送消息失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 批量发送消息
 * @param {Array} messages - 消息数组
 */
export async function sendMessages(messages) {
  try {
    const result = await messageModel.createMessages(messages)
    return { success: true, ...result }
  } catch (error) {
    console.error('批量发送消息失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 创建审批
 * @param {Object} params
 * @param {string} params.approvalType - 审批类型 (order/payment/supplier/fee)
 * @param {string} params.businessId - 关联业务ID
 * @param {string} params.title - 审批标题
 * @param {string} params.content - 审批内容
 * @param {number} params.amount - 金额
 * @param {string} params.applicantId - 申请人ID
 * @param {string} params.applicantName - 申请人名称
 * @param {string} params.approverId - 审批人ID (可选，不指定则所有有权限的人可审批)
 * @param {string} params.approverName - 审批人名称
 */
export async function createApproval(params) {
  try {
    const result = await messageModel.createApproval({
      approvalType: params.approvalType,
      businessId: params.businessId,
      title: params.title,
      content: params.content || '',
      amount: params.amount,
      applicantId: params.applicantId,
      applicantName: params.applicantName,
      approverId: params.approverId,
      approverName: params.approverName
    })
    
    // 如果指定了审批人，发送通知
    if (params.approverId) {
      await sendMessage({
        type: 'approval',
        title: '新的审批待处理',
        content: `${params.applicantName || '用户'} 提交了 "${params.title}"，请及时处理。`,
        receiverId: params.approverId,
        receiverName: params.approverName,
        senderId: params.applicantId,
        senderName: params.applicantName,
        relatedType: 'approval',
        relatedId: result.id
      })
    }
    
    return { success: true, approvalId: result.id }
  } catch (error) {
    console.error('创建审批失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 发送订单相关通知
 * @param {Object} params
 * @param {string} params.billId - 订单ID
 * @param {string} params.billNumber - 订单号
 * @param {string} params.eventType - 事件类型 (created/updated/completed/exception)
 * @param {string} params.receiverId - 接收人ID
 * @param {string} params.receiverName - 接收人名称
 * @param {string} params.content - 通知内容
 */
export async function sendOrderNotification(params) {
  const titleMap = {
    created: '新订单创建',
    updated: '订单更新',
    completed: '订单完成',
    exception: '订单异常'
  }
  
  return sendMessage({
    type: 'system',
    title: titleMap[params.eventType] || '订单通知',
    content: params.content || `订单 ${params.billNumber} 状态更新`,
    receiverId: params.receiverId,
    receiverName: params.receiverName,
    relatedType: 'order',
    relatedId: params.billId
  })
}

/**
 * 发送财务相关通知
 * @param {Object} params
 * @param {string} params.invoiceId - 发票ID
 * @param {string} params.invoiceNumber - 发票号
 * @param {string} params.eventType - 事件类型 (created/paid/overdue)
 * @param {string} params.receiverId - 接收人ID
 * @param {string} params.receiverName - 接收人名称
 * @param {string} params.content - 通知内容
 */
export async function sendFinanceNotification(params) {
  const titleMap = {
    created: '新发票创建',
    paid: '发票已收款',
    overdue: '发票逾期提醒'
  }
  
  return sendMessage({
    type: params.eventType === 'overdue' ? 'alert' : 'system',
    title: titleMap[params.eventType] || '财务通知',
    content: params.content || `发票 ${params.invoiceNumber} 状态更新`,
    receiverId: params.receiverId,
    receiverName: params.receiverName,
    relatedType: 'invoice',
    relatedId: params.invoiceId
  })
}

/**
 * 创建付款审批
 * @param {Object} params
 * @param {string} params.paymentId - 付款ID
 * @param {number} params.amount - 金额
 * @param {string} params.applicantId - 申请人ID
 * @param {string} params.applicantName - 申请人名称
 * @param {string} params.approverId - 审批人ID
 * @param {string} params.approverName - 审批人名称
 * @param {string} params.description - 描述
 */
export async function createPaymentApproval(params) {
  return createApproval({
    approvalType: 'payment',
    businessId: params.paymentId,
    title: `付款申请 - ${params.amount} EUR`,
    content: params.description || '请审批付款申请',
    amount: params.amount,
    applicantId: params.applicantId,
    applicantName: params.applicantName,
    approverId: params.approverId,
    approverName: params.approverName
  })
}

/**
 * 创建供应商入库审批
 * @param {Object} params
 * @param {string} params.supplierId - 供应商ID
 * @param {string} params.supplierName - 供应商名称
 * @param {string} params.applicantId - 申请人ID
 * @param {string} params.applicantName - 申请人名称
 * @param {string} params.approverId - 审批人ID
 * @param {string} params.approverName - 审批人名称
 */
export async function createSupplierApproval(params) {
  return createApproval({
    approvalType: 'supplier',
    businessId: params.supplierId,
    title: `供应商入库审批 - ${params.supplierName}`,
    content: `新供应商 "${params.supplierName}" 申请入库，请审批`,
    applicantId: params.applicantId,
    applicantName: params.applicantName,
    approverId: params.approverId,
    approverName: params.approverName
  })
}

/**
 * 创建大额订单审批
 * @param {Object} params
 * @param {string} params.billId - 订单ID
 * @param {string} params.billNumber - 订单号
 * @param {number} params.amount - 金额
 * @param {string} params.applicantId - 申请人ID
 * @param {string} params.applicantName - 申请人名称
 * @param {string} params.approverId - 审批人ID
 * @param {string} params.approverName - 审批人名称
 */
export async function createOrderApproval(params) {
  return createApproval({
    approvalType: 'order',
    businessId: params.billId,
    title: `大额订单审批 - ${params.billNumber}`,
    content: `订单 ${params.billNumber} 金额 ${params.amount} EUR，需要审批`,
    amount: params.amount,
    applicantId: params.applicantId,
    applicantName: params.applicantName,
    approverId: params.approverId,
    approverName: params.approverName
  })
}

export default {
  sendMessage,
  sendMessages,
  createApproval,
  sendOrderNotification,
  sendFinanceNotification,
  createPaymentApproval,
  createSupplierApproval,
  createOrderApproval
}
