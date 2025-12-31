/**
 * 费用项审批路由
 */

import express from 'express'
import {
  getApprovalList,
  getApprovalById,
  createApproval,
  approveItem,
  rejectItem,
  deleteApproval,
  getPendingCount,
  getApprovalStats
} from './feeItemApproval.js'

const router = express.Router()

// 获取审批统计
router.get('/stats', async (req, res) => {
  try {
    const stats = await getApprovalStats()
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: stats
    })
  } catch (error) {
    console.error('获取审批统计失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '获取失败'
    })
  }
})

// 获取待审批数量
router.get('/pending-count', async (req, res) => {
  try {
    const count = await getPendingCount()
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: { count }
    })
  } catch (error) {
    console.error('获取待审批数量失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '获取失败'
    })
  }
})

// 获取审批列表
router.get('/', async (req, res) => {
  try {
    const result = await getApprovalList(req.query)
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: result
    })
  } catch (error) {
    console.error('获取审批列表失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '获取失败'
    })
  }
})

// 获取单个审批
router.get('/:id', async (req, res) => {
  try {
    const approval = await getApprovalById(req.params.id)
    if (!approval) {
      return res.json({
        errCode: 404,
        msg: '审批记录不存在'
      })
    }
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: approval
    })
  } catch (error) {
    console.error('获取审批详情失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '获取失败'
    })
  }
})

// 创建审批申请
router.post('/', async (req, res) => {
  try {
    const result = await createApproval({
      ...req.body,
      requestedBy: req.user?.id,
      requestedByName: req.user?.name
    })
    res.json({
      errCode: 200,
      msg: '创建成功',
      data: result
    })
  } catch (error) {
    console.error('创建审批失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '创建失败'
    })
  }
})

// 审批通过
router.post('/:id/approve', async (req, res) => {
  try {
    const result = await approveItem(req.params.id, {
      userId: req.user?.id || req.body.userId,
      userName: req.user?.name || req.body.userName
    })
    res.json({
      errCode: 200,
      msg: result.message,
      data: result
    })
  } catch (error) {
    console.error('审批通过失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '操作失败'
    })
  }
})

// 审批拒绝
router.post('/:id/reject', async (req, res) => {
  try {
    const result = await rejectItem(req.params.id, {
      userId: req.user?.id || req.body.userId,
      userName: req.user?.name || req.body.userName,
      reason: req.body.reason
    })
    res.json({
      errCode: 200,
      msg: result.message,
      data: result
    })
  } catch (error) {
    console.error('审批拒绝失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '操作失败'
    })
  }
})

// 删除审批
router.delete('/:id', async (req, res) => {
  try {
    await deleteApproval(req.params.id)
    res.json({
      errCode: 200,
      msg: '删除成功'
    })
  } catch (error) {
    console.error('删除审批失败:', error)
    res.json({
      errCode: 500,
      msg: error.message || '删除失败'
    })
  }
})

export default router

