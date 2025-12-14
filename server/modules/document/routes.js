/**
 * 文档管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 文档管理路由 ====================

// 获取文档统计
router.get('/documents/stats', controller.getDocumentStats)

// 获取文档列表
router.get('/documents', controller.getDocuments)

// 获取文档详情
router.get('/documents/:id', controller.getDocumentById)

// 创建文档（上传）
router.post('/documents', controller.createDocument)

// 更新文档信息
router.put('/documents/:id', controller.updateDocument)

// 删除文档
router.delete('/documents/:id', controller.deleteDocument)

// 更新文档状态（审核）
router.put('/documents/:id/status', controller.updateDocumentStatus)

// 下载文档
router.get('/documents/:id/download', controller.downloadDocument)

// 关联文档到实体
router.put('/documents/:id/link', controller.linkDocumentToEntity)

// 解除文档关联
router.put('/documents/:id/unlink', controller.unlinkDocumentFromEntity)

// ==================== 版本管理路由 ====================

// 获取文档版本历史
router.get('/documents/:id/versions', controller.getDocumentVersions)

// 上传新版本
router.post('/documents/:id/versions', controller.createDocumentVersion)

// ==================== 实体文档路由 ====================

// 获取实体关联的文档
router.get('/entities/:entityType/:entityId/documents', controller.getEntityDocuments)

// ==================== 文档模板路由 ====================

// 获取模板列表
router.get('/templates', controller.getTemplates)

// 获取模板详情
router.get('/templates/:id', controller.getTemplateById)

// 创建模板
router.post('/templates', controller.createTemplate)

// 更新模板
router.put('/templates/:id', controller.updateTemplate)

// 删除模板
router.delete('/templates/:id', controller.deleteTemplate)

export default router

