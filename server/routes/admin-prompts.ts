/**
 * 管理员提示词注入模块路由
 * 提供提示词模板的管理功能
 */

import { Router } from 'express';
import { storage } from '../storage';
import { log } from '../vite';
import { z } from 'zod';

const router = Router();

// 验证提示词模板的格式
const promptTemplateSchema = z.object({
  modelId: z.string().min(1).max(50),
  promptTemplate: z.string().min(10),
});

// 获取特定模型的提示词模板
router.get('/:modelId', async (req, res) => {
  try {
    // 验证用户身份（必须是管理员）
    const { userId, role } = req.query;
    
    if (!userId || role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: '只有管理员可以访问提示词模板'
      });
    }
    
    const modelId = req.params.modelId;
    if (!modelId) {
      return res.status(400).json({
        success: false,
        message: '模型ID不能为空'
      });
    }
    
    const template = await storage.getPromptTemplate(modelId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: `未找到模型 ${modelId} 的提示词模板`
      });
    }
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    log(`[管理员提示词] 获取模板错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '获取提示词模板失败'
    });
  }
});

// 获取所有提示词模板
router.get('/', async (req, res) => {
  try {
    // 验证用户身份（必须是管理员）
    const { userId, role } = req.query;
    
    if (!userId || role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: '只有管理员可以访问提示词模板'
      });
    }
    
    const templates = await storage.getAllPromptTemplates();
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log(`[管理员提示词] 获取所有模板错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '获取所有提示词模板失败'
    });
  }
});

// 创建或更新提示词模板
router.post('/', async (req, res) => {
  try {
    // 验证用户身份（必须是管理员）
    const { userId, role } = req.query;
    
    if (!userId || role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: '只有管理员可以管理提示词模板'
      });
    }
    
    // 验证请求体
    const validationResult = promptTemplateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '无效的提示词模板格式',
        errors: validationResult.error.format()
      });
    }
    
    const { modelId, promptTemplate } = validationResult.data;
    
    // 创建或更新模板
    const template = await storage.createOrUpdatePromptTemplate(
      modelId, 
      promptTemplate, 
      Number(userId)
    );
    
    res.json({
      success: true,
      message: '提示词模板已保存',
      template
    });
  } catch (error) {
    log(`[管理员提示词] 保存模板错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '保存提示词模板失败'
    });
  }
});

// 删除提示词模板
router.delete('/:modelId', async (req, res) => {
  try {
    // 验证用户身份（必须是管理员）
    const { userId, role } = req.query;
    
    if (!userId || role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: '只有管理员可以删除提示词模板'
      });
    }
    
    const modelId = req.params.modelId;
    if (!modelId) {
      return res.status(400).json({
        success: false,
        message: '模型ID不能为空'
      });
    }
    
    // 先检查模板是否存在
    const template = await storage.getPromptTemplate(modelId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: `未找到模型 ${modelId} 的提示词模板`
      });
    }
    
    // 删除模板
    await storage.deletePromptTemplate(modelId);
    
    res.json({
      success: true,
      message: `模型 ${modelId} 的提示词模板已删除`
    });
  } catch (error) {
    log(`[管理员提示词] 删除模板错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '删除提示词模板失败'
    });
  }
});

export default router;